from __future__ import annotations

from collections.abc import AsyncIterator
from typing import Any

import jwt
from fastapi import Depends, Header, HTTPException, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import Settings, get_settings
from app.db.session import Database
from app.grpc.exchange_client import ExchangeGrpcClient
from app.services import ExchangeService, StrategyOrderService, StrategyService, UserService
from app.utils.encryption import AesGcmEncryptor


class CurrentUser:
    def __init__(self, user_id: str, username: str):
        self.user_id = user_id
        self.username = username


def get_current_user(
    settings: Settings = Depends(get_settings),
    authorization: str | None = Header(default=None, alias="Authorization"),
    x_user_id: str | None = Header(default=None, alias="X-User-Id"),
    x_username: str | None = Header(default=None, alias="X-Username"),
) -> CurrentUser:
    if settings.auth_mode == "mock":
        user_id = x_user_id or "demo-user"
        username = x_username or "demo"
        return CurrentUser(user_id=user_id, username=username)

    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing Bearer token",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token = authorization[7:]
    certificate = settings.casdoor_certificate
    if not certificate:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="CASDOOR_CERTIFICATE is required when AUTH_MODE=casdoor",
        )

    try:
        claims: dict[str, Any] = jwt.decode(
            token,
            certificate,
            algorithms=["RS256"],
            options={"verify_aud": False},
        )
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid token: {exc}",
            headers={"WWW-Authenticate": "Bearer"},
        ) from exc

    user_id = str(claims.get("sub") or claims.get("name") or "")
    username = str(claims.get("name") or claims.get("sub") or "")
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token payload: missing sub/name",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return CurrentUser(user_id=user_id, username=username)


async def get_db_session(request: Request) -> AsyncIterator[AsyncSession]:
    db: Database = request.app.state.db
    async with db.sessionmaker() as session:
        yield session


def get_user_service() -> UserService:
    return UserService()


def get_strategy_service() -> StrategyService:
    return StrategyService()


def get_strategy_order_service() -> StrategyOrderService:
    return StrategyOrderService()


def get_encryptor(settings: Settings = Depends(get_settings)) -> AesGcmEncryptor | None:
    if not settings.encryption_key:
        return None
    return AesGcmEncryptor.from_key(settings.encryption_key)


def get_exchange_service(
    encryptor: AesGcmEncryptor | None = Depends(get_encryptor),
) -> ExchangeService:
    return ExchangeService(encryptor=encryptor)


def get_exchange_grpc_client(request: Request) -> ExchangeGrpcClient:
    return request.app.state.exchange_grpc
