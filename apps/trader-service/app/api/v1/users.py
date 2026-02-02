from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import (
    CurrentUser,
    get_current_user,
    get_db_session,
    get_user_service,
)
from app.schemas import ApiResponse, UserRead
from app.services import UserService

router = APIRouter()


@router.get("/me", response_model=ApiResponse[UserRead])
async def me(
    current_user: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
    user_service: UserService = Depends(get_user_service),
) -> ApiResponse[UserRead]:
    user = await user_service.get_or_create(
        session, user_id=current_user.user_id, username=current_user.username
    )
    return ApiResponse.success(data=UserRead.model_validate(user))
