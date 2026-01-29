//! Technical indicators module

pub mod atr;
pub mod boll;
pub mod builder;
pub mod dynamic;
pub mod graph;
pub mod ma;
pub mod macd;
pub mod rsi;
pub mod spec;
pub mod stddev;
pub mod vri;

pub use atr::ATR;
pub use boll::BOLL;
pub use builder::{
    atr, boll, ema, ma, macd, rsi, sma, vri, ATRBuilder, BOLLBuilder, IndicatorBuilder, MABuilder,
    MACDBuilder, RSIBuilder, VRIBuilder,
};
pub use dynamic::{cci, mfi, obv, roc, vwap, williams_r, DynamicIndicator};
pub use graph::{GraphSummary, IndicatorGraph};
pub use ma::{MAType, MA};
pub use macd::MACD;
pub use rsi::RSI;
pub use spec::{F64Key, IndicatorId, IndicatorSpec};
pub use stddev::StdDev;
pub use vri::VRI;

use crate::kline::Bar;

/// Indicator result
#[derive(Debug, Clone, Default)]
pub struct IndicatorValue {
    pub value: f64,
    pub timestamp: i64,
    /// Extra data (e.g., BOLL upper/lower bands, MACD signal line)
    pub extra: Option<Vec<f64>>,
}

impl IndicatorValue {
    pub fn new(value: f64, timestamp: i64) -> Self {
        Self {
            value,
            timestamp,
            extra: None,
        }
    }

    pub fn with_extra(value: f64, timestamp: i64, extra: Vec<f64>) -> Self {
        Self {
            value,
            timestamp,
            extra: Some(extra),
        }
    }
}

/// Indicator trait
pub trait Indicator: Send + Sync {
    /// Indicator name
    fn name(&self) -> &str;

    /// Minimum required data points
    fn min_periods(&self) -> usize;

    /// Append new data point and calculate
    fn push(&mut self, bar: &Bar);

    /// Update last data point
    fn update_last(&mut self, bar: &Bar);

    /// Get current value
    fn value(&self) -> Option<f64>;

    /// Get complete result (with extra data)
    fn result(&self) -> Option<IndicatorValue>;

    /// Check if enough data for calculation
    fn is_ready(&self) -> bool;

    /// Get historical value
    fn get(&self, index: usize) -> Option<f64>;

    /// Get nth value from the end (1 is newest)
    fn get_from_end(&self, n: usize) -> Option<f64>;

    /// Historical value count
    fn len(&self) -> usize;

    /// Reset indicator state
    fn reset(&mut self);

    // -- Graph-aware methods (default implementations for non-composite indicators) --

    /// Declare dependency specs for graph-based execution.
    /// Override for composite indicators (MACD, BOLL) to enable dependency sharing.
    fn deps(&self) -> Vec<IndicatorSpec> {
        vec![]
    }

    /// Push with dependency values available from the graph.
    /// `dep_values` are in the same order as `deps()`.
    /// Default: ignores dep_values and delegates to `push()`.
    fn push_with_deps(&mut self, bar: &Bar, _dep_values: &[Option<f64>]) {
        self.push(bar);
    }

    /// Update last with dependency values available from the graph.
    /// `dep_values` are in the same order as `deps()`.
    /// Default: ignores dep_values and delegates to `update_last()`.
    fn update_last_with_deps(&mut self, bar: &Bar, _dep_values: &[Option<f64>]) {
        self.update_last(bar);
    }
}

/// Indicator input type
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Default)]
pub enum PriceType {
    Open,
    High,
    Low,
    #[default]
    Close,
    Volume,
    /// (High + Low + Close) / 3
    Typical,
    /// (High + Low) / 2
    Median,
    /// (Open + High + Low + Close) / 4
    Average,
}

impl PriceType {
    pub fn extract(&self, bar: &Bar) -> f64 {
        match self {
            PriceType::Open => bar.open,
            PriceType::High => bar.high,
            PriceType::Low => bar.low,
            PriceType::Close => bar.close,
            PriceType::Volume => bar.volume,
            PriceType::Typical => (bar.high + bar.low + bar.close) / 3.0,
            PriceType::Median => (bar.high + bar.low) / 2.0,
            PriceType::Average => (bar.open + bar.high + bar.low + bar.close) / 4.0,
        }
    }
}
