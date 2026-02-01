from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class ExchangeCreate(BaseModel):
    exchange_type: str = Field(..., examples=["BINANCE", "OKX"])
    name: str
    api_key: str
    api_secret: str
    passphrase: str | None = None
    is_testnet: bool = False
    is_active: bool = True


class ExchangeUpdate(BaseModel):
    name: str | None = None
    api_key: str | None = None
    api_secret: str | None = None
    passphrase: str | None = None
    is_testnet: bool | None = None
    is_active: bool | None = None


class ExchangeRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    user_id: str
    exchange_type: str
    name: str
    has_grpc_token: bool
    is_testnet: bool
    is_active: bool
    created_at: datetime
    updated_at: datetime
