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
    app_port: int = Field(default=9002, alias="APP_PORT")

    nats_url: str = Field(default="nats://localhost:16002", alias="NATS_URL")
    nats_subject_prefix: str = Field(default="exchange", alias="NATS_SUBJECT_PREFIX")
    signal_subject_prefix: str = Field(default="signal", alias="SIGNAL_SUBJECT_PREFIX")
    signal_strategy_subject_prefix: str | None = Field(
        default=None, alias="SIGNAL_STRATEGY_SUBJECT_PREFIX"
    )

    candle_buffer_size: int = Field(default=1000, alias="CANDLE_BUFFER_SIZE")
    log_level: str = Field(default="INFO", alias="LOG_LEVEL")


@lru_cache
def get_settings() -> Settings:
    return Settings()
