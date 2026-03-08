from __future__ import annotations

import json
from contextlib import asynccontextmanager
from typing import AsyncIterator

from fastapi import FastAPI
from hquant_logger import create_logger

from app.api.v1.health import router as health_router
from app.api.v1.router import router as v1_router
from app.config import get_settings
from app.core.history_preloader import HistoryPreloader
from app.core.strategy_executor import StrategyExecutor
from app.core.strategy_manager import StrategyManager
from app.grpc.server import GrpcServer
from app.nats.client import NatsClient
from app.nats.subscriber import CandleSubscriber

logger = create_logger("strategy-engine")


def create_app() -> FastAPI:
    settings = get_settings()

    # Signal NATS — for publishing signals to trader-service-node
    signal_nats = NatsClient(
        settings.signal_nats_url,
        name="strategy-engine-signal",
        user=settings.signal_nats_user,
        password=settings.signal_nats_pass,
    )

    # Upstream NATS — for subscribing candle data from exchange-adapter-service
    # Falls back to the signal NATS when UPSTREAM_NATS_URL is not configured.
    if settings.upstream_nats_url:
        upstream_nats = NatsClient(
            settings.upstream_nats_url,
            name="strategy-engine-upstream",
            user=settings.upstream_nats_user,
            password=settings.upstream_nats_pass,
        )
    else:
        upstream_nats = signal_nats

    @asynccontextmanager
    async def lifespan(app: FastAPI) -> AsyncIterator[None]:
        await signal_nats.connect()
        if upstream_nats is not signal_nats:
            await upstream_nats.connect()

        manager: StrategyManager | None = None

        async def on_candle(candle) -> None:
            if manager is None:
                return
            await manager.handle_candle(candle)

        # Subscribe candles from upstream NATS
        subscriber = CandleSubscriber(upstream_nats, on_candle)

        # History preloader for exchange-adapter-service
        preloader = HistoryPreloader(settings.exchange_adapter_url)

        # Publish signals to local NATS
        executor = StrategyExecutor(
            nats_client=signal_nats,
            signal_subject_prefix=settings.signal_subject_prefix,
            signal_strategy_subject_prefix=settings.signal_strategy_subject_prefix,
        )
        manager = StrategyManager(
            candle_subscriber=subscriber,
            executor=executor,
            candle_buffer_size=settings.candle_buffer_size,
            candle_subject_prefix=settings.upstream_subject_prefix,
            history_preloader=preloader,
            history_preload_days=settings.history_preload_days,
        )

        # --- gRPC server ---------------------------------------------------
        grpc_server = GrpcServer(
            port=settings.grpc_port,
            manager=manager,
            candle_subject_prefix=settings.upstream_subject_prefix,
            tls_enabled=settings.grpc_tls_enabled,
            cert_file=settings.grpc_tls_cert_file,
            key_file=settings.grpc_tls_key_file,
            ca_file=settings.grpc_tls_ca_file,
        )
        await grpc_server.start()

        # Notify downstream services that the engine is ready.
        logger.info(f"Publishing strategy.engine.started to signal NATS [{settings.signal_nats_url}]")
        await signal_nats.publish(
            "strategy.engine.started",
            json.dumps({"status": "started"}).encode(),
        )

        app.state.settings = settings
        app.state.nats = signal_nats
        app.state.upstream_nats = upstream_nats
        app.state.strategy_manager = manager
        app.state.grpc_server = grpc_server

        upstream_url = settings.upstream_nats_url or settings.signal_nats_url
        logger.info(
            f"Strategy engine started env={settings.app_env} "
            f"signal_nats={settings.signal_nats_url} "
            f"upstream_nats={upstream_url} "
            f"grpc_port={settings.grpc_port} "
            f"grpc_tls={settings.grpc_tls_enabled}"
        )

        yield

        await grpc_server.stop()
        await subscriber.close()
        if upstream_nats is not signal_nats:
            await upstream_nats.close()
        await signal_nats.close()

        logger.info("Strategy engine stopped")

    app = FastAPI(title="Strategy Engine", version="1.0.0", lifespan=lifespan)
    app.include_router(health_router)
    app.include_router(v1_router, prefix="/api/v1")
    return app


app = create_app()
