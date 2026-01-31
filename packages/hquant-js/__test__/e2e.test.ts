import { FuturesBacktest, MultiHQuant, type Bar } from '..'

const MS_15M = 15 * 60_000

function makeBar(i: number, close: number): Bar {
  const open = close
  return {
    timestamp: i * MS_15M,
    open,
    high: open + 1,
    low: open - 1,
    close,
    volume: 1,
    buyVolume: 0,
  }
}

describe('hquant-js e2e', () => {
  test('MultiHQuant + addMultiStrategy + feedBar + FuturesBacktest', () => {
    const mh = new MultiHQuant(256, ['15m', '4h'])

    const strategyId = mh.addMultiStrategy(
      'm',
      [
        'IF close@4h <= 105 AND close@15m <= 105 THEN BUY',
        'IF close@4h >= 115 AND close@15m >= 115 THEN SELL',
      ].join('\n')
    )

    const bt = new FuturesBacktest({
      initialMargin: 1000,
      leverage: 10,
      contractSize: 1,
      makerFeeRate: 0,
      takerFeeRate: 0,
      maintenanceMarginRate: 0.005,
    })

    const margin = 100
    let lastPrice = 100
    let sawBuy = false
    let sawSell = false

    for (let i = 0; i <= 32; i++) {
      let close: number
      if (i <= 15) close = 100
      else if (i === 16) close = 104
      else if (i <= 31) close = 106 + (i - 17)
      else close = 118

      const bar = makeBar(i, close)
      lastPrice = bar.close

      mh.feedBar(bar)
      bt.onPrice(bar.close)

      for (const s of mh.pollSignals()) {
        expect(s.strategyId).toBe(strategyId)

        if (s.action === 'BUY') {
          sawBuy = true
          bt.applySignal('BUY', bar.close, margin, 'LONG')
        } else if (s.action === 'SELL') {
          sawSell = true
          bt.applySignal('SELL', bar.close, margin, 'LONG')
        }
      }
    }

    const r = bt.result(lastPrice)
    expect(sawBuy).toBe(true)
    expect(sawSell).toBe(true)
    expect(r.liquidated).toBe(false)
    expect(r.profit).toBeGreaterThan(0)
    expect(bt.getPositions()).toHaveLength(0)
  })
})
