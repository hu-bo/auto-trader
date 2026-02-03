from __future__ import annotations

from typing import Any

from hquant import HQuant, validate_dsl

from app.models import Candle
from app.utils.circular_buffer import CircularBuffer


class IndicatorCalculator:
    def __init__(self, *, capacity: int, strategy_name: str, code: str) -> None:
        if not validate_dsl(code):
            raise ValueError("Invalid DSL strategy code")

        self._engine = HQuant(capacity=capacity)
        self._engine_strategy_id = self._engine.add_strategy(strategy_name, code)
        self._last_timestamp: int | None = None
        self._candles = CircularBuffer[Candle](capacity=capacity)

    @property
    def engine_strategy_id(self) -> int:
        return self._engine_strategy_id

    @property
    def candle_count(self) -> int:
        return len(self._candles)

    def on_candle(self, candle: Candle) -> list[dict[str, Any]]:
        bar = candle.to_hquant_bar()
        if self._last_timestamp is not None and candle.timestamp == self._last_timestamp:
            self._engine.update_last(bar)
            self._candles.replace_last(candle)
        else:
            self._engine.push_bar(bar)
            self._candles.append(candle)
            self._last_timestamp = candle.timestamp

        signals = self._engine.poll_signals()
        return list(signals)

