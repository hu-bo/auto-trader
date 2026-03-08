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
    app_port: int = Field(default=9004, alias="APP_PORT")

    # Signal NATS — publish signals & notifications to trader-service-node
    signal_nats_url: str = Field(default="nats://localhost:16001", alias="SIGNAL_NATS_URL")
    signal_nats_user: str | None = Field(default=None, alias="SIGNAL_NATS_USER")
    signal_nats_pass: str | None = Field(default=None, alias="SIGNAL_NATS_PASS")
    signal_subject_prefix: str = Field(default="signal", alias="SIGNAL_SUBJECT_PREFIX")
    signal_strategy_subject_prefix: str | None = Field(
        default=None, alias="SIGNAL_STRATEGY_SUBJECT_PREFIX"
    )

    # Upstream NATS — subscribe candle data from exchange-adapter-service
    upstream_nats_url: str = Field(default="", alias="UPSTREAM_NATS_URL")
    upstream_nats_user: str | None = Field(default=None, alias="UPSTREAM_NATS_USER")
    upstream_nats_pass: str | None = Field(default=None, alias="UPSTREAM_NATS_PASS")
    upstream_subject_prefix: str = Field(default="exchange", alias="UPSTREAM_SUBJECT_PREFIX")

    # Exchange Adapter Service — REST API for historical candle pre-loading
    exchange_adapter_url: str = Field(
        default="http://localhost:9100", alias="EXCHANGE_ADAPTER_URL"
    )
    history_preload_days: int = Field(default=3, alias="HISTORY_PRELOAD_DAYS")

    grpc_port: int = Field(default=9005, alias="GRPC_PORT")
    grpc_tls_enabled: bool = Field(default=False, alias="GRPC_TLS_ENABLED")
    grpc_tls_cert_file: str = Field(default="", alias="GRPC_TLS_CERT_FILE")
    grpc_tls_key_file: str = Field(default="", alias="GRPC_TLS_KEY_FILE")
    grpc_tls_ca_file: str = Field(default="", alias="GRPC_TLS_CA_FILE")

    candle_buffer_size: int = Field(default=1000, alias="CANDLE_BUFFER_SIZE")
    log_level: str = Field(default="INFO", alias="LOG_LEVEL")


@lru_cache
def get_settings() -> Settings:
    return Settings()
