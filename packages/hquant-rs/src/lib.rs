#[cfg(all(feature = "ffi-node", feature = "ffi-python"))]
compile_error!("features `ffi-node` and `ffi-python` cannot be enabled together");

pub mod aggregator;
pub mod backtest;
pub mod circular;
pub mod commom;
pub mod dsl;
pub mod hquant;
pub mod indicators;
pub mod kline_buffer;
pub mod multi;
pub mod period;
pub mod types;
pub mod vector_store;

#[cfg(any(feature = "ffi-node", feature = "ffi-python"))]
pub mod ffi;

pub use aggregator::{AggregateCandle, Aggregator, AggregatorEvent, AggregatorEventKind};
pub use backtest::futures_backtest::{BacktestParams, BacktestResult, FuturesBacktest};
pub use circular::CircularColumn;
pub use hquant::HQuant;
pub use indicators::{IndicatorGraph, IndicatorId, IndicatorSpec, IndicatorValue};
pub use kline_buffer::KlineBuffer;
pub use multi::MultiHQuant;
pub use period::Period;
pub use types::{Action, Bar, Field, Signal};
pub use vector_store::{LabeledVector, SimilarityMethod, SimilarityResult, VectorStore};

#[cfg(test)]
mod tests {
    use super::*;
    use crate::dsl::StrategyError;

    #[test]
    fn circular_column_overwrite_and_update_last() {
        let mut c = CircularColumn::<i32>::new(3);
        c.push(1);
        c.push(2);
        c.push(3);
        assert_eq!(c.to_vec_ordered(), vec![1, 2, 3]);

        c.push(4);
        assert_eq!(c.to_vec_ordered(), vec![2, 3, 4]);

        c.update_last(9);
        assert_eq!(c.to_vec_ordered(), vec![2, 3, 9]);
        assert_eq!(c.get_from_end(0), Some(9));
        assert_eq!(c.get_from_end(1), Some(3));
    }

    #[test]
    fn dsl_rsi_strategy_emits_signals() {
        let mut hq = HQuant::new(64);
        hq.add_indicator(IndicatorSpec::Rsi { period: 3 });
        hq.add_strategy(
            "s",
            "IF RSI(3) < 30 THEN BUY\nIF RSI(3) > 70 THEN SELL",
        )
        .unwrap();

        let mut close = 100.0;
        for i in 0..40 {
            close -= 1.0;
            hq.push_kline(Bar {
                timestamp: i,
                open: close,
                high: close,
                low: close,
                close,
                volume: 1.0,
                buy_volume: 0.0,
            });
        }

        let sigs = hq.poll_signals();
        assert!(sigs.iter().any(|s| s.action == Action::Buy));
    }

    #[test]
    fn dsl_vector_similarity_can_trigger() {
        let mut hq = HQuant::new(64);
        hq.set_similarity_threshold(0.9);

        let raw = vec![1.0, 2.0, 3.0, 4.0];
        let stored = crate::vector_store::min_max_normalize(&raw);
        hq.load_store(
            "p",
            vec![LabeledVector {
                label: 1,
                vector: stored,
                ts: None,
            }],
        );

        hq.add_strategy(
            "vec",
            "IF SIMILARITY(VEC_STORE(\"p\"), NORMALIZE(close, length=4, method=\"minmax\"), threshold=0.9) > 0.9 THEN BUY",
        )
        .unwrap();

        for (i, close) in raw.into_iter().enumerate() {
            hq.push_kline(Bar {
                timestamp: i as i64,
                open: close,
                high: close,
                low: close,
                close,
                volume: 1.0,
                buy_volume: 0.0,
            });
        }

        let sigs = hq.poll_signals();
        assert!(sigs.iter().any(|s| s.action == Action::Buy));
    }

    #[test]
    fn dsl_var_allows_reusing_normalize_expr() {
        let mut hq = HQuant::new(64);
        hq.set_similarity_threshold(0.9);

        let raw = vec![1.0, 2.0, 3.0, 4.0];
        let stored = crate::vector_store::min_max_normalize(&raw);
        hq.load_store(
            "p",
            vec![LabeledVector {
                label: 1,
                vector: stored,
                ts: None,
            }],
        );

        hq.add_strategy(
            "vec",
            "LET v = NORMALIZE(close, length=4, method=\"minmax\")\nIF SIMILARITY(\"p\", v, threshold=0.9) > 0.9 THEN BUY",
        )
        .unwrap();

        for (i, close) in raw.into_iter().enumerate() {
            hq.push_kline(Bar {
                timestamp: i as i64,
                open: close,
                high: close,
                low: close,
                close,
                volume: 1.0,
                buy_volume: 0.0,
            });
        }

        let sigs = hq.poll_signals();
        assert!(sigs.iter().any(|s| s.action == Action::Buy));
    }

    #[test]
    fn aggregator_emits_closed_events() {
        let base = Period::parse("1m").unwrap();
        let target = Period::parse("2m").unwrap();
        let mut agg = Aggregator::new(vec![base, target]);

        let b0 = Bar {
            timestamp: 0,
            open: 100.0,
            high: 101.0,
            low: 99.0,
            close: 100.0,
            volume: 1.0,
            buy_volume: 0.0,
        };
        let b1 = Bar {
            timestamp: 60_000,
            open: 100.0,
            high: 102.0,
            low: 98.0,
            close: 99.0,
            volume: 2.0,
            buy_volume: 0.0,
        };
        let b2 = Bar {
            timestamp: 120_000,
            open: 99.0,
            high: 103.0,
            low: 97.0,
            close: 101.0,
            volume: 3.0,
            buy_volume: 0.0,
        };

        agg.push(&b0);
        agg.push(&b1);
        assert!(agg.poll_events().is_empty());

        agg.push(&b2);
        let events = agg.poll_events();
        assert_eq!(events.len(), 1);
        assert_eq!(events[0].period.as_ms(), target.as_ms());
        assert_eq!(events[0].candle.open_time, 0);
        assert_eq!(events[0].candle.open, 100.0);
        assert_eq!(events[0].candle.close, 99.0);
        assert_eq!(events[0].candle.volume, 3.0);
    }

    #[test]
    fn dsl_single_engine_rejects_period_suffix() {
        let mut hq = HQuant::new(64);
        let err = hq
            .add_strategy("s", "IF close@4h > 0 THEN BUY")
            .unwrap_err();
        assert!(matches!(err, StrategyError::MultiPeriodNotSupported(_)));
    }

    #[test]
    fn dsl_series_ref_trims_trailing_whitespace() {
        // `series_ref` in the pest grammar isn't atomic; when `@<period>` is omitted,
        // implicit whitespace skipping can end up in the captured span (e.g. `"close "`).
        // The compiler should trim it so field/var lookup works.
        let mut hq = HQuant::new(64);
        hq.add_strategy("s", "IF close > 0 THEN BUY").unwrap();

        let mut hq2 = HQuant::new(64);
        hq2.add_strategy("s", "LET x = RSI(3)\nIF x < 30 THEN BUY")
            .unwrap();
    }

    #[test]
    fn multi_hquant_multi_strategy_can_use_period_suffix_in_normalize() {
        let p15m = Period::parse("15m").unwrap();
        let p4h = Period::parse("4h").unwrap();
        let mut mh = MultiHQuant::new(256, vec![p15m, p4h]);

        mh.set_similarity_threshold(0.9).unwrap();

        let stored = crate::vector_store::min_max_normalize(&[1.0, 2.0, 3.0, 4.0]);
        mh.load_store(
            "p15m",
            vec![LabeledVector {
                label: 1,
                vector: stored.clone(),
                ts: None,
            }],
        )
        .unwrap();
        mh.load_store(
            "p4h",
            vec![LabeledVector {
                label: 1,
                vector: stored,
                ts: None,
            }],
        )
        .unwrap();

        mh.add_multi_strategy(
            "m",
            "IF SIMILARITY(\"p4h\", NORMALIZE(close@4h, length=4, method=\"minmax\"), threshold=0.9) > 0.9 AND SIMILARITY(\"p15m\", NORMALIZE(close@15m, length=4, method=\"minmax\"), threshold=0.9) > 0.9 THEN BUY",
        )
        .unwrap();

        let ms15m = p15m.as_ms();
        for i in 0..64i64 {
            let close = (i + 1) as f64;
            mh.feed_bar(Bar {
                timestamp: i * ms15m,
                open: close,
                high: close,
                low: close,
                close,
                volume: 1.0,
                buy_volume: 0.0,
            });
        }
        mh.flush();

        let sigs = mh.poll_signals();
        assert!(sigs.iter().any(|s| s.action == Action::Buy));
    }
}
