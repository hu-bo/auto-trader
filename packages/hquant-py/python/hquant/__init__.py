"""
HQuant - High-performance quantitative trading engine powered by Rust

Example usage:
    >>> from hquant import HQuant
    >>> engine = HQuant(capacity=1000)
    >>> engine.add_indicator("rsi", {"type": "rsi", "period": 14})
    >>> engine.add_indicator("ma20", {"type": "ema", "period": 20})
    >>>
    >>> bar = {"timestamp": 1000, "open": 100, "high": 105, "low": 95, "close": 102, "volume": 1000}
    >>> signals = engine.push_kline(bar)
    >>>
    >>> rsi_value = engine.get_indicator("rsi")
"""

from hquant._hquant import (
    HQuant,
    PyBacktest as Backtest,
    PyAggregator as Aggregator,
    PyDslStrategy as DslStrategy,
    validate_dsl,
)

__all__ = [
    "HQuant",
    "Backtest",
    "Aggregator",
    "DslStrategy",
    "validate_dsl",
]

__version__ = "0.1.0"
