//! Technical indicators module

pub mod ma;
pub mod rsi;
pub mod macd;
pub mod atr;
pub mod boll;
pub mod vri;
pub mod dynamic;
pub mod builder;

pub use ma::{MA, MAType};
pub use rsi::RSI;
pub use macd::MACD;
pub use atr::ATR;
pub use boll::BOLL;
pub use vri::VRI;
pub use dynamic::{DynamicIndicator, vwap, obv, mfi, williams_r, cci, roc};
pub use builder::{
    IndicatorBuilder,
    MABuilder, RSIBuilder, MACDBuilder, ATRBuilder, BOLLBuilder, VRIBuilder,
    ma, sma, ema, rsi, macd, atr, boll, vri,
};

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
}

/// Indicator input type
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default)]
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
