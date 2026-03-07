export type ExchangeType = 'binance' | 'okx' | 'bybit'

export interface Exchange {
  id: number
  userId: string
  exchangeType: ExchangeType
  name: string
  apiKey?: string
  apiSecret?: string
  passphrase?: string
  isTestnet?: boolean
  isActive: boolean
  createdAt?: string
  updatedAt?: string
}

export type ExchangeCreate =
  Pick<Exchange, 'exchangeType' | 'name'> &
  Required<Pick<Exchange, 'apiKey' | 'apiSecret'>> &
  Partial<Pick<Exchange, 'passphrase' | 'isTestnet' | 'isActive'>>

export type ExchangeUpdate =
  Pick<Exchange, 'id'> &
  Partial<Pick<Exchange, 'name' | 'exchangeType' | 'apiKey' | 'apiSecret' | 'passphrase' | 'isTestnet' | 'isActive'>>

export interface ExchangeTestResult {
  initialized: boolean
  exchange: string
  token: string
  valid: boolean
  error?: { code: string; message: string }
}
