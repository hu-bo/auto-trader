from __future__ import annotations

import sys
from pathlib import Path

import grpc
from grpc import aio as grpc_aio
from hquant_logger import create_logger

# ---------------------------------------------------------------------------
# Import generated gRPC stubs -- same sys.path setup as subscription_service.
# ---------------------------------------------------------------------------
# Try Docker path first, fallback to local dev path
_proto_root = Path("/app/proto")
if not _proto_root.exists():
    _proto_root = Path(__file__).resolve().parents[4] / "packages" / "contracts" / "output"

if _proto_root.exists():
    _proto_root_str = str(_proto_root)
    if _proto_root_str not in sys.path:
        sys.path.insert(0, _proto_root_str)

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
        tls_enabled: bool = False,
        cert_file: str = "",
        key_file: str = "",
        ca_file: str = "",
    ) -> None:
        self._port = port
        self._manager = manager
        self._candle_subject_prefix = candle_subject_prefix
        self._tls_enabled = tls_enabled
        self._cert_file = cert_file
        self._key_file = key_file
        self._ca_file = ca_file
        self._server: grpc_aio.Server | None = None

    def _load_server_credentials(self) -> grpc.ServerCredentials:
        cert_path = Path(self._cert_file).expanduser()
        key_path = Path(self._key_file).expanduser()

        if not self._cert_file.strip():
            raise ValueError("GRPC_TLS_CERT_FILE is required when GRPC_TLS_ENABLED=true")
        if not self._key_file.strip():
            raise ValueError("GRPC_TLS_KEY_FILE is required when GRPC_TLS_ENABLED=true")

        try:
            certificate_chain = cert_path.read_bytes()
        except OSError as exc:
            raise ValueError(f"failed to read GRPC_TLS_CERT_FILE: {cert_path}") from exc

        try:
            private_key = key_path.read_bytes()
        except OSError as exc:
            raise ValueError(f"failed to read GRPC_TLS_KEY_FILE: {key_path}") from exc

        root_certificates: bytes | None = None
        require_client_auth = False
        if self._ca_file.strip():
            ca_path = Path(self._ca_file).expanduser()
            try:
                root_certificates = ca_path.read_bytes()
            except OSError as exc:
                raise ValueError(f"failed to read GRPC_TLS_CA_FILE: {ca_path}") from exc
            require_client_auth = True

        return grpc.ssl_server_credentials(
            [(private_key, certificate_chain)],
            root_certificates=root_certificates,
            require_client_auth=require_client_auth,
        )

    async def start(self) -> None:
        """Create and start the gRPC server on the configured port."""
        self._server = grpc_aio.server()

        servicer = SubscriptionServiceImpl(
            manager=self._manager,
            candle_subject_prefix=self._candle_subject_prefix,
        )
        pb2_grpc.add_SubscriptionServiceServicer_to_server(servicer, self._server)

        listen_addr = f"[::]:{self._port}"
        if self._tls_enabled:
            self._server.add_secure_port(listen_addr, self._load_server_credentials())
        else:
            self._server.add_insecure_port(listen_addr)
        await self._server.start()

        logger.info(
            "gRPC server started",
            addr=listen_addr,
            tls=self._tls_enabled,
            mutual_tls=bool(self._ca_file.strip()),
        )

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
