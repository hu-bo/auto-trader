from __future__ import annotations

from contextlib import asynccontextmanager
from typing import AsyncIterator

from fastapi import FastAPI
from hquant_logger import create_logger

from app.api.v1.health import router as health_router
from app.api.v1.router import router as v1_router
from app.config import get_settings
from app.core.strategy_executor import StrategyExecutor
from app.core.strategy_manager import StrategyManager
from app.nats.client import NatsClient
from app.nats.subscriber import CandleSubscriber

logger = create_logger("strategy-engine")


def create_app() -> FastAPI:
    settings = get_settings()

    nats_client = NatsClient(settings.nats_url, name="strategy-engine")

    @asynccontextmanager
    async def lifespan(app: FastAPI) -> AsyncIterator[None]:
        await nats_client.connect()

        manager: StrategyManager | None = None

        async def on_candle(candle) -> None:
            if manager is None:
                return
            await manager.handle_candle(candle)

        subscriber = CandleSubscriber(nats_client, on_candle)

        executor = StrategyExecutor(
            nats_client=nats_client,
            signal_subject_prefix=settings.signal_subject_prefix,
            signal_strategy_subject_prefix=settings.signal_strategy_subject_prefix,
        )
        manager = StrategyManager(
            candle_subscriber=subscriber,
            executor=executor,
            candle_buffer_size=settings.candle_buffer_size,
            candle_subject_prefix=settings.nats_subject_prefix,
        )

        app.state.settings = settings
        app.state.nats = nats_client
        app.state.strategy_manager = manager

        logger.info(
            "Strategy engine started",
            app_env=settings.app_env,
            nats_url=settings.nats_url,
        )

        yield

        await subscriber.close()
        await nats_client.close()

        logger.info("Strategy engine stopped")

    app = FastAPI(title="Strategy Engine", version="1.0.0", lifespan=lifespan)
    app.include_router(health_router)
    app.include_router(v1_router, prefix="/api/v1")
    return app


app = create_app()

