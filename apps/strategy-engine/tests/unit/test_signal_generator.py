from __future__ import annotations

from app.core.signal_generator import normalize_action


def test_normalize_action_strips_meta() -> None:
    assert normalize_action("BUY(breakout)") == "BUY"
    assert normalize_action("SELL(take_profit)") == "SELL"


def test_normalize_action_uppercases_and_trims() -> None:
    assert normalize_action("  buy  ") == "BUY"

