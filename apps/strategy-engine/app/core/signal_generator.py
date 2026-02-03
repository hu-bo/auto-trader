from __future__ import annotations

from datetime import datetime, timezone
from uuid import uuid4

from app.models import Candle, Signal


def normalize_action(action: str) -> str:
    base = action.split("(", 1)[0].strip().upper()
    if base in {"BUY", "SELL", "HOLD"}:
        return base
    return base or "HOLD"


def candle_timestamp_to_datetime(timestamp_ms: int) -> datetime:
    return datetime.fromtimestamp(timestamp_ms / 1000.0, tz=timezone.utc)


def create_signal(*, candle: Candle, strategy_id: int, strategy_name: str, action: str) -> Signal:
    normalized_action = normalize_action(action)
    confidence = 1.0 if normalized_action in {"BUY", "SELL"} else 0.0

    return Signal(
        signal_id=str(uuid4()),
        strategy_id=strategy_id,
        strategy_name=strategy_name,
        exchange=candle.exchange,
        trade_type=candle.trade_type,
        symbol=candle.symbol,
        period=candle.period,
        action=normalized_action,
        price=candle.close,
        confidence=confidence,
        timestamp=candle_timestamp_to_datetime(candle.timestamp),
    )

