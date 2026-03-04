import type { TradeType, PositionSide } from './exchange'

export type OrderSide = 'buy' | 'sell'
export type OrderType = 'market' | 'limit' | 'stop_market' | 'stop_limit'
export type OrderStatus = 'new' | 'partially_filled' | 'filled' | 'canceled' | 'rejected' | 'expired'

export interface Order {
  orderid: string
  exchangeId: string
  symbol: string
  tradeType: TradeType
  side: OrderSide
  orderType: OrderType
  status: OrderStatus
  price: number | null
  quantity: number
  executedQty: number
  avgPrice: number | null
  positionSide?: PositionSide
  leverage?: number
  reduceOnly?: boolean
  clientOrderId?: string
  createdAt: string
  updatedAt: string
}

export interface PlaceOrderParams {
  exchangeId: string
  symbol: string
  tradeType: TradeType
  side: OrderSide
  orderType: OrderType
  quantity: number
  price?: number
  positionSide?: PositionSide
  leverage?: number
  clientOrderId?: string
  reduceOnly?: boolean
}

export interface OrderQuery {
  exchangeId: string
  symbol?: string
  status?: OrderStatus
  limit?: number
  offset?: number
}

export interface CancelOrderParams {
  exchangeId: string
  orderId: string
  symbol?: string
}
