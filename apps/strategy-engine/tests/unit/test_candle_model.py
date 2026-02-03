from __future__ import annotations

from app.models import Candle


def test_candle_model_accepts_buy_volume_aliases() -> None:
    payload = {
        "symbol": "BTC-USDT",
        "exchange": "binance",
        "trade_type": "spot",
        "period": "15m",
        "timestamp": 1703001600000,
        "open": 1,
        "high": 2,
        "low": 0.5,
        "close": 1.5,
        "volume": 10,
        "buyVolume": 3,
    }
    candle = Candle.model_validate(payload)
    assert candle.buy_volume == 3

