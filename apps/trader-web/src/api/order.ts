import { requestData } from './api'
import type { Order, PlaceOrderParams, OrderQuery } from '@/types'

interface OrderListResponse {
  orders: Order[]
  total: number
}

export const orderApi = {
  // 获取订单列表
  list: (params: OrderQuery) =>
    requestData.get<OrderListResponse>('/orders', params),

  // 获取订单详情
  get: (orderId: string, exchangeId: string) =>
    requestData.get<Order>(`/orders/${orderId}`, { exchangeId }),

  // 下单
  place: (params: PlaceOrderParams) => requestData.post<Order>('/orders', params),

  // 取消订单
  cancel: (orderId: string) =>
    requestData.post<Order>(`/orders/${orderId}/cancel`),
}
