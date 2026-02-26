// src/utils.ts
function parseDuration(duration) {
  if (typeof duration === "number") {
    return duration;
  }
  const match = duration.match(/^(\d+(?:\.\d+)?)(ms|s|m|h|d)$/);
  if (!match) {
    throw new Error(`Invalid duration format: ${duration}`);
  }
  const value = parseFloat(match[1]);
  const unit = match[2];
  const multipliers = {
    ms: 1,
    s: 1e3,
    m: 60 * 1e3,
    h: 60 * 60 * 1e3,
    d: 24 * 60 * 60 * 1e3
  };
  return value * multipliers[unit];
}
function getPositionKey(symbol, side) {
  return `${symbol}:${side}`;
}
function calculatePnlPct(position) {
  if (position.marginUsed === 0) {
    return 0;
  }
  return position.unrealizedPnl / position.marginUsed;
}
function calculateMarginUsagePct(account) {
  if (account.equity === 0) {
    return 0;
  }
  return account.marginUsed / account.equity;
}
function formatPct(value, decimals = 2) {
  return `${(value * 100).toFixed(decimals)}%`;
}
function deepMerge(target, source) {
  const result = { ...target };
  for (const key in source) {
    if (Object.prototype.hasOwnProperty.call(source, key)) {
      const sourceValue = source[key];
      const targetValue = result[key];
      if (sourceValue !== void 0 && typeof sourceValue === "object" && sourceValue !== null && !Array.isArray(sourceValue) && typeof targetValue === "object" && targetValue !== null && !Array.isArray(targetValue)) {
        result[key] = deepMerge(
          targetValue,
          sourceValue
        );
      } else if (sourceValue !== void 0) {
        result[key] = sourceValue;
      }
    }
  }
  return result;
}
function createInitialState() {
  return {
    accountBlocked: false,
    positions: /* @__PURE__ */ new Map()
  };
}

// src/evaluators/AccountRiskEvaluator.ts
var AccountRiskEvaluator = class {
  constructor(config) {
    this.config = config;
  }
  evaluate(context, state) {
    const results = [];
    if (state.accountBlocked) {
      return results;
    }
    const dailyLossResult = this.checkDailyLoss(context);
    if (dailyLossResult.triggered) {
      results.push(dailyLossResult);
      return results;
    }
    const marginUsageResult = this.checkMarginUsage(context);
    if (marginUsageResult.triggered) {
      results.push(marginUsageResult);
    }
    return results;
  }
  checkDailyLoss(context) {
    const { dailyPnl } = context.account;
    const { maxDailyLoss, onBreach } = this.config;
    if (dailyPnl <= -maxDailyLoss) {
      const decision = {
        level: "ACCOUNT",
        action: onBreach,
        reason: `Daily loss ${dailyPnl.toFixed(2)} USDT exceeded max allowed -${maxDailyLoss} USDT`,
        timestamp: context.now
      };
      return { triggered: true, decision };
    }
    return { triggered: false };
  }
  checkMarginUsage(context) {
    const marginUsagePct = calculateMarginUsagePct(context.account);
    const { maxMarginUsagePct, onBreach } = this.config;
    if (marginUsagePct >= maxMarginUsagePct) {
      const decision = {
        level: "ACCOUNT",
        action: onBreach,
        reason: `Margin usage ${formatPct(marginUsagePct)} exceeded max allowed ${formatPct(maxMarginUsagePct)}`,
        timestamp: context.now
      };
      return { triggered: true, decision };
    }
    return { triggered: false };
  }
};

// src/evaluators/PositionRiskEvaluator.ts
var PositionRiskEvaluator = class {
  constructor(defaultConfig, symbolOverrides = {}) {
    this.defaultConfig = defaultConfig;
    this.symbolOverrides = symbolOverrides;
  }
  evaluate(context, state) {
    const results = [];
    for (const position of context.positions) {
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
  evaluatePosition(position, context, state) {
    const config = this.getConfigForSymbol(position.symbol);
    const positionKey = getPositionKey(position.symbol, position.side);
    if (this.isInCooldown(positionKey, context.now, config, state)) {
      return { triggered: false };
    }
    const pnlPct = calculatePnlPct(position);
    if (pnlPct >= config.stopProfitPct) {
      return this.createDecision(position, config, context.now, "STOP_PROFIT", pnlPct);
    }
    if (pnlPct <= -config.stopLossPct) {
      return this.createDecision(position, config, context.now, "STOP_LOSS", pnlPct);
    }
    if (config.maxLossPerPosition !== void 0 && position.unrealizedPnl <= -config.maxLossPerPosition) {
      return this.createDecision(
        position,
        config,
        context.now,
        "MAX_LOSS_PER_POSITION",
        pnlPct
      );
    }
    return { triggered: false };
  }
  getConfigForSymbol(symbol) {
    const override = this.symbolOverrides[symbol];
    if (!override?.position) {
      return this.defaultConfig;
    }
    return deepMerge(this.defaultConfig, override.position);
  }
  isInCooldown(positionKey, now, config, state) {
    const positionState = state.positions.get(positionKey);
    if (!positionState) {
      return false;
    }
    const cooldownMs = parseDuration(config.cooldown);
    return now - positionState.lastBreachAt < cooldownMs;
  }
  createDecision(position, config, now, triggerType, pnlPct) {
    const { onBreach, reduceRatio, stopProfitPct, stopLossPct, maxLossPerPosition } = config;
    let reason;
    switch (triggerType) {
      case "STOP_PROFIT":
        reason = `[${position.symbol}] Take profit triggered: PnL ${formatPct(pnlPct)} >= ${formatPct(stopProfitPct)}`;
        break;
      case "STOP_LOSS":
        reason = `[${position.symbol}] Stop loss triggered: PnL ${formatPct(pnlPct)} <= -${formatPct(stopLossPct)}`;
        break;
      case "MAX_LOSS_PER_POSITION":
        reason = `[${position.symbol}] Max loss per position triggered: Loss ${position.unrealizedPnl.toFixed(2)} USDT >= ${maxLossPerPosition} USDT`;
        break;
    }
    const decision = {
      level: "POSITION",
      symbol: position.symbol,
      action: onBreach,
      reason,
      timestamp: now
    };
    if (onBreach === "REDUCE_POSITION" && reduceRatio !== void 0) {
      decision.params = { reduceRatio };
    }
    return { triggered: true, decision };
  }
};

// src/RiskEngine.ts
var RiskEngine = class {
  constructor(config, options = {}) {
    this.config = config;
    this.options = {
      enableAudit: options.enableAudit ?? false,
      maxAuditEntries: options.maxAuditEntries ?? 1e3
    };
    this.accountEvaluator = new AccountRiskEvaluator(config.account);
    this.positionEvaluator = new PositionRiskEvaluator(
      config.position,
      config.symbols
    );
    this.state = createInitialState();
  }
  accountEvaluator;
  positionEvaluator;
  state;
  options;
  auditLog = [];
  eventHandlers = /* @__PURE__ */ new Set();
  /**
   * 评估风险并返回决策
   * @param context 风控输入上下文
   * @returns 风控决策列表
   */
  evaluate(context) {
    const decisions = [];
    const accountResults = this.accountEvaluator.evaluate(context, this.state);
    for (const result of accountResults) {
      if (result.triggered && result.decision) {
        decisions.push(result.decision);
        this.state.accountBlocked = true;
        this.state.accountBlockedAt = context.now;
        this.recordAudit(context, "ACCOUNT", result.decision);
      }
    }
    if (this.state.accountBlocked) {
      this.emitDecisions(decisions);
      return decisions;
    }
    const positionResults = this.positionEvaluator.evaluate(context, this.state);
    for (const result of positionResults) {
      if (result.triggered && result.decision) {
        decisions.push(result.decision);
        const position = context.positions.find(
          (p) => p.symbol === result.decision.symbol
        );
        if (position) {
          const key = getPositionKey(position.symbol, position.side);
          this.state.positions.set(key, { lastBreachAt: context.now });
        }
        this.recordAudit(context, "POSITION", result.decision);
      }
    }
    this.emitDecisions(decisions);
    return decisions;
  }
  /**
   * 订阅风控决策事件
   */
  onDecision(handler) {
    this.eventHandlers.add(handler);
    return () => this.eventHandlers.delete(handler);
  }
  /**
   * 获取当前风控状态
   */
  getState() {
    return this.state;
  }
  /**
   * 检查账户是否被阻断
   */
  isAccountBlocked() {
    return this.state.accountBlocked;
  }
  /**
   * 重置账户阻断状态
   */
  resetAccountBlock() {
    this.state.accountBlocked = false;
    this.state.accountBlockedAt = void 0;
  }
  /**
   * 重置特定仓位的冷却状态
   */
  resetPositionCooldown(symbol, side) {
    const key = getPositionKey(symbol, side);
    this.state.positions.delete(key);
  }
  /**
   * 获取审计日志
   */
  getAuditLog() {
    return this.auditLog;
  }
  /**
   * 清空审计日志
   */
  clearAuditLog() {
    this.auditLog.length = 0;
  }
  /**
   * 获取当前配置
   */
  getConfig() {
    return this.config;
  }
  /**
   * 销毁引擎，清理资源
   */
  destroy() {
    this.eventHandlers.clear();
    this.auditLog.length = 0;
    this.state.positions.clear();
  }
  emitDecisions(decisions) {
    if (decisions.length === 0) return;
    for (const handler of this.eventHandlers) {
      try {
        handler(decisions);
      } catch {
      }
    }
  }
  recordAudit(context, triggeredRule, decision) {
    if (!this.options.enableAudit) return;
    const entry = {
      timestamp: context.now,
      inputSnapshot: structuredClone(context),
      triggeredRule,
      decision
    };
    this.auditLog.push(entry);
    if (this.auditLog.length > this.options.maxAuditEntries) {
      this.auditLog.shift();
    }
  }
};
export {
  AccountRiskEvaluator,
  PositionRiskEvaluator,
  RiskEngine,
  calculateMarginUsagePct,
  calculatePnlPct,
  createInitialState,
  deepMerge,
  formatPct,
  getPositionKey,
  parseDuration
};
