from __future__ import annotations

from typing import Any, Dict

import pytest

try:
    from hquant import FuturesBacktest, MultiHQuant
except Exception as exc:  # pragma: no cover
    pytest.skip(
        f"hquant is not installed/built (run `maturin develop --features ffi-python`): {exc}",
        allow_module_level=True,
    )

MS_15M = 15 * 60_000


def make_bar(i: int, close: float) -> Dict[str, Any]:
    return {
        "timestamp": i * MS_15M,
        "open": close,
        "high": close + 1,
        "low": close - 1,
        "close": close,
        "volume": 1,
        "buy_volume": 0.0,
    }


def test_e2e_multihquant_feed_bar_futures_backtest() -> None:
    dsl = "\n".join(
        [
            "IF close@4h <= 105 AND close@15m <= 105 THEN BUY",
            "IF close@4h >= 115 AND close@15m >= 115 THEN SELL",
        ]
    )
    mh = MultiHQuant(capacity=256, periods=["15m", "4h"])
    strategy_id = mh.add_multi_strategy("m", dsl)

    bt = FuturesBacktest(
        initial_margin=1000,
        leverage=10,
        contract_size=1,
        maker_fee_rate=0.0,
        taker_fee_rate=0.0,
        maintenance_margin_rate=0.005,
    )

    margin = 100.0
    last_price = 100.0
    saw_buy = False
    saw_sell = False

    for i in range(33):
        if i <= 15:
            close = 100.0
        elif i == 16:
            close = 104.0
        elif i <= 31:
            close = 106.0 + (i - 17)
        else:
            close = 118.0

        bar = make_bar(i, close)
        last_price = close

        mh.feed_bar(bar)
        bt.on_price(close)

        for s in mh.poll_signals():
            assert s["strategy_id"] == strategy_id
            if s["action"] == "BUY":
                saw_buy = True
                bt.apply_signal("BUY", close, margin, position_side="LONG")
            elif s["action"] == "SELL":
                saw_sell = True
                bt.apply_signal("SELL", close, margin, position_side="LONG")

    r = bt.result(last_price)
    assert saw_buy is True
    assert saw_sell is True
    assert r["liquidated"] is False
    assert r["profit"] > 0
    assert bt.get_positions() == []
