"""
策略管理器
负责策略实例池管理、引用计数、生命周期管理
"""
import asyncio
import logging
from typing import Dict, List, Optional, Any
from dataclasses import dataclass
from datetime import datetime

logger = logging.getLogger(__name__)


@dataclass
class InstanceInfo:
    """策略实例信息"""
    executor: Any  # StrategyExecutor 实例
    ref_count: int  # 引用计数
    subscription_ids: List[int]  # 订阅ID列表
    nats_subject: str  # NATS 订阅主题
    status: str  # running, stopped, error
    created_at: datetime
    last_candle_time: Optional[datetime] = None
    error_message: Optional[str] = None


class StrategyManager:
    """策略实例池管理器"""

    def __init__(self, db_pool, nats_client):
        """
        初始化策略管理器

        Args:
            db_pool: 数据库连接池
            nats_client: NATS 客户端
        """
        self.db = db_pool
        self.nats = nats_client
        self.instance_registry: Dict[str, InstanceInfo] = {}
        self._lock = asyncio.Lock()  # 并发保护锁
        logger.info("StrategyManager initialized")

    def make_instance_key(
        self,
        strategy_id: str,
        symbol: str,
        exchange: str,
        trade_type: str
    ) -> str:
        """
        生成实例Key

        格式: {strategyId}:{symbol}:{exchange}:{tradeType}
        例如: ema_cross:BTC-USDT:binance:spot
        """
        return f"{strategy_id}:{symbol}:{exchange}:{trade_type}"

    def parse_instance_key(self, instance_key: str) -> Dict[str, str]:
        """解析实例Key"""
        parts = instance_key.split(":")
        if len(parts) != 4:
            raise ValueError(f"Invalid instance key format: {instance_key}")

        return {
            "strategy_id": parts[0],
            "symbol": parts[1],
            "exchange": parts[2],
            "trade_type": parts[3],
        }

    async def subscribe(
        self,
        user_id: str,
        subscription_id: int,
        strategy_id: str,
        symbol: str,
        exchange: str,
        trade_type: str,
        period: str,
        parameters: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """
        订阅策略

        如果实例已存在，增加引用计数；否则创建新实例

        Returns:
            订阅响应信息
        """
        async with self._lock:
            instance_key = self.make_instance_key(
                strategy_id, symbol, exchange, trade_type
            )

            logger.info(
                f"Subscribe request: user={user_id}, subscription={subscription_id}, "
                f"instance_key={instance_key}"
            )

            # 检查实例是否已存在
            if instance_key in self.instance_registry:
                # 实例存在，增加引用计数
                instance = self.instance_registry[instance_key]
                instance.ref_count += 1
                instance.subscription_ids.append(subscription_id)

                logger.info(
                    f"Reusing instance {instance_key}, ref_count={instance.ref_count}"
                )

                # 更新数据库
                await self._update_instance_state_db(
                    instance_key,
                    ref_count=instance.ref_count,
                    subscription_ids=instance.subscription_ids,
                )

                return {
                    "subscription_id": subscription_id,
                    "instance_key": instance_key,
                    "status": "running",
                    "ref_count": instance.ref_count,
                    "nats_subject": instance.nats_subject,
                }

            else:
                # 创建新实例
                return await self._create_new_instance(
                    user_id=user_id,
                    subscription_id=subscription_id,
                    strategy_id=strategy_id,
                    symbol=symbol,
                    exchange=exchange,
                    trade_type=trade_type,
                    period=period,
                    parameters=parameters or {},
                    instance_key=instance_key,
                )

    async def _create_new_instance(
        self,
        user_id: str,
        subscription_id: int,
        strategy_id: str,
        symbol: str,
        exchange: str,
        trade_type: str,
        period: str,
        parameters: Dict[str, Any],
        instance_key: str,
    ) -> Dict[str, Any]:
        """创建新策略实例"""
        try:
            logger.info(f"Creating new instance: {instance_key}")

            # 1. 创建策略执行器（占位符，后续实现）
            from ..strategies.executor import StrategyExecutor

            executor = StrategyExecutor(
                strategy_id=strategy_id,
                symbol=symbol,
                exchange=exchange,
                trade_type=trade_type,
                parameters=parameters,
            )

            # 2. 构建 NATS 主题
            nats_subject = self._build_nats_subject(
                exchange, trade_type, symbol, period
            )

            # 3. 订阅 NATS K线数据流
            await self.nats.subscribe(
                subject=nats_subject,
                queue_group=f"strategy-{strategy_id}",
                callback=executor.on_candle,
            )

            logger.info(f"Subscribed to NATS: {nats_subject}")

            # 4. 注册到内存实例池
            instance_info = InstanceInfo(
                executor=executor,
                ref_count=1,
                subscription_ids=[subscription_id],
                nats_subject=nats_subject,
                status="running",
                created_at=datetime.utcnow(),
            )

            self.instance_registry[instance_key] = instance_info

            # 5. 持久化到数据库
            await self._insert_instance_state_db(
                instance_key=instance_key,
                strategy_id=strategy_id,
                symbol=symbol,
                exchange=exchange,
                trade_type=trade_type,
                period=period,
                ref_count=1,
                subscription_ids=[subscription_id],
                nats_subject=nats_subject,
            )

            logger.info(f"Instance {instance_key} created successfully")

            return {
                "subscription_id": subscription_id,
                "instance_key": instance_key,
                "status": "running",
                "ref_count": 1,
                "nats_subject": nats_subject,
            }

        except Exception as e:
            logger.error(f"Failed to create instance {instance_key}: {e}")
            raise

    async def unsubscribe(
        self, subscription_id: int, instance_key: str
    ) -> None:
        """
        取消订阅

        减少引用计数，如果归零则销毁实例
        """
        async with self._lock:
            if instance_key not in self.instance_registry:
                logger.warning(f"Instance {instance_key} not found in registry")
                return

            instance = self.instance_registry[instance_key]

            # 移除订阅ID
            if subscription_id in instance.subscription_ids:
                instance.subscription_ids.remove(subscription_id)

            # 减少引用计数
            instance.ref_count -= 1

            logger.info(
                f"Unsubscribe: instance={instance_key}, "
                f"subscription={subscription_id}, ref_count={instance.ref_count}"
            )

            # 更新数据库
            await self._update_instance_state_db(
                instance_key,
                ref_count=instance.ref_count,
                subscription_ids=instance.subscription_ids,
            )

            # 如果引用计数归零，销毁实例
            if instance.ref_count <= 0:
                await self._destroy_instance(instance_key, instance)

    async def _destroy_instance(
        self, instance_key: str, instance: InstanceInfo
    ) -> None:
        """销毁策略实例"""
        try:
            logger.info(f"Destroying instance {instance_key} (ref_count=0)")

            # 1. 取消 NATS 订阅
            await self.nats.unsubscribe(instance.nats_subject)

            # 2. 停止执行器
            await instance.executor.stop()

            # 3. 从注册表移除
            del self.instance_registry[instance_key]

            # 4. 更新数据库状态
            await self.db.execute(
                """
                UPDATE strategy_instance_state
                SET status = 'stopped', updated_at = NOW()
                WHERE instance_key = $1
                """,
                instance_key,
            )

            logger.info(f"Instance {instance_key} destroyed successfully")

        except Exception as e:
            logger.error(f"Failed to destroy instance {instance_key}: {e}")
            raise

    async def get_instance(self, instance_key: str) -> Optional[InstanceInfo]:
        """获取实例信息"""
        return self.instance_registry.get(instance_key)

    async def get_all_instances(self) -> Dict[str, InstanceInfo]:
        """获取所有实例"""
        return self.instance_registry.copy()

    async def get_instance_stats(self) -> Dict[str, Any]:
        """获取实例统计信息"""
        total_instances = len(self.instance_registry)
        running_instances = sum(
            1 for inst in self.instance_registry.values() if inst.status == "running"
        )
        stopped_instances = sum(
            1 for inst in self.instance_registry.values() if inst.status == "stopped"
        )
        error_instances = sum(
            1 for inst in self.instance_registry.values() if inst.status == "error"
        )
        total_subscriptions = sum(
            inst.ref_count for inst in self.instance_registry.values()
        )

        # 按交易所分组
        instances_by_exchange = {}
        for key in self.instance_registry.keys():
            parsed = self.parse_instance_key(key)
            exchange = parsed["exchange"]
            instances_by_exchange[exchange] = instances_by_exchange.get(exchange, 0) + 1

        # 按策略分组
        instances_by_strategy = {}
        for key in self.instance_registry.keys():
            parsed = self.parse_instance_key(key)
            strategy_id = parsed["strategy_id"]
            instances_by_strategy[strategy_id] = (
                instances_by_strategy.get(strategy_id, 0) + 1
            )

        return {
            "total_instances": total_instances,
            "running_instances": running_instances,
            "stopped_instances": stopped_instances,
            "error_instances": error_instances,
            "total_subscriptions": total_subscriptions,
            "instances_by_exchange": instances_by_exchange,
            "instances_by_strategy": instances_by_strategy,
        }

    def _build_nats_subject(
        self, exchange: str, trade_type: str, symbol: str, period: str
    ) -> str:
        """构建 NATS 订阅主题"""
        return f"exchange.candle.{exchange}.{trade_type}.{symbol}.{period}"

    async def _insert_instance_state_db(
        self,
        instance_key: str,
        strategy_id: str,
        symbol: str,
        exchange: str,
        trade_type: str,
        period: str,
        ref_count: int,
        subscription_ids: List[int],
        nats_subject: str,
    ) -> None:
        """插入实例状态到数据库"""
        await self.db.execute(
            """
            INSERT INTO strategy_instance_state
            (instance_key, strategy_id, symbol, exchange, trade_type, period,
             ref_count, subscription_ids, nats_subject, status, created_at, updated_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'running', NOW(), NOW())
            ON CONFLICT (instance_key)
            DO UPDATE SET
                ref_count = $7,
                subscription_ids = $8,
                status = 'running',
                updated_at = NOW()
            """,
            instance_key,
            strategy_id,
            symbol,
            exchange,
            trade_type,
            period,
            ref_count,
            subscription_ids,
            nats_subject,
        )

    async def _update_instance_state_db(
        self,
        instance_key: str,
        ref_count: int,
        subscription_ids: List[int],
    ) -> None:
        """更新实例状态到数据库"""
        await self.db.execute(
            """
            UPDATE strategy_instance_state
            SET ref_count = $2,
                subscription_ids = $3,
                updated_at = NOW()
            WHERE instance_key = $1
            """,
            instance_key,
            ref_count,
            subscription_ids,
        )
