from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class Signal(BaseModel):
    model_config = ConfigDict(extra="ignore")

    signal_id: str
    strategy_id: int
    strategy_name: str
    exchange: str
    trade_type: str
    symbol: str
    period: str
    action: str
    price: float
    confidence: float = Field(ge=0.0, le=1.0)
    timestamp: datetime

