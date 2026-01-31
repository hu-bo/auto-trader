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

## Multi-Period Strategy (MultiHQuant)

`MultiHQuant` 支持多周期路由（`feed_bar`）以及多周期 DSL（`add_multi_strategy`，支持 `close@4h` 这种写法）。

```python
from hquant import FuturesBacktest, MultiHQuant

mh = MultiHQuant(capacity=256, periods=["15m", "4h"])
strategy_id = mh.add_multi_strategy(
    "m",
    "\n".join(
        [
            "IF close@4h <= 105 AND close@15m <= 105 THEN BUY",
            "IF close@4h >= 115 AND close@15m >= 115 THEN SELL",
        ]
    ),
)

bt = FuturesBacktest(
    initial_margin=1000,
    leverage=10,
    contract_size=1,
    maker_fee_rate=0.0,
    taker_fee_rate=0.0,
    maintenance_margin_rate=0.005,
)

margin = 100.0
last_price = 0.0

for bar in bars_15m:
    last_price = bar["close"]
    mh.feed_bar(bar)
    for s in mh.poll_signals():
        if s["strategy_id"] == strategy_id:
            bt.apply_signal(s["action"], last_price, margin, position_side="LONG")
    bt.on_price(last_price)

print(bt.result(last_price))
```

## E2E Tests

Repo 内 e2e 用例：`packages/hquant-py/test_e2e.py`

```bash
cd packages/hquant-py
maturin develop --features ffi-python
pytest -q -p no:cacheprovider test_e2e.py
```
