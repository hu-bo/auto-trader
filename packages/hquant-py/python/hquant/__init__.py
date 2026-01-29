"""
HQuant - High-performance quantitative trading engine powered by Rust

Example usage:
    >>> from hquant import HQuant, FuturesBacktest
    >>> hq = HQuant(capacity=64)
    >>> hq.add_indicator("rsi_3", {"type": "rsi", "period": 3})
    >>> sid = hq.add_strategy("s", "IF RSI(3) < 30 THEN BUY\\nIF RSI(3) > 70 THEN SELL")
    >>>
    >>> bt = FuturesBacktest(
    ...     initial_margin=1000,
    ...     leverage=10,
    ...     contract_size=1,
    ...     maker_fee_rate=0.0004,
    ...     taker_fee_rate=0.0004,
    ...     maintenance_margin_rate=0.005,
    ... )
    >>>
    >>> bar = {"timestamp": 1, "open": 100, "high": 100, "low": 100, "close": 100, "volume": 1}
    >>> hq.push_bar(bar)
    >>> for sig in hq.poll_signals():
    ...     bt.apply_signal(sig["action"], bar["close"], 100)
"""

from hquant._hquant import (
    HQuant,
    PyBacktest as Backtest,
    PyAggregator as Aggregator,
    PyDslStrategy as DslStrategy,
    FuturesBacktest,
    validate_dsl,
)

__all__ = [
    "HQuant",
    "Backtest",
    "Aggregator",
    "DslStrategy",
    "FuturesBacktest",
    "validate_dsl",
]

__version__ = "0.1.0"
