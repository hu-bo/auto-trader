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
export function parseDuration(duration: number | string): number {
  if (typeof duration === 'number') {
    return duration;
  }

  const match = duration.match(/^(\d+(?:\.\d+)?)(ms|s|m|h|d)$/);
  if (!match) {
    throw new Error(`Invalid duration format: ${duration}`);
  }

  const value = parseFloat(match[1]!);
  const unit = match[2]!;

  const multipliers: Record<string, number> = {
    ms: 1,
    s: 1000,
    m: 60 * 1000,
    h: 60 * 60 * 1000,
    d: 24 * 60 * 60 * 1000,
  };

  return value * multipliers[unit]!;
}

/**
 * 生成仓位唯一键
 */
export function getPositionKey(symbol: string, side: 'LONG' | 'SHORT'): string {
  return `${symbol}:${side}`;
}

/**
 * 计算仓位盈亏率（基于 margin）
 */
export function calculatePnlPct(position: {
  unrealizedPnl: number;
  marginUsed: number;
}): number {
  if (position.marginUsed === 0) {
    return 0;
  }
  return position.unrealizedPnl / position.marginUsed;
}

/**
 * 计算保证金使用率
 */
export function calculateMarginUsagePct(account: {
  marginUsed: number;
  equity: number;
}): number {
  if (account.equity === 0) {
    return 0;
  }
  return account.marginUsed / account.equity;
}

/**
 * 格式化数字为百分比字符串
 */
export function formatPct(value: number, decimals = 2): string {
  return `${(value * 100).toFixed(decimals)}%`;
}

/**
 * 深度合并对象
 */
export function deepMerge<T extends object>(target: T, source: Partial<T>): T {
  const result = { ...target };

  for (const key in source) {
    if (Object.prototype.hasOwnProperty.call(source, key)) {
      const sourceValue = source[key];
      const targetValue = result[key];

      if (
        sourceValue !== undefined &&
        typeof sourceValue === 'object' &&
        sourceValue !== null &&
        !Array.isArray(sourceValue) &&
        typeof targetValue === 'object' &&
        targetValue !== null &&
        !Array.isArray(targetValue)
      ) {
        result[key] = deepMerge(
          targetValue as object,
          sourceValue as object
        ) as T[Extract<keyof T, string>];
      } else if (sourceValue !== undefined) {
        result[key] = sourceValue as T[Extract<keyof T, string>];
      }
    }
  }

  return result;
}

/**
 * 创建初始风控状态
 */
export function createInitialState(): {
  accountBlocked: boolean;
  positions: Map<string, { lastBreachAt: number }>;
} {
  return {
    accountBlocked: false,
    positions: new Map(),
  };
}
