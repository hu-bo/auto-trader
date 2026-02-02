from __future__ import annotations

from fastapi import APIRouter, HTTPException, status

from app.schemas import ApiResponse

router = APIRouter()


@router.post("/backtests", response_model=ApiResponse[dict])
async def run_backtest() -> ApiResponse[dict]:
    raise HTTPException(
        status_code=status.HTTP_501_NOT_IMPLEMENTED,
        detail="Not implemented yet",
    )


@router.get("/backtests", response_model=ApiResponse[list[dict]])
async def list_backtests() -> ApiResponse[list[dict]]:
    return ApiResponse.success(data=[])


@router.get("/backtests/{backtest_id}", response_model=ApiResponse[dict])
async def get_backtest(backtest_id: str) -> ApiResponse[dict]:
    raise HTTPException(
        status_code=status.HTTP_501_NOT_IMPLEMENTED,
        detail="Not implemented yet",
    )


@router.get("/backtests/{backtest_id}/progress", response_model=ApiResponse[dict])
async def backtest_progress(backtest_id: str) -> ApiResponse[dict]:
    return ApiResponse.success(data={"id": backtest_id, "progress": 0})


@router.post("/ml/train", response_model=ApiResponse[dict])
async def train_model() -> ApiResponse[dict]:
    raise HTTPException(
        status_code=status.HTTP_501_NOT_IMPLEMENTED,
        detail="Not implemented yet",
    )


@router.get("/ml/models", response_model=ApiResponse[list[dict]])
async def list_models() -> ApiResponse[list[dict]]:
    return ApiResponse.success(data=[])

