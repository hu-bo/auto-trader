import { RiskEngine } from './RiskEngine.js';
import type { PositionSnapshot, RiskConfig, RiskContext, RiskDecision } from './types.js';

describe('RiskEngine', () => {
  const defaultConfig: RiskConfig = {
    account: {
      maxDailyLoss: 500,
      maxMarginUsagePct: 0.8,
      onBreach: 'BLOCK_TRADING',
    },
    position: {
      stopProfitPct: 1.5,
      stopLossPct: 0.8,
      onBreach: 'CLOSE_POSITION',
      cooldown: '15m',
    },
    symbols: {
      BTCUSDT: {
        position: {
          stopProfitPct: 2.0,
          stopLossPct: 1.0,
        },
      },
    },
  };

  const createPosition = (overrides: Partial<PositionSnapshot> = {}): PositionSnapshot => ({
    symbol: 'BTCUSDT',
    market: 'FUTURES',
    side: 'LONG',
    qty: 1,
    entryPrice: 50000,
    markPrice: 50000,
    marginUsed: 1000,
    unrealizedPnl: 0,
    ...overrides,
  });

  const createContext = (overrides: Partial<RiskContext> = {}): RiskContext => ({
    now: Date.now(),
    account: {
      equity: 10000,
      dailyPnl: 0,
      marginUsed: 5000,
      marginAvailable: 5000,
    },
    positions: [],
    ...overrides,
  });

  describe('evaluate', () => {
    it('should return empty array when no risks triggered', () => {
      const engine = new RiskEngine(defaultConfig);
      const context = createContext();
      const decisions = engine.evaluate(context);

      expect(decisions).toHaveLength(0);
    });

    it('should trigger account level risk', () => {
      const engine = new RiskEngine(defaultConfig);
      const context = createContext({
        account: {
          equity: 10000,
          dailyPnl: -600,
          marginUsed: 5000,
          marginAvailable: 5000,
        },
      });
      const decisions = engine.evaluate(context);

      expect(decisions).toHaveLength(1);
      expect(decisions[0]!.level).toBe('ACCOUNT');
      expect(decisions[0]!.action).toBe('BLOCK_TRADING');
    });

    it('should trigger position level risk', () => {
      const engine = new RiskEngine(defaultConfig);
      const context = createContext({
        positions: [
          createPosition({
            symbol: 'ETHUSDT',
            marginUsed: 1000,
            unrealizedPnl: 1600, // 160% profit
          }),
        ],
      });
      const decisions = engine.evaluate(context);

      expect(decisions).toHaveLength(1);
      expect(decisions[0]!.level).toBe('POSITION');
      expect(decisions[0]!.symbol).toBe('ETHUSDT');
    });

    it('should block position evaluation when account is blocked', () => {
      const engine = new RiskEngine(defaultConfig);

      // First trigger account block
      const context1 = createContext({
        account: {
          equity: 10000,
          dailyPnl: -600,
          marginUsed: 5000,
          marginAvailable: 5000,
        },
        positions: [
          createPosition({
            marginUsed: 1000,
            unrealizedPnl: 2000, // Would trigger position risk
          }),
        ],
      });
      const decisions1 = engine.evaluate(context1);

      // Should only have account decision
      expect(decisions1).toHaveLength(1);
      expect(decisions1[0]!.level).toBe('ACCOUNT');

      // Subsequent evaluations should return empty (account blocked)
      const context2 = createContext({
        positions: [
          createPosition({
            marginUsed: 1000,
            unrealizedPnl: 3000, // Would trigger position risk
          }),
        ],
      });
      const decisions2 = engine.evaluate(context2);

      expect(decisions2).toHaveLength(0);
    });
  });

  describe('event handling', () => {
    it('should emit decisions to subscribers', () => {
      const engine = new RiskEngine(defaultConfig);
      const receivedDecisions: RiskDecision[] = [];

      engine.onDecision((decisions) => {
        receivedDecisions.push(...decisions);
      });

      const context = createContext({
        account: {
          equity: 10000,
          dailyPnl: -600,
          marginUsed: 5000,
          marginAvailable: 5000,
        },
      });
      engine.evaluate(context);

      expect(receivedDecisions).toHaveLength(1);
    });

    it('should support unsubscribing', () => {
      const engine = new RiskEngine(defaultConfig);
      const receivedDecisions: RiskDecision[] = [];

      const unsubscribe = engine.onDecision((decisions) => {
        receivedDecisions.push(...decisions);
      });

      unsubscribe();

      const context = createContext({
        account: {
          equity: 10000,
          dailyPnl: -600,
          marginUsed: 5000,
          marginAvailable: 5000,
        },
      });
      engine.evaluate(context);

      expect(receivedDecisions).toHaveLength(0);
    });
  });

  describe('state management', () => {
    it('should track account blocked state', () => {
      const engine = new RiskEngine(defaultConfig);

      expect(engine.isAccountBlocked()).toBe(false);

      const context = createContext({
        account: {
          equity: 10000,
          dailyPnl: -600,
          marginUsed: 5000,
          marginAvailable: 5000,
        },
      });
      engine.evaluate(context);

      expect(engine.isAccountBlocked()).toBe(true);
    });

    it('should allow resetting account block', () => {
      const engine = new RiskEngine(defaultConfig);

      const context = createContext({
        account: {
          equity: 10000,
          dailyPnl: -600,
          marginUsed: 5000,
          marginAvailable: 5000,
        },
      });
      engine.evaluate(context);

      expect(engine.isAccountBlocked()).toBe(true);

      engine.resetAccountBlock();

      expect(engine.isAccountBlocked()).toBe(false);
    });

    it('should track position cooldown', () => {
      const engine = new RiskEngine(defaultConfig);
      const now = Date.now();

      // First evaluation triggers
      const context1: RiskContext = {
        now,
        account: {
          equity: 10000,
          dailyPnl: 0,
          marginUsed: 5000,
          marginAvailable: 5000,
        },
        positions: [
          createPosition({
            symbol: 'ETHUSDT',
            marginUsed: 1000,
            unrealizedPnl: 2000,
          }),
        ],
      };
      const decisions1 = engine.evaluate(context1);
      expect(decisions1).toHaveLength(1);

      // Second evaluation within cooldown doesn't trigger
      const context2: RiskContext = {
        now: now + 60000, // 1 minute later
        account: {
          equity: 10000,
          dailyPnl: 0,
          marginUsed: 5000,
          marginAvailable: 5000,
        },
        positions: [
          createPosition({
            symbol: 'ETHUSDT',
            marginUsed: 1000,
            unrealizedPnl: 2000,
          }),
        ],
      };
      const decisions2 = engine.evaluate(context2);
      expect(decisions2).toHaveLength(0);
    });

    it('should allow resetting position cooldown', () => {
      const engine = new RiskEngine(defaultConfig);
      const now = Date.now();

      // Trigger position risk
      const context1: RiskContext = {
        now,
        account: {
          equity: 10000,
          dailyPnl: 0,
          marginUsed: 5000,
          marginAvailable: 5000,
        },
        positions: [
          createPosition({
            symbol: 'ETHUSDT',
            marginUsed: 1000,
            unrealizedPnl: 2000,
          }),
        ],
      };
      engine.evaluate(context1);

      // Reset cooldown
      engine.resetPositionCooldown('ETHUSDT', 'LONG');

      // Should trigger again
      const context2: RiskContext = {
        now: now + 1000,
        account: {
          equity: 10000,
          dailyPnl: 0,
          marginUsed: 5000,
          marginAvailable: 5000,
        },
        positions: [
          createPosition({
            symbol: 'ETHUSDT',
            marginUsed: 1000,
            unrealizedPnl: 2000,
          }),
        ],
      };
      const decisions = engine.evaluate(context2);
      expect(decisions).toHaveLength(1);
    });
  });

  describe('audit logging', () => {
    it('should record audit entries when enabled', () => {
      const engine = new RiskEngine(defaultConfig, { enableAudit: true });
      const context = createContext({
        account: {
          equity: 10000,
          dailyPnl: -600,
          marginUsed: 5000,
          marginAvailable: 5000,
        },
      });
      engine.evaluate(context);

      const auditLog = engine.getAuditLog();
      expect(auditLog).toHaveLength(1);
      expect(auditLog[0]!.triggeredRule).toBe('ACCOUNT');
      expect(auditLog[0]!.decision.action).toBe('BLOCK_TRADING');
    });

    it('should not record audit entries when disabled', () => {
      const engine = new RiskEngine(defaultConfig, { enableAudit: false });
      const context = createContext({
        account: {
          equity: 10000,
          dailyPnl: -600,
          marginUsed: 5000,
          marginAvailable: 5000,
        },
      });
      engine.evaluate(context);

      expect(engine.getAuditLog()).toHaveLength(0);
    });

    it('should limit audit log size', () => {
      const engine = new RiskEngine(defaultConfig, {
        enableAudit: true,
        maxAuditEntries: 3,
      });

      // Generate 5 entries
      for (let i = 0; i < 5; i++) {
        engine.resetAccountBlock();
        const context: RiskContext = {
          now: Date.now() + i * 1000,
          account: {
            equity: 10000,
            dailyPnl: -600,
            marginUsed: 5000,
            marginAvailable: 5000,
          },
          positions: [],
        };
        engine.evaluate(context);
      }

      expect(engine.getAuditLog()).toHaveLength(3);
    });

    it('should allow clearing audit log', () => {
      const engine = new RiskEngine(defaultConfig, { enableAudit: true });
      const context = createContext({
        account: {
          equity: 10000,
          dailyPnl: -600,
          marginUsed: 5000,
          marginAvailable: 5000,
        },
      });
      engine.evaluate(context);

      expect(engine.getAuditLog()).toHaveLength(1);

      engine.clearAuditLog();

      expect(engine.getAuditLog()).toHaveLength(0);
    });
  });

  describe('configuration', () => {
    it('should return current config', () => {
      const engine = new RiskEngine(defaultConfig);
      const config = engine.getConfig();

      expect(config).toEqual(defaultConfig);
    });
  });

  describe('destroy', () => {
    it('should clean up event handlers', () => {
      const engine = new RiskEngine(defaultConfig);
      const receivedDecisions: RiskDecision[] = [];

      engine.onDecision((decisions) => {
        receivedDecisions.push(...decisions);
      });

      // Trigger to create state
      const context = createContext({
        account: {
          equity: 10000,
          dailyPnl: -600,
          marginUsed: 5000,
          marginAvailable: 5000,
        },
      });
      engine.evaluate(context);
      expect(receivedDecisions).toHaveLength(1);

      engine.destroy();

      // Event handlers should be cleared - no new decisions received
      engine.resetAccountBlock();
      engine.evaluate(context);
      expect(receivedDecisions).toHaveLength(1); // Still 1, no new ones
    });

    it('should clear audit log', () => {
      const engine = new RiskEngine(defaultConfig, { enableAudit: true });

      const context = createContext({
        account: {
          equity: 10000,
          dailyPnl: -600,
          marginUsed: 5000,
          marginAvailable: 5000,
        },
      });
      engine.evaluate(context);
      expect(engine.getAuditLog()).toHaveLength(1);

      engine.destroy();
      expect(engine.getAuditLog()).toHaveLength(0);
    });
  });
});
