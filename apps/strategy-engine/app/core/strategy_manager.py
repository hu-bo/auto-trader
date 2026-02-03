from __future__ import annotations

import asyncio
from dataclasses import dataclass
from datetime import datetime, timezone

from hquant_logger import create_logger

from app.core.indicator_calculator import IndicatorCalculator
from app.core.strategy_executor import StrategyExecutor
from app.models import (
    Candle,
    CreateStrategyRequest,
    DeleteStrategyRequest,
    StrategyInstanceInfo,
    StrategyRef,
    UpdateStrategyRequest,
)
from app.nats.subscriber import CandleSubscriber
from app.nats.topics import candle_subject

logger = create_logger("strategy-engine").child("manager")


@dataclass(frozen=True)
class StrategyKey:
    strategy_id: int
    exchange: str
    trade_type: str
    symbol: str
    period: str


@dataclass(frozen=True)
class CandleRoutingKey:
    exchange: str
    trade_type: str
    symbol: str
    period: str


@dataclass
class StrategyInstance:
    key: StrategyKey
    strategy_name: str
    code: str
    created_at: datetime
    calculator: IndicatorCalculator
    last_emitted_action: str | None = None

    @property
    def strategy_id(self) -> int:
        return self.key.strategy_id


class StrategyManager:
    def __init__(
        self,
        *,
        candle_subscriber: CandleSubscriber,
        executor: StrategyExecutor,
        candle_buffer_size: int,
        candle_subject_prefix: str,
    ) -> None:
        self._subscriber = candle_subscriber
        self._executor = executor
        self._buffer_size = candle_buffer_size
        self._subject_prefix = candle_subject_prefix

        self._lock = asyncio.Lock()
        self._instances: dict[StrategyKey, StrategyInstance] = {}
        self._routing: dict[CandleRoutingKey, set[StrategyKey]] = {}

    async def list_strategies(self) -> list[StrategyInstanceInfo]:
        async with self._lock:
            return [self._to_info(i) for i in self._instances.values()]

    async def create_strategy(self, req: CreateStrategyRequest) -> StrategyInstanceInfo:
        key = StrategyKey(
            strategy_id=req.strategy_id,
            exchange=req.exchange,
            trade_type=req.trade_type,
            symbol=req.symbol,
            period=req.period,
        )

        instance = StrategyInstance(
            key=key,
            strategy_name=req.strategy_name,
            code=req.code,
            created_at=datetime.now(tz=timezone.utc),
            calculator=IndicatorCalculator(
                capacity=self._buffer_size, strategy_name=req.strategy_name, code=req.code
            ),
        )

        subject = candle_subject(
            self._subject_prefix, req.exchange, req.trade_type, req.symbol, req.period
        )

        await self._subscriber.add_subject(subject)

        rollback = False
        async with self._lock:
            if key in self._instances:
                rollback = True
            else:
                self._instances[key] = instance
                routing_key = CandleRoutingKey(
                    exchange=req.exchange,
                    trade_type=req.trade_type,
                    symbol=req.symbol,
                    period=req.period,
                )
                self._routing.setdefault(routing_key, set()).add(key)

        if rollback:
            await self._subscriber.remove_subject(subject)
            raise ValueError("Strategy instance already exists")

        logger.info("Strategy instance created", strategy_id=str(req.strategy_id), subject=subject)
        return self._to_info(instance)

    async def update_strategy(self, req: UpdateStrategyRequest) -> StrategyInstanceInfo:
        key = StrategyKey(
            strategy_id=req.strategy_id,
            exchange=req.exchange,
            trade_type=req.trade_type,
            symbol=req.symbol,
            period=req.period,
        )

        async with self._lock:
            instance = self._instances.get(key)
            if not instance:
                raise ValueError("Strategy instance not found")

            instance.strategy_name = req.strategy_name
            instance.code = req.code
            instance.last_emitted_action = None
            instance.calculator = IndicatorCalculator(
                capacity=self._buffer_size, strategy_name=req.strategy_name, code=req.code
            )

        logger.info("Strategy instance updated", strategy_id=str(req.strategy_id))
        return self._to_info(instance)

    async def delete_strategy(self, req: DeleteStrategyRequest) -> None:
        key = StrategyKey(
            strategy_id=req.strategy_id,
            exchange=req.exchange,
            trade_type=req.trade_type,
            symbol=req.symbol,
            period=req.period,
        )

        subject = candle_subject(
            self._subject_prefix, req.exchange, req.trade_type, req.symbol, req.period
        )

        async with self._lock:
            instance = self._instances.pop(key, None)
            if not instance:
                raise ValueError("Strategy instance not found")

            routing_key = CandleRoutingKey(
                exchange=req.exchange,
                trade_type=req.trade_type,
                symbol=req.symbol,
                period=req.period,
            )
            keys = self._routing.get(routing_key)
            if keys:
                keys.discard(key)
                if not keys:
                    del self._routing[routing_key]

        await self._subscriber.remove_subject(subject)
        logger.info("Strategy instance deleted", strategy_id=str(req.strategy_id), subject=subject)

    async def get_strategy_info(self, req: StrategyRef) -> StrategyInstanceInfo:
        key = StrategyKey(
            strategy_id=req.strategy_id,
            exchange=req.exchange,
            trade_type=req.trade_type,
            symbol=req.symbol,
            period=req.period,
        )
        async with self._lock:
            instance = self._instances.get(key)
            if not instance:
                raise ValueError("Strategy instance not found")
            return self._to_info(instance)

    async def handle_candle(self, candle: Candle) -> None:
        routing_key = CandleRoutingKey(
            exchange=candle.exchange,
            trade_type=candle.trade_type,
            symbol=candle.symbol,
            period=candle.period,
        )

        async with self._lock:
            keys = list(self._routing.get(routing_key, set()))
            strategies = [self._instances[k] for k in keys if k in self._instances]

        if not strategies:
            return

        await self._executor.execute(candle, strategies)

    def _to_info(self, instance: StrategyInstance) -> StrategyInstanceInfo:
        return StrategyInstanceInfo(
            strategy_id=instance.key.strategy_id,
            strategy_name=instance.strategy_name,
            code=instance.code,
            exchange=instance.key.exchange,
            trade_type=instance.key.trade_type,
            symbol=instance.key.symbol,
            period=instance.key.period,
            created_at=instance.created_at,
        )
