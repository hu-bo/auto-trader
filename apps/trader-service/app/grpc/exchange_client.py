from __future__ import annotations

from dataclasses import dataclass
import importlib
from pathlib import Path
import sys
from typing import Any

from app.grpc.errors import (
    GrpcDependencyMissingError,
    GrpcProtoNotGeneratedError,
    GrpcRequestError,
)
from app.grpc.utils import maybe_await


@dataclass(frozen=True)
class GrpcCallOptions:
    timeout_s: float | None = 10.0


class ExchangeGrpcClient:
    def __init__(self, target: str):
        self._target = target
        self._channel: Any | None = None
        self._stub: Any | None = None
        self._pb2: Any | None = None
        self._pb2_grpc: Any | None = None

    @property
    def target(self) -> str:
        return self._target

    @property
    def pb2(self) -> Any:
        _, exchange_pb2 = self._ensure_proto()
        return exchange_pb2

    def _ensure_stub(self) -> Any:
        if self._stub is not None:
            return self._stub

        try:
            import grpc  # type: ignore
        except ModuleNotFoundError as exc:
            raise GrpcDependencyMissingError(
                "grpcio is not installed; run `poetry install` first"
            ) from exc

        generated_dir = Path(__file__).resolve().parent / "generated"
        pb2_path = generated_dir / "exchange_pb2.py"
        pb2_grpc_path = generated_dir / "exchange_pb2_grpc.py"
        if not pb2_path.exists() or not pb2_grpc_path.exists():
            raise GrpcProtoNotGeneratedError(
                "gRPC proto code is missing; run `bash scripts/generate_proto.sh`"
            )

        generated_path = str(generated_dir)
        if generated_path not in sys.path:
            sys.path.insert(0, generated_path)

        self._pb2 = importlib.import_module("exchange_pb2")
        self._pb2_grpc = importlib.import_module("exchange_pb2_grpc")

        self._channel = grpc.aio.insecure_channel(
            self._target,
            options=[
                ("grpc.max_send_message_length", 100 * 1024 * 1024),
                ("grpc.max_receive_message_length", 100 * 1024 * 1024),
            ],
        )
        self._stub = self._pb2_grpc.ExchangeServiceStub(self._channel)
        return self._stub

    def _ensure_proto(self) -> tuple[Any, Any]:
        stub = self._ensure_stub()
        if self._pb2 is None:
            raise GrpcProtoNotGeneratedError(
                "gRPC proto code is missing; run `bash scripts/generate_proto.sh`"
            )
        return stub, self._pb2

    @staticmethod
    def _map_exchange(exchange_type: str, exchange_pb2: Any) -> int:
        value = exchange_type.strip().upper()
        mapping = {
            "OKX": exchange_pb2.EXCHANGE_OKX,
            "BINANCE": exchange_pb2.EXCHANGE_BINANCE,
        }
        if value not in mapping:
            raise ValueError(f"Unsupported exchange_type: {exchange_type}")
        return mapping[value]

    @staticmethod
    def _map_trade_type(trade_type: str, exchange_pb2: Any) -> int:
        value = trade_type.strip().upper()
        mapping = {
            "SPOT": exchange_pb2.TRADE_TYPE_SPOT,
            "FUTURES": exchange_pb2.TRADE_TYPE_FUTURES,
            "DELIVERY": exchange_pb2.TRADE_TYPE_DELIVERY,
        }
        if value not in mapping:
            raise ValueError(f"Unsupported trade_type: {trade_type}")
        return mapping[value]

    @staticmethod
    def _map_order_side(side: str, exchange_pb2: Any) -> int:
        value = side.strip().upper()
        mapping = {
            "BUY": exchange_pb2.ORDER_SIDE_BUY,
            "SELL": exchange_pb2.ORDER_SIDE_SELL,
        }
        if value not in mapping:
            raise ValueError(f"Unsupported side: {side}")
        return mapping[value]

    @staticmethod
    def _map_position_side(position_side: str, exchange_pb2: Any) -> int:
        value = position_side.strip().upper()
        mapping = {
            "LONG": exchange_pb2.POSITION_SIDE_LONG,
            "SHORT": exchange_pb2.POSITION_SIDE_SHORT,
        }
        if value not in mapping:
            raise ValueError(f"Unsupported position_side: {position_side}")
        return mapping[value]

    @staticmethod
    def _map_order_type(order_type: str, exchange_pb2: Any) -> int:
        value = order_type.strip().upper()
        mapping = {
            "LIMIT": exchange_pb2.ORDER_TYPE_LIMIT,
            "MARKET": exchange_pb2.ORDER_TYPE_MARKET,
            "MAKER_ONLY": exchange_pb2.ORDER_TYPE_MAKER_ONLY,
        }
        if value not in mapping:
            raise ValueError(f"Unsupported order_type: {order_type}")
        return mapping[value]

    @staticmethod
    def _map_order_status(order_status: str, exchange_pb2: Any) -> int:
        value = order_status.strip().upper()
        mapping = {
            "PENDING": exchange_pb2.ORDER_STATUS_PENDING,
            "OPEN": exchange_pb2.ORDER_STATUS_OPEN,
            "PARTIAL": exchange_pb2.ORDER_STATUS_PARTIAL,
            "FILLED": exchange_pb2.ORDER_STATUS_FILLED,
            "CANCELED": exchange_pb2.ORDER_STATUS_CANCELED,
            "REJECTED": exchange_pb2.ORDER_STATUS_REJECTED,
            "EXPIRED": exchange_pb2.ORDER_STATUS_EXPIRED,
        }
        if value not in mapping:
            raise ValueError(f"Unsupported order_status: {order_status}")
        return mapping[value]

    async def close(self) -> None:
        if not self._channel:
            return
        await maybe_await(self._channel.close())
        self._channel = None
        self._stub = None
        self._pb2 = None
        self._pb2_grpc = None

    async def init_account(
        self,
        *,
        exchange_type: str,
        api_key: str,
        api_secret: str,
        passphrase: str | None,
        demonet: bool,
        name: str | None = None,
        options: GrpcCallOptions | None = None,
    ) -> Any:
        stub, exchange_pb2 = self._ensure_proto()

        kwargs: dict[str, Any] = {
            "exchange": self._map_exchange(exchange_type, exchange_pb2),
            "api_key": api_key,
            "api_secret": api_secret,
            "demonet": demonet,
        }
        if passphrase:
            kwargs["passphrase"] = passphrase
        if name:
            kwargs["name"] = name

        req = exchange_pb2.InitAccountRequest(**kwargs)
        try:
            return await stub.InitAccount(req, timeout=(options or GrpcCallOptions()).timeout_s)
        except Exception as exc:  # noqa: BLE001
            raise GrpcRequestError(str(exc)) from exc

    async def validate_token(
        self,
        *,
        token: str,
        options: GrpcCallOptions | None = None,
    ) -> Any:
        stub, exchange_pb2 = self._ensure_proto()

        try:
            return await stub.ValidateToken(
                exchange_pb2.ValidateTokenRequest(token=token),
                timeout=(options or GrpcCallOptions()).timeout_s,
            )
        except Exception as exc:  # noqa: BLE001
            raise GrpcRequestError(str(exc)) from exc

    async def invalidate_token(
        self,
        *,
        token: str,
        options: GrpcCallOptions | None = None,
    ) -> Any:
        stub, exchange_pb2 = self._ensure_proto()

        try:
            return await stub.InvalidateToken(
                exchange_pb2.InvalidateTokenRequest(token=token),
                timeout=(options or GrpcCallOptions()).timeout_s,
            )
        except Exception as exc:  # noqa: BLE001
            raise GrpcRequestError(str(exc)) from exc

    async def place_order(
        self,
        *,
        token: str,
        symbol: str,
        trade_type: str,
        side: str,
        order_type: str,
        quantity: float,
        price: float | None = None,
        position_side: str | None = None,
        leverage: int | None = None,
        client_order_id: str | None = None,
        reduce_only: bool | None = None,
        options: GrpcCallOptions | None = None,
    ) -> Any:
        stub, exchange_pb2 = self._ensure_proto()

        kwargs: dict[str, Any] = {
            "token": token,
            "symbol": symbol,
            "trade_type": self._map_trade_type(trade_type, exchange_pb2),
            "side": self._map_order_side(side, exchange_pb2),
            "order_type": self._map_order_type(order_type, exchange_pb2),
            "quantity": quantity,
        }
        if price is not None:
            kwargs["price"] = price
        if position_side is not None:
            kwargs["position_side"] = self._map_position_side(position_side, exchange_pb2)
        if leverage is not None:
            kwargs["leverage"] = leverage
        if client_order_id is not None:
            kwargs["client_order_id"] = client_order_id
        if reduce_only is not None:
            kwargs["reduce_only"] = reduce_only

        try:
            return await stub.PlaceOrder(
                exchange_pb2.PlaceOrderRequest(**kwargs),
                timeout=(options or GrpcCallOptions()).timeout_s,
            )
        except Exception as exc:  # noqa: BLE001
            raise GrpcRequestError(str(exc)) from exc

    async def cancel_order(
        self,
        *,
        token: str,
        order_id: str,
        options: GrpcCallOptions | None = None,
    ) -> Any:
        stub, exchange_pb2 = self._ensure_proto()

        try:
            return await stub.CancelOrder(
                exchange_pb2.CancelOrderRequest(token=token, order_id=order_id),
                timeout=(options or GrpcCallOptions()).timeout_s,
            )
        except Exception as exc:  # noqa: BLE001
            raise GrpcRequestError(str(exc)) from exc

    async def get_order(
        self,
        *,
        token: str,
        order_id: str,
        options: GrpcCallOptions | None = None,
    ) -> Any:
        stub, exchange_pb2 = self._ensure_proto()

        try:
            return await stub.GetOrder(
                exchange_pb2.GetOrderRequest(token=token, order_id=order_id),
                timeout=(options or GrpcCallOptions()).timeout_s,
            )
        except Exception as exc:  # noqa: BLE001
            raise GrpcRequestError(str(exc)) from exc

    async def get_orders(
        self,
        *,
        token: str,
        symbol: str | None = None,
        status: str | None = None,
        limit: int | None = None,
        offset: int | None = None,
        options: GrpcCallOptions | None = None,
    ) -> Any:
        stub, exchange_pb2 = self._ensure_proto()

        kwargs: dict[str, Any] = {"token": token}
        if symbol is not None:
            kwargs["symbol"] = symbol
        if status is not None:
            kwargs["status"] = self._map_order_status(status, exchange_pb2)
        if limit is not None:
            kwargs["limit"] = limit
        if offset is not None:
            kwargs["offset"] = offset

        try:
            return await stub.GetOrders(
                exchange_pb2.GetOrdersRequest(**kwargs),
                timeout=(options or GrpcCallOptions()).timeout_s,
            )
        except Exception as exc:  # noqa: BLE001
            raise GrpcRequestError(str(exc)) from exc

    async def get_positions(
        self,
        *,
        token: str,
        symbol: str | None = None,
        options: GrpcCallOptions | None = None,
    ) -> Any:
        stub, exchange_pb2 = self._ensure_proto()

        kwargs: dict[str, Any] = {"token": token}
        if symbol is not None:
            kwargs["symbol"] = symbol

        try:
            return await stub.GetPositions(
                exchange_pb2.GetPositionsRequest(**kwargs),
                timeout=(options or GrpcCallOptions()).timeout_s,
            )
        except Exception as exc:  # noqa: BLE001
            raise GrpcRequestError(str(exc)) from exc

    async def sync_positions(
        self,
        *,
        token: str,
        options: GrpcCallOptions | None = None,
    ) -> Any:
        stub, exchange_pb2 = self._ensure_proto()

        try:
            return await stub.SyncPositions(
                exchange_pb2.SyncPositionsRequest(token=token),
                timeout=(options or GrpcCallOptions()).timeout_s,
            )
        except Exception as exc:  # noqa: BLE001
            raise GrpcRequestError(str(exc)) from exc

    async def get_balance(
        self,
        *,
        token: str,
        trade_type: str,
        options: GrpcCallOptions | None = None,
    ) -> Any:
        stub, exchange_pb2 = self._ensure_proto()

        try:
            return await stub.GetBalance(
                exchange_pb2.GetBalanceRequest(
                    token=token,
                    trade_type=self._map_trade_type(trade_type, exchange_pb2),
                ),
                timeout=(options or GrpcCallOptions()).timeout_s,
            )
        except Exception as exc:  # noqa: BLE001
            raise GrpcRequestError(str(exc)) from exc

    async def set_leverage(
        self,
        *,
        token: str,
        symbol: str,
        leverage: int,
        trade_type: str,
        position_side: str | None = None,
        options: GrpcCallOptions | None = None,
    ) -> Any:
        stub, exchange_pb2 = self._ensure_proto()

        kwargs: dict[str, Any] = {
            "token": token,
            "symbol": symbol,
            "leverage": leverage,
            "trade_type": self._map_trade_type(trade_type, exchange_pb2),
        }
        if position_side is not None:
            kwargs["position_side"] = self._map_position_side(position_side, exchange_pb2)

        try:
            return await stub.SetLeverage(
                exchange_pb2.SetLeverageRequest(**kwargs),
                timeout=(options or GrpcCallOptions()).timeout_s,
            )
        except Exception as exc:  # noqa: BLE001
            raise GrpcRequestError(str(exc)) from exc

    async def get_price(
        self,
        *,
        token: str,
        symbol: str,
        trade_type: str,
        options: GrpcCallOptions | None = None,
    ) -> Any:
        stub, exchange_pb2 = self._ensure_proto()

        try:
            return await stub.GetPrice(
                exchange_pb2.GetPriceRequest(
                    token=token,
                    symbol=symbol,
                    trade_type=self._map_trade_type(trade_type, exchange_pb2),
                ),
                timeout=(options or GrpcCallOptions()).timeout_s,
            )
        except Exception as exc:  # noqa: BLE001
            raise GrpcRequestError(str(exc)) from exc
