import {
  parseDuration,
  getPositionKey,
  calculatePnlPct,
  calculateMarginUsagePct,
  formatPct,
  deepMerge,
} from './utils.js';

describe('parseDuration', () => {
  it('should return number as-is', () => {
    expect(parseDuration(1000)).toBe(1000);
    expect(parseDuration(0)).toBe(0);
  });

  it('should parse milliseconds', () => {
    expect(parseDuration('100ms')).toBe(100);
  });

  it('should parse seconds', () => {
    expect(parseDuration('10s')).toBe(10000);
  });

  it('should parse minutes', () => {
    expect(parseDuration('15m')).toBe(900000);
    expect(parseDuration('1m')).toBe(60000);
  });

  it('should parse hours', () => {
    expect(parseDuration('1h')).toBe(3600000);
    expect(parseDuration('2h')).toBe(7200000);
  });

  it('should parse days', () => {
    expect(parseDuration('1d')).toBe(86400000);
  });

  it('should parse decimal values', () => {
    expect(parseDuration('1.5h')).toBe(5400000);
  });

  it('should throw on invalid format', () => {
    expect(() => parseDuration('invalid')).toThrow('Invalid duration format');
    expect(() => parseDuration('10x')).toThrow('Invalid duration format');
  });
});

describe('getPositionKey', () => {
  it('should generate correct key', () => {
    expect(getPositionKey('BTCUSDT', 'LONG')).toBe('BTCUSDT:LONG');
    expect(getPositionKey('ETHUSDT', 'SHORT')).toBe('ETHUSDT:SHORT');
  });
});

describe('calculatePnlPct', () => {
  it('should calculate PnL percentage correctly', () => {
    expect(calculatePnlPct({ unrealizedPnl: 100, marginUsed: 1000 })).toBe(0.1);
    expect(calculatePnlPct({ unrealizedPnl: -50, marginUsed: 100 })).toBe(-0.5);
    expect(calculatePnlPct({ unrealizedPnl: 200, marginUsed: 100 })).toBe(2.0);
  });

  it('should return 0 when marginUsed is 0', () => {
    expect(calculatePnlPct({ unrealizedPnl: 100, marginUsed: 0 })).toBe(0);
  });
});

describe('calculateMarginUsagePct', () => {
  it('should calculate margin usage correctly', () => {
    expect(calculateMarginUsagePct({ marginUsed: 5000, equity: 10000 })).toBe(0.5);
    expect(calculateMarginUsagePct({ marginUsed: 8000, equity: 10000 })).toBe(0.8);
  });

  it('should return 0 when equity is 0', () => {
    expect(calculateMarginUsagePct({ marginUsed: 100, equity: 0 })).toBe(0);
  });
});

describe('formatPct', () => {
  it('should format percentage correctly', () => {
    expect(formatPct(0.5)).toBe('50.00%');
    expect(formatPct(0.1234)).toBe('12.34%');
    expect(formatPct(1.5)).toBe('150.00%');
  });

  it('should respect decimal places', () => {
    expect(formatPct(0.12345, 1)).toBe('12.3%');
    expect(formatPct(0.12345, 4)).toBe('12.3450%');
  });
});

describe('deepMerge', () => {
  it('should merge simple objects', () => {
    const target = { a: 1, b: 2 };
    const source = { b: 3 };
    expect(deepMerge(target, source)).toEqual({ a: 1, b: 3 });
  });

  it('should merge nested objects', () => {
    const target = { a: { x: 1, y: 2 }, b: 3 };
    const source: Partial<typeof target> = { a: { x: 1, y: 10 } };
    expect(deepMerge(target, source)).toEqual({ a: { x: 1, y: 10 }, b: 3 });
  });

  it('should not mutate original objects', () => {
    const target = { a: 1, b: 2 };
    const source = { a: 10 };
    const result = deepMerge(target, source);
    expect(target).toEqual({ a: 1, b: 2 });
    expect(source).toEqual({ a: 10 });
    expect(result).toEqual({ a: 10, b: 2 });
  });

  it('should handle undefined values in source', () => {
    const target = { a: 1, b: 2 };
    const source: Partial<typeof target> = { a: undefined };
    expect(deepMerge(target, source)).toEqual({ a: 1, b: 2 });
  });
});
