"""
NATS 客户端
支持自动重连、订阅管理、消息发布
"""
import asyncio
import logging
from typing import Dict, Callable, Optional, Any
from dataclasses import dataclass

try:
    import nats
    from nats.aio.client import Client as NATSClient
    from nats.aio.msg import Msg
    NATS_AVAILABLE = True
except ImportError:
    NATS_AVAILABLE = False
    NATSClient = None
    Msg = None
    logging.warning("nats-py not installed, using placeholder implementation")

logger = logging.getLogger(__name__)


@dataclass
class SubscriptionInfo:
    """订阅信息"""
    subject: str
    queue_group: Optional[str]
    callback: Callable
    subscription_id: int  # NATS subscription ID


class NATSClientWrapper:
    """NATS 客户端包装器"""

    def __init__(
        self,
        servers: str = "nats://localhost:4222",
        name: str = "strategy-engine",
        max_reconnect_attempts: int = -1,  # -1 表示无限重试
        reconnect_time_wait: int = 2,  # 重连间隔（秒）
    ):
        """
        初始化 NATS 客户端

        Args:
            servers: NATS 服务器地址（可以是逗号分隔的多个地址）
            name: 客户端名称
            max_reconnect_attempts: 最大重连次数（-1 为无限）
            reconnect_time_wait: 重连间隔（秒）
        """
        self.servers = servers.split(",") if "," in servers else [servers]
        self.name = name
        self.max_reconnect_attempts = max_reconnect_attempts
        self.reconnect_time_wait = reconnect_time_wait

        self.nc: Optional[NATSClient] = None
        self.is_connected = False
        self.subscriptions: Dict[str, SubscriptionInfo] = {}  # subject -> SubscriptionInfo
        self._lock = asyncio.Lock()

        logger.info(f"NATSClientWrapper initialized: servers={self.servers}, name={name}")

    async def connect(self):
        """连接到 NATS 服务器"""
        if not NATS_AVAILABLE:
            logger.warning("NATS not available, using placeholder mode")
            self.is_connected = True
            return

        try:
            logger.info(f"Connecting to NATS: {self.servers}")

            self.nc = await nats.connect(
                servers=self.servers,
                name=self.name,
                max_reconnect_attempts=self.max_reconnect_attempts,
                reconnect_time_wait=self.reconnect_time_wait,
                # 回调函数
                error_cb=self._on_error,
                disconnected_cb=self._on_disconnected,
                reconnected_cb=self._on_reconnected,
                closed_cb=self._on_closed,
            )

            self.is_connected = True
            logger.info(f"Connected to NATS successfully: {self.nc.connected_url}")

        except Exception as e:
            logger.error(f"Failed to connect to NATS: {e}")
            raise

    async def subscribe(
        self,
        subject: str,
        queue_group: Optional[str] = None,
        callback: Optional[Callable] = None,
    ) -> int:
        """
        订阅 NATS 主题

        Args:
            subject: 订阅主题（支持通配符，如 candle.*.BTC-USDT）
            queue_group: 队列组名称（用于负载均衡）
            callback: 消息回调函数

        Returns:
            订阅ID
        """
        async with self._lock:
            if not NATS_AVAILABLE:
                logger.info(f"[Placeholder] Subscribe: {subject} (queue={queue_group})")
                # 占位符模式
                self.subscriptions[subject] = SubscriptionInfo(
                    subject=subject,
                    queue_group=queue_group,
                    callback=callback,
                    subscription_id=len(self.subscriptions),
                )
                return len(self.subscriptions) - 1

            if not self.is_connected or not self.nc:
                raise RuntimeError("Not connected to NATS")

            try:
                logger.info(f"Subscribing to: {subject} (queue={queue_group})")

                # 包装回调函数
                async def wrapped_callback(msg: Msg):
                    try:
                        if callback:
                            await callback(msg)
                    except Exception as e:
                        logger.error(f"Error in subscription callback for {subject}: {e}")

                # 订阅主题
                if queue_group:
                    sub = await self.nc.subscribe(
                        subject, queue=queue_group, cb=wrapped_callback
                    )
                else:
                    sub = await self.nc.subscribe(subject, cb=wrapped_callback)

                # 记录订阅信息
                self.subscriptions[subject] = SubscriptionInfo(
                    subject=subject,
                    queue_group=queue_group,
                    callback=callback,
                    subscription_id=sub._id,
                )

                logger.info(f"Subscribed to {subject} successfully (sid={sub._id})")
                return sub._id

            except Exception as e:
                logger.error(f"Failed to subscribe to {subject}: {e}")
                raise

    async def unsubscribe(self, subject: str):
        """
        取消订阅

        Args:
            subject: 订阅主题
        """
        async with self._lock:
            if subject not in self.subscriptions:
                logger.warning(f"Subject {subject} not found in subscriptions")
                return

            if not NATS_AVAILABLE:
                logger.info(f"[Placeholder] Unsubscribe: {subject}")
                del self.subscriptions[subject]
                return

            if not self.is_connected or not self.nc:
                logger.warning("Not connected to NATS, removing subscription from cache")
                del self.subscriptions[subject]
                return

            try:
                sub_info = self.subscriptions[subject]
                logger.info(f"Unsubscribing from: {subject} (sid={sub_info.subscription_id})")

                # 取消订阅
                await self.nc.unsubscribe(sub_info.subscription_id)

                # 移除订阅记录
                del self.subscriptions[subject]

                logger.info(f"Unsubscribed from {subject} successfully")

            except Exception as e:
                logger.error(f"Failed to unsubscribe from {subject}: {e}")
                # 即使失败也移除记录
                del self.subscriptions[subject]

    async def publish(
        self, subject: str, payload: bytes, headers: Optional[Dict[str, str]] = None
    ):
        """
        发布消息到 NATS

        Args:
            subject: 发布主题
            payload: 消息内容（字节）
            headers: 消息头（可选）
        """
        if not NATS_AVAILABLE:
            logger.debug(f"[Placeholder] Publish to {subject}: {len(payload)} bytes")
            return

        if not self.is_connected or not self.nc:
            raise RuntimeError("Not connected to NATS")

        try:
            if headers:
                await self.nc.publish(subject, payload, headers=headers)
            else:
                await self.nc.publish(subject, payload)

            logger.debug(f"Published to {subject}: {len(payload)} bytes")

        except Exception as e:
            logger.error(f"Failed to publish to {subject}: {e}")
            raise

    async def request(
        self, subject: str, payload: bytes, timeout: float = 1.0
    ) -> Optional[Msg]:
        """
        请求-响应模式

        Args:
            subject: 请求主题
            payload: 请求内容
            timeout: 超时时间（秒）

        Returns:
            响应消息
        """
        if not NATS_AVAILABLE:
            logger.debug(f"[Placeholder] Request to {subject}")
            return None

        if not self.is_connected or not self.nc:
            raise RuntimeError("Not connected to NATS")

        try:
            response = await self.nc.request(subject, payload, timeout=timeout)
            logger.debug(f"Received response from {subject}")
            return response

        except Exception as e:
            logger.error(f"Request to {subject} failed: {e}")
            raise

    async def close(self):
        """关闭 NATS 连接"""
        if not NATS_AVAILABLE:
            logger.info("[Placeholder] Closing NATS connection")
            self.is_connected = False
            return

        if self.nc:
            try:
                logger.info("Closing NATS connection...")
                await self.nc.close()
                self.is_connected = False
                logger.info("NATS connection closed")
            except Exception as e:
                logger.error(f"Error closing NATS connection: {e}")

    async def drain(self):
        """优雅关闭（等待所有消息处理完成）"""
        if not NATS_AVAILABLE:
            logger.info("[Placeholder] Draining NATS connection")
            return

        if self.nc:
            try:
                logger.info("Draining NATS connection...")
                await self.nc.drain()
                self.is_connected = False
                logger.info("NATS connection drained")
            except Exception as e:
                logger.error(f"Error draining NATS connection: {e}")

    # ========== 回调函数 ==========

    async def _on_error(self, error):
        """错误回调"""
        logger.error(f"NATS error: {error}")

    async def _on_disconnected(self):
        """断开连接回调"""
        logger.warning("NATS disconnected, will auto-reconnect...")
        self.is_connected = False

    async def _on_reconnected(self):
        """重连成功回调"""
        logger.info(f"NATS reconnected to: {self.nc.connected_url}")
        self.is_connected = True

        # 重新订阅所有主题
        logger.info(f"Re-subscribing to {len(self.subscriptions)} subjects...")
        await self._resubscribe_all()

    async def _on_closed(self):
        """连接关闭回调"""
        logger.info("NATS connection closed")
        self.is_connected = False

    async def _resubscribe_all(self):
        """重新订阅所有主题（重连后调用）"""
        if not self.nc or not self.is_connected:
            return

        # 复制订阅列表（避免迭代时修改）
        subs_to_restore = list(self.subscriptions.items())

        for subject, sub_info in subs_to_restore:
            try:
                logger.info(f"Re-subscribing to: {subject}")

                # 包装回调函数
                async def wrapped_callback(msg: Msg):
                    try:
                        if sub_info.callback:
                            await sub_info.callback(msg)
                    except Exception as e:
                        logger.error(f"Error in subscription callback for {subject}: {e}")

                # 重新订阅
                if sub_info.queue_group:
                    new_sub = await self.nc.subscribe(
                        subject, queue=sub_info.queue_group, cb=wrapped_callback
                    )
                else:
                    new_sub = await self.nc.subscribe(subject, cb=wrapped_callback)

                # 更新订阅ID
                self.subscriptions[subject] = SubscriptionInfo(
                    subject=subject,
                    queue_group=sub_info.queue_group,
                    callback=sub_info.callback,
                    subscription_id=new_sub._id,
                )

                logger.info(f"Re-subscribed to {subject} (new sid={new_sub._id})")

            except Exception as e:
                logger.error(f"Failed to re-subscribe to {subject}: {e}")

    # ========== 辅助方法 ==========

    def get_subscriptions(self) -> Dict[str, SubscriptionInfo]:
        """获取所有订阅信息"""
        return self.subscriptions.copy()

    @property
    def connected(self) -> bool:
        """是否已连接"""
        return self.is_connected

    @property
    def stats(self) -> Dict[str, Any]:
        """获取统计信息"""
        return {
            "connected": self.is_connected,
            "subscriptions_count": len(self.subscriptions),
            "servers": self.servers,
        }
