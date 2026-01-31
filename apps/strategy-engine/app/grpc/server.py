"""
gRPC 服务器
"""
import asyncio
import logging
from concurrent import futures

import grpc

logger = logging.getLogger(__name__)


class GrpcServer:
    """gRPC 服务器管理器"""

    def __init__(self, strategy_manager, host="0.0.0.0", port=50051):
        """
        初始化 gRPC 服务器

        Args:
            strategy_manager: StrategyManager 实例
            host: 监听主机
            port: 监听端口
        """
        self.strategy_manager = strategy_manager
        self.host = host
        self.port = port
        self.server = None
        logger.info(f"GrpcServer initialized: {host}:{port}")

    async def start(self):
        """
        启动 gRPC 服务器

        注意：需要先生成 proto 代码才能完全启用
        """
        try:
            # TODO: 生成 proto 代码后取消注释
            # from app.grpc.generated import strategy_subscription_pb2_grpc
            # from app.grpc.services import SubscriptionServiceServicer

            # 创建 gRPC 服务器
            self.server = grpc.aio.server(
                futures.ThreadPoolExecutor(max_workers=10),
                options=[
                    ("grpc.max_send_message_length", 100 * 1024 * 1024),  # 100MB
                    ("grpc.max_receive_message_length", 100 * 1024 * 1024),  # 100MB
                ],
            )

            # 注册服务
            # servicer = SubscriptionServiceServicer(self.strategy_manager)
            # strategy_subscription_pb2_grpc.add_SubscriptionServiceServicer_to_server(
            #     servicer, self.server
            # )

            # 绑定端口
            listen_addr = f"{self.host}:{self.port}"
            self.server.add_insecure_port(listen_addr)

            # 启动服务器
            await self.server.start()
            logger.info(f"gRPC server started on {listen_addr}")

            # 等待终止信号
            await self.server.wait_for_termination()

        except Exception as e:
            logger.error(f"Failed to start gRPC server: {e}")
            raise

    async def stop(self, grace_period=5):
        """
        停止 gRPC 服务器

        Args:
            grace_period: 优雅关闭等待时间（秒）
        """
        if self.server:
            logger.info(f"Stopping gRPC server (grace period: {grace_period}s)")
            await self.server.stop(grace_period)
            logger.info("gRPC server stopped")


async def serve(strategy_manager, host="0.0.0.0", port=50051):
    """
    启动 gRPC 服务的便捷函数

    Args:
        strategy_manager: StrategyManager 实例
        host: 监听主机
        port: 监听端口
    """
    server = GrpcServer(strategy_manager, host, port)
    await server.start()


# 占位符：生成 proto 代码的脚本
"""
生成 gRPC 代码的步骤：

1. 安装依赖
   pip install grpcio-tools

2. 生成 Python 代码
   python -m grpc_tools.protoc \
     -I../../../packages/contracts/proto \
     --python_out=./app/grpc/generated \
     --grpc_python_out=./app/grpc/generated \
     ../../../packages/contracts/proto/strategy_subscription.proto

3. 创建 __init__.py
   touch app/grpc/generated/__init__.py

4. 在 subscription_service.py 中导入生成的模块
   from app.grpc.generated import strategy_subscription_pb2
   from app.grpc.generated import strategy_subscription_pb2_grpc

5. 在 server.py 中启用服务注册（取消上面的注释）
"""
