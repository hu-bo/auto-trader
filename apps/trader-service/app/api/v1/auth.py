from __future__ import annotations

import json
from dataclasses import asdict

import httpx
from casdoor_py import CasdoorConfig, create_casdoor_server
from fastapi import APIRouter, HTTPException, status
from hquant_logger import create_logger

from app.config import get_settings
from app.schemas import ApiResponse

router = APIRouter()
logger = create_logger("trader-service").child("auth")


@router.get("/callback", response_model=ApiResponse[dict])
async def callback(code: str) -> ApiResponse[dict]:
    settings = get_settings()
    logger.info(f"[Auth Callback] Received code: {code}")
    logger.info(f"[Auth Callback] Auth mode: {settings.auth_mode}")

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

    logger.info(f"[Auth Callback] Casdoor config:")
    logger.info(f"  endpoint: {settings.casdoor_endpoint}")
    logger.info(f"  client_id: {settings.casdoor_client_id}")
    logger.info(f"  org_name: {settings.casdoor_org_name}")
    logger.info(f"  app_name: {settings.casdoor_app_name}")
    logger.info(f"  client_secret: {'*' * 10 if settings.casdoor_client_secret else 'None'}")
    logger.info(f"  certificate_path: {settings.casdoor_certificate_path}")
    logger.info(f"  certificate_loaded: {settings.casdoor_certificate}")

    try:
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
        logger.info("[Auth Callback] Calling server.get_token()...")
        token = await server.get_token(code)
        print("Token:", token)
        auth_result = await server.verify_token(token.access_token)
        logger.info("[Auth Callback] Token retrieved successfully")
        return ApiResponse.success(data={**asdict(token), "user": auth_result.user})
    except Exception as e:
        logger.error(f"[Auth Callback] Failed to get token: {type(e).__name__}: {str(e)}")
        raise


@router.post("/logout", response_model=ApiResponse[None])
async def logout() -> ApiResponse[None]:
    return ApiResponse.success()
