from __future__ import annotations

from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import JSONResponse
from hquant_logger import create_logger

from app.schemas import ApiResponse

logger = create_logger("trader-service").child("error-handler")


def register_exception_handlers(app: FastAPI) -> None:
    @app.exception_handler(HTTPException)
    async def http_exception_handler(request: Request, exc: HTTPException) -> JSONResponse:
        """处理 HTTPException，返回 ApiResponse 格式"""
        logger.warning(
            f"HTTP Exception: {exc.status_code} {exc.detail}",
            method=request.method,
            url=str(request.url),
            status_code=exc.status_code,
        )
        response = ApiResponse.error(
            code=exc.status_code,
            message=exc.detail if isinstance(exc.detail, str) else str(exc.detail),
        )
        return JSONResponse(
            status_code=exc.status_code,
            content=response.model_dump(),
        )

    @app.exception_handler(Exception)
    async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
        """处理所有未捕获的异常，返回 ApiResponse 格式"""
        logger.exception(
            f"Unhandled exception: {type(exc).__name__}: {str(exc)}",
            method=request.method,
            url=str(request.url),
        )
        response = ApiResponse.error(
            code=500,
            message=str(exc),
        )
        return JSONResponse(
            status_code=500,
            content=response.model_dump(),
        )

