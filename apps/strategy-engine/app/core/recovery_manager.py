"""
恢复管理器
负责服务重启时从数据库恢复所有活跃订阅
"""
import asyncio
import logging
import uuid
from typing import Dict, List, Any
from datetime import datetime
from collections import defaultdict

logger = logging.getLogger(__name__)


class RecoveryManager:
    """启动恢复管理器"""

    def __init__(self, strategy_manager, db_pool):
        """
        初始化恢复管理器

        Args:
            strategy_manager: StrategyManager 实例
            db_pool: 数据库连接池
        """
        self.strategy_manager = strategy_manager
        self.db = db_pool
        self.recovery_session_id = None

    async def recover_on_startup(self) -> Dict[str, Any]:
        """
        服务启动时恢复所有活跃订阅

        Returns:
            恢复结果统计
        """
        self.recovery_session_id = str(uuid.uuid4())
        start_time = datetime.utcnow()

        logger.info(f"=== Starting recovery session: {self.recovery_session_id} ===")

        try:
            # 步骤1: 从数据库加载所有活跃的订阅
            active_subscriptions = await self._load_active_subscriptions()

            if not active_subscriptions:
                logger.info("No active subscriptions to recover")
                return {
                    "session_id": self.recovery_session_id,
                    "total_subscriptions": 0,
                    "recovered_instances": 0,
                    "failed_instances": 0,
                    "duration_seconds": 0,
                }

            logger.info(
                f"Found {len(active_subscriptions)} active subscriptions to recover"
            )

            # 步骤2: 按实例Key分组（复用逻辑）
            instance_groups = self._group_by_instance_key(active_subscriptions)
            logger.info(f"Grouped into {len(instance_groups)} unique instances")

            # 步骤3: 批量恢复（每批10个实例，避免资源峰值）
            recovered_count, failed_count = await self._recover_in_batches(
                instance_groups, batch_size=10
            )

            duration = (datetime.utcnow() - start_time).total_seconds()

            result = {
                "session_id": self.recovery_session_id,
                "total_subscriptions": len(active_subscriptions),
                "total_instances": len(instance_groups),
                "recovered_instances": recovered_count,
                "failed_instances": failed_count,
                "duration_seconds": duration,
            }

            logger.info(
                f"=== Recovery session {self.recovery_session_id} completed ===\n"
                f"  Total subscriptions: {len(active_subscriptions)}\n"
                f"  Total instances: {len(instance_groups)}\n"
                f"  Recovered: {recovered_count}\n"
                f"  Failed: {failed_count}\n"
                f"  Duration: {duration:.2f}s"
            )

            return result

        except Exception as e:
            logger.error(f"Recovery session {self.recovery_session_id} failed: {e}")
            raise

    async def _load_active_subscriptions(self) -> List[Dict[str, Any]]:
        """从数据库加载所有活跃的订阅"""
        query = """
            SELECT
                so.id as subscription_id,
                so.user_id,
                so.strategy_id,
                so.strategy_name,
                so.symbols,
                so.trade_type,
                so.period,
                so.parameters,
                ue.exchange_type as exchange,
                ue.access_key,
                ue.secret_key
            FROM strategy_order so
            JOIN user_exchanges ue ON so.exchange_id = ue.id
            WHERE so.live = 1
            ORDER BY so.id
        """

        try:
            rows = await self.db.fetch(query)
            subscriptions = []

            for row in rows:
                # 展开 symbols 数组
                symbols = row["symbols"] if isinstance(row["symbols"], list) else []
                for symbol in symbols:
                    subscriptions.append(
                        {
                            "subscription_id": row["subscription_id"],
                            "user_id": str(row["user_id"]),
                            "strategy_id": row["strategy_id"],
                            "strategy_name": row["strategy_name"],
                            "symbol": symbol,
                            "exchange": row["exchange"],
                            "trade_type": row["trade_type"],
                            "period": row["period"],
                            "parameters": row["parameters"] or {},
                        }
                    )

            return subscriptions

        except Exception as e:
            logger.error(f"Failed to load active subscriptions: {e}")
            raise

    def _group_by_instance_key(
        self, subscriptions: List[Dict[str, Any]]
    ) -> Dict[str, List[Dict[str, Any]]]:
        """
        按实例Key分组订阅

        实例Key格式: {strategyId}:{symbol}:{exchange}:{tradeType}

        Returns:
            Dict[instance_key, List[subscription]]
        """
        groups = defaultdict(list)

        for sub in subscriptions:
            instance_key = self.strategy_manager.make_instance_key(
                strategy_id=sub["strategy_id"],
                symbol=sub["symbol"],
                exchange=sub["exchange"],
                trade_type=sub["trade_type"],
            )
            groups[instance_key].append(sub)

        return dict(groups)

    async def _recover_in_batches(
        self, instance_groups: Dict[str, List[Dict[str, Any]]], batch_size: int = 10
    ) -> tuple[int, int]:
        """
        批量恢复实例

        Args:
            instance_groups: 按实例Key分组的订阅
            batch_size: 每批恢复的实例数

        Returns:
            (recovered_count, failed_count)
        """
        instance_items = list(instance_groups.items())
        total_batches = (len(instance_items) + batch_size - 1) // batch_size

        recovered_count = 0
        failed_count = 0

        for batch_idx in range(total_batches):
            start_idx = batch_idx * batch_size
            end_idx = min(start_idx + batch_size, len(instance_items))
            batch = instance_items[start_idx:end_idx]

            logger.info(
                f"Processing batch {batch_idx + 1}/{total_batches} "
                f"({len(batch)} instances)"
            )

            # 并发恢复批次内的实例
            tasks = [
                self._recover_instance(instance_key, subscriptions)
                for instance_key, subscriptions in batch
            ]

            results = await asyncio.gather(*tasks, return_exceptions=True)

            # 统计结果
            for (instance_key, _), result in zip(batch, results):
                if isinstance(result, Exception):
                    logger.error(
                        f"Failed to recover instance {instance_key}: {result}"
                    )
                    failed_count += 1
                    await self._log_recovery(
                        instance_key, "instance_recovered", "failed", str(result)
                    )
                else:
                    recovered_count += 1
                    await self._log_recovery(
                        instance_key, "instance_recovered", "success"
                    )

            # 批次间延迟（避免资源峰值）
            if batch_idx < total_batches - 1:
                await asyncio.sleep(0.5)

        return recovered_count, failed_count

    async def _recover_instance(
        self, instance_key: str, subscriptions: List[Dict[str, Any]]
    ) -> None:
        """
        恢复单个策略实例

        Args:
            instance_key: 实例Key
            subscriptions: 订阅此实例的所有订阅记录
        """
        try:
            logger.info(
                f"Recovering instance {instance_key} "
                f"with {len(subscriptions)} subscriptions"
            )

            # 1. 检查实例是否已存在于内存
            existing_instance = await self.strategy_manager.get_instance(instance_key)
            if existing_instance:
                logger.warning(
                    f"Instance {instance_key} already exists in memory, skipping"
                )
                return

            # 2. 从数据库加载实例状态快照（可选）
            instance_state = await self._load_instance_state(instance_key)

            # 3. 使用第一个订阅的参数创建实例
            first_sub = subscriptions[0]

            # 4. 调用 StrategyManager 创建实例（复用现有逻辑）
            # 为每个订阅调用 subscribe，第一个会创建实例，后续会增加引用计数
            for idx, sub in enumerate(subscriptions):
                await self.strategy_manager.subscribe(
                    user_id=sub["user_id"],
                    subscription_id=sub["subscription_id"],
                    strategy_id=sub["strategy_id"],
                    symbol=sub["symbol"],
                    exchange=sub["exchange"],
                    trade_type=sub["trade_type"],
                    period=sub["period"],
                    parameters=sub["parameters"],
                )

                await self._log_recovery(
                    instance_key,
                    "subscription_attached",
                    "success",
                    subscription_id=sub["subscription_id"],
                )

            # 5. 如果有历史上下文，恢复策略状态
            if instance_state and instance_state.get("last_candle_time"):
                instance = await self.strategy_manager.get_instance(instance_key)
                if instance and instance.executor:
                    await instance.executor.load_historical_context(
                        since=instance_state["last_candle_time"]
                    )

            logger.info(
                f"Instance {instance_key} recovered successfully "
                f"(ref_count={len(subscriptions)})"
            )

        except Exception as e:
            logger.error(f"Failed to recover instance {instance_key}: {e}")
            raise

    async def _load_instance_state(self, instance_key: str) -> Dict[str, Any]:
        """从数据库加载实例状态快照"""
        query = """
            SELECT *
            FROM strategy_instance_state
            WHERE instance_key = $1
        """

        try:
            row = await self.db.fetchrow(query, instance_key)
            if row:
                return dict(row)
            return {}
        except Exception as e:
            logger.warning(f"Failed to load instance state for {instance_key}: {e}")
            return {}

    async def _log_recovery(
        self,
        instance_key: str,
        action: str,
        status: str,
        error_message: str = None,
        subscription_id: int = None,
    ) -> None:
        """记录恢复日志到数据库"""
        query = """
            INSERT INTO strategy_recovery_log
            (recovery_session_id, instance_key, subscription_id, action, status, error_message)
            VALUES ($1, $2, $3, $4, $5, $6)
        """

        try:
            await self.db.execute(
                query,
                self.recovery_session_id,
                instance_key,
                subscription_id,
                action,
                status,
                error_message,
            )
        except Exception as e:
            logger.warning(f"Failed to log recovery action: {e}")

    async def get_recovery_logs(
        self, session_id: str = None
    ) -> List[Dict[str, Any]]:
        """获取恢复日志"""
        if session_id:
            query = """
                SELECT *
                FROM strategy_recovery_log
                WHERE recovery_session_id = $1
                ORDER BY created_at
            """
            rows = await self.db.fetch(query, session_id)
        else:
            # 获取最近一次恢复的日志
            query = """
                SELECT *
                FROM strategy_recovery_log
                WHERE recovery_session_id = (
                    SELECT recovery_session_id
                    FROM strategy_recovery_log
                    ORDER BY created_at DESC
                    LIMIT 1
                )
                ORDER BY created_at
            """
            rows = await self.db.fetch(query)

        return [dict(row) for row in rows]
