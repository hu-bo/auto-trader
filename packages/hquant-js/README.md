# @hquant/js

High-performance quantitative trading engine powered by Rust (via napi-rs).

## Features

- Native Rust performance with zero-copy data transfer
- Complete technical indicator library (MA/RSI/MACD/ATR/BOLL/VRI)
- Multi-timeframe aggregation (15m/1h/4h/1d)
- Strategy DSL for custom trading logic
- Backtest engine with liquidation simulation

## Installation

```bash
npm install @hquant/js
# or
pnpm add @hquant/js
```

## Quick Start

```typescript
import { HQuant } from '@hquant/js'

// Create engine with multi-timeframe support
const engine = new HQuant(1000, ['15m', '1h', '4h'])

// Add indicators
engine.addIndicator('rsi', { type: 'rsi', period: 14 })
engine.addIndicator('ma_fast', { type: 'ema', period: 5 })
engine.addIndicator('ma_slow', { type: 'ema', period: 20 })
engine.addIndicator('macd', { type: 'macd', fast: 12, slow: 26, signal: 9 })
engine.addIndicator('boll', { type: 'boll', period: 20, stdDev: 2 })

// Feed K-line data (from WebSocket)
const bar = {
  timestamp: Date.now(),
  open: 100,
  high: 105,
  low: 95,
  close: 102,
  volume: 1000,
}

// feedKline returns aggregator events when higher timeframe candles complete
const events = engine.feedKline(bar)
for (const event of events) {
  if (event.kind === 'KlineClosed') {
    console.log(`${event.period} candle closed:`, event.candle)
  }
}

// Get indicator values
const rsi = engine.getIndicatorValue('rsi')
const macdResult = engine.getIndicatorResult('macd')
if (macdResult) {
  console.log(`MACD: ${macdResult.value}, Histogram: ${macdResult.extra?.[0]}`)
}
```

## DSL Strategy

```typescript
import { DslStrategy, validateDsl } from '@hquant/js'

// Validate DSL syntax
const source = `
  IF RSI(14) < 30 AND close > EMA(20) THEN BUY
  IF RSI(14) > 70 THEN SELL
`
validateDsl(source)

// Create and evaluate strategy
const strategy = new DslStrategy(source)
const signals = strategy.evaluate(bar, {})

for (const signal of signals) {
  console.log(`${signal.side}: ${signal.reason}`)
}
```

## Backtesting

```typescript
import { Backtest } from '@hquant/js'

const bt = new Backtest({
  marketType: 'spot',
  initialCapital: 10000,
  makerFee: 0.001,
  takerFee: 0.001,
})

// Execute trades
bt.openPosition(100, 1.0, 'LONG')
bt.closePosition(110, 'LONG')

// Get results
const result = bt.result()
console.log(`Total PnL: ${result.totalPnl}`)
console.log(`Win Rate: ${(result.winRate * 100).toFixed(2)}%`)
console.log(`Max Drawdown: ${(result.maxDrawdownPct).toFixed(2)}%`)
console.log(`Sharpe Ratio: ${result.sharpeRatio.toFixed(2)}`)
```

## Futures Backtesting

```typescript
import { FuturesBacktest } from '@hquant/js'

const bt = new FuturesBacktest({
  initialMargin: 1000,
  leverage: 10,
  contractSize: 1,
  makerFeeRate: 0.0004,
  takerFeeRate: 0.0004,
  maintenanceMarginRate: 0.005,
})

// applySignal supports optional positionSide: 'LONG' | 'SHORT'
bt.applySignal('BUY', 100, 100, 'LONG')
bt.applySignal('SELL', 110, 50, 'LONG')

console.log(bt.getPositions())
console.log(bt.result(110))
```

## Multi-Timeframe Aggregation

```typescript
import { KlineAggregator } from '@hquant/js'

const agg = new KlineAggregator('1m', ['15m', '1h', '4h'], 1000)

// Push 1-minute candles from exchange WebSocket
const events = agg.pushKline(bar)

for (const event of events) {
  if (event.kind === 'KlineClosed') {
    console.log(`${event.period} candle:`, event.candle)
    // Process higher timeframe candle
  }
}
```

## Supported Indicators

| Builder | Methods | Description |
|---------|---------|-------------|
| `ma()` | `period(n)`, `sma()`, `ema()`, `wma()` | Moving Average |
| `rsi()` | `period(n)` | Relative Strength Index |
| `macd()` | `fast(n)`, `slow(n)`, `signal(n)` | MACD |
| `atr()` | `period(n)` | Average True Range |
| `boll()` | `period(n)`, `stdDev(f)` | Bollinger Bands |
| `vri()` | `period(n)` | Volume Ratio Index |

## Building Native Module

```bash
# Build Rust native module
cd ../hquant-rs
cargo build --release --features ffi-node

# Copy to native directory (macOS)
cp target/release/libhquant.dylib ../hquant-js/native/hquant.node

# Build TypeScript
cd ../hquant-js
pnpm build
```

## License

GPL-3.0-or-later
