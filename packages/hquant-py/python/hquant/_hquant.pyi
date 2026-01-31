from __future__ import annotations

from typing import Any, Dict, List, Optional, Sequence, TypedDict


class Bar(TypedDict, total=False):
    timestamp: int
    open: float
    high: float
    low: float
    close: float
    volume: float
    buy_volume: float
    buyVolume: float


class DslSignal(TypedDict):
    strategy_id: int
    action: str
    timestamp: int


class IndicatorResult(TypedDict, total=False):
    value: float
    timestamp: int
    extra: List[float]


class AggregatorEventCandle(TypedDict):
    timestamp: int
    open: float
    high: float
    low: float
    close: float
    volume: float
    buy_volume: float


class AggregatorEvent(TypedDict):
    kind: str
    period: str
    candle: AggregatorEventCandle


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


class FuturesBacktestResult(TypedDict):
    equity: float
    profit: float
    profit_rate: float
    max_drawdown_rate: float
    liquidated: bool


class FuturesPosition(TypedDict):
    position_side: str
    entry_price: float
    mark_price: float
    position_amt: float
    margin: float
    unrealized_pnl: float


class HQuant:
    def __init__(self, capacity: int = 1000) -> None: ...

    def add_indicator(self, name: str, config: Dict[str, Any]) -> None: ...
    def add_strategy(self, name: str, dsl: str) -> int: ...

    def push_kline(self, bar: Bar) -> List[Any]: ...
    def push_bar(self, bar: Bar) -> None: ...
    def update_last(self, bar: Bar) -> None: ...

    def get_indicator(self, name: str) -> Optional[float]: ...
    def get_indicator_result(self, name: str) -> Optional[IndicatorResult]: ...
    def is_ready(self, name: str) -> bool: ...

    def load_store(self, name: str, vectors: Sequence[Dict[str, Any]]) -> None: ...
    def set_threshold(self, threshold: float) -> None: ...

    def poll_signals(self) -> List[DslSignal]: ...
    def reset(self) -> None: ...


class PyBacktest:
    def __init__(
        self,
        initial_margin: float,
        leverage: float = ...,
        maker_fee_rate: float = ...,
        taker_fee_rate: float = ...,
        market_type: str = ...,
    ) -> None: ...

    def open_position(self, price: float, size: float, position_side: str) -> None: ...
    def close_position(self, price: float, position_side: str) -> None: ...
    def backtest_result(self) -> BacktestResult: ...
    def get_equity(self) -> float: ...
    def get_equity_curve(self) -> List[float]: ...
    def reset(self) -> None: ...


class PyAggregator:
    def __init__(self, base_tf: str, target_tfs: List[str], capacity: int) -> None: ...
    def push_kline(self, bar: Bar) -> List[AggregatorEvent]: ...
    def flush(self) -> None: ...
    def reset(self) -> None: ...


class PyDslStrategy:
    def __init__(self, source: str) -> None: ...
    def load_store(self, name: str, vectors: Sequence[Dict[str, Any]]) -> None: ...
    def set_threshold(self, threshold: float) -> None: ...
    def evaluate(self, bar: Bar) -> List[Dict[str, Any]]: ...
    def reset(self) -> None: ...


class FuturesBacktest:
    def __init__(
        self,
        initial_margin: float,
        leverage: float,
        contract_size: float,
        maker_fee_rate: float,
        taker_fee_rate: float,
        maintenance_margin_rate: float,
    ) -> None: ...

    def apply_signal(
        self,
        action: str,
        price: float,
        margin: float,
        position_side: Optional[str] = ...,
        is_maker: bool = ...,
    ) -> None: ...

    def open_position(self, position_side: str, price: float, margin: float, is_maker: bool = ...) -> None: ...
    def close_position(self, position_side: str, price: float, margin: float, is_maker: bool = ...) -> None: ...
    def on_price(self, price: float) -> None: ...

    def result(self, price: float) -> FuturesBacktestResult: ...
    def get_positions(self) -> List[FuturesPosition]: ...


def validate_dsl(source: str) -> bool: ...

