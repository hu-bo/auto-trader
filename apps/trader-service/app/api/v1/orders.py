from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status as http_status
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
from app.schemas import ApiResponse, PlaceOrderIn
from app.services import ExchangeService

router = APIRouter()

def _raise_grpc_http_error(exc: Exception) -> None:
    if isinstance(exc, (GrpcDependencyMissingError, GrpcProtoNotGeneratedError)):
        raise HTTPException(
            status_code=http_status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc)
        ) from exc
    if isinstance(exc, GrpcRequestError):
        raise HTTPException(status_code=http_status.HTTP_502_BAD_GATEWAY, detail=str(exc)) from exc
    raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.get("", response_model=ApiResponse[dict])
async def list_orders(
    exchange_id: str,
    symbol: str | None = None,
    status: str | None = None,
    limit: int | None = None,
    offset: int | None = None,
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
        resp = await grpc_client.get_orders(
            token=token,
            symbol=symbol,
            status=status,
            limit=limit,
            offset=offset,
        )
    except Exception as exc:  # noqa: BLE001
        _raise_grpc_http_error(exc)

    return ApiResponse.success(data=protobuf_to_dict(resp))


@router.post("", response_model=ApiResponse[dict])
async def place_order(
    payload: PlaceOrderIn,
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
        resp = await grpc_client.place_order(
            token=token,
            symbol=payload.symbol,
            trade_type=payload.trade_type,
            side=payload.side,
            order_type=payload.order_type,
            quantity=payload.quantity,
            price=payload.price,
            position_side=payload.position_side,
            leverage=payload.leverage,
            client_order_id=payload.client_order_id,
            reduce_only=payload.reduce_only,
        )
    except Exception as exc:  # noqa: BLE001
        _raise_grpc_http_error(exc)

    return ApiResponse.success(data=protobuf_to_dict(resp))


@router.get("/{order_id}", response_model=ApiResponse[dict])
async def get_order(
    order_id: str,
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
        resp = await grpc_client.get_order(token=token, order_id=order_id)
    except Exception as exc:  # noqa: BLE001
        _raise_grpc_http_error(exc)

    return ApiResponse.success(data=protobuf_to_dict(resp))


@router.post("/{order_id}/cancel", response_model=ApiResponse[dict])
async def cancel_order(
    order_id: str,
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
        resp = await grpc_client.cancel_order(token=token, order_id=order_id)
    except Exception as exc:  # noqa: BLE001
        _raise_grpc_http_error(exc)

    return ApiResponse.success(data=protobuf_to_dict(resp))
