"""Type stubs for hquant native module"""

from typing import Dict, List, Optional, Any, TypedDict, Literal

PositionSide = Literal["LONG", "SHORT"]

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

class DslSignalDict(TypedDict):
    strategy_id: int
    action: str  # "BUY" | "SELL" | "HOLD"
    timestamp: int

class FuturesBacktestResultDict(TypedDict):
    equity: float
    profit: float
    profit_rate: float
    max_drawdown_rate: float
    liquidated: bool

class FuturesPositionDict(TypedDict):
    position_side: str  # "LONG" | "SHORT"
    entry_price: float
    mark_price: float
    position_amt: float
    margin: float
    unrealized_pnl: float

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

    # -- DSL Strategy methods --

    def add_strategy(self, name: str, dsl: str) -> int:
        """
        Add a DSL-based strategy.

        Args:
            name: Strategy name
            dsl: DSL source code

        Returns:
            Strategy ID (>0 on success)

        Raises:
            ValueError: If DSL compilation fails
        """
        ...

    def push_bar(self, bar: BarDict) -> None:
        """
        Push bar and evaluate DSL strategies.

        Args:
            bar: K-line data dict
        """
        ...

    def poll_signals(self) -> List[DslSignalDict]:
        """
        Poll accumulated signals from DSL strategies.

        Returns:
            List of signal dicts with keys: strategy_id, action, timestamp
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

    def open_position(self, price: float, size: float, position_side: PositionSide) -> None:
        """Open a position."""
        ...

    def close_position(self, price: float, position_side: PositionSide) -> None:
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

class FuturesBacktest:
    """Standalone futures backtest engine (compatible with jx-quant)"""

    def __init__(
        self,
        initial_margin: float,
        leverage: float,
        contract_size: float,
        maker_fee_rate: float,
        taker_fee_rate: float,
        maintenance_margin_rate: float,
    ) -> None:
        """
        Create a futures backtest engine.

        Args:
            initial_margin: Initial margin (capital)
            leverage: Leverage ratio
            contract_size: Contract size
            maker_fee_rate: Maker fee rate
            taker_fee_rate: Taker fee rate
            maintenance_margin_rate: Maintenance margin rate
        """
        ...

    def apply_signal(
        self,
        action: str,
        price: float,
        margin: float,
        position_side: Optional[PositionSide] = ...,
        is_maker: bool = ...,
    ) -> None:
        """
        Apply a trading signal.

        Args:
            action: "BUY", "SELL", or "HOLD"
            price: Current market price
            margin: Margin amount to use for opening/closing positions
        """
        ...

    def open_position(self, position_side: PositionSide, price: float, margin: float, is_maker: bool = ...) -> None:
        """Open a position directly."""
        ...

    def close_position(self, position_side: PositionSide, price: float, margin: float, is_maker: bool = ...) -> None:
        """Close a position directly."""
        ...

    def on_price(self, price: float) -> None:
        """
        Update position value on price change (for liquidation checking).

        Args:
            price: Current market price
        """
        ...

    def result(self, price: float) -> FuturesBacktestResultDict:
        """
        Get backtest result.

        Args:
            price: Current market price (for unrealized PnL calculation)

        Returns:
            Result dict with keys: equity, profit, profit_rate, max_drawdown_rate, liquidated
        """
        ...

    def get_positions(self) -> List[FuturesPositionDict]:
        """Get current positions (0 or 1)."""
        ...
