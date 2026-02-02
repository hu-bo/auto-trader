from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import (
    CurrentUser,
    get_current_user,
    get_db_session,
    get_exchange_grpc_client,
    get_exchange_service,
)
from app.grpc.errors import (
    GrpcDependencyMissingError,
    GrpcProtoNotGeneratedError,
    GrpcRequestError,
)
from app.grpc.exchange_client import ExchangeGrpcClient
from app.grpc.utils import protobuf_to_dict
from app.schemas import ApiResponse, ClosePositionIn
from app.services import ExchangeService

router = APIRouter()


def _raise_grpc_http_error(exc: Exception) -> None:
    if isinstance(exc, (GrpcDependencyMissingError, GrpcProtoNotGeneratedError)):
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc)) from exc
    if isinstance(exc, GrpcRequestError):
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(exc)) from exc
    raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.get("", response_model=ApiResponse[dict])
async def list_positions(
    exchange_id: str,
    symbol: str | None = None,
    current_user: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
    exchange_service: ExchangeService = Depends(get_exchange_service),
    grpc_client: ExchangeGrpcClient = Depends(get_exchange_grpc_client),
) -> ApiResponse[dict]:
    try:
        token = await exchange_service.get_grpc_token(
            session, user_id=current_user.user_id, exchange_id=exchange_id
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    try:
        resp = await grpc_client.get_positions(token=token, symbol=symbol)
    except Exception as exc:  # noqa: BLE001
        _raise_grpc_http_error(exc)

    return ApiResponse.success(data=protobuf_to_dict(resp))


@router.post("/sync", response_model=ApiResponse[dict])
async def sync_positions(
    exchange_id: str,
    current_user: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
    exchange_service: ExchangeService = Depends(get_exchange_service),
    grpc_client: ExchangeGrpcClient = Depends(get_exchange_grpc_client),
) -> ApiResponse[dict]:
    try:
        token = await exchange_service.get_grpc_token(
            session, user_id=current_user.user_id, exchange_id=exchange_id
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    try:
        resp = await grpc_client.sync_positions(token=token)
    except Exception as exc:  # noqa: BLE001
        _raise_grpc_http_error(exc)

    return ApiResponse.success(data=protobuf_to_dict(resp))


@router.post("/{position_id}/close", response_model=ApiResponse[dict])
async def close_position(
    position_id: str,
    payload: ClosePositionIn,
    current_user: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
    exchange_service: ExchangeService = Depends(get_exchange_service),
    grpc_client: ExchangeGrpcClient = Depends(get_exchange_grpc_client),
) -> ApiResponse[dict]:
    try:
        token = await exchange_service.get_grpc_token(
            session, user_id=current_user.user_id, exchange_id=payload.exchange_id
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    try:
        positions_resp = await grpc_client.get_positions(token=token)
    except Exception as exc:  # noqa: BLE001
        _raise_grpc_http_error(exc)

    position = None
    for pos in getattr(positions_resp, "positions", []):
        if getattr(pos, "id", None) == position_id:
            position = pos
            break

    if not position:
        raise HTTPException(status_code=404, detail="Position not found")

    try:
        exchange_pb2 = grpc_client.pb2

        trade_type_name = exchange_pb2.TradeType.Name(position.trade_type)
        trade_type = trade_type_name.replace("TRADE_TYPE_", "")

        position_side_name = exchange_pb2.PositionSide.Name(position.position_side)
        position_side = position_side_name.replace("POSITION_SIDE_", "")

        side = "SELL" if position_side == "LONG" else "BUY"
        quantity = abs(float(position.position_amt or "0"))
        if quantity <= 0:
            raise HTTPException(status_code=400, detail="Position quantity is 0")

        resp = await grpc_client.place_order(
            token=token,
            symbol=position.symbol,
            trade_type=trade_type,
            side=side,
            order_type=payload.order_type,
            quantity=quantity,
            price=payload.price,
            position_side=position_side if trade_type != "SPOT" else None,
            client_order_id=payload.client_order_id,
            reduce_only=True,
        )
    except HTTPException:
        raise
    except Exception as exc:  # noqa: BLE001
        _raise_grpc_http_error(exc)

    return ApiResponse.success(data=protobuf_to_dict(resp))
