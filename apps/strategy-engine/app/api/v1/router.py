from __future__ import annotations

from fastapi import APIRouter

from app.api.v1.strategies import router as strategies_router

router = APIRouter()
router.include_router(strategies_router)

