from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import StrategyOrder


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class StrategyOrderService:
    async def list_for_user(self, session: AsyncSession, *, user_id: str) -> list[StrategyOrder]:
        result = await session.execute(
            select(StrategyOrder)
            .where(StrategyOrder.user_id == user_id)
            .order_by(StrategyOrder.created_at.desc())
        )
        return list(result.scalars().all())

    async def create(
        self,
        session: AsyncSession,
        *,
        user_id: str,
        strategy_id: str,
        exchange_id: str,
        symbols: list[str],
        parameters: dict,
        risk_config: dict,
        live: bool,
    ) -> StrategyOrder:
        order = StrategyOrder(
            user_id=user_id,
            strategy_id=strategy_id,
            exchange_id=exchange_id,
            symbols=symbols,
            parameters=parameters,
            risk_config=risk_config,
            live=live,
        )
        session.add(order)
        await session.commit()
        await session.refresh(order)
        return order

    async def get(self, session: AsyncSession, *, user_id: str, order_id: str) -> StrategyOrder:
        order = await session.get(StrategyOrder, order_id)
        if not order or order.user_id != user_id:
            raise ValueError("Strategy order not found")
        return order

    async def update(
        self,
        session: AsyncSession,
        *,
        user_id: str,
        order_id: str,
        **changes,
    ) -> StrategyOrder:
        order = await session.get(StrategyOrder, order_id)
        if not order or order.user_id != user_id:
            raise ValueError("Strategy order not found")

        for key, value in changes.items():
            if value is None or not hasattr(order, key):
                continue
            setattr(order, key, value)

        await session.commit()
        await session.refresh(order)
        return order

    async def delete(self, session: AsyncSession, *, user_id: str, order_id: str) -> None:
        order = await session.get(StrategyOrder, order_id)
        if not order or order.user_id != user_id:
            raise ValueError("Strategy order not found")
        await session.delete(order)
        await session.commit()

    async def start(self, session: AsyncSession, *, user_id: str, order_id: str) -> StrategyOrder:
        order = await self.get(session, user_id=user_id, order_id=order_id)
        if not order.is_running:
            order.is_running = True
            order.started_at = _utcnow()
            order.stopped_at = None
            await session.commit()
            await session.refresh(order)
        return order

    async def stop(self, session: AsyncSession, *, user_id: str, order_id: str) -> StrategyOrder:
        order = await self.get(session, user_id=user_id, order_id=order_id)
        if order.is_running:
            order.is_running = False
            order.stopped_at = _utcnow()
            await session.commit()
            await session.refresh(order)
        return order

