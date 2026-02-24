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
  user_id: string
  strategy_id: string
  strategy_name: string
  exchange_id: string
  exchange_name: string
  exchange_type: string
  symbols: string[]
  parameters: Record<string, unknown>
  risk_config: RiskConfig
  live: boolean
  is_running: boolean
  started_at: string | null
  stopped_at: string | null
  created_at: string
  updated_at: string
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
