import { Backtest, HQuant, KlineAggregator, type AggregatorEvent, type Bar } from '..'

const MS_1M = 60_000

function makeBar(i: number, close: number): Bar {
  const open = close
  return {
    timestamp: i * MS_1M,
    open,
    high: open + 1,
    low: open - 1,
    close,
    volume: i + 1,
    buyVolume: (i + 1) * 0.5,
  }
}

function periodIs(p: string, want: '15m' | '1h'): boolean {
  const s = p.trim().toLowerCase()
  if (want === '15m') return s === '15m' || s === 'm15'
  return s === '1h' || s === 'h1'
}

describe('hquant-js e2e', () => {
  test('multi-period aggregation (KlineAggregator)', () => {
    const agg = new KlineAggregator('1m', ['15m', '1h'], 1000)

    const bars: Bar[] = []
    for (let i = 0; i < 61; i++) {
      bars.push(makeBar(i, 100 + i))
    }

    for (let i = 0; i < 15; i++) {
      agg.pushKline(bars[i])
    }
    const ev15m = agg.pushKline(bars[15]).filter((e) => periodIs(e.period, '15m'))
    expect(ev15m).toHaveLength(1)
    expect(ev15m[0].kind).toBe('KlineClosed')

    expect(ev15m[0].candle).toMatchObject({
      timestamp: 0,
      open: 100,
      high: 115,
      low: 99,
      close: 114,
      volume: 120,
      buyVolume: 60,
    })

    for (let i = 16; i < 60; i++) {
      agg.pushKline(bars[i])
    }
    const ev1h = agg.pushKline(bars[60]).filter((e) => periodIs(e.period, '1h'))
    expect(ev1h).toHaveLength(1)
    expect(ev1h[0].kind).toBe('KlineClosed')
    expect(ev1h[0].candle?.timestamp).toBe(0)
  })

  test('feed_bar stream +组合策略 (KlineAggregator + HQuant.pollSignals)', () => {
    const agg = new KlineAggregator('1m', ['15m'], 1000)
    const engine = new HQuant(256)

    const s1 = engine.addStrategy('alwaysBuy', 'IF close > 0 THEN BUY')
    const s2 = engine.addStrategy('alwaysSell', 'IF close > 0 THEN SELL')

    const events: AggregatorEvent[] = []
    for (let i = 0; i < 16; i++) {
      const bar = makeBar(i, 100 + i)
      events.push(...agg.pushKline(bar))
      engine.pushBar(bar)
    }

    expect(events.some((e) => e.kind === 'KlineClosed' && periodIs(e.period, '15m'))).toBe(true)

    const sigs = engine.pollSignals()
    const ids = new Set(sigs.map((s) => s.strategyId))
    expect(ids.has(s1)).toBe(true)
    expect(ids.has(s2)).toBe(true)
    expect(sigs.some((s) => s.action === 'BUY')).toBe(true)
    expect(sigs.some((s) => s.action === 'SELL')).toBe(true)
  })

  test('回测: HQuant signals drive Backtest', () => {
    const engine = new HQuant(256)
    engine.addStrategy('buySell', 'IF close < 99 THEN BUY\nIF close > 101 THEN SELL')

    const bt = new Backtest({
      marketType: 'spot',
      initialCapital: 1000,
      makerFee: 0,
      takerFee: 0,
    })

    const closes = [100, 98, 102]
    for (let i = 0; i < closes.length; i++) {
      const bar = makeBar(i, closes[i])
      engine.pushBar(bar)

      for (const s of engine.pollSignals()) {
        if (s.action === 'BUY') {
          bt.openPosition(bar.close, 1, 'LONG')
        } else if (s.action === 'SELL') {
          bt.closePosition(bar.close, 'LONG')
        }
      }
    }

    const result = bt.result()
    expect(result.totalTrades).toBe(1)
    expect(result.totalPnl).toBeGreaterThan(0)
  })
})
