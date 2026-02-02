from __future__ import annotations

from fastapi import APIRouter

from app.schemas import ApiResponse

router = APIRouter()


@router.get("", response_model=ApiResponse[dict])
async def stats() -> ApiResponse[dict]:
    return ApiResponse.success(data={})

