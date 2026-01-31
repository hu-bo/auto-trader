# hquant (Python)

High-performance quantitative trading engine powered by Rust (PyO3).

## Install (dev)

```bash
cd packages/hquant-py
pip install maturin
maturin develop --features ffi-python
```

## Quick Start

```python
from hquant import Aggregator, Backtest, HQuant

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

> Note: `period` 可能是 `15m/1h/...` 或 `M15/H1/...`（取决于编译的 native 模块版本）。

## E2E Tests

Repo 内 e2e 用例：`packages/hquant-py/test_e2e.py`

```bash
cd packages/hquant-py
maturin develop --features ffi-python
pytest -q test_e2e.py
```
