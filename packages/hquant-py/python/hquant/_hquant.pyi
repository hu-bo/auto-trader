"""Type stubs for hquant native module"""

from typing import Dict, List, Optional, Any, TypedDict

class BarDict(TypedDict, total=False):
    timestamp: int
    open: float
    high: float
    low: float
    close: float
    volume: float
    buy_volume: float

class SignalDict(TypedDict):
    side: str  # "BUY" | "SELL" | "HOLD"
    strength: float
    reason: str
    timestamp: int

class IndicatorConfig(TypedDict, total=False):
    type: str  # "ma", "sma", "ema", "wma", "rsi", "macd", "atr", "boll", "vri", "vwap", "obv"
    period: int
    fast: int
    slow: int
    signal: int
    std_dev: float

class IndicatorResult(TypedDict, total=False):
    value: float
    timestamp: int
    extra: List[float]

class BacktestResult(TypedDict):
    total_trades: int
    winning_trades: int
    losing_trades: int
    total_pnl: float
    max_drawdown: float
    max_drawdown_pct: float
    sharpe_ratio: float
    win_rate: float
    final_equity: float
    return_pct: float
    liquidations: int

class AggregatorEvent(TypedDict, total=False):
    kind: str
    period: str
    candle: BarDict

class LabeledVectorDict(TypedDict):
    label: int
    vector: List[float]

class HQuant:
    """High-performance quantitative trading engine"""

    def __init__(self, capacity: int = 1000) -> None:
        """
        Create a new quantitative engine.

        Args:
            capacity: Maximum number of K-lines to store (default: 1000)
        """
        ...

    def add_indicator(self, name: str, config: IndicatorConfig) -> None:
        """
        Add an indicator to the engine.

        Args:
            name: Unique name for the indicator
            config: Indicator configuration dict

        Example:
            engine.add_indicator("rsi14", {"type": "rsi", "period": 14})
            engine.add_indicator("ma20", {"type": "ema", "period": 20})
            engine.add_indicator("macd", {"type": "macd", "fast": 12, "slow": 26, "signal": 9})
        """
        ...

    def push_kline(self, bar: BarDict) -> List[SignalDict]:
        """
        Push a new K-line and update all indicators.

        Args:
            bar: K-line data dict

        Returns:
            List of generated signals
        """
        ...

    def update_last(self, bar: BarDict) -> None:
        """
        Update the last K-line (for realtime data).

        Args:
            bar: Updated K-line data
        """
        ...

    def get_indicator(self, name: str) -> Optional[float]:
        """
        Get the current value of an indicator.

        Args:
            name: Indicator name

        Returns:
            Current indicator value or None if not ready
        """
        ...

    def get_indicator_result(self, name: str) -> Optional[IndicatorResult]:
        """
        Get indicator result with extra data (e.g., MACD histogram).

        Args:
            name: Indicator name

        Returns:
            Indicator result dict or None
        """
        ...

    def is_ready(self, name: str) -> bool:
        """
        Check if an indicator has enough data to produce valid results.

        Args:
            name: Indicator name

        Returns:
            True if indicator is ready
        """
        ...

    def reset(self) -> None:
        """Reset the engine, clearing all data."""
        ...

    # -- Strategy methods --

    def add_rsi_strategy(
        self,
        indicator_name: str,
        oversold: float = 30.0,
        overbought: float = 70.0,
    ) -> None:
        """
        Add RSI strategy (buy when oversold, sell when overbought).

        Args:
            indicator_name: Name of the RSI indicator to use
            oversold: Buy threshold (default: 30.0)
            overbought: Sell threshold (default: 70.0)
        """
        ...

    def add_macd_strategy(self, indicator_name: str) -> None:
        """
        Add MACD histogram crossover strategy.

        Args:
            indicator_name: Name of the MACD indicator to use
        """
        ...

    def add_boll_strategy(self, indicator_name: str) -> None:
        """
        Add Bollinger Band breakout strategy.

        Args:
            indicator_name: Name of the BOLL indicator to use
        """
        ...

    def add_ma_cross_strategy(self, fast_ma: str, slow_ma: str) -> None:
        """
        Add MA crossover strategy (golden/death cross).

        Args:
            fast_ma: Name of the fast moving average indicator
            slow_ma: Name of the slow moving average indicator
        """
        ...

    # -- Backtest methods --

    def setup_backtest(
        self,
        initial_capital: float,
        market_type: str = "spot",
        leverage: float = 1.0,
        maker_fee: float = 0.001,
        taker_fee: float = 0.001,
        slippage: float = 0.0005,
        position_size_pct: float = 0.1,
    ) -> None:
        """
        Setup backtest engine.

        Args:
            initial_capital: Initial capital for backtesting
            market_type: "spot" or "futures" (default: "spot")
            leverage: Leverage ratio (default: 1.0)
            maker_fee: Maker fee rate (default: 0.1%)
            taker_fee: Taker fee rate (default: 0.1%)
            slippage: Slippage rate (default: 0.05%)
            position_size_pct: Position size as fraction of capital (default: 0.1)
        """
        ...

    def backtest_result(self) -> Optional[BacktestResult]:
        """
        Get backtest statistics.

        Returns:
            Backtest result dict or None if backtest not configured
        """
        ...

    def backtest_trades(self) -> List[Dict[str, Any]]:
        """
        Get backtest trade records.

        Returns:
            List of trade dicts with keys: timestamp, side, price, size, fee, pnl
        """
        ...

    def backtest_equity_curve(self) -> List[float]:
        """
        Get backtest equity curve.

        Returns:
            List of equity values over time
        """
        ...

class PyBacktest:
    """Backtest engine for strategy evaluation"""

    def __init__(
        self,
        initial_margin: float,
        leverage: float = 1.0,
        maker_fee_rate: float = 0.001,
        taker_fee_rate: float = 0.001,
        market_type: str = "spot",
    ) -> None:
        """
        Create a backtest engine.

        Args:
            initial_margin: Initial capital
            leverage: Leverage ratio (default: 1.0)
            maker_fee_rate: Maker fee rate (default: 0.1%)
            taker_fee_rate: Taker fee rate (default: 0.1%)
            market_type: "spot" or "futures"
        """
        ...

    def open_long(self, price: float, size: float) -> None:
        """Open a long position."""
        ...

    def open_short(self, price: float, size: float) -> None:
        """Open a short position (futures only)."""
        ...

    def close(self, price: float) -> None:
        """Close current position."""
        ...

    def backtest_result(self) -> BacktestResult:
        """Get backtest statistics."""
        ...

    def get_equity(self) -> float:
        """Get current equity."""
        ...

    def get_equity_curve(self) -> List[float]:
        """Get equity curve."""
        ...

    def reset(self) -> None:
        """Reset backtest state."""
        ...

class PyAggregator:
    """Multi-timeframe K-line aggregator"""

    def __init__(self, base_tf: str, target_tfs: List[str], capacity: int) -> None:
        """
        Create a multi-timeframe aggregator.

        Args:
            base_tf: Base timeframe (e.g., "1m", "15m")
            target_tfs: Target timeframes to aggregate (e.g., ["1h", "4h", "1d"])
            capacity: Capacity for each timeframe
        """
        ...

    def push_kline(self, bar: BarDict) -> List[AggregatorEvent]:
        """
        Push a K-line and get completed candle events.

        Args:
            bar: K-line data

        Returns:
            List of completed candle events
        """
        ...

    def flush(self) -> None:
        """Flush all pending candles."""
        ...

    def reset(self) -> None:
        """Reset aggregator state."""
        ...

class PyDslStrategy:
    """DSL-based strategy engine"""

    def __init__(self, source: str) -> None:
        """
        Create a DSL strategy from source code.

        Args:
            source: DSL source code

        Example:
            strategy = PyDslStrategy('''
                IF RSI(14) < 30 THEN BUY
                IF RSI(14) > 70 THEN SELL
            ''')
        """
        ...

    def load_store(self, name: str, vectors: List[LabeledVectorDict]) -> None:
        """
        Load labeled vectors for similarity matching.

        Args:
            name: Store name (used in VEC_STORE())
            vectors: List of labeled vector dicts
        """
        ...

    def set_threshold(self, threshold: float) -> None:
        """Set similarity threshold (default: 0.9)."""
        ...

    def evaluate(self, bar: BarDict) -> List[SignalDict]:
        """
        Evaluate strategy with given bar data.

        Args:
            bar: K-line data

        Returns:
            List of generated signals
        """
        ...

    def reset(self) -> None:
        """Reset strategy state."""
        ...

def validate_dsl(source: str) -> bool:
    """
    Validate DSL source code without creating an engine.

    Args:
        source: DSL source code

    Returns:
        True if valid

    Raises:
        ValueError: If DSL has syntax errors
    """
    ...
