from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field


class SubscriptionRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    exchange: str = Field(min_length=1)
    trade_type: str = Field(min_length=1)
    symbol: str = Field(min_length=1)
    period: str = Field(min_length=1)

