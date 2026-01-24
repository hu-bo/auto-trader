use std::sync::Mutex;

use pyo3::prelude::*;
use pyo3::exceptions::PyValueError;

use hquant::{
    Bar, QuantEngine, Signal, Side,
    MABuilder, RSIBuilder, MACDBuilder, ATRBuilder, BOLLBuilder, VRIBuilder,
    BacktestEngine, BacktestConfig, BacktestStats, MarketType, Position, PositionSide, Trade,
    TimeFrame, Aggregator, MultiTimeFrameAggregator,
};

// ============================================================================
// Helper functions
// ============================================================================

fn to_bar(bar: &PyBar) -> Bar {
    Bar {
        timestamp: bar.timestamp,
        open: bar.open,
        high: bar.high,
        low: bar.low,
        close: bar.close,
        volume: bar.volume,
    }
}

fn from_bar(bar: &Bar) -> PyBar {
    PyBar {
        timestamp: bar.timestamp,
        open: bar.open,
        high: bar.high,
        low: bar.low,
        close: bar.close,
        volume: bar.volume,
    }
}

fn signal_to_py(signal: &Signal) -> PySignal {
    PySignal {
        side: match signal.side {
            Side::Buy => "BUY".to_string(),
            Side::Sell => "SELL".to_string(),
            Side::Hold => "HOLD".to_string(),
        },
        strength: signal.strength,
        reason: signal.reason.clone(),
        timestamp: signal.timestamp,
    }
}

fn parse_timeframe(tf: &str) -> PyResult<TimeFrame> {
    match tf.to_uppercase().as_str() {
        "M1" | "1M" => Ok(TimeFrame::M1),
        "M5" | "5M" => Ok(TimeFrame::M5),
        "M15" | "15M" => Ok(TimeFrame::M15),
        "M30" | "30M" => Ok(TimeFrame::M30),
        "H1" | "1H" => Ok(TimeFrame::H1),
        "H4" | "4H" => Ok(TimeFrame::H4),
        "D1" | "1D" => Ok(TimeFrame::D1),
        "W1" | "1W" => Ok(TimeFrame::W1),
        _ => Err(PyValueError::new_err(format!("Invalid timeframe: {}", tf))),
    }
}

fn timeframe_to_str(tf: &TimeFrame) -> String {
    match tf {
        TimeFrame::M1 => "M1".to_string(),
        TimeFrame::M5 => "M5".to_string(),
        TimeFrame::M15 => "M15".to_string(),
        TimeFrame::M30 => "M30".to_string(),
        TimeFrame::H1 => "H1".to_string(),
        TimeFrame::H4 => "H4".to_string(),
        TimeFrame::D1 => "D1".to_string(),
        TimeFrame::W1 => "W1".to_string(),
    }
}

// ============================================================================
// Data Structures
// ============================================================================

/// K-line (candlestick) bar data
#[pyclass]
#[derive(Clone)]
pub struct PyBar {
    #[pyo3(get, set)]
    pub timestamp: i64,
    #[pyo3(get, set)]
    pub open: f64,
    #[pyo3(get, set)]
    pub high: f64,
    #[pyo3(get, set)]
    pub low: f64,
    #[pyo3(get, set)]
    pub close: f64,
    #[pyo3(get, set)]
    pub volume: f64,
}

#[pymethods]
impl PyBar {
    #[new]
    pub fn new(timestamp: i64, open: f64, high: f64, low: f64, close: f64, volume: f64) -> Self {
        Self { timestamp, open, high, low, close, volume }
    }

    fn __repr__(&self) -> String {
        format!(
            "Bar(ts={}, o={:.4}, h={:.4}, l={:.4}, c={:.4}, v={:.2})",
            self.timestamp, self.open, self.high, self.low, self.close, self.volume
        )
    }
}

/// Trading signal output
#[pyclass]
#[derive(Clone)]
pub struct PySignal {
    #[pyo3(get)]
    pub side: String,
    #[pyo3(get)]
    pub strength: f64,
    #[pyo3(get)]
    pub reason: String,
    #[pyo3(get)]
    pub timestamp: i64,
}

#[pymethods]
impl PySignal {
    fn __repr__(&self) -> String {
        format!(
            "Signal(side={}, strength={:.2}, reason='{}', ts={})",
            self.side, self.strength, self.reason, self.timestamp
        )
    }

    #[getter]
    fn is_buy(&self) -> bool {
        self.side == "BUY"
    }

    #[getter]
    fn is_sell(&self) -> bool {
        self.side == "SELL"
    }

    #[getter]
    fn is_hold(&self) -> bool {
        self.side == "HOLD"
    }
}

/// Indicator result with optional extra data
#[pyclass]
#[derive(Clone)]
pub struct PyIndicatorValue {
    #[pyo3(get)]
    pub value: f64,
    #[pyo3(get)]
    pub timestamp: i64,
    #[pyo3(get)]
    pub extra: Option<Vec<f64>>,
}

#[pymethods]
impl PyIndicatorValue {
    fn __repr__(&self) -> String {
        match &self.extra {
            Some(e) => format!("IndicatorValue(value={:.4}, extra={:?})", self.value, e),
            None => format!("IndicatorValue(value={:.4})", self.value),
        }
    }
}

// ============================================================================
// Indicator Builders
// ============================================================================

/// Moving Average indicator builder
#[pyclass]
#[derive(Clone)]
pub struct PyMABuilder {
    inner: MABuilder,
}

#[pymethods]
impl PyMABuilder {
    #[new]
    pub fn new() -> Self {
        Self { inner: MABuilder::new() }
    }

    /// Set the period
    pub fn period(&self, period: usize) -> Self {
        Self { inner: self.inner.clone().period(period) }
    }

    /// Use Simple Moving Average
    pub fn sma(&self) -> Self {
        Self { inner: self.inner.clone().sma() }
    }

    /// Use Exponential Moving Average
    pub fn ema(&self) -> Self {
        Self { inner: self.inner.clone().ema() }
    }

    /// Use Weighted Moving Average
    pub fn wma(&self) -> Self {
        Self { inner: self.inner.clone().wma() }
    }
}

/// RSI indicator builder
#[pyclass]
#[derive(Clone)]
pub struct PyRSIBuilder {
    inner: RSIBuilder,
}

#[pymethods]
impl PyRSIBuilder {
    #[new]
    pub fn new() -> Self {
        Self { inner: RSIBuilder::new() }
    }

    /// Set the period (default: 14)
    pub fn period(&self, period: usize) -> Self {
        Self { inner: self.inner.clone().period(period) }
    }
}

/// MACD indicator builder
#[pyclass]
#[derive(Clone)]
pub struct PyMACDBuilder {
    inner: MACDBuilder,
}

#[pymethods]
impl PyMACDBuilder {
    #[new]
    pub fn new() -> Self {
        Self { inner: MACDBuilder::new() }
    }

    /// Set fast period (default: 12)
    pub fn fast(&self, period: usize) -> Self {
        Self { inner: self.inner.clone().fast(period) }
    }

    /// Set slow period (default: 26)
    pub fn slow(&self, period: usize) -> Self {
        Self { inner: self.inner.clone().slow(period) }
    }

    /// Set signal period (default: 9)
    pub fn signal(&self, period: usize) -> Self {
        Self { inner: self.inner.clone().signal(period) }
    }
}

/// ATR indicator builder
#[pyclass]
#[derive(Clone)]
pub struct PyATRBuilder {
    inner: ATRBuilder,
}

#[pymethods]
impl PyATRBuilder {
    #[new]
    pub fn new() -> Self {
        Self { inner: ATRBuilder::new() }
    }

    /// Set the period (default: 14)
    pub fn period(&self, period: usize) -> Self {
        Self { inner: self.inner.clone().period(period) }
    }
}

/// Bollinger Bands indicator builder
#[pyclass]
#[derive(Clone)]
pub struct PyBOLLBuilder {
    inner: BOLLBuilder,
}

#[pymethods]
impl PyBOLLBuilder {
    #[new]
    pub fn new() -> Self {
        Self { inner: BOLLBuilder::new() }
    }

    /// Set the period (default: 20)
    pub fn period(&self, period: usize) -> Self {
        Self { inner: self.inner.clone().period(period) }
    }

    /// Set the standard deviation factor (default: 2.0)
    pub fn std_dev(&self, factor: f64) -> Self {
        Self { inner: self.inner.clone().std_dev(factor) }
    }
}

/// VRI (Volume Relative Index) indicator builder
#[pyclass]
#[derive(Clone)]
pub struct PyVRIBuilder {
    inner: VRIBuilder,
}

#[pymethods]
impl PyVRIBuilder {
    #[new]
    pub fn new() -> Self {
        Self { inner: VRIBuilder::new() }
    }

    /// Set the period (default: 14)
    pub fn period(&self, period: usize) -> Self {
        Self { inner: self.inner.clone().period(period) }
    }
}

// ============================================================================
// Backtest Types
// ============================================================================

/// Backtest configuration
#[pyclass]
#[derive(Clone)]
pub struct PyBacktestConfig {
    #[pyo3(get, set)]
    pub market_type: String,
    #[pyo3(get, set)]
    pub initial_capital: f64,
    #[pyo3(get, set)]
    pub leverage: f64,
    #[pyo3(get, set)]
    pub maker_fee: f64,
    #[pyo3(get, set)]
    pub taker_fee: f64,
    #[pyo3(get, set)]
    pub slippage: f64,
    #[pyo3(get, set)]
    pub position_size_pct: f64,
}

#[pymethods]
impl PyBacktestConfig {
    #[new]
    #[pyo3(signature = (initial_capital=10000.0, market_type="spot", leverage=1.0, maker_fee=0.001, taker_fee=0.001, slippage=0.0005, position_size_pct=0.1))]
    pub fn new(
        initial_capital: f64,
        market_type: &str,
        leverage: f64,
        maker_fee: f64,
        taker_fee: f64,
        slippage: f64,
        position_size_pct: f64,
    ) -> Self {
        Self {
            market_type: market_type.to_uppercase(),
            initial_capital,
            leverage,
            maker_fee,
            taker_fee,
            slippage,
            position_size_pct,
        }
    }

    /// Create a spot market config
    #[staticmethod]
    pub fn spot(initial_capital: f64) -> Self {
        Self {
            market_type: "SPOT".to_string(),
            initial_capital,
            leverage: 1.0,
            maker_fee: 0.001,
            taker_fee: 0.001,
            slippage: 0.0005,
            position_size_pct: 0.1,
        }
    }

    /// Create a futures market config
    #[staticmethod]
    pub fn futures(initial_capital: f64, leverage: f64) -> Self {
        Self {
            market_type: "FUTURES".to_string(),
            initial_capital,
            leverage,
            maker_fee: 0.0002,
            taker_fee: 0.0004,
            slippage: 0.0005,
            position_size_pct: 0.1,
        }
    }
}

impl PyBacktestConfig {
    fn to_rust(&self) -> BacktestConfig {
        let market_type = match self.market_type.as_str() {
            "FUTURES" => MarketType::Futures,
            _ => MarketType::Spot,
        };
        BacktestConfig {
            market_type,
            initial_capital: self.initial_capital,
            leverage: self.leverage,
            maker_fee: self.maker_fee,
            taker_fee: self.taker_fee,
            slippage: self.slippage,
            position_size_pct: self.position_size_pct,
        }
    }
}

/// Backtest statistics result
#[pyclass]
#[derive(Clone)]
pub struct PyBacktestStats {
    #[pyo3(get)]
    pub total_trades: usize,
    #[pyo3(get)]
    pub winning_trades: usize,
    #[pyo3(get)]
    pub losing_trades: usize,
    #[pyo3(get)]
    pub total_pnl: f64,
    #[pyo3(get)]
    pub max_drawdown: f64,
    #[pyo3(get)]
    pub max_drawdown_pct: f64,
    #[pyo3(get)]
    pub sharpe_ratio: f64,
    #[pyo3(get)]
    pub win_rate: f64,
    #[pyo3(get)]
    pub profit_factor: f64,
    #[pyo3(get)]
    pub final_equity: f64,
    #[pyo3(get)]
    pub return_pct: f64,
    #[pyo3(get)]
    pub liquidations: usize,
}

impl From<&BacktestStats> for PyBacktestStats {
    fn from(stats: &BacktestStats) -> Self {
        Self {
            total_trades: stats.total_trades,
            winning_trades: stats.winning_trades,
            losing_trades: stats.losing_trades,
            total_pnl: stats.total_pnl,
            max_drawdown: stats.max_drawdown,
            max_drawdown_pct: stats.max_drawdown_pct,
            sharpe_ratio: stats.sharpe_ratio,
            win_rate: stats.win_rate,
            profit_factor: stats.profit_factor,
            final_equity: stats.final_equity,
            return_pct: stats.return_pct,
            liquidations: stats.liquidations,
        }
    }
}

#[pymethods]
impl PyBacktestStats {
    fn __repr__(&self) -> String {
        format!(
            "BacktestStats(trades={}, win_rate={:.2}%, pnl={:.2}, sharpe={:.2}, max_dd={:.2}%)",
            self.total_trades,
            self.win_rate * 100.0,
            self.total_pnl,
            self.sharpe_ratio,
            self.max_drawdown_pct * 100.0
        )
    }
}

/// Trade record
#[pyclass]
#[derive(Clone)]
pub struct PyTrade {
    #[pyo3(get)]
    pub timestamp: i64,
    #[pyo3(get)]
    pub side: String,
    #[pyo3(get)]
    pub price: f64,
    #[pyo3(get)]
    pub size: f64,
    #[pyo3(get)]
    pub fee: f64,
    #[pyo3(get)]
    pub pnl: f64,
}

impl From<&Trade> for PyTrade {
    fn from(trade: &Trade) -> Self {
        Self {
            timestamp: trade.timestamp,
            side: match trade.side {
                Side::Buy => "BUY".to_string(),
                Side::Sell => "SELL".to_string(),
                Side::Hold => "HOLD".to_string(),
            },
            price: trade.price,
            size: trade.size,
            fee: trade.fee,
            pnl: trade.pnl,
        }
    }
}

#[pymethods]
impl PyTrade {
    fn __repr__(&self) -> String {
        format!(
            "Trade(ts={}, side={}, price={:.4}, size={:.4}, pnl={:.4})",
            self.timestamp, self.side, self.price, self.size, self.pnl
        )
    }
}

/// Current position
#[pyclass]
#[derive(Clone)]
pub struct PyPosition {
    #[pyo3(get)]
    pub side: String,
    #[pyo3(get)]
    pub size: f64,
    #[pyo3(get)]
    pub entry_price: f64,
    #[pyo3(get)]
    pub leverage: f64,
    #[pyo3(get)]
    pub liquidation_price: f64,
    #[pyo3(get)]
    pub unrealized_pnl: f64,
    #[pyo3(get)]
    pub timestamp: i64,
}

impl From<&Position> for PyPosition {
    fn from(pos: &Position) -> Self {
        Self {
            side: match pos.side {
                PositionSide::Long => "LONG".to_string(),
                PositionSide::Short => "SHORT".to_string(),
            },
            size: pos.size,
            entry_price: pos.entry_price,
            leverage: pos.leverage,
            liquidation_price: pos.liquidation_price,
            unrealized_pnl: pos.unrealized_pnl,
            timestamp: pos.timestamp,
        }
    }
}

#[pymethods]
impl PyPosition {
    fn __repr__(&self) -> String {
        format!(
            "Position(side={}, size={:.4}, entry={:.4}, pnl={:.4})",
            self.side, self.size, self.entry_price, self.unrealized_pnl
        )
    }
}

// ============================================================================
// Multi-TimeFrame Aggregator
// ============================================================================

/// K-line aggregator for a single target timeframe
#[pyclass]
pub struct PyAggregator {
    inner: Mutex<Aggregator>,
}

#[pymethods]
impl PyAggregator {
    #[new]
    pub fn new(source_tf: &str, target_tf: &str, capacity: usize) -> PyResult<Self> {
        let src = parse_timeframe(source_tf)?;
        let tgt = parse_timeframe(target_tf)?;
        Ok(Self {
            inner: Mutex::new(Aggregator::new(src, tgt, capacity)),
        })
    }

    /// Push a bar, returns True if a target bar was completed
    pub fn push(&self, bar: &PyBar) -> bool {
        let mut agg = self.inner.lock().unwrap();
        agg.push(&to_bar(bar))
    }

    /// Update the last bar (for real-time updates)
    pub fn update_last(&self, bar: &PyBar) {
        let mut agg = self.inner.lock().unwrap();
        agg.update_last(&to_bar(bar));
    }

    /// Get the current incomplete bar
    pub fn current(&self) -> Option<PyBar> {
        let agg = self.inner.lock().unwrap();
        agg.current().map(from_bar)
    }

    /// Get completed bars as a list
    pub fn output(&self) -> Vec<PyBar> {
        let agg = self.inner.lock().unwrap();
        agg.output().iter().map(|b| from_bar(&b)).collect()
    }

    /// Force completion of current bar
    pub fn flush(&self) -> Option<PyBar> {
        let mut agg = self.inner.lock().unwrap();
        agg.flush().map(|b| from_bar(&b))
    }
}

/// Multi-timeframe K-line aggregator
#[pyclass]
pub struct PyMultiTimeFrameAggregator {
    inner: Mutex<MultiTimeFrameAggregator>,
}

#[pymethods]
impl PyMultiTimeFrameAggregator {
    #[new]
    pub fn new(base_tf: &str, target_tfs: Vec<String>, capacity: usize) -> PyResult<Self> {
        let base = parse_timeframe(base_tf)?;
        let targets: Result<Vec<TimeFrame>, _> = target_tfs.iter().map(|s| parse_timeframe(s)).collect();
        let targets = targets?;
        Ok(Self {
            inner: Mutex::new(MultiTimeFrameAggregator::new(base, &targets, capacity)),
        })
    }

    /// Push a bar, returns list of completed timeframes
    pub fn push(&self, bar: &PyBar) -> Vec<String> {
        let mut agg = self.inner.lock().unwrap();
        agg.push(&to_bar(bar))
            .into_iter()
            .map(|tf| timeframe_to_str(&tf))
            .collect()
    }

    /// Get output bars for a specific timeframe
    pub fn output(&self, tf: &str) -> PyResult<Vec<PyBar>> {
        let tf = parse_timeframe(tf)?;
        let agg = self.inner.lock().unwrap();
        Ok(agg.output(tf)
            .map(|ks| ks.iter().map(|b| from_bar(&b)).collect())
            .unwrap_or_default())
    }

    /// Get current incomplete bar for a specific timeframe
    pub fn current(&self, tf: &str) -> PyResult<Option<PyBar>> {
        let tf = parse_timeframe(tf)?;
        let agg = self.inner.lock().unwrap();
        Ok(agg.current(tf).map(from_bar))
    }
}

// ============================================================================
// Indicators Factory
// ============================================================================

/// Indicators factory for creating indicator builders
#[pyclass]
pub struct PyIndicators;

#[pymethods]
impl PyIndicators {
    #[new]
    pub fn new() -> Self {
        Self
    }

    /// Create MA indicator builder
    pub fn ma(&self) -> PyMABuilder {
        PyMABuilder::new()
    }

    /// Create RSI indicator builder
    pub fn rsi(&self) -> PyRSIBuilder {
        PyRSIBuilder::new()
    }

    /// Create MACD indicator builder
    pub fn macd(&self) -> PyMACDBuilder {
        PyMACDBuilder::new()
    }

    /// Create ATR indicator builder
    pub fn atr(&self) -> PyATRBuilder {
        PyATRBuilder::new()
    }

    /// Create Bollinger Bands indicator builder
    pub fn boll(&self) -> PyBOLLBuilder {
        PyBOLLBuilder::new()
    }

    /// Create VRI indicator builder
    pub fn vri(&self) -> PyVRIBuilder {
        PyVRIBuilder::new()
    }
}

// ============================================================================
// Main Quant Engine
// ============================================================================

/// Main quantitative trading engine
#[pyclass]
pub struct PyQuantEngine {
    inner: Mutex<QuantEngine>,
}

#[pymethods]
impl PyQuantEngine {
    #[new]
    pub fn new(capacity: usize) -> Self {
        Self {
            inner: Mutex::new(QuantEngine::new(capacity)),
        }
    }

    // ---- Indicator Management ----

    /// Add MA indicator (unified method)
    pub fn add_ma_indicator(&self, name: String, indicator: &PyMABuilder) {
        let mut engine = self.inner.lock().unwrap();
        engine.add_indicator(name, indicator.inner.clone());
    }

    /// Add RSI indicator (unified method)
    pub fn add_rsi_indicator(&self, name: String, indicator: &PyRSIBuilder) {
        let mut engine = self.inner.lock().unwrap();
        engine.add_indicator(name, indicator.inner.clone());
    }

    /// Add MACD indicator (unified method)
    pub fn add_macd_indicator(&self, name: String, indicator: &PyMACDBuilder) {
        let mut engine = self.inner.lock().unwrap();
        engine.add_indicator(name, indicator.inner.clone());
    }

    /// Add ATR indicator (unified method)
    pub fn add_atr_indicator(&self, name: String, indicator: &PyATRBuilder) {
        let mut engine = self.inner.lock().unwrap();
        engine.add_indicator(name, indicator.inner.clone());
    }

    /// Add Bollinger Bands indicator (unified method)
    pub fn add_boll_indicator(&self, name: String, indicator: &PyBOLLBuilder) {
        let mut engine = self.inner.lock().unwrap();
        engine.add_indicator(name, indicator.inner.clone());
    }

    /// Add VRI indicator (unified method)
    pub fn add_vri_indicator(&self, name: String, indicator: &PyVRIBuilder) {
        let mut engine = self.inner.lock().unwrap();
        engine.add_indicator(name, indicator.inner.clone());
    }

    /// Add VWAP indicator
    pub fn add_vwap_indicator(&self, name: String) {
        let mut engine = self.inner.lock().unwrap();
        engine.add_vwap(name);
    }

    /// Add OBV indicator
    pub fn add_obv_indicator(&self, name: String) {
        let mut engine = self.inner.lock().unwrap();
        engine.add_obv(name);
    }

    /// Add MFI indicator
    pub fn add_mfi_indicator(&self, name: String, period: usize) {
        let mut engine = self.inner.lock().unwrap();
        engine.add_mfi(name, period);
    }

    /// Add Williams %R indicator
    pub fn add_williams_r_indicator(&self, name: String, period: usize) {
        let mut engine = self.inner.lock().unwrap();
        engine.add_williams_r(name, period);
    }

    /// Add CCI indicator
    pub fn add_cci_indicator(&self, name: String, period: usize) {
        let mut engine = self.inner.lock().unwrap();
        engine.add_cci(name, period);
    }

    /// Add ROC indicator
    pub fn add_roc_indicator(&self, name: String, period: usize) {
        let mut engine = self.inner.lock().unwrap();
        engine.add_roc(name, period);
    }

    // ---- Multi-TimeFrame Aggregation ----

    /// Setup multi-timeframe aggregation
    pub fn setup_aggregator(&self, base_tf: &str, target_tfs: Vec<String>, capacity: usize) -> PyResult<()> {
        let base = parse_timeframe(base_tf)?;
        let targets: Result<Vec<TimeFrame>, _> = target_tfs.iter().map(|s| parse_timeframe(s)).collect();
        let targets = targets?;
        let mut engine = self.inner.lock().unwrap();
        engine.setup_aggregator(base, &targets, capacity);
        Ok(())
    }

    // ---- Backtesting ----

    /// Setup backtesting with config
    pub fn setup_backtest(&self, config: &PyBacktestConfig) {
        let mut engine = self.inner.lock().unwrap();
        engine.setup_backtest(config.to_rust());
    }

    /// Get backtest statistics
    pub fn backtest_result(&self) -> Option<PyBacktestStats> {
        let mut engine = self.inner.lock().unwrap();
        engine.backtest_result().map(|s| PyBacktestStats::from(s))
    }

    /// Get all trades from backtest
    pub fn backtest_trades(&self) -> Vec<PyTrade> {
        let engine = self.inner.lock().unwrap();
        engine.backtest_trades()
            .map(|trades| trades.iter().map(PyTrade::from).collect())
            .unwrap_or_default()
    }

    /// Get equity curve from backtest
    pub fn backtest_equity_curve(&self) -> Vec<f64> {
        let engine = self.inner.lock().unwrap();
        engine.backtest_equity_curve()
            .map(|curve| curve.to_vec())
            .unwrap_or_default()
    }

    // ---- Data Processing ----

    /// Append a new bar, returns generated signals
    pub fn append_bar(&self, bar: &PyBar) -> Vec<PySignal> {
        let mut engine = self.inner.lock().unwrap();
        engine.append_bar(&to_bar(bar))
            .iter()
            .map(signal_to_py)
            .collect()
    }

    /// Update the last bar (for real-time updates)
    pub fn update_last_bar(&self, bar: &PyBar) {
        let mut engine = self.inner.lock().unwrap();
        engine.update_last_bar(&to_bar(bar));
    }

    /// Load historical bars
    pub fn load_history(&self, bars: Vec<PyBar>) -> Vec<PySignal> {
        let mut engine = self.inner.lock().unwrap();
        let rust_bars: Vec<Bar> = bars.iter().map(to_bar).collect();
        engine.load_history(&rust_bars)
            .iter()
            .map(signal_to_py)
            .collect()
    }

    // ---- Indicator Access ----

    /// Get current indicator value
    pub fn indicator_value(&self, name: &str) -> Option<f64> {
        let engine = self.inner.lock().unwrap();
        engine.indicator_value(name)
    }

    /// Get full indicator result with extra data
    pub fn indicator_result(&self, name: &str) -> Option<PyIndicatorValue> {
        let engine = self.inner.lock().unwrap();
        engine.indicator_result(name).map(|iv| PyIndicatorValue {
            value: iv.value,
            timestamp: iv.timestamp,
            extra: iv.extra.clone(),
        })
    }

    /// Check if indicator has enough data
    pub fn indicator_ready(&self, name: &str) -> bool {
        let engine = self.inner.lock().unwrap();
        engine.indicator_ready(name)
    }

    /// Get number of bars in the engine
    pub fn len(&self) -> usize {
        let engine = self.inner.lock().unwrap();
        engine.klines().len()
    }

    /// Check if the engine is empty
    pub fn is_empty(&self) -> bool {
        let engine = self.inner.lock().unwrap();
        engine.klines().is_empty()
    }

    /// Get the last bar
    pub fn last_bar(&self) -> Option<PyBar> {
        let engine = self.inner.lock().unwrap();
        engine.last_bar().map(|b| from_bar(&b))
    }

    // ---- Management ----

    /// Reset the engine
    pub fn reset(&self) {
        let mut engine = self.inner.lock().unwrap();
        engine.reset();
    }
}

// ============================================================================
// Standalone Backtest Engine
// ============================================================================

/// Standalone backtest engine for custom strategy execution
#[pyclass]
pub struct PyBacktestEngine {
    inner: Mutex<BacktestEngine>,
}

#[pymethods]
impl PyBacktestEngine {
    #[new]
    pub fn new(config: &PyBacktestConfig) -> Self {
        Self {
            inner: Mutex::new(BacktestEngine::new(config.to_rust())),
        }
    }

    /// Process a signal with current bar
    pub fn process_signal(&self, side: &str, strength: f64, bar: &PyBar) {
        let signal_side = match side.to_uppercase().as_str() {
            "BUY" => Side::Buy,
            "SELL" => Side::Sell,
            _ => Side::Hold,
        };
        let signal = Signal {
            side: signal_side,
            strength,
            reason: String::new(),
            timestamp: bar.timestamp,
        };
        let mut engine = self.inner.lock().unwrap();
        engine.process_signal(&signal, &to_bar(bar));
    }

    /// Get current position
    pub fn position(&self) -> Option<PyPosition> {
        let engine = self.inner.lock().unwrap();
        engine.position().map(PyPosition::from)
    }

    /// Get current equity
    pub fn equity(&self) -> f64 {
        let engine = self.inner.lock().unwrap();
        engine.equity()
    }

    /// Get backtest result
    pub fn result(&self) -> PyBacktestStats {
        let mut engine = self.inner.lock().unwrap();
        PyBacktestStats::from(engine.result())
    }

    /// Get all trades
    pub fn trades(&self) -> Vec<PyTrade> {
        let engine = self.inner.lock().unwrap();
        engine.trades().iter().map(PyTrade::from).collect()
    }

    /// Get equity curve
    pub fn equity_curve(&self) -> Vec<f64> {
        let engine = self.inner.lock().unwrap();
        engine.equity_curve().to_vec()
    }

    /// Reset the engine
    pub fn reset(&self) {
        let mut engine = self.inner.lock().unwrap();
        engine.reset();
    }
}

// ============================================================================
// Python Module
// ============================================================================

#[pymodule]
fn _hquant(_py: Python<'_>, m: &Bound<'_, PyModule>) -> PyResult<()> {
    // Data structures
    m.add_class::<PyBar>()?;
    m.add_class::<PySignal>()?;
    m.add_class::<PyIndicatorValue>()?;

    // Indicator builders
    m.add_class::<PyMABuilder>()?;
    m.add_class::<PyRSIBuilder>()?;
    m.add_class::<PyMACDBuilder>()?;
    m.add_class::<PyATRBuilder>()?;
    m.add_class::<PyBOLLBuilder>()?;
    m.add_class::<PyVRIBuilder>()?;

    // Indicators factory
    m.add_class::<PyIndicators>()?;

    // Backtest types
    m.add_class::<PyBacktestConfig>()?;
    m.add_class::<PyBacktestStats>()?;
    m.add_class::<PyTrade>()?;
    m.add_class::<PyPosition>()?;

    // Aggregators
    m.add_class::<PyAggregator>()?;
    m.add_class::<PyMultiTimeFrameAggregator>()?;

    // Engines
    m.add_class::<PyQuantEngine>()?;
    m.add_class::<PyBacktestEngine>()?;

    Ok(())
}
