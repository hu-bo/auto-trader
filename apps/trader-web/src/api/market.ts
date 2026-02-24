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
  rawSymbol: string
  exchange: string
  tradeType: string
  baseCurrency: string
  quoteCurrency: string
  lastPrice: number
  openPrice24h: number
  priceChangePct24h: number
  quoteVolume24h: number
  pricePrecision: number
  quantityPrecision: number
  maxQty: string
  minQty: string
  stepSize: string
  tickSize: string
  status: string
  syncEnabled: boolean
  earliestDataTs: number
  latestSyncTs: number
  tickerEventTimeMs: number
}

export interface TickerData {
  exchange: string
  symbol: string
  tradeType: string
  lastPrice: number
  lastSz: number
  priceChange: number
  priceChangePct: number
  high24h: number
  low24h: number
  volume24h: number
  quoteVolume24h: number
  timestamp: number
  updatedAt: number
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

  getSymbols: (query: {exchange: string, tradeType: string }) =>
    requestData.get<SymbolData[]>('/market/symbols', { exchange: query.exchange, trade_type: query.tradeType || 'spot' })
      .then(res => {
        console.log(res)
        return res.symbols || []
      }),

  getSymbolsDetailed: (params: GetSymbolsParams) =>
    requestData.get<{ exchange: string; count: number; symbols: SymbolData[] }>(
      '/market/symbols',
      { ...params }
    ),

  getTickers: (params: { exchange: string; trade_type?: string }) =>
    requestData.get<{ exchange: string; tradeType: string; count: number; tickers: TickerData[] }>(
      '/market/tickers',
      { exchange: params.exchange, trade_type: params.trade_type || 'spot' }
    ),
}
