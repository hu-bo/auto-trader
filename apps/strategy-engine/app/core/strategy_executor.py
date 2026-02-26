from __future__ import annotations

from hquant_logger import create_logger

from app.core.signal_generator import create_signal, normalize_action
from app.models import Candle, Signal
from app.nats.client import NatsClient
from app.nats.topics import signal_subject, signal_subject_by_strategy

logger = create_logger("strategy-engine").child("executor")


class StrategyInstanceLike:
    strategy_id: int
    strategy_name: str
    calculator: object
    last_emitted_action: str | None


class StrategyExecutor:
    def __init__(
        self,
        *,
        nats_client: NatsClient,
        signal_subject_prefix: str,
        signal_strategy_subject_prefix: str | None = None,
    ) -> None:
        self._nats = nats_client
        self._signal_prefix = signal_subject_prefix
        self._signal_strategy_prefix = signal_strategy_subject_prefix

    async def execute(self, candle: Candle, strategies: list[StrategyInstanceLike]) -> None:
        print(f"Executing strategies for candle: {candle.exchange} {candle.trade_type} {candle.symbol} {candle.period} @ {candle.timestamp}")
        for strategy in strategies:
            try:
                signals = strategy.calculator.on_candle(candle)
            except Exception as exc:
                logger.warning(
                    "Strategy execution failed",
                    strategy_id=strategy.strategy_id,
                    err=str(exc),
                )
                continue

            action = self._pick_action(signals)
            logger.info(
                "Strategy tick",
                strategy_id=strategy.strategy_id,
                strategy_name=strategy.strategy_name,
                symbol=candle.symbol,
                action=action or "none",
                signal_count=len(signals) if signals else 0,
            )
            if not action:
                continue

            normalized_action = normalize_action(action)
            if normalized_action == strategy.last_emitted_action:
                continue

            signal = create_signal(
                candle=candle,
                strategy_id=strategy.strategy_id,
                strategy_name=strategy.strategy_name,
                action=normalized_action,
            )
            published = await self._publish_signal(signal)
            if published:
                strategy.last_emitted_action = normalized_action

    def _pick_action(self, signals: list[dict]) -> str | None:
        if not signals:
            return None
        last_signal = signals[-1]
        action = last_signal.get("action")
        if isinstance(action, str) and action:
            return action
        return None

    async def _publish_signal(self, signal: Signal) -> bool:
        payload = signal.model_dump_json().encode("utf-8")

        subject_symbol = signal_subject(
            self._signal_prefix, signal.exchange, signal.trade_type, signal.symbol
        )
        try:
            await self._nats.publish(subject_symbol, payload)
        except Exception as exc:
            logger.warning("Failed to publish signal", subject=subject_symbol, err=str(exc))
            return False

        if not self._signal_strategy_prefix:
            return True

        subject_strategy = signal_subject_by_strategy(
            self._signal_strategy_prefix, signal.strategy_id
        )
        try:
            await self._nats.publish(subject_strategy, payload)
        except Exception as exc:
            logger.warning("Failed to publish signal", subject=subject_strategy, err=str(exc))
        return True
