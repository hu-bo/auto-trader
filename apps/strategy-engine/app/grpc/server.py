from __future__ import annotations

import sys
from pathlib import Path

import grpc
from grpc import aio as grpc_aio
from hquant_logger import create_logger

# ---------------------------------------------------------------------------
# Import generated gRPC stubs -- same sys.path setup as subscription_service.
# ---------------------------------------------------------------------------
_proto_dist = str(
    Path(__file__).resolve().parents[4] / "packages" / "contracts" / "dist"
)
if _proto_dist not in sys.path:
    sys.path.insert(0, _proto_dist)

from python import strategy_subscription_pb2_grpc as pb2_grpc  # noqa: E402

from app.core.strategy_manager import StrategyManager
from app.grpc.subscription_service import SubscriptionServiceImpl

logger = create_logger("strategy-engine").child("grpc.server")


class GrpcServer:
    """Async gRPC server that hosts the SubscriptionService.

    Usage::

        server = GrpcServer(port=50052, manager=manager, candle_subject_prefix="exchange")
        await server.start()
        # ... application runs ...
        await server.stop()
    """

    def __init__(
        self,
        *,
        port: int,
        manager: StrategyManager,
        candle_subject_prefix: str,
    ) -> None:
        self._port = port
        self._manager = manager
        self._candle_subject_prefix = candle_subject_prefix
        self._server: grpc_aio.Server | None = None

    async def start(self) -> None:
        """Create and start the gRPC server on the configured port."""
        self._server = grpc_aio.server()

        servicer = SubscriptionServiceImpl(
            manager=self._manager,
            candle_subject_prefix=self._candle_subject_prefix,
        )
        pb2_grpc.add_SubscriptionServiceServicer_to_server(servicer, self._server)

        listen_addr = f"[::]:{self._port}"
        self._server.add_insecure_port(listen_addr)
        await self._server.start()

        logger.info("gRPC server started", addr=listen_addr)

    async def stop(self, grace: float = 5.0) -> None:
        """Gracefully stop the gRPC server.

        Args:
            grace: Seconds to wait for in-flight RPCs to complete before
                   forceful termination.
        """
        if self._server is None:
            return

        logger.info("gRPC server stopping", grace_seconds=grace)
        await self._server.stop(grace)
        self._server = None
        logger.info("gRPC server stopped")
