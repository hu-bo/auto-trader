from __future__ import annotations

from pydantic import AliasChoices, BaseModel, ConfigDict, Field


class Candle(BaseModel):
    """Normalized candle message from exchange-adapter-service."""

    model_config = ConfigDict(extra="ignore")

    symbol: str
    exchange: str
    trade_type: str = Field(validation_alias=AliasChoices("trade_type", "tradeType"))
    period: str
    timestamp: int

    open: float
    high: float
    low: float
    close: float

    volume: float = 0.0
    buy_volume: float = Field(
        default=0.0, validation_alias=AliasChoices("buy_volume", "buyVolume")
    )
    symbol_family: str | None = Field(
        default=None, validation_alias=AliasChoices("symbol_family", "symbolFamily")
    )

    def to_hquant_bar(self) -> dict:
        return {
            "timestamp": int(self.timestamp),
            "open": float(self.open),
            "high": float(self.high),
            "low": float(self.low),
            "close": float(self.close),
            "volume": float(self.volume),
            "buy_volume": float(self.buy_volume),
        }

