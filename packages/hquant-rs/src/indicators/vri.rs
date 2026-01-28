//! Volume Ratio Indicator (VRI)
//! VRI = (Buy Volume / Total Volume) * 100

use crate::common::F64RingBuffer;
use crate::kline::Bar;
use super::{Indicator, IndicatorValue};
use crate::{HQuantError, HQuantResult};

#[derive(Debug)]
pub struct VRI {
    name: String,
    period: usize,
    values: F64RingBuffer,
    buy_volume_buffer: F64RingBuffer,
    total_volume_buffer: F64RingBuffer,
    count: usize,
    last_timestamp: i64,
}

impl VRI {
    pub fn new(period: usize) -> HQuantResult<Self> {
        if period == 0 {
            return Err(HQuantError::invalid_argument("VRI period must be > 0"));
        }
        Ok(Self {
            name: format!("VRI_{}", period),
            period,
            values: F64RingBuffer::new(period * 2)?,
            buy_volume_buffer: F64RingBuffer::new(period)?,
            total_volume_buffer: F64RingBuffer::new(period)?,
            count: 0,
            last_timestamp: 0,
        })
    }

    fn calculate(&self) -> f64 {
        let total_buy: f64 = self.buy_volume_buffer.iter().sum();
        let total_volume: f64 = self.total_volume_buffer.iter().sum();
        if total_volume == 0.0 {
            return 50.0; // Default neutral
        }
        (total_buy / total_volume) * 100.0
    }
}

impl Indicator for VRI {
    fn name(&self) -> &str {
        &self.name
    }

    fn min_periods(&self) -> usize {
        self.period
    }

    fn push(&mut self, bar: &Bar) {
        self.buy_volume_buffer.push(bar.buy_volume);
        self.total_volume_buffer.push(bar.volume);
        self.count += 1;
        self.last_timestamp = bar.timestamp;

        if self.count >= self.period {
            let vri = self.calculate();
            self.values.push(vri);
        }
    }

    fn update_last(&mut self, bar: &Bar) {
        self.buy_volume_buffer.update_last(bar.buy_volume);
        self.total_volume_buffer.update_last(bar.volume);
        self.last_timestamp = bar.timestamp;

        if self.count >= self.period {
            let vri = self.calculate();
            self.values.update_last(vri);
        }
    }

    fn value(&self) -> Option<f64> {
        self.values.last()
    }

    fn result(&self) -> Option<IndicatorValue> {
        self.value().map(|v| IndicatorValue::new(v, self.last_timestamp))
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
        self.buy_volume_buffer.clear();
        self.total_volume_buffer.clear();
        self.count = 0;
        self.last_timestamp = 0;
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_vri_basic() {
        let mut vri = VRI::new(5).unwrap();

        for i in 0..10 {
            let bar = Bar::with_buy_volume(
                i * 1000,
                100.0,
                105.0,
                95.0,
                102.0,
                1000.0,
                600.0, // 60% buy volume
            );
            vri.push(&bar);
        }

        assert!(vri.is_ready());
        let value = vri.value().unwrap();
        // Should be around 60%
        assert!((value - 60.0).abs() < 1e-10);
    }

    #[test]
    fn test_vri_neutral() {
        let mut vri = VRI::new(3).unwrap();

        for i in 0..5 {
            let bar = Bar::with_buy_volume(
                i * 1000,
                100.0,
                105.0,
                95.0,
                102.0,
                1000.0,
                500.0, // 50% buy volume
            );
            vri.push(&bar);
        }

        let value = vri.value().unwrap();
        // Should be exactly 50%
        assert!((value - 50.0).abs() < 1e-10);
    }

    #[test]
    fn test_vri_not_ready() {
        let mut vri = VRI::new(5).unwrap();

        for i in 0..3 {
            let bar = Bar::with_buy_volume(i * 1000, 100.0, 105.0, 95.0, 102.0, 1000.0, 500.0);
            vri.push(&bar);
        }

        assert!(!vri.is_ready());
    }
}
