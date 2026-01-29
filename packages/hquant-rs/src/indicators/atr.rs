//! Average True Range (ATR)
//! TR = max(high - low, |high - prev_close|, |low - prev_close|)
//! ATR = Smoothed average of TR

use super::{Indicator, IndicatorValue};
use crate::common::F64RingBuffer;
use crate::kline::Bar;
use crate::{HQuantError, HQuantResult};

#[derive(Debug)]
pub struct ATR {
    name: String,
    period: usize,
    values: F64RingBuffer,
    // ATR uses Wilder smoothing
    atr_value: f64,
    prev_close: f64,
    count: usize,
    last_timestamp: i64,
    // For initialization phase
    tr_values: Vec<f64>,
}

impl ATR {
    pub fn new(period: usize) -> HQuantResult<Self> {
        if period == 0 {
            return Err(HQuantError::invalid_argument("ATR period must be > 0"));
        }
        Ok(Self {
            name: format!("ATR_{}", period),
            period,
            values: F64RingBuffer::new(period * 2)?,
            atr_value: 0.0,
            prev_close: 0.0,
            count: 0,
            last_timestamp: 0,
            tr_values: Vec::with_capacity(period),
        })
    }

    fn calculate_tr(&self, bar: &Bar) -> f64 {
        let high_low = bar.high - bar.low;
        if self.count == 1 {
            return high_low;
        }
        let high_close = (bar.high - self.prev_close).abs();
        let low_close = (bar.low - self.prev_close).abs();
        high_low.max(high_close).max(low_close)
    }
}

impl Indicator for ATR {
    fn name(&self) -> &str {
        &self.name
    }

    fn min_periods(&self) -> usize {
        self.period
    }

    fn push(&mut self, bar: &Bar) {
        self.count += 1;
        self.last_timestamp = bar.timestamp;

        let tr = self.calculate_tr(bar);

        if self.count <= self.period {
            self.tr_values.push(tr);

            if self.count == self.period {
                // First ATR = SMA of TR
                self.atr_value = self.tr_values.iter().sum::<f64>() / self.period as f64;
                self.values.push(self.atr_value);
            }
        } else {
            // Wilder smoothing
            self.atr_value = (self.atr_value * (self.period - 1) as f64 + tr) / self.period as f64;
            self.values.push(self.atr_value);
        }

        self.prev_close = bar.close;
    }

    fn update_last(&mut self, bar: &Bar) {
        self.last_timestamp = bar.timestamp;

        if self.count >= self.period {
            let tr = self.calculate_tr(bar);

            if self.count == self.period {
                // Recalculate initial ATR
                let sum: f64 = self.tr_values[..self.period - 1].iter().sum();
                self.atr_value = (sum + tr) / self.period as f64;
            } else {
                // Approximate recalculation
                let prev_atr = self.values.get_from_end(2).unwrap_or(self.atr_value);
                self.atr_value = (prev_atr * (self.period - 1) as f64 + tr) / self.period as f64;
            }
            self.values.update_last(self.atr_value);
        }
    }

    fn value(&self) -> Option<f64> {
        self.values.last()
    }

    fn result(&self) -> Option<IndicatorValue> {
        self.value()
            .map(|v| IndicatorValue::new(v, self.last_timestamp))
    }

    fn is_ready(&self) -> bool {
        self.count >= self.period
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
        self.atr_value = 0.0;
        self.prev_close = 0.0;
        self.count = 0;
        self.last_timestamp = 0;
        self.tr_values.clear();
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_atr_basic() {
        let mut atr = ATR::new(14).unwrap();

        // Create volatile data
        for i in 0..20 {
            let base = 100.0 + (i as f64);
            let bar = Bar::new(i * 1000, base, base + 5.0, base - 3.0, base + 2.0, 1000.0);
            atr.push(&bar);
        }

        assert!(atr.is_ready());
        assert!(atr.value().is_some());
        // ATR should be positive
        assert!(atr.value().unwrap() > 0.0);
    }

    #[test]
    fn test_atr_not_ready() {
        let mut atr = ATR::new(14).unwrap();

        for i in 0..5 {
            let bar = Bar::new(i * 1000, 100.0, 105.0, 95.0, 102.0, 1000.0);
            atr.push(&bar);
        }

        assert!(!atr.is_ready());
    }
}
