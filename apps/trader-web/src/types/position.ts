import type { TradeType, PositionSide } from './exchange'
import type { OrderType } from './order'

export interface Position {
  id: string
  exchangeId: string
  symbol: string
  tradeType: TradeType
  positionSide: PositionSide
  quantity: number
  entryPrice: number
  markPrice: number
  liquidationPrice: number | null
  leverage: number
  marginType: 'isolated' | 'cross'
  unrealizedPnl: number
  realizedPnl: number
  marginRatio: number | null
  createdAt: string
  updatedAt: string
}

export interface PositionQuery {
  exchangeId: number
  symbol?: string
}

export interface ClosePositionParams {
  exchangeId: string
  orderType?: OrderType
  price?: number
  clientOrderId?: string
}

export interface SetLeverageParams {
  exchangeId: string
  symbol: string
  leverage: number
  tradeType: TradeType
  positionSide?: PositionSide
}

// 账户余额
export interface Balance {
  asset: string
  free: number
  locked: number
  total: number
}

export interface AccountBalance {
  balances: Balance[]
  totalEquity: number
  availableBalance: number
  usedMargin: number
  unrealizedPnl: number
}
