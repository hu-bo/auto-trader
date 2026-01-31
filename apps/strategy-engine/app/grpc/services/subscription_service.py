"""
订阅服务 gRPC 实现
"""
import json
import logging
from typing import Any
from datetime import datetime

import grpc
from google.protobuf.timestamp_pb2 import Timestamp
from google.protobuf.empty_pb2 import Empty

logger = logging.getLogger(__name__)


class SubscriptionServiceServicer:
    """SubscriptionService gRPC 服务实现"""

    def __init__(self, strategy_manager):
        """
        初始化服务

        Args:
            strategy_manager: StrategyManager 实例
        """
        self.manager = strategy_manager
        logger.info("SubscriptionServiceServicer initialized")

    async def Subscribe(self, request, context):
        """
        订阅策略

        Args:
            request: SubscribeRequest
            context: gRPC context

        Returns:
            SubscriptionResponse
        """
        try:
            logger.info(
                f"Subscribe request: user={request.user_id}, "
                f"subscription={request.subscription_id}, "
                f"strategy={request.strategy_id}, symbol={request.symbol}"
            )

            # 解析参数（JSON 字符串 → Dict）
            parameters = {}
            if request.parameters:
                try:
                    parameters = json.loads(request.parameters)
                except json.JSONDecodeError as e:
                    context.abort(
                        grpc.StatusCode.INVALID_ARGUMENT,
                        f"Invalid parameters JSON: {e}",
                    )

            # 调用 StrategyManager 订阅
            result = await self.manager.subscribe(
                user_id=request.user_id,
                subscription_id=int(request.subscription_id),
                strategy_id=request.strategy_id,
                symbol=request.symbol,
                exchange=request.exchange,
                trade_type=request.trade_type,
                period=request.period,
                parameters=parameters,
            )

            # 构造响应
            response = self._build_subscription_response(result)

            logger.info(
                f"Subscribe successful: subscription={request.subscription_id}, "
                f"instance_key={result['instance_key']}, "
                f"ref_count={result['ref_count']}"
            )

            return response

        except Exception as e:
            logger.error(f"Subscribe failed: {e}", exc_info=True)
            context.abort(grpc.StatusCode.INTERNAL, f"Subscribe failed: {str(e)}")

    async def Unsubscribe(self, request, context):
        """
        取消订阅

        Args:
            request: UnsubscribeRequest
            context: gRPC context

        Returns:
            Empty
        """
        try:
            logger.info(
                f"Unsubscribe request: subscription={request.subscription_id}, "
                f"instance_key={request.instance_key}"
            )

            # 调用 StrategyManager 取消订阅
            await self.manager.unsubscribe(
                subscription_id=int(request.subscription_id),
                instance_key=request.instance_key,
            )

            logger.info(
                f"Unsubscribe successful: subscription={request.subscription_id}"
            )

            return Empty()

        except Exception as e:
            logger.error(f"Unsubscribe failed: {e}", exc_info=True)
            context.abort(grpc.StatusCode.INTERNAL, f"Unsubscribe failed: {str(e)}")

    async def GetSubscription(self, request, context):
        """
        获取订阅状态

        Args:
            request: GetSubscriptionRequest
            context: gRPC context

        Returns:
            SubscriptionResponse
        """
        try:
            logger.info(f"GetSubscription request: {request.subscription_id}")

            # TODO: 从数据库查询订阅信息
            # 这里暂时返回占位响应
            context.abort(
                grpc.StatusCode.UNIMPLEMENTED, "GetSubscription not implemented yet"
            )

        except Exception as e:
            logger.error(f"GetSubscription failed: {e}", exc_info=True)
            context.abort(
                grpc.StatusCode.INTERNAL, f"GetSubscription failed: {str(e)}"
            )

    async def ListSubscriptions(self, request, context):
        """
        列出用户订阅

        Args:
            request: ListSubscriptionsRequest
            context: gRPC context

        Returns:
            ListSubscriptionsResponse
        """
        try:
            logger.info(f"ListSubscriptions request: user={request.user_id}")

            # TODO: 从数据库查询用户订阅列表
            # 这里暂时返回占位响应
            context.abort(
                grpc.StatusCode.UNIMPLEMENTED, "ListSubscriptions not implemented yet"
            )

        except Exception as e:
            logger.error(f"ListSubscriptions failed: {e}", exc_info=True)
            context.abort(
                grpc.StatusCode.INTERNAL, f"ListSubscriptions failed: {str(e)}"
            )

    async def GetInstanceStats(self, request, context):
        """
        获取实例统计信息

        Args:
            request: Empty
            context: gRPC context

        Returns:
            InstanceStatsResponse
        """
        try:
            logger.info("GetInstanceStats request")

            # 调用 StrategyManager 获取统计
            stats = await self.manager.get_instance_stats()

            # 构造响应（需要导入生成的 pb2 模块）
            # response = InstanceStatsResponse(
            #     total_instances=stats['total_instances'],
            #     running_instances=stats['running_instances'],
            #     stopped_instances=stats['stopped_instances'],
            #     error_instances=stats['error_instances'],
            #     total_subscriptions=stats['total_subscriptions'],
            #     instances_by_exchange=stats['instances_by_exchange'],
            #     instances_by_strategy=stats['instances_by_strategy'],
            # )

            # 占位符返回
            logger.info(f"Instance stats: {stats}")
            context.abort(
                grpc.StatusCode.UNIMPLEMENTED,
                "GetInstanceStats not fully implemented (proto not generated yet)",
            )

        except Exception as e:
            logger.error(f"GetInstanceStats failed: {e}", exc_info=True)
            context.abort(
                grpc.StatusCode.INTERNAL, f"GetInstanceStats failed: {str(e)}"
            )

    def _build_subscription_response(self, result: dict) -> Any:
        """
        构建 SubscriptionResponse

        Args:
            result: StrategyManager.subscribe() 返回的结果

        Returns:
            SubscriptionResponse proto message
        """
        # 占位符实现
        # 实际需要导入生成的 pb2 模块并创建 proto 消息
        #
        # from app.grpc.generated import strategy_subscription_pb2
        #
        # response = strategy_subscription_pb2.SubscriptionResponse(
        #     subscription_id=str(result['subscription_id']),
        #     user_id=result.get('user_id', ''),
        #     instance_key=result['instance_key'],
        #     status=strategy_subscription_pb2.SUBSCRIPTION_STATUS_RUNNING,
        #     ref_count=result['ref_count'],
        #     nats_subject=result['nats_subject'],
        # )
        #
        # return response

        # 临时返回字典（需要在 proto 生成后替换）
        logger.warning("Using placeholder response (proto not generated yet)")

        class PlaceholderResponse:
            def __init__(self, data):
                self.subscription_id = str(data["subscription_id"])
                self.instance_key = data["instance_key"]
                self.status = "RUNNING"
                self.ref_count = data["ref_count"]
                self.nats_subject = data["nats_subject"]

        return PlaceholderResponse(result)

    def _timestamp_to_proto(self, dt: datetime) -> Timestamp:
        """将 Python datetime 转换为 protobuf Timestamp"""
        ts = Timestamp()
        ts.FromDatetime(dt)
        return ts
