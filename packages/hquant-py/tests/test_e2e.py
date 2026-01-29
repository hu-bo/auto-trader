import math
from hquant import HQuant, FuturesBacktest


def test_add_strategy_futures_backtest():
    """e2e: addStrategy + futures backtest"""
    hq = HQuant(capacity=64)
    hq.add_indicator("rsi_3", {"type": "rsi", "period": 3})

    dsl = """
        IF RSI(3) < 30 THEN BUY
        IF RSI(3) > 70 THEN SELL
    """
    sid = hq.add_strategy("s", dsl)
    assert sid > 0

    bt = FuturesBacktest(
        initial_margin=1000,
        leverage=10,
        contract_size=1,
        maker_fee_rate=0.0004,
        taker_fee_rate=0.0004,
        maintenance_margin_rate=0.005,
    )

    # Drive RSI low, then high.
    close = 100
    for i in range(40):
        close -= 1
        hq.push_bar({
            "timestamp": i,
            "open": close,
            "high": close,
            "low": close,
            "close": close,
            "volume": 1,
        })
        for sig in hq.poll_signals():
            bt.apply_signal(sig["action"], close, 100)

    for i in range(40, 80):
        close += 1
        hq.push_bar({
            "timestamp": i,
            "open": close,
            "high": close,
            "low": close,
            "close": close,
            "volume": 1,
        })
        for sig in hq.poll_signals():
            bt.apply_signal(sig["action"], close, 100)

    r = bt.result(close)
    print(r)
    assert math.isfinite(r["equity"])
    assert math.isfinite(r["profit"])
