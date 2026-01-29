//! Python FFI using PyO3

use pyo3::prelude::*;
use pyo3::exceptions::PyValueError;
use pyo3::types::{PyDict, PyList};
use std::sync::Mutex;

use crate::{
    Bar, QuantEngine, Side, IndicatorGraph,
    TimeFrame, MultiTimeFrameAggregator,
    BacktestEngine, BacktestConfig, BacktestStats, MarketType,
    MABuilder, RSIBuilder, MACDBuilder, ATRBuilder, BOLLBuilder, VRIBuilder,
    IndicatorBuilder,
    Strategy, RSIStrategy, MACrossStrategy, MACDStrategy, BollStrategy,
    dsl::{DslEngine, DslContext, LabeledVector},
};

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
        timestamp,
        open,
        high,
        low,
        close,
        volume,
        buy_volume,
    ))
}

fn parse_timeframe(tf: &str) -> PyResult<TimeFrame> {
    TimeFrame::from_str(tf).ok_or_else(|| PyValueError::new_err(format!("Unknown timeframe: {}", tf)))
}

/// High-performance quantitative trading engine
#[pyclass]
pub struct HQuant {
    engine: Mutex<QuantEngine>,
}

#[pymethods]
impl HQuant {
    #[new]
    #[pyo3(signature = (capacity=1000))]
    pub fn new(capacity: usize) -> PyResult<Self> {
        let engine = QuantEngine::new(capacity)
            .map_err(|e| PyValueError::new_err(e.to_string()))?;
        Ok(Self {
            engine: Mutex::new(engine),
        })
    }

    /// Add indicator from dict config
    /// Example: hquant.add_indicator("rsi", {"type": "rsi", "period": 14})
    pub fn add_indicator(&self, name: &str, config: &Bound<'_, PyDict>) -> PyResult<()> {
        let mut engine = self.engine.lock().map_err(|_| PyValueError::new_err("lock poisoned"))?;

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
                engine.add_indicator(name, builder)
                    .map_err(|e| PyValueError::new_err(e.to_string()))?;
            }
            "ema" => {
                let period: usize = config
                    .get_item("period")?
                    .map(|v| v.extract())
                    .transpose()?
                    .unwrap_or(20);
                let builder = MABuilder::new().period(period).ema();
                engine.add_indicator(name, builder)
                    .map_err(|e| PyValueError::new_err(e.to_string()))?;
            }
            "wma" => {
                let period: usize = config
                    .get_item("period")?
                    .map(|v| v.extract())
                    .transpose()?
                    .unwrap_or(20);
                let builder = MABuilder::new().period(period).wma();
                engine.add_indicator(name, builder)
                    .map_err(|e| PyValueError::new_err(e.to_string()))?;
            }
            "rsi" => {
                let period: usize = config
                    .get_item("period")?
                    .map(|v| v.extract())
                    .transpose()?
                    .unwrap_or(14);
                let builder = RSIBuilder::new().period(period);
                engine.add_indicator(name, builder)
                    .map_err(|e| PyValueError::new_err(e.to_string()))?;
            }
            "macd" => {
                let fast: usize = config.get_item("fast")?.map(|v| v.extract()).transpose()?.unwrap_or(12);
                let slow: usize = config.get_item("slow")?.map(|v| v.extract()).transpose()?.unwrap_or(26);
                let signal: usize = config.get_item("signal")?.map(|v| v.extract()).transpose()?.unwrap_or(9);
                let builder = MACDBuilder::new().fast(fast).slow(slow).signal(signal);
                engine.add_indicator(name, builder)
                    .map_err(|e| PyValueError::new_err(e.to_string()))?;
            }
            "atr" => {
                let period: usize = config.get_item("period")?.map(|v| v.extract()).transpose()?.unwrap_or(14);
                let builder = ATRBuilder::new().period(period);
                engine.add_indicator(name, builder)
                    .map_err(|e| PyValueError::new_err(e.to_string()))?;
            }
            "boll" | "bollinger" => {
                let period: usize = config.get_item("period")?.map(|v| v.extract()).transpose()?.unwrap_or(20);
                let std_dev: f64 = config.get_item("std_dev")?.map(|v| v.extract()).transpose()?.unwrap_or(2.0);
                let builder = BOLLBuilder::new().period(period).std_dev(std_dev);
                engine.add_indicator(name, builder)
                    .map_err(|e| PyValueError::new_err(e.to_string()))?;
            }
            "vri" => {
                let period: usize = config.get_item("period")?.map(|v| v.extract()).transpose()?.unwrap_or(14);
                let builder = VRIBuilder::new().period(period);
                engine.add_indicator(name, builder)
                    .map_err(|e| PyValueError::new_err(e.to_string()))?;
            }
            "vwap" => {
                engine.add_vwap(name).map_err(|e| PyValueError::new_err(e.to_string()))?;
            }
            "obv" => {
                engine.add_obv(name).map_err(|e| PyValueError::new_err(e.to_string()))?;
            }
            _ => {
                return Err(PyValueError::new_err(format!("Unknown indicator type: {}", ind_type)));
            }
        }

        Ok(())
    }

    /// Push K-line data
    pub fn push_kline<'py>(&self, py: Python<'py>, bar_dict: &Bound<'py, PyDict>) -> PyResult<Bound<'py, PyList>> {
        let mut engine = self.engine.lock().map_err(|_| PyValueError::new_err("lock poisoned"))?;
        let bar = to_bar(bar_dict)?;
        let signals = engine.append_bar(&bar);

        let list = PyList::empty_bound(py);
        for s in &signals {
            let dict = PyDict::new_bound(py);
            dict.set_item("side", match s.side {
                Side::Buy => "BUY",
                Side::Sell => "SELL",
                Side::Hold => "HOLD",
            })?;
            dict.set_item("strength", s.strength)?;
            dict.set_item("reason", &s.reason)?;
            dict.set_item("timestamp", s.timestamp)?;
            list.append(dict)?;
        }
        Ok(list)
    }

    /// Update last K-line
    pub fn update_last(&self, bar_dict: &Bound<'_, PyDict>) -> PyResult<()> {
        let mut engine = self.engine.lock().map_err(|_| PyValueError::new_err("lock poisoned"))?;
        let bar = to_bar(bar_dict)?;
        engine.update_last_bar(&bar);
        Ok(())
    }

    /// Get indicator value
    pub fn get_indicator(&self, name: &str) -> PyResult<Option<f64>> {
        let engine = self.engine.lock().map_err(|_| PyValueError::new_err("lock poisoned"))?;
        Ok(engine.indicator_value(name))
    }

    /// Check if indicator is ready
    pub fn is_ready(&self, name: &str) -> PyResult<bool> {
        let engine = self.engine.lock().map_err(|_| PyValueError::new_err("lock poisoned"))?;
        Ok(engine.indicator_ready(name))
    }

    /// Get indicator result with extra data
    pub fn get_indicator_result<'py>(&self, py: Python<'py>, name: &str) -> PyResult<Option<Bound<'py, PyDict>>> {
        let engine = self.engine.lock().map_err(|_| PyValueError::new_err("lock poisoned"))?;
        match engine.indicator_result(name) {
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
        let mut engine = self.engine.lock().map_err(|_| PyValueError::new_err("lock poisoned"))?;
        engine.reset();
        Ok(())
    }

    // -- Strategy methods --

    /// Add RSI strategy (buy when oversold, sell when overbought)
    #[pyo3(signature = (indicator_name, oversold=30.0, overbought=70.0))]
    pub fn add_rsi_strategy(&self, indicator_name: &str, oversold: f64, overbought: f64) -> PyResult<()> {
        let mut engine = self.engine.lock().map_err(|_| PyValueError::new_err("lock poisoned"))?;
        engine.add_strategy(Box::new(RSIStrategy::new(indicator_name, oversold, overbought)));
        Ok(())
    }

    /// Add MACD histogram crossover strategy
    pub fn add_macd_strategy(&self, indicator_name: &str) -> PyResult<()> {
        let mut engine = self.engine.lock().map_err(|_| PyValueError::new_err("lock poisoned"))?;
        engine.add_strategy(Box::new(MACDStrategy::new(indicator_name)));
        Ok(())
    }

    /// Add Bollinger Band breakout strategy
    pub fn add_boll_strategy(&self, indicator_name: &str) -> PyResult<()> {
        let mut engine = self.engine.lock().map_err(|_| PyValueError::new_err("lock poisoned"))?;
        engine.add_strategy(Box::new(BollStrategy::new(indicator_name)));
        Ok(())
    }

    /// Add MA crossover strategy (golden/death cross)
    pub fn add_ma_cross_strategy(&self, fast_ma: &str, slow_ma: &str) -> PyResult<()> {
        let mut engine = self.engine.lock().map_err(|_| PyValueError::new_err("lock poisoned"))?;
        engine.add_strategy(Box::new(MACrossStrategy::new(fast_ma, slow_ma)));
        Ok(())
    }

    // -- Backtest methods --

    /// Setup backtest engine
    /// Example: engine.setup_backtest(initial_capital=10000.0, market_type="spot")
    #[pyo3(signature = (initial_capital, market_type="spot", leverage=1.0, maker_fee=0.001, taker_fee=0.001, slippage=0.0005, position_size_pct=0.1))]
    pub fn setup_backtest(
        &self,
        initial_capital: f64,
        market_type: &str,
        leverage: f64,
        maker_fee: f64,
        taker_fee: f64,
        slippage: f64,
        position_size_pct: f64,
    ) -> PyResult<()> {
        let mut engine = self.engine.lock().map_err(|_| PyValueError::new_err("lock poisoned"))?;
        let mt = match market_type.to_lowercase().as_str() {
            "futures" => MarketType::Futures,
            _ => MarketType::Spot,
        };
        engine.setup_backtest(BacktestConfig {
            market_type: mt,
            initial_capital,
            leverage,
            maker_fee,
            taker_fee,
            slippage,
            position_size_pct,
        });
        Ok(())
    }

    /// Get backtest result
    pub fn backtest_result<'py>(&self, py: Python<'py>) -> PyResult<Option<Bound<'py, PyDict>>> {
        let mut engine = self.engine.lock().map_err(|_| PyValueError::new_err("lock poisoned"))?;
        match engine.backtest_result() {
            Some(stats) => Ok(Some(stats_to_py_dict(py, stats)?)),
            None => Ok(None),
        }
    }

    /// Get backtest trades
    pub fn backtest_trades<'py>(&self, py: Python<'py>) -> PyResult<Bound<'py, PyList>> {
        let engine = self.engine.lock().map_err(|_| PyValueError::new_err("lock poisoned"))?;
        let list = PyList::empty_bound(py);
        if let Some(trades) = engine.backtest_trades() {
            for t in trades {
                let dict = PyDict::new_bound(py);
                dict.set_item("timestamp", t.timestamp)?;
                dict.set_item("side", match t.side {
                    Side::Buy => "BUY",
                    Side::Sell => "SELL",
                    Side::Hold => "HOLD",
                })?;
                dict.set_item("price", t.price)?;
                dict.set_item("size", t.size)?;
                dict.set_item("fee", t.fee)?;
                dict.set_item("pnl", t.pnl)?;
                list.append(dict)?;
            }
        }
        Ok(list)
    }

    /// Get backtest equity curve
    pub fn backtest_equity_curve(&self) -> PyResult<Vec<f64>> {
        let engine = self.engine.lock().map_err(|_| PyValueError::new_err("lock poisoned"))?;
        Ok(engine.backtest_equity_curve().map(|c| c.to_vec()).unwrap_or_default())
    }
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

    /// Open long position
    pub fn open_long(&self, price: f64, size: f64) -> PyResult<()> {
        let mut engine = self.engine.lock().map_err(|_| PyValueError::new_err("lock poisoned"))?;
        engine.open_long(price, size);
        Ok(())
    }

    /// Open short position
    pub fn open_short(&self, price: f64, size: f64) -> PyResult<()> {
        let mut engine = self.engine.lock().map_err(|_| PyValueError::new_err("lock poisoned"))?;
        engine.open_short(price, size);
        Ok(())
    }

    /// Close current position
    pub fn close(&self, price: f64) -> PyResult<()> {
        let mut engine = self.engine.lock().map_err(|_| PyValueError::new_err("lock poisoned"))?;
        engine.close(price);
        Ok(())
    }

    /// Get backtest result
    pub fn backtest_result<'py>(&self, py: Python<'py>) -> PyResult<Bound<'py, PyDict>> {
        let mut engine = self.engine.lock().map_err(|_| PyValueError::new_err("lock poisoned"))?;
        stats_to_py_dict(py, engine.result())
    }

    /// Get equity
    pub fn get_equity(&self) -> PyResult<f64> {
        let engine = self.engine.lock().map_err(|_| PyValueError::new_err("lock poisoned"))?;
        Ok(engine.equity())
    }

    /// Get equity curve
    pub fn get_equity_curve(&self) -> PyResult<Vec<f64>> {
        let engine = self.engine.lock().map_err(|_| PyValueError::new_err("lock poisoned"))?;
        Ok(engine.equity_curve().to_vec())
    }

    /// Reset backtest
    pub fn reset(&self) -> PyResult<()> {
        let mut engine = self.engine.lock().map_err(|_| PyValueError::new_err("lock poisoned"))?;
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
    pub fn push_kline<'py>(&self, py: Python<'py>, bar_dict: &Bound<'py, PyDict>) -> PyResult<Bound<'py, PyList>> {
        let mut agg = self.inner.lock().map_err(|_| PyValueError::new_err("lock poisoned"))?;
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
        let mut agg = self.inner.lock().map_err(|_| PyValueError::new_err("lock poisoned"))?;
        agg.flush_all();
        Ok(())
    }

    /// Reset aggregator
    pub fn reset(&self) -> PyResult<()> {
        let mut agg = self.inner.lock().map_err(|_| PyValueError::new_err("lock poisoned"))?;
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
        let engine = DslEngine::new(source)
            .map_err(|e| PyValueError::new_err(e.to_string()))?;
        Ok(Self {
            inner: Mutex::new(engine),
        })
    }

    /// Load labeled vectors into a named store for similarity matching
    pub fn load_store(&self, name: &str, vectors: &Bound<'_, PyList>) -> PyResult<()> {
        let mut engine = self.inner.lock().map_err(|_| PyValueError::new_err("lock poisoned"))?;

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
        let mut engine = self.inner.lock().map_err(|_| PyValueError::new_err("lock poisoned"))?;
        engine.set_threshold(threshold);
        Ok(())
    }

    /// Evaluate strategy with given bar data
    pub fn evaluate<'py>(&self, py: Python<'py>, bar_dict: &Bound<'py, PyDict>) -> PyResult<Bound<'py, PyList>> {
        let mut engine = self.inner.lock().map_err(|_| PyValueError::new_err("lock poisoned"))?;
        let bar = to_bar(bar_dict)?;

        let empty_graph = IndicatorGraph::new();
        let ctx = DslContext::new(&bar, &empty_graph);

        let signals = engine.evaluate(&ctx)
            .map_err(|e| PyValueError::new_err(e.to_string()))?;

        let list = PyList::empty_bound(py);
        for s in &signals {
            let dict = PyDict::new_bound(py);
            dict.set_item("side", match s.side {
                Side::Buy => "BUY",
                Side::Sell => "SELL",
                Side::Hold => "HOLD",
            })?;
            dict.set_item("strength", s.strength)?;
            dict.set_item("reason", &s.reason)?;
            dict.set_item("timestamp", s.timestamp)?;
            list.append(dict)?;
        }
        Ok(list)
    }

    /// Reset strategy state
    pub fn reset(&self) -> PyResult<()> {
        let mut engine = self.inner.lock().map_err(|_| PyValueError::new_err("lock poisoned"))?;
        engine.reset();
        Ok(())
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
    m.add_function(wrap_pyfunction!(validate_dsl, m)?)?;
    Ok(())
}
