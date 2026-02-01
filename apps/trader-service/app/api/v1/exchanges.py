from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import (
    CurrentUser,
    get_current_user,
    get_db_session,
    get_exchange_grpc_client,
    get_exchange_service,
    get_user_service,
)
from app.grpc.errors import (
    GrpcDependencyMissingError,
    GrpcProtoNotGeneratedError,
    GrpcRequestError,
)
from app.grpc.exchange_client import ExchangeGrpcClient
from app.grpc.utils import protobuf_to_dict
from app.schemas import ExchangeCreate, ExchangeRead, ExchangeUpdate
from app.services import ExchangeService, UserService

router = APIRouter()


def _raise_grpc_http_error(exc: Exception) -> None:
    if isinstance(exc, (GrpcDependencyMissingError, GrpcProtoNotGeneratedError)):
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc)) from exc
    if isinstance(exc, GrpcRequestError):
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(exc)) from exc
    raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.get("", response_model=list[ExchangeRead])
async def list_exchanges(
    current_user: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
    user_service: UserService = Depends(get_user_service),
    exchange_service: ExchangeService = Depends(get_exchange_service),
) -> list[ExchangeRead]:
    await user_service.get_or_create(
        session, user_id=current_user.user_id, username=current_user.username
    )
    exchanges = await exchange_service.list_for_user(session, user_id=current_user.user_id)
    return [ExchangeRead.model_validate(x) for x in exchanges]


@router.post("", response_model=ExchangeRead)
async def create_exchange(
    payload: ExchangeCreate,
    current_user: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
    user_service: UserService = Depends(get_user_service),
    exchange_service: ExchangeService = Depends(get_exchange_service),
    grpc_client: ExchangeGrpcClient = Depends(get_exchange_grpc_client),
) -> ExchangeRead:
    await user_service.get_or_create(
        session, user_id=current_user.user_id, username=current_user.username
    )
    try:
        exchange = await exchange_service.create(
            session,
            user_id=current_user.user_id,
            exchange_type=payload.exchange_type,
            name=payload.name,
            api_key=payload.api_key,
            api_secret=payload.api_secret,
            passphrase=payload.passphrase,
            is_testnet=payload.is_testnet,
            is_active=payload.is_active,
        )
    except ValueError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc

    try:
        init_resp = await grpc_client.init_account(
            exchange_type=exchange.exchange_type,
            api_key=payload.api_key,
            api_secret=payload.api_secret,
            passphrase=payload.passphrase,
            demonet=payload.is_testnet,
            name=exchange.name,
        )
        if getattr(init_resp, "success", False) and getattr(init_resp, "token", ""):
            await exchange_service.set_grpc_token(
                session, user_id=current_user.user_id, exchange_id=exchange.id, token=init_resp.token
            )
            await session.refresh(exchange)
    except (GrpcDependencyMissingError, GrpcProtoNotGeneratedError):
        pass
    except Exception:
        pass

    return ExchangeRead.model_validate(exchange)


@router.put("/{exchange_id}", response_model=ExchangeRead)
async def update_exchange(
    exchange_id: str,
    payload: ExchangeUpdate,
    current_user: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
    exchange_service: ExchangeService = Depends(get_exchange_service),
) -> ExchangeRead:
    try:
        exchange = await exchange_service.update(
            session,
            user_id=current_user.user_id,
            exchange_id=exchange_id,
            name=payload.name,
            api_key=payload.api_key,
            api_secret=payload.api_secret,
            passphrase=payload.passphrase,
            is_testnet=payload.is_testnet,
            is_active=payload.is_active,
        )
    except ValueError as exc:
        message = str(exc)
        if "not found" in message.lower():
            raise HTTPException(status_code=404, detail=message) from exc
        raise HTTPException(status_code=500, detail=message) from exc

    return ExchangeRead.model_validate(exchange)


@router.delete("/{exchange_id}")
async def delete_exchange(
    exchange_id: str,
    current_user: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
    exchange_service: ExchangeService = Depends(get_exchange_service),
    grpc_client: ExchangeGrpcClient = Depends(get_exchange_grpc_client),
) -> dict:
    try:
        try:
            token = await exchange_service.get_grpc_token(
                session, user_id=current_user.user_id, exchange_id=exchange_id
            )
            await grpc_client.invalidate_token(token=token)
        except Exception:
            pass

        await exchange_service.delete(session, user_id=current_user.user_id, exchange_id=exchange_id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return {"status": "ok"}


@router.post("/{exchange_id}/test")
async def test_exchange(
    exchange_id: str,
    current_user: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
    exchange_service: ExchangeService = Depends(get_exchange_service),
    grpc_client: ExchangeGrpcClient = Depends(get_exchange_grpc_client),
) -> dict:
    did_init = False

    try:
        exchange = await exchange_service.get(session, user_id=current_user.user_id, exchange_id=exchange_id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc

    try:
        token = await exchange_service.get_grpc_token(
            session, user_id=current_user.user_id, exchange_id=exchange_id
        )
        validate_resp = await grpc_client.validate_token(token=token)
        if getattr(validate_resp, "valid", False):
            result = protobuf_to_dict(validate_resp)
            result["initialized"] = False
            return result
    except ValueError:
        token = None
    except Exception as exc:  # noqa: BLE001
        _raise_grpc_http_error(exc)

    try:
        api_key, api_secret, passphrase = await exchange_service.get_api_credentials(
            session, user_id=current_user.user_id, exchange_id=exchange_id
        )
        init_resp = await grpc_client.init_account(
            exchange_type=exchange.exchange_type,
            api_key=api_key,
            api_secret=api_secret,
            passphrase=passphrase,
            demonet=exchange.is_testnet,
            name=exchange.name,
        )
        if not getattr(init_resp, "success", False) or not getattr(init_resp, "token", ""):
            error = getattr(init_resp, "error", None)
            error_msg = getattr(error, "message", None) or "InitAccount failed"
            raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=error_msg)

        await exchange_service.set_grpc_token(
            session, user_id=current_user.user_id, exchange_id=exchange_id, token=init_resp.token
        )
        did_init = True

        validate_resp = await grpc_client.validate_token(token=init_resp.token)
        result = protobuf_to_dict(validate_resp)
        result["initialized"] = did_init
        return result
    except HTTPException:
        raise
    except Exception as exc:  # noqa: BLE001
        _raise_grpc_http_error(exc)
