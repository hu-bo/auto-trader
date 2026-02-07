import { requestData } from './api'

export interface CandleData {
  symbol: string
  exchange: string
  trade_type: string
  period: string
  timestamp: number
  open: number
  high: number
  low: number
  close: number
  volume: number
  buy_volume: number
  symbol_family: string
}

export interface SymbolData {
  symbol: string
  exchange: string
  tradeType: string
  baseCurrency: string
  quoteCurrency: string
  lastPrice?: number
  quoteVolume24h?: number
  syncEnabled: boolean
}

export interface GetCandlesParams {
  exchange: string
  symbol: string
  trade_type?: string
  period?: string
  limit?: number
  start_time?: number
  end_time?: number
}

export interface GetSymbolsParams {
  exchange: string
  trade_type?: string
  symbol?: string
  orderBy?: string
  order?: string
}

export const marketApi = {
  getCandles: (params: GetCandlesParams) =>
    requestData.get<CandleData[]>('/market/candles', { ...params }),

  getCurrentCandle: (params: { exchange: string; symbol: string; period?: string }) =>
    requestData.get<CandleData>('/market/candle/current', { ...params }),

  getSymbols: (params: GetSymbolsParams) =>
    requestData.get<{ exchange: string; count: number; symbols: SymbolData[] }>(
      '/market/symbols',
      { ...params }
    ),
}
