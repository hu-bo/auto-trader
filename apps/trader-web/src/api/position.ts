import { requestData } from './api'
import type {
  Position,
  PositionQuery,
  ClosePositionParams,
  SetLeverageParams,
  AccountBalance,
  TradeType,
} from '@/types'

interface PositionListResponse {
  positions: Position[]
  total: number
}

export const positionApi = {
  // 获取持仓列表
  list: (params: PositionQuery) =>
    requestData.get<PositionListResponse>('/positions', params as Record<string, unknown>),

  // 同步持仓
  sync: (exchangeId: string) =>
    requestData.post<PositionListResponse>('/positions/sync', null, {
      params: { exchange_id: exchangeId },
    } as never),

  // 平仓
  close: (positionId: string, params: ClosePositionParams) =>
    requestData.post<Position>(`/positions/${positionId}/close`, params),
}

export const accountApi = {
  // 获取账户余额
  getBalance: (exchangeId: string, tradeType: TradeType) =>
    requestData.get<AccountBalance>('/balance', { exchange_id: exchangeId, trade_type: tradeType }),

  // 设置杠杆
  setLeverage: (params: SetLeverageParams) => requestData.post<unknown>('/leverage', params),
}
