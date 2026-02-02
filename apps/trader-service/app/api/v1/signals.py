from __future__ import annotations

from fastapi import APIRouter

from app.schemas import ApiResponse

router = APIRouter()


@router.get("", response_model=ApiResponse[list[dict]])
async def list_signals() -> ApiResponse[list[dict]]:
    return ApiResponse.success(data=[])

