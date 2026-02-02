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
from app.schemas import ApiResponse, SetLeverageIn
from app.services import ExchangeService

router = APIRouter()


def _raise_grpc_http_error(exc: Exception) -> None:
    if isinstance(exc, (GrpcDependencyMissingError, GrpcProtoNotGeneratedError)):
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc)) from exc
    if isinstance(exc, GrpcRequestError):
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(exc)) from exc
    raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.get("/balance", response_model=ApiResponse[dict])
async def get_balance(
    exchange_id: str,
    trade_type: str,
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
        resp = await grpc_client.get_balance(token=token, trade_type=trade_type)
    except Exception as exc:  # noqa: BLE001
        _raise_grpc_http_error(exc)

    return ApiResponse.success(data=protobuf_to_dict(resp))


@router.post("/leverage", response_model=ApiResponse[dict])
async def set_leverage(
    payload: SetLeverageIn,
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
        resp = await grpc_client.set_leverage(
            token=token,
            symbol=payload.symbol,
            leverage=payload.leverage,
            trade_type=payload.trade_type,
            position_side=payload.position_side,
        )
    except Exception as exc:  # noqa: BLE001
        _raise_grpc_http_error(exc)

    return ApiResponse.success(data=protobuf_to_dict(resp))
