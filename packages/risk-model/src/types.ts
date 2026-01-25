/**
 * Risk Model Types
 * 风险控制引擎类型定义
 */

// ============================================
// Market Types
// ============================================

export type Market = 'FUTURES' | 'DELIVERY' | 'SPOT';

export type PositionSide = 'LONG' | 'SHORT';

// ============================================
// Account Breach Actions
// ============================================

/** 账户级越界行为 */
export type AccountBreachAction = 'BLOCK_TRADING' | 'CLOSE_ALL';

/** 仓位级越界行为 */
export type PositionBreachAction = 'CLOSE_POSITION' | 'REDUCE_POSITION';

// ============================================
// Risk Decision
// ============================================

export type RiskAction =
  | 'BLOCK_TRADING'
  | 'CLOSE_ALL'
  | 'CLOSE_POSITION'
  | 'REDUCE_POSITION';

export type RiskLevel = 'ACCOUNT' | 'POSITION';

/** 风控决策输出 - RiskEngine 唯一职责 */
export interface RiskDecision {
  /** 风控级别 */
  level: RiskLevel;
  /** 触发品种（仅 POSITION 级别） */
  symbol?: string;
  /** 风控动作 */
  action: RiskAction;
  /** 动作参数 */
  params?: {
    reduceRatio?: number;
  };
  /** 触发原因 */
  reason: string;
  /** 触发时间 */
  timestamp: number;
}

// ============================================
// Position Snapshot
// ============================================

/** 统一仓位抽象（跨 futures / delivery / spot） */
export interface PositionSnapshot {
  /** 交易对 */
  symbol: string;
  /** 市场类型 */
  market: Market;
  /** 持仓方向 */
  side: PositionSide;
  /** 持仓数量 */
  qty: number;
  /** 开仓均价 */
  entryPrice: number;
  /** 当前标记价格 */
  markPrice: number;
  /** 使用的保证金 */
  marginUsed: number;
  /** 未实现盈亏 */
  unrealizedPnl: number;
  /** 杠杆倍数（可选） */
  leverage?: number;
}

// ============================================
// Account Snapshot
// ============================================

/** 账户快照 */
export interface AccountSnapshot {
  /** 账户权益 */
  equity: number;
  /** 当日盈亏 */
  dailyPnl: number;
  /** 已用保证金 */
  marginUsed: number;
  /** 可用保证金 */
  marginAvailable: number;
}

// ============================================
// Risk Context (Engine Input)
// ============================================

/** 风控输入上下文 */
export interface RiskContext {
  /** 当前时间戳 */
  now: number;
  /** 账户快照 */
  account: AccountSnapshot;
  /** 持仓快照列表 */
  positions: PositionSnapshot[];
}

// ============================================
// Risk Configuration
// ============================================

/** 账户级风险配置 */
export interface AccountRiskConfig {
  /** 单日最大亏损（USDT） */
  maxDailyLoss: number;
  /** 最大保证金使用率 (0-1) */
  maxMarginUsagePct: number;
  /** 越界行为 */
  onBreach: AccountBreachAction;
}

/** 仓位级风险配置 */
export interface PositionRiskConfig {
  /** 止盈比例（基于 margin 的盈亏率） */
  stopProfitPct: number;
  /** 止损比例（基于 margin 的盈亏率） */
  stopLossPct: number;
  /** 单仓最大亏损（USDT，可选） */
  maxLossPerPosition?: number;
  /** 越界行为 */
  onBreach: PositionBreachAction;
  /** 减仓比例（仅 REDUCE_POSITION 时使用） */
  reduceRatio?: number;
  /** 风控冷却时间（毫秒或时间字符串如 "15m"） */
  cooldown: number | string;
}

/** 品种级覆盖配置 */
export interface SymbolRiskOverride {
  position?: Partial<PositionRiskConfig>;
}

/** 完整风险配置 */
export interface RiskConfig {
  /** 账户级风险配置 */
  account: AccountRiskConfig;
  /** 仓位级风险配置（默认） */
  position: PositionRiskConfig;
  /** 品种级覆盖 */
  symbols?: Record<string, SymbolRiskOverride>;
}

// ============================================
// Risk State (Internal)
// ============================================

/** 仓位风控状态 */
export interface PositionRiskState {
  /** 上次触发时间 */
  lastBreachAt: number;
}

/** 风控状态存储 */
export interface RiskState {
  /** 账户是否被阻断 */
  accountBlocked: boolean;
  /** 账户阻断时间 */
  accountBlockedAt?: number;
  /** 各仓位的风控状态 */
  positions: Map<string, PositionRiskState>;
}

// ============================================
// Audit Log
// ============================================

/** 审计日志条目 */
export interface RiskAuditEntry {
  /** 时间戳 */
  timestamp: number;
  /** 输入快照 */
  inputSnapshot: RiskContext;
  /** 触发的规则 */
  triggeredRule: string;
  /** 产出的决策 */
  decision: RiskDecision;
}

// ============================================
// Evaluator Interface
// ============================================

/** 风控评估结果 */
export interface EvaluationResult {
  /** 是否触发 */
  triggered: boolean;
  /** 决策（触发时） */
  decision?: RiskDecision;
}

/** 风控评估器接口 */
export interface RiskEvaluator {
  /** 评估风险 */
  evaluate(context: RiskContext, state: RiskState): EvaluationResult[];
}
