from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class StrategyRef(BaseModel):
    model_config = ConfigDict(extra="forbid")

    strategy_id: int = Field(ge=1)
    exchange: str = Field(min_length=1)
    trade_type: str = Field(min_length=1)
    symbol: str = Field(min_length=1)
    period: str = Field(default="15m", min_length=1)


class StrategyConfig(StrategyRef):
    strategy_name: str = Field(min_length=1)
    code: str = Field(min_length=1)


class CreateStrategyRequest(StrategyConfig):
    pass


class UpdateStrategyRequest(StrategyConfig):
    pass


class DeleteStrategyRequest(StrategyRef):
    pass


class StrategyInstanceInfo(StrategyConfig):
    created_at: datetime

