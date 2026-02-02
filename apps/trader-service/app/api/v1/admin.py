from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_db_session, get_user_service
from app.schemas import ApiResponse, UserRead
from app.services import UserService

router = APIRouter()


class UserStatusUpdate(BaseModel):
    is_active: bool


@router.get("/users", response_model=ApiResponse[list[UserRead]])
async def list_users(
    session: AsyncSession = Depends(get_db_session),
    user_service: UserService = Depends(get_user_service),
) -> ApiResponse[list[UserRead]]:
    users = await user_service.list_users(session)
    return ApiResponse.success(data=[UserRead.model_validate(u) for u in users])


@router.put("/users/{user_id}/status", response_model=ApiResponse[UserRead])
async def update_user_status(
    user_id: str,
    payload: UserStatusUpdate,
    session: AsyncSession = Depends(get_db_session),
    user_service: UserService = Depends(get_user_service),
) -> ApiResponse[UserRead]:
    try:
        user = await user_service.set_active(session, user_id=user_id, is_active=payload.is_active)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return ApiResponse.success(data=UserRead.model_validate(user))


@router.get("/strategies", response_model=ApiResponse[list[dict]])
async def admin_strategies() -> ApiResponse[list[dict]]:
    return ApiResponse.success(data=[])


@router.get("/orders", response_model=ApiResponse[list[dict]])
async def admin_orders() -> ApiResponse[list[dict]]:
    return ApiResponse.success(data=[])

