from __future__ import annotations

from fastapi import APIRouter

from app.api.v1 import (
    account,
    admin,
    auth,
    backtests,
    exchanges,
    orders,
    positions,
    signals,
    stats,
    strategies,
    strategy_orders,
    users,
)

router = APIRouter()

router.include_router(auth.router, prefix="/auth", tags=["auth"])
router.include_router(users.router, prefix="/user", tags=["users"])
router.include_router(exchanges.router, prefix="/exchanges", tags=["exchanges"])
router.include_router(strategies.router, prefix="/strategies", tags=["strategies"])
router.include_router(strategy_orders.router, prefix="/strategy-order", tags=["strategy-order"])
router.include_router(orders.router, prefix="/orders", tags=["orders"])
router.include_router(positions.router, prefix="/positions", tags=["positions"])
router.include_router(account.router, tags=["account"])
router.include_router(signals.router, prefix="/signals", tags=["signals"])
router.include_router(backtests.router, tags=["backtests"])
router.include_router(stats.router, prefix="/stats", tags=["stats"])
router.include_router(admin.router, prefix="/admin", tags=["admin"])
