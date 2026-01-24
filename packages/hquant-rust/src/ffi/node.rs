use std::sync::Mutex;

use napi::bindgen_prelude::*;
use napi_derive::napi;

use crate::{
    Bar, QuantEngine, Signal, Side,
    TimeFrame, Aggregator, MultiTimeFrameAggregator,
    BacktestEngine, BacktestConfig, BacktestStats, MarketType, Position, PositionSide, Trade,
    Float64RingBuffer, Int32RingBuffer,
    // Builders
    MABuilder, RSIBuilder, MACDBuilder, ATRBuilder, BOLLBuilder, VRIBuilder,
};

fn to_bar(input: &BarInput) -> Bar {
    Bar {
        timestamp: input.timestamp,
        open: input.open,
        high: input.high,
        low: input.low,
        close: input.close,
        volume: input.volume,
    }
}

fn parse_timeframe(tf: &str) -> napi::Result<TimeFrame> {
    match tf.to_uppercase().as_str() {
        "M1" | "1M" => Ok(TimeFrame::M1),
        "M5" | "5M" => Ok(TimeFrame::M5),
        "M15" | "15M" => Ok(TimeFrame::M15),
        "M30" | "30M" => Ok(TimeFrame::M30),
        "H1" | "1H" => Ok(TimeFrame::H1),
        "H4" | "4H" => Ok(TimeFrame::H4),
        "D1" | "1D" => Ok(TimeFrame::D1),
        "W1" | "1W" => Ok(TimeFrame::W1),
        other => Err(Error::from_reason(format!("Unknown timeframe: {}", other))),
    }
}

fn timeframe_to_string(tf: TimeFrame) -> String {
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
}

#[napi(object)]
pub struct SignalOutput {
    pub side: String,
    pub strength: f64,
    pub reason: String,
    pub timestamp: i64,
}

// ============================================================================
// Indicator Builders
// ============================================================================

/// MA 指标 Builder
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

    /// 设置周期 (默认: 20)
    #[napi]
    pub fn period(&mut self, period: u32) -> &Self {
        self.inner = std::mem::take(&mut self.inner).period(period as usize);
        self
    }

    /// 设置为 SMA (简单移动平均)
    #[napi]
    pub fn sma(&mut self) -> &Self {
        self.inner = std::mem::take(&mut self.inner).sma();
        self
    }

    /// 设置为 EMA (指数移动平均)
    #[napi]
    pub fn ema(&mut self) -> &Self {
        self.inner = std::mem::take(&mut self.inner).ema();
        self
    }

    /// 设置为 WMA (加权移动平均)
    #[napi]
    pub fn wma(&mut self) -> &Self {
        self.inner = std::mem::take(&mut self.inner).wma();
        self
    }
}

/// RSI 指标 Builder
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

    /// 设置周期 (默认: 14)
    #[napi]
    pub fn period(&mut self, period: u32) -> &Self {
        self.inner = std::mem::take(&mut self.inner).period(period as usize);
        self
    }
}

/// MACD 指标 Builder
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

    /// 设置快线周期 (默认: 12)
    #[napi]
    pub fn fast(&mut self, period: u32) -> &Self {
        self.inner = std::mem::take(&mut self.inner).fast(period as usize);
        self
    }

    /// 设置慢线周期 (默认: 26)
    #[napi]
    pub fn slow(&mut self, period: u32) -> &Self {
        self.inner = std::mem::take(&mut self.inner).slow(period as usize);
        self
    }

    /// 设置信号线周期 (默认: 9)
    #[napi]
    pub fn signal(&mut self, period: u32) -> &Self {
        self.inner = std::mem::take(&mut self.inner).signal(period as usize);
        self
    }
}

/// ATR 指标 Builder
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

    /// 设置周期 (默认: 14)
    #[napi]
    pub fn period(&mut self, period: u32) -> &Self {
        self.inner = std::mem::take(&mut self.inner).period(period as usize);
        self
    }
}

/// BOLL 指标 Builder
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

    /// 设置周期 (默认: 20)
    #[napi]
    pub fn period(&mut self, period: u32) -> &Self {
        self.inner = std::mem::take(&mut self.inner).period(period as usize);
        self
    }

    /// 设置标准差倍数 (默认: 2.0)
    #[napi]
    pub fn std_dev(&mut self, factor: f64) -> &Self {
        self.inner = std::mem::take(&mut self.inner).std_dev(factor);
        self
    }

    /// 设置标准差倍数 (别名)
    #[napi]
    pub fn multiplier(&mut self, factor: f64) -> &Self {
        self.std_dev(factor)
    }
}

/// VRI 指标 Builder
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

    /// 设置周期 (默认: 14)
    #[napi]
    pub fn period(&mut self, period: u32) -> &Self {
        self.inner = std::mem::take(&mut self.inner).period(period as usize);
        self
    }
}

// ============================================================================
// Indicators Factory (quant.indicators.xxx())
// ============================================================================

/// 指标工厂
#[napi]
pub struct Indicators;

#[napi]
impl Indicators {
    #[napi(constructor)]
    pub fn new() -> Self {
        Self
    }

    /// 创建 MA 指标 builder
    #[napi]
    pub fn ma(&self) -> MAIndicator {
        MAIndicator::new()
    }

    /// 创建 RSI 指标 builder
    #[napi]
    pub fn rsi(&self) -> RSIIndicator {
        RSIIndicator::new()
    }

    /// 创建 MACD 指标 builder
    #[napi]
    pub fn macd(&self) -> MACDIndicator {
        MACDIndicator::new()
    }

    /// 创建 ATR 指标 builder
    #[napi]
    pub fn atr(&self) -> ATRIndicator {
        ATRIndicator::new()
    }

    /// 创建 BOLL 指标 builder
    #[napi]
    pub fn boll(&self) -> BOLLIndicator {
        BOLLIndicator::new()
    }

    /// 创建 VRI 指标 builder
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
    pub fn new(capacity: u32) -> Self {
        Self {
            inner: Mutex::new(QuantEngine::new(capacity as usize)),
        }
    }

    /// 添加 MA 指标 (使用 builder)
    #[napi]
    pub fn add_ma_indicator(&self, name: String, indicator: &MAIndicator) -> napi::Result<()> {
        let mut engine = self.inner.lock().unwrap();
        let builder = indicator.inner.clone();
        engine.add_indicator(name, builder);
        Ok(())
    }

    /// 添加 RSI 指标 (使用 builder)
    #[napi]
    pub fn add_rsi_indicator(&self, name: String, indicator: &RSIIndicator) -> napi::Result<()> {
        let mut engine = self.inner.lock().unwrap();
        let builder = indicator.inner.clone();
        engine.add_indicator(name, builder);
        Ok(())
    }

    /// 添加 MACD 指标 (使用 builder)
    #[napi]
    pub fn add_macd_indicator(&self, name: String, indicator: &MACDIndicator) -> napi::Result<()> {
        let mut engine = self.inner.lock().unwrap();
        let builder = indicator.inner.clone();
        engine.add_indicator(name, builder);
        Ok(())
    }

    /// 添加 ATR 指标 (使用 builder)
    #[napi]
    pub fn add_atr_indicator(&self, name: String, indicator: &ATRIndicator) -> napi::Result<()> {
        let mut engine = self.inner.lock().unwrap();
        let builder = indicator.inner.clone();
        engine.add_indicator(name, builder);
        Ok(())
    }

    /// 添加 BOLL 指标 (使用 builder)
    #[napi]
    pub fn add_boll_indicator(&self, name: String, indicator: &BOLLIndicator) -> napi::Result<()> {
        let mut engine = self.inner.lock().unwrap();
        let builder = indicator.inner.clone();
        engine.add_indicator(name, builder);
        Ok(())
    }

    /// 添加 VRI 指标 (使用 builder)
    #[napi]
    pub fn add_vri_indicator(&self, name: String, indicator: &VRIIndicator) -> napi::Result<()> {
        let mut engine = self.inner.lock().unwrap();
        let builder = indicator.inner.clone();
        engine.add_indicator(name, builder);
        Ok(())
    }

    /// 追加一根 K 线并返回可能的信号
    #[napi]
    pub fn append_bar(&self, bar: BarInput) -> napi::Result<Vec<SignalOutput>> {
        let mut engine = self.inner.lock().unwrap();
        let signals: Vec<SignalOutput> = engine
            .append_bar(&to_bar(&bar))
            .iter()
            .map(signal_to_output)
            .collect();
        Ok(signals)
    }

    /// 更新最后一根 K 线
    #[napi]
    pub fn update_last_bar(&self, bar: BarInput) -> napi::Result<()> {
        let mut engine = self.inner.lock().unwrap();
        engine.update_last_bar(&to_bar(&bar));
        Ok(())
    }

    /// 批量加载历史数据
    #[napi]
    pub fn load_history(&self, bars: Vec<BarInput>) -> napi::Result<()> {
        let mut engine = self.inner.lock().unwrap();
        let rust_bars: Vec<Bar> = bars.iter().map(to_bar).collect();
        engine.load_history(&rust_bars);
        Ok(())
    }

    /// 获取指标数值
    #[napi]
    pub fn indicator_value(&self, name: String) -> Option<f64> {
        let engine = self.inner.lock().unwrap();
        engine.indicator_value(&name)
    }

    /// 检查指标是否就绪
    #[napi]
    pub fn indicator_ready(&self, name: String) -> bool {
        let engine = self.inner.lock().unwrap();
        engine.indicator_ready(&name)
    }

    /// 重置引擎
    #[napi]
    pub fn reset(&self) {
        let mut engine = self.inner.lock().unwrap();
        engine.reset();
    }
}

// ============================================================================
// Aggregator
// ============================================================================

#[napi(object)]
pub struct AggregatorBarOutput {
    pub timestamp: i64,
    pub open: f64,
    pub high: f64,
    pub low: f64,
    pub close: f64,
    pub volume: f64,
}

fn bar_to_output(bar: &Bar) -> AggregatorBarOutput {
    AggregatorBarOutput {
        timestamp: bar.timestamp,
        open: bar.open,
        high: bar.high,
        low: bar.low,
        close: bar.close,
        volume: bar.volume,
    }
}

/// 周期聚合器
#[napi]
pub struct KlineAggregator {
    inner: Mutex<Aggregator>,
}

#[napi]
impl KlineAggregator {
    /// 创建聚合器
    /// source_tf: 源周期 (M1/M5/M15/M30/H1/H4/D1/W1)
    /// target_tf: 目标周期 (必须是源周期的整数倍)
    /// capacity: 输出缓冲区容量
    #[napi(constructor)]
    pub fn new(source_tf: String, target_tf: String, capacity: u32) -> napi::Result<Self> {
        let source = parse_timeframe(&source_tf)?;
        let target = parse_timeframe(&target_tf)?;
        Ok(Self {
            inner: Mutex::new(Aggregator::new(source, target, capacity as usize)),
        })
    }

    /// 输入一根 K 线，返回是否产生了新的聚合 K 线
    #[napi]
    pub fn push(&self, bar: BarInput) -> bool {
        let mut agg = self.inner.lock().unwrap();
        agg.push(&to_bar(&bar))
    }

    /// 更新当前正在聚合的 K 线
    #[napi]
    pub fn update_last(&self, bar: BarInput) {
        let mut agg = self.inner.lock().unwrap();
        agg.update_last(&to_bar(&bar));
    }

    /// 获取当前正在聚合的 K 线（未完成）
    #[napi]
    pub fn current(&self) -> Option<AggregatorBarOutput> {
        let agg = self.inner.lock().unwrap();
        agg.current().map(bar_to_output)
    }

    /// 获取最后一根已完成的聚合 K 线
    #[napi]
    pub fn last_completed(&self) -> Option<AggregatorBarOutput> {
        let agg = self.inner.lock().unwrap();
        agg.last_completed().map(|b| bar_to_output(&b))
    }

    /// 强制完成当前聚合
    #[napi]
    pub fn flush(&self) -> Option<AggregatorBarOutput> {
        let mut agg = self.inner.lock().unwrap();
        agg.flush().map(|b| bar_to_output(&b))
    }

    /// 获取已完成的聚合 K 线数量
    #[napi]
    pub fn output_len(&self) -> u32 {
        let agg = self.inner.lock().unwrap();
        agg.output().len() as u32
    }

    /// 重置聚合器
    #[napi]
    pub fn reset(&self) {
        let mut agg = self.inner.lock().unwrap();
        agg.reset();
    }
}

/// 多周期聚合管理器
#[napi]
pub struct MultiTimeFrameKlineAggregator {
    inner: Mutex<MultiTimeFrameAggregator>,
}

#[napi]
impl MultiTimeFrameKlineAggregator {
    /// 创建多周期聚合器
    /// base_tf: 基础周期
    /// target_tfs: 目标周期数组
    /// capacity: 每个周期的输出缓冲区容量
    #[napi(constructor)]
    pub fn new(base_tf: String, target_tfs: Vec<String>, capacity: u32) -> napi::Result<Self> {
        let base = parse_timeframe(&base_tf)?;
        let targets: Result<Vec<TimeFrame>, _> = target_tfs.iter().map(|s| parse_timeframe(s)).collect();
        let targets = targets?;
        Ok(Self {
            inner: Mutex::new(MultiTimeFrameAggregator::new(base, &targets, capacity as usize)),
        })
    }

    /// 输入一根基础周期 K 线，返回产生了新 K 线的周期列表
    #[napi]
    pub fn push(&self, bar: BarInput) -> Vec<String> {
        let mut mtf = self.inner.lock().unwrap();
        mtf.push(&to_bar(&bar))
            .into_iter()
            .map(timeframe_to_string)
            .collect()
    }

    /// 更新所有聚合器的最后一根 K 线
    #[napi]
    pub fn update_last(&self, bar: BarInput) {
        let mut mtf = self.inner.lock().unwrap();
        mtf.update_last(&to_bar(&bar));
    }

    /// 获取指定周期的当前 K 线
    #[napi]
    pub fn current(&self, tf: String) -> napi::Result<Option<AggregatorBarOutput>> {
        let mtf = self.inner.lock().unwrap();
        let tf = parse_timeframe(&tf)?;
        Ok(mtf.current(tf).map(bar_to_output))
    }

    /// 强制完成所有聚合
    #[napi]
    pub fn flush_all(&self) {
        let mut mtf = self.inner.lock().unwrap();
        mtf.flush_all();
    }

    /// 重置所有聚合器
    #[napi]
    pub fn reset(&self) {
        let mut mtf = self.inner.lock().unwrap();
        mtf.reset();
    }
}

// ============================================================================
// Backtest
// ============================================================================

#[napi(object)]
pub struct BacktestConfigInput {
    /// 市场类型: "spot" 或 "futures"
    pub market_type: String,
    /// 初始资金
    pub initial_capital: f64,
    /// 杠杆 (合约有效)
    pub leverage: Option<f64>,
    /// 挂单手续费率
    pub maker_fee: Option<f64>,
    /// 吃单手续费率
    pub taker_fee: Option<f64>,
    /// 滑点率
    pub slippage: Option<f64>,
    /// 每次开仓占总资金比例
    pub position_size_pct: Option<f64>,
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
    pub profit_factor: f64,
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

#[napi(object)]
pub struct PositionOutput {
    pub side: String,
    pub size: f64,
    pub entry_price: f64,
    pub leverage: f64,
    pub liquidation_price: f64,
    pub unrealized_pnl: f64,
    pub timestamp: i64,
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
        profit_factor: stats.profit_factor,
        final_equity: stats.final_equity,
        return_pct: stats.return_pct,
        liquidations: stats.liquidations as u32,
    }
}

fn trade_to_output(trade: &Trade) -> TradeOutput {
    TradeOutput {
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

fn position_to_output(pos: &Position) -> PositionOutput {
    PositionOutput {
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

/// 回测引擎
#[napi]
pub struct Backtest {
    inner: Mutex<BacktestEngine>,
}

#[napi]
impl Backtest {
    /// 创建回测引擎
    #[napi(constructor)]
    pub fn new(config: BacktestConfigInput) -> napi::Result<Self> {
        let market_type = match config.market_type.to_lowercase().as_str() {
            "spot" => MarketType::Spot,
            "futures" => MarketType::Futures,
            other => return Err(Error::from_reason(format!("Unknown market type: {}", other))),
        };

        let cfg = BacktestConfig {
            market_type,
            initial_capital: config.initial_capital,
            leverage: config.leverage.unwrap_or(1.0),
            maker_fee: config.maker_fee.unwrap_or(0.001),
            taker_fee: config.taker_fee.unwrap_or(0.001),
            slippage: config.slippage.unwrap_or(0.0005),
            position_size_pct: config.position_size_pct.unwrap_or(0.1),
        };

        Ok(Self {
            inner: Mutex::new(BacktestEngine::new(cfg)),
        })
    }

    /// 创建现货回测引擎
    #[napi(factory)]
    pub fn spot(initial_capital: f64) -> Self {
        Self {
            inner: Mutex::new(BacktestEngine::new(BacktestConfig::spot(initial_capital))),
        }
    }

    /// 创建合约回测引擎
    #[napi(factory)]
    pub fn futures(initial_capital: f64, leverage: f64) -> Self {
        Self {
            inner: Mutex::new(BacktestEngine::new(BacktestConfig::futures(initial_capital, leverage))),
        }
    }

    /// 处理买入信号
    #[napi]
    pub fn buy(&self, bar: BarInput, strength: Option<f64>, reason: Option<String>) {
        let mut bt = self.inner.lock().unwrap();
        let signal = Signal::buy(
            strength.unwrap_or(1.0),
            reason.unwrap_or_else(|| "buy".to_string()),
            bar.timestamp,
        );
        bt.process_signal(&signal, &to_bar(&bar));
    }

    /// 处理卖出信号
    #[napi]
    pub fn sell(&self, bar: BarInput, strength: Option<f64>, reason: Option<String>) {
        let mut bt = self.inner.lock().unwrap();
        let signal = Signal::sell(
            strength.unwrap_or(1.0),
            reason.unwrap_or_else(|| "sell".to_string()),
            bar.timestamp,
        );
        bt.process_signal(&signal, &to_bar(&bar));
    }

    /// 处理持有（更新价格）
    #[napi]
    pub fn hold(&self, bar: BarInput) {
        let mut bt = self.inner.lock().unwrap();
        let signal = Signal::hold(bar.timestamp);
        bt.process_signal(&signal, &to_bar(&bar));
    }

    /// 获取回测结果
    #[napi]
    pub fn result(&self) -> BacktestStatsOutput {
        let mut bt = self.inner.lock().unwrap();
        stats_to_output(bt.result())
    }

    /// 获取交易记录
    #[napi]
    pub fn trades(&self) -> Vec<TradeOutput> {
        let bt = self.inner.lock().unwrap();
        bt.trades().iter().map(trade_to_output).collect()
    }

    /// 获取权益曲线
    #[napi]
    pub fn equity_curve(&self) -> Vec<f64> {
        let bt = self.inner.lock().unwrap();
        bt.equity_curve().to_vec()
    }

    /// 获取当前持仓
    #[napi]
    pub fn position(&self) -> Option<PositionOutput> {
        let bt = self.inner.lock().unwrap();
        bt.position().map(position_to_output)
    }

    /// 获取当前权益
    #[napi]
    pub fn equity(&self) -> f64 {
        let bt = self.inner.lock().unwrap();
        bt.equity()
    }

    /// 重置引擎
    #[napi]
    pub fn reset(&self) {
        let mut bt = self.inner.lock().unwrap();
        bt.reset();
    }
}

// ============================================================================
// Float64Buffer (类似 Float64Array 的环形缓冲区)
// ============================================================================

/// Float64 环形缓冲区 (类似 Float64Array)
#[napi]
pub struct Float64Buffer {
    inner: Mutex<Float64RingBuffer>,
}

#[napi]
impl Float64Buffer {
    #[napi(constructor)]
    pub fn new(capacity: u32) -> Self {
        Self {
            inner: Mutex::new(Float64RingBuffer::new(capacity as usize)),
        }
    }

    /// 追加元素，队列满时覆盖最旧数据
    #[napi]
    pub fn push(&self, value: f64) {
        let mut rb = self.inner.lock().unwrap();
        rb.push(value);
    }

    /// 从队首移除并返回元素
    #[napi]
    pub fn shift(&self) -> Option<f64> {
        let mut rb = self.inner.lock().unwrap();
        rb.shift()
    }

    /// 从队尾移除并返回元素
    #[napi]
    pub fn pop(&self) -> Option<f64> {
        let mut rb = self.inner.lock().unwrap();
        rb.pop()
    }

    /// 更新指定索引的值
    #[napi]
    pub fn update(&self, index: u32, value: f64) -> bool {
        let mut rb = self.inner.lock().unwrap();
        rb.update(index as usize, value)
    }

    /// 更新最后一个元素
    #[napi]
    pub fn update_last(&self, value: f64) -> bool {
        let mut rb = self.inner.lock().unwrap();
        rb.update_last(value)
    }

    /// 获取指定索引的值
    #[napi]
    pub fn get(&self, index: u32) -> Option<f64> {
        let rb = self.inner.lock().unwrap();
        rb.get(index as usize)
    }

    /// 获取最后一个元素
    #[napi]
    pub fn last(&self) -> Option<f64> {
        let rb = self.inner.lock().unwrap();
        rb.last()
    }

    /// 获取倒数第 n 个元素 (1 = 最后一个)
    #[napi]
    pub fn get_from_end(&self, n: u32) -> Option<f64> {
        let rb = self.inner.lock().unwrap();
        rb.get_from_end(n as usize)
    }

    /// 当前元素数量
    #[napi]
    pub fn len(&self) -> u32 {
        let rb = self.inner.lock().unwrap();
        rb.len() as u32
    }

    /// 是否为空
    #[napi]
    pub fn is_empty(&self) -> bool {
        let rb = self.inner.lock().unwrap();
        rb.is_empty()
    }

    /// 是否已满
    #[napi]
    pub fn is_full(&self) -> bool {
        let rb = self.inner.lock().unwrap();
        rb.is_full()
    }

    /// 容量
    #[napi]
    pub fn capacity(&self) -> u32 {
        let rb = self.inner.lock().unwrap();
        rb.capacity() as u32
    }

    /// 清空
    #[napi]
    pub fn clear(&self) {
        let mut rb = self.inner.lock().unwrap();
        rb.clear();
    }

    /// 转换为数组
    #[napi]
    pub fn to_array(&self) -> Vec<f64> {
        let rb = self.inner.lock().unwrap();
        rb.to_vec()
    }
}

// ============================================================================
// Int32Buffer (类似 Int32Array 的环形缓冲区)
// ============================================================================

/// Int32 环形缓冲区 (类似 Int32Array)
#[napi]
pub struct Int32Buffer {
    inner: Mutex<Int32RingBuffer>,
}

#[napi]
impl Int32Buffer {
    #[napi(constructor)]
    pub fn new(capacity: u32) -> Self {
        Self {
            inner: Mutex::new(Int32RingBuffer::new(capacity as usize)),
        }
    }

    /// 追加元素，队列满时覆盖最旧数据
    #[napi]
    pub fn push(&self, value: i32) {
        let mut rb = self.inner.lock().unwrap();
        rb.push(value);
    }

    /// 从队首移除并返回元素
    #[napi]
    pub fn shift(&self) -> Option<i32> {
        let mut rb = self.inner.lock().unwrap();
        rb.shift()
    }

    /// 从队尾移除并返回元素
    #[napi]
    pub fn pop(&self) -> Option<i32> {
        let mut rb = self.inner.lock().unwrap();
        rb.pop()
    }

    /// 更新指定索引的值
    #[napi]
    pub fn update(&self, index: u32, value: i32) -> bool {
        let mut rb = self.inner.lock().unwrap();
        rb.update(index as usize, value)
    }

    /// 更新最后一个元素
    #[napi]
    pub fn update_last(&self, value: i32) -> bool {
        let mut rb = self.inner.lock().unwrap();
        rb.update_last(value)
    }

    /// 获取指定索引的值
    #[napi]
    pub fn get(&self, index: u32) -> Option<i32> {
        let rb = self.inner.lock().unwrap();
        rb.get(index as usize)
    }

    /// 获取最后一个元素
    #[napi]
    pub fn last(&self) -> Option<i32> {
        let rb = self.inner.lock().unwrap();
        rb.last()
    }

    /// 获取倒数第 n 个元素 (1 = 最后一个)
    #[napi]
    pub fn get_from_end(&self, n: u32) -> Option<i32> {
        let rb = self.inner.lock().unwrap();
        rb.get_from_end(n as usize)
    }

    /// 当前元素数量
    #[napi]
    pub fn len(&self) -> u32 {
        let rb = self.inner.lock().unwrap();
        rb.len() as u32
    }

    /// 是否为空
    #[napi]
    pub fn is_empty(&self) -> bool {
        let rb = self.inner.lock().unwrap();
        rb.is_empty()
    }

    /// 是否已满
    #[napi]
    pub fn is_full(&self) -> bool {
        let rb = self.inner.lock().unwrap();
        rb.is_full()
    }

    /// 容量
    #[napi]
    pub fn capacity(&self) -> u32 {
        let rb = self.inner.lock().unwrap();
        rb.capacity() as u32
    }

    /// 清空
    #[napi]
    pub fn clear(&self) {
        let mut rb = self.inner.lock().unwrap();
        rb.clear();
    }

    /// 转换为数组
    #[napi]
    pub fn to_array(&self) -> Vec<i32> {
        let rb = self.inner.lock().unwrap();
        rb.to_vec()
    }
}
