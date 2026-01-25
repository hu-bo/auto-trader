/**
 * RiskEngine
 * 风险控制引擎核心类 - 可插拔、可回放、可解释
 *
 * 执行顺序（固定，不可更改）：
 * 1️⃣ Account Risk - 系统级硬闸门
 * 2️⃣ Symbol Override Resolution
 * 3️⃣ Position Risk - 仅在账户未阻断时执行
 */

import { AccountRiskEvaluator } from './evaluators/AccountRiskEvaluator.js';
import { PositionRiskEvaluator } from './evaluators/PositionRiskEvaluator.js';
import type {
  RiskAuditEntry,
  RiskConfig,
  RiskContext,
  RiskDecision,
  RiskState,
} from './types.js';
import { createInitialState, getPositionKey } from './utils.js';

export interface RiskEngineOptions {
  /** 是否启用审计日志 */
  enableAudit?: boolean;
  /** 审计日志最大条目数 */
  maxAuditEntries?: number;
}

export type RiskEventHandler = (decisions: RiskDecision[]) => void;

export class RiskEngine {
  private readonly accountEvaluator: AccountRiskEvaluator;
  private readonly positionEvaluator: PositionRiskEvaluator;
  private readonly state: RiskState;
  private readonly options: Required<RiskEngineOptions>;
  private readonly auditLog: RiskAuditEntry[] = [];
  private eventHandlers: Set<RiskEventHandler> = new Set();

  constructor(
    private readonly config: RiskConfig,
    options: RiskEngineOptions = {}
  ) {
    this.options = {
      enableAudit: options.enableAudit ?? false,
      maxAuditEntries: options.maxAuditEntries ?? 1000,
    };

    this.accountEvaluator = new AccountRiskEvaluator(config.account);
    this.positionEvaluator = new PositionRiskEvaluator(
      config.position,
      config.symbols
    );
    this.state = createInitialState();
  }

  /**
   * 评估风险并返回决策
   * @param context 风控输入上下文
   * @returns 风控决策列表
   */
  evaluate(context: RiskContext): RiskDecision[] {
    const decisions: RiskDecision[] = [];

    // 1️⃣ Account Risk - 系统级硬闸门
    const accountResults = this.accountEvaluator.evaluate(context, this.state);
    for (const result of accountResults) {
      if (result.triggered && result.decision) {
        decisions.push(result.decision);
        this.state.accountBlocked = true;
        this.state.accountBlockedAt = context.now;

        // 记录审计日志
        this.recordAudit(context, 'ACCOUNT', result.decision);
      }
    }

    // 如果账户已被阻断，不执行仓位级风控
    if (this.state.accountBlocked) {
      this.emitDecisions(decisions);
      return decisions;
    }

    // 2️⃣ + 3️⃣ Position Risk（已包含 Symbol Override Resolution）
    const positionResults = this.positionEvaluator.evaluate(context, this.state);
    for (const result of positionResults) {
      if (result.triggered && result.decision) {
        decisions.push(result.decision);

        // 更新仓位风控状态
        const position = context.positions.find(
          (p) => p.symbol === result.decision!.symbol
        );
        if (position) {
          const key = getPositionKey(position.symbol, position.side);
          this.state.positions.set(key, { lastBreachAt: context.now });
        }

        // 记录审计日志
        this.recordAudit(context, 'POSITION', result.decision);
      }
    }

    this.emitDecisions(decisions);
    return decisions;
  }

  /**
   * 订阅风控决策事件
   */
  onDecision(handler: RiskEventHandler): () => void {
    this.eventHandlers.add(handler);
    return () => this.eventHandlers.delete(handler);
  }

  /**
   * 获取当前风控状态
   */
  getState(): Readonly<RiskState> {
    return this.state;
  }

  /**
   * 检查账户是否被阻断
   */
  isAccountBlocked(): boolean {
    return this.state.accountBlocked;
  }

  /**
   * 重置账户阻断状态
   */
  resetAccountBlock(): void {
    this.state.accountBlocked = false;
    this.state.accountBlockedAt = undefined;
  }

  /**
   * 重置特定仓位的冷却状态
   */
  resetPositionCooldown(symbol: string, side: 'LONG' | 'SHORT'): void {
    const key = getPositionKey(symbol, side);
    this.state.positions.delete(key);
  }

  /**
   * 获取审计日志
   */
  getAuditLog(): readonly RiskAuditEntry[] {
    return this.auditLog;
  }

  /**
   * 清空审计日志
   */
  clearAuditLog(): void {
    this.auditLog.length = 0;
  }

  /**
   * 获取当前配置
   */
  getConfig(): Readonly<RiskConfig> {
    return this.config;
  }

  /**
   * 销毁引擎，清理资源
   */
  destroy(): void {
    this.eventHandlers.clear();
    this.auditLog.length = 0;
    this.state.positions.clear();
  }

  private emitDecisions(decisions: RiskDecision[]): void {
    if (decisions.length === 0) return;
    for (const handler of this.eventHandlers) {
      try {
        handler(decisions);
      } catch {
        // 忽略处理器错误，避免影响引擎
      }
    }
  }

  private recordAudit(
    context: RiskContext,
    triggeredRule: string,
    decision: RiskDecision
  ): void {
    if (!this.options.enableAudit) return;

    const entry: RiskAuditEntry = {
      timestamp: context.now,
      inputSnapshot: structuredClone(context),
      triggeredRule,
      decision,
    };

    this.auditLog.push(entry);

    // 限制日志大小
    if (this.auditLog.length > this.options.maxAuditEntries) {
      this.auditLog.shift();
    }
  }
}
