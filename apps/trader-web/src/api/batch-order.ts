import { requestData } from './api'

export interface PlaceBatchStrategyParams {
  exchangeId: number
  tradeType: string
  symbols: string[]
  side: 'buy' | 'sell'                // 方向
  orderType?: 'algo'                  // 条件委托
  positionSide?: 'long' | 'short'    // 合约可选，现货忽略
  amountUSDT: number
  priceOffsetPercent: number
  stopLossPercent: number
  takeProfitPercent: number
  leverage?: number
}

export interface PlaceBatchStrategyResult {
  successCount: number
  failedCount: number
  symbols?: string[]
  results: Array<{
    success: boolean
    order?: any
    error?: { code: string; message: string }
    symbol?: string
  }>
}

export interface CheckDuplicatesParams {
  exchangeId: number
  tradeType: string
}

export interface CheckDuplicatesResult {
  openOrders: Array<{
    algo_id: string
    symbol: string
    strategy_type: string
    side: string
    trigger_price: string
    quantity: string
    status: string
  }>
}

export const batchOrderApi = {
  placeBatchStrategy: (params: PlaceBatchStrategyParams) =>
    requestData.post<PlaceBatchStrategyResult>('/orders/batch-strategy', params),

  checkDuplicates: (params: CheckDuplicatesParams) =>
    requestData.post<CheckDuplicatesResult>('/orders/batch-strategy/check-duplicates', params),
}
