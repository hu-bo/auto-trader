//! Indicator specification and identity types for deduplication and graph-based execution.
//!
//! `IndicatorSpec` uniquely describes an indicator's type + parameters.
//! Two identical specs produce identical computations — the graph uses this for dedup.

use std::hash::{Hash, Hasher};
use super::PriceType;

// ---------------------------------------------------------------------------
// F64Key — hashable f64 wrapper
// ---------------------------------------------------------------------------

/// Wrapper for f64 that implements Hash + Eq via bit-level comparison.
/// Two F64Key values are equal iff their IEEE-754 bit patterns are identical.
#[derive(Debug, Clone, Copy)]
pub struct F64Key(pub f64);

impl F64Key {
    #[inline]
    pub fn new(v: f64) -> Self {
        Self(v)
    }

    #[inline]
    pub fn value(self) -> f64 {
        self.0
    }
}

impl Hash for F64Key {
    fn hash<H: Hasher>(&self, state: &mut H) {
        self.0.to_bits().hash(state);
    }
}

impl PartialEq for F64Key {
    fn eq(&self, other: &Self) -> bool {
        self.0.to_bits() == other.0.to_bits()
    }
}

impl Eq for F64Key {}

impl From<f64> for F64Key {
    fn from(v: f64) -> Self {
        Self(v)
    }
}

// ---------------------------------------------------------------------------
// IndicatorId — lightweight handle
// ---------------------------------------------------------------------------

/// Lightweight handle to a registered indicator in the graph.
/// Cheap to copy, compare, and use as a HashMap key.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub struct IndicatorId(pub(crate) usize);

impl IndicatorId {
    #[inline]
    pub fn index(self) -> usize {
        self.0
    }
}

// ---------------------------------------------------------------------------
// IndicatorSpec — hashable indicator description
// ---------------------------------------------------------------------------

/// Unique specification of an indicator's type and parameters.
/// Identical specs produce identical computations — used for deduplication.
#[derive(Debug, Clone, Hash, PartialEq, Eq)]
pub enum IndicatorSpec {
    Sma {
        period: usize,
        price_type: PriceType,
    },
    Ema {
        period: usize,
        price_type: PriceType,
    },
    Wma {
        period: usize,
        price_type: PriceType,
    },
    Rsi {
        period: usize,
        price_type: PriceType,
    },
    Atr {
        period: usize,
    },
    Vri {
        period: usize,
    },
    StdDev {
        period: usize,
        price_type: PriceType,
    },
    Macd {
        fast_period: usize,
        slow_period: usize,
        signal_period: usize,
        price_type: PriceType,
    },
    Boll {
        period: usize,
        std_dev_factor: F64Key,
        price_type: PriceType,
    },
}

impl IndicatorSpec {
    // -- Convenience constructors (default PriceType::Close) --

    pub fn sma(period: usize) -> Self {
        Self::Sma { period, price_type: PriceType::Close }
    }

    pub fn ema(period: usize) -> Self {
        Self::Ema { period, price_type: PriceType::Close }
    }

    pub fn wma(period: usize) -> Self {
        Self::Wma { period, price_type: PriceType::Close }
    }

    pub fn rsi(period: usize) -> Self {
        Self::Rsi { period, price_type: PriceType::Close }
    }

    pub fn atr(period: usize) -> Self {
        Self::Atr { period }
    }

    pub fn vri(period: usize) -> Self {
        Self::Vri { period }
    }

    pub fn stddev(period: usize) -> Self {
        Self::StdDev { period, price_type: PriceType::Close }
    }

    pub fn macd(fast: usize, slow: usize, signal: usize) -> Self {
        Self::Macd {
            fast_period: fast,
            slow_period: slow,
            signal_period: signal,
            price_type: PriceType::Close,
        }
    }

    pub fn boll(period: usize, std_dev_factor: f64) -> Self {
        Self::Boll {
            period,
            std_dev_factor: F64Key::new(std_dev_factor),
            price_type: PriceType::Close,
        }
    }

    // -- Dependency resolution --

    /// Return the dependency specs that this indicator requires.
    /// Primary indicators return empty. Composite indicators (MACD, BOLL)
    /// declare their sub-indicator dependencies for graph-level sharing.
    pub fn dependencies(&self) -> Vec<IndicatorSpec> {
        match self {
            IndicatorSpec::Macd {
                fast_period,
                slow_period,
                price_type,
                ..
            } => vec![
                IndicatorSpec::Ema { period: *fast_period, price_type: *price_type },
                IndicatorSpec::Ema { period: *slow_period, price_type: *price_type },
            ],
            IndicatorSpec::Boll {
                period,
                price_type,
                ..
            } => vec![
                IndicatorSpec::Sma { period: *period, price_type: *price_type },
                IndicatorSpec::StdDev { period: *period, price_type: *price_type },
            ],
            _ => vec![],
        }
    }

    /// Generate a default display name for this spec.
    pub fn default_name(&self) -> String {
        match self {
            IndicatorSpec::Sma { period, .. } => format!("SMA_{}", period),
            IndicatorSpec::Ema { period, .. } => format!("EMA_{}", period),
            IndicatorSpec::Wma { period, .. } => format!("WMA_{}", period),
            IndicatorSpec::Rsi { period, .. } => format!("RSI_{}", period),
            IndicatorSpec::Atr { period } => format!("ATR_{}", period),
            IndicatorSpec::Vri { period } => format!("VRI_{}", period),
            IndicatorSpec::StdDev { period, .. } => format!("StdDev_{}", period),
            IndicatorSpec::Macd { fast_period, slow_period, .. } => {
                format!("MACD_{}_{}", fast_period, slow_period)
            }
            IndicatorSpec::Boll { period, .. } => format!("BOLL_{}", period),
        }
    }

    /// Whether this is a composite indicator with dependencies.
    pub fn is_composite(&self) -> bool {
        matches!(self, IndicatorSpec::Macd { .. } | IndicatorSpec::Boll { .. })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_spec_dedup() {
        let a = IndicatorSpec::ema(12);
        let b = IndicatorSpec::ema(12);
        assert_eq!(a, b);

        let c = IndicatorSpec::ema(26);
        assert_ne!(a, c);
    }

    #[test]
    fn test_spec_hash_consistency() {
        use std::collections::HashMap;
        let mut map = HashMap::new();
        map.insert(IndicatorSpec::rsi(14), 42);
        assert_eq!(map.get(&IndicatorSpec::rsi(14)), Some(&42));
    }

    #[test]
    fn test_macd_deps() {
        let spec = IndicatorSpec::macd(12, 26, 9);
        let deps = spec.dependencies();
        assert_eq!(deps.len(), 2);
        assert_eq!(deps[0], IndicatorSpec::ema(12));
        assert_eq!(deps[1], IndicatorSpec::ema(26));
    }

    #[test]
    fn test_boll_deps() {
        let spec = IndicatorSpec::boll(20, 2.0);
        let deps = spec.dependencies();
        assert_eq!(deps.len(), 2);
        assert_eq!(deps[0], IndicatorSpec::sma(20));
        assert_eq!(deps[1], IndicatorSpec::stddev(20));
    }

    #[test]
    fn test_primary_no_deps() {
        assert!(IndicatorSpec::ema(20).dependencies().is_empty());
        assert!(IndicatorSpec::rsi(14).dependencies().is_empty());
        assert!(IndicatorSpec::atr(14).dependencies().is_empty());
    }

    #[test]
    fn test_f64key_eq() {
        assert_eq!(F64Key::new(2.0), F64Key::new(2.0));
        assert_ne!(F64Key::new(2.0), F64Key::new(2.5));
    }

    #[test]
    fn test_is_composite() {
        assert!(IndicatorSpec::macd(12, 26, 9).is_composite());
        assert!(IndicatorSpec::boll(20, 2.0).is_composite());
        assert!(!IndicatorSpec::ema(20).is_composite());
        assert!(!IndicatorSpec::rsi(14).is_composite());
    }
}
