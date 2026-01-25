import { AccountRiskEvaluator } from './AccountRiskEvaluator.js';
import type { AccountRiskConfig, RiskContext, RiskState } from '../types.js';

describe('AccountRiskEvaluator', () => {
  const defaultConfig: AccountRiskConfig = {
    maxDailyLoss: 500,
    maxMarginUsagePct: 0.8,
    onBreach: 'BLOCK_TRADING',
  };

  const createContext = (overrides: Partial<RiskContext['account']> = {}): RiskContext => ({
    now: Date.now(),
    account: {
      equity: 10000,
      dailyPnl: 0,
      marginUsed: 5000,
      marginAvailable: 5000,
      ...overrides,
    },
    positions: [],
  });

  const createState = (): RiskState => ({
    accountBlocked: false,
    positions: new Map(),
  });

  describe('daily loss check', () => {
    it('should not trigger when dailyPnl is positive', () => {
      const evaluator = new AccountRiskEvaluator(defaultConfig);
      const context = createContext({ dailyPnl: 100 });
      const results = evaluator.evaluate(context, createState());

      expect(results).toHaveLength(0);
    });

    it('should not trigger when dailyPnl is within limit', () => {
      const evaluator = new AccountRiskEvaluator(defaultConfig);
      const context = createContext({ dailyPnl: -400 });
      const results = evaluator.evaluate(context, createState());

      expect(results).toHaveLength(0);
    });

    it('should trigger when dailyPnl exceeds limit', () => {
      const evaluator = new AccountRiskEvaluator(defaultConfig);
      const context = createContext({ dailyPnl: -500 });
      const results = evaluator.evaluate(context, createState());

      expect(results).toHaveLength(1);
      expect(results[0]!.triggered).toBe(true);
      expect(results[0]!.decision?.action).toBe('BLOCK_TRADING');
      expect(results[0]!.decision?.level).toBe('ACCOUNT');
    });

    it('should use CLOSE_ALL action when configured', () => {
      const evaluator = new AccountRiskEvaluator({
        ...defaultConfig,
        onBreach: 'CLOSE_ALL',
      });
      const context = createContext({ dailyPnl: -600 });
      const results = evaluator.evaluate(context, createState());

      expect(results[0]!.decision?.action).toBe('CLOSE_ALL');
    });
  });

  describe('margin usage check', () => {
    it('should not trigger when margin usage is within limit', () => {
      const evaluator = new AccountRiskEvaluator(defaultConfig);
      const context = createContext({ marginUsed: 7000, equity: 10000 }); // 70%
      const results = evaluator.evaluate(context, createState());

      expect(results).toHaveLength(0);
    });

    it('should trigger when margin usage exceeds limit', () => {
      const evaluator = new AccountRiskEvaluator(defaultConfig);
      const context = createContext({ marginUsed: 8000, equity: 10000 }); // 80%
      const results = evaluator.evaluate(context, createState());

      expect(results).toHaveLength(1);
      expect(results[0]!.triggered).toBe(true);
      expect(results[0]!.decision?.action).toBe('BLOCK_TRADING');
    });
  });

  describe('state handling', () => {
    it('should not trigger when account is already blocked', () => {
      const evaluator = new AccountRiskEvaluator(defaultConfig);
      const context = createContext({ dailyPnl: -600 });
      const state = createState();
      state.accountBlocked = true;

      const results = evaluator.evaluate(context, state);

      expect(results).toHaveLength(0);
    });
  });

  describe('priority', () => {
    it('should check daily loss first and return early', () => {
      const evaluator = new AccountRiskEvaluator(defaultConfig);
      // Both conditions would trigger
      const context = createContext({
        dailyPnl: -600,
        marginUsed: 9000,
        equity: 10000,
      });
      const results = evaluator.evaluate(context, createState());

      // Should only return one result (daily loss takes priority)
      expect(results).toHaveLength(1);
      expect(results[0]!.decision?.reason).toContain('Daily loss');
    });
  });
});
