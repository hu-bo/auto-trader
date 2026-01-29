# hquant-rs

高性能量化交易引擎，采用 Rust 实现，支持 Node.js 和 Python FFI 绑定。

## 特性

- **高性能数据结构**
  - 环形缓冲区 (RingBuffer) - O(1) 追加，固定内存占用
  - SoA (Struct of Arrays) 列式存储 - 缓存友好，SIMD 优化友好
  - F64RingBuffer - 带缓存的 sum/sum_sq，O(1) 计算均值和方差

- **技术指标**
  - MA (SMA/EMA/WMA) - 移动平均线
  - RSI - 相对强弱指标
  - MACD - 指数平滑异同移动平均线
  - ATR - 平均真实波幅
  - BOLL - 布林带
  - VRI - 成交量比率指标
  - VWAP - 成交量加权平均价格
  - OBV - 能量潮指标

- **K线聚合器**
  - 支持多周期聚合 (1m -> 5m -> 15m -> 1h -> 4h -> 1d)
  - 实时流式处理，适用于 WebSocket 数据流

- **策略系统**
  - 内置策略: RSI 策略、MA 交叉策略、MACD 策略、布林带策略
  - 自定义策略支持 (FnStrategy)
  - 信号强度评估

- **Strategy DSL (领域特定语言)**
  - 声明式策略定义
  - 支持条件表达式: `IF RSI(14) < 30 THEN BUY`
  - 多周期数据访问: `close@4h`
  - 向量相似度匹配: `SIMILARITY(VEC_STORE("patterns"), NORMALIZE(close, length=30))`
  - 变量赋值和函数调用

- **回测引擎**
  - 支持现货和合约市场
  - 杠杆交易模拟
  - 手续费和滑点模拟
  - 合约爆仓模拟
  - 完整统计指标 (胜率、夏普比率、最大回撤等)

- **跨语言支持**
  - Node.js FFI (napi-rs)
  - Python FFI (PyO3)

## 安装

### Rust

```toml
[dependencies]
hquant-rs = { path = "packages/hquant-rs" }
```

### Node.js

```bash
cd packages/hquant-rs
cargo build --release --features ffi-node
```

### Python

```bash
cd packages/hquant-rs
maturin develop --features ffi-python
```

## 使用示例

### Rust

```rust
use hquant_rs::{QuantEngine, Bar, MABuilder, RSIBuilder, IndicatorBuilder};

fn main() -> Result<(), Box<dyn std::error::Error>> {
    // 创建引擎，容量 1000
    let mut engine = QuantEngine::new(1000)?;

    // 添加指标
    engine.add_indicator("sma20", MABuilder::new().period(20).sma())?;
    engine.add_indicator("ema10", MABuilder::new().period(10).ema())?;
    engine.add_indicator("rsi14", RSIBuilder::new().period(14))?;

    // 推送 K 线数据
    let bar = Bar::new(1704067200000, 42000.0, 42500.0, 41800.0, 42300.0, 1000.0);
    let signals = engine.append_bar(&bar);

    // 获取指标值
    if let Some(sma) = engine.indicator_value("sma20") {
        println!("SMA20: {}", sma);
    }

    // 检查信号
    for signal in signals {
        println!("Signal: {:?} strength={}", signal.side, signal.strength);
    }

    Ok(())
}
```

### Node.js

```typescript
import { HQuant, Backtest } from 'hquant-rs';

// 创建量化引擎
const hquant = new HQuant({
  capacity: 1000,
  baseTf: '1m',
  targetTfs: ['5m', '15m', '1h'],
});

// 添加指标
hquant.addIndicator('rsi', { type: 'rsi', period: 14 });
hquant.addIndicator('macd', { type: 'macd', fast: 12, slow: 26, signal: 9 });
hquant.addIndicator('boll', { type: 'boll', period: 20, stdDev: 2.0 });

// 推送 K 线数据 (适用于 WebSocket 流)
const events = hquant.feedKline({
  timestamp: 1704067200000,
  open: 42000.0,
  high: 42500.0,
  low: 41800.0,
  close: 42300.0,
  volume: 1000.0,
  buyVolume: 600.0,
});

// 处理聚合事件
for (const event of events) {
  if (event.kind === 'KlineClosed') {
    console.log(`${event.period} K线收盘:`, event.candle);
  }
}

// 获取信号
const signals = hquant.pollSignals();
for (const signal of signals) {
  console.log(`信号: ${signal.side} 强度=${signal.strength} 原因=${signal.reason}`);
}

// 获取指标值
const rsi = hquant.getIndicator('rsi');
console.log('RSI:', rsi);

// --- 回测 ---
const backtest = new Backtest({
  marketType: 'futures',
  initialCapital: 10000,
  leverage: 10,
  makerFee: 0.0002,
  takerFee: 0.0005,
});

// 模拟交易
backtest.openPosition(42000, 1.0, 'LONG');
backtest.closePosition(43000, 'LONG');

// 获取结果
const result = backtest.result();
console.log('回测结果:', result);
```

### FuturesBacktest（独立合约回测）

```typescript
import { FuturesBacktest } from 'hquant-rs';

const bt = new FuturesBacktest({
  initialMargin: 1000,
  leverage: 10,
  contractSize: 1,
  makerFeeRate: 0.0004,
  takerFeeRate: 0.0004,
  maintenanceMarginRate: 0.005,
});

// 支持 positionSide（可选），用于明确开/平多空
bt.applySignal('BUY', 100, 100, 'LONG'); // 开/加多
bt.applySignal('SELL', 110, 50, 'LONG'); // 按 margin 部分平多

console.log(bt.getPositions());
console.log(bt.result(110));
```

### Python

```python
from hquant import HQuant, PyBacktest, PyAggregator

# 创建量化引擎
hquant = HQuant(capacity=1000)

# 添加指标
hquant.add_indicator('rsi', {'type': 'rsi', 'period': 14})
hquant.add_indicator('macd', {'type': 'macd', 'fast': 12, 'slow': 26, 'signal': 9})
hquant.add_indicator('boll', {'type': 'boll', 'period': 20, 'std_dev': 2.0})
hquant.add_indicator('vwap', {'type': 'vwap'})

# 推送 K 线
bar = {
    'timestamp': 1704067200000,
    'open': 42000.0,
    'high': 42500.0,
    'low': 41800.0,
    'close': 42300.0,
    'volume': 1000.0,
    'buy_volume': 600.0,
}
signals = hquant.push_kline(bar)

# 获取指标值
rsi = hquant.get_indicator('rsi')
print(f'RSI: {rsi}')

# 获取完整指标结果 (包含额外数据)
macd_result = hquant.get_indicator_result('macd')
if macd_result:
    print(f'MACD: {macd_result["value"]}, extra: {macd_result.get("extra")}')

# --- K 线聚合器 ---
agg = PyAggregator('1m', ['5m', '15m', '1h'], capacity=500)

events = agg.push_kline(bar)
for event in events:
    print(f'{event["period"]} 收盘: {event["candle"]}')

# --- 回测 ---
backtest = PyBacktest(
    initial_margin=10000,
    leverage=10,
    maker_fee_rate=0.0002,
    taker_fee_rate=0.0005,
    market_type='futures'
)

backtest.open_position(42000, 1.0, "LONG")
backtest.close_position(43000, "LONG")

result = backtest.backtest_result()
print(f'总交易: {result["total_trades"]}')
print(f'胜率: {result["win_rate"]:.2%}')
print(f'总盈亏: {result["total_pnl"]:.2f}')
print(f'最大回撤: {result["max_drawdown_pct"]:.2%}')
print(f'夏普比率: {result["sharpe_ratio"]:.2f}')
```

## API 文档

### 指标配置

| 指标类型 | 参数 | 默认值 |
|---------|------|-------|
| `ma` / `sma` | `period` | 20 |
| `ema` | `period` | 20 |
| `wma` | `period` | 20 |
| `rsi` | `period` | 14 |
| `macd` | `fast`, `slow`, `signal` | 12, 26, 9 |
| `atr` | `period` | 14 |
| `boll` | `period`, `std_dev` | 20, 2.0 |
| `vri` | `period` | 14 |
| `vwap` | - | - |
| `obv` | - | - |

### 时间周期

支持的时间周期: `1m`, `3m`, `5m`, `15m`, `30m`, `1h`, `2h`, `4h`, `6h`, `8h`, `12h`, `1d`, `3d`, `1w`, `1M`

### 回测统计

| 字段 | 说明 |
|-----|------|
| `total_trades` | 总交易次数 |
| `winning_trades` | 盈利交易次数 |
| `losing_trades` | 亏损交易次数 |
| `total_pnl` | 总盈亏 |
| `max_drawdown` | 最大回撤金额 |
| `max_drawdown_pct` | 最大回撤百分比 |
| `sharpe_ratio` | 夏普比率 |
| `win_rate` | 胜率 |
| `final_equity` | 最终权益 |
| `return_pct` | 总收益率 |
| `liquidations` | 爆仓次数 |

### 信号

| 字段 | 说明 |
|-----|------|
| `side` | 方向: `BUY`, `SELL`, `HOLD` |
| `strength` | 信号强度 (0.0 - 1.0) |
| `reason` | 信号原因 |
| `timestamp` | 时间戳 |

## 架构设计

```
┌─────────────────────────────────────────────────────────────┐
│                      QuantEngine                             │
├─────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐       │
│  │  KlineSeries │  │  Indicators  │  │  Strategies  │       │
│  │  (SoA)       │  │  (HashMap)   │  │  (Vec)       │       │
│  └──────────────┘  └──────────────┘  └──────────────┘       │
│         │                │                  │                │
│         ▼                ▼                  ▼                │
│  ┌──────────────────────────────────────────────────┐       │
│  │              RingBuffer / F64RingBuffer           │       │
│  │              (固定容量，O(1) 操作)                 │       │
│  └──────────────────────────────────────────────────┘       │
└─────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                  MultiTimeFrameAggregator                    │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐    │
│  │   1m     │──│   5m     │──│   15m    │──│   1h     │    │
│  │ (base)   │  │(partial) │  │(partial) │  │(partial) │    │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘    │
└─────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                     BacktestEngine                           │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐       │
│  │   Position   │  │    Trades    │  │    Stats     │       │
│  │  (当前持仓)  │  │  (历史交易)  │  │  (统计指标)  │       │
│  └──────────────┘  └──────────────┘  └──────────────┘       │
└─────────────────────────────────────────────────────────────┘
```

## Strategy DSL

hquant-rs 提供了一种声明式的 DSL (领域特定语言) 用于定义交易策略。

### DSL 语法

```text
# 变量赋值
ema20 = EMA(close, period=20)

# 向量归一化
vector = NORMALIZE(close, length=30)

# 相似度匹配
hit = SIMILARITY(VEC_STORE("4h_BTC"), vector)

# 条件信号
IF RSI(14) < 30 THEN BUY
IF RSI(14) > 70 THEN SELL

# 复合条件
IF RSI(14) < 30 AND close > EMA(20) THEN BUY

# 多周期访问
close_4h = close@4h
ema_4h = EMA(close@4h, period=20)

# 相似度匹配信号
IF hit.label == 1 THEN BUY
IF hit.label == -1 THEN SELL
```

### 支持的函数

| 函数 | 说明 | 示例 |
|-----|------|------|
| `EMA(series, period=N)` | 指数移动平均 | `EMA(close, period=20)` |
| `SMA(series, period=N)` | 简单移动平均 | `SMA(close, period=20)` |
| `RSI(period)` | 相对强弱指标 | `RSI(14)` |
| `MACD()` | MACD 指标 | `MACD()` |
| `ATR(period)` | 平均真实波幅 | `ATR(14)` |
| `BOLL()` | 布林带 | `BOLL()` |
| `NORMALIZE(series, length=N)` | 向量归一化 | `NORMALIZE(close, length=30)` |
| `VEC_STORE(name)` | 加载向量库 | `VEC_STORE("4h_BTC")` |
| `SIMILARITY(store, vector)` | 相似度匹配 | `SIMILARITY(store, vector)` |

### Node.js 使用

```typescript
import { DslStrategy } from 'hquant-rs';

// 创建 DSL 策略
const strategy = new DslStrategy(`
  IF RSI(14) < 30 THEN BUY
  IF RSI(14) > 70 THEN SELL
`);

// 加载向量库用于相似度匹配
strategy.loadStore("4h_BTC", [
  { label: 1, vector: [0.1, 0.2, 0.3, ...] },  // 做多模式
  { label: -1, vector: [0.9, 0.8, 0.7, ...] }, // 做空模式
]);

// 设置相似度阈值
strategy.setThreshold(0.85);

// 评估策略
const signals = strategy.evaluate({
  timestamp: 1704067200000,
  open: 42000.0,
  high: 42500.0,
  low: 41800.0,
  close: 42300.0,
  volume: 1000.0,
});

for (const signal of signals) {
  console.log(`信号: ${signal.side}, 强度: ${signal.strength}`);
}
```

### Python 使用

```python
from hquant import PyDslStrategy, validate_dsl

# 验证 DSL 语法
source = """
  IF RSI(14) < 30 THEN BUY
  IF RSI(14) > 70 THEN SELL
"""
is_valid = validate_dsl(source)  # True

# 创建策略
strategy = PyDslStrategy(source)

# 加载向量库
strategy.load_store("4h_BTC", [
  {"label": 1, "vector": [0.1, 0.2, 0.3, ...]},
  {"label": -1, "vector": [0.9, 0.8, 0.7, ...]},
])

# 设置相似度阈值
strategy.set_threshold(0.85)

# 评估策略
bar = {
    "timestamp": 1704067200000,
    "open": 42000.0,
    "high": 42500.0,
    "low": 41800.0,
    "close": 42300.0,
    "volume": 1000.0,
}
signals = strategy.evaluate(bar)

for s in signals:
    print(f"信号: {s['side']}, 强度: {s['strength']}")
```

### 向量相似度匹配示例

向量相似度匹配用于识别历史模式：

```python
# 准备历史标注数据
labeled_patterns = [
    {
        "label": 1,  # 1 = 做多信号
        "vector": normalize_price_pattern(bullish_pattern)
    },
    {
        "label": -1,  # -1 = 做空信号
        "vector": normalize_price_pattern(bearish_pattern)
    }
]

# 使用 DSL 定义策略
strategy = PyDslStrategy("""
  vector_close = NORMALIZE(close, length=30)
  hit = SIMILARITY(VEC_STORE("patterns"), vector_close)
  IF hit.label == 1 THEN BUY
  IF hit.label == -1 THEN SELL
""")

strategy.load_store("patterns", labeled_patterns)
strategy.set_threshold(0.9)  # 相似度阈值

# 回测
for bar in historical_data:
    signals = strategy.evaluate(bar)
    # 处理信号...
```

## 性能特点

1. **零拷贝设计**: 指标计算直接操作环形缓冲区，无需复制数据
2. **增量计算**: 所有指标支持 O(1) 增量更新
3. **内存固定**: 使用 RingBuffer 限制内存使用，适合长时间运行
4. **缓存友好**: SoA 存储布局优化 CPU 缓存命中率
5. **线程安全**: FFI 层使用 Mutex 保护，支持多线程访问

## License

MIT
