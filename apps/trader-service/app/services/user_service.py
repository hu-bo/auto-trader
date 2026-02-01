from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import User


class UserService:
    async def get_or_create(self, session: AsyncSession, *, user_id: str, username: str) -> User:
        existing = await session.get(User, user_id)
        if existing:
            if existing.username != username:
                existing.username = username
                await session.commit()
                await session.refresh(existing)
            return existing

        user = User(id=user_id, username=username)
        session.add(user)
        await session.commit()
        await session.refresh(user)
        return user

    async def list_users(self, session: AsyncSession) -> list[User]:
        result = await session.execute(select(User).order_by(User.created_at.desc()))
        return list(result.scalars().all())

    async def set_active(self, session: AsyncSession, *, user_id: str, is_active: bool) -> User:
        user = await session.get(User, user_id)
        if not user:
            raise ValueError("User not found")
        user.is_active = is_active
        await session.commit()
        await session.refresh(user)
        return user
