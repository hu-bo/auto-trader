

// 交易类型
export type TradeType = 'spot' | 'futures'
// 持仓模式
export type PositionSide = 'long' | 'short' | 'both'
export type OrderSide = 'buy' | 'sell'
export type OrderType = 'market' | 'limit' | 'stop_market' | 'stop_limit' | 'algo'
export type OrderStatus = 'new' | 'partially_filled' | 'filled' | 'canceled' | 'rejected' | 'expired'

export interface Order {
  orderid: string
  exchangeId: number
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
  exchangeId: number
  symbol?: string
  status?: OrderStatus
  limit?: number
  offset?: number
  
}

export interface CancelOrderParams {
  orderId: string
  symbol?: string
}
