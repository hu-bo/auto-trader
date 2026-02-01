from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class StrategyTag(str, Enum):
    neutral = "neutral"
    long = "long"
    short = "short"


class StrategyCreate(BaseModel):
    name: str
    description: str = ""
    tag: StrategyTag = StrategyTag.neutral
    code: str = ""
    params: dict[str, Any] = Field(default_factory=dict)
    version: str = "v1"
    status: str = "inactive"
    is_public: bool = True


class StrategyUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    tag: StrategyTag | None = None
    code: str | None = None
    params: dict[str, Any] | None = None
    version: str | None = None
    status: str | None = None
    is_public: bool | None = None


class StrategyRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    user_id: str
    name: str
    description: str
    tag: str
    code: str
    params: dict[str, Any]
    version: str
    status: str
    is_public: bool
    created_at: datetime
    updated_at: datetime

