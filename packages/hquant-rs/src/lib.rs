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

pub mod common;
pub mod kline;
pub mod indicators;
pub mod aggregator;
pub mod strategy;
pub mod backtest;
pub mod dsl;

#[cfg(all(feature = "ffi-node", feature = "ffi-python"))]
compile_error!("ffi-node and ffi-python cannot be enabled together. Build one FFI target at a time.");

#[cfg(any(feature = "ffi-node", feature = "ffi-python"))]
pub mod ffi;

pub use common::{RingBuffer, F64RingBuffer};
pub use kline::{Bar, KlineSeries};
pub use indicators::{
    Indicator, IndicatorValue, PriceType,
    MA, MAType, RSI, MACD, ATR, BOLL, VRI,
    DynamicIndicator, vwap, obv, mfi, williams_r, cci, roc,
    IndicatorBuilder,
    MABuilder, RSIBuilder, MACDBuilder, ATRBuilder, BOLLBuilder, VRIBuilder,
    ma, sma, ema, rsi, macd, atr, boll, vri,
};
pub use aggregator::{TimeFrame, Aggregator, MultiTimeFrameAggregator};
pub use strategy::{Signal, Side, Strategy, StrategyContext, IndicatorSnapshot, FnStrategy, RSIStrategy};
pub use backtest::{
    BacktestEngine, BacktestConfig, BacktestStats,
    MarketType, Position, PositionSide, Trade,
};
pub use dsl::{
    DslEngine, DslContext, VectorStore, LabeledVector,
    compile as compile_dsl, Statement, Expr, Action,
};

use std::collections::HashMap;

/// Quantitative Engine - Core entry point
pub struct QuantEngine {
    /// K-line data
    klines: KlineSeries,
    /// Indicator collection
    indicators: HashMap<String, Box<dyn Indicator>>,
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
            indicators: HashMap::new(),
            strategies: Vec::new(),
            aggregator: None,
            backtest: None,
        })
    }

    /// Add indicator using Builder pattern
    pub fn add_indicator<B: IndicatorBuilder>(
        &mut self,
        name: impl Into<String>,
        builder: B,
    ) -> HQuantResult<()> {
        self.indicators.insert(name.into(), builder.build()?);
        Ok(())
    }

    /// Add pre-built indicator (Box<dyn Indicator>)
    pub fn add_indicator_boxed(&mut self, name: impl Into<String>, indicator: Box<dyn Indicator>) {
        self.indicators.insert(name.into(), indicator);
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

    /// Add predefined OBV indicator
    pub fn add_obv(&mut self, name: impl Into<String>) -> HQuantResult<()> {
        let capacity = self.klines.capacity();
        self.add_indicator_boxed(name, Box::new(obv(capacity)?));
        Ok(())
    }

    /// Add predefined MFI indicator
    pub fn add_mfi(&mut self, name: impl Into<String>, period: usize) -> HQuantResult<()> {
        let capacity = self.klines.capacity();
        self.add_indicator_boxed(name, Box::new(mfi(period, capacity)?));
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
        self.aggregator = Some(MultiTimeFrameAggregator::new(base_tf, target_tfs, capacity)?);
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

        // Update all indicators
        for indicator in self.indicators.values_mut() {
            indicator.push(bar);
        }

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

        for indicator in self.indicators.values_mut() {
            indicator.update_last(bar);
        }

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
        let snapshot = IndicatorSnapshot::new(&self.indicators);
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
        self.indicators.get(name).and_then(|i| i.value())
    }

    /// Get indicator result
    pub fn indicator_result(&self, name: &str) -> Option<IndicatorValue> {
        self.indicators.get(name).and_then(|i| i.result())
    }

    /// Check if indicator is ready
    pub fn indicator_ready(&self, name: &str) -> bool {
        self.indicators.get(name).map(|i| i.is_ready()).unwrap_or(false)
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
        for indicator in self.indicators.values_mut() {
            indicator.reset();
        }
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
        engine.add_indicator("macd", macd().fast(12).slow(26).signal(9)).unwrap();

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

        engine.add_indicator("ma_fast", ma().period(5).sma()).unwrap();
        engine.add_indicator("ma_slow", ma().period(20).sma()).unwrap();

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
}
