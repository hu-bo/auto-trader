/**
 * Account Risk Evaluator
 * 账户级风险评估器 - 系统级硬闸门
 */

import type {
  AccountRiskConfig,
  EvaluationResult,
  RiskContext,
  RiskDecision,
  RiskEvaluator,
  RiskState,
} from '../types.js';
import { calculateMarginUsagePct, formatPct } from '../utils.js';

export class AccountRiskEvaluator implements RiskEvaluator {
  constructor(private readonly config: AccountRiskConfig) {}

  evaluate(context: RiskContext, state: RiskState): EvaluationResult[] {
    const results: EvaluationResult[] = [];

    // 如果账户已被阻断，不再重复触发
    if (state.accountBlocked) {
      return results;
    }

    // 检查单日最大亏损
    const dailyLossResult = this.checkDailyLoss(context);
    if (dailyLossResult.triggered) {
      results.push(dailyLossResult);
      // 账户级风控一旦触发，立即返回
      return results;
    }

    // 检查保证金使用率
    const marginUsageResult = this.checkMarginUsage(context);
    if (marginUsageResult.triggered) {
      results.push(marginUsageResult);
    }

    return results;
  }

  private checkDailyLoss(context: RiskContext): EvaluationResult {
    const { dailyPnl } = context.account;
    const { maxDailyLoss, onBreach } = this.config;

    if (dailyPnl <= -maxDailyLoss) {
      const decision: RiskDecision = {
        level: 'ACCOUNT',
        action: onBreach,
        reason: `Daily loss ${dailyPnl.toFixed(2)} USDT exceeded max allowed -${maxDailyLoss} USDT`,
        timestamp: context.now,
      };

      return { triggered: true, decision };
    }

    return { triggered: false };
  }

  private checkMarginUsage(context: RiskContext): EvaluationResult {
    const marginUsagePct = calculateMarginUsagePct(context.account);
    const { maxMarginUsagePct, onBreach } = this.config;

    if (marginUsagePct >= maxMarginUsagePct) {
      const decision: RiskDecision = {
        level: 'ACCOUNT',
        action: onBreach,
        reason: `Margin usage ${formatPct(marginUsagePct)} exceeded max allowed ${formatPct(maxMarginUsagePct)}`,
        timestamp: context.now,
      };

      return { triggered: true, decision };
    }

    return { triggered: false };
  }
}
