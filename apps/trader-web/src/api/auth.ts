import { CasdoorUser } from '@hquant/casdoor';
import { request } from './api'
import type { User, TokenResponse } from '@/types'

export const authApi = {
  // OAuth 回调
  callback: (code: string) =>
    request.get<{ token: TokenResponse; user: CasdoorUser }>('/auth/callback', { code }),

  // 登出
  logout: () => request.post<null>('/auth/logout'),

  // 获取当前用户信息
  getCurrentUser: () => request.get<User>('/user/current'),
}
