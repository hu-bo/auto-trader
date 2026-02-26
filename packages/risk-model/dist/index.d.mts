/**
 * Risk Model Types
 * 风险控制引擎类型定义
 */
type Market = 'FUTURES' | 'DELIVERY' | 'SPOT';
type PositionSide = 'LONG' | 'SHORT';
/** 账户级越界行为 */
type AccountBreachAction = 'BLOCK_TRADING' | 'CLOSE_ALL';
/** 仓位级越界行为 */
type PositionBreachAction = 'CLOSE_POSITION' | 'REDUCE_POSITION';
type RiskAction = 'BLOCK_TRADING' | 'CLOSE_ALL' | 'CLOSE_POSITION' | 'REDUCE_POSITION';
type RiskLevel = 'ACCOUNT' | 'POSITION';
/** 风控决策输出 - RiskEngine 唯一职责 */
interface RiskDecision {
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
/** 统一仓位抽象（跨 futures / delivery / spot） */
interface PositionSnapshot {
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
/** 账户快照 */
interface AccountSnapshot {
    /** 账户权益 */
    equity: number;
    /** 当日盈亏 */
    dailyPnl: number;
    /** 已用保证金 */
    marginUsed: number;
    /** 可用保证金 */
    marginAvailable: number;
}
/** 风控输入上下文 */
interface RiskContext {
    /** 当前时间戳 */
    now: number;
    /** 账户快照 */
    account: AccountSnapshot;
    /** 持仓快照列表 */
    positions: PositionSnapshot[];
}
/** 账户级风险配置 */
interface AccountRiskConfig {
    /** 单日最大亏损（USDT） */
    maxDailyLoss: number;
    /** 最大保证金使用率 (0-1) */
    maxMarginUsagePct: number;
    /** 越界行为 */
    onBreach: AccountBreachAction;
}
/** 仓位级风险配置 */
interface PositionRiskConfig {
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
interface SymbolRiskOverride {
    position?: Partial<PositionRiskConfig>;
}
/** 完整风险配置 */
interface RiskConfig {
    /** 账户级风险配置 */
    account: AccountRiskConfig;
    /** 仓位级风险配置（默认） */
    position: PositionRiskConfig;
    /** 品种级覆盖 */
    symbols?: Record<string, SymbolRiskOverride>;
}
/** 仓位风控状态 */
interface PositionRiskState {
    /** 上次触发时间 */
    lastBreachAt: number;
}
/** 风控状态存储 */
interface RiskState {
    /** 账户是否被阻断 */
    accountBlocked: boolean;
    /** 账户阻断时间 */
    accountBlockedAt?: number;
    /** 各仓位的风控状态 */
    positions: Map<string, PositionRiskState>;
}
/** 审计日志条目 */
interface RiskAuditEntry {
    /** 时间戳 */
    timestamp: number;
    /** 输入快照 */
    inputSnapshot: RiskContext;
    /** 触发的规则 */
    triggeredRule: string;
    /** 产出的决策 */
    decision: RiskDecision;
}
/** 风控评估结果 */
interface EvaluationResult {
    /** 是否触发 */
    triggered: boolean;
    /** 决策（触发时） */
    decision?: RiskDecision;
}
/** 风控评估器接口 */
interface RiskEvaluator {
    /** 评估风险 */
    evaluate(context: RiskContext, state: RiskState): EvaluationResult[];
}

/**
 * RiskEngine
 * 风险控制引擎核心类 - 可插拔、可回放、可解释
 *
 * 执行顺序（固定，不可更改）：
 * 1️⃣ Account Risk - 系统级硬闸门
 * 2️⃣ Symbol Override Resolution
 * 3️⃣ Position Risk - 仅在账户未阻断时执行
 */

interface RiskEngineOptions {
    /** 是否启用审计日志 */
    enableAudit?: boolean;
    /** 审计日志最大条目数 */
    maxAuditEntries?: number;
}
type RiskEventHandler = (decisions: RiskDecision[]) => void;
declare class RiskEngine {
    private readonly config;
    private readonly accountEvaluator;
    private readonly positionEvaluator;
    private readonly state;
    private readonly options;
    private readonly auditLog;
    private eventHandlers;
    constructor(config: RiskConfig, options?: RiskEngineOptions);
    /**
     * 评估风险并返回决策
     * @param context 风控输入上下文
     * @returns 风控决策列表
     */
    evaluate(context: RiskContext): RiskDecision[];
    /**
     * 订阅风控决策事件
     */
    onDecision(handler: RiskEventHandler): () => void;
    /**
     * 获取当前风控状态
     */
    getState(): Readonly<RiskState>;
    /**
     * 检查账户是否被阻断
     */
    isAccountBlocked(): boolean;
    /**
     * 重置账户阻断状态
     */
    resetAccountBlock(): void;
    /**
     * 重置特定仓位的冷却状态
     */
    resetPositionCooldown(symbol: string, side: 'LONG' | 'SHORT'): void;
    /**
     * 获取审计日志
     */
    getAuditLog(): readonly RiskAuditEntry[];
    /**
     * 清空审计日志
     */
    clearAuditLog(): void;
    /**
     * 获取当前配置
     */
    getConfig(): Readonly<RiskConfig>;
    /**
     * 销毁引擎，清理资源
     */
    destroy(): void;
    private emitDecisions;
    private recordAudit;
}

/**
 * Account Risk Evaluator
 * 账户级风险评估器 - 系统级硬闸门
 */

declare class AccountRiskEvaluator implements RiskEvaluator {
    private readonly config;
    constructor(config: AccountRiskConfig);
    evaluate(context: RiskContext, state: RiskState): EvaluationResult[];
    private checkDailyLoss;
    private checkMarginUsage;
}

/**
 * Position Risk Evaluator
 * 仓位级风险评估器 - 支持止盈/止损/减仓
 */

declare class PositionRiskEvaluator implements RiskEvaluator {
    private readonly defaultConfig;
    private readonly symbolOverrides;
    constructor(defaultConfig: PositionRiskConfig, symbolOverrides?: Record<string, SymbolRiskOverride>);
    evaluate(context: RiskContext, state: RiskState): EvaluationResult[];
    private evaluatePosition;
    private getConfigForSymbol;
    private isInCooldown;
    private createDecision;
}

/**
 * Risk Model Utilities
 * 风险控制引擎工具函数
 */
/**
 * 解析时间字符串为毫秒
 * @example parseDuration("15m") => 900000
 * @example parseDuration("1h") => 3600000
 * @example parseDuration(60000) => 60000
 */
declare function parseDuration(duration: number | string): number;
/**
 * 生成仓位唯一键
 */
declare function getPositionKey(symbol: string, side: 'LONG' | 'SHORT'): string;
/**
 * 计算仓位盈亏率（基于 margin）
 */
declare function calculatePnlPct(position: {
    unrealizedPnl: number;
    marginUsed: number;
}): number;
/**
 * 计算保证金使用率
 */
declare function calculateMarginUsagePct(account: {
    marginUsed: number;
    equity: number;
}): number;
/**
 * 格式化数字为百分比字符串
 */
declare function formatPct(value: number, decimals?: number): string;
/**
 * 深度合并对象
 */
declare function deepMerge<T extends object>(target: T, source: Partial<T>): T;
/**
 * 创建初始风控状态
 */
declare function createInitialState(): {
    accountBlocked: boolean;
    positions: Map<string, {
        lastBreachAt: number;
    }>;
};

export { type AccountBreachAction, type AccountRiskConfig, AccountRiskEvaluator, type AccountSnapshot, type EvaluationResult, type Market, type PositionBreachAction, type PositionRiskConfig, PositionRiskEvaluator, type PositionRiskState, type PositionSide, type PositionSnapshot, type RiskAction, type RiskAuditEntry, type RiskConfig, type RiskContext, type RiskDecision, RiskEngine, type RiskEngineOptions, type RiskEvaluator, type RiskEventHandler, type RiskLevel, type RiskState, type SymbolRiskOverride, calculateMarginUsagePct, calculatePnlPct, createInitialState, deepMerge, formatPct, getPositionKey, parseDuration };
