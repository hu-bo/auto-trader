export type StrategyTag = 'neutral' | 'long' | 'short'
export type StrategyStatus = 'active' | 'inactive'

export interface Strategy {
  id: string
  userId: string
  name: string
  description: string
  tag: StrategyTag
  code: string
  params: Record<string, unknown>
  status: StrategyStatus
  isPublic: boolean
  createdAt: string
  updatedAt: string
}

export interface StrategyCreate {
  name: string
  description?: string
  tag?: StrategyTag
  code?: string
  params?: Record<string, unknown>
  status?: StrategyStatus
  isPublic?: boolean
}

export interface StrategyUpdate {
  name?: string
  description?: string
  tag?: StrategyTag
  code?: string
  params?: Record<string, unknown>
  status?: StrategyStatus
  isPublic?: boolean
}

// 风控配置
export interface RiskConfig {
  maxPositionSize?: number
  maxDailyLoss?: number
  maxDrawdown?: number
  stopLossPercent?: number
  takeProfitPercent?: number
  maxLeverage?: number
}

export interface RiskConfigPreset {
  id: string
  name: string
  riskConfig: RiskConfig
  createdAt: string
  updatedAt: string
}

// 策略订单
export interface StrategyOrder {
  id: string
  userid: string
  strategyId: string
  strategyName: string
  strategyParams: Record<string, unknown>
  exchangeId: string
  exchangeName: string
  exchangeType: string
  tradeType: string
  leverage: number
  orderType: string
  symbols: string[]
  riskConfigId: string | null
  riskConfig: RiskConfig
  buyPriceOffsetPercent: number
  sellPriceOffsetPercent: number
  stopLossPercent: number
  takeProfitPercent: number
  amountBuy: number
  amountSell: number
  amountBuyLong: number
  amountSellLong: number
  amountBuyShort: number
  amountSellShort: number
  live: boolean
  isRunning: boolean
  startedAt: string | null
  stoppedAt: string | null
  createdAt: string
  updatedAt: string
}

export interface StrategyOrderCreate {
  strategyId: string
  exchangeId: string
  tradeType?: string
  leverage?: number
  orderType?: string
  symbols: string[]
  riskConfig?: RiskConfig
  buyPriceOffsetPercent?: number
  sellPriceOffsetPercent?: number
  stopLossPercent?: number
  takeProfitPercent?: number
  // spot 金额
  amountBuy?: number
  amountSell?: number
  // futures 金额
  amountBuyLong?: number
  amountSellLong?: number
  amountBuyShort?: number
  amountSellShort?: number
  live?: boolean
}

export interface StrategyOrderUpdate {
  strategyId?: string
  symbols?: string[]
  riskConfig?: RiskConfig
  leverage?: number
  orderType?: string
  buyPriceOffsetPercent?: number
  sellPriceOffsetPercent?: number
  stopLossPercent?: number
  takeProfitPercent?: number
  // spot 金额
  amountBuy?: number
  amountSell?: number
  // futures 金额
  amountBuyLong?: number
  amountSellLong?: number
  amountBuyShort?: number
  amountSellShort?: number
  live?: boolean
}

export interface StrategyOrderStats {
  totalTrades: number
  winTrades: number
  lossTrades: number
  totalPnl: number
  winRate: number
  avgProfit: number
  avgLoss: number
  maxDrawdown: number
}
