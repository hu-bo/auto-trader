import type { OrderSide, PositionSide, TradeType } from '@/types'

export type FuturesActionMode = 'open' | 'close'
export type FuturesPositionSide = Exclude<PositionSide, 'both'>

export interface TradeAction {
  key: string
  label: string
  side: OrderSide
  positionSide?: FuturesPositionSide
}

export function getTradeActionPair(
  tradeType: TradeType,
  futuresActionMode: FuturesActionMode,
): { left: TradeAction; right: TradeAction } {
  if (tradeType === 'spot') {
    return {
      left: { key: 'spot-buy', label: 'BUY', side: 'buy' },
      right: { key: 'spot-sell', label: 'SELL', side: 'sell' },
    }
  }

  if (futuresActionMode === 'open') {
    return {
      left: { key: 'open-long', label: '开多', side: 'buy', positionSide: 'long' },
      right: { key: 'open-short', label: '开空', side: 'sell', positionSide: 'short' },
    }
  }

  return {
    left: { key: 'close-short', label: '平空', side: 'buy', positionSide: 'short' },
    right: { key: 'close-long', label: '平多', side: 'sell', positionSide: 'long' },
  }
}
