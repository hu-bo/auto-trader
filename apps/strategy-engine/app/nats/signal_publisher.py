"""
信号发布器
发布策略交易信号到 NATS
"""
import json
import logging
from typing import Dict, Any, Optional
from datetime import datetime

logger = logging.getLogger(__name__)


class SignalPublisher:
    """策略信号发布器"""

    def __init__(self, nats_client):
        """
        初始化信号发布器

        Args:
            nats_client: NATS 客户端实例
        """
        self.nats = nats_client
        logger.info("SignalPublisher initialized")

    async def publish_signal(
        self,
        user_id: str,
        symbol: str,
        trade_type: str,
        signal_data: Dict[str, Any],
    ):
        """
        发布交易信号

        Args:
            user_id: 用户ID
            symbol: 交易对
            trade_type: 交易类型（spot, futures, delivery）
            signal_data: 信号数据
        """
        try:
            # 构建 NATS 主题
            # 格式: strategy.signals.{userId}.{symbol}.{tradeType}
            subject = self._build_subject(user_id, symbol, trade_type)

            # 构建消息体
            message = self._build_message(user_id, symbol, trade_type, signal_data)

            # 序列化为 JSON
            payload = json.dumps(message).encode("utf-8")

            # 发布到 NATS
            await self.nats.publish(subject, payload)

            logger.info(
                f"Published signal: {subject} - action={signal_data.get('action')}, "
                f"price={signal_data.get('price')}"
            )

        except Exception as e:
            logger.error(f"Failed to publish signal: {e}")
            raise

    async def publish_batch_signals(
        self,
        signals: list[Dict[str, Any]],
    ):
        """
        批量发布信号

        Args:
            signals: 信号列表，每个信号包含 user_id, symbol, trade_type, signal_data
        """
        for signal in signals:
            try:
                await self.publish_signal(
                    user_id=signal["user_id"],
                    symbol=signal["symbol"],
                    trade_type=signal["trade_type"],
                    signal_data=signal["signal_data"],
                )
            except Exception as e:
                logger.error(f"Failed to publish signal in batch: {e}")
                # 继续发布其他信号

    def _build_subject(self, user_id: str, symbol: str, trade_type: str) -> str:
        """
        构建 NATS 主题

        格式: strategy.signals.{userId}.{symbol}.{tradeType}
        例如: strategy.signals.123.BTC-USDT.spot
        """
        return f"strategy.signals.{user_id}.{symbol}.{trade_type}"

    def _build_message(
        self,
        user_id: str,
        symbol: str,
        trade_type: str,
        signal_data: Dict[str, Any],
    ) -> Dict[str, Any]:
        """
        构建信号消息体

        Args:
            user_id: 用户ID
            symbol: 交易对
            trade_type: 交易类型
            signal_data: 信号数据（包含 action, price, confidence, indicators 等）

        Returns:
            完整的消息体
        """
        return {
            "user_id": user_id,
            "symbol": symbol,
            "trade_type": trade_type,
            "signal_id": signal_data.get("signal_id"),
            "subscription_id": signal_data.get("subscription_id"),
            "strategy_id": signal_data.get("strategy_id"),
            "action": signal_data.get("action"),  # BUY, SELL, HOLD
            "price": signal_data.get("price"),
            "confidence": signal_data.get("confidence", 0.0),
            "indicators": signal_data.get("indicators", {}),
            "timestamp": signal_data.get("timestamp") or datetime.utcnow().isoformat(),
            "metadata": signal_data.get("metadata", {}),
        }

    async def publish_instance_status(
        self, instance_key: str, status: str, metadata: Optional[Dict[str, Any]] = None
    ):
        """
        发布实例状态变更

        Args:
            instance_key: 实例Key
            status: 状态（running, stopped, error）
            metadata: 元数据
        """
        try:
            # 构建主题
            # 格式: strategy.instance.{instanceKey}.status
            subject = f"strategy.instance.{instance_key}.status"

            # 构建消息
            message = {
                "instance_key": instance_key,
                "status": status,
                "timestamp": datetime.utcnow().isoformat(),
                "metadata": metadata or {},
            }

            # 发布
            payload = json.dumps(message).encode("utf-8")
            await self.nats.publish(subject, payload)

            logger.info(f"Published instance status: {instance_key} -> {status}")

        except Exception as e:
            logger.error(f"Failed to publish instance status: {e}")
