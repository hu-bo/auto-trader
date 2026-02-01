from __future__ import annotations

from pydantic import BaseModel, Field


class PlaceOrderIn(BaseModel):
    exchange_id: str
    symbol: str = Field(..., examples=["BTC-USDT"])
    trade_type: str = Field(..., examples=["spot", "futures"])
    side: str = Field(..., examples=["buy", "sell"])
    order_type: str = Field(..., examples=["market", "limit"])
    quantity: float
    price: float | None = None
    position_side: str | None = Field(default=None, examples=["long", "short"])
    leverage: int | None = None
    client_order_id: str | None = None
    reduce_only: bool | None = None


class SetLeverageIn(BaseModel):
    exchange_id: str
    symbol: str = Field(..., examples=["BTC-USDT"])
    leverage: int
    trade_type: str = Field(..., examples=["futures"])
    position_side: str | None = Field(default=None, examples=["long", "short"])


class ClosePositionIn(BaseModel):
    exchange_id: str
    order_type: str = Field(default="market", examples=["market"])
    price: float | None = None
    client_order_id: str | None = None

