from __future__ import annotations


def candle_subject(prefix: str, exchange: str, trade_type: str, symbol: str, period: str) -> str:
    return f"{prefix}.candle.{exchange}.{trade_type}.{symbol}.{period}"


def signal_subject(prefix: str, exchange: str, trade_type: str, symbol: str) -> str:
    return f"{prefix}.{exchange}.{trade_type}.{symbol}"


def signal_subject_by_strategy(prefix: str, strategy_id: int) -> str:
    return f"{prefix}.{strategy_id}"

