"""High-performance quantitative trading engine for Python.

This module provides Rust-powered technical indicators, backtesting,
and multi-timeframe aggregation for quantitative trading strategies.
"""

from __future__ import annotations

from typing import Union

from hquant._hquant import (
    # Data structures
    PyBar as Bar,
    PySignal as Signal,
    PyIndicatorValue as IndicatorValue,
    # Indicator builders
    PyMABuilder as MABuilder,
    PyRSIBuilder as RSIBuilder,
    PyMACDBuilder as MACDBuilder,
    PyATRBuilder as ATRBuilder,
    PyBOLLBuilder as BOLLBuilder,
    PyVRIBuilder as VRIBuilder,
    # Indicators factory
    PyIndicators as Indicators,
    # Backtest types
    PyBacktestConfig as BacktestConfig,
    PyBacktestStats as BacktestStats,
    PyTrade as Trade,
    PyPosition as Position,
    # Aggregators
    PyAggregator as Aggregator,
    PyMultiTimeFrameAggregator as MultiTimeFrameAggregator,
    # Engines
    PyQuantEngine as _PyQuantEngine,
    PyBacktestEngine as BacktestEngine,
)

__all__ = [
    # Data structures
    "Bar",
    "Signal",
    "IndicatorValue",
    # Indicator builders
    "MABuilder",
    "RSIBuilder",
    "MACDBuilder",
    "ATRBuilder",
    "BOLLBuilder",
    "VRIBuilder",
    # Indicators factory
    "Indicators",
    # Backtest types
    "BacktestConfig",
    "BacktestStats",
    "Trade",
    "Position",
    # Aggregators
    "Aggregator",
    "MultiTimeFrameAggregator",
    # Engines
    "QuantEngine",
    "BacktestEngine",
    # TimeFrame constants
    "TimeFrame",
]

__version__ = "0.1.0"


class TimeFrame:
    """TimeFrame constants for aggregation."""

    M1 = "M1"
    M5 = "M5"
    M15 = "M15"
    M30 = "M30"
    H1 = "H1"
    H4 = "H4"
    D1 = "D1"
    W1 = "W1"


# Type alias for all indicator builders
IndicatorBuilder = Union[MABuilder, RSIBuilder, MACDBuilder, ATRBuilder, BOLLBuilder, VRIBuilder]


class QuantEngine:
    """Main quantitative trading engine with unified add_indicator API."""

    def __init__(self, capacity: int) -> None:
        self._engine = _PyQuantEngine(capacity)

    def add_indicator(self, name: str, indicator: IndicatorBuilder) -> None:
        """Add an indicator using builder pattern.

        Args:
            name: Unique name for the indicator
            indicator: Indicator builder instance (MABuilder, RSIBuilder, etc.)

        Example:
            >>> engine = QuantEngine(1000)
            >>> engine.add_indicator("sma20", MABuilder().period(20).sma())
            >>> engine.add_indicator("rsi14", RSIBuilder().period(14))
            >>> engine.add_indicator("macd", MACDBuilder().fast(12).slow(26).signal(9))
        """
        if isinstance(indicator, MABuilder):
            self._engine.add_ma_indicator(name, indicator)
        elif isinstance(indicator, RSIBuilder):
            self._engine.add_rsi_indicator(name, indicator)
        elif isinstance(indicator, MACDBuilder):
            self._engine.add_macd_indicator(name, indicator)
        elif isinstance(indicator, ATRBuilder):
            self._engine.add_atr_indicator(name, indicator)
        elif isinstance(indicator, BOLLBuilder):
            self._engine.add_boll_indicator(name, indicator)
        elif isinstance(indicator, VRIBuilder):
            self._engine.add_vri_indicator(name, indicator)
        else:
            raise TypeError(f"Unknown indicator type: {type(indicator)}")

    def add_vwap(self, name: str) -> None:
        """Add VWAP (Volume-Weighted Average Price) indicator."""
        self._engine.add_vwap_indicator(name)

    def add_obv(self, name: str) -> None:
        """Add OBV (On-Balance Volume) indicator."""
        self._engine.add_obv_indicator(name)

    def add_mfi(self, name: str, period: int = 14) -> None:
        """Add MFI (Money Flow Index) indicator."""
        self._engine.add_mfi_indicator(name, period)

    def add_williams_r(self, name: str, period: int = 14) -> None:
        """Add Williams %R indicator."""
        self._engine.add_williams_r_indicator(name, period)

    def add_cci(self, name: str, period: int = 20) -> None:
        """Add CCI (Commodity Channel Index) indicator."""
        self._engine.add_cci_indicator(name, period)

    def add_roc(self, name: str, period: int = 12) -> None:
        """Add ROC (Rate of Change) indicator."""
        self._engine.add_roc_indicator(name, period)

    # Multi-TimeFrame Aggregation
    def setup_aggregator(
        self, base_tf: str, target_tfs: list[str], capacity: int
    ) -> None:
        """Setup multi-timeframe aggregation."""
        self._engine.setup_aggregator(base_tf, target_tfs, capacity)

    # Backtesting
    def setup_backtest(self, config: BacktestConfig) -> None:
        """Setup backtesting with config."""
        self._engine.setup_backtest(config)

    def backtest_result(self) -> BacktestStats | None:
        """Get backtest statistics."""
        return self._engine.backtest_result()

    def backtest_trades(self) -> list[Trade]:
        """Get all trades from backtest."""
        return self._engine.backtest_trades()

    def backtest_equity_curve(self) -> list[float]:
        """Get equity curve from backtest."""
        return self._engine.backtest_equity_curve()

    # Data Processing
    def append_bar(self, bar: Bar) -> list[Signal]:
        """Append a new bar, returns generated signals."""
        return self._engine.append_bar(bar)

    def update_last_bar(self, bar: Bar) -> None:
        """Update the last bar (for real-time updates)."""
        self._engine.update_last_bar(bar)

    def load_history(self, bars: list[Bar]) -> list[Signal]:
        """Load historical bars."""
        return self._engine.load_history(bars)

    # Indicator Access
    def indicator_value(self, name: str) -> float | None:
        """Get current indicator value."""
        return self._engine.indicator_value(name)

    def indicator_result(self, name: str) -> IndicatorValue | None:
        """Get full indicator result with extra data."""
        return self._engine.indicator_result(name)

    def indicator_ready(self, name: str) -> bool:
        """Check if indicator has enough data."""
        return self._engine.indicator_ready(name)

    # Data access
    def __len__(self) -> int:
        """Get number of bars in the engine."""
        return self._engine.len()

    def is_empty(self) -> bool:
        """Check if the engine is empty."""
        return self._engine.is_empty()

    def last_bar(self) -> Bar | None:
        """Get the last bar."""
        return self._engine.last_bar()

    # Management
    def reset(self) -> None:
        """Reset the engine."""
        self._engine.reset()
