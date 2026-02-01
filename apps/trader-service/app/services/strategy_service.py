from __future__ import annotations

from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import Strategy


class StrategyService:
    async def list_for_user(self, session: AsyncSession, *, user_id: str) -> list[Strategy]:
        result = await session.execute(
            select(Strategy).where(Strategy.user_id == user_id).order_by(Strategy.created_at.desc())
        )
        return list(result.scalars().all())

    async def list_available(self, session: AsyncSession, *, user_id: str) -> list[Strategy]:
        result = await session.execute(
            select(Strategy)
            .where(or_(Strategy.is_public.is_(True), Strategy.user_id == user_id))
            .order_by(Strategy.created_at.desc())
        )
        return list(result.scalars().all())

    async def create(
        self,
        session: AsyncSession,
        *,
        user_id: str,
        name: str,
        description: str,
        tag: str,
        code: str,
        params: dict,
        version: str,
        status: str,
        is_public: bool,
    ) -> Strategy:
        strategy = Strategy(
            user_id=user_id,
            name=name,
            description=description,
            tag=tag,
            code=code,
            params=params,
            version=version,
            status=status,
            is_public=is_public,
        )
        session.add(strategy)
        await session.commit()
        await session.refresh(strategy)
        return strategy

    async def get(self, session: AsyncSession, *, user_id: str, strategy_id: str) -> Strategy:
        strategy = await session.get(Strategy, strategy_id)
        if not strategy:
            raise ValueError("Strategy not found")
        if strategy.user_id != user_id and not strategy.is_public:
            raise ValueError("Strategy not found")
        return strategy

    async def update(
        self,
        session: AsyncSession,
        *,
        user_id: str,
        strategy_id: str,
        **changes,
    ) -> Strategy:
        strategy = await session.get(Strategy, strategy_id)
        if not strategy or strategy.user_id != user_id:
            raise ValueError("Strategy not found")

        for key, value in changes.items():
            if value is None or not hasattr(strategy, key):
                continue
            setattr(strategy, key, value)

        await session.commit()
        await session.refresh(strategy)
        return strategy

    async def delete(self, session: AsyncSession, *, user_id: str, strategy_id: str) -> None:
        strategy = await session.get(Strategy, strategy_id)
        if not strategy or strategy.user_id != user_id:
            raise ValueError("Strategy not found")
        await session.delete(strategy)
        await session.commit()

