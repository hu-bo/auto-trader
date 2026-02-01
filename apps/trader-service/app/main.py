from __future__ import annotations

from contextlib import asynccontextmanager
from typing import AsyncIterator

from fastapi import FastAPI

from app.api.v1.router import router as v1_router
from app.config import get_settings
from app.db import Base  # noqa: F401
from app.db.session import create_database
from app.grpc.exchange_client import ExchangeGrpcClient
from app.middleware.error_handler import register_exception_handlers


def create_app() -> FastAPI:
    settings = get_settings()

    @asynccontextmanager
    async def lifespan(app: FastAPI) -> AsyncIterator[None]:
        db = create_database(settings.database_url)
        app.state.db = db
        app.state.exchange_grpc = ExchangeGrpcClient(settings.exchange_grpc_url)

        if settings.app_env in {"development", "test"}:
            async with db.engine.begin() as conn:
                await conn.run_sync(Base.metadata.create_all)

        yield
        await app.state.exchange_grpc.close()
        await db.engine.dispose()

    app = FastAPI(title="Trading Platform Service", version="0.1.0", lifespan=lifespan)

    register_exception_handlers(app)

    @app.get("/health")
    async def health() -> dict:
        return {"status": "ok"}

    app.include_router(v1_router, prefix="/api/v1")
    return app


app = create_app()
