export type ExchangeType = 'BINANCE' | 'OKX' | 'BYBIT' | 'BITGET' | 'GATE'

export interface Exchange {
  id: string
  userId: string
  exchangeType: ExchangeType
  name: string
  hasGrpcToken: boolean
  isTestnet: boolean
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export interface ExchangeCreate {
  exchangeType: ExchangeType
  name: string
  apiKey: string
  apiSecret: string
  passphrase?: string
  isTestnet?: boolean
  isActive?: boolean
}

export interface ExchangeUpdate {
  name?: string
  apiKey?: string
  apiSecret?: string
  passphrase?: string
  isTestnet?: boolean
  isActive?: boolean
}

export interface ExchangeTestResult {
  success: boolean
  message: string
  balance?: Record<string, number>
}

// 交易类型
export type TradeType = 'spot' | 'futures'

// 持仓模式
export type PositionSide = 'long' | 'short' | 'both'
