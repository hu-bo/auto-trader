import { requestData } from './api'
import type { Exchange, ExchangeCreate, ExchangeUpdate, ExchangeTestResult } from '@/types'

export const exchangeApi = {
  // 获取交易所列表
  list: () => requestData.get<Exchange[]>('/exchanges'),

  // 创建交易所
  create: (data: ExchangeCreate) => requestData.post<Exchange>('/exchanges', data),

  // 更新交易所
  update: (id: string, data: ExchangeUpdate) =>
    requestData.put<Exchange>(`/exchanges/${id}`, data),

  // 删除交易所
  delete: (id: string) => requestData.delete<null>(`/exchanges/${id}`),

  // 测试交易所连接
  test: (id: string) => requestData.post<ExchangeTestResult>(`/exchanges/${id}/test`),
}
