from __future__ import annotations

from collections.abc import AsyncIterator

from fastapi import Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import Settings, get_settings
from app.db.session import Database
from app.grpc.exchange_client import ExchangeGrpcClient
from app.middleware.auth import CurrentUser  # noqa: F401 - 导出供其他模块使用
from app.services import ExchangeService, StrategyOrderService, StrategyService, UserService
from app.utils.encryption import AesGcmEncryptor

# 导出 CurrentUser 供其他模块使用
__all__ = ["CurrentUser", "get_current_user"]


def get_current_user(request: Request) -> CurrentUser:
    """
    获取当前用户依赖

    从 request.state.user 获取用户信息（由认证中间件设置）

    使用方式：
        @router.get("/protected")
        async def protected(user: CurrentUser = Depends(get_current_user)):
            return {"user": user.username}
    """
    if not hasattr(request.state, "user"):
        # 这种情况不应该发生，因为中间件应该已经设置了 user
        # 如果发生，说明路径可能没有被中间件处理
        from fastapi import HTTPException, status
        from hquant_logger import create_logger

        logger = create_logger("trader-service").child("dependencies")
        logger.error(
            f"User not found in request.state for path: {request.url.path}. "
            f"This path might be missing from exclude_paths or middleware not properly set."
        )

        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not authenticated",
        )

    user = request.state.user
    if not isinstance(user, CurrentUser):
        from fastapi import HTTPException, status
        from hquant_logger import create_logger

        logger = create_logger("trader-service").child("dependencies")
        logger.error(
            f"Invalid user type in request.state: {type(user)}. Expected CurrentUser. "
            f"Path: {request.url.path}"
        )

        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Invalid user type",
        )

    return user


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
