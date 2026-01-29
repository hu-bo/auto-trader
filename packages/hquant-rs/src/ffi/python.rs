//! Python FFI using PyO3

use pyo3::exceptions::PyValueError;
use pyo3::prelude::*;
use pyo3::types::{PyDict, PyList};
use std::sync::Mutex;

use crate::{
    dsl::{DslContext, DslEngine, LabeledVector},
    strategy::Signal,
    ATRBuilder,
    BOLLBuilder,
    BacktestConfig,
    BacktestEngine,
    BacktestStats,
    Bar,
    // FuturesBacktest from core
    FuturesBacktest as CoreFuturesBacktest,
    FuturesBacktestConfig,
    IndicatorGraph,
    MABuilder,
    MACDBuilder,
    MarketType,
    MultiTimeFrameAggregator,
    PositionSide,
    QuantEngine,
    RSIBuilder,
    Side,
    TimeFrame,
    VRIBuilder,
};

fn parse_position_side(side: &str) -> PyResult<PositionSide> {
    match side.to_ascii_uppercase().as_str() {
        "LONG" => Ok(PositionSide::Long),
        "SHORT" => Ok(PositionSide::Short),
        _ => Err(PyValueError::new_err(
            "position_side must be \"LONG\" or \"SHORT\"",
        )),
    }
}

fn position_side_to_str(side: PositionSide) -> &'static str {
    match side {
        PositionSide::Long => "LONG",
        PositionSide::Short => "SHORT",
    }
}

fn to_bar(dict: &Bound<'_, PyDict>) -> PyResult<Bar> {
    let timestamp: i64 = dict
        .get_item("timestamp")?
        .ok_or_else(|| PyValueError::new_err("missing timestamp"))?
        .extract()?;
    let open: f64 = dict
        .get_item("open")?
        .ok_or_else(|| PyValueError::new_err("missing open"))?
        .extract()?;
    let high: f64 = dict
        .get_item("high")?
        .ok_or_else(|| PyValueError::new_err("missing high"))?
        .extract()?;
    let low: f64 = dict
        .get_item("low")?
        .ok_or_else(|| PyValueError::new_err("missing low"))?
        .extract()?;
    let close: f64 = dict
        .get_item("close")?
        .ok_or_else(|| PyValueError::new_err("missing close"))?
        .extract()?;
    let volume: f64 = dict
        .get_item("volume")?
        .ok_or_else(|| PyValueError::new_err("missing volume"))?
        .extract()?;
    let buy_volume: f64 = dict
        .get_item("buy_volume")
        .ok()
        .flatten()
        .map(|v| v.extract())
        .transpose()?
        .unwrap_or(0.0);

    Ok(Bar::with_buy_volume(
        timestamp, open, high, low, close, volume, buy_volume,
    ))
}

fn parse_timeframe(tf: &str) -> PyResult<TimeFrame> {
    TimeFrame::from_str(tf)
        .ok_or_else(|| PyValueError::new_err(format!("Unknown timeframe: {}", tf)))
}

/// Inner state for HQuant, protected by a single Mutex
struct HQuantInner {
    engine: QuantEngine,
    dsl_strategies: Vec<(u32, String, DslEngine)>,
    signal_queue: Vec<Signal>,
    next_strategy_id: u32,
}

/// High-performance quantitative trading engine
#[pyclass]
pub struct HQuant {
    inner: Mutex<HQuantInner>,
}

#[pymethods]
impl HQuant {
    #[new]
    #[pyo3(signature = (capacity=1000))]
    pub fn new(capacity: usize) -> PyResult<Self> {
        let engine =
            QuantEngine::new(capacity).map_err(|e| PyValueError::new_err(e.to_string()))?;
        Ok(Self {
            inner: Mutex::new(HQuantInner {
                engine,
                dsl_strategies: Vec::new(),
                signal_queue: Vec::new(),
                next_strategy_id: 1,
            }),
        })
    }

    /// Add indicator from dict config
    /// Example: hquant.add_indicator("rsi", {"type": "rsi", "period": 14})
    pub fn add_indicator(&self, name: &str, config: &Bound<'_, PyDict>) -> PyResult<()> {
        let mut inner = self
            .inner
            .lock()
            .map_err(|_| PyValueError::new_err("lock poisoned"))?;

        let ind_type: String = config
            .get_item("type")?
            .ok_or_else(|| PyValueError::new_err("missing 'type' in config"))?
            .extract()?;

        match ind_type.to_lowercase().as_str() {
            "ma" | "sma" => {
                let period: usize = config
                    .get_item("period")?
                    .map(|v| v.extract())
                    .transpose()?
                    .unwrap_or(20);
                let builder = MABuilder::new().period(period).sma();
                inner
                    .engine
                    .add_indicator(name, builder)
                    .map_err(|e| PyValueError::new_err(e.to_string()))?;
            }
            "ema" => {
                let period: usize = config
                    .get_item("period")?
                    .map(|v| v.extract())
                    .transpose()?
                    .unwrap_or(20);
                let builder = MABuilder::new().period(period).ema();
                inner
                    .engine
                    .add_indicator(name, builder)
                    .map_err(|e| PyValueError::new_err(e.to_string()))?;
            }
            "wma" => {
                let period: usize = config
                    .get_item("period")?
                    .map(|v| v.extract())
                    .transpose()?
                    .unwrap_or(20);
                let builder = MABuilder::new().period(period).wma();
                inner
                    .engine
                    .add_indicator(name, builder)
                    .map_err(|e| PyValueError::new_err(e.to_string()))?;
            }
            "rsi" => {
                let period: usize = config
                    .get_item("period")?
                    .map(|v| v.extract())
                    .transpose()?
                    .unwrap_or(14);
                let builder = RSIBuilder::new().period(period);
                inner
                    .engine
                    .add_indicator(name, builder)
                    .map_err(|e| PyValueError::new_err(e.to_string()))?;
            }
            "macd" => {
                let fast: usize = config
                    .get_item("fast")?
                    .map(|v| v.extract())
                    .transpose()?
                    .unwrap_or(12);
                let slow: usize = config
                    .get_item("slow")?
                    .map(|v| v.extract())
                    .transpose()?
                    .unwrap_or(26);
                let signal: usize = config
                    .get_item("signal")?
                    .map(|v| v.extract())
                    .transpose()?
                    .unwrap_or(9);
                let builder = MACDBuilder::new().fast(fast).slow(slow).signal(signal);
                inner
                    .engine
                    .add_indicator(name, builder)
                    .map_err(|e| PyValueError::new_err(e.to_string()))?;
            }
            "atr" => {
                let period: usize = config
                    .get_item("period")?
                    .map(|v| v.extract())
                    .transpose()?
                    .unwrap_or(14);
                let builder = ATRBuilder::new().period(period);
                inner
                    .engine
                    .add_indicator(name, builder)
                    .map_err(|e| PyValueError::new_err(e.to_string()))?;
            }
            "boll" | "bollinger" => {
                let period: usize = config
                    .get_item("period")?
                    .map(|v| v.extract())
                    .transpose()?
                    .unwrap_or(20);
                let std_dev: f64 = config
                    .get_item("std_dev")?
                    .map(|v| v.extract())
                    .transpose()?
                    .unwrap_or(2.0);
                let builder = BOLLBuilder::new().period(period).std_dev(std_dev);
                inner
                    .engine
                    .add_indicator(name, builder)
                    .map_err(|e| PyValueError::new_err(e.to_string()))?;
            }
            "vri" => {
                let period: usize = config
                    .get_item("period")?
                    .map(|v| v.extract())
                    .transpose()?
                    .unwrap_or(14);
                let builder = VRIBuilder::new().period(period);
                inner
                    .engine
                    .add_indicator(name, builder)
                    .map_err(|e| PyValueError::new_err(e.to_string()))?;
            }
            "vwap" => {
                inner
                    .engine
                    .add_vwap(name)
                    .map_err(|e| PyValueError::new_err(e.to_string()))?;
            }
            "obv" => {
                let capacity = inner.engine.klines().capacity();
                let indicator =
                    crate::obv(capacity).map_err(|e| PyValueError::new_err(e.to_string()))?;
                inner.engine.add_indicator_boxed(name, Box::new(indicator));
            }
            _ => {
                return Err(PyValueError::new_err(format!(
                    "Unknown indicator type: {}",
                    ind_type
                )));
            }
        }

        Ok(())
    }

    /// Push K-line data
    pub fn push_kline<'py>(
        &self,
        py: Python<'py>,
        bar_dict: &Bound<'py, PyDict>,
    ) -> PyResult<Bound<'py, PyList>> {
        let mut inner = self
            .inner
            .lock()
            .map_err(|_| PyValueError::new_err("lock poisoned"))?;
        let bar = to_bar(bar_dict)?;
        let signals = inner.engine.append_bar(&bar);

        let list = PyList::empty_bound(py);
        for s in &signals {
            let dict = PyDict::new_bound(py);
            dict.set_item(
                "side",
                match s.side {
                    Side::Buy => "BUY",
                    Side::Sell => "SELL",
                    Side::Hold => "HOLD",
                },
            )?;
            dict.set_item("strength", s.strength)?;
            dict.set_item("reason", &s.reason)?;
            dict.set_item("timestamp", s.timestamp)?;
            list.append(dict)?;
        }
        Ok(list)
    }

    /// Update last K-line
    pub fn update_last(&self, bar_dict: &Bound<'_, PyDict>) -> PyResult<()> {
        let mut inner = self
            .inner
            .lock()
            .map_err(|_| PyValueError::new_err("lock poisoned"))?;
        let bar = to_bar(bar_dict)?;
        inner.engine.update_last_bar(&bar);
        Ok(())
    }

    /// Get indicator value
    pub fn get_indicator(&self, name: &str) -> PyResult<Option<f64>> {
        let inner = self
            .inner
            .lock()
            .map_err(|_| PyValueError::new_err("lock poisoned"))?;
        Ok(inner.engine.indicator_value(name))
    }

    /// Check if indicator is ready
    pub fn is_ready(&self, name: &str) -> PyResult<bool> {
        let inner = self
            .inner
            .lock()
            .map_err(|_| PyValueError::new_err("lock poisoned"))?;
        Ok(inner.engine.indicator_ready(name))
    }

    /// Get indicator result with extra data
    pub fn get_indicator_result<'py>(
        &self,
        py: Python<'py>,
        name: &str,
    ) -> PyResult<Option<Bound<'py, PyDict>>> {
        let inner = self
            .inner
            .lock()
            .map_err(|_| PyValueError::new_err("lock poisoned"))?;
        match inner.engine.indicator_result(name) {
            Some(result) => {
                let dict = PyDict::new_bound(py);
                dict.set_item("value", result.value)?;
                dict.set_item("timestamp", result.timestamp)?;
                if let Some(extra) = result.extra {
                    dict.set_item("extra", extra)?;
                }
                Ok(Some(dict))
            }
            None => Ok(None),
        }
    }

    /// Reset engine
    pub fn reset(&self) -> PyResult<()> {
        let mut inner = self
            .inner
            .lock()
            .map_err(|_| PyValueError::new_err("lock poisoned"))?;
        inner.engine.reset();
        inner.signal_queue.clear();
        Ok(())
    }

    // -- DSL Strategy methods --

    /// Add a DSL-based strategy
    /// Returns the strategy ID (>0 on success)
    pub fn add_strategy(&self, name: &str, dsl: &str) -> PyResult<u32> {
        let dsl_engine = DslEngine::new(dsl)
            .map_err(|e| PyValueError::new_err(format!("DSL compile error: {}", e)))?;

        let mut inner = self
            .inner
            .lock()
            .map_err(|_| PyValueError::new_err("lock poisoned"))?;
        let id = inner.next_strategy_id;
        inner
            .dsl_strategies
            .push((id, name.to_string(), dsl_engine));
        inner.next_strategy_id += 1;

        Ok(id)
    }

    /// Push bar and evaluate DSL strategies
    pub fn push_bar(&self, bar_dict: &Bound<'_, PyDict>) -> PyResult<()> {
        let mut inner = self
            .inner
            .lock()
            .map_err(|_| PyValueError::new_err("lock poisoned"))?;
        let bar = to_bar(bar_dict)?;

        // Append bar to engine (updates indicators)
        let _builtin_signals = inner.engine.append_bar(&bar);

        // Evaluate DSL strategies with field destructuring to enable split borrows
        let HQuantInner {
            engine,
            dsl_strategies,
            signal_queue,
            ..
        } = &mut *inner;

        for (strategy_id, _name, dsl_engine) in dsl_strategies.iter_mut() {
            let graph = engine.graph();
            let ctx = DslContext::new(&bar, graph);
            if let Ok(signals) = dsl_engine.evaluate(&ctx) {
                for mut sig in signals {
                    sig.reason = format!("{}:{}", strategy_id, sig.reason);
                    signal_queue.push(sig);
                }
            }
        }

        Ok(())
    }

    /// Poll accumulated signals from DSL strategies
    /// Returns list of dicts with keys: strategy_id, action, timestamp
    pub fn poll_signals<'py>(&self, py: Python<'py>) -> PyResult<Bound<'py, PyList>> {
        let mut inner = self
            .inner
            .lock()
            .map_err(|_| PyValueError::new_err("lock poisoned"))?;
        let list = PyList::empty_bound(py);

        for s in inner.signal_queue.iter() {
            let strategy_id = s
                .reason
                .split(':')
                .next()
                .and_then(|id| id.parse::<u32>().ok())
                .unwrap_or(0);

            let dict = PyDict::new_bound(py);
            dict.set_item("strategy_id", strategy_id)?;
            dict.set_item(
                "action",
                match s.side {
                    Side::Buy => "BUY",
                    Side::Sell => "SELL",
                    Side::Hold => "HOLD",
                },
            )?;
            dict.set_item("timestamp", s.timestamp)?;
            list.append(dict)?;
        }

        inner.signal_queue.clear();
        Ok(list)
    }

    // Backtest APIs intentionally not exposed on HQuant.
}

fn stats_to_py_dict<'py>(py: Python<'py>, stats: &BacktestStats) -> PyResult<Bound<'py, PyDict>> {
    let dict = PyDict::new_bound(py);
    dict.set_item("total_trades", stats.total_trades)?;
    dict.set_item("winning_trades", stats.winning_trades)?;
    dict.set_item("losing_trades", stats.losing_trades)?;
    dict.set_item("total_pnl", stats.total_pnl)?;
    dict.set_item("max_drawdown", stats.max_drawdown)?;
    dict.set_item("max_drawdown_pct", stats.max_drawdown_pct)?;
    dict.set_item("sharpe_ratio", stats.sharpe_ratio)?;
    dict.set_item("win_rate", stats.win_rate)?;
    dict.set_item("final_equity", stats.final_equity)?;
    dict.set_item("return_pct", stats.return_pct)?;
    dict.set_item("liquidations", stats.liquidations)?;
    Ok(dict)
}

/// Backtest engine
#[pyclass]
pub struct PyBacktest {
    engine: Mutex<BacktestEngine>,
}

#[pymethods]
impl PyBacktest {
    #[new]
    #[pyo3(signature = (initial_margin, leverage=1.0, maker_fee_rate=0.001, taker_fee_rate=0.001, market_type="spot"))]
    pub fn new(
        initial_margin: f64,
        leverage: f64,
        maker_fee_rate: f64,
        taker_fee_rate: f64,
        market_type: &str,
    ) -> Self {
        let mt = match market_type.to_lowercase().as_str() {
            "futures" => MarketType::Futures,
            _ => MarketType::Spot,
        };

        let config = BacktestConfig {
            market_type: mt,
            initial_capital: initial_margin,
            leverage,
            maker_fee: maker_fee_rate,
            taker_fee: taker_fee_rate,
            slippage: 0.0005,
            position_size_pct: 0.1,
        };

        Self {
            engine: Mutex::new(BacktestEngine::new(config)),
        }
    }

    /// Open position.
    ///
    /// position_side: "LONG" | "SHORT"
    pub fn open_position(&self, price: f64, size: f64, position_side: &str) -> PyResult<()> {
        let mut engine = self
            .engine
            .lock()
            .map_err(|_| PyValueError::new_err("lock poisoned"))?;
        let position_side = parse_position_side(position_side)?;
        engine.open_position(price, size, position_side);
        Ok(())
    }

    /// Close current position
    pub fn close_position(&self, price: f64, position_side: &str) -> PyResult<()> {
        let mut engine = self
            .engine
            .lock()
            .map_err(|_| PyValueError::new_err("lock poisoned"))?;
        let position_side = parse_position_side(position_side)?;
        engine.close_position(price, position_side);
        Ok(())
    }

    /// Get backtest result
    pub fn backtest_result<'py>(&self, py: Python<'py>) -> PyResult<Bound<'py, PyDict>> {
        let mut engine = self
            .engine
            .lock()
            .map_err(|_| PyValueError::new_err("lock poisoned"))?;
        stats_to_py_dict(py, engine.result())
    }

    /// Get equity
    pub fn get_equity(&self) -> PyResult<f64> {
        let engine = self
            .engine
            .lock()
            .map_err(|_| PyValueError::new_err("lock poisoned"))?;
        Ok(engine.equity())
    }

    /// Get equity curve
    pub fn get_equity_curve(&self) -> PyResult<Vec<f64>> {
        let engine = self
            .engine
            .lock()
            .map_err(|_| PyValueError::new_err("lock poisoned"))?;
        Ok(engine.equity_curve().to_vec())
    }

    /// Reset backtest
    pub fn reset(&self) -> PyResult<()> {
        let mut engine = self
            .engine
            .lock()
            .map_err(|_| PyValueError::new_err("lock poisoned"))?;
        engine.reset();
        Ok(())
    }
}

/// K-line aggregator
#[pyclass]
pub struct PyAggregator {
    inner: Mutex<MultiTimeFrameAggregator>,
}

#[pymethods]
impl PyAggregator {
    #[new]
    pub fn new(base_tf: &str, target_tfs: Vec<String>, capacity: usize) -> PyResult<Self> {
        let base = parse_timeframe(base_tf)?;
        let targets: Vec<TimeFrame> = target_tfs
            .iter()
            .map(|s| parse_timeframe(s))
            .collect::<PyResult<Vec<_>>>()?;

        let agg = MultiTimeFrameAggregator::new(base, &targets, capacity)
            .map_err(|e| PyValueError::new_err(e.to_string()))?;

        Ok(Self {
            inner: Mutex::new(agg),
        })
    }

    /// Push K-line and get completed events
    pub fn push_kline<'py>(
        &self,
        py: Python<'py>,
        bar_dict: &Bound<'py, PyDict>,
    ) -> PyResult<Bound<'py, PyList>> {
        let mut agg = self
            .inner
            .lock()
            .map_err(|_| PyValueError::new_err("lock poisoned"))?;
        let bar = to_bar(bar_dict)?;
        let completed = agg.push(&bar);

        let list = PyList::empty_bound(py);
        for tf in completed {
            if let Some(output) = agg.output(tf) {
                if let Some(last) = output.last() {
                    let dict = PyDict::new_bound(py);
                    dict.set_item("kind", "KlineClosed")?;
                    dict.set_item("period", tf.as_str())?;

                    let candle = PyDict::new_bound(py);
                    candle.set_item("timestamp", last.timestamp)?;
                    candle.set_item("open", last.open)?;
                    candle.set_item("high", last.high)?;
                    candle.set_item("low", last.low)?;
                    candle.set_item("close", last.close)?;
                    candle.set_item("volume", last.volume)?;
                    candle.set_item("buy_volume", last.buy_volume)?;
                    dict.set_item("candle", candle)?;

                    list.append(dict)?;
                }
            }
        }

        Ok(list)
    }

    /// Flush all pending candles
    pub fn flush(&self) -> PyResult<()> {
        let mut agg = self
            .inner
            .lock()
            .map_err(|_| PyValueError::new_err("lock poisoned"))?;
        agg.flush_all();
        Ok(())
    }

    /// Reset aggregator
    pub fn reset(&self) -> PyResult<()> {
        let mut agg = self
            .inner
            .lock()
            .map_err(|_| PyValueError::new_err("lock poisoned"))?;
        agg.reset();
        Ok(())
    }
}

/// DSL Strategy engine
#[pyclass]
pub struct PyDslStrategy {
    inner: Mutex<DslEngine>,
}

#[pymethods]
impl PyDslStrategy {
    /// Create a new DSL strategy from source code
    #[new]
    pub fn new(source: &str) -> PyResult<Self> {
        let engine = DslEngine::new(source).map_err(|e| PyValueError::new_err(e.to_string()))?;
        Ok(Self {
            inner: Mutex::new(engine),
        })
    }

    /// Load labeled vectors into a named store for similarity matching
    pub fn load_store(&self, name: &str, vectors: &Bound<'_, PyList>) -> PyResult<()> {
        let mut engine = self
            .inner
            .lock()
            .map_err(|_| PyValueError::new_err("lock poisoned"))?;

        let mut labeled = Vec::new();
        for item in vectors.iter() {
            let dict = item.downcast::<PyDict>()?;
            let label: i32 = dict
                .get_item("label")?
                .ok_or_else(|| PyValueError::new_err("missing label"))?
                .extract()?;
            let vector: Vec<f64> = dict
                .get_item("vector")?
                .ok_or_else(|| PyValueError::new_err("missing vector"))?
                .extract()?;
            labeled.push(LabeledVector::new(label, vector));
        }

        engine.vector_store_mut().load(name, labeled);
        Ok(())
    }

    /// Set similarity threshold (default: 0.9)
    pub fn set_threshold(&self, threshold: f64) -> PyResult<()> {
        let mut engine = self
            .inner
            .lock()
            .map_err(|_| PyValueError::new_err("lock poisoned"))?;
        engine.set_threshold(threshold);
        Ok(())
    }

    /// Evaluate strategy with given bar data
    pub fn evaluate<'py>(
        &self,
        py: Python<'py>,
        bar_dict: &Bound<'py, PyDict>,
    ) -> PyResult<Bound<'py, PyList>> {
        let mut engine = self
            .inner
            .lock()
            .map_err(|_| PyValueError::new_err("lock poisoned"))?;
        let bar = to_bar(bar_dict)?;

        let empty_graph = IndicatorGraph::new();
        let ctx = DslContext::new(&bar, &empty_graph);

        let signals = engine
            .evaluate(&ctx)
            .map_err(|e| PyValueError::new_err(e.to_string()))?;

        let list = PyList::empty_bound(py);
        for s in &signals {
            let dict = PyDict::new_bound(py);
            dict.set_item(
                "side",
                match s.side {
                    Side::Buy => "BUY",
                    Side::Sell => "SELL",
                    Side::Hold => "HOLD",
                },
            )?;
            dict.set_item("strength", s.strength)?;
            dict.set_item("reason", &s.reason)?;
            dict.set_item("timestamp", s.timestamp)?;
            list.append(dict)?;
        }
        Ok(list)
    }

    /// Reset strategy state
    pub fn reset(&self) -> PyResult<()> {
        let mut engine = self
            .inner
            .lock()
            .map_err(|_| PyValueError::new_err("lock poisoned"))?;
        engine.reset();
        Ok(())
    }
}

/// Standalone futures backtest engine (compatible with jx-quant)
/// Decoupled from HQuant, can be used independently with any signal source
/// Uses shared Rust core implementation for consistency across Python/Node.js
#[pyclass]
pub struct FuturesBacktest {
    inner: CoreFuturesBacktest,
}

#[pymethods]
impl FuturesBacktest {
    #[new]
    #[pyo3(signature = (initial_margin, leverage, contract_size, maker_fee_rate, taker_fee_rate, maintenance_margin_rate, decimals=None))]
    pub fn new(
        initial_margin: f64,
        leverage: f64,
        contract_size: f64,
        maker_fee_rate: f64,
        taker_fee_rate: f64,
        maintenance_margin_rate: f64,
        decimals: Option<u32>,
    ) -> Self {
        let config = FuturesBacktestConfig {
            initial_margin,
            leverage,
            contract_size,
            maker_fee_rate,
            taker_fee_rate,
            maintenance_margin_rate,
        };
        let mut inner = CoreFuturesBacktest::new(config);
        if let Some(d) = decimals {
            inner.set_decimals(d);
        }
        Self { inner }
    }

    /// Set decimal precision for results (default: 8)
    pub fn set_decimals(&mut self, decimals: u32) {
        self.inner.set_decimals(decimals);
    }

    /// Apply a trading signal
    /// action: "BUY", "SELL", or "HOLD"
    /// price: current market price
    /// margin: margin amount to use for opening/closing positions
    /// is_maker: if true, use maker_fee_rate (limit order); if false, use taker_fee_rate (market order)
    #[pyo3(signature = (action, price, margin, position_side=None, is_maker=false))]
    pub fn apply_signal(
        &mut self,
        action: &str,
        price: f64,
        margin: f64,
        position_side: Option<&str>,
        is_maker: bool,
    ) -> PyResult<()> {
        let position_side = position_side.map(parse_position_side).transpose()?;
        self.inner
            .apply_signal(action, price, margin, position_side, is_maker);
        Ok(())
    }

    /// Open a position directly.
    /// position_side: "LONG" | "SHORT"
    #[pyo3(signature = (position_side, price, margin, is_maker=false))]
    pub fn open_position(
        &mut self,
        position_side: &str,
        price: f64,
        margin: f64,
        is_maker: bool,
    ) -> PyResult<()> {
        let position_side = parse_position_side(position_side)?;
        self.inner
            .open_position(price, margin, position_side, is_maker);
        Ok(())
    }

    /// Close a position directly.
    /// position_side: "LONG" | "SHORT"
    #[pyo3(signature = (position_side, price, margin, is_maker=false))]
    pub fn close_position(
        &mut self,
        position_side: &str,
        price: f64,
        margin: f64,
        is_maker: bool,
    ) -> PyResult<()> {
        let position_side = parse_position_side(position_side)?;
        self.inner
            .close_position(price, margin, position_side, is_maker);
        Ok(())
    }

    /// Update position value on price change (for liquidation checking)
    pub fn on_price(&mut self, price: f64) {
        self.inner.on_price(price);
    }

    /// Get backtest result
    pub fn result<'py>(&self, py: Python<'py>, price: f64) -> PyResult<Bound<'py, PyDict>> {
        let r = self.inner.result(price);
        let dict = PyDict::new_bound(py);
        dict.set_item("equity", r.equity)?;
        dict.set_item("profit", r.profit)?;
        dict.set_item("profit_rate", r.profit_rate)?;
        dict.set_item("max_drawdown_rate", r.max_drawdown_rate)?;
        dict.set_item("liquidated", r.liquidated)?;
        Ok(dict)
    }

    /// Get current equity
    pub fn get_equity(&self) -> f64 {
        self.inner.equity()
    }

    /// Get current position
    pub fn get_position(&self) -> f64 {
        self.inner.position()
    }

    /// Get current positions (0 or 1).
    pub fn get_positions<'py>(&self, py: Python<'py>) -> PyResult<Vec<PyObject>> {
        let positions = self.inner.positions();
        positions
            .into_iter()
            .map(|p| {
                let dict = PyDict::new_bound(py);
                dict.set_item("position_side", position_side_to_str(p.position_side))?;
                dict.set_item("entry_price", p.entry_price)?;
                dict.set_item("mark_price", p.mark_price)?;
                dict.set_item("position_amt", p.position_amt)?;
                dict.set_item("margin", p.margin)?;
                dict.set_item("unrealized_pnl", p.unrealized_pnl)?;
                Ok(dict.into_py(py))
            })
            .collect()
    }

    /// Check if liquidated
    pub fn is_liquidated(&self) -> bool {
        self.inner.is_liquidated()
    }

    /// Reset backtest state
    pub fn reset(&mut self) {
        self.inner.reset();
    }
}

/// Compile and validate DSL source
#[pyfunction]
fn validate_dsl(source: &str) -> PyResult<bool> {
    match crate::dsl::compile(source) {
        Ok(_) => Ok(true),
        Err(e) => Err(PyValueError::new_err(e.to_string())),
    }
}

/// Python module
#[pymodule]
fn _hquant(m: &Bound<'_, pyo3::types::PyModule>) -> PyResult<()> {
    m.add_class::<HQuant>()?;
    m.add_class::<PyBacktest>()?;
    m.add_class::<PyAggregator>()?;
    m.add_class::<PyDslStrategy>()?;
    m.add_class::<FuturesBacktest>()?;
    m.add_function(wrap_pyfunction!(validate_dsl, m)?)?;
    Ok(())
}
