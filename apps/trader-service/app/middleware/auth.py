"""统一认证中间件"""
from __future__ import annotations

import json
from typing import Optional

from casdoor_py import CasdoorServer, create_fastapi_auth_middleware
from fastapi import Request, status
from fastapi.responses import JSONResponse
from hquant_logger import create_logger

from app.config import Settings
from app.schemas import ApiResponse

logger = create_logger("trader-service").child("auth-middleware")


class CurrentUser:
    """当前用户信息"""

    def __init__(self, user_id: str, username: str, is_admin: bool = False):
        self.user_id = user_id
        self.username = username
        self.is_admin = is_admin


def create_mock_auth_middleware(exclude_paths: Optional[list[str]] = None):
    """
    创建 Mock 认证中间件，用于开发和测试环境

    Args:
        exclude_paths: 不需要认证的路径列表

    将用户信息存储在 request.state.user (CurrentUser 类型)
    """
    exclude_paths = exclude_paths or []

    async def middleware(request: Request, call_next):
        # 检查是否排除路径
        if request.url.path in exclude_paths:
            return await call_next(request)

        # 从 Header 获取用户信息
        user_id = request.headers.get("X-User-Id", "demo-user")
        username = request.headers.get("X-Username", "demo")

        logger.info(f"[Mock Auth] User: {username} ({user_id})")

        # 将用户信息存储到 request.state
        request.state.user = CurrentUser(user_id=user_id, username=username, is_admin=True)

        response = await call_next(request)
        return response

    return middleware


def create_casdoor_auth_middleware(
    server: CasdoorServer,
    exclude_paths: Optional[list[str]] = None,
):
    """
    创建 Casdoor 认证中间件（自己实现，不使用 casdoor-py 的中间件）

    Args:
        server: Casdoor 服务器实例
        exclude_paths: 不需要认证的路径列表

    将用户信息存储在 request.state.user (CurrentUser 类型)
    """
    exclude_paths = exclude_paths or []

    async def middleware(request: Request, call_next):
        # 检查是否排除路径
        if request.url.path in exclude_paths:
            return await call_next(request)

        # 获取 Token
        token = None
        auth = request.headers.get("Authorization", "")
        if auth.startswith("Bearer "):
            token = auth[7:]

        if not token:
            logger.warning("[Casdoor Auth] No token provided")
            api_response = ApiResponse.error(code=401, message="No token provided")
            return JSONResponse(
                status_code=status.HTTP_401_UNAUTHORIZED,
                content=api_response.model_dump(),
                headers={"WWW-Authenticate": "Bearer"},
            )

        # 验证 Token
        try:
            result = await server.verify_token(token)
            if not result.valid:
                logger.warning(f"[Casdoor Auth] Invalid token: {result.error}")
                api_response = ApiResponse.error(code=401, message=result.error or "Invalid token")
                return JSONResponse(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    content=api_response.model_dump(),
                    headers={"WWW-Authenticate": "Bearer"},
                )

            if not result.user:
                logger.error("[Casdoor Auth] Token valid but no user info")
                api_response = ApiResponse.error(code=401, message="Invalid token: no user info")
                return JSONResponse(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    content=api_response.model_dump(),
                    headers={"WWW-Authenticate": "Bearer"},
                )

            # 将 CasdoorUser 转换为 CurrentUser 并存储
            casdoor_user = result.user
            request.state.user = CurrentUser(
                user_id=casdoor_user.id,
                username=casdoor_user.name,
                is_admin=casdoor_user.is_admin,
            )
            request.state.claims = result.claims
            logger.info(f"[Casdoor Auth] User authenticated: {casdoor_user.name} ({casdoor_user.id})")

            # 继续处理请求
            response = await call_next(request)
            return response

        except Exception as e:
            logger.exception(f"[Casdoor Auth] Authentication error: {e}")
            api_response = ApiResponse.error(code=500, message=f"Authentication error: {str(e)}")
            return JSONResponse(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                content=api_response.model_dump(),
            )

    return middleware


def create_auth_middleware(
    settings: Settings,
    casdoor_server: Optional[CasdoorServer] = None,
    exclude_paths: Optional[list[str]] = None,
):
    """
    根据配置创建认证中间件

    Args:
        settings: 应用配置
        casdoor_server: Casdoor 服务器实例（auth_mode=casdoor 时必需）
        exclude_paths: 不需要认证的路径列表

    Returns:
        认证中间件函数
    """
    if settings.auth_mode == "mock":
        logger.info("[Auth] Using Mock authentication middleware")
        return create_mock_auth_middleware(exclude_paths)
    elif settings.auth_mode == "casdoor":
        if not casdoor_server:
            raise ValueError("casdoor_server is required when auth_mode=casdoor")
        logger.info("[Auth] Using Casdoor authentication middleware")
        return create_casdoor_auth_middleware(casdoor_server, exclude_paths)
    else:
        raise ValueError(f"Unsupported auth_mode: {settings.auth_mode}")
