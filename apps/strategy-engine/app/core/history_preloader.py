from __future__ import annotations

import time
from typing import Any

import httpx
from hquant_logger import create_logger

from app.models import Candle

logger = create_logger("strategy-engine").child("history-preloader")

_BARS_PER_DAY: dict[str, int] = {
    "1m": 1440,
    "3m": 480,
    "5m": 288,
    "15m": 96,
    "30m": 48,
    "1h": 24,
    "2h": 12,
    "4h": 6,
    "6h": 4,
    "12h": 2,
    "1d": 1,
}


class HistoryPreloader:
    """Fetches historical candle data from exchange-adapter-service REST API."""

    def __init__(self, base_url: str, *, api_key: str = "", timeout: float = 30.0) -> None:
        self._base_url = base_url.rstrip("/")
        self._api_key = api_key
        self._timeout = timeout

    @property
    def _headers(self) -> dict[str, str]:
        return {"X-API-Key": self._api_key} if self._api_key else {}

    async def fetch_candles(
        self,
        *,
        exchange: str,
        symbol: str,
        trade_type: str = "spot",
        period: str,
        days: int = 3,
    ) -> list[Candle]:
        """Fetch historical candles from exchange-adapter-service.

        Returns an empty list on any error (non-blocking).
        """
        bars_per_day = _BARS_PER_DAY.get(period, 96)
        limit = bars_per_day * days

        now_ms = int(time.time() * 1000)
        start_time_ms = now_ms - days * 86_400_000

        url = f"{self._base_url}/api/v1/market/candles"
        params: dict[str, Any] = {
            "exchange": exchange,
            "symbol": symbol,
            "trade_type": trade_type,
            "period": period,
            "limit": limit,
            "start_time": start_time_ms,
            "end_time": now_ms,
        }

        logger.info(
            "Fetching historical candles",
            exchange=exchange,
            symbol=symbol,
            period=period,
            days=days,
            limit=limit,
        )

        try:
            async with httpx.AsyncClient(timeout=self._timeout) as client:
                resp = await client.get(url, params=params, headers=self._headers)
                resp.raise_for_status()
        except httpx.HTTPError as exc:
            logger.warning(
                "Failed to fetch historical candles",
                exchange=exchange,
                symbol=symbol,
                period=period,
                err=str(exc),
            )
            return []

        try:
            body = resp.json()
            raw_candles: list[dict[str, Any]] = body.get("data", [])
            if not isinstance(raw_candles, list):
                logger.warning(
                    "Unexpected response shape from candles API",
                    exchange=exchange,
                    symbol=symbol,
                )
                return []

            candles = [Candle.model_validate(c) for c in raw_candles]
            candles.sort(key=lambda c: c.timestamp)

            logger.info(
                "Historical candles fetched",
                exchange=exchange,
                symbol=symbol,
                period=period,
                count=len(candles),
            )
            return candles

        except Exception as exc:
            logger.warning(
                "Failed to parse historical candles response",
                exchange=exchange,
                symbol=symbol,
                err=str(exc),
            )
            return []
