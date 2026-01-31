# hquant (Python)

High-performance quantitative trading engine powered by Rust (PyO3).

## Development

```bash
cd packages/hquant-py
maturin develop --features ffi-python
```

## Quick Start

```python
from hquant import HQuant, Aggregator, Backtest

engine = HQuant(capacity=1000)
engine.add_indicator("rsi", {"type": "rsi", "period": 14})
engine.add_strategy("s", "IF RSI(14) < 30 THEN BUY\nIF RSI(14) > 70 THEN SELL")

bar = {"timestamp": 0, "open": 100, "high": 101, "low": 99, "close": 100, "volume": 1}
engine.push_bar(bar)
print(engine.poll_signals())

agg = Aggregator("1m", ["15m", "1h"], 1000)
print(agg.push_kline(bar))

bt = Backtest(initial_margin=1000, taker_fee_rate=0.0)
bt.open_position(price=100, size=1, position_side="LONG")
bt.close_position(price=110, position_side="LONG")
print(bt.backtest_result())
```

