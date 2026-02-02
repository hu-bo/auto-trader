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
  version: string
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
  version?: string
  status?: StrategyStatus
  isPublic?: boolean
}

export interface StrategyUpdate {
  name?: string
  description?: string
  tag?: StrategyTag
  code?: string
  params?: Record<string, unknown>
  version?: string
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

// 策略订单
export interface StrategyOrder {
  id: string
  userId: string
  strategyId: string
  exchangeId: string
  symbols: string[]
  parameters: Record<string, unknown>
  riskConfig: RiskConfig
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
  symbols: string[]
  parameters?: Record<string, unknown>
  riskConfig?: RiskConfig
  live?: boolean
}

export interface StrategyOrderUpdate {
  symbols?: string[]
  parameters?: Record<string, unknown>
  riskConfig?: RiskConfig
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
