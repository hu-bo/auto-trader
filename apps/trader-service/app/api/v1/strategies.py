from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import (
    CurrentUser,
    get_current_user,
    get_db_session,
    get_strategy_service,
    get_user_service,
)
from app.schemas import StrategyCreate, StrategyRead, StrategyUpdate
from app.services import StrategyService, UserService

router = APIRouter()


@router.get("", response_model=list[StrategyRead])
async def list_strategies(
    current_user: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
    user_service: UserService = Depends(get_user_service),
    strategy_service: StrategyService = Depends(get_strategy_service),
) -> list[StrategyRead]:
    await user_service.get_or_create(
        session, user_id=current_user.user_id, username=current_user.username
    )
    strategies = await strategy_service.list_for_user(session, user_id=current_user.user_id)
    return [StrategyRead.model_validate(x) for x in strategies]


@router.get("/available", response_model=list[StrategyRead])
async def available_strategies(
    current_user: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
    user_service: UserService = Depends(get_user_service),
    strategy_service: StrategyService = Depends(get_strategy_service),
) -> list[StrategyRead]:
    await user_service.get_or_create(
        session, user_id=current_user.user_id, username=current_user.username
    )
    strategies = await strategy_service.list_available(session, user_id=current_user.user_id)
    return [StrategyRead.model_validate(x) for x in strategies]


@router.post("", response_model=StrategyRead)
async def create_strategy(
    payload: StrategyCreate,
    current_user: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
    user_service: UserService = Depends(get_user_service),
    strategy_service: StrategyService = Depends(get_strategy_service),
) -> StrategyRead:
    await user_service.get_or_create(
        session, user_id=current_user.user_id, username=current_user.username
    )
    strategy = await strategy_service.create(
        session,
        user_id=current_user.user_id,
        name=payload.name,
        description=payload.description,
        tag=str(payload.tag),
        code=payload.code,
        params=payload.params,
        version=payload.version,
        status=payload.status,
        is_public=True,  # README: 所有人创建的都是公共策略
    )
    return StrategyRead.model_validate(strategy)


@router.get("/{strategy_id}", response_model=StrategyRead)
async def get_strategy(
    strategy_id: str,
    current_user: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
    strategy_service: StrategyService = Depends(get_strategy_service),
) -> StrategyRead:
    try:
        strategy = await strategy_service.get(
            session, user_id=current_user.user_id, strategy_id=strategy_id
        )
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return StrategyRead.model_validate(strategy)


@router.put("/{strategy_id}", response_model=StrategyRead)
async def update_strategy(
    strategy_id: str,
    payload: StrategyUpdate,
    current_user: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
    strategy_service: StrategyService = Depends(get_strategy_service),
) -> StrategyRead:
    try:
        strategy = await strategy_service.update(
            session,
            user_id=current_user.user_id,
            strategy_id=strategy_id,
            name=payload.name,
            description=payload.description,
            tag=str(payload.tag) if payload.tag is not None else None,
            code=payload.code,
            params=payload.params,
            version=payload.version,
            status=payload.status,
            is_public=payload.is_public,
        )
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return StrategyRead.model_validate(strategy)


@router.delete("/{strategy_id}")
async def delete_strategy(
    strategy_id: str,
    current_user: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
    strategy_service: StrategyService = Depends(get_strategy_service),
) -> dict:
    try:
        await strategy_service.delete(session, user_id=current_user.user_id, strategy_id=strategy_id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return {"status": "ok"}
