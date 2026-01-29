//! HQuant - High-performance quantitative trading framework
//!
//! Features:
//! - High-performance ring buffer, avoiding dynamic memory allocation
//! - SoA (Struct of Arrays) columnar storage, cache-friendly
//! - Complete technical indicator library (MA/RSI/MACD/ATR/BOLL/VRI)
//! - Multi-timeframe aggregator (15m/4h/1d)
//! - Flexible strategy system
//! - Spot/Futures backtesting engine (with liquidation simulation)

pub mod error;
pub use error::{HQuantError, HQuantResult, QuantError};

pub mod aggregator;
pub mod backtest;
pub mod common;
pub mod dsl;
pub mod indicators;
pub mod kline;
pub mod strategy;

#[cfg(all(feature = "ffi-node", feature = "ffi-python"))]
compile_error!(
    "ffi-node and ffi-python cannot be enabled together. Build one FFI target at a time."
);

#[cfg(any(feature = "ffi-node", feature = "ffi-python"))]
pub mod ffi;

pub use aggregator::{Aggregator, MultiTimeFrameAggregator, TimeFrame};
pub use backtest::{
    // Decimal utility
    round_decimal,
    BacktestConfig,
    BacktestEngine,
    BacktestStats,
    ClosedPosition,
    // FuturesBacktest (standalone)
    FuturesBacktest,
    FuturesBacktestConfig,
    FuturesBacktestResult,
    MarketType,
    Position,
    PositionSide,
    Trade,
    DEFAULT_DECIMALS,
};
pub use common::{F64RingBuffer, RingBuffer};
pub use dsl::{
    compile as compile_dsl, Action, DslContext, DslEngine, Expr, LabeledVector, Statement,
    VectorStore,
};
pub use indicators::{
    atr, boll, cci, ema, ma, macd, mfi, obv, roc, rsi, sma, vri, vwap, williams_r, ATRBuilder,
    BOLLBuilder, DynamicIndicator, GraphSummary, Indicator, IndicatorBuilder, IndicatorGraph,
    IndicatorId, IndicatorSpec, IndicatorValue, MABuilder, MACDBuilder, MAType, PriceType,
    RSIBuilder, StdDev, VRIBuilder, ATR, BOLL, MA, MACD, RSI, VRI,
};
pub use kline::{Bar, KlineSeries};
pub use strategy::{
    BollStrategy, FnStrategy, IndicatorSnapshot, MACDStrategy, MACrossStrategy, RSIStrategy, Side,
    Signal, Strategy, StrategyContext,
};

/// Quantitative Engine - Core entry point
pub struct QuantEngine {
    /// K-line data
    klines: KlineSeries,
    /// Indicator graph with DAG-based dedup and topological execution
    graph: IndicatorGraph,
    /// Strategy collection
    strategies: Vec<Box<dyn Strategy>>,
    /// Multi-timeframe aggregator
    aggregator: Option<MultiTimeFrameAggregator>,
    /// Backtest engine
    backtest: Option<BacktestEngine>,
}

impl QuantEngine {
    /// Create a new quantitative engine
    pub fn new(capacity: usize) -> HQuantResult<Self> {
        let klines = KlineSeries::new(capacity)?;
        Ok(Self {
            klines,
            graph: IndicatorGraph::new(),
            strategies: Vec::new(),
            aggregator: None,
            backtest: None,
        })
    }

    /// Add indicator using Builder pattern (opaque, not deduplicated)
    pub fn add_indicator<B: IndicatorBuilder>(
        &mut self,
        name: impl Into<String>,
        builder: B,
    ) -> HQuantResult<()> {
        self.graph.add_boxed(name, builder.build()?);
        Ok(())
    }

    /// Add pre-built indicator (Box<dyn Indicator>), opaque node
    pub fn add_indicator_boxed(&mut self, name: impl Into<String>, indicator: Box<dyn Indicator>) {
        self.graph.add_boxed(name, indicator);
    }

    /// Add indicator by spec with automatic deduplication.
    /// Composite indicators (MACD, BOLL) automatically share sub-indicators.
    pub fn add_indicator_spec(
        &mut self,
        name: impl Into<String>,
        spec: IndicatorSpec,
    ) -> HQuantResult<IndicatorId> {
        self.graph.add_with_name(name, spec)
    }

    /// Add dynamic indicator (runtime custom calculation)
    pub fn add_dynamic_indicator<F>(
        &mut self,
        name: impl Into<String>,
        min_periods: usize,
        calc_fn: F,
    ) -> HQuantResult<()>
    where
        F: Fn(&KlineSeries) -> Option<f64> + Send + Sync + 'static,
    {
        let name_str = name.into();
        let capacity = self.klines.capacity();
        self.add_indicator_boxed(
            name_str.clone(),
            Box::new(DynamicIndicator::new(
                name_str,
                min_periods,
                capacity,
                calc_fn,
            )?),
        );
        Ok(())
    }

    /// Add predefined VWAP indicator
    pub fn add_vwap(&mut self, name: impl Into<String>) -> HQuantResult<()> {
        let capacity = self.klines.capacity();
        self.add_indicator_boxed(name, Box::new(vwap(capacity)?));
        Ok(())
    }

    /// Add predefined Williams %R indicator
    pub fn add_williams_r(&mut self, name: impl Into<String>, period: usize) -> HQuantResult<()> {
        let capacity = self.klines.capacity();
        self.add_indicator_boxed(name, Box::new(williams_r(period, capacity)?));
        Ok(())
    }

    /// Add predefined CCI indicator
    pub fn add_cci(&mut self, name: impl Into<String>, period: usize) -> HQuantResult<()> {
        let capacity = self.klines.capacity();
        self.add_indicator_boxed(name, Box::new(cci(period, capacity)?));
        Ok(())
    }

    /// Add predefined ROC indicator
    pub fn add_roc(&mut self, name: impl Into<String>, period: usize) -> HQuantResult<()> {
        let capacity = self.klines.capacity();
        self.add_indicator_boxed(name, Box::new(roc(period, capacity)?));
        Ok(())
    }

    /// Add strategy
    pub fn add_strategy(&mut self, strategy: Box<dyn Strategy>) {
        self.strategies.push(strategy);
    }

    /// Setup multi-timeframe aggregation
    pub fn setup_aggregator(
        &mut self,
        base_tf: TimeFrame,
        target_tfs: &[TimeFrame],
        capacity: usize,
    ) -> HQuantResult<()> {
        self.aggregator = Some(MultiTimeFrameAggregator::new(
            base_tf, target_tfs, capacity,
        )?);
        Ok(())
    }

    /// Setup backtest engine
    pub fn setup_backtest(&mut self, config: BacktestConfig) {
        self.backtest = Some(BacktestEngine::new(config));
    }

    /// Append K-line data
    pub fn append_bar(&mut self, bar: &Bar) -> Vec<Signal> {
        // Update K-line
        self.klines.append(bar);

        // Update all indicators in topological order
        self.graph.push(bar);

        // Update aggregator
        if let Some(agg) = &mut self.aggregator {
            agg.push(bar);
        }

        // Evaluate strategies
        let signals = self.evaluate_strategies(bar);

        // Backtest processing
        if let Some(bt) = &mut self.backtest {
            for signal in &signals {
                bt.process_signal(signal, bar);
            }
        }

        signals
    }

    /// Update last K-line (realtime data)
    pub fn update_last_bar(&mut self, bar: &Bar) {
        self.klines.update_last(bar);

        self.graph.update_last(bar);

        if let Some(agg) = &mut self.aggregator {
            agg.update_last(bar);
        }
    }

    /// Batch load historical data
    pub fn load_history(&mut self, bars: &[Bar]) -> Vec<Signal> {
        let mut all_signals = Vec::new();
        for bar in bars {
            let signals = self.append_bar(bar);
            all_signals.extend(signals);
        }
        all_signals
    }

    /// Evaluate all strategies
    fn evaluate_strategies(&mut self, bar: &Bar) -> Vec<Signal> {
        let snapshot = IndicatorSnapshot::new(&self.graph);
        let ctx = StrategyContext {
            bar,
            indicators: snapshot,
        };

        self.strategies
            .iter_mut()
            .filter_map(|s| s.evaluate(&ctx))
            .collect()
    }

    /// Get indicator value
    pub fn indicator_value(&self, name: &str) -> Option<f64> {
        self.graph.value_by_name(name)
    }

    /// Get indicator result
    pub fn indicator_result(&self, name: &str) -> Option<IndicatorValue> {
        self.graph.result_by_name(name)
    }

    /// Check if indicator is ready
    pub fn indicator_ready(&self, name: &str) -> bool {
        self.graph.is_ready_by_name(name)
    }

    /// Get the indicator graph (for advanced access and debugging)
    pub fn graph(&self) -> &IndicatorGraph {
        &self.graph
    }

    /// Get a summary of the indicator graph
    pub fn graph_summary(&self) -> GraphSummary {
        self.graph.summary()
    }

    /// Get K-line series
    pub fn klines(&self) -> &KlineSeries {
        &self.klines
    }

    /// Get last K-line
    pub fn last_bar(&self) -> Option<Bar> {
        self.klines.last()
    }

    /// Get aggregator
    pub fn aggregator(&self) -> Option<&MultiTimeFrameAggregator> {
        self.aggregator.as_ref()
    }

    /// Get backtest result
    pub fn backtest_result(&mut self) -> Option<&BacktestStats> {
        self.backtest.as_mut().map(|bt| bt.result())
    }

    /// Get backtest trades
    pub fn backtest_trades(&self) -> Option<&[Trade]> {
        self.backtest.as_ref().map(|bt| bt.trades())
    }

    /// Get backtest equity curve
    pub fn backtest_equity_curve(&self) -> Option<&[f64]> {
        self.backtest.as_ref().map(|bt| bt.equity_curve())
    }

    /// Reset engine
    pub fn reset(&mut self) {
        self.klines.clear();
        self.graph.reset();
        if let Some(agg) = &mut self.aggregator {
            agg.reset();
        }
        if let Some(bt) = &mut self.backtest {
            bt.reset();
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn create_test_bars() -> Vec<Bar> {
        (0..100)
            .map(|i| {
                let base = 100.0 + (i as f64 * 0.1).sin() * 10.0;
                Bar::new(
                    i * 15 * 60_000,
                    base,
                    base + 2.0,
                    base - 2.0,
                    base + 1.0,
                    1000.0 + i as f64 * 10.0,
                )
            })
            .collect()
    }

    #[test]
    fn test_quant_engine_basic() {
        let mut engine = QuantEngine::new(1000).unwrap();

        engine.add_indicator("ma20", ma().period(20).sma()).unwrap();
        engine.add_indicator("rsi14", rsi().period(14)).unwrap();
        engine
            .add_indicator("macd", macd().fast(12).slow(26).signal(9))
            .unwrap();

        let bars = create_test_bars();
        engine.load_history(&bars);

        assert!(engine.indicator_ready("ma20"));
        assert!(engine.indicator_ready("rsi14"));
        assert!(engine.indicator_value("ma20").is_some());
    }

    #[test]
    fn test_quant_engine_with_aggregator() {
        let mut engine = QuantEngine::new(1000).unwrap();

        engine
            .setup_aggregator(TimeFrame::M15, &[TimeFrame::H1, TimeFrame::H4], 100)
            .unwrap();

        let bars = create_test_bars();
        engine.load_history(&bars);

        let agg = engine.aggregator().unwrap();
        assert!(agg.output(TimeFrame::H1).unwrap().len() > 0);
    }

    #[test]
    fn test_quant_engine_backtest() {
        let mut engine = QuantEngine::new(1000).unwrap();

        engine
            .add_indicator("ma_fast", ma().period(5).sma())
            .unwrap();
        engine
            .add_indicator("ma_slow", ma().period(20).sma())
            .unwrap();

        engine.setup_backtest(BacktestConfig::spot(10000.0));

        engine.add_strategy(Box::new(FnStrategy::new("simple", |ctx| {
            let fast = ctx.indicators.value("ma_fast")?;
            let slow = ctx.indicators.value("ma_slow")?;

            if fast > slow * 1.02 {
                Some(Signal::buy(0.8, "ma_cross_up", ctx.bar.timestamp))
            } else if fast < slow * 0.98 {
                Some(Signal::sell(0.8, "ma_cross_down", ctx.bar.timestamp))
            } else {
                None
            }
        })));

        let bars = create_test_bars();
        engine.load_history(&bars);

        let stats = engine.backtest_result().unwrap();
        println!("Total trades: {}", stats.total_trades);
        println!("Total PnL: {:.2}", stats.total_pnl);
        println!("Max Drawdown: {:.2}%", stats.max_drawdown_pct);
    }

    /// Full integration test: spec-based dedup + multiple strategies + backtest
    #[test]
    fn test_full_integration_dedup_strategies_backtest() {
        let mut engine = QuantEngine::new(1000).unwrap();

        // ── Register indicators via IndicatorSpec (automatic dedup) ──
        // MACD internally needs EMA(12) and EMA(26); BOLL needs SMA(20) and StdDev(20).
        // Adding standalone EMA(12) should be shared with MACD's EMA(12).
        let _ema12_id = engine
            .add_indicator_spec("ema12", IndicatorSpec::ema(12))
            .unwrap();
        let _macd_id = engine
            .add_indicator_spec("macd", IndicatorSpec::macd(12, 26, 9))
            .unwrap();
        let _boll_id = engine
            .add_indicator_spec("boll", IndicatorSpec::boll(20, 2.0))
            .unwrap();
        let _rsi_id = engine
            .add_indicator_spec(
                "rsi14",
                IndicatorSpec::Rsi {
                    period: 14,
                    price_type: PriceType::Close,
                },
            )
            .unwrap();
        // Standalone SMA(20) — should be shared with BOLL's SMA(20)
        let _sma20_id = engine
            .add_indicator_spec("sma20", IndicatorSpec::sma(20))
            .unwrap();

        // ── Verify dedup via graph summary ──
        let summary = engine.graph_summary();
        // MACD adds: EMA(12), EMA(26), MACD composite  → EMA(12) shared with standalone
        // BOLL adds: SMA(20), StdDev(20), BOLL composite → SMA(20) shared with standalone
        // RSI adds: RSI(14)
        // Total unique nodes: EMA(12), EMA(26), MACD, SMA(20), StdDev(20), BOLL, RSI(14) = 7
        assert_eq!(
            summary.total_nodes, 7,
            "Expected 7 unique nodes after dedup, got {}. Summary: {:?}",
            summary.total_nodes, summary
        );

        // ── Add strategies ──
        // RSI overbought/oversold
        engine.add_strategy(Box::new(RSIStrategy::new("rsi14", 30.0, 70.0)));
        // MACD histogram crossover
        engine.add_strategy(Box::new(MACDStrategy::new("macd")));
        // Bollinger band breakout
        engine.add_strategy(Box::new(BollStrategy::new("boll")));

        // ── Setup backtest (spot, $10k) ──
        engine.setup_backtest(BacktestConfig::spot(10000.0));

        // ── Generate synthetic price data (100 bars with oscillating pattern) ──
        let bars: Vec<Bar> = (0..100)
            .map(|i| {
                let base = 100.0 + 10.0 * ((i as f64 * 0.15).sin());
                Bar::new(
                    i * 60_000, // 1-minute bars
                    base - 0.5,
                    base + 2.0,
                    base - 2.0,
                    base + 0.5,
                    500.0 + (i as f64 * 5.0),
                )
            })
            .collect();

        // ── Run backtest via load_history ──
        let all_signals = engine.load_history(&bars);
        println!(
            "[integration] Total signals generated: {}",
            all_signals.len()
        );

        // ── Verify indicators produced values ──
        assert!(
            engine.indicator_ready("ema12"),
            "EMA(12) should be ready after 100 bars"
        );
        assert!(
            engine.indicator_ready("rsi14"),
            "RSI(14) should be ready after 100 bars"
        );
        assert!(
            engine.indicator_ready("macd"),
            "MACD should be ready after 100 bars"
        );
        assert!(
            engine.indicator_ready("boll"),
            "BOLL should be ready after 100 bars"
        );
        assert!(
            engine.indicator_ready("sma20"),
            "SMA(20) should be ready after 100 bars"
        );

        // All indicator values should be Some
        assert!(engine.indicator_value("ema12").is_some());
        assert!(engine.indicator_value("rsi14").is_some());
        assert!(engine.indicator_value("sma20").is_some());

        // MACD result should have extra = [signal_line, histogram]
        let macd_result = engine.indicator_result("macd").unwrap();
        assert!(macd_result.extra.is_some());
        assert_eq!(macd_result.extra.as_ref().unwrap().len(), 2);

        // BOLL result should have extra = [upper, lower]
        let boll_result = engine.indicator_result("boll").unwrap();
        assert!(boll_result.extra.is_some());
        assert_eq!(boll_result.extra.as_ref().unwrap().len(), 2);

        // ── Verify shared values match ──
        // The standalone EMA(12) and MACD's internal EMA(12) should be the same node
        let ema12_val = engine.indicator_value("ema12").unwrap();
        assert!(
            ema12_val.is_finite(),
            "EMA(12) should produce a finite value"
        );

        // SMA(20) and BOLL's middle band should match
        let sma20_val = engine.indicator_value("sma20").unwrap();
        let boll_middle = engine.indicator_value("boll").unwrap();
        assert!(
            (sma20_val - boll_middle).abs() < 1e-10,
            "SMA(20)={} should equal BOLL middle={}  (shared node)",
            sma20_val,
            boll_middle
        );

        // ── Verify backtest ran ──
        let stats = engine.backtest_result().unwrap();
        println!(
            "[integration] Backtest: trades={}, pnl={:.2}, drawdown={:.2}%, equity={:.2}",
            stats.total_trades, stats.total_pnl, stats.max_drawdown_pct, stats.final_equity
        );
        // Stats should be coherent
        assert_eq!(
            stats.winning_trades + stats.losing_trades,
            stats.total_trades
        );
        assert!(stats.final_equity > 0.0, "Equity should remain positive");

        // Equity curve should have entries
        let curve = engine.backtest_equity_curve().unwrap();
        assert!(curve.len() > 1, "Equity curve should have entries");
    }
}
