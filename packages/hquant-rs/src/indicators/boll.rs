//! Bollinger Bands (BOLL)
//! Middle Band = SMA(period)
//! Upper Band = Middle Band + (std_dev_factor * StdDev)
//! Lower Band = Middle Band - (std_dev_factor * StdDev)
//!
//! Supports two modes:
//! - **Standalone**: computes its own SMA and StdDev internally (default)
//! - **Graph mode**: receives SMA and StdDev from graph dependencies, avoiding duplicate computation

use super::{Indicator, IndicatorSpec, IndicatorValue, PriceType};
use crate::common::F64RingBuffer;
use crate::kline::Bar;
use crate::{HQuantError, HQuantResult};

#[derive(Debug)]
pub struct BOLL {
    name: String,
    period: usize,
    std_dev_factor: f64,
    price_type: PriceType,
    values: F64RingBuffer,
    upper: F64RingBuffer,
    lower: F64RingBuffer,
    // Input buffer (used in standalone mode)
    input_buffer: F64RingBuffer,
    count: usize,
    last_timestamp: i64,
    // Graph mode: SMA and StdDev provided by external dependencies
    graph_mode: bool,
}

impl BOLL {
    pub fn new(period: usize, std_dev_factor: f64) -> HQuantResult<Self> {
        Self::with_price_type(period, std_dev_factor, PriceType::Close)
    }

    pub fn with_price_type(
        period: usize,
        std_dev_factor: f64,
        price_type: PriceType,
    ) -> HQuantResult<Self> {
        Self::create(period, std_dev_factor, price_type, false)
    }

    /// Create BOLL in graph mode — SMA and StdDev are provided by graph dependencies.
    pub(crate) fn new_graph_mode(
        period: usize,
        std_dev_factor: f64,
        price_type: PriceType,
    ) -> HQuantResult<Self> {
        Self::create(period, std_dev_factor, price_type, true)
    }

    fn create(
        period: usize,
        std_dev_factor: f64,
        price_type: PriceType,
        graph_mode: bool,
    ) -> HQuantResult<Self> {
        if period == 0 {
            return Err(HQuantError::invalid_argument("BOLL period must be > 0"));
        }
        if std_dev_factor <= 0.0 {
            return Err(HQuantError::invalid_argument(
                "BOLL std_dev factor must be > 0",
            ));
        }

        let capacity = period * 2;
        let input_cap = if graph_mode { 1 } else { period };

        Ok(Self {
            name: format!("BOLL_{}", period),
            period,
            std_dev_factor,
            price_type,
            values: F64RingBuffer::new(capacity)?,
            upper: F64RingBuffer::new(capacity)?,
            lower: F64RingBuffer::new(capacity)?,
            input_buffer: F64RingBuffer::new(input_cap)?,
            count: 0,
            last_timestamp: 0,
            graph_mode,
        })
    }

    /// Default BOLL (20, 2.0)
    pub fn default_params() -> HQuantResult<Self> {
        Self::new(20, 2.0)
    }

    fn calculate(&self) -> (f64, f64, f64) {
        let middle = self.input_buffer.mean();
        let std_dev = self.input_buffer.std_dev();
        let band_width = std_dev * self.std_dev_factor;
        let upper = middle + band_width;
        let lower = middle - band_width;
        (middle, upper, lower)
    }

    /// Compute bands from external SMA and StdDev values (graph mode).
    fn calculate_from_deps(&self, sma_val: f64, std_dev_val: f64) -> (f64, f64, f64) {
        let band = std_dev_val * self.std_dev_factor;
        (sma_val, sma_val + band, sma_val - band)
    }

    /// Get upper band value
    pub fn upper_band(&self) -> Option<f64> {
        self.upper.last()
    }

    /// Get lower band value
    pub fn lower_band(&self) -> Option<f64> {
        self.lower.last()
    }

    /// Get band width (upper - lower)
    pub fn band_width(&self) -> Option<f64> {
        match (self.upper.last(), self.lower.last()) {
            (Some(u), Some(l)) => Some(u - l),
            _ => None,
        }
    }

    /// Get %B indicator (position within bands)
    pub fn percent_b(&self, price: f64) -> Option<f64> {
        match (self.upper.last(), self.lower.last()) {
            (Some(u), Some(l)) if u != l => Some((price - l) / (u - l)),
            _ => None,
        }
    }
}

impl Indicator for BOLL {
    fn name(&self) -> &str {
        &self.name
    }

    fn min_periods(&self) -> usize {
        self.period
    }

    fn push(&mut self, bar: &Bar) {
        if self.graph_mode {
            return;
        }

        let price = self.price_type.extract(bar);
        self.input_buffer.push(price);
        self.count += 1;
        self.last_timestamp = bar.timestamp;

        if self.count >= self.period {
            let (middle, upper, lower) = self.calculate();
            self.values.push(middle);
            self.upper.push(upper);
            self.lower.push(lower);
        }
    }

    fn update_last(&mut self, bar: &Bar) {
        if self.graph_mode {
            return;
        }

        let price = self.price_type.extract(bar);
        self.input_buffer.update_last(price);
        self.last_timestamp = bar.timestamp;

        if self.count >= self.period {
            let (middle, upper, lower) = self.calculate();
            self.values.update_last(middle);
            self.upper.update_last(upper);
            self.lower.update_last(lower);
        }
    }

    fn value(&self) -> Option<f64> {
        self.values.last()
    }

    fn result(&self) -> Option<IndicatorValue> {
        self.value().map(|v| {
            let extra = vec![
                self.upper.last().unwrap_or(0.0),
                self.lower.last().unwrap_or(0.0),
            ];
            IndicatorValue::with_extra(v, self.last_timestamp, extra)
        })
    }

    fn is_ready(&self) -> bool {
        if self.graph_mode {
            !self.values.is_empty()
        } else {
            self.count >= self.period
        }
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
        self.upper.clear();
        self.lower.clear();
        self.input_buffer.clear();
        self.count = 0;
        self.last_timestamp = 0;
    }

    // -- Graph-aware methods --

    fn deps(&self) -> Vec<IndicatorSpec> {
        if self.graph_mode {
            vec![
                IndicatorSpec::Sma {
                    period: self.period,
                    price_type: self.price_type,
                },
                IndicatorSpec::StdDev {
                    period: self.period,
                    price_type: self.price_type,
                },
            ]
        } else {
            vec![]
        }
    }

    fn push_with_deps(&mut self, bar: &Bar, dep_values: &[Option<f64>]) {
        if !self.graph_mode {
            self.push(bar);
            return;
        }

        self.last_timestamp = bar.timestamp;

        // dep_values[0] = SMA(period), dep_values[1] = StdDev(period)
        let sma_val = match dep_values.get(0).and_then(|v| *v) {
            Some(v) => v,
            None => return,
        };
        let std_dev_val = match dep_values.get(1).and_then(|v| *v) {
            Some(v) => v,
            None => return,
        };

        self.count += 1;
        let (middle, upper, lower) = self.calculate_from_deps(sma_val, std_dev_val);
        self.values.push(middle);
        self.upper.push(upper);
        self.lower.push(lower);
    }

    fn update_last_with_deps(&mut self, bar: &Bar, dep_values: &[Option<f64>]) {
        if !self.graph_mode {
            self.update_last(bar);
            return;
        }

        self.last_timestamp = bar.timestamp;

        let sma_val = match dep_values.get(0).and_then(|v| *v) {
            Some(v) => v,
            None => return,
        };
        let std_dev_val = match dep_values.get(1).and_then(|v| *v) {
            Some(v) => v,
            None => return,
        };

        if !self.values.is_empty() {
            let (middle, upper, lower) = self.calculate_from_deps(sma_val, std_dev_val);
            self.values.update_last(middle);
            self.upper.update_last(upper);
            self.lower.update_last(lower);
        }
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
    fn test_boll_basic() {
        let mut boll = BOLL::default_params().unwrap();

        let prices: Vec<f64> = (0..30).map(|i| 100.0 + (i as f64 * 0.5)).collect();
        let bars = create_bars(&prices);

        for bar in &bars {
            boll.push(bar);
        }

        assert!(boll.is_ready());
        assert!(boll.value().is_some());
        assert!(boll.upper_band().is_some());
        assert!(boll.lower_band().is_some());
    }

    #[test]
    fn test_boll_bands() {
        let mut boll = BOLL::new(5, 2.0).unwrap();

        let prices = vec![10.0, 11.0, 12.0, 13.0, 14.0];
        let bars = create_bars(&prices);

        for bar in &bars {
            boll.push(bar);
        }

        let middle = boll.value().unwrap();
        let upper = boll.upper_band().unwrap();
        let lower = boll.lower_band().unwrap();

        // Middle should be mean = 12.0
        assert!((middle - 12.0).abs() < 1e-10);
        // Upper should be > middle
        assert!(upper > middle);
        // Lower should be < middle
        assert!(lower < middle);
        // Symmetric
        assert!((upper - middle - (middle - lower)).abs() < 1e-10);
    }

    #[test]
    fn test_boll_result() {
        let mut boll = BOLL::default_params().unwrap();

        let prices: Vec<f64> = (0..25).map(|i| 100.0 + (i as f64)).collect();
        let bars = create_bars(&prices);

        for bar in &bars {
            boll.push(bar);
        }

        let result = boll.result().unwrap();
        assert!(result.extra.is_some());
        let extra = result.extra.unwrap();
        assert_eq!(extra.len(), 2); // upper and lower
    }

    #[test]
    fn test_boll_not_ready() {
        let mut boll = BOLL::default_params().unwrap();
        let bars = create_bars(&[100.0, 101.0, 102.0]);

        for bar in &bars {
            boll.push(bar);
        }

        assert!(!boll.is_ready());
    }

    #[test]
    fn test_boll_graph_mode_no_op_on_push() {
        let mut boll = BOLL::new_graph_mode(20, 2.0, PriceType::Close).unwrap();
        let bars = create_bars(&[100.0; 30]);

        for bar in &bars {
            boll.push(bar);
        }

        assert!(!boll.is_ready());
        assert!(boll.value().is_none());
    }

    #[test]
    fn test_boll_graph_mode_with_deps() {
        let mut boll = BOLL::new_graph_mode(5, 2.0, PriceType::Close).unwrap();

        for i in 0..10 {
            let bar = Bar::new(i * 1000, 100.0, 101.0, 99.0, 100.0, 100.0);
            let sma_val = 100.0;
            let std_dev_val = 1.0;
            boll.push_with_deps(&bar, &[Some(sma_val), Some(std_dev_val)]);
        }

        assert!(boll.is_ready());

        let middle = boll.value().unwrap();
        assert!((middle - 100.0).abs() < 1e-10);

        let upper = boll.upper_band().unwrap();
        assert!((upper - 102.0).abs() < 1e-10); // 100 + 2*1

        let lower = boll.lower_band().unwrap();
        assert!((lower - 98.0).abs() < 1e-10); // 100 - 2*1
    }

    #[test]
    fn test_boll_graph_mode_deps_declaration() {
        let boll = BOLL::new_graph_mode(20, 2.0, PriceType::Close).unwrap();
        let deps = boll.deps();
        assert_eq!(deps.len(), 2);
        assert_eq!(
            deps[0],
            IndicatorSpec::Sma {
                period: 20,
                price_type: PriceType::Close
            }
        );
        assert_eq!(
            deps[1],
            IndicatorSpec::StdDev {
                period: 20,
                price_type: PriceType::Close
            }
        );
    }

    #[test]
    fn test_boll_standalone_no_deps() {
        let boll = BOLL::default_params().unwrap();
        assert!(boll.deps().is_empty());
    }
}
