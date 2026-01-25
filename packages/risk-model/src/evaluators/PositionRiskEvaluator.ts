/**
 * Position Risk Evaluator
 * 仓位级风险评估器 - 支持止盈/止损/减仓
 */

import type {
  EvaluationResult,
  PositionRiskConfig,
  PositionSnapshot,
  RiskContext,
  RiskDecision,
  RiskEvaluator,
  RiskState,
  SymbolRiskOverride,
} from '../types.js';
import {
  calculatePnlPct,
  deepMerge,
  formatPct,
  getPositionKey,
  parseDuration,
} from '../utils.js';

export class PositionRiskEvaluator implements RiskEvaluator {
  constructor(
    private readonly defaultConfig: PositionRiskConfig,
    private readonly symbolOverrides: Record<string, SymbolRiskOverride> = {}
  ) {}

  evaluate(context: RiskContext, state: RiskState): EvaluationResult[] {
    const results: EvaluationResult[] = [];

    for (const position of context.positions) {
      // 跳过空仓
      if (position.qty === 0) {
        continue;
      }

      const result = this.evaluatePosition(position, context, state);
      if (result.triggered) {
        results.push(result);
      }
    }

    return results;
  }

  private evaluatePosition(
    position: PositionSnapshot,
    context: RiskContext,
    state: RiskState
  ): EvaluationResult {
    const config = this.getConfigForSymbol(position.symbol);
    const positionKey = getPositionKey(position.symbol, position.side);

    // 检查冷却期
    if (this.isInCooldown(positionKey, context.now, config, state)) {
      return { triggered: false };
    }

    // 计算盈亏率（基于 margin）
    const pnlPct = calculatePnlPct(position);

    // 检查止盈
    if (pnlPct >= config.stopProfitPct) {
      return this.createDecision(position, config, context.now, 'STOP_PROFIT', pnlPct);
    }

    // 检查止损
    if (pnlPct <= -config.stopLossPct) {
      return this.createDecision(position, config, context.now, 'STOP_LOSS', pnlPct);
    }

    // 检查单仓最大亏损
    if (
      config.maxLossPerPosition !== undefined &&
      position.unrealizedPnl <= -config.maxLossPerPosition
    ) {
      return this.createDecision(
        position,
        config,
        context.now,
        'MAX_LOSS_PER_POSITION',
        pnlPct
      );
    }

    return { triggered: false };
  }

  private getConfigForSymbol(symbol: string): PositionRiskConfig {
    const override = this.symbolOverrides[symbol];
    if (!override?.position) {
      return this.defaultConfig;
    }
    return deepMerge(this.defaultConfig, override.position);
  }

  private isInCooldown(
    positionKey: string,
    now: number,
    config: PositionRiskConfig,
    state: RiskState
  ): boolean {
    const positionState = state.positions.get(positionKey);
    if (!positionState) {
      return false;
    }

    const cooldownMs = parseDuration(config.cooldown);
    return now - positionState.lastBreachAt < cooldownMs;
  }

  private createDecision(
    position: PositionSnapshot,
    config: PositionRiskConfig,
    now: number,
    triggerType: 'STOP_PROFIT' | 'STOP_LOSS' | 'MAX_LOSS_PER_POSITION',
    pnlPct: number
  ): EvaluationResult {
    const { onBreach, reduceRatio, stopProfitPct, stopLossPct, maxLossPerPosition } =
      config;

    let reason: string;
    switch (triggerType) {
      case 'STOP_PROFIT':
        reason = `[${position.symbol}] Take profit triggered: PnL ${formatPct(pnlPct)} >= ${formatPct(stopProfitPct)}`;
        break;
      case 'STOP_LOSS':
        reason = `[${position.symbol}] Stop loss triggered: PnL ${formatPct(pnlPct)} <= -${formatPct(stopLossPct)}`;
        break;
      case 'MAX_LOSS_PER_POSITION':
        reason = `[${position.symbol}] Max loss per position triggered: Loss ${position.unrealizedPnl.toFixed(2)} USDT >= ${maxLossPerPosition} USDT`;
        break;
    }

    const decision: RiskDecision = {
      level: 'POSITION',
      symbol: position.symbol,
      action: onBreach,
      reason,
      timestamp: now,
    };

    if (onBreach === 'REDUCE_POSITION' && reduceRatio !== undefined) {
      decision.params = { reduceRatio };
    }

    return { triggered: true, decision };
  }
}
