//! Timeframe aggregator
//! Supports aggregating fine-grained K-lines to coarse-grained (e.g., 15m -> 4h -> 1d)

use crate::kline::{Bar, KlineSeries};
use crate::{HQuantError, HQuantResult};

use std::fmt;

impl Bar {
    /// Merge two K-lines (for timeframe aggregation)
    pub fn merge(&mut self, other: &Bar) {
        self.high = self.high.max(other.high);
        self.low = self.low.min(other.low);
        self.close = other.close;
        self.volume += other.volume;
        self.buy_volume += other.buy_volume;
        // timestamp and open remain unchanged
    }
}

/// Timeframe definition (milliseconds)
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum TimeFrame {
    M1,  // 1 minute
    M5,  // 5 minutes
    M15, // 15 minutes
    M30, // 30 minutes
    H1,  // 1 hour
    H4,  // 4 hours
    D1,  // 1 day
    W1,  // 1 week
}

impl TimeFrame {
    /// Get milliseconds for this timeframe
    pub fn millis(&self) -> i64 {
        match self {
            TimeFrame::M1 => 60_000,
            TimeFrame::M5 => 5 * 60_000,
            TimeFrame::M15 => 15 * 60_000,
            TimeFrame::M30 => 30 * 60_000,
            TimeFrame::H1 => 60 * 60_000,
            TimeFrame::H4 => 4 * 60 * 60_000,
            TimeFrame::D1 => 24 * 60 * 60_000,
            TimeFrame::W1 => 7 * 24 * 60 * 60_000,
        }
    }

    pub fn as_str(&self) -> &'static str {
        match self {
            TimeFrame::M1 => "M1",
            TimeFrame::M5 => "M5",
            TimeFrame::M15 => "M15",
            TimeFrame::M30 => "M30",
            TimeFrame::H1 => "H1",
            TimeFrame::H4 => "H4",
            TimeFrame::D1 => "D1",
            TimeFrame::W1 => "W1",
        }
    }

    /// Parse timeframe from string
    pub fn from_str(s: &str) -> Option<Self> {
        match s.to_uppercase().as_str() {
            "M1" | "1M" | "1m" => Some(TimeFrame::M1),
            "M5" | "5M" | "5m" => Some(TimeFrame::M5),
            "M15" | "15M" | "15m" => Some(TimeFrame::M15),
            "M30" | "30M" | "30m" => Some(TimeFrame::M30),
            "H1" | "1H" | "1h" => Some(TimeFrame::H1),
            "H4" | "4H" | "4h" => Some(TimeFrame::H4),
            "D1" | "1D" | "1d" => Some(TimeFrame::D1),
            "W1" | "1W" | "1w" => Some(TimeFrame::W1),
            _ => None,
        }
    }

    /// Align timestamp to the start of this timeframe period
    pub fn align_timestamp(&self, timestamp: i64) -> i64 {
        let period = self.millis();
        (timestamp / period) * period
    }

    /// Check if this timeframe is a multiple of another
    pub fn is_multiple_of(&self, other: &TimeFrame) -> bool {
        self.millis() % other.millis() == 0
    }

    /// Calculate how many source periods make one target period
    pub fn ratio(&self, source: &TimeFrame) -> usize {
        (self.millis() / source.millis()) as usize
    }
}

impl fmt::Display for TimeFrame {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str(self.as_str())
    }
}

/// Timeframe aggregator
#[derive(Debug)]
pub struct Aggregator {
    source_tf: TimeFrame,
    target_tf: TimeFrame,
    current_bar: Option<Bar>,
    bar_count: usize,
    output: KlineSeries,
}

impl Aggregator {
    pub fn new(source_tf: TimeFrame, target_tf: TimeFrame, capacity: usize) -> HQuantResult<Self> {
        if !target_tf.is_multiple_of(&source_tf) {
            return Err(HQuantError::invalid_argument(format!(
                "Invalid aggregation: target timeframe {} must be a multiple of source timeframe {}",
                target_tf, source_tf
            )));
        }

        Ok(Self {
            source_tf,
            target_tf,
            current_bar: None,
            bar_count: 0,
            output: KlineSeries::new(capacity)?,
        })
    }

    /// Input a source timeframe K-line, returns whether a new target K-line was created
    pub fn push(&mut self, bar: &Bar) -> bool {
        let aligned_ts = self.target_tf.align_timestamp(bar.timestamp);

        match &mut self.current_bar {
            None => {
                // Start new aggregation period
                self.current_bar = Some(Bar {
                    timestamp: aligned_ts,
                    open: bar.open,
                    high: bar.high,
                    low: bar.low,
                    close: bar.close,
                    volume: bar.volume,
                    buy_volume: bar.buy_volume,
                });
                self.bar_count = 1;
                false
            }
            Some(current) => {
                if aligned_ts != current.timestamp {
                    // New period started, save current aggregated result
                    self.output.append(current);

                    // Start new aggregation
                    self.current_bar = Some(Bar {
                        timestamp: aligned_ts,
                        open: bar.open,
                        high: bar.high,
                        low: bar.low,
                        close: bar.close,
                        volume: bar.volume,
                        buy_volume: bar.buy_volume,
                    });
                    self.bar_count = 1;
                    true
                } else {
                    // Continue aggregating
                    current.merge(bar);
                    self.bar_count += 1;
                    false
                }
            }
        }
    }

    /// Update the current aggregating K-line (for realtime updates)
    pub fn update_last(&mut self, bar: &Bar) {
        if let Some(current) = &mut self.current_bar {
            let aligned_ts = self.target_tf.align_timestamp(bar.timestamp);
            if aligned_ts == current.timestamp {
                // Update current aggregation
                current.high = current.high.max(bar.high);
                current.low = current.low.min(bar.low);
                current.close = bar.close;
            }
        }
    }

    /// Get current aggregating K-line (incomplete)
    pub fn current(&self) -> Option<&Bar> {
        self.current_bar.as_ref()
    }

    /// Get completed aggregated K-line series
    pub fn output(&self) -> &KlineSeries {
        &self.output
    }

    /// Get last completed aggregated K-line
    pub fn last_completed(&self) -> Option<Bar> {
        self.output.last()
    }

    /// Force complete current aggregation (for backtest end)
    pub fn flush(&mut self) -> Option<Bar> {
        if let Some(bar) = self.current_bar.take() {
            self.output.append(&bar);
            self.bar_count = 0;
            Some(bar)
        } else {
            None
        }
    }

    /// Reset aggregator
    pub fn reset(&mut self) {
        self.current_bar = None;
        self.bar_count = 0;
        self.output.clear();
    }

    /// Get source timeframe
    pub fn source_timeframe(&self) -> TimeFrame {
        self.source_tf
    }

    /// Get target timeframe
    pub fn target_timeframe(&self) -> TimeFrame {
        self.target_tf
    }
}

/// Multi-timeframe aggregator manager
/// Supports maintaining multiple timeframe K-line data simultaneously
#[derive(Debug)]
pub struct MultiTimeFrameAggregator {
    aggregators: Vec<Aggregator>,
}

impl MultiTimeFrameAggregator {
    pub fn new(
        base_tf: TimeFrame,
        target_tfs: &[TimeFrame],
        capacity: usize,
    ) -> HQuantResult<Self> {
        for tf in target_tfs {
            if *tf == base_tf {
                return Err(HQuantError::invalid_argument(format!(
                    "Invalid aggregation: target timeframe {} must not equal base timeframe {}",
                    tf, base_tf
                )));
            }
            if !tf.is_multiple_of(&base_tf) {
                return Err(HQuantError::invalid_argument(format!(
                    "Invalid aggregation: target timeframe {} must be a multiple of base timeframe {}",
                    tf, base_tf
                )));
            }
        }

        let mut aggregators = Vec::with_capacity(target_tfs.len());
        for tf in target_tfs {
            aggregators.push(Aggregator::new(base_tf, *tf, capacity)?);
        }

        Ok(Self { aggregators })
    }

    /// Input base timeframe K-line, update all aggregators
    /// Returns list of timeframes that generated new K-lines
    pub fn push(&mut self, bar: &Bar) -> Vec<TimeFrame> {
        let mut completed = Vec::new();

        for agg in &mut self.aggregators {
            if agg.push(bar) {
                completed.push(agg.target_timeframe());
            }
        }

        completed
    }

    /// Update all aggregators' last K-line
    pub fn update_last(&mut self, bar: &Bar) {
        for agg in &mut self.aggregators {
            agg.update_last(bar);
        }
    }

    /// Get aggregator for specific timeframe
    pub fn get(&self, tf: TimeFrame) -> Option<&Aggregator> {
        self.aggregators.iter().find(|a| a.target_timeframe() == tf)
    }

    /// Get current K-line for specific timeframe (may be incomplete)
    pub fn current(&self, tf: TimeFrame) -> Option<&Bar> {
        self.get(tf).and_then(|a| a.current())
    }

    /// Get output series for specific timeframe
    pub fn output(&self, tf: TimeFrame) -> Option<&KlineSeries> {
        self.get(tf).map(|a| a.output())
    }

    /// Force complete all aggregations
    pub fn flush_all(&mut self) {
        for agg in &mut self.aggregators {
            agg.flush();
        }
    }

    /// Reset all aggregators
    pub fn reset(&mut self) {
        for agg in &mut self.aggregators {
            agg.reset();
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_bar_merge() {
        let mut bar1 = Bar::new(1000, 100.0, 105.0, 99.0, 104.0, 1000.0);
        let bar2 = Bar::new(2000, 104.0, 108.0, 103.0, 107.0, 1200.0);

        bar1.merge(&bar2);

        assert_eq!(bar1.timestamp, 1000);
        assert_eq!(bar1.open, 100.0);
        assert_eq!(bar1.high, 108.0);
        assert_eq!(bar1.low, 99.0);
        assert_eq!(bar1.close, 107.0);
        assert_eq!(bar1.volume, 2200.0);
    }

    #[test]
    fn test_timeframe_millis() {
        assert_eq!(TimeFrame::M1.millis(), 60_000);
        assert_eq!(TimeFrame::M15.millis(), 15 * 60_000);
        assert_eq!(TimeFrame::H4.millis(), 4 * 60 * 60_000);
        assert_eq!(TimeFrame::D1.millis(), 24 * 60 * 60_000);
    }

    #[test]
    fn test_timeframe_align() {
        // 15 minute alignment
        let ts = 1000 * 60 * 17; // 17 minutes
        let aligned = TimeFrame::M15.align_timestamp(ts);
        assert_eq!(aligned, 1000 * 60 * 15); // Aligned to 15 minutes

        // 4 hour alignment
        let ts = 1000 * 60 * 60 * 5; // 5 hours
        let aligned = TimeFrame::H4.align_timestamp(ts);
        assert_eq!(aligned, 1000 * 60 * 60 * 4); // Aligned to 4 hours
    }

    #[test]
    fn test_timeframe_multiple() {
        assert!(TimeFrame::H4.is_multiple_of(&TimeFrame::M15));
        assert!(TimeFrame::D1.is_multiple_of(&TimeFrame::H4));
        assert!(TimeFrame::H4.is_multiple_of(&TimeFrame::M30));
        assert!(!TimeFrame::M5.is_multiple_of(&TimeFrame::M15));
    }

    #[test]
    fn test_timeframe_ratio() {
        assert_eq!(TimeFrame::H1.ratio(&TimeFrame::M15), 4);
        assert_eq!(TimeFrame::H4.ratio(&TimeFrame::M15), 16);
        assert_eq!(TimeFrame::D1.ratio(&TimeFrame::H4), 6);
    }

    #[test]
    fn test_aggregator_basic() {
        let mut agg = Aggregator::new(TimeFrame::M15, TimeFrame::H1, 100).unwrap();

        // Input 4 15-minute K-lines
        let bars = vec![
            Bar::new(0, 100.0, 105.0, 99.0, 104.0, 1000.0),
            Bar::new(15 * 60_000, 104.0, 108.0, 103.0, 107.0, 1200.0),
            Bar::new(30 * 60_000, 107.0, 110.0, 106.0, 109.0, 1100.0),
            Bar::new(45 * 60_000, 109.0, 112.0, 108.0, 111.0, 1300.0),
        ];

        for (i, bar) in bars.iter().enumerate() {
            let completed = agg.push(bar);
            if i < 3 {
                assert!(!completed);
            }
        }

        // Input first K-line of next hour, triggers completion
        let next_bar = Bar::new(60 * 60_000, 111.0, 113.0, 110.0, 112.0, 900.0);
        let completed = agg.push(&next_bar);
        assert!(completed);

        // Check aggregation result
        let result = agg.last_completed().unwrap();
        assert_eq!(result.timestamp, 0);
        assert_eq!(result.open, 100.0);
        assert_eq!(result.high, 112.0);
        assert_eq!(result.low, 99.0);
        assert_eq!(result.close, 111.0);
        assert_eq!(result.volume, 4600.0);
    }

    #[test]
    fn test_aggregator_current() {
        let mut agg = Aggregator::new(TimeFrame::M15, TimeFrame::H1, 100).unwrap();

        let bar = Bar::new(0, 100.0, 105.0, 99.0, 104.0, 1000.0);
        agg.push(&bar);

        let current = agg.current().unwrap();
        assert_eq!(current.open, 100.0);
        assert_eq!(current.close, 104.0);
    }

    #[test]
    fn test_aggregator_flush() {
        let mut agg = Aggregator::new(TimeFrame::M15, TimeFrame::H1, 100).unwrap();

        let bars = vec![
            Bar::new(0, 100.0, 105.0, 99.0, 104.0, 1000.0),
            Bar::new(15 * 60_000, 104.0, 108.0, 103.0, 107.0, 1200.0),
        ];

        for bar in &bars {
            agg.push(bar);
        }

        // Force complete
        let flushed = agg.flush().unwrap();
        assert_eq!(flushed.open, 100.0);
        assert_eq!(flushed.close, 107.0);
        assert!(agg.current().is_none());
    }

    #[test]
    fn test_multi_timeframe() {
        let mut mtf =
            MultiTimeFrameAggregator::new(TimeFrame::M15, &[TimeFrame::H1, TimeFrame::H4], 100)
                .unwrap();

        // Input 16 15-minute K-lines (4 hours)
        for i in 0..16 {
            let bar = Bar::new(
                i * 15 * 60_000,
                100.0 + i as f64,
                105.0 + i as f64,
                99.0 + i as f64,
                104.0 + i as f64,
                1000.0,
            );
            let completed = mtf.push(&bar);

            // Every 4 bars completes one H1
            if i > 0 && i % 4 == 0 {
                assert!(completed.contains(&TimeFrame::H1));
            }
        }

        // Input next bar triggers H4 completion
        let bar = Bar::new(16 * 15 * 60_000, 116.0, 121.0, 115.0, 120.0, 1000.0);
        let completed = mtf.push(&bar);
        assert!(completed.contains(&TimeFrame::H4));
    }
}
