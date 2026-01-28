//! Dynamic indicators - runtime custom calculation functions
//! Includes common indicators: VWAP, OBV, MFI, Williams %R, CCI, ROC

use std::sync::Arc;

use crate::common::F64RingBuffer;
use crate::kline::{Bar, KlineSeries};
use super::{Indicator, IndicatorValue};
use crate::{HQuantError, HQuantResult};

/// Function type for dynamic indicator calculation
pub type DynamicIndicatorFn = Arc<dyn Fn(&KlineSeries) -> Option<f64> + Send + Sync>;

/// Dynamic indicator - allows custom calculation at runtime
pub struct DynamicIndicator {
    name: String,
    min_periods: usize,
    values: F64RingBuffer,
    klines: KlineSeries,
    calc_fn: DynamicIndicatorFn,
    last_timestamp: i64,
}

impl std::fmt::Debug for DynamicIndicator {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("DynamicIndicator")
            .field("name", &self.name)
            .field("min_periods", &self.min_periods)
            .field("len", &self.values.len())
            .finish()
    }
}

impl DynamicIndicator {
    pub fn new<F>(
        name: impl Into<String>,
        min_periods: usize,
        capacity: usize,
        calc_fn: F,
    ) -> HQuantResult<Self>
    where
        F: Fn(&KlineSeries) -> Option<f64> + Send + Sync + 'static,
    {
        Ok(Self {
            name: name.into(),
            min_periods,
            values: F64RingBuffer::new(capacity)?,
            klines: KlineSeries::new(capacity)?,
            calc_fn: Arc::new(calc_fn),
            last_timestamp: 0,
        })
    }
}

impl Indicator for DynamicIndicator {
    fn name(&self) -> &str {
        &self.name
    }

    fn min_periods(&self) -> usize {
        self.min_periods
    }

    fn push(&mut self, bar: &Bar) {
        self.klines.append(bar);
        self.last_timestamp = bar.timestamp;

        if self.klines.len() >= self.min_periods {
            if let Some(value) = (self.calc_fn)(&self.klines) {
                self.values.push(value);
            }
        }
    }

    fn update_last(&mut self, bar: &Bar) {
        self.klines.update_last(bar);
        self.last_timestamp = bar.timestamp;

        if self.klines.len() >= self.min_periods {
            if let Some(value) = (self.calc_fn)(&self.klines) {
                self.values.update_last(value);
            }
        }
    }

    fn value(&self) -> Option<f64> {
        self.values.last()
    }

    fn result(&self) -> Option<IndicatorValue> {
        self.value().map(|v| IndicatorValue::new(v, self.last_timestamp))
    }

    fn is_ready(&self) -> bool {
        self.klines.len() >= self.min_periods && !self.values.is_empty()
    }

    fn get(&self, index: usize) -> Option<f64> {
        self.values.get(index)
    }

    fn get_from_end(&self, n: usize) -> Option<f64> {
        self.values.get_from_end(n)
    }

    fn len(&self) -> usize {
        self.values.len()
    }

    fn reset(&mut self) {
        self.values.clear();
        self.klines.clear();
        self.last_timestamp = 0;
    }
}

// ============================================================================
// Predefined Dynamic Indicators
// ============================================================================

/// Volume Weighted Average Price (VWAP)
pub fn vwap(capacity: usize) -> HQuantResult<DynamicIndicator> {
    DynamicIndicator::new("VWAP", 1, capacity, |klines| {
        let mut sum_pv = 0.0;
        let mut sum_v = 0.0;

        for i in 0..klines.len() {
            if let Some(bar) = klines.get(i) {
                let typical_price = bar.typical_price();
                sum_pv += typical_price * bar.volume;
                sum_v += bar.volume;
            }
        }

        if sum_v > 0.0 {
            Some(sum_pv / sum_v)
        } else {
            None
        }
    })
}

/// On Balance Volume (OBV)
pub fn obv(capacity: usize) -> HQuantResult<DynamicIndicator> {
    DynamicIndicator::new("OBV", 2, capacity, |klines| {
        if klines.len() < 2 {
            return None;
        }

        let mut obv = 0.0;
        for i in 1..klines.len() {
            let prev = klines.get(i - 1)?;
            let curr = klines.get(i)?;

            if curr.close > prev.close {
                obv += curr.volume;
            } else if curr.close < prev.close {
                obv -= curr.volume;
            }
            // if close == prev_close, OBV unchanged
        }

        Some(obv)
    })
}

/// Money Flow Index (MFI)
pub fn mfi(period: usize, capacity: usize) -> HQuantResult<DynamicIndicator> {
    if period == 0 {
        return Err(HQuantError::invalid_argument("MFI period must be > 0"));
    }

    DynamicIndicator::new(format!("MFI_{}", period), period + 1, capacity, move |klines| {
        if klines.len() < period + 1 {
            return None;
        }

        let mut positive_mf = 0.0;
        let mut negative_mf = 0.0;

        let start = klines.len().saturating_sub(period + 1);
        for i in (start + 1)..klines.len() {
            let prev = klines.get(i - 1)?;
            let curr = klines.get(i)?;

            let prev_tp = prev.typical_price();
            let curr_tp = curr.typical_price();
            let raw_mf = curr_tp * curr.volume;

            if curr_tp > prev_tp {
                positive_mf += raw_mf;
            } else if curr_tp < prev_tp {
                negative_mf += raw_mf;
            }
        }

        if negative_mf == 0.0 {
            return Some(100.0);
        }

        let mf_ratio = positive_mf / negative_mf;
        Some(100.0 - 100.0 / (1.0 + mf_ratio))
    })
}

/// Williams %R
pub fn williams_r(period: usize, capacity: usize) -> HQuantResult<DynamicIndicator> {
    if period == 0 {
        return Err(HQuantError::invalid_argument("Williams %R period must be > 0"));
    }

    DynamicIndicator::new(format!("WilliamsR_{}", period), period, capacity, move |klines| {
        if klines.len() < period {
            return None;
        }

        let start = klines.len() - period;
        let mut highest_high = f64::NEG_INFINITY;
        let mut lowest_low = f64::INFINITY;

        for i in start..klines.len() {
            let bar = klines.get(i)?;
            highest_high = highest_high.max(bar.high);
            lowest_low = lowest_low.min(bar.low);
        }

        let last = klines.last()?;
        let range = highest_high - lowest_low;

        if range == 0.0 {
            return Some(-50.0);
        }

        Some(-100.0 * (highest_high - last.close) / range)
    })
}

/// Commodity Channel Index (CCI)
pub fn cci(period: usize, capacity: usize) -> HQuantResult<DynamicIndicator> {
    if period == 0 {
        return Err(HQuantError::invalid_argument("CCI period must be > 0"));
    }

    DynamicIndicator::new(format!("CCI_{}", period), period, capacity, move |klines| {
        if klines.len() < period {
            return None;
        }

        let start = klines.len() - period;

        // Calculate SMA of typical price
        let mut sum_tp = 0.0;
        let mut tps = Vec::with_capacity(period);
        for i in start..klines.len() {
            let bar = klines.get(i)?;
            let tp = bar.typical_price();
            tps.push(tp);
            sum_tp += tp;
        }
        let sma_tp = sum_tp / period as f64;

        // Calculate mean deviation
        let mean_dev: f64 = tps.iter().map(|&tp| (tp - sma_tp).abs()).sum::<f64>() / period as f64;

        if mean_dev == 0.0 {
            return Some(0.0);
        }

        let last_tp = klines.last()?.typical_price();
        Some((last_tp - sma_tp) / (0.015 * mean_dev))
    })
}

/// Rate of Change (ROC)
pub fn roc(period: usize, capacity: usize) -> HQuantResult<DynamicIndicator> {
    if period == 0 {
        return Err(HQuantError::invalid_argument("ROC period must be > 0"));
    }

    DynamicIndicator::new(format!("ROC_{}", period), period + 1, capacity, move |klines| {
        if klines.len() < period + 1 {
            return None;
        }

        let current = klines.last()?;
        let past = klines.get(klines.len() - period - 1)?;

        if past.close == 0.0 {
            return None;
        }

        Some((current.close - past.close) / past.close * 100.0)
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    fn create_bars() -> Vec<Bar> {
        vec![
            Bar::new(1000, 100.0, 105.0, 98.0, 102.0, 1000.0),
            Bar::new(2000, 102.0, 108.0, 101.0, 106.0, 1200.0),
            Bar::new(3000, 106.0, 110.0, 104.0, 108.0, 1100.0),
            Bar::new(4000, 108.0, 112.0, 106.0, 107.0, 1300.0),
            Bar::new(5000, 107.0, 109.0, 103.0, 105.0, 900.0),
        ]
    }

    #[test]
    fn test_vwap() {
        let mut indicator = vwap(100).unwrap();
        let bars = create_bars();

        for bar in &bars {
            indicator.push(bar);
        }

        assert!(indicator.is_ready());
        assert!(indicator.value().is_some());
    }

    #[test]
    fn test_obv() {
        let mut indicator = obv(100).unwrap();
        let bars = create_bars();

        for bar in &bars {
            indicator.push(bar);
        }

        assert!(indicator.is_ready());
        assert!(indicator.value().is_some());
    }

    #[test]
    fn test_mfi() {
        let mut indicator = mfi(3, 100).unwrap();
        let bars = create_bars();

        for bar in &bars {
            indicator.push(bar);
        }

        assert!(indicator.is_ready());
        let value = indicator.value().unwrap();
        assert!(value >= 0.0 && value <= 100.0);
    }

    #[test]
    fn test_williams_r() {
        let mut indicator = williams_r(3, 100).unwrap();
        let bars = create_bars();

        for bar in &bars {
            indicator.push(bar);
        }

        assert!(indicator.is_ready());
        let value = indicator.value().unwrap();
        assert!(value >= -100.0 && value <= 0.0);
    }

    #[test]
    fn test_cci() {
        let mut indicator = cci(3, 100).unwrap();
        let bars = create_bars();

        for bar in &bars {
            indicator.push(bar);
        }

        assert!(indicator.is_ready());
        assert!(indicator.value().is_some());
    }

    #[test]
    fn test_roc() {
        let mut indicator = roc(2, 100).unwrap();
        let bars = create_bars();

        for bar in &bars {
            indicator.push(bar);
        }

        assert!(indicator.is_ready());
        assert!(indicator.value().is_some());
    }
}
