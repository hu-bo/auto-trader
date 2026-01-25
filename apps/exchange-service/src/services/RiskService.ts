import {
  RiskEngine,
  type RiskConfig,
  type RiskContext,
  type RiskDecision,
  type PositionSnapshot,
  type AccountSnapshot,
} from '@hquant/risk-model';
import type {
  PlaceOrderParams,
  Position,
  Balance,
  TradeType,
} from '@hquant/exchange-adapter';
import { riskConfig } from '../config/index.js';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('RiskService');

export interface RiskCheckResult {
  allowed: boolean;
  decisions: RiskDecision[];
  reason?: string;
}

export class RiskService {
  private engines: Map<string, RiskEngine> = new Map();
  private defaultConfig: RiskConfig;

  constructor() {
    this.defaultConfig = {
      account: {
        maxDailyLoss: riskConfig.maxDailyLoss,
        maxMarginUsagePct: riskConfig.maxMarginUsagePct,
        onBreach: 'BLOCK_TRADING',
      },
      position: {
        stopProfitPct: riskConfig.defaultStopProfitPct,
        stopLossPct: riskConfig.defaultStopLossPct,
        onBreach: 'CLOSE_POSITION',
        cooldown: '15m',
      },
    };
  }

  /**
   * Get or create a risk engine for an account
   */
  getEngine(token: string, customConfig?: Partial<RiskConfig>): RiskEngine {
    let engine = this.engines.get(token);
    if (!engine) {
      const config = this.mergeConfig(customConfig);
      engine = new RiskEngine(config, { enableAudit: true });
      this.engines.set(token, engine);
      logger.info({ token }, 'Risk engine created');
    }
    return engine;
  }

  /**
   * Check if an order is allowed by risk rules
   */
  async checkOrder(
    token: string,
    orderParams: PlaceOrderParams,
    positions: Position[],
    balances: Balance[],
    currentPrice: number,
    customConfig?: Partial<RiskConfig>
  ): Promise<RiskCheckResult> {
    if (!riskConfig.enabled) {
      return { allowed: true, decisions: [] };
    }

    const engine = this.getEngine(token, customConfig);

    // Build risk context
    const context = this.buildRiskContext(orderParams, positions, balances, currentPrice);

    // Evaluate risk
    const decisions = engine.evaluate(context);

    // Check for blocking decisions
    const blockingDecision = decisions.find(
      (d) => d.action === 'BLOCK_TRADING' || d.action === 'CLOSE_ALL'
    );

    if (blockingDecision) {
      logger.warn({ token, decision: blockingDecision }, 'Order blocked by risk control');
      return {
        allowed: false,
        decisions,
        reason: blockingDecision.reason,
      };
    }

    // Check account blocked state
    if (engine.isAccountBlocked()) {
      logger.warn({ token }, 'Account is blocked');
      return {
        allowed: false,
        decisions,
        reason: 'Account is blocked due to risk breach',
      };
    }

    return { allowed: true, decisions };
  }

  /**
   * Evaluate current risk state
   */
  evaluateRisk(
    token: string,
    positions: Position[],
    balances: Balance[],
    markPrices: Map<string, number>,
    customConfig?: Partial<RiskConfig>
  ): RiskDecision[] {
    if (!riskConfig.enabled) {
      return [];
    }

    const engine = this.getEngine(token, customConfig);

    // Calculate account snapshot
    const accountSnapshot = this.calculateAccountSnapshot(balances, positions);

    // Build position snapshots
    const positionSnapshots = this.buildPositionSnapshots(positions, markPrices);

    const context: RiskContext = {
      now: Date.now(),
      account: accountSnapshot,
      positions: positionSnapshots,
    };

    return engine.evaluate(context);
  }

  /**
   * Reset account block state
   */
  resetAccountBlock(token: string): void {
    const engine = this.engines.get(token);
    if (engine) {
      engine.resetAccountBlock();
      logger.info({ token }, 'Account block reset');
    }
  }

  /**
   * Check if account is blocked
   */
  isAccountBlocked(token: string): boolean {
    const engine = this.engines.get(token);
    return engine?.isAccountBlocked() ?? false;
  }

  /**
   * Get risk engine state
   */
  getState(token: string) {
    const engine = this.engines.get(token);
    return engine?.getState();
  }

  /**
   * Get audit log
   */
  getAuditLog(token: string) {
    const engine = this.engines.get(token);
    return engine?.getAuditLog() ?? [];
  }

  /**
   * Remove risk engine for an account
   */
  removeEngine(token: string): void {
    const engine = this.engines.get(token);
    if (engine) {
      engine.destroy();
      this.engines.delete(token);
      logger.info({ token }, 'Risk engine removed');
    }
  }

  /**
   * Build risk context for order check
   */
  private buildRiskContext(
    orderParams: PlaceOrderParams,
    positions: Position[],
    balances: Balance[],
    currentPrice: number
  ): RiskContext {
    const accountSnapshot = this.calculateAccountSnapshot(balances, positions);

    // Build position snapshots with current price as mark price
    const markPrices = new Map<string, number>();
    markPrices.set(orderParams.symbol, currentPrice);
    const positionSnapshots = this.buildPositionSnapshots(positions, markPrices);

    return {
      now: Date.now(),
      account: accountSnapshot,
      positions: positionSnapshots,
    };
  }

  /**
   * Calculate account snapshot from balances and positions
   */
  private calculateAccountSnapshot(
    balances: Balance[],
    positions: Position[]
  ): AccountSnapshot {
    // Sum up USDT balance (or main quote currency)
    const usdtBalance = balances.find((b) => b.asset === 'USDT');
    const totalBalance = parseFloat(usdtBalance?.total ?? '0');
    const availableBalance = parseFloat(usdtBalance?.free ?? '0');

    // Calculate unrealized PnL
    const unrealizedPnl = positions.reduce(
      (sum, p) => sum + parseFloat(p.unrealizedPnl),
      0
    );

    // Calculate margin used (approximate)
    const marginUsed = totalBalance - availableBalance;

    return {
      equity: totalBalance + unrealizedPnl,
      dailyPnl: unrealizedPnl, // Simplified: use unrealized PnL as daily PnL
      marginUsed,
      marginAvailable: availableBalance,
    };
  }

  /**
   * Build position snapshots
   */
  private buildPositionSnapshots(
    positions: Position[],
    markPrices: Map<string, number>,
    defaultMarket: 'FUTURES' | 'DELIVERY' | 'SPOT' = 'FUTURES'
  ): PositionSnapshot[] {
    return positions
      .filter((p) => parseFloat(p.positionAmt) !== 0)
      .map((p) => {
        const markPrice = markPrices.get(p.symbol) ?? parseFloat(p.entryPrice);
        const qty = Math.abs(parseFloat(p.positionAmt));
        const entryPrice = parseFloat(p.entryPrice);

        return {
          symbol: p.symbol,
          market: defaultMarket,
          side: p.positionSide.toUpperCase() as 'LONG' | 'SHORT',
          qty,
          entryPrice,
          markPrice,
          marginUsed: (qty * entryPrice) / p.leverage,
          unrealizedPnl: parseFloat(p.unrealizedPnl),
          leverage: p.leverage,
        };
      });
  }

  /**
   * Map trade type to risk model market type
   */
  private mapTradeType(tradeType: string): 'FUTURES' | 'DELIVERY' | 'SPOT' {
    switch (tradeType) {
      case 'futures':
        return 'FUTURES';
      case 'delivery':
        return 'DELIVERY';
      case 'spot':
        return 'SPOT';
      default:
        return 'FUTURES';
    }
  }

  /**
   * Merge custom config with default config
   */
  private mergeConfig(customConfig?: Partial<RiskConfig>): RiskConfig {
    if (!customConfig) {
      return this.defaultConfig;
    }

    return {
      account: { ...this.defaultConfig.account, ...customConfig.account },
      position: { ...this.defaultConfig.position, ...customConfig.position },
      symbols: customConfig.symbols,
    };
  }
}

// Singleton instance
let riskService: RiskService | null = null;

export function getRiskService(): RiskService {
  if (!riskService) {
    riskService = new RiskService();
  }
  return riskService;
}
