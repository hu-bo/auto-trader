from __future__ import annotations

from dataclasses import dataclass

from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)


@dataclass(frozen=True)
class Database:
    engine: AsyncEngine
    sessionmaker: async_sessionmaker[AsyncSession]


def create_database(database_url: str) -> Database:
    """Create PostgreSQL database engine with connection pooling."""
    engine = create_async_engine(
        database_url,
        pool_pre_ping=True,  # 检测失效连接
        pool_size=20,  # 连接池大小
        max_overflow=10,  # 最大溢出连接数
        pool_recycle=3600,  # 1小时回收连接，避免数据库超时
        echo=False,  # 生产环境关闭 SQL 日志
        future=True,
    )
    session_maker = async_sessionmaker(engine, expire_on_commit=False)
    return Database(engine=engine, sessionmaker=session_maker)

