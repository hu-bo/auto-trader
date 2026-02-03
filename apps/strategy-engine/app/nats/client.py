from __future__ import annotations

import asyncio
from typing import Any, Awaitable, Callable

import nats
from hquant_logger import create_logger
from nats.aio.client import Client as _NatsConnection

logger = create_logger("strategy-engine").child("nats")


class NatsClient:
    def __init__(self, url: str, *, name: str = "strategy-engine") -> None:
        self._url = url
        self._name = name
        self._nc: _NatsConnection | None = None
        self._connect_lock = asyncio.Lock()

    @property
    def is_connected(self) -> bool:
        return bool(self._nc and self._nc.is_connected and not self._nc.is_closed)

    async def connect(self) -> None:
        async with self._connect_lock:
            if self.is_connected:
                return

            async def disconnected_cb() -> None:
                logger.warning("NATS disconnected")

            async def reconnected_cb() -> None:
                assert self._nc is not None
                logger.info("NATS reconnected", url=str(self._nc.connected_url))

            async def closed_cb() -> None:
                logger.warning("NATS connection closed")

            async def error_cb(err: Exception) -> None:
                logger.error("NATS error", err=str(err))

            self._nc = await nats.connect(
                servers=[self._url],
                name=self._name,
                disconnected_cb=disconnected_cb,
                reconnected_cb=reconnected_cb,
                closed_cb=closed_cb,
                error_cb=error_cb,
            )
            logger.info("NATS connected", url=self._url)

    async def close(self) -> None:
        async with self._connect_lock:
            if not self._nc:
                return
            try:
                await self._nc.drain()
            finally:
                await self._nc.close()
                self._nc = None
                logger.info("NATS closed")

    async def publish(self, subject: str, payload: bytes) -> None:
        if not self._nc or self._nc.is_closed:
            raise RuntimeError("NATS is not connected")
        await self._nc.publish(subject, payload)

    async def subscribe(
        self, subject: str, *, cb: Callable[[Any], Awaitable[None]]
    ) -> Any:
        if not self._nc or self._nc.is_closed:
            raise RuntimeError("NATS is not connected")
        return await self._nc.subscribe(subject, cb=cb)
