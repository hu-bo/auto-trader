from __future__ import annotations

import re
from typing import Any

import numpy as np
from hquant import MultiHQuant, validate_dsl

from app.models import Candle
from app.utils.circular_buffer import CircularBuffer

# Ordered list of standard periods from smallest to largest.
_STANDARD_PERIODS = ["1m", "3m", "5m", "15m", "30m", "1h", "2h", "4h", "6h", "12h", "1d"]

# Pre-compiled pattern to extract period references like ``close@4h`` from DSL code.
_PERIOD_REF_RE = re.compile(r"@(\d+[mhd])\b", re.IGNORECASE)


def _build_periods(base_period: str, code: str) -> list[str]:
    """Build the period list for *MultiHQuant*.

    The list always starts with *base_period* (the NATS subscription period)
    and includes every higher-timeframe period referenced in the DSL via the
    ``@<period>`` syntax, in ascending order.
    """
    try:
        base_idx = _STANDARD_PERIODS.index(base_period)
    except ValueError:
        return [base_period]

    # Collect periods referenced in the DSL.
    refs = {m.group(1).lower() for m in _PERIOD_REF_RE.finditer(code)}

    periods = [base_period]
    for p in _STANDARD_PERIODS[base_idx + 1:]:
        if p in refs:
            periods.append(p)
    return periods


class IndicatorCalculator:
    def __init__(self, *, capacity: int, strategy_name: str, code: str, period: str = "15m") -> None:
        if not validate_dsl(code):
            raise ValueError("Invalid DSL strategy code")

        self._periods = _build_periods(period, code)
        self._engine = MultiHQuant(capacity=capacity, periods=self._periods)
        self._engine_strategy_id = self._engine.add_multi_strategy(strategy_name, code)
        self._last_timestamp: int | None = None
        self._candles = CircularBuffer[Candle](capacity=capacity)

    @property
    def engine_strategy_id(self) -> int:
        return self._engine_strategy_id

    @property
    def candle_count(self) -> int:
        return len(self._candles)

    @property
    def periods(self) -> list[str]:
        return list(self._periods)

    def load_history(self, candles: list[Candle]) -> int:
        """Bulk-load historical candles into the engine without evaluating strategies.

        Args:
            candles: Historical candles sorted by timestamp ascending.

        Returns:
            Number of candles loaded.
        """
        if not candles:
            return 0

        n = len(candles)
        timestamps = np.empty(n, dtype=np.int64)
        opens = np.empty(n, dtype=np.float64)
        highs = np.empty(n, dtype=np.float64)
        lows = np.empty(n, dtype=np.float64)
        closes = np.empty(n, dtype=np.float64)
        volumes = np.empty(n, dtype=np.float64)
        buy_volumes = np.empty(n, dtype=np.float64)

        for i, c in enumerate(candles):
            timestamps[i] = c.timestamp
            opens[i] = c.open
            highs[i] = c.high
            lows[i] = c.low
            closes[i] = c.close
            volumes[i] = c.volume
            buy_volumes[i] = c.buy_volume

        self._engine.load_history(timestamps, opens, highs, lows, closes, volumes, buy_volumes)
        self._candles.extend(candles)

        if candles:
            self._last_timestamp = candles[-1].timestamp

        return n

    def on_candle(self, candle: Candle) -> list[dict[str, Any]]:
        bar = candle.to_hquant_bar()
        if self._last_timestamp is not None and candle.timestamp == self._last_timestamp:
            self._engine.update_last(bar)
            self._candles.replace_last(candle)
        else:
            self._engine.feed_bar(bar)
            self._candles.append(candle)
            self._last_timestamp = candle.timestamp

        signals = self._engine.poll_signals()
        return list(signals)
