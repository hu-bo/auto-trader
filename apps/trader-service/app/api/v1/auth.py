from __future__ import annotations

from dataclasses import asdict

from casdoor_py import CasdoorConfig, create_casdoor_server
from fastapi import APIRouter, HTTPException, status

from app.config import get_settings

router = APIRouter()


@router.get("/callback")
async def callback(code: str) -> dict:
    settings = get_settings()
    if settings.auth_mode != "casdoor":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="AUTH_MODE is not casdoor",
        )
    if not settings.casdoor_client_secret:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="CASDOOR_CLIENT_SECRET is required",
        )
    if not settings.casdoor_certificate:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="CASDOOR_CERTIFICATE is required",
        )

    server = create_casdoor_server(
        CasdoorConfig(
            endpoint=settings.casdoor_endpoint,
            client_id=settings.casdoor_client_id,
            org_name=settings.casdoor_org_name,
            app_name=settings.casdoor_app_name,
            client_secret=settings.casdoor_client_secret,
            certificate=settings.casdoor_certificate,
        )
    )
    token = await server.get_token(code)
    return asdict(token)


@router.post("/logout")
async def logout() -> dict:
    return {"status": "ok"}
