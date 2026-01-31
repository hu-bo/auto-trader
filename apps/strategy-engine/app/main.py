"""
Strategy Engine 主应用入口
"""
import asyncio
import logging
import signal
import sys

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)


class StrategyEngineApp:
    """策略引擎应用"""

    def __init__(self):
        self.db_pool = None
        self.nats_client = None
        self.strategy_manager = None
        self.recovery_manager = None
        self.grpc_server = None
        self.shutdown_event = asyncio.Event()

    async def start(self):
        """启动应用"""
        try:
            logger.info("=== Starting Strategy Engine ===")

            # 1. 初始化数据库连接池
            logger.info("Initializing database connection pool...")
            self.db_pool = await self._init_database()

            # 2. 初始化 NATS 客户端
            logger.info("Initializing NATS client...")
            self.nats_client = await self._init_nats()

            # 3. 初始化策略管理器
            logger.info("Initializing StrategyManager...")
            from app.core import StrategyManager

            self.strategy_manager = StrategyManager(self.db_pool, self.nats_client)

            # 4. 初始化恢复管理器并执行恢复
            logger.info("Initializing RecoveryManager...")
            from app.core import RecoveryManager

            self.recovery_manager = RecoveryManager(
                self.strategy_manager, self.db_pool
            )

            logger.info("Starting recovery process...")
            recovery_result = await self.recovery_manager.recover_on_startup()
            logger.info(f"Recovery completed: {recovery_result}")

            # 5. 启动 gRPC 服务器
            logger.info("Starting gRPC server...")
            from app.grpc.server import GrpcServer

            self.grpc_server = GrpcServer(
                self.strategy_manager, host="0.0.0.0", port=50051
            )

            # 在后台启动 gRPC 服务器
            grpc_task = asyncio.create_task(self.grpc_server.start())

            logger.info("=== Strategy Engine started successfully ===")

            # 注册信号处理器
            self._register_signal_handlers()

            # 等待关闭信号
            await self.shutdown_event.wait()

            # 优雅关闭
            await self.shutdown()

        except Exception as e:
            logger.error(f"Failed to start Strategy Engine: {e}", exc_info=True)
            sys.exit(1)

    async def shutdown(self):
        """优雅关闭"""
        logger.info("=== Shutting down Strategy Engine ===")

        # 1. 停止 gRPC 服务器
        if self.grpc_server:
            logger.info("Stopping gRPC server...")
            await self.grpc_server.stop()

        # 2. 停止所有策略实例
        if self.strategy_manager:
            logger.info("Stopping all strategy instances...")
            instances = await self.strategy_manager.get_all_instances()
            for instance_key, instance_info in instances.items():
                try:
                    await instance_info.executor.stop()
                    logger.info(f"Stopped instance: {instance_key}")
                except Exception as e:
                    logger.error(f"Failed to stop instance {instance_key}: {e}")

        # 3. 关闭 NATS 连接
        if self.nats_client:
            logger.info("Closing NATS connection...")
            await self.nats_client.close()

        # 4. 关闭数据库连接池
        if self.db_pool:
            logger.info("Closing database connection pool...")
            await self.db_pool.close()

        logger.info("=== Strategy Engine shutdown complete ===")

    def _register_signal_handlers(self):
        """注册信号处理器"""

        def signal_handler(sig):
            logger.info(f"Received signal {sig}, initiating shutdown...")
            self.shutdown_event.set()

        # 注册 SIGINT 和 SIGTERM
        loop = asyncio.get_event_loop()
        for sig in (signal.SIGINT, signal.SIGTERM):
            loop.add_signal_handler(sig, lambda s=sig: signal_handler(s))

    async def _init_database(self):
        """初始化数据库连接池（占位符）"""
        # TODO: 实现实际的数据库连接逻辑
        # import asyncpg
        # pool = await asyncpg.create_pool(
        #     host='localhost',
        #     port=5432,
        #     user='postgres',
        #     password='password',
        #     database='strategy_engine',
        #     min_size=5,
        #     max_size=20,
        # )
        # return pool

        logger.warning("Using placeholder database pool")

        class PlaceholderPool:
            async def fetch(self, query, *args):
                return []

            async def fetchrow(self, query, *args):
                return None

            async def execute(self, query, *args):
                pass

            async def close(self):
                pass

        return PlaceholderPool()

    async def _init_nats(self):
        """初始化 NATS 客户端"""
        from app.nats import NATSClientWrapper

        # 从环境变量读取配置（可选）
        import os

        nats_servers = os.getenv("NATS_SERVERS", "nats://localhost:4222")

        # 创建 NATS 客户端
        nats_client = NATSClientWrapper(
            servers=nats_servers,
            name="strategy-engine",
            max_reconnect_attempts=-1,  # 无限重试
            reconnect_time_wait=2,  # 2秒重连间隔
        )

        # 连接到 NATS
        try:
            await nats_client.connect()
            logger.info(f"NATS client initialized and connected to {nats_servers}")
        except Exception as e:
            logger.warning(f"Failed to connect to NATS, using placeholder mode: {e}")
            # 如果连接失败，客户端会自动使用占位符模式

        return nats_client


async def main():
    """主函数"""
    app = StrategyEngineApp()
    await app.start()


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        logger.info("Received keyboard interrupt")
    except Exception as e:
        logger.error(f"Application error: {e}", exc_info=True)
        sys.exit(1)
