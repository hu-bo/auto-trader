use std::collections::HashMap;

use napi::bindgen_prelude::*;
use napi_derive::napi;

use crate::aggregator::{Aggregator, AggregatorEventKind};
use crate::backtest::futures_backtest::{
    BacktestParams, BacktestResult, FuturesBacktest as CoreFuturesBacktest, FuturesPosition, PositionSide,
};
use crate::backtest::simple_backtest::{
    Backtest as SimpleBacktest, BacktestConfig as SimpleBacktestConfig, BacktestStats, MarketType,
    Trade,
};
use crate::dsl::{compile_strategy, validate_dsl, CompiledStrategy};
use crate::indicators::{IndicatorId, IndicatorSpec, IndicatorValue};
use crate::kline_buffer::KlineBuffer;
use crate::multi::MultiHQuant as CoreMultiHQuant;
use crate::period::Period;
use crate::types::{Action, Bar};
use crate::vector_store::{LabeledVector, VectorStore};

#[napi(object)]
pub struct JsBar {
    pub timestamp: i64,
    pub open: f64,
    pub high: f64,
    pub low: f64,
    pub close: f64,
    pub volume: f64,
    #[napi(js_name = "buyVolume")]
    pub buy_volume: Option<f64>,
}

impl From<Bar> for JsBar {
    fn from(b: Bar) -> Self {
        Self {
            timestamp: b.timestamp,
            open: b.open,
            high: b.high,
            low: b.low,
            close: b.close,
            volume: b.volume,
            buy_volume: Some(b.buy_volume),
        }
    }
}

impl JsBar {
    fn into_bar(self) -> Bar {
        Bar {
            timestamp: self.timestamp,
            open: self.open,
            high: self.high,
            low: self.low,
            close: self.close,
            volume: self.volume,
            buy_volume: self.buy_volume.unwrap_or(0.0),
        }
    }
}

#[napi(object)]
pub struct JsSignal {
    pub side: String,
    pub strength: f64,
    pub reason: String,
    pub timestamp: i64,
}

#[napi(object)]
pub struct JsDslSignal {
    #[napi(js_name = "strategyId")]
    pub strategy_id: u32,
    pub action: String,
    pub timestamp: i64,
}

#[napi(object)]
pub struct JsIndicatorResult {
    pub value: f64,
    pub timestamp: i64,
    pub extra: Option<Vec<f64>>,
}

#[napi(object)]
pub struct JsAggregatorEvent {
    pub kind: String,
    pub period: String,
    pub candle: Option<JsBar>,
}

#[napi(object)]
pub struct JsIndicatorConfig {
    #[napi(js_name = "type")]
    pub kind: String,
    pub period: Option<u32>,
    pub fast: Option<u32>,
    pub slow: Option<u32>,
    pub signal: Option<u32>,
    #[napi(js_name = "stdDev")]
    pub std_dev: Option<f64>,
    pub multiplier: Option<f64>,
}

/// Struct-of-Arrays (SoA) format for historical bar data.
/// This format is optimal for TypedArray zero-copy transfer from JavaScript.
#[napi(object)]
pub struct JsBarsSoA {
    pub timestamp: Vec<i64>,
    pub open: Vec<f64>,
    pub high: Vec<f64>,
    pub low: Vec<f64>,
    pub close: Vec<f64>,
    pub volume: Vec<f64>,
    #[napi(js_name = "buyVolume")]
    pub buy_volume: Option<Vec<f64>>,
}

#[napi]
pub fn validateDsl(source: String) -> Result<bool> {
    validate_dsl(&source)
        .map(|_| true)
        .map_err(|e| Error::new(Status::InvalidArg, e.to_string()))
}

#[napi]
pub struct Engine {
    bars: KlineBuffer,
    indicators: crate::indicators::IndicatorGraph,
    named: HashMap<String, IndicatorId>,
    aggregator: Option<Aggregator>,
    signals: Vec<JsSignal>,
}

#[napi]
impl Engine {
    #[napi(constructor)]
    pub fn new(capacity: u32) -> Self {
        let cap = capacity as usize;
        Self {
            bars: KlineBuffer::new(cap),
            indicators: crate::indicators::IndicatorGraph::new(cap),
            named: HashMap::new(),
            aggregator: None,
            signals: Vec::new(),
        }
    }

    #[napi(js_name = "addIndicator")]
    pub fn addIndicator(&mut self, name: String, config: JsIndicatorConfig) -> Result<()> {
        let spec = indicator_spec_from_config(&config)
            .map_err(|e| Error::new(Status::InvalidArg, e))?;
        let id = self.indicators.add_indicator(spec);
        self.named.insert(name, id);
        Ok(())
    }

    #[napi(js_name = "setupAggregator")]
    pub fn setupAggregator(&mut self, base_tf: String, target_tfs: Vec<String>, _capacity: u32) -> Result<()> {
        let base = Period::parse(&base_tf).map_err(|e| Error::new(Status::InvalidArg, e.to_string()))?;
        let mut periods = vec![base];
        for p in target_tfs {
            periods.push(Period::parse(&p).map_err(|e| Error::new(Status::InvalidArg, e.to_string()))?);
        }
        self.aggregator = if periods.len() > 1 {
            Some(Aggregator::new(periods))
        } else {
            None
        };
        Ok(())
    }

    #[napi(js_name = "pushKline")]
    pub fn pushKline(&mut self, bar: JsBar) -> Result<Vec<JsSignal>> {
        self.push_bar_internal(bar.into_bar());
        Ok(Vec::new())
    }

    #[napi(js_name = "updateLast")]
    pub fn updateLast(&mut self, bar: JsBar) -> Result<()> {
        let bar = bar.into_bar();
        let Some(old) = self.bars.update_last(bar) else {
            return Ok(());
        };
        self.indicators.on_update_last(old, bar, &self.bars);
        if let Some(agg) = self.aggregator.as_mut() {
            agg.update_last(&bar);
        }
        Ok(())
    }

    #[napi(js_name = "feedKline")]
    pub fn feedKline(&mut self, bar: JsBar) -> Result<Vec<JsAggregatorEvent>> {
        let bar = bar.into_bar();
        self.push_bar_internal(bar);
        let Some(agg) = self.aggregator.as_mut() else {
            return Ok(Vec::new());
        };
        agg.push(&bar);
        Ok(convert_agg_events(agg.poll_events()))
    }

    #[napi(js_name = "getLastBar")]
    pub fn getLastBar(&self) -> Option<JsBar> {
        self.bars.last().map(JsBar::from)
    }

    #[napi(js_name = "getKlineCount")]
    pub fn getKlineCount(&self) -> u32 {
        self.bars.len() as u32
    }

    #[napi(js_name = "getIndicatorValue")]
    pub fn getIndicatorValue(&self, name: String) -> Option<f64> {
        let id = *self.named.get(&name)?;
        let v = self.indicators.indicator_last(id)?;
        match v {
            IndicatorValue::F64(x) => Some(x),
            IndicatorValue::Boll(b) => Some(b.mid),
            IndicatorValue::Macd(m) => Some(m.macd),
        }
    }

    #[napi(js_name = "getIndicatorResult")]
    pub fn getIndicatorResult(&self, name: String) -> Option<JsIndicatorResult> {
        let id = *self.named.get(&name)?;
        let ts = self.bars.last()?.timestamp;
        let v = self.indicators.indicator_last(id)?;
        match v {
            IndicatorValue::F64(x) => Some(JsIndicatorResult {
                value: x,
                timestamp: ts,
                extra: None,
            }),
            IndicatorValue::Boll(b) => Some(JsIndicatorResult {
                value: b.mid,
                timestamp: ts,
                extra: Some(vec![b.upper, b.lower]),
            }),
            IndicatorValue::Macd(m) => Some(JsIndicatorResult {
                value: m.macd,
                timestamp: ts,
                extra: Some(vec![m.hist, m.signal]),
            }),
        }
    }

    #[napi(js_name = "isIndicatorReady")]
    pub fn isIndicatorReady(&self, name: String) -> bool {
        let Some(v) = self.getIndicatorValue(name) else {
            return false;
        };
        v.is_finite() && !v.is_nan()
    }

    #[napi(js_name = "pollSignals")]
    pub fn pollSignals(&mut self) -> Vec<JsSignal> {
        self.signals.drain(..).collect()
    }

    #[napi]
    pub fn reset(&mut self) {
        self.bars.clear();
        self.indicators.reset();
        self.named.clear();
        self.signals.clear();
        self.aggregator = None;
    }

    fn push_bar_internal(&mut self, bar: Bar) {
        self.bars.push(bar);
        self.indicators.on_push(&self.bars);
    }
}

#[napi]
pub struct HQuant {
    inner: crate::hquant::HQuant,
    named: HashMap<String, IndicatorId>,
    aggregator: Option<Aggregator>,
}

#[napi]
impl HQuant {
    #[napi(constructor)]
    pub fn new(capacity: u32, periods: Option<Vec<String>>) -> Result<Self> {
        let mut aggregator = None;
        if let Some(periods) = periods {
            if periods.len() >= 2 {
                let mut ps = Vec::with_capacity(periods.len());
                for p in periods {
                    ps.push(Period::parse(&p).map_err(|e| Error::new(Status::InvalidArg, e.to_string()))?);
                }
                aggregator = Some(Aggregator::new(ps));
            }
        }
        Ok(Self {
            inner: crate::hquant::HQuant::new(capacity as usize),
            named: HashMap::new(),
            aggregator,
        })
    }

    #[napi(js_name = "addIndicator")]
    pub fn addIndicator(&mut self, name: String, config: JsIndicatorConfig) -> Result<()> {
        let spec = indicator_spec_from_config(&config)
            .map_err(|e| Error::new(Status::InvalidArg, e))?;
        let id = self.inner.add_indicator(spec);
        self.named.insert(name, id);
        Ok(())
    }

    #[napi(js_name = "addStrategy")]
    pub fn addStrategy(&mut self, name: String, dsl: String) -> Result<u32> {
        self.inner
            .add_strategy(&name, &dsl)
            .map_err(|e| Error::new(Status::InvalidArg, e.to_string()))
    }

    #[napi(js_name = "feedKline")]
    pub fn feedKline(&mut self, bar: JsBar) -> Result<Vec<JsAggregatorEvent>> {
        let bar = bar.into_bar();
        self.inner.push_kline(bar);
        let Some(agg) = self.aggregator.as_mut() else {
            return Ok(Vec::new());
        };
        agg.push(&bar);
        Ok(convert_agg_events(agg.poll_events()))
    }

    #[napi(js_name = "pushBar")]
    pub fn pushBar(&mut self, bar: JsBar) -> Result<()> {
        self.inner.push_kline(bar.into_bar());
        Ok(())
    }

    #[napi(js_name = "pushKline")]
    pub fn pushKline(&mut self, bar: JsBar) -> Result<Vec<JsSignal>> {
        self.inner.push_kline(bar.into_bar());
        Ok(Vec::new())
    }

    #[napi(js_name = "updateLast")]
    pub fn updateLast(&mut self, bar: JsBar) -> Result<()> {
        self.inner.update_last(bar.into_bar());
        Ok(())
    }

    #[napi(js_name = "pollSignals")]
    pub fn pollSignals(&mut self) -> Vec<JsDslSignal> {
        self.inner
            .poll_signals()
            .into_iter()
            .map(|s| JsDslSignal {
                strategy_id: s.strategy_id,
                action: s.action.as_str().to_string(),
                timestamp: s.timestamp,
            })
            .collect()
    }

    #[napi(js_name = "getIndicatorValue")]
    pub fn getIndicatorValue(&self, name: String) -> Option<f64> {
        let id = *self.named.get(&name)?;
        let v = self.inner.indicator_last(id)?;
        match v {
            IndicatorValue::F64(x) => Some(x),
            IndicatorValue::Boll(b) => Some(b.mid),
            IndicatorValue::Macd(m) => Some(m.macd),
        }
    }

    #[napi(js_name = "getIndicatorResult")]
    pub fn getIndicatorResult(&self, name: String) -> Option<JsIndicatorResult> {
        let id = *self.named.get(&name)?;
        let ts = self.inner.bars().last()?.timestamp;
        let v = self.inner.indicator_last(id)?;
        match v {
            IndicatorValue::F64(x) => Some(JsIndicatorResult {
                value: x,
                timestamp: ts,
                extra: None,
            }),
            IndicatorValue::Boll(b) => Some(JsIndicatorResult {
                value: b.mid,
                timestamp: ts,
                extra: Some(vec![b.upper, b.lower]),
            }),
            IndicatorValue::Macd(m) => Some(JsIndicatorResult {
                value: m.macd,
                timestamp: ts,
                extra: Some(vec![m.hist, m.signal]),
            }),
        }
    }

    #[napi(js_name = "isIndicatorReady")]
    pub fn isIndicatorReady(&self, name: String) -> bool {
        let Some(v) = self.getIndicatorValue(name) else {
            return false;
        };
        v.is_finite() && !v.is_nan()
    }

    #[napi(js_name = "loadStore")]
    pub fn loadStore(&mut self, name: String, vectors: Vec<JsLabeledVector>) -> Result<()> {
        let vecs = vectors
            .into_iter()
            .map(|v| LabeledVector {
                label: v.label,
                vector: v.vector,
                ts: None,
            })
            .collect();
        self.inner.load_store(&name, vecs);
        Ok(())
    }

    #[napi(js_name = "setThreshold")]
    pub fn setThreshold(&mut self, threshold: f64) -> Result<()> {
        if !threshold.is_finite() || !(-1.0..=1.0).contains(&threshold) {
            return Err(Error::new(
                Status::InvalidArg,
                "threshold must be finite in [-1,1]".to_string(),
            ));
        }
        self.inner.set_similarity_threshold(threshold);
        Ok(())
    }

    /// Load historical data from Struct-of-Arrays format (optimal for TypedArray).
    /// All arrays must have the same length.
    #[napi(js_name = "loadHistory")]
    pub fn loadHistory(&mut self, data: JsBarsSoA) -> Result<()> {
        let n = data.timestamp.len();
        if data.open.len() != n
            || data.high.len() != n
            || data.low.len() != n
            || data.close.len() != n
            || data.volume.len() != n
        {
            return Err(Error::new(
                Status::InvalidArg,
                "all arrays must have the same length".to_string(),
            ));
        }

        let buy_volume = data.buy_volume.unwrap_or_else(|| vec![0.0; n]);
        if buy_volume.len() != n {
            return Err(Error::new(
                Status::InvalidArg,
                "buyVolume array must have the same length".to_string(),
            ));
        }

        let bars: Vec<Bar> = (0..n)
            .map(|i| Bar {
                timestamp: data.timestamp[i],
                open: data.open[i],
                high: data.high[i],
                low: data.low[i],
                close: data.close[i],
                volume: data.volume[i],
                buy_volume: buy_volume[i],
            })
            .collect();

        self.inner.load_history(&bars);
        Ok(())
    }

    #[napi]
    pub fn reset(&mut self) {
        self.inner.reset();
        self.named.clear();
        self.aggregator = None;
    }
}

#[napi]
pub struct MultiHQuant {
    inner: CoreMultiHQuant,
}

#[napi]
impl MultiHQuant {
    #[napi(constructor)]
    pub fn new(capacity: u32, periods: Vec<String>) -> Result<Self> {
        if periods.is_empty() {
            return Err(Error::new(Status::InvalidArg, "periods must be non-empty".to_string()));
        }
        let mut ps = Vec::with_capacity(periods.len());
        for p in periods {
            ps.push(Period::parse(&p).map_err(|e| Error::new(Status::InvalidArg, e.to_string()))?);
        }
        Ok(Self {
            inner: CoreMultiHQuant::new(capacity as usize, ps),
        })
    }

    #[napi(js_name = "addMultiStrategy")]
    pub fn addMultiStrategy(&mut self, name: String, dsl: String) -> Result<u32> {
        self.inner
            .add_multi_strategy(&name, &dsl)
            .map_err(|e| Error::new(Status::InvalidArg, e.to_string()))
    }

    #[napi(js_name = "feedBar")]
    pub fn feedBar(&mut self, bar: JsBar) {
        self.inner.feed_bar(bar.into_bar());
    }

    /// Load historical data from Struct-of-Arrays format (optimal for TypedArray).
    /// All arrays must have the same length.
    #[napi(js_name = "loadHistory")]
    pub fn loadHistory(&mut self, data: JsBarsSoA) -> Result<()> {
        let n = data.timestamp.len();
        if data.open.len() != n
            || data.high.len() != n
            || data.low.len() != n
            || data.close.len() != n
            || data.volume.len() != n
        {
            return Err(Error::new(
                Status::InvalidArg,
                "all arrays must have the same length".to_string(),
            ));
        }

        let buy_volume = data.buy_volume.unwrap_or_else(|| vec![0.0; n]);
        if buy_volume.len() != n {
            return Err(Error::new(
                Status::InvalidArg,
                "buyVolume array must have the same length".to_string(),
            ));
        }

        let bars: Vec<Bar> = (0..n)
            .map(|i| Bar {
                timestamp: data.timestamp[i],
                open: data.open[i],
                high: data.high[i],
                low: data.low[i],
                close: data.close[i],
                volume: data.volume[i],
                buy_volume: buy_volume[i],
            })
            .collect();

        self.inner.load_history(&bars);
        Ok(())
    }

    #[napi(js_name = "updateLast")]
    pub fn updateLast(&mut self, bar: JsBar) {
        self.inner.update_last(bar.into_bar());
    }

    #[napi]
    pub fn flush(&mut self) {
        self.inner.flush();
    }

    #[napi(js_name = "pollSignals")]
    pub fn pollSignals(&mut self) -> Vec<JsDslSignal> {
        self.inner
            .poll_signals()
            .into_iter()
            .map(|s| JsDslSignal {
                strategy_id: s.strategy_id,
                action: s.action.as_str().to_string(),
                timestamp: s.timestamp,
            })
            .collect()
    }
}

#[napi]
pub struct KlineAggregator {
    inner: Aggregator,
}

#[napi]
impl KlineAggregator {
    #[napi(constructor)]
    pub fn new(base_tf: String, target_tfs: Vec<String>, _capacity: u32) -> Result<Self> {
        let base = Period::parse(&base_tf).map_err(|e| Error::new(Status::InvalidArg, e.to_string()))?;
        let mut periods = vec![base];
        for p in target_tfs {
            periods.push(Period::parse(&p).map_err(|e| Error::new(Status::InvalidArg, e.to_string()))?);
        }
        Ok(Self {
            inner: Aggregator::new(periods),
        })
    }

    #[napi(js_name = "pushKline")]
    pub fn pushKline(&mut self, bar: JsBar) -> Result<Vec<JsAggregatorEvent>> {
        let bar = bar.into_bar();
        self.inner.push(&bar);
        Ok(convert_agg_events(self.inner.poll_events()))
    }

    #[napi(js_name = "updateLast")]
    pub fn updateLast(&mut self, bar: JsBar) -> Result<()> {
        self.inner.update_last(&bar.into_bar());
        Ok(())
    }

    #[napi]
    pub fn flush(&mut self) {
        self.inner.flush();
        let _ = self.inner.poll_events();
    }

    #[napi]
    pub fn reset(&mut self) {
        self.inner.reset();
    }
}

#[napi(object)]
pub struct JsLabeledVector {
    pub label: i32,
    pub vector: Vec<f64>,
}

#[napi]
pub struct DslStrategy {
    bars: KlineBuffer,
    graph: crate::indicators::IndicatorGraph,
    strategy: CompiledStrategy,
    store: VectorStore,
}

#[napi]
impl DslStrategy {
    #[napi(constructor)]
    pub fn new(source: String) -> Result<Self> {
        let capacity = 4096usize;
        let mut graph = crate::indicators::IndicatorGraph::new(capacity);
        let strategy = compile_strategy(1, "dsl", &source, &mut graph)
            .map_err(|e| Error::new(Status::InvalidArg, e.to_string()))?;
        Ok(Self {
            bars: KlineBuffer::new(capacity),
            graph,
            strategy,
            store: VectorStore::new(),
        })
    }

    #[napi(js_name = "loadStore")]
    pub fn loadStore(&mut self, name: String, vectors: Vec<JsLabeledVector>) -> Result<()> {
        let vecs = vectors
            .into_iter()
            .map(|v| LabeledVector {
                label: v.label,
                vector: v.vector,
                ts: None,
            })
            .collect();
        self.store.load(&name, vecs);
        Ok(())
    }

    #[napi(js_name = "setThreshold")]
    pub fn setThreshold(&mut self, threshold: f64) -> Result<()> {
        if !threshold.is_finite() || !(0.0..=1.0).contains(&threshold) {
            return Err(Error::new(Status::InvalidArg, "threshold must be in [0,1]".to_string()));
        }
        self.store.threshold = threshold;
        Ok(())
    }

    #[napi]
    pub fn evaluate(&mut self, bar: JsBar, _indicators: HashMap<String, f64>) -> Result<Vec<JsSignal>> {
        let bar = bar.into_bar();
        self.bars.push(bar);
        self.graph.on_push(&self.bars);
        let Some(sig) = self.strategy.evaluate(&self.bars, &self.graph, Some(&self.store)) else {
            return Ok(Vec::new());
        };
        Ok(vec![JsSignal {
            side: sig.action.as_str().to_string(),
            strength: 1.0,
            reason: sig.meta.unwrap_or_else(|| "dsl".to_string()),
            timestamp: sig.timestamp,
        }])
    }

    #[napi]
    pub fn reset(&mut self) {
        self.bars.clear();
        self.graph.reset();
    }
}

#[napi(object)]
pub struct JsBacktestConfig {
    #[napi(js_name = "marketType")]
    pub market_type: Option<String>,
    #[napi(js_name = "initialCapital")]
    pub initial_capital: f64,
    pub leverage: Option<f64>,
    #[napi(js_name = "makerFee")]
    pub maker_fee: Option<f64>,
    #[napi(js_name = "takerFee")]
    pub taker_fee: Option<f64>,
}

#[napi]
pub struct Backtest {
    inner: SimpleBacktest,
}

#[napi]
impl Backtest {
    #[napi(constructor)]
    pub fn new(config: JsBacktestConfig) -> Result<Self> {
        let market_type = match config
            .market_type
            .as_deref()
            .unwrap_or("spot")
            .to_ascii_lowercase()
            .as_str()
        {
            "spot" => MarketType::Spot,
            "futures" => MarketType::Futures,
            _ => MarketType::Spot,
        };
        let cfg = SimpleBacktestConfig {
            market_type,
            initial_capital: config.initial_capital,
            leverage: config.leverage.unwrap_or(1.0),
            maker_fee_rate: config.maker_fee.unwrap_or(0.0),
            taker_fee_rate: config.taker_fee.unwrap_or(0.0),
        };
        Ok(Self {
            inner: SimpleBacktest::new(cfg),
        })
    }

    #[napi(js_name = "openPosition")]
    pub fn openPosition(&mut self, price: f64, size: f64, position_side: String) {
        if let Some(side) = parse_position_side(&position_side) {
            self.inner.open_position(price, size, side);
        }
    }

    #[napi(js_name = "closePosition")]
    pub fn closePosition(&mut self, price: f64, position_side: String) {
        if let Some(side) = parse_position_side(&position_side) {
            self.inner.close_position(price, side);
        }
    }

    #[napi]
    pub fn result(&self) -> JsBacktestStats {
        self.inner.result().into()
    }

    #[napi(js_name = "getTrades")]
    pub fn getTrades(&self) -> Vec<JsTrade> {
        self.inner.trades().iter().copied().map(JsTrade::from).collect()
    }

    #[napi(js_name = "getEquityCurve")]
    pub fn getEquityCurve(&self) -> Vec<f64> {
        self.inner.equity_curve().to_vec()
    }

    #[napi(js_name = "getEquity")]
    pub fn getEquity(&self) -> f64 {
        self.inner.equity()
    }

    #[napi]
    pub fn reset(&mut self) {
        self.inner.reset();
    }
}

#[napi(object)]
pub struct JsTrade {
    pub timestamp: i64,
    pub side: String,
    pub price: f64,
    pub size: f64,
    pub fee: f64,
    pub pnl: f64,
}

impl From<Trade> for JsTrade {
    fn from(t: Trade) -> Self {
        Self {
            timestamp: t.timestamp,
            side: match t.side {
                PositionSide::Long => "LONG",
                PositionSide::Short => "SHORT",
            }
            .to_string(),
            price: t.price,
            size: t.size,
            fee: t.fee,
            pnl: t.pnl,
        }
    }
}

#[napi(object)]
pub struct JsBacktestStats {
    #[napi(js_name = "totalTrades")]
    pub total_trades: u32,
    #[napi(js_name = "winningTrades")]
    pub winning_trades: u32,
    #[napi(js_name = "losingTrades")]
    pub losing_trades: u32,
    #[napi(js_name = "totalPnl")]
    pub total_pnl: f64,
    #[napi(js_name = "maxDrawdown")]
    pub max_drawdown: f64,
    #[napi(js_name = "maxDrawdownPct")]
    pub max_drawdown_pct: f64,
    #[napi(js_name = "sharpeRatio")]
    pub sharpe_ratio: f64,
    #[napi(js_name = "winRate")]
    pub win_rate: f64,
    #[napi(js_name = "finalEquity")]
    pub final_equity: f64,
    #[napi(js_name = "returnPct")]
    pub return_pct: f64,
    pub liquidations: u32,
}

impl From<BacktestStats> for JsBacktestStats {
    fn from(s: BacktestStats) -> Self {
        Self {
            total_trades: s.total_trades,
            winning_trades: s.winning_trades,
            losing_trades: s.losing_trades,
            total_pnl: s.total_pnl,
            max_drawdown: s.max_drawdown,
            max_drawdown_pct: s.max_drawdown_pct,
            sharpe_ratio: s.sharpe_ratio,
            win_rate: s.win_rate,
            final_equity: s.final_equity,
            return_pct: s.return_pct,
            liquidations: s.liquidations,
        }
    }
}

#[napi(object)]
pub struct JsFuturesBacktestConfig {
    #[napi(js_name = "initialMargin")]
    pub initial_margin: f64,
    pub leverage: f64,
    #[napi(js_name = "contractSize")]
    pub contract_size: f64,
    #[napi(js_name = "makerFeeRate")]
    pub maker_fee_rate: f64,
    #[napi(js_name = "takerFeeRate")]
    pub taker_fee_rate: f64,
    #[napi(js_name = "maintenanceMarginRate")]
    pub maintenance_margin_rate: f64,
}

#[napi(object)]
pub struct JsFuturesBacktestResult {
    pub equity: f64,
    pub profit: f64,
    #[napi(js_name = "profitRate")]
    pub profit_rate: f64,
    #[napi(js_name = "maxDrawdownRate")]
    pub max_drawdown_rate: f64,
    pub liquidated: bool,
}

impl From<BacktestResult> for JsFuturesBacktestResult {
    fn from(r: BacktestResult) -> Self {
        Self {
            equity: r.equity,
            profit: r.profit,
            profit_rate: r.profit_rate,
            max_drawdown_rate: r.max_drawdown_rate,
            liquidated: r.liquidated,
        }
    }
}

#[napi(object)]
pub struct JsFuturesPosition {
    #[napi(js_name = "positionSide")]
    pub position_side: String,
    #[napi(js_name = "entryPrice")]
    pub entry_price: f64,
    #[napi(js_name = "markPrice")]
    pub mark_price: f64,
    #[napi(js_name = "positionAmt")]
    pub position_amt: f64,
    pub margin: f64,
    #[napi(js_name = "unrealizedPnl")]
    pub unrealized_pnl: f64,
}

impl From<FuturesPosition> for JsFuturesPosition {
    fn from(p: FuturesPosition) -> Self {
        Self {
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
        }
    }
}

#[napi]
pub struct FuturesBacktest {
    inner: CoreFuturesBacktest,
    last_price: f64,
}

#[napi]
impl FuturesBacktest {
    #[napi(constructor)]
    pub fn new(config: JsFuturesBacktestConfig) -> Result<Self> {
        let params = BacktestParams {
            initial_margin: config.initial_margin,
            leverage: config.leverage,
            contract_size: config.contract_size,
            maker_fee_rate: config.maker_fee_rate,
            taker_fee_rate: config.taker_fee_rate,
            maintenance_margin_rate: config.maintenance_margin_rate,
        };
        let inner = CoreFuturesBacktest::try_new(params)
            .ok_or_else(|| Error::new(Status::InvalidArg, "invalid futures backtest params".to_string()))?;
        Ok(Self {
            inner,
            last_price: f64::NAN,
        })
    }

    #[napi(js_name = "applySignal")]
    pub fn applySignal(
        &mut self,
        action: String,
        price: f64,
        margin: f64,
        position_side: Option<String>,
        is_maker: Option<bool>,
    ) -> Result<()> {
        let action = Action::parse(&action).ok_or_else(|| Error::new(Status::InvalidArg, "invalid action".to_string()))?;
        let params = self.inner.params();
        let fee_rate = if is_maker.unwrap_or(false) { params.maker_fee_rate } else { params.taker_fee_rate };

        match position_side.as_deref().and_then(parse_position_side) {
            None => {
                self.inner.apply_signal(action, price, margin);
                self.last_price = price;
                return Ok(());
            }
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

    #[napi(js_name = "openPosition")]
    pub fn openPosition(&mut self, position_side: String, price: f64, margin: f64, is_maker: Option<bool>) {
        let params = self.inner.params();
        let fee_rate = if is_maker.unwrap_or(false) { params.maker_fee_rate } else { params.taker_fee_rate };
        match parse_position_side(&position_side) {
            Some(PositionSide::Long) => self.inner.open_long(price, margin, fee_rate),
            Some(PositionSide::Short) => self.inner.open_short(price, margin, fee_rate),
            None => {}
        }
        self.last_price = price;
    }

    #[napi(js_name = "closePosition")]
    pub fn closePosition(&mut self, position_side: String, price: f64, margin: f64, is_maker: Option<bool>) {
        let params = self.inner.params();
        let fee_rate = if is_maker.unwrap_or(false) { params.maker_fee_rate } else { params.taker_fee_rate };
        match parse_position_side(&position_side) {
            Some(PositionSide::Long) => self.inner.close_long(price, margin, fee_rate),
            Some(PositionSide::Short) => self.inner.close_short(price, margin, fee_rate),
            None => {}
        }
        self.last_price = price;
    }

    #[napi(js_name = "onPrice")]
    pub fn onPrice(&mut self, price: f64) {
        self.inner.on_price(price);
        self.last_price = price;
    }

    #[napi]
    pub fn result(&self, price: f64) -> JsFuturesBacktestResult {
        self.inner.result(price).into()
    }

    #[napi(js_name = "getPositions")]
    pub fn getPositions(&self) -> Vec<JsFuturesPosition> {
        self.inner
            .get_positions(self.last_price)
            .into_iter()
            .map(JsFuturesPosition::from)
            .collect()
    }
}

fn indicator_spec_from_config(cfg: &JsIndicatorConfig) -> std::result::Result<IndicatorSpec, String> {
    let kind = cfg.kind.trim().to_ascii_lowercase();
    match kind.as_str() {
        "ma" | "sma" => {
            let period = cfg.period.ok_or_else(|| "period is required".to_string())? as usize;
            Ok(IndicatorSpec::Sma {
                field: crate::types::Field::Close,
                period,
            })
        }
        "ema" => {
            let period = cfg.period.ok_or_else(|| "period is required".to_string())? as usize;
            Ok(IndicatorSpec::Ema {
                field: crate::types::Field::Close,
                period,
            })
        }
        "stddev" => {
            let period = cfg.period.ok_or_else(|| "period is required".to_string())? as usize;
            Ok(IndicatorSpec::StdDev {
                field: crate::types::Field::Close,
                period,
            })
        }
        "rsi" => {
            let period = cfg.period.ok_or_else(|| "period is required".to_string())? as usize;
            Ok(IndicatorSpec::Rsi { period })
        }
        "macd" => Ok(IndicatorSpec::Macd {
            fast: cfg.fast.ok_or_else(|| "fast is required".to_string())? as usize,
            slow: cfg.slow.ok_or_else(|| "slow is required".to_string())? as usize,
            signal: cfg.signal.ok_or_else(|| "signal is required".to_string())? as usize,
        }),
        "boll" | "bollinger" => {
            let period = cfg.period.ok_or_else(|| "period is required".to_string())? as usize;
            let k = cfg
                .std_dev
                .or(cfg.multiplier)
                .ok_or_else(|| "stdDev/multiplier is required".to_string())?;
            Ok(IndicatorSpec::Boll {
                period,
                k_bits: k.to_bits(),
            })
        }
        other => Err(format!("unsupported indicator type: {other}")),
    }
}

fn parse_position_side(s: &str) -> Option<PositionSide> {
    match s.trim().to_ascii_uppercase().as_str() {
        "LONG" => Some(PositionSide::Long),
        "SHORT" => Some(PositionSide::Short),
        _ => None,
    }
}

fn convert_agg_events(events: Vec<crate::aggregator::AggregatorEvent>) -> Vec<JsAggregatorEvent> {
    events
        .into_iter()
        .map(|e| JsAggregatorEvent {
            kind: match e.kind {
                AggregatorEventKind::KlineClosed => "KlineClosed".to_string(),
            },
            period: e.period.to_string(),
            candle: Some(JsBar::from(Bar::from(e.candle))),
        })
        .collect()
}
