"""
策略执行器基类
"""
import asyncio
import logging
from typing import Dict, Any, Optional
from datetime import datetime

logger = logging.getLogger(__name__)


class StrategyExecutor:
    """策略执行器基类"""

    def __init__(
        self,
        strategy_id: str,
        symbol: str,
        exchange: str,
        trade_type: str,
        parameters: Optional[Dict[str, Any]] = None,
        signal_publisher=None,  # SignalPublisher 实例
    ):
        """
        初始化策略执行器

        Args:
            strategy_id: 策略ID
            symbol: 交易对
            exchange: 交易所
            trade_type: 交易类型
            parameters: 策略参数
            signal_publisher: 信号发布器（可选）
        """
        self.strategy_id = strategy_id
        self.symbol = symbol
        self.exchange = exchange
        self.trade_type = trade_type
        self.parameters = parameters or {}
        self.signal_publisher = signal_publisher

        self.is_running = False
        self.last_candle_time: Optional[datetime] = None
        self.candle_buffer = []  # K线缓冲区

        logger.info(
            f"StrategyExecutor initialized: {strategy_id} on {symbol} ({exchange}/{trade_type})"
        )

    async def on_candle(self, msg: Any) -> None:
        """
        K线数据回调

        当收到新的K线数据时触发

        Args:
            msg: NATS 消息对象
        """
        try:
            # 解析 K线数据（占位符实现）
            candle_data = self._parse_candle_message(msg)

            if not candle_data:
                return

            self.last_candle_time = candle_data.get("timestamp")

            logger.debug(
                f"Received candle: {self.symbol} at {self.last_candle_time}"
            )

            # 更新K线缓冲区
            self.candle_buffer.append(candle_data)
            if len(self.candle_buffer) > 200:  # 保留最近200根K线
                self.candle_buffer.pop(0)

            # 执行策略逻辑
            signals = await self.execute_strategy(candle_data)

            # 发布信号
            if signals:
                await self.publish_signals(signals)

        except Exception as e:
            logger.error(f"Error in on_candle: {e}", exc_info=True)

    async def execute_strategy(self, candle: Dict[str, Any]) -> Optional[list]:
        """
        执行策略逻辑

        子类应重写此方法实现具体策略

        Args:
            candle: K线数据

        Returns:
            交易信号列表（如果有）
        """
        # 占位符实现
        # 实际策略逻辑应在子类中实现
        logger.debug(f"execute_strategy called for {self.strategy_id}")
        return None

    async def publish_signals(self, signals: list) -> None:
        """
        发布交易信号到 NATS

        Args:
            signals: 信号列表
        """
        if not self.signal_publisher:
            logger.warning("No signal publisher configured, skipping signal publication")
            return

        logger.info(f"Publishing {len(signals)} signals for {self.symbol}")

        for signal in signals:
            try:
                await self.signal_publisher.publish_signal(
                    user_id=signal.get("user_id"),
                    symbol=self.symbol,
                    trade_type=self.trade_type,
                    signal_data=signal,
                )
            except Exception as e:
                logger.error(f"Failed to publish signal: {e}")

    async def load_historical_context(
        self, since: Optional[datetime] = None
    ) -> None:
        """
        加载历史上下文数据

        用于策略恢复时初始化状态

        Args:
            since: 起始时间
        """
        logger.info(f"Loading historical context for {self.symbol} since {since}")
        # 占位符实现
        # 实际应从数据库加载历史K线数据
        pass

    async def stop(self) -> None:
        """停止执行器"""
        logger.info(f"Stopping executor for {self.symbol}")
        self.is_running = False
        self.candle_buffer.clear()

    def _parse_candle_message(self, msg: Any) -> Optional[Dict[str, Any]]:
        """
        解析 NATS K线消息

        Args:
            msg: NATS 消息

        Returns:
            解析后的K线数据
        """
        # 占位符实现
        # 实际应解析 NATS 消息体
        try:
            import json

            data = json.loads(msg.data.decode())
            return {
                "timestamp": datetime.fromtimestamp(data.get("timestamp", 0) / 1000),
                "open": float(data.get("open", 0)),
                "high": float(data.get("high", 0)),
                "low": float(data.get("low", 0)),
                "close": float(data.get("close", 0)),
                "volume": float(data.get("volume", 0)),
            }
        except Exception as e:
            logger.error(f"Failed to parse candle message: {e}")
            return None
