from __future__ import annotations

from functools import lru_cache
from pathlib import Path
from typing import Literal

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

    app_env: Literal["development", "test", "production"] = Field(
        default="development", alias="APP_ENV"
    )
    app_port: int = Field(default=9003, alias="APP_PORT")

    database_url: str = Field(
        default="postgresql+asyncpg://postgres:postgres@localhost:5432/trader", alias="DATABASE_URL"
    )
    redis_url: str = Field(default="redis://localhost:16000/0", alias="REDIS_URL")
    nats_url: str = Field(default="nats://localhost:15002", alias="NATS_URL")

    exchange_grpc_url: str = Field(
        default="exchange-service:50051", alias="EXCHANGE_GRPC_URL"
    )

    auth_mode: Literal["mock", "casdoor"] = Field(default="casdoor", alias="AUTH_MODE")

    casdoor_endpoint: str = Field(
        default="http://sso.8and1.cn", alias="CASDOOR_ENDPOINT"
    )
    casdoor_client_id: str = Field(
        default="7b474919541526399765", alias="CASDOOR_CLIENT_ID"
    )
    casdoor_client_secret: str | None = Field(default=None, alias="CASDOOR_CLIENT_SECRET")
    casdoor_org_name: str = Field(default="8PLUS1", alias="CASDOOR_ORG_NAME")
    casdoor_app_name: str = Field(default="trader", alias="CASDOOR_APP_NAME")
    casdoor_certificate_path: str | None = Field(default=None, alias="CASDOOR_CERTIFICATE_PATH")

    encryption_key: str | None = Field(default=None, alias="ENCRYPTION_KEY")

    @property
    def casdoor_certificate(self) -> str | None:
        """从文件路径读取证书内容"""
        if not self.casdoor_certificate_path:
            return None
        try:
            cert_path = Path(self.casdoor_certificate_path)
            if cert_path.exists():
                return cert_path.read_text(encoding="utf-8")
            return None
        except Exception:
            return None


@lru_cache
def get_settings() -> Settings:
    return Settings()
