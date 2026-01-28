//! Node.js FFI using napi-rs

use std::sync::Mutex;

use napi::bindgen_prelude::*;
use napi_derive::napi;

use crate::{
    Bar, QuantEngine, Signal, Side,
    TimeFrame, Aggregator, MultiTimeFrameAggregator,
    BacktestEngine, BacktestConfig, BacktestStats, MarketType, Position, PositionSide, Trade,
    MABuilder, RSIBuilder, MACDBuilder, ATRBuilder, BOLLBuilder, VRIBuilder,
    dsl::{DslEngine, DslContext, VectorStore, LabeledVector},
};

fn lock_poisoned_error() -> Error {
    Error::from_reason("lock poisoned".to_string())
}

fn to_bar(input: &BarInput) -> Bar {
    Bar {
        timestamp: input.timestamp,
        open: input.open,
        high: input.high,
        low: input.low,
        close: input.close,
        volume: input.volume,
        buy_volume: input.buy_volume.unwrap_or(0.0),
    }
}

fn parse_timeframe(tf: &str) -> napi::Result<TimeFrame> {
    TimeFrame::from_str(tf).ok_or_else(|| Error::from_reason(format!("Unknown timeframe: {}", tf)))
}

fn timeframe_to_string(tf: TimeFrame) -> String {
    tf.as_str().to_string()
}

fn signal_to_output(signal: &Signal) -> SignalOutput {
    SignalOutput {
        side: match signal.side {
            Side::Buy => "BUY",
            Side::Sell => "SELL",
            Side::Hold => "HOLD",
        }
        .to_string(),
        strength: signal.strength,
        reason: signal.reason.clone(),
        timestamp: signal.timestamp,
    }
}

// ============================================================================
// Basic Types
// ============================================================================

#[napi(object)]
pub struct BarInput {
    pub timestamp: i64,
    pub open: f64,
    pub high: f64,
    pub low: f64,
    pub close: f64,
    pub volume: f64,
    pub buy_volume: Option<f64>,
}

#[napi(object)]
pub struct SignalOutput {
    pub side: String,
    pub strength: f64,
    pub reason: String,
    pub timestamp: i64,
}

#[napi(object)]
pub struct IndicatorResultOutput {
    pub value: f64,
    pub timestamp: i64,
    pub extra: Option<Vec<f64>>,
}

#[napi(object)]
pub struct BacktestStatsOutput {
    pub total_trades: u32,
    pub winning_trades: u32,
    pub losing_trades: u32,
    pub total_pnl: f64,
    pub max_drawdown: f64,
    pub max_drawdown_pct: f64,
    pub sharpe_ratio: f64,
    pub win_rate: f64,
    pub final_equity: f64,
    pub return_pct: f64,
    pub liquidations: u32,
}

#[napi(object)]
pub struct TradeOutput {
    pub timestamp: i64,
    pub side: String,
    pub price: f64,
    pub size: f64,
    pub fee: f64,
    pub pnl: f64,
}

// ============================================================================
// Indicator Builders
// ============================================================================

/// MA Indicator Builder
#[napi]
pub struct MAIndicator {
    inner: MABuilder,
}

#[napi]
impl MAIndicator {
    #[napi(constructor)]
    pub fn new() -> Self {
        Self {
            inner: MABuilder::new(),
        }
    }

    /// Set period (default: 20)
    #[napi]
    pub fn period(&mut self, period: u32) -> &Self {
        self.inner = std::mem::take(&mut self.inner).period(period as usize);
        self
    }

    /// Set to SMA (Simple Moving Average)
    #[napi]
    pub fn sma(&mut self) -> &Self {
        self.inner = std::mem::take(&mut self.inner).sma();
        self
    }

    /// Set to EMA (Exponential Moving Average)
    #[napi]
    pub fn ema(&mut self) -> &Self {
        self.inner = std::mem::take(&mut self.inner).ema();
        self
    }

    /// Set to WMA (Weighted Moving Average)
    #[napi]
    pub fn wma(&mut self) -> &Self {
        self.inner = std::mem::take(&mut self.inner).wma();
        self
    }
}

/// RSI Indicator Builder
#[napi]
pub struct RSIIndicator {
    inner: RSIBuilder,
}

#[napi]
impl RSIIndicator {
    #[napi(constructor)]
    pub fn new() -> Self {
        Self {
            inner: RSIBuilder::new(),
        }
    }

    /// Set period (default: 14)
    #[napi]
    pub fn period(&mut self, period: u32) -> &Self {
        self.inner = std::mem::take(&mut self.inner).period(period as usize);
        self
    }
}

/// MACD Indicator Builder
#[napi]
pub struct MACDIndicator {
    inner: MACDBuilder,
}

#[napi]
impl MACDIndicator {
    #[napi(constructor)]
    pub fn new() -> Self {
        Self {
            inner: MACDBuilder::new(),
        }
    }

    /// Set fast period (default: 12)
    #[napi]
    pub fn fast(&mut self, period: u32) -> &Self {
        self.inner = std::mem::take(&mut self.inner).fast(period as usize);
        self
    }

    /// Set slow period (default: 26)
    #[napi]
    pub fn slow(&mut self, period: u32) -> &Self {
        self.inner = std::mem::take(&mut self.inner).slow(period as usize);
        self
    }

    /// Set signal period (default: 9)
    #[napi]
    pub fn signal(&mut self, period: u32) -> &Self {
        self.inner = std::mem::take(&mut self.inner).signal(period as usize);
        self
    }
}

/// ATR Indicator Builder
#[napi]
pub struct ATRIndicator {
    inner: ATRBuilder,
}

#[napi]
impl ATRIndicator {
    #[napi(constructor)]
    pub fn new() -> Self {
        Self {
            inner: ATRBuilder::new(),
        }
    }

    /// Set period (default: 14)
    #[napi]
    pub fn period(&mut self, period: u32) -> &Self {
        self.inner = std::mem::take(&mut self.inner).period(period as usize);
        self
    }
}

/// BOLL Indicator Builder
#[napi]
pub struct BOLLIndicator {
    inner: BOLLBuilder,
}

#[napi]
impl BOLLIndicator {
    #[napi(constructor)]
    pub fn new() -> Self {
        Self {
            inner: BOLLBuilder::new(),
        }
    }

    /// Set period (default: 20)
    #[napi]
    pub fn period(&mut self, period: u32) -> &Self {
        self.inner = std::mem::take(&mut self.inner).period(period as usize);
        self
    }

    /// Set standard deviation factor (default: 2.0)
    #[napi]
    pub fn std_dev(&mut self, factor: f64) -> &Self {
        self.inner = std::mem::take(&mut self.inner).std_dev(factor);
        self
    }

    /// Set standard deviation factor (alias)
    #[napi]
    pub fn multiplier(&mut self, factor: f64) -> &Self {
        self.std_dev(factor)
    }
}

/// VRI Indicator Builder
#[napi]
pub struct VRIIndicator {
    inner: VRIBuilder,
}

#[napi]
impl VRIIndicator {
    #[napi(constructor)]
    pub fn new() -> Self {
        Self {
            inner: VRIBuilder::new(),
        }
    }

    /// Set period (default: 14)
    #[napi]
    pub fn period(&mut self, period: u32) -> &Self {
        self.inner = std::mem::take(&mut self.inner).period(period as usize);
        self
    }
}

// ============================================================================
// Indicators Factory
// ============================================================================

/// Indicator factory
#[napi]
pub struct Indicators;

#[napi]
impl Indicators {
    #[napi(constructor)]
    pub fn new() -> Self {
        Self
    }

    /// Create MA indicator builder
    #[napi]
    pub fn ma(&self) -> MAIndicator {
        MAIndicator::new()
    }

    /// Create RSI indicator builder
    #[napi]
    pub fn rsi(&self) -> RSIIndicator {
        RSIIndicator::new()
    }

    /// Create MACD indicator builder
    #[napi]
    pub fn macd(&self) -> MACDIndicator {
        MACDIndicator::new()
    }

    /// Create ATR indicator builder
    #[napi]
    pub fn atr(&self) -> ATRIndicator {
        ATRIndicator::new()
    }

    /// Create BOLL indicator builder
    #[napi]
    pub fn boll(&self) -> BOLLIndicator {
        BOLLIndicator::new()
    }

    /// Create VRI indicator builder
    #[napi]
    pub fn vri(&self) -> VRIIndicator {
        VRIIndicator::new()
    }
}

// ============================================================================
// Engine
// ============================================================================

#[napi]
pub struct Engine {
    inner: Mutex<QuantEngine>,
}

#[napi]
impl Engine {
    #[napi(constructor)]
    pub fn new(capacity: u32) -> napi::Result<Self> {
        Ok(Self {
            inner: Mutex::new(
                QuantEngine::new(capacity as usize).map_err(|e| Error::from_reason(e.to_string()))?,
            ),
        })
    }

    /// Add MA indicator
    #[napi]
    pub fn add_ma_indicator(&self, name: String, indicator: &MAIndicator) -> napi::Result<()> {
        let mut engine = self.inner.lock().map_err(|_| lock_poisoned_error())?;
        let builder = indicator.inner.clone();
        engine
            .add_indicator(name, builder)
            .map_err(|e| Error::from_reason(e.to_string()))?;
        Ok(())
    }

    /// Add RSI indicator
    #[napi]
    pub fn add_rsi_indicator(&self, name: String, indicator: &RSIIndicator) -> napi::Result<()> {
        let mut engine = self.inner.lock().map_err(|_| lock_poisoned_error())?;
        let builder = indicator.inner.clone();
        engine
            .add_indicator(name, builder)
            .map_err(|e| Error::from_reason(e.to_string()))?;
        Ok(())
    }

    /// Add MACD indicator
    #[napi]
    pub fn add_macd_indicator(&self, name: String, indicator: &MACDIndicator) -> napi::Result<()> {
        let mut engine = self.inner.lock().map_err(|_| lock_poisoned_error())?;
        let builder = indicator.inner.clone();
        engine
            .add_indicator(name, builder)
            .map_err(|e| Error::from_reason(e.to_string()))?;
        Ok(())
    }

    /// Add ATR indicator
    #[napi]
    pub fn add_atr_indicator(&self, name: String, indicator: &ATRIndicator) -> napi::Result<()> {
        let mut engine = self.inner.lock().map_err(|_| lock_poisoned_error())?;
        let builder = indicator.inner.clone();
        engine
            .add_indicator(name, builder)
            .map_err(|e| Error::from_reason(e.to_string()))?;
        Ok(())
    }

    /// Add BOLL indicator
    #[napi]
    pub fn add_boll_indicator(&self, name: String, indicator: &BOLLIndicator) -> napi::Result<()> {
        let mut engine = self.inner.lock().map_err(|_| lock_poisoned_error())?;
        let builder = indicator.inner.clone();
        engine
            .add_indicator(name, builder)
            .map_err(|e| Error::from_reason(e.to_string()))?;
        Ok(())
    }

    /// Add VRI indicator
    #[napi]
    pub fn add_vri_indicator(&self, name: String, indicator: &VRIIndicator) -> napi::Result<()> {
        let mut engine = self.inner.lock().map_err(|_| lock_poisoned_error())?;
        let builder = indicator.inner.clone();
        engine
            .add_indicator(name, builder)
            .map_err(|e| Error::from_reason(e.to_string()))?;
        Ok(())
    }

    /// Add predefined VWAP indicator
    #[napi]
    pub fn add_vwap(&self, name: String) -> napi::Result<()> {
        let mut engine = self.inner.lock().map_err(|_| lock_poisoned_error())?;
        engine
            .add_vwap(name)
            .map_err(|e| Error::from_reason(e.to_string()))?;
        Ok(())
    }

    /// Add predefined OBV indicator
    #[napi]
    pub fn add_obv(&self, name: String) -> napi::Result<()> {
        let mut engine = self.inner.lock().map_err(|_| lock_poisoned_error())?;
        engine
            .add_obv(name)
            .map_err(|e| Error::from_reason(e.to_string()))?;
        Ok(())
    }

    /// Setup multi-timeframe aggregator
    #[napi]
    pub fn setup_aggregator(
        &self,
        base_tf: String,
        target_tfs: Vec<String>,
        capacity: u32,
    ) -> napi::Result<()> {
        let mut engine = self.inner.lock().map_err(|_| lock_poisoned_error())?;
        let base = parse_timeframe(&base_tf)?;
        let targets: Vec<TimeFrame> = target_tfs
            .iter()
            .map(|s| parse_timeframe(s))
            .collect::<napi::Result<Vec<_>>>()?;
        engine
            .setup_aggregator(base, &targets, capacity as usize)
            .map_err(|e| Error::from_reason(e.to_string()))?;
        Ok(())
    }

    /// Push K-line data
    #[napi]
    pub fn push_kline(&self, bar: BarInput) -> napi::Result<Vec<SignalOutput>> {
        let mut engine = self.inner.lock().map_err(|_| lock_poisoned_error())?;
        let b = to_bar(&bar);
        let signals = engine.append_bar(&b);
        Ok(signals.iter().map(signal_to_output).collect())
    }

    /// Update last K-line
    #[napi]
    pub fn update_last(&self, bar: BarInput) -> napi::Result<()> {
        let mut engine = self.inner.lock().map_err(|_| lock_poisoned_error())?;
        let b = to_bar(&bar);
        engine.update_last_bar(&b);
        Ok(())
    }

    /// Get indicator value
    #[napi]
    pub fn get_indicator_value(&self, name: String) -> napi::Result<Option<f64>> {
        let engine = self.inner.lock().map_err(|_| lock_poisoned_error())?;
        Ok(engine.indicator_value(&name))
    }

    /// Check if indicator is ready
    #[napi]
    pub fn is_indicator_ready(&self, name: String) -> napi::Result<bool> {
        let engine = self.inner.lock().map_err(|_| lock_poisoned_error())?;
        Ok(engine.indicator_ready(&name))
    }

    /// Get indicator result with extra data
    #[napi]
    pub fn get_indicator_result(&self, name: String) -> napi::Result<Option<IndicatorResultOutput>> {
        let engine = self.inner.lock().map_err(|_| lock_poisoned_error())?;
        Ok(engine.indicator_result(&name).map(|r| IndicatorResultOutput {
            value: r.value,
            timestamp: r.timestamp,
            extra: r.extra,
        }))
    }

    /// Get last bar
    #[napi]
    pub fn get_last_bar(&self) -> napi::Result<Option<BarInput>> {
        let engine = self.inner.lock().map_err(|_| lock_poisoned_error())?;
        Ok(engine.last_bar().map(|b| BarInput {
            timestamp: b.timestamp,
            open: b.open,
            high: b.high,
            low: b.low,
            close: b.close,
            volume: b.volume,
            buy_volume: Some(b.buy_volume),
        }))
    }

    /// Reset engine
    #[napi]
    pub fn reset(&self) -> napi::Result<()> {
        let mut engine = self.inner.lock().map_err(|_| lock_poisoned_error())?;
        engine.reset();
        Ok(())
    }

    /// Feed raw K-line data (for realtime WebSocket streams)
    /// This method processes the K-line through the internal aggregator
    /// and returns aggregator events (period closures)
    #[napi]
    pub fn feed_kline(&self, bar: BarInput) -> napi::Result<Vec<AggregatorEvent>> {
        let mut engine = self.inner.lock().map_err(|_| lock_poisoned_error())?;
        let b = to_bar(&bar);

        // Update indicators and kline data
        engine.append_bar(&b);

        // Get aggregator events if aggregator is setup
        let mut events = Vec::new();
        if let Some(agg) = engine.aggregator() {
            // We need to get completed timeframes from last push
            // Since we already appended, check each timeframe for new data
            for tf in [TimeFrame::H1, TimeFrame::H4, TimeFrame::D1, TimeFrame::W1] {
                if let Some(output) = agg.output(tf) {
                    if let Some(last) = output.last() {
                        // Only add if this is a newly completed candle
                        // (timestamp matches the aligned timestamp for this period)
                        let aligned = tf.align_timestamp(b.timestamp);
                        if last.timestamp != aligned && b.timestamp >= last.timestamp + tf.millis() {
                            events.push(AggregatorEvent {
                                kind: "KlineClosed".to_string(),
                                period: timeframe_to_string(tf),
                                candle: Some(BarInput {
                                    timestamp: last.timestamp,
                                    open: last.open,
                                    high: last.high,
                                    low: last.low,
                                    close: last.close,
                                    volume: last.volume,
                                    buy_volume: Some(last.buy_volume),
                                }),
                            });
                        }
                    }
                }
            }
        }

        Ok(events)
    }

    /// Poll signals from strategies (used after feed_kline in realtime mode)
    #[napi]
    pub fn poll_signals(&self) -> napi::Result<Vec<SignalOutput>> {
        // In current implementation, signals are returned from push_kline/append_bar
        // This method is for compatibility with the API design
        // In a more complete implementation, this would return queued signals
        Ok(Vec::new())
    }

    /// Get K-line count
    #[napi]
    pub fn get_kline_count(&self) -> napi::Result<u32> {
        let engine = self.inner.lock().map_err(|_| lock_poisoned_error())?;
        Ok(engine.klines().len() as u32)
    }
}

// ============================================================================
// Multi-Period HQuant (combines Engine with built-in Aggregator)
// ============================================================================

/// Multi-period quantitative engine with built-in aggregator
/// Ideal for production use with WebSocket data streams
#[napi]
pub struct HQuant {
    engine: Mutex<QuantEngine>,
    aggregator: Mutex<Option<MultiTimeFrameAggregator>>,
    base_tf: Mutex<Option<TimeFrame>>,
    signal_queue: Mutex<Vec<Signal>>,
}

#[napi]
impl HQuant {
    #[napi(constructor)]
    pub fn new(capacity: u32, periods: Option<Vec<String>>) -> napi::Result<Self> {
        let engine = QuantEngine::new(capacity as usize)
            .map_err(|e| Error::from_reason(e.to_string()))?;

        let (aggregator, base_tf) = if let Some(ref period_strs) = periods {
            if period_strs.is_empty() {
                (None, None)
            } else {
                // First period is the base timeframe
                let base = parse_timeframe(&period_strs[0])?;
                let targets: Vec<TimeFrame> = period_strs[1..]
                    .iter()
                    .map(|s| parse_timeframe(s))
                    .collect::<napi::Result<Vec<_>>>()?;

                if targets.is_empty() {
                    (None, Some(base))
                } else {
                    let agg = MultiTimeFrameAggregator::new(base, &targets, capacity as usize)
                        .map_err(|e| Error::from_reason(e.to_string()))?;
                    (Some(agg), Some(base))
                }
            }
        } else {
            (None, None)
        };

        Ok(Self {
            engine: Mutex::new(engine),
            aggregator: Mutex::new(aggregator),
            base_tf: Mutex::new(base_tf),
            signal_queue: Mutex::new(Vec::new()),
        })
    }

    /// Add MA indicator
    #[napi]
    pub fn add_ma_indicator(&self, name: String, indicator: &MAIndicator) -> napi::Result<()> {
        let mut engine = self.engine.lock().map_err(|_| lock_poisoned_error())?;
        engine.add_indicator(name, indicator.inner.clone())
            .map_err(|e| Error::from_reason(e.to_string()))?;
        Ok(())
    }

    /// Add RSI indicator
    #[napi]
    pub fn add_rsi_indicator(&self, name: String, indicator: &RSIIndicator) -> napi::Result<()> {
        let mut engine = self.engine.lock().map_err(|_| lock_poisoned_error())?;
        engine.add_indicator(name, indicator.inner.clone())
            .map_err(|e| Error::from_reason(e.to_string()))?;
        Ok(())
    }

    /// Add MACD indicator
    #[napi]
    pub fn add_macd_indicator(&self, name: String, indicator: &MACDIndicator) -> napi::Result<()> {
        let mut engine = self.engine.lock().map_err(|_| lock_poisoned_error())?;
        engine.add_indicator(name, indicator.inner.clone())
            .map_err(|e| Error::from_reason(e.to_string()))?;
        Ok(())
    }

    /// Add BOLL indicator
    #[napi]
    pub fn add_boll_indicator(&self, name: String, indicator: &BOLLIndicator) -> napi::Result<()> {
        let mut engine = self.engine.lock().map_err(|_| lock_poisoned_error())?;
        engine.add_indicator(name, indicator.inner.clone())
            .map_err(|e| Error::from_reason(e.to_string()))?;
        Ok(())
    }

    /// Add ATR indicator
    #[napi]
    pub fn add_atr_indicator(&self, name: String, indicator: &ATRIndicator) -> napi::Result<()> {
        let mut engine = self.engine.lock().map_err(|_| lock_poisoned_error())?;
        engine.add_indicator(name, indicator.inner.clone())
            .map_err(|e| Error::from_reason(e.to_string()))?;
        Ok(())
    }

    /// Add VRI indicator
    #[napi]
    pub fn add_vri_indicator(&self, name: String, indicator: &VRIIndicator) -> napi::Result<()> {
        let mut engine = self.engine.lock().map_err(|_| lock_poisoned_error())?;
        engine.add_indicator(name, indicator.inner.clone())
            .map_err(|e| Error::from_reason(e.to_string()))?;
        Ok(())
    }

    /// Feed raw K-line data from WebSocket stream
    /// Triggers multi-period aggregation internally
    #[napi]
    pub fn feed_kline(&self, bar: BarInput) -> napi::Result<Vec<AggregatorEvent>> {
        let mut engine = self.engine.lock().map_err(|_| lock_poisoned_error())?;
        let mut aggregator = self.aggregator.lock().map_err(|_| lock_poisoned_error())?;
        let mut signal_queue = self.signal_queue.lock().map_err(|_| lock_poisoned_error())?;

        let b = to_bar(&bar);

        // Process through engine
        let signals = engine.append_bar(&b);
        signal_queue.extend(signals);

        // Process through aggregator if available
        let mut events = Vec::new();
        if let Some(ref mut agg) = *aggregator {
            let completed = agg.push(&b);
            for tf in completed {
                if let Some(output) = agg.output(tf) {
                    if let Some(last) = output.last() {
                        events.push(AggregatorEvent {
                            kind: "KlineClosed".to_string(),
                            period: timeframe_to_string(tf),
                            candle: Some(BarInput {
                                timestamp: last.timestamp,
                                open: last.open,
                                high: last.high,
                                low: last.low,
                                close: last.close,
                                volume: last.volume,
                                buy_volume: Some(last.buy_volume),
                            }),
                        });
                    }
                }
            }
        }

        Ok(events)
    }

    /// Push completed K-line (for historical data loading)
    #[napi]
    pub fn push_kline(&self, bar: BarInput) -> napi::Result<Vec<SignalOutput>> {
        let mut engine = self.engine.lock().map_err(|_| lock_poisoned_error())?;
        let b = to_bar(&bar);
        let signals = engine.append_bar(&b);
        Ok(signals.iter().map(signal_to_output).collect())
    }

    /// Update last K-line (for realtime price updates within same candle)
    #[napi]
    pub fn update_last(&self, bar: BarInput) -> napi::Result<()> {
        let mut engine = self.engine.lock().map_err(|_| lock_poisoned_error())?;
        let mut aggregator = self.aggregator.lock().map_err(|_| lock_poisoned_error())?;

        let b = to_bar(&bar);
        engine.update_last_bar(&b);

        if let Some(ref mut agg) = *aggregator {
            agg.update_last(&b);
        }

        Ok(())
    }

    /// Poll accumulated signals
    #[napi]
    pub fn poll_signals(&self) -> napi::Result<Vec<SignalOutput>> {
        let mut signal_queue = self.signal_queue.lock().map_err(|_| lock_poisoned_error())?;
        let signals: Vec<SignalOutput> = signal_queue.iter().map(signal_to_output).collect();
        signal_queue.clear();
        Ok(signals)
    }

    /// Get indicator value
    #[napi]
    pub fn get_indicator_value(&self, name: String) -> napi::Result<Option<f64>> {
        let engine = self.engine.lock().map_err(|_| lock_poisoned_error())?;
        Ok(engine.indicator_value(&name))
    }

    /// Get indicator result with extra data
    #[napi]
    pub fn get_indicator_result(&self, name: String) -> napi::Result<Option<IndicatorResultOutput>> {
        let engine = self.engine.lock().map_err(|_| lock_poisoned_error())?;
        Ok(engine.indicator_result(&name).map(|r| IndicatorResultOutput {
            value: r.value,
            timestamp: r.timestamp,
            extra: r.extra,
        }))
    }

    /// Check if indicator is ready
    #[napi]
    pub fn is_indicator_ready(&self, name: String) -> napi::Result<bool> {
        let engine = self.engine.lock().map_err(|_| lock_poisoned_error())?;
        Ok(engine.indicator_ready(&name))
    }

    /// Reset engine
    #[napi]
    pub fn reset(&self) -> napi::Result<()> {
        let mut engine = self.engine.lock().map_err(|_| lock_poisoned_error())?;
        let mut aggregator = self.aggregator.lock().map_err(|_| lock_poisoned_error())?;
        let mut signal_queue = self.signal_queue.lock().map_err(|_| lock_poisoned_error())?;

        engine.reset();
        if let Some(ref mut agg) = *aggregator {
            agg.reset();
        }
        signal_queue.clear();

        Ok(())
    }
}

// ============================================================================
// Backtest
// ============================================================================

#[napi(object)]
pub struct BacktestConfigInput {
    pub market_type: Option<String>,
    pub initial_capital: f64,
    pub leverage: Option<f64>,
    pub maker_fee: Option<f64>,
    pub taker_fee: Option<f64>,
    pub slippage: Option<f64>,
    pub position_size_pct: Option<f64>,
}

#[napi]
pub struct Backtest {
    inner: Mutex<BacktestEngine>,
}

#[napi]
impl Backtest {
    #[napi(constructor)]
    pub fn new(config: BacktestConfigInput) -> Self {
        let market_type = match config.market_type.as_deref() {
            Some("futures") | Some("Futures") | Some("FUTURES") => MarketType::Futures,
            _ => MarketType::Spot,
        };

        let bt_config = BacktestConfig {
            market_type,
            initial_capital: config.initial_capital,
            leverage: config.leverage.unwrap_or(1.0),
            maker_fee: config.maker_fee.unwrap_or(0.001),
            taker_fee: config.taker_fee.unwrap_or(0.001),
            slippage: config.slippage.unwrap_or(0.0005),
            position_size_pct: config.position_size_pct.unwrap_or(0.1),
        };

        Self {
            inner: Mutex::new(BacktestEngine::new(bt_config)),
        }
    }

    /// Open long position
    #[napi]
    pub fn open_long(&self, price: f64, size: f64) -> napi::Result<()> {
        let mut engine = self.inner.lock().map_err(|_| lock_poisoned_error())?;
        engine.open_long(price, size);
        Ok(())
    }

    /// Open short position (futures only)
    #[napi]
    pub fn open_short(&self, price: f64, size: f64) -> napi::Result<()> {
        let mut engine = self.inner.lock().map_err(|_| lock_poisoned_error())?;
        engine.open_short(price, size);
        Ok(())
    }

    /// Close position
    #[napi]
    pub fn close(&self, price: f64) -> napi::Result<()> {
        let mut engine = self.inner.lock().map_err(|_| lock_poisoned_error())?;
        engine.close(price);
        Ok(())
    }

    /// Get backtest result
    #[napi]
    pub fn result(&self) -> napi::Result<BacktestStatsOutput> {
        let mut engine = self.inner.lock().map_err(|_| lock_poisoned_error())?;
        let stats = engine.result();
        Ok(BacktestStatsOutput {
            total_trades: stats.total_trades as u32,
            winning_trades: stats.winning_trades as u32,
            losing_trades: stats.losing_trades as u32,
            total_pnl: stats.total_pnl,
            max_drawdown: stats.max_drawdown,
            max_drawdown_pct: stats.max_drawdown_pct,
            sharpe_ratio: stats.sharpe_ratio,
            win_rate: stats.win_rate,
            final_equity: stats.final_equity,
            return_pct: stats.return_pct,
            liquidations: stats.liquidations as u32,
        })
    }

    /// Get trades
    #[napi]
    pub fn get_trades(&self) -> napi::Result<Vec<TradeOutput>> {
        let engine = self.inner.lock().map_err(|_| lock_poisoned_error())?;
        Ok(engine
            .trades()
            .iter()
            .map(|t| TradeOutput {
                timestamp: t.timestamp,
                side: match t.side {
                    Side::Buy => "BUY".to_string(),
                    Side::Sell => "SELL".to_string(),
                    Side::Hold => "HOLD".to_string(),
                },
                price: t.price,
                size: t.size,
                fee: t.fee,
                pnl: t.pnl,
            })
            .collect())
    }

    /// Get equity curve
    #[napi]
    pub fn get_equity_curve(&self) -> napi::Result<Vec<f64>> {
        let engine = self.inner.lock().map_err(|_| lock_poisoned_error())?;
        Ok(engine.equity_curve().to_vec())
    }

    /// Get current equity
    #[napi]
    pub fn get_equity(&self) -> napi::Result<f64> {
        let engine = self.inner.lock().map_err(|_| lock_poisoned_error())?;
        Ok(engine.equity())
    }

    /// Reset backtest
    #[napi]
    pub fn reset(&self) -> napi::Result<()> {
        let mut engine = self.inner.lock().map_err(|_| lock_poisoned_error())?;
        engine.reset();
        Ok(())
    }
}

// ============================================================================
// Aggregator
// ============================================================================

#[napi(object)]
pub struct AggregatorEvent {
    pub kind: String,
    pub period: String,
    pub candle: Option<BarInput>,
}

#[napi]
pub struct KlineAggregator {
    inner: Mutex<MultiTimeFrameAggregator>,
}

#[napi]
impl KlineAggregator {
    #[napi(constructor)]
    pub fn new(base_tf: String, target_tfs: Vec<String>, capacity: u32) -> napi::Result<Self> {
        let base = parse_timeframe(&base_tf)?;
        let targets: Vec<TimeFrame> = target_tfs
            .iter()
            .map(|s| parse_timeframe(s))
            .collect::<napi::Result<Vec<_>>>()?;

        let agg = MultiTimeFrameAggregator::new(base, &targets, capacity as usize)
            .map_err(|e| Error::from_reason(e.to_string()))?;

        Ok(Self {
            inner: Mutex::new(agg),
        })
    }

    /// Push K-line and get events
    #[napi]
    pub fn push_kline(&self, bar: BarInput) -> napi::Result<Vec<AggregatorEvent>> {
        let mut agg = self.inner.lock().map_err(|_| lock_poisoned_error())?;
        let b = to_bar(&bar);
        let completed = agg.push(&b);

        let mut events = Vec::new();
        for tf in completed {
            if let Some(output) = agg.output(tf) {
                if let Some(last) = output.last() {
                    events.push(AggregatorEvent {
                        kind: "KlineClosed".to_string(),
                        period: timeframe_to_string(tf),
                        candle: Some(BarInput {
                            timestamp: last.timestamp,
                            open: last.open,
                            high: last.high,
                            low: last.low,
                            close: last.close,
                            volume: last.volume,
                            buy_volume: Some(last.buy_volume),
                        }),
                    });
                }
            }
        }

        Ok(events)
    }

    /// Update last K-line
    #[napi]
    pub fn update_last(&self, bar: BarInput) -> napi::Result<()> {
        let mut agg = self.inner.lock().map_err(|_| lock_poisoned_error())?;
        let b = to_bar(&bar);
        agg.update_last(&b);
        Ok(())
    }

    /// Flush all pending candles
    #[napi]
    pub fn flush(&self) -> napi::Result<()> {
        let mut agg = self.inner.lock().map_err(|_| lock_poisoned_error())?;
        agg.flush_all();
        Ok(())
    }

    /// Reset aggregator
    #[napi]
    pub fn reset(&self) -> napi::Result<()> {
        let mut agg = self.inner.lock().map_err(|_| lock_poisoned_error())?;
        agg.reset();
        Ok(())
    }
}

// ============================================================================
// Strategy DSL
// ============================================================================

#[napi(object)]
pub struct LabeledVectorInput {
    pub label: i32,
    pub vector: Vec<f64>,
}

#[napi(object)]
pub struct SimilarityHitOutput {
    pub label: i32,
    pub score: f64,
}

/// DSL Strategy engine for custom trading strategies
#[napi]
pub struct DslStrategy {
    inner: Mutex<DslEngine>,
}

#[napi]
impl DslStrategy {
    /// Create a new DSL strategy from source code
    ///
    /// Example DSL:
    /// ```text
    /// ema20 = EMA(close, period=20)
    /// IF RSI(14) < 30 THEN BUY
    /// IF RSI(14) > 70 THEN SELL
    /// ```
    #[napi(constructor)]
    pub fn new(source: String) -> napi::Result<Self> {
        let engine = DslEngine::new(&source)
            .map_err(|e| Error::from_reason(e.to_string()))?;
        Ok(Self {
            inner: Mutex::new(engine),
        })
    }

    /// Load labeled vectors into a named store for similarity matching
    ///
    /// Used with VEC_STORE() and SIMILARITY() in DSL
    #[napi]
    pub fn load_store(&self, name: String, vectors: Vec<LabeledVectorInput>) -> napi::Result<()> {
        let mut engine = self.inner.lock().map_err(|_| lock_poisoned_error())?;
        let labeled: Vec<LabeledVector> = vectors
            .into_iter()
            .map(|v| LabeledVector::new(v.label, v.vector))
            .collect();
        engine.vector_store_mut().load(&name, labeled);
        Ok(())
    }

    /// Set similarity threshold (default: 0.9)
    #[napi]
    pub fn set_threshold(&self, threshold: f64) -> napi::Result<()> {
        let mut engine = self.inner.lock().map_err(|_| lock_poisoned_error())?;
        engine.set_threshold(threshold);
        Ok(())
    }

    /// Evaluate strategy with given bar data and indicators
    /// Returns generated signals
    #[napi]
    pub fn evaluate(&self, bar: BarInput, indicators: std::collections::HashMap<String, f64>) -> napi::Result<Vec<SignalOutput>> {
        let mut engine = self.inner.lock().map_err(|_| lock_poisoned_error())?;
        let b = to_bar(&bar);

        // Create a minimal indicator map for context
        // Note: In real usage, you'd pass the actual engine's indicators
        let empty_indicators = std::collections::HashMap::new();
        let ctx = DslContext::new(&b, &empty_indicators);

        let signals = engine.evaluate(&ctx)
            .map_err(|e| Error::from_reason(e.to_string()))?;

        Ok(signals.iter().map(signal_to_output).collect())
    }

    /// Reset strategy state
    #[napi]
    pub fn reset(&self) -> napi::Result<()> {
        let mut engine = self.inner.lock().map_err(|_| lock_poisoned_error())?;
        engine.reset();
        Ok(())
    }
}

/// Compile and validate DSL source without creating engine
#[napi]
pub fn validate_dsl(source: String) -> napi::Result<bool> {
    match crate::dsl::compile(&source) {
        Ok(_) => Ok(true),
        Err(e) => Err(Error::from_reason(e.to_string())),
    }
}
