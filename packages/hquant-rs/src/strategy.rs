//! Strategy system - signal generation and evaluation

use crate::indicators::{Indicator, IndicatorValue, IndicatorGraph};
use crate::kline::Bar;

/// Signal direction
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Side {
    Buy,
    Sell,
    Hold,
}

/// Trading signal
#[derive(Debug, Clone)]
pub struct Signal {
    pub side: Side,
    pub strength: f64,
    pub reason: String,
    pub timestamp: i64,
}

impl Signal {
    pub fn new(side: Side, strength: f64, reason: impl Into<String>, timestamp: i64) -> Self {
        Self {
            side,
            strength: strength.clamp(0.0, 1.0),
            reason: reason.into(),
            timestamp,
        }
    }

    pub fn buy(strength: f64, reason: impl Into<String>, timestamp: i64) -> Self {
        Self::new(Side::Buy, strength, reason, timestamp)
    }

    pub fn sell(strength: f64, reason: impl Into<String>, timestamp: i64) -> Self {
        Self::new(Side::Sell, strength, reason, timestamp)
    }

    pub fn hold(timestamp: i64) -> Self {
        Self::new(Side::Hold, 0.0, "hold", timestamp)
    }
}

/// Indicator snapshot - provides read-only access to indicators.
/// Backed by IndicatorGraph for dedup-aware access.
pub struct IndicatorSnapshot<'a> {
    graph: &'a IndicatorGraph,
}

impl<'a> IndicatorSnapshot<'a> {
    pub fn new(graph: &'a IndicatorGraph) -> Self {
        Self { graph }
    }

    /// Get indicator value by name
    pub fn value(&self, name: &str) -> Option<f64> {
        self.graph.value_by_name(name)
    }

    /// Get indicator's nth value from end
    pub fn value_from_end(&self, name: &str, n: usize) -> Option<f64> {
        self.graph.value_from_end_by_name(name, n)
    }

    /// Check if indicator is ready
    pub fn is_ready(&self, name: &str) -> bool {
        self.graph.is_ready_by_name(name)
    }

    /// Get multiple indicator values
    pub fn values(&self, names: &[&str]) -> Vec<Option<f64>> {
        names.iter().map(|n| self.value(n)).collect()
    }

    /// Get full indicator result by name (for strategies needing extra data)
    pub fn result(&self, name: &str) -> Option<IndicatorValue> {
        self.graph.result_by_name(name)
    }

    /// Get reference to indicator by name (for advanced access)
    pub fn indicator(&self, name: &str) -> Option<&dyn Indicator> {
        self.graph.indicator_by_name(name)
    }
}

/// Strategy context - provided to strategy evaluation
pub struct StrategyContext<'a> {
    pub bar: &'a Bar,
    pub indicators: IndicatorSnapshot<'a>,
}

/// Strategy trait
pub trait Strategy: Send + Sync {
    /// Strategy name
    fn name(&self) -> &str;

    /// Evaluate strategy and generate signal
    fn evaluate(&mut self, ctx: &StrategyContext) -> Option<Signal>;

    /// Reset strategy state
    fn reset(&mut self) {}
}

// ============================================================================
// Built-in Strategies
// ============================================================================

/// Function-based strategy
pub struct FnStrategy<F>
where
    F: Fn(&StrategyContext) -> Option<Signal> + Send + Sync,
{
    name: String,
    eval_fn: F,
}

impl<F> FnStrategy<F>
where
    F: Fn(&StrategyContext) -> Option<Signal> + Send + Sync,
{
    pub fn new(name: impl Into<String>, eval_fn: F) -> Self {
        Self {
            name: name.into(),
            eval_fn,
        }
    }
}

impl<F> Strategy for FnStrategy<F>
where
    F: Fn(&StrategyContext) -> Option<Signal> + Send + Sync,
{
    fn name(&self) -> &str {
        &self.name
    }

    fn evaluate(&mut self, ctx: &StrategyContext) -> Option<Signal> {
        (self.eval_fn)(ctx)
    }
}

/// RSI Strategy - buy when oversold, sell when overbought
pub struct RSIStrategy {
    name: String,
    indicator_name: String,
    oversold: f64,
    overbought: f64,
}

impl RSIStrategy {
    pub fn new(
        indicator_name: impl Into<String>,
        oversold: f64,
        overbought: f64,
    ) -> Self {
        Self {
            name: "RSI_Strategy".to_string(),
            indicator_name: indicator_name.into(),
            oversold,
            overbought,
        }
    }

    pub fn default_params(indicator_name: impl Into<String>) -> Self {
        Self::new(indicator_name, 30.0, 70.0)
    }
}

impl Strategy for RSIStrategy {
    fn name(&self) -> &str {
        &self.name
    }

    fn evaluate(&mut self, ctx: &StrategyContext) -> Option<Signal> {
        let rsi = ctx.indicators.value(&self.indicator_name)?;

        if rsi < self.oversold {
            Some(Signal::buy(
                (self.oversold - rsi) / self.oversold,
                "RSI oversold",
                ctx.bar.timestamp,
            ))
        } else if rsi > self.overbought {
            Some(Signal::sell(
                (rsi - self.overbought) / (100.0 - self.overbought),
                "RSI overbought",
                ctx.bar.timestamp,
            ))
        } else {
            None
        }
    }
}

/// MA Crossover Strategy
pub struct MACrossStrategy {
    name: String,
    fast_ma: String,
    slow_ma: String,
    prev_fast: Option<f64>,
    prev_slow: Option<f64>,
}

impl MACrossStrategy {
    pub fn new(fast_ma: impl Into<String>, slow_ma: impl Into<String>) -> Self {
        Self {
            name: "MA_Cross_Strategy".to_string(),
            fast_ma: fast_ma.into(),
            slow_ma: slow_ma.into(),
            prev_fast: None,
            prev_slow: None,
        }
    }
}

impl Strategy for MACrossStrategy {
    fn name(&self) -> &str {
        &self.name
    }

    fn evaluate(&mut self, ctx: &StrategyContext) -> Option<Signal> {
        let fast = ctx.indicators.value(&self.fast_ma)?;
        let slow = ctx.indicators.value(&self.slow_ma)?;

        let signal = match (self.prev_fast, self.prev_slow) {
            (Some(pf), Some(ps)) => {
                // Check for crossover
                if pf <= ps && fast > slow {
                    // Golden cross - buy signal
                    Some(Signal::buy(0.8, "MA golden cross", ctx.bar.timestamp))
                } else if pf >= ps && fast < slow {
                    // Death cross - sell signal
                    Some(Signal::sell(0.8, "MA death cross", ctx.bar.timestamp))
                } else {
                    None
                }
            }
            _ => None,
        };

        self.prev_fast = Some(fast);
        self.prev_slow = Some(slow);

        signal
    }

    fn reset(&mut self) {
        self.prev_fast = None;
        self.prev_slow = None;
    }
}

/// MACD Strategy - based on MACD histogram crossover
pub struct MACDStrategy {
    name: String,
    indicator_name: String,
    prev_histogram: Option<f64>,
}

impl MACDStrategy {
    pub fn new(indicator_name: impl Into<String>) -> Self {
        Self {
            name: "MACD_Strategy".to_string(),
            indicator_name: indicator_name.into(),
            prev_histogram: None,
        }
    }
}

impl Strategy for MACDStrategy {
    fn name(&self) -> &str {
        &self.name
    }

    fn evaluate(&mut self, ctx: &StrategyContext) -> Option<Signal> {
        let result = ctx.indicators.result(&self.indicator_name)?;

        // MACD result.extra = [signal, histogram]
        let histogram = result.extra.as_ref()?.get(1)?;

        let signal = match self.prev_histogram {
            Some(prev) => {
                if prev <= 0.0 && *histogram > 0.0 {
                    // Histogram crosses above zero - buy
                    Some(Signal::buy(0.7, "MACD histogram cross up", ctx.bar.timestamp))
                } else if prev >= 0.0 && *histogram < 0.0 {
                    // Histogram crosses below zero - sell
                    Some(Signal::sell(0.7, "MACD histogram cross down", ctx.bar.timestamp))
                } else {
                    None
                }
            }
            _ => None,
        };

        self.prev_histogram = Some(*histogram);

        signal
    }

    fn reset(&mut self) {
        self.prev_histogram = None;
    }
}

/// Bollinger Band Strategy
pub struct BollStrategy {
    name: String,
    indicator_name: String,
}

impl BollStrategy {
    pub fn new(indicator_name: impl Into<String>) -> Self {
        Self {
            name: "BOLL_Strategy".to_string(),
            indicator_name: indicator_name.into(),
        }
    }
}

impl Strategy for BollStrategy {
    fn name(&self) -> &str {
        &self.name
    }

    fn evaluate(&mut self, ctx: &StrategyContext) -> Option<Signal> {
        let result = ctx.indicators.result(&self.indicator_name)?;

        // BOLL result.extra = [upper, lower]
        let extra = result.extra.as_ref()?;
        let upper = extra.get(0)?;
        let lower = extra.get(1)?;

        let close = ctx.bar.close;

        if close < *lower {
            // Price below lower band - oversold
            let strength = (lower - close) / (upper - lower).max(0.01);
            Some(Signal::buy(strength.min(1.0), "Price below lower BOLL", ctx.bar.timestamp))
        } else if close > *upper {
            // Price above upper band - overbought
            let strength = (close - upper) / (upper - lower).max(0.01);
            Some(Signal::sell(strength.min(1.0), "Price above upper BOLL", ctx.bar.timestamp))
        } else {
            None
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_signal_creation() {
        let buy = Signal::buy(0.8, "test", 1000);
        assert_eq!(buy.side, Side::Buy);
        assert_eq!(buy.strength, 0.8);

        let sell = Signal::sell(1.5, "test", 1000);
        assert_eq!(sell.strength, 1.0); // clamped

        let hold = Signal::hold(1000);
        assert_eq!(hold.side, Side::Hold);
    }

    #[test]
    fn test_fn_strategy() {
        let strategy = FnStrategy::new("test", |ctx| {
            if ctx.bar.close > 100.0 {
                Some(Signal::buy(0.5, "above 100", ctx.bar.timestamp))
            } else {
                None
            }
        });

        assert_eq!(strategy.name(), "test");
    }
}
