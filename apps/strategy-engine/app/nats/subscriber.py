from __future__ import annotations

import asyncio
from collections.abc import Awaitable, Callable
from typing import Any

from hquant_logger import create_logger

from app.models import Candle
from app.nats.client import NatsClient

logger = create_logger("strategy-engine").child("candle-subscriber")


class CandleSubscriber:
    def __init__(self, nats_client: NatsClient, on_candle: Callable[[Candle], Awaitable[None]]):
        self._nats = nats_client
        self._on_candle = on_candle
        self._lock = asyncio.Lock()
        self._subs: dict[str, tuple[Any, int]] = {}
        self._tasks: set[asyncio.Task[None]] = set()

    async def add_subject(self, subject: str) -> None:
        async with self._lock:
            entry = self._subs.get(subject)
            if entry:
                sub, ref_count = entry
                self._subs[subject] = (sub, ref_count + 1)
                return
            sub = await self._nats.subscribe(subject, cb=self._handle_msg)
            self._subs[subject] = (sub, 1)
            logger.info("Subscribed candle subject", subject=subject)

    async def remove_subject(self, subject: str) -> None:
        sub: Any | None = None
        async with self._lock:
            entry = self._subs.get(subject)
            if not entry:
                return

            sub, ref_count = entry
            if ref_count > 1:
                self._subs[subject] = (sub, ref_count - 1)
                return

            del self._subs[subject]

        try:
            await sub.unsubscribe()
        except Exception as exc:
            logger.warning("Failed to unsubscribe", subject=subject, err=str(exc))
        else:
            logger.info("Unsubscribed candle subject", subject=subject)

    async def close(self) -> None:
        async with self._lock:
            subs = list(self._subs.items())
            self._subs.clear()

        for subject, (sub, _) in subs:
            try:
                await sub.unsubscribe()
            except Exception as exc:
                logger.warning("Failed to unsubscribe", subject=subject, err=str(exc))

        for task in self._tasks:
            task.cancel()
        await asyncio.gather(*self._tasks, return_exceptions=True)
        self._tasks.clear()

    async def _handle_msg(self, msg: Any) -> None:
        logger.info("Raw NATS msg received", subject=msg.subject, size=len(msg.data))
        try:
            candle = Candle.model_validate_json(msg.data)
            print(candle)
        except Exception as exc:
            logger.warning("Invalid candle payload", subject=msg.subject, err=str(exc), raw=msg.data[:200])
            return

        task = asyncio.create_task(self._on_candle(candle))
        self._tasks.add(task)
        task.add_done_callback(self._tasks.discard)

