//! Builder pattern for indicators
//! Provides fluent API for creating indicators

use super::{Indicator, MA, MAType, RSI, MACD, ATR, BOLL, VRI, PriceType};
use crate::HQuantResult;

/// Trait for indicator builders
pub trait IndicatorBuilder: Clone {
    fn build(self) -> HQuantResult<Box<dyn Indicator>>;
}

// ============================================================================
// MA Builder
// ============================================================================

#[derive(Debug, Clone)]
pub struct MABuilder {
    period: usize,
    ma_type: MAType,
    price_type: PriceType,
}

impl Default for MABuilder {
    fn default() -> Self {
        Self::new()
    }
}

impl MABuilder {
    pub fn new() -> Self {
        Self {
            period: 20,
            ma_type: MAType::SMA,
            price_type: PriceType::Close,
        }
    }

    pub fn period(mut self, period: usize) -> Self {
        self.period = period;
        self
    }

    pub fn sma(mut self) -> Self {
        self.ma_type = MAType::SMA;
        self
    }

    pub fn ema(mut self) -> Self {
        self.ma_type = MAType::EMA;
        self
    }

    pub fn wma(mut self) -> Self {
        self.ma_type = MAType::WMA;
        self
    }

    pub fn price_type(mut self, price_type: PriceType) -> Self {
        self.price_type = price_type;
        self
    }
}

impl IndicatorBuilder for MABuilder {
    fn build(self) -> HQuantResult<Box<dyn Indicator>> {
        Ok(Box::new(MA::with_price_type(self.period, self.ma_type, self.price_type)?))
    }
}

/// Create MA builder
pub fn ma() -> MABuilder {
    MABuilder::new()
}

/// Create SMA with period
pub fn sma(period: usize) -> MABuilder {
    MABuilder::new().period(period).sma()
}

/// Create EMA with period
pub fn ema(period: usize) -> MABuilder {
    MABuilder::new().period(period).ema()
}

// ============================================================================
// RSI Builder
// ============================================================================

#[derive(Debug, Clone)]
pub struct RSIBuilder {
    period: usize,
    price_type: PriceType,
}

impl Default for RSIBuilder {
    fn default() -> Self {
        Self::new()
    }
}

impl RSIBuilder {
    pub fn new() -> Self {
        Self {
            period: 14,
            price_type: PriceType::Close,
        }
    }

    pub fn period(mut self, period: usize) -> Self {
        self.period = period;
        self
    }

    pub fn price_type(mut self, price_type: PriceType) -> Self {
        self.price_type = price_type;
        self
    }
}

impl IndicatorBuilder for RSIBuilder {
    fn build(self) -> HQuantResult<Box<dyn Indicator>> {
        Ok(Box::new(RSI::with_price_type(self.period, self.price_type)?))
    }
}

/// Create RSI builder
pub fn rsi() -> RSIBuilder {
    RSIBuilder::new()
}

// ============================================================================
// MACD Builder
// ============================================================================

#[derive(Debug, Clone)]
pub struct MACDBuilder {
    fast_period: usize,
    slow_period: usize,
    signal_period: usize,
    price_type: PriceType,
}

impl Default for MACDBuilder {
    fn default() -> Self {
        Self::new()
    }
}

impl MACDBuilder {
    pub fn new() -> Self {
        Self {
            fast_period: 12,
            slow_period: 26,
            signal_period: 9,
            price_type: PriceType::Close,
        }
    }

    pub fn fast(mut self, period: usize) -> Self {
        self.fast_period = period;
        self
    }

    pub fn slow(mut self, period: usize) -> Self {
        self.slow_period = period;
        self
    }

    pub fn signal(mut self, period: usize) -> Self {
        self.signal_period = period;
        self
    }

    pub fn price_type(mut self, price_type: PriceType) -> Self {
        self.price_type = price_type;
        self
    }
}

impl IndicatorBuilder for MACDBuilder {
    fn build(self) -> HQuantResult<Box<dyn Indicator>> {
        Ok(Box::new(MACD::with_price_type(
            self.fast_period,
            self.slow_period,
            self.signal_period,
            self.price_type,
        )?))
    }
}

/// Create MACD builder
pub fn macd() -> MACDBuilder {
    MACDBuilder::new()
}

// ============================================================================
// ATR Builder
// ============================================================================

#[derive(Debug, Clone)]
pub struct ATRBuilder {
    period: usize,
}

impl Default for ATRBuilder {
    fn default() -> Self {
        Self::new()
    }
}

impl ATRBuilder {
    pub fn new() -> Self {
        Self { period: 14 }
    }

    pub fn period(mut self, period: usize) -> Self {
        self.period = period;
        self
    }
}

impl IndicatorBuilder for ATRBuilder {
    fn build(self) -> HQuantResult<Box<dyn Indicator>> {
        Ok(Box::new(ATR::new(self.period)?))
    }
}

/// Create ATR builder
pub fn atr() -> ATRBuilder {
    ATRBuilder::new()
}

// ============================================================================
// BOLL Builder
// ============================================================================

#[derive(Debug, Clone)]
pub struct BOLLBuilder {
    period: usize,
    std_dev_factor: f64,
    price_type: PriceType,
}

impl Default for BOLLBuilder {
    fn default() -> Self {
        Self::new()
    }
}

impl BOLLBuilder {
    pub fn new() -> Self {
        Self {
            period: 20,
            std_dev_factor: 2.0,
            price_type: PriceType::Close,
        }
    }

    pub fn period(mut self, period: usize) -> Self {
        self.period = period;
        self
    }

    pub fn std_dev(mut self, factor: f64) -> Self {
        self.std_dev_factor = factor;
        self
    }

    pub fn multiplier(self, factor: f64) -> Self {
        self.std_dev(factor)
    }

    pub fn price_type(mut self, price_type: PriceType) -> Self {
        self.price_type = price_type;
        self
    }
}

impl IndicatorBuilder for BOLLBuilder {
    fn build(self) -> HQuantResult<Box<dyn Indicator>> {
        Ok(Box::new(BOLL::with_price_type(
            self.period,
            self.std_dev_factor,
            self.price_type,
        )?))
    }
}

/// Create BOLL builder
pub fn boll() -> BOLLBuilder {
    BOLLBuilder::new()
}

// ============================================================================
// VRI Builder
// ============================================================================

#[derive(Debug, Clone)]
pub struct VRIBuilder {
    period: usize,
}

impl Default for VRIBuilder {
    fn default() -> Self {
        Self::new()
    }
}

impl VRIBuilder {
    pub fn new() -> Self {
        Self { period: 14 }
    }

    pub fn period(mut self, period: usize) -> Self {
        self.period = period;
        self
    }
}

impl IndicatorBuilder for VRIBuilder {
    fn build(self) -> HQuantResult<Box<dyn Indicator>> {
        Ok(Box::new(VRI::new(self.period)?))
    }
}

/// Create VRI builder
pub fn vri() -> VRIBuilder {
    VRIBuilder::new()
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::kline::Bar;

    fn create_test_bars() -> Vec<Bar> {
        (0..50)
            .map(|i| Bar::new(i * 1000, 100.0 + i as f64, 105.0 + i as f64, 98.0 + i as f64, 102.0 + i as f64, 1000.0))
            .collect()
    }

    #[test]
    fn test_ma_builder() {
        let mut indicator = ma().period(10).sma().build().unwrap();
        let bars = create_test_bars();

        for bar in &bars {
            indicator.push(bar);
        }

        assert!(indicator.is_ready());
    }

    #[test]
    fn test_rsi_builder() {
        let mut indicator = rsi().period(14).build().unwrap();
        let bars = create_test_bars();

        for bar in &bars {
            indicator.push(bar);
        }

        assert!(indicator.is_ready());
    }

    #[test]
    fn test_macd_builder() {
        let mut indicator = macd().fast(12).slow(26).signal(9).build().unwrap();
        let bars = create_test_bars();

        for bar in &bars {
            indicator.push(bar);
        }

        assert!(indicator.is_ready());
    }

    #[test]
    fn test_boll_builder() {
        let mut indicator = boll().period(20).std_dev(2.0).build().unwrap();
        let bars = create_test_bars();

        for bar in &bars {
            indicator.push(bar);
        }

        assert!(indicator.is_ready());
    }

    #[test]
    fn test_atr_builder() {
        let mut indicator = atr().period(14).build().unwrap();
        let bars = create_test_bars();

        for bar in &bars {
            indicator.push(bar);
        }

        assert!(indicator.is_ready());
    }

    #[test]
    fn test_vri_builder() {
        let mut indicator = vri().period(10).build().unwrap();
        let bars: Vec<Bar> = (0..20)
            .map(|i| Bar::with_buy_volume(i * 1000, 100.0, 105.0, 98.0, 102.0, 1000.0, 600.0))
            .collect();

        for bar in &bars {
            indicator.push(bar);
        }

        assert!(indicator.is_ready());
    }

    #[test]
    fn test_fluent_api() {
        let _ma = ma().period(20).ema().price_type(PriceType::Typical);
        let _macd = macd().fast(12).slow(26).signal(9);
        let _boll = boll().period(20).std_dev(2.5);
    }
}
