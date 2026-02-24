from __future__ import annotations

from fastapi import APIRouter, Request

from app.nats.client import NatsClient

router = APIRouter(tags=["health"])


@router.get("/health")
async def health() -> dict:
    return {"status": "ok"}


@router.get("/health/ready")
async def ready(request: Request) -> dict:
    signal_nats: NatsClient = request.app.state.nats
    upstream_nats: NatsClient = request.app.state.upstream_nats
    return {
        "status": "ready",
        "nats_connected": signal_nats.is_connected,
        "upstream_nats_connected": upstream_nats.is_connected,
    }

