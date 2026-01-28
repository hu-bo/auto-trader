# HQuant

High-performance quantitative trading engine powered by Rust.

## Installation

```bash
pip install hquant
```

## Quick Start

```python
from hquant import HQuant, Backtest

# Create engine
engine = HQuant(capacity=1000)

# Add indicators
engine.add_indicator("rsi", {"type": "rsi", "period": 14})
engine.add_indicator("ma_fast", {"type": "ema", "period": 5})
engine.add_indicator("ma_slow", {"type": "ema", "period": 20})
engine.add_indicator("macd", {"type": "macd", "fast": 12, "slow": 26, "signal": 9})
engine.add_indicator("boll", {"type": "boll", "period": 20, "std_dev": 2.0})

# Push K-line data
bar = {
    "timestamp": 1704067200000,
    "open": 100.0,
    "high": 105.0,
    "low": 95.0,
    "close": 102.0,
    "volume": 1000.0,
}
signals = engine.push_kline(bar)

# Get indicator values
rsi = engine.get_indicator("rsi")
if engine.is_ready("rsi"):
    print(f"RSI: {rsi}")
```

## DSL Strategy

```python
from hquant import DslStrategy, validate_dsl

# Validate DSL
source = """
    IF RSI(14) < 30 AND close > EMA(20) THEN BUY
    IF RSI(14) > 70 THEN SELL
"""
validate_dsl(source)  # Raises ValueError if invalid

# Create strategy
strategy = DslStrategy(source)

# Evaluate
signals = strategy.evaluate(bar)
for signal in signals:
    print(f"{signal['side']}: {signal['reason']}")
```

## Backtesting

```python
from hquant import Backtest

bt = Backtest(
    initial_margin=10000.0,
    leverage=1.0,
    maker_fee_rate=0.001,
    taker_fee_rate=0.001,
    market_type="spot"
)

# Execute trades
bt.open_long(price=100.0, size=1.0)
bt.close(price=110.0)

# Get results
result = bt.backtest_result()
print(f"Total PnL: {result['total_pnl']}")
print(f"Win Rate: {result['win_rate']:.2%}")
print(f"Max Drawdown: {result['max_drawdown_pct']:.2%}")
```

## Multi-Timeframe Aggregation

```python
from hquant import Aggregator

agg = Aggregator(
    base_tf="1m",
    target_tfs=["15m", "1h", "4h"],
    capacity=1000
)

# Push 1-minute candles
events = agg.push_kline(bar)
for event in events:
    if event["kind"] == "KlineClosed":
        print(f"{event['period']} candle closed: {event['candle']}")
```

## Supported Indicators

| Type | Parameters | Description |
|------|------------|-------------|
| `ma`, `sma` | `period` | Simple Moving Average |
| `ema` | `period` | Exponential Moving Average |
| `wma` | `period` | Weighted Moving Average |
| `rsi` | `period` | Relative Strength Index |
| `macd` | `fast`, `slow`, `signal` | MACD |
| `atr` | `period` | Average True Range |
| `boll` | `period`, `std_dev` | Bollinger Bands |
| `vri` | `period` | Volume Ratio Index |
| `vwap` | - | Volume Weighted Average Price |
| `obv` | - | On-Balance Volume |

## Development

```bash
# Install maturin
pip install maturin

# Build and install locally
cd packages/hquant-py
maturin develop --features ffi-python
```

## License

GPL-3.0-or-later
