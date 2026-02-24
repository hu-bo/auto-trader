import { requestData } from './api'
import type {
  StrategyOrder,
  StrategyOrderCreate,
  StrategyOrderUpdate,
  StrategyOrderStats,
} from '@/types'

export interface StrategyOrderListParams {
  page?: number
  pageSize?: number
}

export interface StrategyOrderListResponse {
  data: StrategyOrder[]
  total: number
  page: number
  pageSize: number
}

export const strategyOrderApi = {
  // 获取策略订单列表
  list: (params?: StrategyOrderListParams) => 
    requestData.get<StrategyOrderListResponse>('/strategy-order', { params }),

  // 获取策略订单详情
  get: (id: string) => requestData.get<StrategyOrder>(`/strategy-order/${id}`),

  // 创建策略订单
  create: (data: StrategyOrderCreate) =>
    requestData.post<StrategyOrder>('/strategy-order', data),

  // 更新策略订单
  update: (id: string, data: StrategyOrderUpdate) =>
    requestData.put<StrategyOrder>(`/strategy-order/${id}`, data),

  // 删除策略订单
  delete: (id: string) => requestData.delete<null>(`/strategy-order/${id}`),

  // 启动策略订单
  start: (id: string) => requestData.post<StrategyOrder>(`/strategy-order/${id}/start`),

  // 停止策略订单
  stop: (id: string) => requestData.post<StrategyOrder>(`/strategy-order/${id}/stop`),

  // 获取策略订单统计
  getStats: (id: string) => requestData.get<StrategyOrderStats>(`/strategy-order/${id}/stats`),
}
