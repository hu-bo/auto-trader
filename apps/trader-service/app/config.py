from __future__ import annotations

from functools import lru_cache
from typing import Literal

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

    app_env: Literal["development", "test", "production"] = Field(
        default="development", alias="APP_ENV"
    )
    app_port: int = Field(default=9001, alias="APP_PORT")

    database_url: str = Field(
        default="sqlite+aiosqlite:///./trader_service.db", alias="DATABASE_URL"
    )
    redis_url: str = Field(default="redis://localhost:16000/0", alias="REDIS_URL")
    nats_url: str = Field(default="nats://localhost:15002", alias="NATS_URL")

    exchange_grpc_url: str = Field(
        default="exchange-service:50051", alias="EXCHANGE_GRPC_URL"
    )

    auth_mode: Literal["mock", "casdoor"] = Field(default="mock", alias="AUTH_MODE")

    casdoor_endpoint: str = Field(
        default="http://auth.8and1.cn", alias="CASDOOR_ENDPOINT"
    )
    casdoor_client_id: str = Field(
        default="a1aa7c75ba336df51788", alias="CASDOOR_CLIENT_ID"
    )
    casdoor_client_secret: str | None = Field(default=None, alias="CASDOOR_CLIENT_SECRET")
    casdoor_org_name: str = Field(default="built-in", alias="CASDOOR_ORG_NAME")
    casdoor_app_name: str = Field(default="trader", alias="CASDOOR_APP_NAME")
    casdoor_certificate: str | None = Field(default=None, alias="CASDOOR_CERTIFICATE")

    encryption_key: str | None = Field(default=None, alias="ENCRYPTION_KEY")


@lru_cache
def get_settings() -> Settings:
    return Settings()
