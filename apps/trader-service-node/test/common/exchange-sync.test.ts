import assert from 'assert';
import { truncateToIncrement, truncateToPrecision } from '../../src/common/exchange-sync.js';

describe('common/exchange-sync', () => {
  it('aligns price by tick size instead of decimal precision', () => {
    assert.strictEqual(truncateToIncrement(143.247, '0.05'), 143.2);
    assert.strictEqual(truncateToIncrement(143.299, '0.05'), 143.25);
  });

  it('aligns quantity by step size', () => {
    assert.strictEqual(truncateToIncrement(0.123456, '0.001'), 0.123);
    assert.strictEqual(truncateToIncrement(17.9, '1'), 17);
  });

  it('falls back to decimal precision truncation when needed', () => {
    assert.strictEqual(truncateToPrecision(143.247, 2), 143.24);
    assert.strictEqual(truncateToPrecision(0.123456, 3), 0.123);
  });
});
