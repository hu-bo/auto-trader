import { requestData } from './api'
import type { Strategy, StrategyCreate, StrategyUpdate } from '@/types'

export const strategyApi = {
  // 获取用户的策略列表
  list: () => requestData.get<Strategy[]>('/strategies'),

  // 获取可用策略列表（包括公开策略）
  listAvailable: () => requestData.get<Strategy[]>('/strategies/available'),

  // 获取策略详情
  get: (id: string) => requestData.get<Strategy>(`/strategies/${id}`),

  // 创建策略
  create: (data: StrategyCreate) => requestData.post<Strategy>('/strategies', data),

  // 更新策略
  update: (id: string, data: StrategyUpdate) =>
    requestData.put<Strategy>(`/strategies/${id}`, data),

  // 删除策略
  delete: (id: string) => requestData.delete<null>(`/strategies/${id}`),
}
