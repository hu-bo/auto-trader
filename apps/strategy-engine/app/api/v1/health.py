from __future__ import annotations

from fastapi import APIRouter, Request

from app.nats.client import NatsClient

router = APIRouter(tags=["health"])


@router.get("/health")
async def health() -> dict:
    return {"status": "ok"}


@router.get("/health/ready")
async def ready(request: Request) -> dict:
    nats_client: NatsClient = request.app.state.nats
    return {"status": "ready", "nats_connected": nats_client.is_connected}

