import { PositionRiskEvaluator } from './PositionRiskEvaluator.js';
import type {
  PositionRiskConfig,
  PositionSnapshot,
  RiskContext,
  RiskState,
  SymbolRiskOverride,
} from '../types.js';
import { getPositionKey } from '../utils.js';

describe('PositionRiskEvaluator', () => {
  const defaultConfig: PositionRiskConfig = {
    stopProfitPct: 1.5,
    stopLossPct: 0.8,
    onBreach: 'CLOSE_POSITION',
    cooldown: '15m',
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

  const createContext = (positions: PositionSnapshot[]): RiskContext => ({
    now: Date.now(),
    account: {
      equity: 10000,
      dailyPnl: 0,
      marginUsed: 5000,
      marginAvailable: 5000,
    },
    positions,
  });

  const createState = (): RiskState => ({
    accountBlocked: false,
    positions: new Map(),
  });

  describe('stop profit', () => {
    it('should trigger when pnlPct exceeds stopProfitPct', () => {
      const evaluator = new PositionRiskEvaluator(defaultConfig);
      const position = createPosition({
        marginUsed: 1000,
        unrealizedPnl: 1500, // 150% profit
      });
      const context = createContext([position]);
      const results = evaluator.evaluate(context, createState());

      expect(results).toHaveLength(1);
      expect(results[0]!.triggered).toBe(true);
      expect(results[0]!.decision?.action).toBe('CLOSE_POSITION');
      expect(results[0]!.decision?.reason).toContain('Take profit');
    });

    it('should not trigger when pnlPct is below stopProfitPct', () => {
      const evaluator = new PositionRiskEvaluator(defaultConfig);
      const position = createPosition({
        marginUsed: 1000,
        unrealizedPnl: 1400, // 140% profit
      });
      const context = createContext([position]);
      const results = evaluator.evaluate(context, createState());

      expect(results).toHaveLength(0);
    });
  });

  describe('stop loss', () => {
    it('should trigger when pnlPct exceeds stopLossPct', () => {
      const evaluator = new PositionRiskEvaluator(defaultConfig);
      const position = createPosition({
        marginUsed: 1000,
        unrealizedPnl: -800, // -80% loss
      });
      const context = createContext([position]);
      const results = evaluator.evaluate(context, createState());

      expect(results).toHaveLength(1);
      expect(results[0]!.triggered).toBe(true);
      expect(results[0]!.decision?.action).toBe('CLOSE_POSITION');
      expect(results[0]!.decision?.reason).toContain('Stop loss');
    });

    it('should not trigger when loss is within limit', () => {
      const evaluator = new PositionRiskEvaluator(defaultConfig);
      const position = createPosition({
        marginUsed: 1000,
        unrealizedPnl: -700, // -70% loss
      });
      const context = createContext([position]);
      const results = evaluator.evaluate(context, createState());

      expect(results).toHaveLength(0);
    });
  });

  describe('max loss per position', () => {
    it('should trigger when unrealizedPnl exceeds maxLossPerPosition', () => {
      const evaluator = new PositionRiskEvaluator({
        ...defaultConfig,
        maxLossPerPosition: 200,
      });
      const position = createPosition({
        marginUsed: 1000,
        unrealizedPnl: -250, // Only 25% loss but exceeds $200
      });
      const context = createContext([position]);
      const results = evaluator.evaluate(context, createState());

      expect(results).toHaveLength(1);
      expect(results[0]!.decision?.reason).toContain('Max loss per position');
    });
  });

  describe('reduce position', () => {
    it('should include reduceRatio in decision params', () => {
      const evaluator = new PositionRiskEvaluator({
        ...defaultConfig,
        onBreach: 'REDUCE_POSITION',
        reduceRatio: 0.5,
      });
      const position = createPosition({
        marginUsed: 1000,
        unrealizedPnl: -1000, // -100% loss
      });
      const context = createContext([position]);
      const results = evaluator.evaluate(context, createState());

      expect(results).toHaveLength(1);
      expect(results[0]!.decision?.action).toBe('REDUCE_POSITION');
      expect(results[0]!.decision?.params?.reduceRatio).toBe(0.5);
    });
  });

  describe('symbol override', () => {
    it('should use symbol-specific config when available', () => {
      const symbolOverrides: Record<string, SymbolRiskOverride> = {
        BTCUSDT: {
          position: {
            stopProfitPct: 2.0,
            stopLossPct: 1.0,
          },
        },
      };
      const evaluator = new PositionRiskEvaluator(defaultConfig, symbolOverrides);

      // This would trigger with default config (150% > 150%) but not with override (150% < 200%)
      const position = createPosition({
        marginUsed: 1000,
        unrealizedPnl: 1500,
      });
      const context = createContext([position]);
      const results = evaluator.evaluate(context, createState());

      expect(results).toHaveLength(0);
    });

    it('should use default config for non-overridden symbols', () => {
      const symbolOverrides: Record<string, SymbolRiskOverride> = {
        BTCUSDT: {
          position: {
            stopProfitPct: 2.0,
          },
        },
      };
      const evaluator = new PositionRiskEvaluator(defaultConfig, symbolOverrides);

      const position = createPosition({
        symbol: 'ETHUSDT',
        marginUsed: 1000,
        unrealizedPnl: 1500, // 150% profit
      });
      const context = createContext([position]);
      const results = evaluator.evaluate(context, createState());

      expect(results).toHaveLength(1);
    });
  });

  describe('cooldown', () => {
    it('should skip position in cooldown period', () => {
      const evaluator = new PositionRiskEvaluator({
        ...defaultConfig,
        cooldown: 900000, // 15 minutes
      });
      const position = createPosition({
        marginUsed: 1000,
        unrealizedPnl: 2000,
      });
      const now = Date.now();
      const context: RiskContext = {
        now,
        account: {
          equity: 10000,
          dailyPnl: 0,
          marginUsed: 5000,
          marginAvailable: 5000,
        },
        positions: [position],
      };

      const state = createState();
      const key = getPositionKey(position.symbol, position.side);
      state.positions.set(key, { lastBreachAt: now - 60000 }); // 1 minute ago

      const results = evaluator.evaluate(context, state);

      expect(results).toHaveLength(0);
    });

    it('should trigger after cooldown period expires', () => {
      const evaluator = new PositionRiskEvaluator({
        ...defaultConfig,
        cooldown: 900000, // 15 minutes
      });
      const position = createPosition({
        marginUsed: 1000,
        unrealizedPnl: 2000,
      });
      const now = Date.now();
      const context: RiskContext = {
        now,
        account: {
          equity: 10000,
          dailyPnl: 0,
          marginUsed: 5000,
          marginAvailable: 5000,
        },
        positions: [position],
      };

      const state = createState();
      const key = getPositionKey(position.symbol, position.side);
      state.positions.set(key, { lastBreachAt: now - 1000000 }); // 16+ minutes ago

      const results = evaluator.evaluate(context, state);

      expect(results).toHaveLength(1);
    });
  });

  describe('empty positions', () => {
    it('should skip positions with qty = 0', () => {
      const evaluator = new PositionRiskEvaluator(defaultConfig);
      const position = createPosition({
        qty: 0,
        marginUsed: 1000,
        unrealizedPnl: 2000,
      });
      const context = createContext([position]);
      const results = evaluator.evaluate(context, createState());

      expect(results).toHaveLength(0);
    });
  });

  describe('multiple positions', () => {
    it('should evaluate all positions', () => {
      const evaluator = new PositionRiskEvaluator(defaultConfig);
      const positions = [
        createPosition({
          symbol: 'BTCUSDT',
          marginUsed: 1000,
          unrealizedPnl: 2000, // triggers
        }),
        createPosition({
          symbol: 'ETHUSDT',
          marginUsed: 1000,
          unrealizedPnl: -1000, // triggers
        }),
        createPosition({
          symbol: 'BNBUSDT',
          marginUsed: 1000,
          unrealizedPnl: 100, // does not trigger
        }),
      ];
      const context = createContext(positions);
      const results = evaluator.evaluate(context, createState());

      expect(results).toHaveLength(2);
    });
  });
});
