from __future__ import annotations

import sys
from collections import Counter
from pathlib import Path

import grpc
from google.protobuf import empty_pb2, timestamp_pb2
from hquant_logger import create_logger

# ---------------------------------------------------------------------------
# Import generated protobuf / gRPC stubs.
#
# The generated files live outside of the strategy-engine package tree, in
# packages/contracts/dist/python/.  That directory contains an __init__.py
# and uses relative imports internally (e.g. strategy_subscription_pb2_grpc
# does ``from . import strategy_subscription_pb2``).  To honour those
# relative imports we add the *parent* directory (dist/) to sys.path and
# then import the ``python`` package.
# ---------------------------------------------------------------------------
_proto_dist = str(
    Path(__file__).resolve().parents[4] / "packages" / "contracts" / "dist"
)
if _proto_dist not in sys.path:
    sys.path.insert(0, _proto_dist)

from python import strategy_subscription_pb2 as pb2  # noqa: E402
from python import strategy_subscription_pb2_grpc as pb2_grpc  # noqa: E402

from app.core.strategy_manager import StrategyManager
from app.models.strategy import CreateStrategyRequest, DeleteStrategyRequest
from app.nats.topics import candle_subject

logger = create_logger("strategy-engine").child("grpc.subscription")


def _make_instance_key(
    strategy_id: int,
    exchange: str,
    trade_type: str,
    symbol: str,
    period: str,
) -> str:
    """Build the canonical instance key used to identify a running strategy."""
    return f"{strategy_id}:{exchange}:{trade_type}:{symbol}:{period}"


def _parse_instance_key(instance_key: str) -> dict[str, str]:
    """Parse an instance key back into its constituent parts.

    Returns a dict with keys: strategy_id, exchange, trade_type, symbol, period.
    Raises ``ValueError`` if the format is unexpected.
    """
    parts = instance_key.split(":")
    if len(parts) != 5:
        raise ValueError(f"Invalid instance_key format: {instance_key}")
    return {
        "strategy_id": parts[0],
        "exchange": parts[1],
        "trade_type": parts[2],
        "symbol": parts[3],
        "period": parts[4],
    }


def _datetime_to_timestamp(dt) -> timestamp_pb2.Timestamp:
    """Convert a Python datetime to a protobuf Timestamp."""
    ts = timestamp_pb2.Timestamp()
    ts.FromDatetime(dt)
    return ts


class SubscriptionServiceImpl(pb2_grpc.SubscriptionServiceServicer):
    """Concrete implementation of the SubscriptionService gRPC servicer.

    Delegates to :class:`StrategyManager` for all strategy lifecycle
    operations and translates between protobuf messages and internal
    Pydantic models.
    """

    def __init__(
        self,
        manager: StrategyManager,
        candle_subject_prefix: str,
    ) -> None:
        super().__init__()
        self._manager = manager
        self._candle_subject_prefix = candle_subject_prefix

    # ------------------------------------------------------------------
    # Subscribe
    # ------------------------------------------------------------------

    async def Subscribe(self, request, context):  # noqa: N802
        """Create and start a new strategy instance."""
        logger.info(
            "Subscribe request",
            subscription_id=request.subscription_id,
            strategy_id=request.strategy_id,
            strategy_name=request.strategy_name,
            symbol=request.symbol,
            exchange=request.exchange,
            trade_type=request.trade_type,
            period=request.period or "15m",
        )

        try:
            req = CreateStrategyRequest(
                strategy_id=int(request.strategy_id),
                strategy_name=request.strategy_name,
                code=request.code,
                symbol=request.symbol,
                exchange=request.exchange,
                trade_type=request.trade_type,
                period=request.period or "15m",
            )
        except (ValueError, TypeError) as exc:
            await context.abort(
                grpc.StatusCode.INVALID_ARGUMENT,
                f"Invalid request fields: {exc}",
            )

        try:
            info = await self._manager.create_strategy(req)
        except ValueError as exc:
            logger.warning("Subscribe already exists", err=str(exc))
            await context.abort(grpc.StatusCode.ALREADY_EXISTS, str(exc))
        except Exception as exc:
            logger.error("Subscribe failed", err=str(exc), exc_info=True)
            await context.abort(
                grpc.StatusCode.INTERNAL,
                f"Failed to create strategy: {exc}",
            )

        period = request.period or "15m"
        instance_key = _make_instance_key(
            int(request.strategy_id),
            request.exchange,
            request.trade_type,
            request.symbol,
            period,
        )
        nats_subj = candle_subject(
            self._candle_subject_prefix,
            request.exchange,
            request.trade_type,
            request.symbol,
            period,
        )

        logger.info(
            "Subscribe success",
            instance_key=instance_key,
            nats_subject=nats_subj,
            strategy_id=request.strategy_id,
            symbol=request.symbol,
        )

        return pb2.SubscriptionResponse(
            subscription_id=request.subscription_id,
            user_id=request.user_id,
            instance_key=instance_key,
            status=pb2.SUBSCRIPTION_STATUS_RUNNING,
            ref_count=1,
            nats_subject=nats_subj,
            started_at=_datetime_to_timestamp(info.created_at),
        )

    # ------------------------------------------------------------------
    # Unsubscribe
    # ------------------------------------------------------------------

    async def Unsubscribe(self, request, context):  # noqa: N802
        """Stop and remove a running strategy instance."""
        logger.info(
            "Unsubscribe request",
            subscription_id=request.subscription_id,
            instance_key=request.instance_key,
        )

        try:
            parts = _parse_instance_key(request.instance_key)
        except ValueError as exc:
            await context.abort(grpc.StatusCode.INVALID_ARGUMENT, str(exc))

        try:
            req = DeleteStrategyRequest(
                strategy_id=int(parts["strategy_id"]),
                exchange=parts["exchange"],
                trade_type=parts["trade_type"],
                symbol=parts["symbol"],
                period=parts["period"],
            )
            await self._manager.delete_strategy(req)
        except ValueError as exc:
            await context.abort(grpc.StatusCode.NOT_FOUND, str(exc))
        except Exception as exc:
            logger.error("Unsubscribe failed", err=str(exc))
            await context.abort(
                grpc.StatusCode.INTERNAL,
                f"Failed to delete strategy: {exc}",
            )

        return empty_pb2.Empty()

    # ------------------------------------------------------------------
    # GetSubscription
    # ------------------------------------------------------------------

    async def GetSubscription(self, request, context):  # noqa: N802
        """Look up a single subscription by its ID.

        Currently not fully implemented -- subscription_id does not map
        directly to a strategy key.  Returns NOT_FOUND for all requests.
        """
        await context.abort(
            grpc.StatusCode.NOT_FOUND,
            f"Subscription {request.subscription_id} not found",
        )

    # ------------------------------------------------------------------
    # ListSubscriptions
    # ------------------------------------------------------------------

    async def ListSubscriptions(self, request, context):  # noqa: N802
        """Return all running strategy instances as subscriptions."""
        try:
            strategies = await self._manager.list_strategies()
        except Exception as exc:
            logger.error("ListSubscriptions failed", err=str(exc))
            await context.abort(
                grpc.StatusCode.INTERNAL,
                f"Failed to list strategies: {exc}",
            )

        subscriptions = []
        for info in strategies:
            instance_key = _make_instance_key(
                info.strategy_id,
                info.exchange,
                info.trade_type,
                info.symbol,
                info.period,
            )
            nats_subj = candle_subject(
                self._candle_subject_prefix,
                info.exchange,
                info.trade_type,
                info.symbol,
                info.period,
            )
            subscriptions.append(
                pb2.SubscriptionResponse(
                    subscription_id="",
                    user_id="",
                    instance_key=instance_key,
                    status=pb2.SUBSCRIPTION_STATUS_RUNNING,
                    ref_count=1,
                    nats_subject=nats_subj,
                    started_at=_datetime_to_timestamp(info.created_at),
                )
            )

        return pb2.ListSubscriptionsResponse(
            subscriptions=subscriptions,
            next_page_token="",
            total_count=len(subscriptions),
        )

    # ------------------------------------------------------------------
    # GetInstanceStats
    # ------------------------------------------------------------------

    async def GetInstanceStats(self, request, context):  # noqa: N802
        """Return aggregate statistics about strategy instances."""
        try:
            strategies = await self._manager.list_strategies()
        except Exception as exc:
            logger.error("GetInstanceStats failed", err=str(exc))
            await context.abort(
                grpc.StatusCode.INTERNAL,
                f"Failed to get instance stats: {exc}",
            )

        total = len(strategies)
        exchange_counts: Counter[str] = Counter()
        strategy_counts: Counter[str] = Counter()
        for info in strategies:
            exchange_counts[info.exchange] += 1
            strategy_counts[info.strategy_name] += 1

        return pb2.InstanceStatsResponse(
            total_instances=total,
            running_instances=total,
            stopped_instances=0,
            error_instances=0,
            total_subscriptions=total,
            instances_by_exchange=dict(exchange_counts),
            instances_by_strategy=dict(strategy_counts),
        )
