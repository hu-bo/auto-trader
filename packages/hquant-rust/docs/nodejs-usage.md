# hquant-rust Node.js 使用指南

## 安装

```bash
# 构建 Node.js native 模块
scripts/build-ffi.sh node
```

## 基础使用

### 引入模块

```javascript
const {
  // 核心引擎
  QuantEngine,
  // 指标 Builders
  Indicators,

  // K线聚合
  MultiTimeFrameKlineAggregator,

  // 回测
  Backtest,

  // 环形缓冲区
  Float64Buffer,
  Int32Buffer,
} = require('./hquant.node');
```

---

## 1. 量化引擎 (Engine)

### 创建引擎

```javascript
// 创建一个容量为 1000 根 K 线的引擎
const engine = new Engine(1000);
```

### 添加指标 (Builder 模式) ⭐推荐

```javascript
// 创建指标工厂
const indicators = new Indicators();

// MA 指标
const ma = indicators.ma().period(20).ema();  // EMA(20)
engine.addMaIndicator('ema20', ma);

const sma = indicators.ma().period(10).sma(); // SMA(10)
engine.addMaIndicator('sma10', sma);

// RSI 指标
const rsi = indicators.rsi().period(14);
engine.addRsiIndicator('rsi14', rsi);

// MACD 指标
const macd = indicators.macd()
  .fast(12)
  .slow(26)
  .signal(9);
engine.addMacdIndicator('macd', macd);

// ATR 指标
const atr = indicators.atr().period(14);
engine.addAtrIndicator('atr14', atr);

// BOLL 指标
const boll = indicators.boll()
  .period(20)
  .stdDev(2.0);
engine.addBollIndicator('boll20', boll);

// VRI 指标
const vri = indicators.vri().period(14);
engine.addVriIndicator('vri14', vri);
```

### 推送 K 线数据

```javascript
// K 线数据格式
const bar = {
  timestamp: Date.now(),
  open: 100.0,
  high: 102.0,
  low: 99.0,
  close: 101.5,
  volume: 1000.0,
};

// 追加新 K 线
const signals = engine.appendBar(bar);

// 更新最后一根 K 线 (实时行情)
engine.updateLastBar(bar);

// 批量加载历史数据
const history = [bar1, bar2, bar3, ...];
engine.loadHistory(history);
```

### 获取指标值

```javascript
// 获取指标当前值
const emaValue = engine.indicatorValue('ema20');
const rsiValue = engine.indicatorValue('rsi14');

// 检查指标是否就绪
if (engine.indicatorReady('macd')) {
  console.log('MACD 值:', engine.indicatorValue('macd'));
}
```

### 重置引擎

```javascript
engine.reset();
```

---

## 2. K 线聚合器

### 多周期聚合

```javascript
// 同时聚合多个周期
const mtf = new MultiTimeFrameKlineAggregator('15m', ['4h', '1d']);

// 高频 5m/15m基础周期
const bar = {
  openTime: Date.now(),
  open: 100.0,
  high: 102.0,
  low: 99.0,
  close: 101.5,
  volume: 1000.0,
  buy_volume: 100, // 可能不存在(如何判断是否存在，如果条数据不存在则假设后续的数据都没有buy_volume)
};

mtf.push(bar);
// 例如: ['4h', '1d'] 表示 4h 和 1d 产生了新 K 线
// 获取指定周期的当前 K 线
const m5Current = mtf.current('4h');
const h1Current = mtf.current('1d');

// 更新所有周期，数据还是当前周期
const bar2 = {
  openTime: Date.now() + 1000,
  open: 100.0,
  high: 102.0,
  low: 99.0,
  close: 101.5,
  volume: 1000.0,
  buy_volume: 100, // 可能不存在，
};
mtf.updateLast(bar2);

// 强制完成所有聚合(数据没有更多了，结束)
mtf.flushAll();

// 重置
mtf.reset();
```

**支持的周期：** 5m, 4h, 1d (后续在扩展30m等)

---

## 3. 回测引擎

### 创建回测引擎

```javascript
// 现货回测
const spotBt = Backtest.spot(10000);  // 初始资金 10000

// 合约回测
const futuresBt = Backtest.futures(10000, 10);  // 初始资金 10000，10 倍杠杆

// 自定义配置
const bt = new Backtest({
  marketType: 'futures',  // 'spot' 或 'futures'
  initialCapital: 10000,
  leverage: 10,           // 仅合约有效
  makerFee: 0.001,        // 挂单费率
  takerFee: 0.001,        // 吃单费率
  slippage: 0.0005,       // 滑点
  positionSizePct: 0.1,   // 每次开仓占比
});
```

### 执行交易

```javascript
// 买入
bt.buy(bar, 1.0, 'MACD金叉');   // (K线, 信号强度, 原因)
bt.buy(bar);                    // 简化调用

// 卖出
bt.sell(bar, 0.8, 'RSI超买');
bt.sell(bar);

// 持有 (更新价格)
bt.hold(bar);
```

### 获取回测结果

```javascript
// 获取统计结果
const result = bt.result();
console.log({
  totalTrades: result.totalTrades,      // 总交易次数
  winningTrades: result.winningTrades,  // 盈利次数
  losingTrades: result.losingTrades,    // 亏损次数
  totalPnl: result.totalPnl,            // 总盈亏
  maxDrawdown: result.maxDrawdown,      // 最大回撤
  maxDrawdownPct: result.maxDrawdownPct,// 最大回撤百分比
  sharpeRatio: result.sharpeRatio,      // 夏普比率
  winRate: result.winRate,              // 胜率
  profitFactor: result.profitFactor,    // 盈亏比
  finalEquity: result.finalEquity,      // 最终权益
  returnPct: result.returnPct,          // 收益率
  liquidations: result.liquidations,    // 爆仓次数
});

// 获取交易记录
const trades = bt.trades();
trades.forEach(trade => {
  console.log({
    timestamp: trade.timestamp,
    side: trade.side,    // 'BUY' | 'SELL'
    price: trade.price,
    size: trade.size,
    fee: trade.fee,
    pnl: trade.pnl,
  });
});

// 获取权益曲线
const equityCurve = bt.equityCurve();  // number[]

// 获取当前持仓
const position = bt.position();
if (position) {
  console.log({
    side: position.side,              // 'LONG' | 'SHORT'
    size: position.size,
    entryPrice: position.entryPrice,
    leverage: position.leverage,
    liquidationPrice: position.liquidationPrice,
    unrealizedPnl: position.unrealizedPnl,
  });
}

// 当前权益
const equity = bt.equity();
```

---

## 4. 环形缓冲区

高性能的固定容量缓冲区，类似 JavaScript 的 TypedArray。

### Float64Buffer (浮点数)

```javascript
const floatBuf = new Float64Buffer(100);

// 追加元素 (满时覆盖最旧)
floatBuf.push(3.14);
floatBuf.push(2.71);

// 获取元素
floatBuf.get(0);           // 按索引获取 (0 = 最旧)
floatBuf.last();           // 获取最新
floatBuf.getFromEnd(1);    // 倒数第 n 个 (1 = 最新)

// 更新元素
floatBuf.update(0, 1.0);   // 更新指定索引
floatBuf.updateLast(2.0);  // 更新最后一个

// 移除元素
floatBuf.shift();          // 移除并返回最旧
floatBuf.pop();            // 移除并返回最新

// 状态
floatBuf.len();            // 当前长度
floatBuf.capacity();       // 容量
floatBuf.isEmpty();        // 是否为空
floatBuf.isFull();         // 是否已满

// 导出
floatBuf.toArray();        // 转为数组

// 清空
floatBuf.clear();
```

### Int32Buffer (整数)

```javascript
const intBuf = new Int32Buffer(100);

// API 与 Float64Buffer 相同
intBuf.push(1);
intBuf.push(0);  // 可用于存储布尔值 (1/0)

intBuf.get(0);
intBuf.last();
intBuf.toArray();
```

---

## 5. 完整示例

```javascript
const {
  Engine, Indicators, Backtest, KlineAggregator, Float64Buffer
} = require('./hquant.node');

// 初始化
const engine = new Engine(1000);
const indicators = new Indicators();

// 添加指标
engine.addMaIndicator('ema20', indicators.ma().period(20).ema());
engine.addRsiIndicator('rsi14', indicators.rsi().period(14));
engine.addMacdIndicator('macd', indicators.macd().fast(12).slow(26).signal(9));

// 创建回测引擎
const bt = Backtest.spot(10000);

// 创建价格缓冲区
const priceBuffer = new Float64Buffer(100);

// 模拟 K 线数据
const bars = generateKlines(200);

// 执行回测
for (const bar of bars) {
  // 追加 K 线
  engine.appendBar(bar);
  priceBuffer.push(bar.close);

  // 等待指标就绪
  if (!engine.indicatorReady('macd')) continue;

  // 获取指标值
  const ema = engine.indicatorValue('ema20');
  const rsi = engine.indicatorValue('rsi14');
  const macd = engine.indicatorValue('macd');

  // 交易逻辑
  if (rsi < 30 && bar.close > ema) {
    bt.buy(bar, 1.0, 'RSI超卖+价格>EMA');
  } else if (rsi > 70 && bar.close < ema) {
    bt.sell(bar, 1.0, 'RSI超买+价格<EMA');
  } else {
    bt.hold(bar);
  }
}

// 输出结果
const result = bt.result();
console.log('=== 回测结果 ===');
console.log(`总交易: ${result.totalTrades}`);
console.log(`胜率: ${(result.winRate * 100).toFixed(2)}%`);
console.log(`总收益: ${result.totalPnl.toFixed(2)}`);
console.log(`收益率: ${(result.returnPct * 100).toFixed(2)}%`);
console.log(`最大回撤: ${(result.maxDrawdownPct * 100).toFixed(2)}%`);
console.log(`夏普比率: ${result.sharpeRatio.toFixed(2)}`);
```

---

## 类型定义 (TypeScript)

```typescript
interface Bar {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

interface Signal {
  side: 'BUY' | 'SELL' | 'HOLD';
  strength: number;
  reason: string;
  timestamp: number;
}

interface BacktestStats {
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  totalPnl: number;
  maxDrawdown: number;
  maxDrawdownPct: number;
  sharpeRatio: number;
  winRate: number;
  profitFactor: number;
  finalEquity: number;
  returnPct: number;
  liquidations: number;
}

interface Trade {
  timestamp: number;
  side: 'BUY' | 'SELL';
  price: number;
  size: number;
  fee: number;
  pnl: number;
}

interface Position {
  side: 'LONG' | 'SHORT';
  size: number;
  entryPrice: number;
  leverage: number;
  liquidationPrice: number;
  unrealizedPnl: number;
  timestamp: number;
}
```
