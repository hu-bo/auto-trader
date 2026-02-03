from __future__ import annotations

from contextlib import asynccontextmanager
from typing import AsyncIterator

from casdoor_py import CasdoorConfig, create_casdoor_server
from fastapi import FastAPI
from hquant_logger import create_logger

from app.api.v1.router import router as v1_router
from app.config import get_settings
from app.db import Base
from app.db.session import create_database
from app.grpc.exchange_client import ExchangeGrpcClient
from app.middleware.auth import create_auth_middleware
from app.middleware.error_handler import register_exception_handlers

# 初始化全局日志
logger = create_logger("trader-service")


def create_app() -> FastAPI:
    settings = get_settings()

    # 初始化 Casdoor Server（如果使用 casdoor 认证）
    casdoor_server = None
    if settings.auth_mode == "casdoor":
        logger.info("Initializing Casdoor server...")
        casdoor_server = create_casdoor_server(
            CasdoorConfig(
                endpoint=settings.casdoor_endpoint,
                client_id=settings.casdoor_client_id,
                org_name=settings.casdoor_org_name,
                app_name=settings.casdoor_app_name,
                client_secret=settings.casdoor_client_secret,
                certificate=settings.casdoor_certificate,
            )
        )
        logger.info("Casdoor server initialized successfully")

    @asynccontextmanager
    async def lifespan(app: FastAPI) -> AsyncIterator[None]:
        db = create_database(settings.database_url)
        app.state.db = db
        app.state.exchange_grpc = ExchangeGrpcClient(settings.exchange_grpc_url)
        app.state.casdoor_server = casdoor_server

        if settings.app_env in {"development", "test"}:
            logger.info(f"Creating database tables in {settings.app_env} mode...")
            async with db.engine.begin() as conn:
                await conn.run_sync(Base.metadata.create_all)
            logger.info("Database tables created successfully")

        yield
        await app.state.exchange_grpc.close()
        await db.engine.dispose()

    app = FastAPI(title="Trading Platform Service", version="0.1.0", lifespan=lifespan)

    # 注册异常处理器
    register_exception_handlers(app)

    # 注册认证中间件
    # 定义不需要认证的路径
    exclude_paths = [
        "/health",
        "/docs",
        "/redoc",
        "/openapi.json",
        "/api/v1/auth/callback",  # OAuth 回调不需要认证
    ]
    auth_middleware = create_auth_middleware(settings, casdoor_server, exclude_paths)
    app.middleware("http")(auth_middleware)

    @app.get("/health")
    async def health() -> dict:
        return {"status": "ok"}

    app.include_router(v1_router, prefix="/api/v1")
    return app


app = create_app()
