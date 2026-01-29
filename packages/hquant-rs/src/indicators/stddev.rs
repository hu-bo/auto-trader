//! Standard Deviation indicator
//!
//! Standalone indicator for use in the indicator graph.
//! Extracted as a first-class indicator so BOLL can share it via dependency injection.

use super::{Indicator, IndicatorValue, PriceType};
use crate::common::F64RingBuffer;
use crate::kline::Bar;
use crate::{HQuantError, HQuantResult};

#[derive(Debug)]
pub struct StdDev {
    name: String,
    period: usize,
    price_type: PriceType,
    values: F64RingBuffer,
    input_buffer: F64RingBuffer,
    count: usize,
    last_timestamp: i64,
}

impl StdDev {
    pub fn new(period: usize) -> HQuantResult<Self> {
        Self::with_price_type(period, PriceType::Close)
    }

    pub fn with_price_type(period: usize, price_type: PriceType) -> HQuantResult<Self> {
        if period == 0 {
            return Err(HQuantError::invalid_argument("StdDev period must be > 0"));
        }
        Ok(Self {
            name: format!("StdDev_{}", period),
            period,
            price_type,
            values: F64RingBuffer::new(period * 2)?,
            input_buffer: F64RingBuffer::new(period)?,
            count: 0,
            last_timestamp: 0,
        })
    }
}

impl Indicator for StdDev {
    fn name(&self) -> &str {
        &self.name
    }

    fn min_periods(&self) -> usize {
        self.period
    }

    fn push(&mut self, bar: &Bar) {
        let price = self.price_type.extract(bar);
        self.input_buffer.push(price);
        self.count += 1;
        self.last_timestamp = bar.timestamp;

        if self.count >= self.period {
            self.values.push(self.input_buffer.std_dev());
        }
    }

    fn update_last(&mut self, bar: &Bar) {
        let price = self.price_type.extract(bar);
        self.input_buffer.update_last(price);
        self.last_timestamp = bar.timestamp;

        if self.count >= self.period {
            self.values.update_last(self.input_buffer.std_dev());
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
        self.input_buffer.clear();
        self.count = 0;
        self.last_timestamp = 0;
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn create_bars(prices: &[f64]) -> Vec<Bar> {
        prices
            .iter()
            .enumerate()
            .map(|(i, &p)| Bar::new(i as i64 * 1000, p, p + 1.0, p - 1.0, p, 100.0))
            .collect()
    }

    #[test]
    fn test_stddev_basic() {
        let mut sd = StdDev::new(5).unwrap();
        let bars = create_bars(&[10.0, 11.0, 12.0, 13.0, 14.0]);

        for bar in &bars {
            sd.push(bar);
        }

        assert!(sd.is_ready());
        let val = sd.value().unwrap();
        // StdDev of [10,11,12,13,14] close prices
        // mean = 12, var = (4+1+0+1+4)/5 = 2, std = sqrt(2) ≈ 1.4142
        assert!((val - 2.0_f64.sqrt()).abs() < 1e-10);
    }

    #[test]
    fn test_stddev_not_ready() {
        let mut sd = StdDev::new(5).unwrap();
        let bars = create_bars(&[10.0, 11.0, 12.0]);

        for bar in &bars {
            sd.push(bar);
        }

        assert!(!sd.is_ready());
        assert!(sd.value().is_none());
    }

    #[test]
    fn test_stddev_update_last() {
        let mut sd = StdDev::new(3).unwrap();
        let bars = create_bars(&[1.0, 2.0, 3.0]);

        for bar in &bars {
            sd.push(bar);
        }

        let v1 = sd.value().unwrap();

        let updated = Bar::new(2000, 5.0, 6.0, 4.0, 5.0, 100.0);
        sd.update_last(&updated);

        let v2 = sd.value().unwrap();
        // Changed last value from 3 to 5, std_dev should change
        assert!((v2 - v1).abs() > 1e-10);
    }

    #[test]
    fn test_stddev_constant_input() {
        let mut sd = StdDev::new(3).unwrap();
        let bars = create_bars(&[5.0, 5.0, 5.0]);

        for bar in &bars {
            sd.push(bar);
        }

        // StdDev of constant sequence = 0
        assert!((sd.value().unwrap()).abs() < 1e-10);
    }
}
