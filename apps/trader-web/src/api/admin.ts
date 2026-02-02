import { requestData } from './api'
import type { User, UserStatusUpdate, Strategy, Order } from '@/types'

interface UserListResponse {
  users: User[]
  total: number
}

export const adminApi = {
  // 获取所有用户
  getUsers: (params?: { page?: number; pageSize?: number }) =>
    requestData.get<UserListResponse>('/admin/users', params),

  // 更新用户状态
  updateUserStatus: (userId: string, data: UserStatusUpdate) =>
    requestData.put<User>(`/admin/users/${userId}/status`, data),

  // 获取所有策略
  getStrategies: () => requestData.get<Strategy[]>('/admin/strategies'),

  // 获取所有订单
  getOrders: () => requestData.get<Order[]>('/admin/orders'),
}
