from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import UserExchange
from app.utils.encryption import AesGcmEncryptor


class ExchangeService:
    def __init__(self, *, encryptor: AesGcmEncryptor | None):
        self._encryptor = encryptor

    def _require_encryptor(self) -> AesGcmEncryptor:
        if not self._encryptor:
            raise ValueError("ENCRYPTION_KEY is required for this operation")
        return self._encryptor

    async def list_for_user(self, session: AsyncSession, *, user_id: str) -> list[UserExchange]:
        result = await session.execute(
            select(UserExchange)
            .where(UserExchange.user_id == user_id)
            .order_by(UserExchange.created_at.desc())
        )
        return list(result.scalars().all())

    async def get(self, session: AsyncSession, *, user_id: str, exchange_id: str) -> UserExchange:
        exchange = await session.get(UserExchange, exchange_id)
        if not exchange or exchange.user_id != user_id:
            raise ValueError("Exchange not found")
        return exchange

    async def create(
        self,
        session: AsyncSession,
        *,
        user_id: str,
        exchange_type: str,
        name: str,
        api_key: str,
        api_secret: str,
        passphrase: str | None,
        is_testnet: bool,
        is_active: bool,
    ) -> UserExchange:
        encryptor = self._require_encryptor()
        exchange = UserExchange(
            user_id=user_id,
            exchange_type=exchange_type,
            name=name,
            api_key_encrypted=encryptor.encrypt(api_key),
            api_secret_encrypted=encryptor.encrypt(api_secret),
            passphrase_encrypted=encryptor.encrypt(passphrase) if passphrase else None,
            is_testnet=is_testnet,
            is_active=is_active,
        )
        session.add(exchange)
        await session.commit()
        await session.refresh(exchange)
        return exchange

    async def update(
        self,
        session: AsyncSession,
        *,
        user_id: str,
        exchange_id: str,
        name: str | None = None,
        api_key: str | None = None,
        api_secret: str | None = None,
        passphrase: str | None = None,
        is_testnet: bool | None = None,
        is_active: bool | None = None,
    ) -> UserExchange:
        exchange = await session.get(UserExchange, exchange_id)
        if not exchange or exchange.user_id != user_id:
            raise ValueError("Exchange not found")

        encryptor = self._require_encryptor()
        if name is not None:
            exchange.name = name
        if api_key is not None:
            exchange.api_key_encrypted = encryptor.encrypt(api_key)
        if api_secret is not None:
            exchange.api_secret_encrypted = encryptor.encrypt(api_secret)
        if passphrase is not None:
            exchange.passphrase_encrypted = encryptor.encrypt(passphrase) if passphrase else None
        if is_testnet is not None:
            exchange.is_testnet = is_testnet
        if is_active is not None:
            exchange.is_active = is_active

        await session.commit()
        await session.refresh(exchange)
        return exchange

    async def set_grpc_token(
        self,
        session: AsyncSession,
        *,
        user_id: str,
        exchange_id: str,
        token: str,
    ) -> UserExchange:
        exchange = await self.get(session, user_id=user_id, exchange_id=exchange_id)
        encryptor = self._require_encryptor()
        exchange.grpc_token_encrypted = encryptor.encrypt(token)
        await session.commit()
        await session.refresh(exchange)
        return exchange

    async def clear_grpc_token(
        self,
        session: AsyncSession,
        *,
        user_id: str,
        exchange_id: str,
    ) -> UserExchange:
        exchange = await self.get(session, user_id=user_id, exchange_id=exchange_id)
        exchange.grpc_token_encrypted = None
        await session.commit()
        await session.refresh(exchange)
        return exchange

    async def get_grpc_token(
        self,
        session: AsyncSession,
        *,
        user_id: str,
        exchange_id: str,
    ) -> str:
        exchange = await self.get(session, user_id=user_id, exchange_id=exchange_id)
        if not exchange.grpc_token_encrypted:
            raise ValueError("Exchange is not initialized (missing grpc token)")
        encryptor = self._require_encryptor()
        return encryptor.decrypt(exchange.grpc_token_encrypted)

    async def get_api_credentials(
        self,
        session: AsyncSession,
        *,
        user_id: str,
        exchange_id: str,
    ) -> tuple[str, str, str | None]:
        exchange = await self.get(session, user_id=user_id, exchange_id=exchange_id)
        encryptor = self._require_encryptor()
        api_key = encryptor.decrypt(exchange.api_key_encrypted)
        api_secret = encryptor.decrypt(exchange.api_secret_encrypted)
        passphrase = (
            encryptor.decrypt(exchange.passphrase_encrypted) if exchange.passphrase_encrypted else None
        )
        return api_key, api_secret, passphrase

    async def delete(self, session: AsyncSession, *, user_id: str, exchange_id: str) -> None:
        exchange = await self.get(session, user_id=user_id, exchange_id=exchange_id)
        await session.delete(exchange)
        await session.commit()
