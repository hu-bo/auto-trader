from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import Strategy, UserExchange
from app.dependencies import (
    CurrentUser,
    get_current_user,
    get_db_session,
    get_strategy_order_service,
    get_user_service,
)
from app.schemas import StrategyOrderCreate, StrategyOrderRead, StrategyOrderUpdate
from app.services import StrategyOrderService, UserService

router = APIRouter()


@router.get("", response_model=list[StrategyOrderRead])
async def list_strategy_orders(
    current_user: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
    user_service: UserService = Depends(get_user_service),
    strategy_order_service: StrategyOrderService = Depends(get_strategy_order_service),
) -> list[StrategyOrderRead]:
    await user_service.get_or_create(
        session, user_id=current_user.user_id, username=current_user.username
    )
    orders = await strategy_order_service.list_for_user(session, user_id=current_user.user_id)
    return [StrategyOrderRead.model_validate(x) for x in orders]


@router.post("", response_model=StrategyOrderRead)
async def create_strategy_order(
    payload: StrategyOrderCreate,
    current_user: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
    user_service: UserService = Depends(get_user_service),
    strategy_order_service: StrategyOrderService = Depends(get_strategy_order_service),
) -> StrategyOrderRead:
    await user_service.get_or_create(
        session, user_id=current_user.user_id, username=current_user.username
    )

    strategy = await session.get(Strategy, payload.strategy_id)
    if not strategy or (strategy.user_id != current_user.user_id and not strategy.is_public):
        raise HTTPException(status_code=404, detail="Strategy not found")

    exchange = await session.get(UserExchange, payload.exchange_id)
    if not exchange or exchange.user_id != current_user.user_id:
        raise HTTPException(status_code=404, detail="Exchange not found")

    order = await strategy_order_service.create(
        session,
        user_id=current_user.user_id,
        strategy_id=payload.strategy_id,
        exchange_id=payload.exchange_id,
        symbols=payload.symbols,
        parameters=payload.parameters,
        risk_config=payload.risk_config,
        live=payload.live,
    )
    return StrategyOrderRead.model_validate(order)


@router.get("/{order_id}", response_model=StrategyOrderRead)
async def get_strategy_order(
    order_id: str,
    current_user: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
    strategy_order_service: StrategyOrderService = Depends(get_strategy_order_service),
) -> StrategyOrderRead:
    try:
        order = await strategy_order_service.get(session, user_id=current_user.user_id, order_id=order_id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return StrategyOrderRead.model_validate(order)


@router.put("/{order_id}", response_model=StrategyOrderRead)
async def update_strategy_order(
    order_id: str,
    payload: StrategyOrderUpdate,
    current_user: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
    strategy_order_service: StrategyOrderService = Depends(get_strategy_order_service),
) -> StrategyOrderRead:
    try:
        order = await strategy_order_service.update(
            session,
            user_id=current_user.user_id,
            order_id=order_id,
            symbols=payload.symbols,
            parameters=payload.parameters,
            risk_config=payload.risk_config,
            live=payload.live,
        )
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return StrategyOrderRead.model_validate(order)


@router.delete("/{order_id}")
async def delete_strategy_order(
    order_id: str,
    current_user: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
    strategy_order_service: StrategyOrderService = Depends(get_strategy_order_service),
) -> dict:
    try:
        await strategy_order_service.delete(session, user_id=current_user.user_id, order_id=order_id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return {"status": "ok"}


@router.post("/{order_id}/start", response_model=StrategyOrderRead)
async def start_strategy_order(
    order_id: str,
    current_user: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
    strategy_order_service: StrategyOrderService = Depends(get_strategy_order_service),
) -> StrategyOrderRead:
    try:
        order = await strategy_order_service.start(session, user_id=current_user.user_id, order_id=order_id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return StrategyOrderRead.model_validate(order)


@router.post("/{order_id}/stop", response_model=StrategyOrderRead)
async def stop_strategy_order(
    order_id: str,
    current_user: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
    strategy_order_service: StrategyOrderService = Depends(get_strategy_order_service),
) -> StrategyOrderRead:
    try:
        order = await strategy_order_service.stop(session, user_id=current_user.user_id, order_id=order_id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return StrategyOrderRead.model_validate(order)


@router.get("/{order_id}/stats")
async def strategy_order_stats(order_id: str) -> dict:
    return {"id": order_id, "stats": {}}
