/// Indicator Builder Pattern
///
/// Provides a fluent API for creating indicators:
/// ```ignore
/// let macd = MACDBuilder::new()
///     .fast(12)
///     .slow(26)
///     .signal(9)
///     .build();
/// ```

use super::{Indicator, MA, MAType, RSI, MACD, ATR, BOLL, VRI, PriceType};

/// Trait for building indicators with a fluent API
pub trait IndicatorBuilder: Send + Sync {
    /// Get the default name for this indicator
    fn default_name(&self) -> String;

    /// Build the indicator
    fn build(self) -> Box<dyn Indicator>;

    /// Build the indicator with a custom name
    fn build_named(self, name: String) -> (String, Box<dyn Indicator>);
}

// ============================================================================
// MA Builder
// ============================================================================

/// Builder for Moving Average indicator
#[derive(Debug, Clone)]
pub struct MABuilder {
    period: usize,
    ma_type: MAType,
    price_type: PriceType,
    name: Option<String>,
}

impl Default for MABuilder {
    fn default() -> Self {
        Self {
            period: 20,
            ma_type: MAType::SMA,
            price_type: PriceType::Close,
            name: None,
        }
    }
}

impl MABuilder {
    pub fn new() -> Self {
        Self::default()
    }

    /// Set the period (default: 20)
    pub fn period(mut self, period: usize) -> Self {
        self.period = period;
        self
    }

    /// Set MA type to SMA (Simple Moving Average)
    pub fn sma(mut self) -> Self {
        self.ma_type = MAType::SMA;
        self
    }

    /// Set MA type to EMA (Exponential Moving Average)
    pub fn ema(mut self) -> Self {
        self.ma_type = MAType::EMA;
        self
    }

    /// Set MA type to WMA (Weighted Moving Average)
    pub fn wma(mut self) -> Self {
        self.ma_type = MAType::WMA;
        self
    }

    /// Set MA type directly
    pub fn ma_type(mut self, ma_type: MAType) -> Self {
        self.ma_type = ma_type;
        self
    }

    /// Set price type (default: Close)
    pub fn price_type(mut self, price_type: PriceType) -> Self {
        self.price_type = price_type;
        self
    }

    /// Set custom name
    pub fn name(mut self, name: impl Into<String>) -> Self {
        self.name = Some(name.into());
        self
    }
}

impl IndicatorBuilder for MABuilder {
    fn default_name(&self) -> String {
        let type_name = match self.ma_type {
            MAType::SMA => "SMA",
            MAType::EMA => "EMA",
            MAType::WMA => "WMA",
        };
        format!("{}_{}", type_name, self.period)
    }

    fn build(self) -> Box<dyn Indicator> {
        Box::new(MA::with_price_type(self.period, self.ma_type, self.price_type))
    }

    fn build_named(self, name: String) -> (String, Box<dyn Indicator>) {
        let indicator = MA::with_price_type(self.period, self.ma_type, self.price_type);
        (name, Box::new(indicator))
    }
}

// ============================================================================
// RSI Builder
// ============================================================================

/// Builder for RSI (Relative Strength Index) indicator
#[derive(Debug, Clone)]
pub struct RSIBuilder {
    period: usize,
    price_type: PriceType,
    name: Option<String>,
}

impl Default for RSIBuilder {
    fn default() -> Self {
        Self {
            period: 14,
            price_type: PriceType::Close,
            name: None,
        }
    }
}

impl RSIBuilder {
    pub fn new() -> Self {
        Self::default()
    }

    /// Set the period (default: 14)
    pub fn period(mut self, period: usize) -> Self {
        self.period = period;
        self
    }

    /// Set price type (default: Close)
    pub fn price_type(mut self, price_type: PriceType) -> Self {
        self.price_type = price_type;
        self
    }

    /// Set custom name
    pub fn name(mut self, name: impl Into<String>) -> Self {
        self.name = Some(name.into());
        self
    }
}

impl IndicatorBuilder for RSIBuilder {
    fn default_name(&self) -> String {
        format!("RSI_{}", self.period)
    }

    fn build(self) -> Box<dyn Indicator> {
        Box::new(RSI::with_price_type(self.period, self.price_type))
    }

    fn build_named(self, name: String) -> (String, Box<dyn Indicator>) {
        let indicator = RSI::with_price_type(self.period, self.price_type);
        (name, Box::new(indicator))
    }
}

// ============================================================================
// MACD Builder
// ============================================================================

/// Builder for MACD indicator
#[derive(Debug, Clone)]
pub struct MACDBuilder {
    fast_period: usize,
    slow_period: usize,
    signal_period: usize,
    price_type: PriceType,
    name: Option<String>,
}

impl Default for MACDBuilder {
    fn default() -> Self {
        Self {
            fast_period: 12,
            slow_period: 26,
            signal_period: 9,
            price_type: PriceType::Close,
            name: None,
        }
    }
}

impl MACDBuilder {
    pub fn new() -> Self {
        Self::default()
    }

    /// Set fast EMA period (default: 12)
    pub fn fast(mut self, period: usize) -> Self {
        self.fast_period = period;
        self
    }

    /// Set slow EMA period (default: 26)
    pub fn slow(mut self, period: usize) -> Self {
        self.slow_period = period;
        self
    }

    /// Set signal line period (default: 9)
    pub fn signal(mut self, period: usize) -> Self {
        self.signal_period = period;
        self
    }

    /// Set price type (default: Close)
    pub fn price_type(mut self, price_type: PriceType) -> Self {
        self.price_type = price_type;
        self
    }

    /// Set custom name
    pub fn name(mut self, name: impl Into<String>) -> Self {
        self.name = Some(name.into());
        self
    }

    /// Use standard MACD settings (12, 26, 9)
    pub fn standard(self) -> Self {
        self.fast(12).slow(26).signal(9)
    }
}

impl IndicatorBuilder for MACDBuilder {
    fn default_name(&self) -> String {
        format!("MACD_{}_{}", self.fast_period, self.slow_period)
    }

    fn build(self) -> Box<dyn Indicator> {
        Box::new(MACD::with_price_type(
            self.fast_period,
            self.slow_period,
            self.signal_period,
            self.price_type,
        ))
    }

    fn build_named(self, name: String) -> (String, Box<dyn Indicator>) {
        let indicator = MACD::with_price_type(
            self.fast_period,
            self.slow_period,
            self.signal_period,
            self.price_type,
        );
        (name, Box::new(indicator))
    }
}

// ============================================================================
// ATR Builder
// ============================================================================

/// Builder for ATR (Average True Range) indicator
#[derive(Debug, Clone)]
pub struct ATRBuilder {
    period: usize,
    name: Option<String>,
}

impl Default for ATRBuilder {
    fn default() -> Self {
        Self {
            period: 14,
            name: None,
        }
    }
}

impl ATRBuilder {
    pub fn new() -> Self {
        Self::default()
    }

    /// Set the period (default: 14)
    pub fn period(mut self, period: usize) -> Self {
        self.period = period;
        self
    }

    /// Set custom name
    pub fn name(mut self, name: impl Into<String>) -> Self {
        self.name = Some(name.into());
        self
    }
}

impl IndicatorBuilder for ATRBuilder {
    fn default_name(&self) -> String {
        format!("ATR_{}", self.period)
    }

    fn build(self) -> Box<dyn Indicator> {
        Box::new(ATR::new(self.period))
    }

    fn build_named(self, name: String) -> (String, Box<dyn Indicator>) {
        let indicator = ATR::new(self.period);
        (name, Box::new(indicator))
    }
}

// ============================================================================
// BOLL Builder
// ============================================================================

/// Builder for Bollinger Bands indicator
#[derive(Debug, Clone)]
pub struct BOLLBuilder {
    period: usize,
    std_dev_factor: f64,
    name: Option<String>,
}

impl Default for BOLLBuilder {
    fn default() -> Self {
        Self {
            period: 20,
            std_dev_factor: 2.0,
            name: None,
        }
    }
}

impl BOLLBuilder {
    pub fn new() -> Self {
        Self::default()
    }

    /// Set the period (default: 20)
    pub fn period(mut self, period: usize) -> Self {
        self.period = period;
        self
    }

    /// Set standard deviation factor (default: 2.0)
    pub fn std_dev(mut self, factor: f64) -> Self {
        self.std_dev_factor = factor;
        self
    }

    /// Alias for std_dev
    pub fn multiplier(self, factor: f64) -> Self {
        self.std_dev(factor)
    }

    /// Set custom name
    pub fn name(mut self, name: impl Into<String>) -> Self {
        self.name = Some(name.into());
        self
    }
}

impl IndicatorBuilder for BOLLBuilder {
    fn default_name(&self) -> String {
        format!("BOLL_{}", self.period)
    }

    fn build(self) -> Box<dyn Indicator> {
        Box::new(BOLL::new(self.period, self.std_dev_factor))
    }

    fn build_named(self, name: String) -> (String, Box<dyn Indicator>) {
        let indicator = BOLL::new(self.period, self.std_dev_factor);
        (name, Box::new(indicator))
    }
}

// ============================================================================
// VRI Builder
// ============================================================================

/// Builder for VRI (Volume Relative Index) indicator
#[derive(Debug, Clone)]
pub struct VRIBuilder {
    period: usize,
    name: Option<String>,
}

impl Default for VRIBuilder {
    fn default() -> Self {
        Self {
            period: 14,
            name: None,
        }
    }
}

impl VRIBuilder {
    pub fn new() -> Self {
        Self::default()
    }

    /// Set the period (default: 14)
    pub fn period(mut self, period: usize) -> Self {
        self.period = period;
        self
    }

    /// Set custom name
    pub fn name(mut self, name: impl Into<String>) -> Self {
        self.name = Some(name.into());
        self
    }
}

impl IndicatorBuilder for VRIBuilder {
    fn default_name(&self) -> String {
        format!("VRI_{}", self.period)
    }

    fn build(self) -> Box<dyn Indicator> {
        Box::new(VRI::new(self.period))
    }

    fn build_named(self, name: String) -> (String, Box<dyn Indicator>) {
        let indicator = VRI::new(self.period);
        (name, Box::new(indicator))
    }
}

// ============================================================================
// Factory functions for convenient access
// ============================================================================

/// Create an MA builder
pub fn ma() -> MABuilder {
    MABuilder::new()
}

/// Create an SMA builder with default period
pub fn sma(period: usize) -> MABuilder {
    MABuilder::new().period(period).sma()
}

/// Create an EMA builder with default period
pub fn ema(period: usize) -> MABuilder {
    MABuilder::new().period(period).ema()
}

/// Create an RSI builder
pub fn rsi() -> RSIBuilder {
    RSIBuilder::new()
}

/// Create a MACD builder
pub fn macd() -> MACDBuilder {
    MACDBuilder::new()
}

/// Create an ATR builder
pub fn atr() -> ATRBuilder {
    ATRBuilder::new()
}

/// Create a BOLL builder
pub fn boll() -> BOLLBuilder {
    BOLLBuilder::new()
}

/// Create a VRI builder
pub fn vri() -> VRIBuilder {
    VRIBuilder::new()
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::kline::Bar;

    fn create_test_bars() -> Vec<Bar> {
        (0..50)
            .map(|i| {
                let base = 100.0 + (i as f64 * 0.1).sin() * 10.0;
                Bar::new(i * 1000, base, base + 2.0, base - 2.0, base + 1.0, 1000.0)
            })
            .collect()
    }

    #[test]
    fn test_ma_builder() {
        let ma = MABuilder::new()
            .period(20)
            .ema()
            .build();

        assert_eq!(ma.min_periods(), 20);
    }

    #[test]
    fn test_macd_builder() {
        let macd = MACDBuilder::new()
            .fast(12)
            .slow(26)
            .signal(9)
            .build();

        assert_eq!(macd.min_periods(), 26 + 9 - 1);
    }

    #[test]
    fn test_rsi_builder() {
        let rsi = RSIBuilder::new()
            .period(14)
            .build();

        assert_eq!(rsi.min_periods(), 15);
    }

    #[test]
    fn test_atr_builder() {
        let atr = ATRBuilder::new()
            .period(14)
            .build();

        assert_eq!(atr.min_periods(), 14);
    }

    #[test]
    fn test_boll_builder() {
        let boll = BOLLBuilder::new()
            .period(20)
            .std_dev(2.0)
            .build();

        assert_eq!(boll.min_periods(), 20);
    }

    #[test]
    fn test_vri_builder() {
        let vri = VRIBuilder::new()
            .period(14)
            .build();

        // VRI requires period + 1 (like RSI, needs one extra for prev_volume initialization)
        assert_eq!(vri.min_periods(), 15);
    }

    #[test]
    fn test_factory_functions() {
        let _ma = ma().period(10).ema().build();
        let _rsi = rsi().period(14).build();
        let _macd = macd().fast(12).slow(26).signal(9).build();
        let _atr = atr().period(14).build();
        let _boll = boll().period(20).std_dev(2.0).build();
        let _vri = vri().period(14).build();
    }

    #[test]
    fn test_indicator_with_data() {
        let bars = create_test_bars();

        let mut indicator = macd()
            .fast(12)
            .slow(26)
            .signal(9)
            .build();

        for bar in &bars {
            indicator.push(bar);
        }

        assert!(indicator.is_ready());
        assert!(indicator.value().is_some());
    }
}
