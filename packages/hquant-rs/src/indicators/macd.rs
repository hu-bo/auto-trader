//! Moving Average Convergence Divergence (MACD)
//! MACD Line = EMA(fast) - EMA(slow)
//! Signal Line = EMA(MACD Line)
//! Histogram = MACD Line - Signal Line
//!
//! Supports two modes:
//! - **Standalone**: computes its own internal EMAs (default)
//! - **Graph mode**: receives EMA values from graph dependencies, avoiding duplicate computation

use crate::common::F64RingBuffer;
use crate::kline::Bar;
use super::{Indicator, IndicatorValue, IndicatorSpec, PriceType};
use crate::{HQuantError, HQuantResult};

#[derive(Debug)]
pub struct MACD {
    name: String,
    fast_period: usize,
    slow_period: usize,
    signal_period: usize,
    price_type: PriceType,
    values: F64RingBuffer,
    // EMA values
    fast_ema: f64,
    slow_ema: f64,
    signal_ema: f64,
    fast_multiplier: f64,
    slow_multiplier: f64,
    signal_multiplier: f64,
    // Input buffer (used in standalone mode)
    input_buffer: F64RingBuffer,
    count: usize,
    last_timestamp: i64,
    // MACD line history for signal calculation
    macd_buffer: F64RingBuffer,
    // Graph mode: EMAs provided by external dependencies
    graph_mode: bool,
}

impl MACD {
    pub fn new(fast_period: usize, slow_period: usize, signal_period: usize) -> HQuantResult<Self> {
        Self::with_price_type(fast_period, slow_period, signal_period, PriceType::Close)
    }

    pub fn with_price_type(
        fast_period: usize,
        slow_period: usize,
        signal_period: usize,
        price_type: PriceType,
    ) -> HQuantResult<Self> {
        Self::create(fast_period, slow_period, signal_period, price_type, false)
    }

    /// Create MACD in graph mode — EMAs are provided by graph dependencies.
    /// Internal EMA computation is skipped; only signal line + histogram are computed.
    pub(crate) fn new_graph_mode(
        fast_period: usize,
        slow_period: usize,
        signal_period: usize,
        price_type: PriceType,
    ) -> HQuantResult<Self> {
        Self::create(fast_period, slow_period, signal_period, price_type, true)
    }

    fn create(
        fast_period: usize,
        slow_period: usize,
        signal_period: usize,
        price_type: PriceType,
        graph_mode: bool,
    ) -> HQuantResult<Self> {
        if fast_period == 0 || slow_period == 0 || signal_period == 0 {
            return Err(HQuantError::invalid_argument("MACD periods must be > 0"));
        }
        if fast_period >= slow_period {
            return Err(HQuantError::invalid_argument("MACD fast period must be < slow period"));
        }

        let capacity = slow_period * 2;
        // In graph mode, input_buffer is unused — allocate minimal capacity
        let input_cap = if graph_mode { 1 } else { slow_period };

        Ok(Self {
            name: format!("MACD_{}_{}", fast_period, slow_period),
            fast_period,
            slow_period,
            signal_period,
            price_type,
            values: F64RingBuffer::new(capacity)?,
            fast_ema: 0.0,
            slow_ema: 0.0,
            signal_ema: 0.0,
            fast_multiplier: 2.0 / (fast_period as f64 + 1.0),
            slow_multiplier: 2.0 / (slow_period as f64 + 1.0),
            signal_multiplier: 2.0 / (signal_period as f64 + 1.0),
            input_buffer: F64RingBuffer::new(input_cap)?,
            count: 0,
            last_timestamp: 0,
            macd_buffer: F64RingBuffer::new(signal_period)?,
            graph_mode,
        })
    }

    /// Default MACD (12, 26, 9)
    pub fn default_params() -> HQuantResult<Self> {
        Self::new(12, 26, 9)
    }

    fn calculate_initial_ema(&self, period: usize) -> f64 {
        if self.input_buffer.len() < period {
            return 0.0;
        }
        let mut sum = 0.0;
        for i in 0..period {
            if let Some(v) = self.input_buffer.get(i) {
                sum += v;
            }
        }
        sum / period as f64
    }

    fn get_macd_line(&self) -> f64 {
        self.fast_ema - self.slow_ema
    }

    fn get_histogram(&self) -> f64 {
        self.get_macd_line() - self.signal_ema
    }

    /// Process a MACD line value through the signal computation.
    /// Shared by both standalone push and graph-mode push_with_deps.
    fn process_macd_line(&mut self, macd_line: f64) {
        self.macd_buffer.push(macd_line);

        if self.macd_buffer.len() == self.signal_period {
            // Initial signal EMA = SMA of first signal_period MACD values
            self.signal_ema = self.macd_buffer.mean();
            self.values.push(macd_line);
        } else if self.macd_buffer.len() > self.signal_period {
            // Update signal EMA
            self.signal_ema = (macd_line - self.signal_ema) * self.signal_multiplier + self.signal_ema;
            self.values.push(macd_line);
        }
    }
}

impl Indicator for MACD {
    fn name(&self) -> &str {
        &self.name
    }

    fn min_periods(&self) -> usize {
        self.slow_period + self.signal_period - 1
    }

    fn push(&mut self, bar: &Bar) {
        // In graph mode, push() is a no-op — use push_with_deps() instead
        if self.graph_mode {
            return;
        }

        let price = self.price_type.extract(bar);
        self.input_buffer.push(price);
        self.count += 1;
        self.last_timestamp = bar.timestamp;

        // Calculate fast EMA
        if self.count == self.fast_period {
            self.fast_ema = self.calculate_initial_ema(self.fast_period);
        } else if self.count > self.fast_period {
            self.fast_ema = (price - self.fast_ema) * self.fast_multiplier + self.fast_ema;
        }

        // Calculate slow EMA
        if self.count == self.slow_period {
            self.slow_ema = self.calculate_initial_ema(self.slow_period);
        } else if self.count > self.slow_period {
            self.slow_ema = (price - self.slow_ema) * self.slow_multiplier + self.slow_ema;
        }

        // Calculate MACD line and signal
        if self.count >= self.slow_period {
            self.process_macd_line(self.get_macd_line());
        }
    }

    fn update_last(&mut self, bar: &Bar) {
        if self.graph_mode {
            return;
        }

        let price = self.price_type.extract(bar);
        self.input_buffer.update_last(price);
        self.last_timestamp = bar.timestamp;

        if self.count > self.slow_period {
            let prev_fast = self.values.get_from_end(2).unwrap_or(self.fast_ema);
            let prev_slow = if self.count > self.slow_period + 1 {
                self.slow_ema - (self.slow_ema - prev_fast) * self.slow_multiplier / (1.0 - self.slow_multiplier)
            } else {
                self.slow_ema
            };

            let new_fast = (price - prev_fast) * self.fast_multiplier + prev_fast;
            let new_slow = (price - prev_slow) * self.slow_multiplier + prev_slow;
            let macd_line = new_fast - new_slow;

            self.values.update_last(macd_line);
        }
    }

    fn value(&self) -> Option<f64> {
        self.values.last()
    }

    fn result(&self) -> Option<IndicatorValue> {
        self.value().map(|v| {
            IndicatorValue::with_extra(
                v,
                self.last_timestamp,
                vec![self.signal_ema, self.get_histogram()],
            )
        })
    }

    fn is_ready(&self) -> bool {
        if self.graph_mode {
            !self.values.is_empty()
        } else {
            self.count >= self.min_periods()
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
        self.input_buffer.clear();
        self.macd_buffer.clear();
        self.fast_ema = 0.0;
        self.slow_ema = 0.0;
        self.signal_ema = 0.0;
        self.count = 0;
        self.last_timestamp = 0;
    }

    // -- Graph-aware methods --

    fn deps(&self) -> Vec<IndicatorSpec> {
        if self.graph_mode {
            vec![
                IndicatorSpec::Ema { period: self.fast_period, price_type: self.price_type },
                IndicatorSpec::Ema { period: self.slow_period, price_type: self.price_type },
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

        // dep_values[0] = EMA(fast), dep_values[1] = EMA(slow)
        let fast_val = match dep_values.get(0).and_then(|v| *v) {
            Some(v) => v,
            None => return, // dependency not ready
        };
        let slow_val = match dep_values.get(1).and_then(|v| *v) {
            Some(v) => v,
            None => return,
        };

        self.count += 1;
        self.fast_ema = fast_val;
        self.slow_ema = slow_val;

        let macd_line = fast_val - slow_val;
        self.process_macd_line(macd_line);
    }

    fn update_last_with_deps(&mut self, bar: &Bar, dep_values: &[Option<f64>]) {
        if !self.graph_mode {
            self.update_last(bar);
            return;
        }

        self.last_timestamp = bar.timestamp;

        let fast_val = match dep_values.get(0).and_then(|v| *v) {
            Some(v) => v,
            None => return,
        };
        let slow_val = match dep_values.get(1).and_then(|v| *v) {
            Some(v) => v,
            None => return,
        };

        self.fast_ema = fast_val;
        self.slow_ema = slow_val;

        let macd_line = fast_val - slow_val;

        if !self.values.is_empty() {
            self.macd_buffer.update_last(macd_line);
            // Recalculate signal from current state
            if self.macd_buffer.len() > self.signal_period {
                self.signal_ema = (macd_line - self.signal_ema) * self.signal_multiplier + self.signal_ema;
            }
            self.values.update_last(macd_line);
        }
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
    fn test_macd_basic() {
        let mut macd = MACD::default_params().unwrap();

        let prices: Vec<f64> = (0..50).map(|i| 100.0 + (i as f64 * 0.5)).collect();
        let bars = create_bars(&prices);

        for bar in &bars {
            macd.push(bar);
        }

        assert!(macd.is_ready());
        assert!(macd.value().is_some());
    }

    #[test]
    fn test_macd_result() {
        let mut macd = MACD::default_params().unwrap();

        let prices: Vec<f64> = (0..50).map(|i| 100.0 + (i as f64 * 0.5)).collect();
        let bars = create_bars(&prices);

        for bar in &bars {
            macd.push(bar);
        }

        let result = macd.result().unwrap();
        assert!(result.extra.is_some());
        let extra = result.extra.unwrap();
        assert_eq!(extra.len(), 2); // signal and histogram
    }

    #[test]
    fn test_macd_not_ready() {
        let mut macd = MACD::default_params().unwrap();
        let bars = create_bars(&[100.0, 101.0, 102.0]);

        for bar in &bars {
            macd.push(bar);
        }

        assert!(!macd.is_ready());
    }

    #[test]
    fn test_macd_graph_mode_no_op_on_push() {
        let mut macd = MACD::new_graph_mode(12, 26, 9, PriceType::Close).unwrap();
        let bars = create_bars(&[100.0; 50]);

        // push() should be no-op in graph mode
        for bar in &bars {
            macd.push(bar);
        }

        assert!(!macd.is_ready());
        assert!(macd.value().is_none());
    }

    #[test]
    fn test_macd_graph_mode_with_deps() {
        let mut macd = MACD::new_graph_mode(12, 26, 9, PriceType::Close).unwrap();

        // Simulate graph providing EMA values
        for i in 0..20 {
            let bar = Bar::new(i * 1000, 100.0, 101.0, 99.0, 100.0 + i as f64, 100.0);
            let fast_ema = 100.0 + i as f64 * 0.8;
            let slow_ema = 100.0 + i as f64 * 0.3;
            macd.push_with_deps(&bar, &[Some(fast_ema), Some(slow_ema)]);
        }

        // After signal_period (9) valid values, should be ready
        assert!(macd.is_ready());
        assert!(macd.value().is_some());
    }

    #[test]
    fn test_macd_graph_mode_deps_declaration() {
        let macd = MACD::new_graph_mode(12, 26, 9, PriceType::Close).unwrap();
        let deps = macd.deps();
        assert_eq!(deps.len(), 2);
        assert_eq!(deps[0], IndicatorSpec::Ema { period: 12, price_type: PriceType::Close });
        assert_eq!(deps[1], IndicatorSpec::Ema { period: 26, price_type: PriceType::Close });
    }

    #[test]
    fn test_macd_standalone_no_deps() {
        let macd = MACD::default_params().unwrap();
        assert!(macd.deps().is_empty());
    }
}
