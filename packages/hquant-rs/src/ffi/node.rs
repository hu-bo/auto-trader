//! Node.js FFI using napi-rs

use std::sync::Mutex;

use napi::bindgen_prelude::*;
use napi_derive::napi;

use crate::{
    dsl::{DslContext, DslEngine, LabeledVector},
    ATRBuilder,
    BOLLBuilder,
    BacktestConfig,
    BacktestEngine,
    BacktestStats,
    Bar,
    // FuturesBacktest from core
    FuturesBacktest as CoreFuturesBacktest,
    FuturesBacktestConfig as CoreFuturesBacktestConfig,
    IndicatorGraph,
    MABuilder,
    MACDBuilder,
    MarketType,
    MultiTimeFrameAggregator,
    PositionSide,
    QuantEngine,
    RSIBuilder,
    Side,
    Signal,
    TimeFrame,
    Trade,
    VRIBuilder,
};

fn lock_poisoned_error() -> Error {
    Error::from_reason("lock poisoned".to_string())
}

fn parse_position_side(position_side: &str) -> napi::Result<PositionSide> {
    match position_side.to_ascii_uppercase().as_str() {
        "LONG" => Ok(PositionSide::Long),
        "SHORT" => Ok(PositionSide::Short),
        _ => Err(Error::from_reason(
            "positionSide must be \"LONG\" or \"SHORT\"".to_string(),
        )),
    }
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

/// Signal output for DSL strategies (compatible with jx-quant)
#[napi(object)]
pub struct DslSignalOutput {
    pub strategy_id: u32,
    pub action: String,
    pub timestamp: i64,
}

#[napi(object)]
pub struct IndicatorResultOutput {
    pub value: f64,
    pub timestamp: i64,
    pub extra: Option<Vec<f64>>,
}

/// Generic indicator config for FFI (mirrors Python's `add_indicator` dict).
#[napi(object)]
pub struct IndicatorConfigInput {
    pub r#type: String,
    pub period: Option<u32>,
    pub fast: Option<u32>,
    pub slow: Option<u32>,
    pub signal: Option<u32>,
    pub std_dev: Option<f64>,
    pub multiplier: Option<f64>,
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

fn add_indicator_from_config(
    engine: &mut QuantEngine,
    name: String,
    config: IndicatorConfigInput,
) -> napi::Result<()> {
    let ind_type = config.r#type.to_lowercase();
    match ind_type.as_str() {
        "ma" | "sma" => {
            let period = config.period.unwrap_or(20) as usize;
            let builder = MABuilder::new().period(period).sma();
            engine
                .add_indicator(name, builder)
                .map_err(|e| Error::from_reason(e.to_string()))?;
        }
        "ema" => {
            let period = config.period.unwrap_or(20) as usize;
            let builder = MABuilder::new().period(period).ema();
            engine
                .add_indicator(name, builder)
                .map_err(|e| Error::from_reason(e.to_string()))?;
        }
        "wma" => {
            let period = config.period.unwrap_or(20) as usize;
            let builder = MABuilder::new().period(period).wma();
            engine
                .add_indicator(name, builder)
                .map_err(|e| Error::from_reason(e.to_string()))?;
        }
        "rsi" => {
            let period = config.period.unwrap_or(14) as usize;
            let builder = RSIBuilder::new().period(period);
            engine
                .add_indicator(name, builder)
                .map_err(|e| Error::from_reason(e.to_string()))?;
        }
        "macd" => {
            let fast = config.fast.unwrap_or(12) as usize;
            let slow = config.slow.unwrap_or(26) as usize;
            let signal = config.signal.unwrap_or(9) as usize;
            let builder = MACDBuilder::new().fast(fast).slow(slow).signal(signal);
            engine
                .add_indicator(name, builder)
                .map_err(|e| Error::from_reason(e.to_string()))?;
        }
        "atr" => {
            let period = config.period.unwrap_or(14) as usize;
            let builder = ATRBuilder::new().period(period);
            engine
                .add_indicator(name, builder)
                .map_err(|e| Error::from_reason(e.to_string()))?;
        }
        "boll" | "bollinger" => {
            let period = config.period.unwrap_or(20) as usize;
            let std_dev = config.std_dev.or(config.multiplier).unwrap_or(2.0);
            let builder = BOLLBuilder::new().period(period).std_dev(std_dev);
            engine
                .add_indicator(name, builder)
                .map_err(|e| Error::from_reason(e.to_string()))?;
        }
        "vri" => {
            let period = config.period.unwrap_or(14) as usize;
            let builder = VRIBuilder::new().period(period);
            engine
                .add_indicator(name, builder)
                .map_err(|e| Error::from_reason(e.to_string()))?;
        }
        "vwap" => {
            engine
                .add_vwap(name)
                .map_err(|e| Error::from_reason(e.to_string()))?;
        }
        "obv" => {
            let capacity = engine.klines().capacity();
            let indicator = crate::obv(capacity).map_err(|e| Error::from_reason(e.to_string()))?;
            engine.add_indicator_boxed(name, Box::new(indicator));
        }
        _ => {
            return Err(Error::from_reason(format!(
                "Unknown indicator type: {}",
                config.r#type
            )));
        }
    }

    Ok(())
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
                QuantEngine::new(capacity as usize)
                    .map_err(|e| Error::from_reason(e.to_string()))?,
            ),
        })
    }

    /// Add indicator from config object.
    /// Example: engine.addIndicator("rsi", { type: "rsi", period: 14 })
    #[napi]
    pub fn add_indicator(&self, name: String, config: IndicatorConfigInput) -> napi::Result<()> {
        let mut engine = self.inner.lock().map_err(|_| lock_poisoned_error())?;
        add_indicator_from_config(&mut engine, name, config)
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
    pub fn get_indicator_result(
        &self,
        name: String,
    ) -> napi::Result<Option<IndicatorResultOutput>> {
        let engine = self.inner.lock().map_err(|_| lock_poisoned_error())?;
        Ok(engine
            .indicator_result(&name)
            .map(|r| IndicatorResultOutput {
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
                        if last.timestamp != aligned && b.timestamp >= last.timestamp + tf.millis()
                        {
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

    // Backtest APIs intentionally not exposed on Engine.
}

// ============================================================================
// Shared helpers
// ============================================================================

fn parse_backtest_config(config: &BacktestConfigInput) -> BacktestConfig {
    let market_type = match config.market_type.as_deref() {
        Some("futures") | Some("Futures") | Some("FUTURES") => MarketType::Futures,
        _ => MarketType::Spot,
    };
    BacktestConfig {
        market_type,
        initial_capital: config.initial_capital,
        leverage: config.leverage.unwrap_or(1.0),
        maker_fee: config.maker_fee.unwrap_or(0.001),
        taker_fee: config.taker_fee.unwrap_or(0.001),
        slippage: config.slippage.unwrap_or(0.0005),
        position_size_pct: config.position_size_pct.unwrap_or(0.1),
    }
}

fn stats_to_output(stats: &BacktestStats) -> BacktestStatsOutput {
    BacktestStatsOutput {
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
    }
}

fn trade_to_output(t: &Trade) -> TradeOutput {
    TradeOutput {
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
    }
}

// ============================================================================
// Multi-Period HQuant (combines Engine with built-in Aggregator)
// ============================================================================

/// Inner state for HQuant, protected by a single Mutex
struct HQuantInner {
    engine: QuantEngine,
    aggregator: Option<MultiTimeFrameAggregator>,
    base_tf: Option<TimeFrame>,
    signal_queue: Vec<Signal>,
    dsl_strategies: Vec<(u32, String, DslEngine)>,
    next_strategy_id: u32,
}

/// Multi-period quantitative engine with built-in aggregator
/// Ideal for production use with WebSocket data streams
#[napi]
pub struct HQuant {
    inner: Mutex<HQuantInner>,
}

#[napi]
impl HQuant {
    #[napi(constructor)]
    pub fn new(capacity: u32, periods: Option<Vec<String>>) -> napi::Result<Self> {
        let engine =
            QuantEngine::new(capacity as usize).map_err(|e| Error::from_reason(e.to_string()))?;

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
            inner: Mutex::new(HQuantInner {
                engine,
                aggregator,
                base_tf,
                signal_queue: Vec::new(),
                dsl_strategies: Vec::new(),
                next_strategy_id: 1,
            }),
        })
    }

    /// Add indicator from config object.
    /// Example: hq.addIndicator("rsi_3", { type: "rsi", period: 3 })
    #[napi]
    pub fn add_indicator(&self, name: String, config: IndicatorConfigInput) -> napi::Result<()> {
        let mut inner = self.inner.lock().map_err(|_| lock_poisoned_error())?;
        add_indicator_from_config(&mut inner.engine, name, config)
    }

    /// Feed raw K-line data from WebSocket stream
    /// Triggers multi-period aggregation internally
    #[napi]
    pub fn feed_kline(&self, bar: BarInput) -> napi::Result<Vec<AggregatorEvent>> {
        let mut inner = self.inner.lock().map_err(|_| lock_poisoned_error())?;
        let b = to_bar(&bar);

        // Process through engine
        let signals = inner.engine.append_bar(&b);
        inner.signal_queue.extend(signals);

        // Process through aggregator if available
        let mut events = Vec::new();
        if let Some(ref mut agg) = inner.aggregator {
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
    /// This method updates indicators and evaluates DSL strategies
    #[napi]
    pub fn push_bar(&self, bar: BarInput) -> napi::Result<()> {
        let mut inner = self.inner.lock().map_err(|_| lock_poisoned_error())?;
        let b = to_bar(&bar);

        // Append bar to engine (updates indicators)
        let _builtin_signals = inner.engine.append_bar(&b);

        // Evaluate DSL strategies with field destructuring to enable split borrows
        let HQuantInner {
            engine,
            dsl_strategies,
            signal_queue,
            ..
        } = &mut *inner;

        for (strategy_id, _name, dsl_engine) in dsl_strategies.iter_mut() {
            let graph = engine.graph();
            let ctx = DslContext::new(&b, graph);
            if let Ok(signals) = dsl_engine.evaluate(&ctx) {
                for mut sig in signals {
                    sig.reason = format!("{}:{}", strategy_id, sig.reason);
                    signal_queue.push(sig);
                }
            }
        }

        Ok(())
    }

    /// Push completed K-line (legacy alias for push_bar)
    #[napi]
    pub fn push_kline(&self, bar: BarInput) -> napi::Result<Vec<SignalOutput>> {
        self.push_bar(bar)?;
        // Return empty - use pollSignals() to get accumulated signals
        Ok(Vec::new())
    }

    /// Update last K-line (for realtime price updates within same candle)
    #[napi]
    pub fn update_last(&self, bar: BarInput) -> napi::Result<()> {
        let mut inner = self.inner.lock().map_err(|_| lock_poisoned_error())?;
        let b = to_bar(&bar);
        inner.engine.update_last_bar(&b);

        if let Some(ref mut agg) = inner.aggregator {
            agg.update_last(&b);
        }

        Ok(())
    }

    /// Poll accumulated signals from DSL strategies
    /// Returns signals with strategyId and action (BUY/SELL/HOLD)
    #[napi]
    pub fn poll_signals(&self) -> napi::Result<Vec<DslSignalOutput>> {
        let mut inner = self.inner.lock().map_err(|_| lock_poisoned_error())?;
        let signals: Vec<DslSignalOutput> = inner
            .signal_queue
            .iter()
            .map(|s| {
                // Parse strategy_id from reason (format: "id:reason")
                let strategy_id = s
                    .reason
                    .split(':')
                    .next()
                    .and_then(|id| id.parse::<u32>().ok())
                    .unwrap_or(0);
                DslSignalOutput {
                    strategy_id,
                    action: match s.side {
                        Side::Buy => "BUY".to_string(),
                        Side::Sell => "SELL".to_string(),
                        Side::Hold => "HOLD".to_string(),
                    },
                    timestamp: s.timestamp,
                }
            })
            .collect();
        inner.signal_queue.clear();
        Ok(signals)
    }

    /// Get indicator value
    #[napi]
    pub fn get_indicator_value(&self, name: String) -> napi::Result<Option<f64>> {
        let inner = self.inner.lock().map_err(|_| lock_poisoned_error())?;
        Ok(inner.engine.indicator_value(&name))
    }

    /// Get indicator result with extra data
    #[napi]
    pub fn get_indicator_result(
        &self,
        name: String,
    ) -> napi::Result<Option<IndicatorResultOutput>> {
        let inner = self.inner.lock().map_err(|_| lock_poisoned_error())?;
        Ok(inner
            .engine
            .indicator_result(&name)
            .map(|r| IndicatorResultOutput {
                value: r.value,
                timestamp: r.timestamp,
                extra: r.extra,
            }))
    }

    /// Check if indicator is ready
    #[napi]
    pub fn is_indicator_ready(&self, name: String) -> napi::Result<bool> {
        let inner = self.inner.lock().map_err(|_| lock_poisoned_error())?;
        Ok(inner.engine.indicator_ready(&name))
    }

    /// Reset engine
    #[napi]
    pub fn reset(&self) -> napi::Result<()> {
        let mut inner = self.inner.lock().map_err(|_| lock_poisoned_error())?;
        inner.engine.reset();
        if let Some(ref mut agg) = inner.aggregator {
            agg.reset();
        }
        inner.signal_queue.clear();

        Ok(())
    }

    // -- DSL Strategy methods --

    /// Add a DSL-based strategy
    /// Returns the strategy ID (>0 on success)
    #[napi]
    pub fn add_strategy(&self, name: String, dsl: String) -> napi::Result<u32> {
        let dsl_engine = DslEngine::new(&dsl)
            .map_err(|e| Error::from_reason(format!("DSL compile error: {}", e)))?;

        let mut inner = self.inner.lock().map_err(|_| lock_poisoned_error())?;
        let id = inner.next_strategy_id;
        inner.dsl_strategies.push((id, name, dsl_engine));
        inner.next_strategy_id += 1;

        Ok(id)
    }

    // Built-in indicator/strategy adders intentionally not exposed via FFI.

    // Backtest APIs intentionally not exposed on HQuant.
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
        Self {
            inner: Mutex::new(BacktestEngine::new(parse_backtest_config(&config))),
        }
    }

    /// Open position
    #[napi]
    pub fn open_position(&self, price: f64, size: f64, position_side: String) -> napi::Result<()> {
        let mut engine = self.inner.lock().map_err(|_| lock_poisoned_error())?;
        let position_side = parse_position_side(&position_side)?;
        engine.open_position(price, size, position_side);
        Ok(())
    }

    /// Close position
    #[napi]
    pub fn close_position(&self, price: f64, position_side: String) -> napi::Result<()> {
        let mut engine = self.inner.lock().map_err(|_| lock_poisoned_error())?;
        let position_side = parse_position_side(&position_side)?;
        engine.close_position(price, position_side);
        Ok(())
    }

    /// Get backtest result
    #[napi]
    pub fn result(&self) -> napi::Result<BacktestStatsOutput> {
        let mut engine = self.inner.lock().map_err(|_| lock_poisoned_error())?;
        Ok(stats_to_output(engine.result()))
    }

    /// Get trades
    #[napi]
    pub fn get_trades(&self) -> napi::Result<Vec<TradeOutput>> {
        let engine = self.inner.lock().map_err(|_| lock_poisoned_error())?;
        Ok(engine.trades().iter().map(trade_to_output).collect())
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
        let engine = DslEngine::new(&source).map_err(|e| Error::from_reason(e.to_string()))?;
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
    pub fn evaluate(
        &self,
        bar: BarInput,
        indicators: std::collections::HashMap<String, f64>,
    ) -> napi::Result<Vec<SignalOutput>> {
        let mut engine = self.inner.lock().map_err(|_| lock_poisoned_error())?;
        let b = to_bar(&bar);

        // Create a minimal indicator map for context
        // Note: In real usage, you'd pass the actual engine's indicators
        let empty_graph = IndicatorGraph::new();
        let ctx = DslContext::new(&b, &empty_graph);

        let signals = engine
            .evaluate(&ctx)
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

// ============================================================================
// FuturesBacktest (standalone, compatible with jx-quant)
// ============================================================================

#[napi(object)]
pub struct FuturesBacktestConfig {
    pub initial_margin: f64,
    pub leverage: f64,
    pub contract_size: f64,
    pub maker_fee_rate: f64,
    pub taker_fee_rate: f64,
    pub maintenance_margin_rate: f64,
    pub decimals: Option<u32>,
}

#[napi(object)]
pub struct FuturesBacktestResult {
    pub equity: f64,
    pub profit: f64,
    pub profit_rate: f64,
    pub max_drawdown_rate: f64,
    pub liquidated: bool,
}

#[napi(object)]
pub struct FuturesPositionOutput {
    pub position_side: String,
    pub entry_price: f64,
    pub mark_price: f64,
    pub position_amt: f64,
    pub margin: f64,
    pub unrealized_pnl: f64,
}

/// Standalone futures backtest engine (compatible with jx-quant FuturesBacktest)
/// Decoupled from HQuant, can be used independently with any signal source
/// Uses shared Rust core implementation for consistency across Python/Node.js
#[napi]
pub struct FuturesBacktest {
    inner: CoreFuturesBacktest,
}

#[napi]
impl FuturesBacktest {
    #[napi(constructor)]
    pub fn new(config: FuturesBacktestConfig) -> Self {
        let core_config = CoreFuturesBacktestConfig {
            initial_margin: config.initial_margin,
            leverage: config.leverage,
            contract_size: config.contract_size,
            maker_fee_rate: config.maker_fee_rate,
            taker_fee_rate: config.taker_fee_rate,
            maintenance_margin_rate: config.maintenance_margin_rate,
        };
        let mut inner = CoreFuturesBacktest::new(core_config);
        if let Some(d) = config.decimals {
            inner.set_decimals(d);
        }
        Self { inner }
    }

    /// Set decimal precision for results (default: 8)
    #[napi]
    pub fn set_decimals(&mut self, decimals: u32) {
        self.inner.set_decimals(decimals);
    }

    /// Apply a trading signal
    /// action: "BUY", "SELL", or "HOLD"
    /// price: current market price
    /// margin: margin amount to use for opening/closing positions
    /// is_maker: if true, use maker_fee_rate (limit order); if false, use taker_fee_rate (market order)
    #[napi]
    pub fn apply_signal(
        &mut self,
        action: String,
        price: f64,
        margin: f64,
        position_side: Option<String>,
        is_maker: Option<bool>,
    ) -> napi::Result<()> {
        let use_maker = is_maker.unwrap_or(false);
        let position_side = position_side
            .as_deref()
            .map(parse_position_side)
            .transpose()?;
        self.inner
            .apply_signal(&action, price, margin, position_side, use_maker);
        Ok(())
    }

    /// Open a position directly.
    /// position_side: "LONG" | "SHORT"
    #[napi]
    pub fn open_position(
        &mut self,
        position_side: String,
        price: f64,
        margin: f64,
        is_maker: Option<bool>,
    ) -> napi::Result<()> {
        let position_side = parse_position_side(&position_side)?;
        let use_maker = is_maker.unwrap_or(false);
        self.inner
            .open_position(price, margin, position_side, use_maker);
        Ok(())
    }

    /// Close a position directly.
    /// position_side: "LONG" | "SHORT"
    #[napi]
    pub fn close_position(
        &mut self,
        position_side: String,
        price: f64,
        margin: f64,
        is_maker: Option<bool>,
    ) -> napi::Result<()> {
        let position_side = parse_position_side(&position_side)?;
        let use_maker = is_maker.unwrap_or(false);
        self.inner
            .close_position(price, margin, position_side, use_maker);
        Ok(())
    }

    /// Update position value on price change (for liquidation checking)
    #[napi]
    pub fn on_price(&mut self, price: f64) {
        self.inner.on_price(price);
    }

    /// Get backtest result
    #[napi]
    pub fn result(&self, price: f64) -> FuturesBacktestResult {
        let r = self.inner.result(price);
        FuturesBacktestResult {
            equity: r.equity,
            profit: r.profit,
            profit_rate: r.profit_rate,
            max_drawdown_rate: r.max_drawdown_rate,
            liquidated: r.liquidated,
        }
    }

    /// Get current equity
    #[napi]
    pub fn get_equity(&self) -> f64 {
        self.inner.equity()
    }

    /// Get current position
    #[napi]
    pub fn get_position(&self) -> f64 {
        self.inner.position()
    }

    /// Get current positions (0 or 1).
    #[napi]
    pub fn get_positions(&self) -> Vec<FuturesPositionOutput> {
        self.inner
            .positions()
            .into_iter()
            .map(|p| FuturesPositionOutput {
                position_side: match p.position_side {
                    PositionSide::Long => "LONG",
                    PositionSide::Short => "SHORT",
                }
                .to_string(),
                entry_price: p.entry_price,
                mark_price: p.mark_price,
                position_amt: p.position_amt,
                margin: p.margin,
                unrealized_pnl: p.unrealized_pnl,
            })
            .collect()
    }

    /// Check if liquidated
    #[napi]
    pub fn is_liquidated(&self) -> bool {
        self.inner.is_liquidated()
    }

    /// Reset backtest state
    #[napi]
    pub fn reset(&mut self) {
        self.inner.reset();
    }
}
