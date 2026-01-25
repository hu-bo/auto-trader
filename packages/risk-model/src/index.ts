/**
 * @hquant/risk-model
 * 风险控制引擎 - 可插拔、可回放、可解释
 *
 * @example
 * ```typescript
 * import { RiskEngine, RiskConfig, RiskContext } from '@hquant/risk-model';
 *
 * const config: RiskConfig = {
 *   account: {
 *     maxDailyLoss: 500,
 *     maxMarginUsagePct: 0.8,
 *     onBreach: 'BLOCK_TRADING',
 *   },
 *   position: {
 *     stopProfitPct: 1.5,
 *     stopLossPct: 0.8,
 *     onBreach: 'CLOSE_POSITION',
 *     cooldown: '15m',
 *   },
 *   symbols: {
 *     BTCUSDT: {
 *       position: {
 *         stopProfitPct: 2.0,
 *         stopLossPct: 1.0,
 *       },
 *     },
 *   },
 * };
 *
 * const engine = new RiskEngine(config, { enableAudit: true });
 *
 * engine.onDecision((decisions) => {
 *   for (const decision of decisions) {
 *     console.log(`[${decision.level}] ${decision.action}: ${decision.reason}`);
 *   }
 * });
 *
 * const context: RiskContext = {
 *   now: Date.now(),
 *   account: {
 *     equity: 10000,
 *     dailyPnl: -100,
 *     marginUsed: 5000,
 *     marginAvailable: 5000,
 *   },
 *   positions: [
 *     {
 *       symbol: 'BTCUSDT',
 *       market: 'FUTURES',
 *       side: 'LONG',
 *       qty: 0.1,
 *       entryPrice: 50000,
 *       markPrice: 55000,
 *       marginUsed: 1000,
 *       unrealizedPnl: 500,
 *     },
 *   ],
 * };
 *
 * const decisions = engine.evaluate(context);
 * ```
 */

// Core
export { RiskEngine } from './RiskEngine.js';
export type { RiskEngineOptions, RiskEventHandler } from './RiskEngine.js';

// Evaluators
export { AccountRiskEvaluator, PositionRiskEvaluator } from './evaluators/index.js';

// Types
export type {
  // Market types
  Market,
  PositionSide,
  // Actions
  AccountBreachAction,
  PositionBreachAction,
  RiskAction,
  RiskLevel,
  // Decision
  RiskDecision,
  // Snapshots
  PositionSnapshot,
  AccountSnapshot,
  // Context
  RiskContext,
  // Config
  AccountRiskConfig,
  PositionRiskConfig,
  SymbolRiskOverride,
  RiskConfig,
  // State
  PositionRiskState,
  RiskState,
  // Audit
  RiskAuditEntry,
  // Evaluator
  EvaluationResult,
  RiskEvaluator,
} from './types.js';

// Utils
export {
  parseDuration,
  getPositionKey,
  calculatePnlPct,
  calculateMarginUsagePct,
  formatPct,
  deepMerge,
  createInitialState,
} from './utils.js';
