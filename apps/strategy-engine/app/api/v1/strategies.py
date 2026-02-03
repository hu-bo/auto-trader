from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Request, status

from app.core.strategy_manager import StrategyManager
from app.models import (
    CreateStrategyRequest,
    DeleteStrategyRequest,
    StrategyInstanceInfo,
    UpdateStrategyRequest,
)

router = APIRouter(tags=["strategies"])


def get_strategy_manager(request: Request) -> StrategyManager:
    return request.app.state.strategy_manager


@router.get("/strategies", response_model=list[StrategyInstanceInfo])
async def list_strategies(
    manager: StrategyManager = Depends(get_strategy_manager),
) -> list[StrategyInstanceInfo]:
    return await manager.list_strategies()


@router.post("/strategies", response_model=StrategyInstanceInfo, status_code=status.HTTP_201_CREATED)
async def create_strategy(
    req: CreateStrategyRequest,
    manager: StrategyManager = Depends(get_strategy_manager),
) -> StrategyInstanceInfo:
    try:
        return await manager.create_strategy(req)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


@router.put("/strategies", response_model=StrategyInstanceInfo)
async def update_strategy(
    req: UpdateStrategyRequest,
    manager: StrategyManager = Depends(get_strategy_manager),
) -> StrategyInstanceInfo:
    try:
        return await manager.update_strategy(req)
    except ValueError as exc:
        detail = str(exc)
        code = status.HTTP_404_NOT_FOUND if "not found" in detail.lower() else status.HTTP_400_BAD_REQUEST
        raise HTTPException(status_code=code, detail=detail) from exc


@router.delete("/strategies")
async def delete_strategy(
    req: DeleteStrategyRequest,
    manager: StrategyManager = Depends(get_strategy_manager),
) -> dict:
    try:
        await manager.delete_strategy(req)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    return {"status": "ok"}

