//! Relative Strength Index (RSI)
//! RSI = 100 - 100 / (1 + RS)
//! RS = Average Gain / Average Loss

use crate::common::F64RingBuffer;
use crate::kline::Bar;
use super::{Indicator, IndicatorValue, PriceType};
use crate::{HQuantError, HQuantResult};

#[derive(Debug)]
pub struct RSI {
    name: String,
    period: usize,
    price_type: PriceType,
    values: F64RingBuffer,
    // Using Wilder smoothing
    avg_gain: f64,
    avg_loss: f64,
    prev_price: f64,
    count: usize,
    last_timestamp: i64,
    // For initialization phase
    gains: Vec<f64>,
    losses: Vec<f64>,
}

impl RSI {
    pub fn new(period: usize) -> HQuantResult<Self> {
        Self::with_price_type(period, PriceType::Close)
    }

    pub fn with_price_type(period: usize, price_type: PriceType) -> HQuantResult<Self> {
        if period == 0 {
            return Err(HQuantError::invalid_argument("RSI period must be > 0"));
        }
        Ok(Self {
            name: format!("RSI_{}", period),
            period,
            price_type,
            values: F64RingBuffer::new(period * 2)?,
            avg_gain: 0.0,
            avg_loss: 0.0,
            prev_price: 0.0,
            count: 0,
            last_timestamp: 0,
            gains: Vec::with_capacity(period),
            losses: Vec::with_capacity(period),
        })
    }

    fn calculate_rsi(&self) -> f64 {
        if self.avg_loss == 0.0 {
            if self.avg_gain == 0.0 {
                return 50.0; // No change
            }
            return 100.0; // All gains
        }
        let rs = self.avg_gain / self.avg_loss;
        100.0 - 100.0 / (1.0 + rs)
    }
}

impl Indicator for RSI {
    fn name(&self) -> &str {
        &self.name
    }

    fn min_periods(&self) -> usize {
        self.period + 1
    }

    fn push(&mut self, bar: &Bar) {
        let price = self.price_type.extract(bar);
        self.count += 1;
        self.last_timestamp = bar.timestamp;

        if self.count == 1 {
            self.prev_price = price;
            return;
        }

        let change = price - self.prev_price;
        let gain = change.max(0.0);
        let loss = (-change).max(0.0);

        if self.count <= self.period + 1 {
            // Initialization phase, collect data
            self.gains.push(gain);
            self.losses.push(loss);

            if self.count == self.period + 1 {
                // Calculate first average
                self.avg_gain = self.gains.iter().sum::<f64>() / self.period as f64;
                self.avg_loss = self.losses.iter().sum::<f64>() / self.period as f64;
                let rsi = self.calculate_rsi();
                self.values.push(rsi);
            }
        } else {
            // Use Wilder smoothing for updates
            self.avg_gain = (self.avg_gain * (self.period - 1) as f64 + gain) / self.period as f64;
            self.avg_loss = (self.avg_loss * (self.period - 1) as f64 + loss) / self.period as f64;
            let rsi = self.calculate_rsi();
            self.values.push(rsi);
        }

        self.prev_price = price;
    }

    fn update_last(&mut self, bar: &Bar) {
        let price = self.price_type.extract(bar);
        self.last_timestamp = bar.timestamp;

        if self.count < 2 {
            self.prev_price = price;
            return;
        }

        // Simplified: recalculate from previous state
        let change = price - self.prev_price;
        let gain = change.max(0.0);
        let loss = (-change).max(0.0);

        if self.count > self.period + 1 {
            let temp_avg_gain = (self.avg_gain * self.period as f64 - self.avg_gain + gain)
                / self.period as f64;
            let temp_avg_loss = (self.avg_loss * self.period as f64 - self.avg_loss + loss)
                / self.period as f64;

            let rs = if temp_avg_loss == 0.0 {
                if temp_avg_gain == 0.0 { 1.0 } else { f64::MAX }
            } else {
                temp_avg_gain / temp_avg_loss
            };

            let rsi = 100.0 - 100.0 / (1.0 + rs);
            self.values.update_last(rsi);
        }
    }

    fn value(&self) -> Option<f64> {
        self.values.last()
    }

    fn result(&self) -> Option<IndicatorValue> {
        self.value().map(|v| IndicatorValue::new(v, self.last_timestamp))
    }

    fn is_ready(&self) -> bool {
        self.count > self.period
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
        self.avg_gain = 0.0;
        self.avg_loss = 0.0;
        self.prev_price = 0.0;
        self.count = 0;
        self.last_timestamp = 0;
        self.gains.clear();
        self.losses.clear();
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn create_bars(prices: &[f64]) -> Vec<Bar> {
        prices.iter().enumerate().map(|(i, &p)| {
            Bar::new(i as i64 * 1000, p, p + 1.0, p - 1.0, p, 100.0)
        }).collect()
    }

    #[test]
    fn test_rsi_uptrend() {
        let mut rsi = RSI::new(14).unwrap();
        // Create uptrend
        let prices: Vec<f64> = (0..20).map(|i| 100.0 + i as f64).collect();
        let bars = create_bars(&prices);

        for bar in &bars {
            rsi.push(bar);
        }

        assert!(rsi.is_ready());
        // Continuous uptrend, RSI should be close to 100
        assert!(rsi.value().unwrap() > 90.0);
    }

    #[test]
    fn test_rsi_downtrend() {
        let mut rsi = RSI::new(14).unwrap();
        // Create downtrend
        let prices: Vec<f64> = (0..20).map(|i| 200.0 - i as f64).collect();
        let bars = create_bars(&prices);

        for bar in &bars {
            rsi.push(bar);
        }

        assert!(rsi.is_ready());
        // Continuous downtrend, RSI should be close to 0
        assert!(rsi.value().unwrap() < 10.0);
    }

    #[test]
    fn test_rsi_range() {
        let mut rsi = RSI::new(14).unwrap();
        // Volatile market
        let mut prices = Vec::new();
        for i in 0..30 {
            if i % 2 == 0 {
                prices.push(100.0 + (i as f64));
            } else {
                prices.push(100.0 - (i as f64) * 0.5);
            }
        }
        let bars = create_bars(&prices);

        for bar in &bars {
            rsi.push(bar);
        }

        assert!(rsi.is_ready());
        // RSI should be between 0-100
        let val = rsi.value().unwrap();
        assert!(val >= 0.0 && val <= 100.0);
    }

    #[test]
    fn test_rsi_not_ready() {
        let mut rsi = RSI::new(14).unwrap();
        let bars = create_bars(&[100.0, 101.0, 102.0]);

        for bar in &bars {
            rsi.push(bar);
        }

        assert!(!rsi.is_ready());
    }
}
