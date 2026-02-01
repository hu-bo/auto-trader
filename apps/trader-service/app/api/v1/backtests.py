from __future__ import annotations

from fastapi import APIRouter, HTTPException, status

router = APIRouter()


@router.post("/backtests")
async def run_backtest() -> dict:
    raise HTTPException(
        status_code=status.HTTP_501_NOT_IMPLEMENTED,
        detail="Not implemented yet",
    )


@router.get("/backtests")
async def list_backtests() -> list[dict]:
    return []


@router.get("/backtests/{backtest_id}")
async def get_backtest(backtest_id: str) -> dict:
    raise HTTPException(
        status_code=status.HTTP_501_NOT_IMPLEMENTED,
        detail="Not implemented yet",
    )


@router.get("/backtests/{backtest_id}/progress")
async def backtest_progress(backtest_id: str) -> dict:
    return {"id": backtest_id, "progress": 0}


@router.post("/ml/train")
async def train_model() -> dict:
    raise HTTPException(
        status_code=status.HTTP_501_NOT_IMPLEMENTED,
        detail="Not implemented yet",
    )


@router.get("/ml/models")
async def list_models() -> list[dict]:
    return []

