from __future__ import annotations

from app.nats.topics import candle_subject, signal_subject, signal_subject_by_strategy


def test_candle_subject() -> None:
    assert candle_subject("exchange", "binance", "spot", "BTC-USDT", "15m") == (
        "exchange.candle.binance.spot.BTC-USDT.15m"
    )


def test_signal_subject() -> None:
    assert signal_subject("signal", "binance", "spot", "BTC-USDT") == "signal.binance.spot.BTC-USDT"


def test_signal_subject_by_strategy() -> None:
    assert signal_subject_by_strategy("sig.v1.signal", 123) == "sig.v1.signal.123"

