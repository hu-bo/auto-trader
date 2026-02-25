use std::collections::HashMap;

use numpy::PyReadonlyArray1;
use pyo3::exceptions::PyValueError;
use pyo3::prelude::*;
use pyo3::types::{PyDict, PyList};

use crate::aggregator::{Aggregator, AggregatorEventKind};
use crate::backtest::futures_backtest::{
    BacktestParams, BacktestResult, FuturesBacktest as CoreFuturesBacktest, PositionSide,
};
use crate::backtest::simple_backtest::{Backtest as SimpleBacktest, BacktestConfig, MarketType};
use crate::dsl::{compile_strategy, validate_dsl as validate_dsl_core, CompiledStrategy};
use crate::indicators::{IndicatorId, IndicatorSpec, IndicatorValue};
use crate::kline_buffer::KlineBuffer;
use crate::multi::MultiHQuant as CoreMultiHQuant;
use crate::period::Period;
use crate::types::{Action, Bar};
use crate::vector_store::{LabeledVector, VectorStore};

fn py_err(msg: impl ToString) -> PyErr {
    PyValueError::new_err(msg.to_string())
}

fn dict_get_f64(d: &Bound<'_, PyDict>, key: &str) -> PyResult<Option<f64>> {
    Ok(match d.get_item(key)? {
        None => None,
        Some(v) => Some(v.extract::<f64>()?),
    })
}

fn dict_get_i64(d: &Bound<'_, PyDict>, key: &str) -> PyResult<Option<i64>> {
    Ok(match d.get_item(key)? {
        None => None,
        Some(v) => Some(v.extract::<i64>()?),
    })
}

fn bar_from_dict(d: &Bound<'_, PyDict>) -> PyResult<Bar> {
    let timestamp = dict_get_i64(d, "timestamp")?.unwrap_or(0);
    let open = dict_get_f64(d, "open")?.unwrap_or(0.0);
    let high = dict_get_f64(d, "high")?.unwrap_or(open);
    let low = dict_get_f64(d, "low")?.unwrap_or(open);
    let close = dict_get_f64(d, "close")?.unwrap_or(open);
    let volume = dict_get_f64(d, "volume")?.unwrap_or(0.0);
    let buy_volume = dict_get_f64(d, "buy_volume")?
        .or(dict_get_f64(d, "buyVolume")?)
        .unwrap_or(0.0);
    Ok(Bar {
        timestamp,
        open,
        high,
        low,
        close,
        volume,
        buy_volume,
    })
}

fn merge_bar_update(last: Bar, update: &Bound<'_, PyDict>) -> PyResult<Bar> {
    Ok(Bar {
        timestamp: dict_get_i64(update, "timestamp")?.unwrap_or(last.timestamp),
        open: dict_get_f64(update, "open")?.unwrap_or(last.open),
        high: dict_get_f64(update, "high")?.unwrap_or(last.high),
        low: dict_get_f64(update, "low")?.unwrap_or(last.low),
        close: dict_get_f64(update, "close")?.unwrap_or(last.close),
        volume: dict_get_f64(update, "volume")?.unwrap_or(last.volume),
        buy_volume: dict_get_f64(update, "buy_volume")?
            .or(dict_get_f64(update, "buyVolume")?)
            .unwrap_or(last.buy_volume),
    })
}

fn indicator_spec_from_py(config: &Bound<'_, PyDict>) -> PyResult<IndicatorSpec> {
    let kind = config
        .get_item("type")?
        .ok_or_else(|| py_err("indicator config missing 'type'"))?
        .extract::<String>()?
        .to_ascii_lowercase();

    let period = config.get_item("period")?.and_then(|v| v.extract::<u32>().ok());
    let fast = config.get_item("fast")?.and_then(|v| v.extract::<u32>().ok());
    let slow = config.get_item("slow")?.and_then(|v| v.extract::<u32>().ok());
    let signal = config.get_item("signal")?.and_then(|v| v.extract::<u32>().ok());
    let std_dev = config
        .get_item("std_dev")?
        .and_then(|v| v.extract::<f64>().ok())
        .or_else(|| config.get_item("stdDev").ok().flatten().and_then(|v| v.extract::<f64>().ok()));

    match kind.as_str() {
        "ma" | "sma" => Ok(IndicatorSpec::Sma {
            field: crate::types::Field::Close,
            period: period.ok_or_else(|| py_err("period is required"))? as usize,
        }),
        "ema" => Ok(IndicatorSpec::Ema {
            field: crate::types::Field::Close,
            period: period.ok_or_else(|| py_err("period is required"))? as usize,
        }),
        "stddev" => Ok(IndicatorSpec::StdDev {
            field: crate::types::Field::Close,
            period: period.ok_or_else(|| py_err("period is required"))? as usize,
        }),
        "rsi" => Ok(IndicatorSpec::Rsi {
            period: period.ok_or_else(|| py_err("period is required"))? as usize,
        }),
        "macd" => Ok(IndicatorSpec::Macd {
            fast: fast.ok_or_else(|| py_err("fast is required"))? as usize,
            slow: slow.ok_or_else(|| py_err("slow is required"))? as usize,
            signal: signal.ok_or_else(|| py_err("signal is required"))? as usize,
        }),
        "boll" | "bollinger" => Ok(IndicatorSpec::Boll {
            period: period.ok_or_else(|| py_err("period is required"))? as usize,
            k_bits: std_dev.ok_or_else(|| py_err("std_dev is required"))?.to_bits(),
        }),
        other => Err(py_err(format!("unsupported indicator type: {other}"))),
    }
}

#[pyclass]
pub struct HQuant {
    inner: crate::hquant::HQuant,
    named: HashMap<String, IndicatorId>,
    aggregator: Option<Aggregator>,
}

#[pymethods]
impl HQuant {
    #[new]
    #[pyo3(signature = (capacity=1000))]
    fn new(capacity: usize) -> Self {
        Self {
            inner: crate::hquant::HQuant::new(capacity),
            named: HashMap::new(),
            aggregator: None,
        }
    }

    fn add_indicator(&mut self, name: String, config: &Bound<'_, PyDict>) -> PyResult<()> {
        let spec = indicator_spec_from_py(config)?;
        let id = self.inner.add_indicator(spec);
        self.named.insert(name, id);
        Ok(())
    }

    fn push_kline(&mut self, bar: &Bound<'_, PyDict>) -> PyResult<Vec<PyObject>> {
        self.inner.push_kline(bar_from_dict(bar)?);
        Ok(Vec::new())
    }

    fn update_last(&mut self, bar: &Bound<'_, PyDict>) -> PyResult<()> {
        let Some(last) = self.inner.bars().last() else {
            return Ok(());
        };
        let merged = merge_bar_update(last, bar)?;
        self.inner.update_last(merged);
        Ok(())
    }

    fn get_indicator(&self, py: Python<'_>, name: String) -> PyResult<Option<f64>> {
        let Some(id) = self.named.get(&name).copied() else {
            return Ok(None);
        };
        Ok(match self.inner.indicator_last(id) {
            Some(IndicatorValue::F64(x)) => Some(x),
            Some(IndicatorValue::Boll(b)) => Some(b.mid),
            Some(IndicatorValue::Macd(m)) => Some(m.macd),
            None => None,
        })
    }

    fn get_indicator_result(&self, py: Python<'_>, name: String) -> PyResult<Option<PyObject>> {
        let Some(id) = self.named.get(&name).copied() else {
            return Ok(None);
        };
        let Some(last) = self.inner.bars().last() else {
            return Ok(None);
        };
        let ts = last.timestamp;
        let Some(v) = self.inner.indicator_last(id) else {
            return Ok(None);
        };
        let d = PyDict::new_bound(py);
        match v {
            IndicatorValue::F64(x) => {
                d.set_item("value", x)?;
                d.set_item("timestamp", ts)?;
            }
            IndicatorValue::Boll(b) => {
                d.set_item("value", b.mid)?;
                d.set_item("timestamp", ts)?;
                d.set_item("extra", vec![b.upper, b.lower])?;
            }
            IndicatorValue::Macd(m) => {
                d.set_item("value", m.macd)?;
                d.set_item("timestamp", ts)?;
                d.set_item("extra", vec![m.hist, m.signal])?;
            }
        }
        Ok(Some(d.into()))
    }

    fn is_ready(&self, name: String) -> PyResult<bool> {
        let Some(id) = self.named.get(&name).copied() else {
            return Ok(false);
        };
        let Some(v) = self.inner.indicator_last(id) else {
            return Ok(false);
        };
        let x = match v {
            IndicatorValue::F64(x) => x,
            IndicatorValue::Boll(b) => b.mid,
            IndicatorValue::Macd(m) => m.macd,
        };
        Ok(x.is_finite() && !x.is_nan())
    }

    fn load_store(&mut self, name: String, vectors: &Bound<'_, PyList>) -> PyResult<()> {
        let mut out = Vec::new();
        for v in vectors.iter() {
            let d = v.downcast::<PyDict>()?;
            let label = d
                .get_item("label")?
                .ok_or_else(|| py_err("missing label"))?
                .extract::<i32>()?;
            let vector = d
                .get_item("vector")?
                .ok_or_else(|| py_err("missing vector"))?
                .extract::<Vec<f64>>()?;
            let ts = match d.get_item("ts")? {
                None => None,
                Some(x) => Some(x.extract::<i64>()?),
            };
            out.push(LabeledVector { label, vector, ts });
        }
        self.inner.load_store(&name, out);
        Ok(())
    }

    fn set_threshold(&mut self, threshold: f64) -> PyResult<()> {
        if !threshold.is_finite() || !(-1.0..=1.0).contains(&threshold) {
            return Err(py_err("threshold must be finite in [-1,1]"));
        }
        self.inner.set_similarity_threshold(threshold);
        Ok(())
    }

    fn reset(&mut self) {
        self.inner.reset();
        self.named.clear();
        self.aggregator = None;
    }

    fn add_strategy(&mut self, name: String, dsl: String) -> PyResult<u32> {
        self.inner
            .add_strategy(&name, &dsl)
            .map_err(|e| py_err(e.to_string()))
    }

    fn push_bar(&mut self, bar: &Bound<'_, PyDict>) -> PyResult<()> {
        self.inner.push_kline(bar_from_dict(bar)?);
        Ok(())
    }

    /// Load historical data from NumPy arrays (zero-copy).
    /// All arrays must have the same length.
    #[pyo3(signature = (timestamp, open, high, low, close, volume, buy_volume=None))]
    fn load_history(
        &mut self,
        timestamp: PyReadonlyArray1<'_, i64>,
        open: PyReadonlyArray1<'_, f64>,
        high: PyReadonlyArray1<'_, f64>,
        low: PyReadonlyArray1<'_, f64>,
        close: PyReadonlyArray1<'_, f64>,
        volume: PyReadonlyArray1<'_, f64>,
        buy_volume: Option<PyReadonlyArray1<'_, f64>>,
    ) -> PyResult<()> {
        let ts = timestamp.as_slice()?;
        let o = open.as_slice()?;
        let h = high.as_slice()?;
        let l = low.as_slice()?;
        let c = close.as_slice()?;
        let v = volume.as_slice()?;

        let n = ts.len();
        if o.len() != n || h.len() != n || l.len() != n || c.len() != n || v.len() != n {
            return Err(py_err("all arrays must have the same length"));
        }

        let bv_slice: Vec<f64>;
        let bv: &[f64] = match &buy_volume {
            Some(arr) => {
                let slice = arr.as_slice()?;
                if slice.len() != n {
                    return Err(py_err("buy_volume array must have the same length"));
                }
                slice
            }
            None => {
                bv_slice = vec![0.0; n];
                &bv_slice
            }
        };

        let bars: Vec<Bar> = (0..n)
            .map(|i| Bar {
                timestamp: ts[i],
                open: o[i],
                high: h[i],
                low: l[i],
                close: c[i],
                volume: v[i],
                buy_volume: bv[i],
            })
            .collect();

        self.inner.load_history(&bars);
        Ok(())
    }

    fn poll_signals(&mut self, py: Python<'_>) -> PyResult<Vec<PyObject>> {
        let mut out = Vec::new();
        for s in self.inner.poll_signals() {
            let d = PyDict::new_bound(py);
            d.set_item("strategy_id", s.strategy_id)?;
            d.set_item("action", s.action.as_str())?;
            d.set_item("timestamp", s.timestamp)?;
            out.push(d.into());
        }
        Ok(out)
    }
}

#[pyclass]
pub struct MultiHQuant {
    inner: CoreMultiHQuant,
}

#[pymethods]
impl MultiHQuant {
    #[new]
    fn new(capacity: usize, periods: Vec<String>) -> PyResult<Self> {
        if periods.is_empty() {
            return Err(py_err("periods must be non-empty"));
        }
        let mut ps = Vec::with_capacity(periods.len());
        for p in periods {
            ps.push(Period::parse(&p).map_err(|e| py_err(e.to_string()))?);
        }
        Ok(Self {
            inner: CoreMultiHQuant::new(capacity, ps),
        })
    }

    fn add_strategy(&mut self, name: String, dsl: String) -> PyResult<u32> {
        self.inner
            .add_strategy(&name, &dsl)
            .map_err(|e| py_err(e.to_string()))
    }

    fn add_multi_strategy(&mut self, name: String, dsl: String) -> PyResult<u32> {
        self.inner
            .add_multi_strategy(&name, &dsl)
            .map_err(|e| py_err(e.to_string()))
    }

    fn feed_bar(&mut self, bar: &Bound<'_, PyDict>) -> PyResult<()> {
        self.inner.feed_bar(bar_from_dict(bar)?);
        Ok(())
    }

    /// Load historical data from NumPy arrays (zero-copy).
    /// All arrays must have the same length.
    #[pyo3(signature = (timestamp, open, high, low, close, volume, buy_volume=None))]
    fn load_history(
        &mut self,
        timestamp: PyReadonlyArray1<'_, i64>,
        open: PyReadonlyArray1<'_, f64>,
        high: PyReadonlyArray1<'_, f64>,
        low: PyReadonlyArray1<'_, f64>,
        close: PyReadonlyArray1<'_, f64>,
        volume: PyReadonlyArray1<'_, f64>,
        buy_volume: Option<PyReadonlyArray1<'_, f64>>,
    ) -> PyResult<()> {
        let ts = timestamp.as_slice()?;
        let o = open.as_slice()?;
        let h = high.as_slice()?;
        let l = low.as_slice()?;
        let c = close.as_slice()?;
        let v = volume.as_slice()?;

        let n = ts.len();
        if o.len() != n || h.len() != n || l.len() != n || c.len() != n || v.len() != n {
            return Err(py_err("all arrays must have the same length"));
        }

        let bv_slice: Vec<f64>;
        let bv: &[f64] = match &buy_volume {
            Some(arr) => {
                let slice = arr.as_slice()?;
                if slice.len() != n {
                    return Err(py_err("buy_volume array must have the same length"));
                }
                slice
            }
            None => {
                bv_slice = vec![0.0; n];
                &bv_slice
            }
        };

        let bars: Vec<Bar> = (0..n)
            .map(|i| Bar {
                timestamp: ts[i],
                open: o[i],
                high: h[i],
                low: l[i],
                close: c[i],
                volume: v[i],
                buy_volume: bv[i],
            })
            .collect();

        self.inner.load_history(&bars);
        Ok(())
    }

    fn update_last(&mut self, bar: &Bound<'_, PyDict>) -> PyResult<()> {
        self.inner.update_last(bar_from_dict(bar)?);
        Ok(())
    }

    fn flush(&mut self) {
        self.inner.flush();
    }

    fn poll_signals(&mut self, py: Python<'_>) -> PyResult<Vec<PyObject>> {
        let mut out = Vec::new();
        for s in self.inner.poll_signals() {
            let d = PyDict::new_bound(py);
            d.set_item("strategy_id", s.strategy_id)?;
            d.set_item("action", s.action.as_str())?;
            d.set_item("timestamp", s.timestamp)?;
            out.push(d.into());
        }
        Ok(out)
    }
}

#[pyclass]
pub struct PyBacktest {
    inner: SimpleBacktest,
}

#[pymethods]
impl PyBacktest {
    #[new]
    #[pyo3(signature = (initial_margin, leverage=1.0, maker_fee_rate=0.001, taker_fee_rate=0.001, market_type="spot"))]
    fn new(
        initial_margin: f64,
        leverage: f64,
        maker_fee_rate: f64,
        taker_fee_rate: f64,
        market_type: &str,
    ) -> Self {
        let market_type = match market_type.to_ascii_lowercase().as_str() {
            "futures" => MarketType::Futures,
            _ => MarketType::Spot,
        };
        let cfg = BacktestConfig {
            market_type,
            initial_capital: initial_margin,
            leverage,
            maker_fee_rate,
            taker_fee_rate,
        };
        Self {
            inner: SimpleBacktest::new(cfg),
        }
    }

    fn open_position(&mut self, price: f64, size: f64, position_side: &str) {
        if let Some(side) = parse_position_side(position_side) {
            self.inner.open_position(price, size, side);
        }
    }

    fn close_position(&mut self, price: f64, position_side: &str) {
        if let Some(side) = parse_position_side(position_side) {
            self.inner.close_position(price, side);
        }
    }

    fn backtest_result(&self, py: Python<'_>) -> PyResult<PyObject> {
        let r = self.inner.result();
        let d = PyDict::new_bound(py);
        d.set_item("total_trades", r.total_trades)?;
        d.set_item("winning_trades", r.winning_trades)?;
        d.set_item("losing_trades", r.losing_trades)?;
        d.set_item("total_pnl", r.total_pnl)?;
        d.set_item("max_drawdown", r.max_drawdown)?;
        d.set_item("max_drawdown_pct", r.max_drawdown_pct)?;
        d.set_item("sharpe_ratio", r.sharpe_ratio)?;
        d.set_item("win_rate", r.win_rate)?;
        d.set_item("final_equity", r.final_equity)?;
        d.set_item("return_pct", r.return_pct)?;
        d.set_item("liquidations", r.liquidations)?;
        Ok(d.into())
    }

    fn get_equity(&self) -> f64 {
        self.inner.equity()
    }

    fn get_equity_curve(&self) -> Vec<f64> {
        self.inner.equity_curve().to_vec()
    }

    fn reset(&mut self) {
        self.inner.reset();
    }
}

#[pyclass]
pub struct PyAggregator {
    inner: Aggregator,
}

#[pymethods]
impl PyAggregator {
    #[new]
    fn new(base_tf: String, target_tfs: Vec<String>, _capacity: usize) -> PyResult<Self> {
        let base = Period::parse(&base_tf).map_err(|e| py_err(e.to_string()))?;
        let mut periods = vec![base];
        for p in target_tfs {
            periods.push(Period::parse(&p).map_err(|e| py_err(e.to_string()))?);
        }
        Ok(Self {
            inner: Aggregator::new(periods),
        })
    }

    fn push_kline(&mut self, py: Python<'_>, bar: &Bound<'_, PyDict>) -> PyResult<Vec<PyObject>> {
        let bar = bar_from_dict(bar)?;
        self.inner.push(&bar);
        let events = self.inner.poll_events();
        let mut out = Vec::new();
        for e in events {
            let d = PyDict::new_bound(py);
            d.set_item(
                "kind",
                match e.kind {
                    AggregatorEventKind::KlineClosed => "KlineClosed",
                },
            )?;
            d.set_item("period", e.period.to_string())?;
            let candle: Bar = e.candle.into();
            let c = PyDict::new_bound(py);
            c.set_item("timestamp", candle.timestamp)?;
            c.set_item("open", candle.open)?;
            c.set_item("high", candle.high)?;
            c.set_item("low", candle.low)?;
            c.set_item("close", candle.close)?;
            c.set_item("volume", candle.volume)?;
            c.set_item("buy_volume", candle.buy_volume)?;
            d.set_item("candle", c)?;
            out.push(d.into());
        }
        Ok(out)
    }

    fn flush(&mut self) {
        self.inner.flush();
        let _ = self.inner.poll_events();
    }

    fn reset(&mut self) {
        self.inner.reset();
    }
}

#[pyclass]
pub struct PyDslStrategy {
    bars: KlineBuffer,
    graph: crate::indicators::IndicatorGraph,
    strategy: CompiledStrategy,
    store: VectorStore,
}

#[pymethods]
impl PyDslStrategy {
    #[new]
    fn new(source: String) -> PyResult<Self> {
        let capacity = 4096usize;
        let mut graph = crate::indicators::IndicatorGraph::new(capacity);
        let strategy = compile_strategy(1, "dsl", &source, &mut graph).map_err(|e| py_err(e.to_string()))?;
        Ok(Self {
            bars: KlineBuffer::new(capacity),
            graph,
            strategy,
            store: VectorStore::new(),
        })
    }

    fn load_store(&mut self, name: String, vectors: &Bound<'_, PyList>) -> PyResult<()> {
        let mut out = Vec::new();
        for v in vectors.iter() {
            let d = v.downcast::<PyDict>()?;
            let label = d
                .get_item("label")?
                .ok_or_else(|| py_err("missing label"))?
                .extract::<i32>()?;
            let vector = d
                .get_item("vector")?
                .ok_or_else(|| py_err("missing vector"))?
                .extract::<Vec<f64>>()?;
            out.push(LabeledVector {
                label,
                vector,
                ts: None,
            });
        }
        self.store.load(&name, out);
        Ok(())
    }

    fn set_threshold(&mut self, threshold: f64) -> PyResult<()> {
        if !threshold.is_finite() || !(0.0..=1.0).contains(&threshold) {
            return Err(py_err("threshold must be in [0,1]"));
        }
        self.store.threshold = threshold;
        Ok(())
    }

    fn evaluate(&mut self, py: Python<'_>, bar: &Bound<'_, PyDict>) -> PyResult<Vec<PyObject>> {
        let bar = bar_from_dict(bar)?;
        self.bars.push(bar);
        self.graph.on_push(&self.bars);
        let Some(sig) = self.strategy.evaluate(&self.bars, &self.graph, Some(&self.store)) else {
            return Ok(Vec::new());
        };
        let d = PyDict::new_bound(py);
        d.set_item("side", sig.action.as_str())?;
        d.set_item("strength", 1.0)?;
        d.set_item("reason", sig.meta.unwrap_or_else(|| "dsl".to_string()))?;
        d.set_item("timestamp", sig.timestamp)?;
        Ok(vec![d.into()])
    }

    /// Feed a bar and return debug info: all variable values + signal.
    fn debug_evaluate(&mut self, py: Python<'_>, bar: &Bound<'_, PyDict>) -> PyResult<PyObject> {
        let bar = bar_from_dict(bar)?;
        self.bars.push(bar);
        self.graph.on_push(&self.bars);

        let vars = self.strategy.debug_evaluate(&self.bars, &self.graph, Some(&self.store));
        let signal = self.strategy.evaluate(&self.bars, &self.graph, Some(&self.store));

        let d = PyDict::new_bound(py);

        // variables
        let var_dict = PyDict::new_bound(py);
        for (name, value) in vars {
            if value.is_nan() {
                var_dict.set_item(name, py.None())?;
            } else {
                var_dict.set_item(name, value)?;
            }
        }
        d.set_item("variables", var_dict)?;

        // bar info
        d.set_item("timestamp", bar.timestamp)?;
        d.set_item("open", bar.open)?;
        d.set_item("high", bar.high)?;
        d.set_item("low", bar.low)?;
        d.set_item("close", bar.close)?;
        d.set_item("volume", bar.volume)?;

        // signal info
        match signal {
            Some(sig) => {
                d.set_item("signal", sig.action.as_str())?;
                d.set_item("meta", sig.meta.unwrap_or_default())?;
            }
            None => {
                d.set_item("signal", py.None())?;
                d.set_item("meta", py.None())?;
            }
        }

        Ok(d.into())
    }

    /// Return names of all LET-declared variables.
    fn variable_names(&self) -> Vec<String> {
        self.strategy.variable_names().iter().map(|s| s.to_string()).collect()
    }

    fn reset(&mut self) {
        self.bars.clear();
        self.graph.reset();
    }
}

#[pyclass]
pub struct FuturesBacktest {
    inner: CoreFuturesBacktest,
    last_price: f64,
}

#[pymethods]
impl FuturesBacktest {
    #[new]
    fn new(
        initial_margin: f64,
        leverage: f64,
        contract_size: f64,
        maker_fee_rate: f64,
        taker_fee_rate: f64,
        maintenance_margin_rate: f64,
    ) -> PyResult<Self> {
        let params = BacktestParams {
            initial_margin,
            leverage,
            contract_size,
            maker_fee_rate,
            taker_fee_rate,
            maintenance_margin_rate,
        };
        let inner = CoreFuturesBacktest::try_new(params).ok_or_else(|| py_err("invalid params"))?;
        Ok(Self {
            inner,
            last_price: f64::NAN,
        })
    }

    #[pyo3(signature = (action, price, margin, position_side=None, is_maker=false))]
    fn apply_signal(
        &mut self,
        action: String,
        price: f64,
        margin: f64,
        position_side: Option<String>,
        is_maker: bool,
    ) -> PyResult<()> {
        let action = Action::parse(&action).ok_or_else(|| py_err("invalid action"))?;
        let params = self.inner.params();
        let fee_rate = if is_maker { params.maker_fee_rate } else { params.taker_fee_rate };
        match position_side.as_deref().and_then(parse_position_side) {
            None => self.inner.apply_signal(action, price, margin),
            Some(PositionSide::Long) => match action {
                Action::Buy => self.inner.open_long(price, margin, fee_rate),
                Action::Sell => self.inner.close_long(price, margin, fee_rate),
                Action::Hold => {}
            },
            Some(PositionSide::Short) => match action {
                Action::Sell => self.inner.open_short(price, margin, fee_rate),
                Action::Buy => self.inner.close_short(price, margin, fee_rate),
                Action::Hold => {}
            },
        }
        self.inner.on_price(price);
        self.last_price = price;
        Ok(())
    }

    #[pyo3(signature = (position_side, price, margin, is_maker=false))]
    fn open_position(&mut self, position_side: String, price: f64, margin: f64, is_maker: bool) {
        let params = self.inner.params();
        let fee_rate = if is_maker { params.maker_fee_rate } else { params.taker_fee_rate };
        match parse_position_side(&position_side) {
            Some(PositionSide::Long) => self.inner.open_long(price, margin, fee_rate),
            Some(PositionSide::Short) => self.inner.open_short(price, margin, fee_rate),
            None => {}
        }
        self.last_price = price;
    }

    #[pyo3(signature = (position_side, price, margin, is_maker=false))]
    fn close_position(&mut self, position_side: String, price: f64, margin: f64, is_maker: bool) {
        let params = self.inner.params();
        let fee_rate = if is_maker { params.maker_fee_rate } else { params.taker_fee_rate };
        match parse_position_side(&position_side) {
            Some(PositionSide::Long) => self.inner.close_long(price, margin, fee_rate),
            Some(PositionSide::Short) => self.inner.close_short(price, margin, fee_rate),
            None => {}
        }
        self.last_price = price;
    }

    fn on_price(&mut self, price: f64) {
        self.inner.on_price(price);
        self.last_price = price;
    }

    fn result(&self, py: Python<'_>, price: f64) -> PyResult<PyObject> {
        let r = self.inner.result(price);
        let d = PyDict::new_bound(py);
        d.set_item("equity", r.equity)?;
        d.set_item("profit", r.profit)?;
        d.set_item("profit_rate", r.profit_rate)?;
        d.set_item("max_drawdown_rate", r.max_drawdown_rate)?;
        d.set_item("liquidated", r.liquidated)?;
        Ok(d.into())
    }

    fn get_positions(&self, py: Python<'_>) -> PyResult<Vec<PyObject>> {
        let mut out = Vec::new();
        for p in self.inner.get_positions(self.last_price) {
            let d = PyDict::new_bound(py);
            d.set_item(
                "position_side",
                match p.position_side {
                    PositionSide::Long => "LONG",
                    PositionSide::Short => "SHORT",
                },
            )?;
            d.set_item("entry_price", p.entry_price)?;
            d.set_item("mark_price", p.mark_price)?;
            d.set_item("position_amt", p.position_amt)?;
            d.set_item("margin", p.margin)?;
            d.set_item("unrealized_pnl", p.unrealized_pnl)?;
            out.push(d.into());
        }
        Ok(out)
    }
}

fn parse_position_side(s: &str) -> Option<PositionSide> {
    match s.trim().to_ascii_uppercase().as_str() {
        "LONG" => Some(PositionSide::Long),
        "SHORT" => Some(PositionSide::Short),
        _ => None,
    }
}

#[pyfunction]
fn validate_dsl(source: String) -> PyResult<bool> {
    validate_dsl_core(&source)
        .map(|_| true)
        .map_err(|e| py_err(e.to_string()))
}

#[pymodule]
fn _hquant(m: &Bound<'_, PyModule>) -> PyResult<()> {
    m.add_class::<HQuant>()?;
    m.add_class::<MultiHQuant>()?;
    m.add_class::<PyBacktest>()?;
    m.add_class::<PyAggregator>()?;
    m.add_class::<PyDslStrategy>()?;
    m.add_class::<FuturesBacktest>()?;
    m.add_function(wrap_pyfunction!(validate_dsl, m)?)?;
    Ok(())
}
