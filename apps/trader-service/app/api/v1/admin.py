from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_db_session, get_user_service
from app.schemas import UserRead
from app.services import UserService

router = APIRouter()


class UserStatusUpdate(BaseModel):
    is_active: bool


@router.get("/users", response_model=list[UserRead])
async def list_users(
    session: AsyncSession = Depends(get_db_session),
    user_service: UserService = Depends(get_user_service),
) -> list[UserRead]:
    users = await user_service.list_users(session)
    return [UserRead.model_validate(u) for u in users]


@router.put("/users/{user_id}/status", response_model=UserRead)
async def update_user_status(
    user_id: str,
    payload: UserStatusUpdate,
    session: AsyncSession = Depends(get_db_session),
    user_service: UserService = Depends(get_user_service),
) -> UserRead:
    try:
        user = await user_service.set_active(session, user_id=user_id, is_active=payload.is_active)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return UserRead.model_validate(user)


@router.get("/strategies")
async def admin_strategies() -> list[dict]:
    return []


@router.get("/orders")
async def admin_orders() -> list[dict]:
    return []

