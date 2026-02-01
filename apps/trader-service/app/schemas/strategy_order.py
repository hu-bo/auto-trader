from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class StrategyOrderCreate(BaseModel):
    strategy_id: str
    exchange_id: str
    symbols: list[str]
    parameters: dict[str, Any] = Field(default_factory=dict)
    risk_config: dict[str, Any] = Field(default_factory=dict)
    live: bool = False


class StrategyOrderUpdate(BaseModel):
    symbols: list[str] | None = None
    parameters: dict[str, Any] | None = None
    risk_config: dict[str, Any] | None = None
    live: bool | None = None


class StrategyOrderRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    user_id: str
    strategy_id: str
    exchange_id: str
    symbols: list[str]
    parameters: dict[str, Any]
    risk_config: dict[str, Any]
    live: bool
    is_running: bool
    started_at: datetime | None
    stopped_at: datetime | None
    created_at: datetime
    updated_at: datetime

