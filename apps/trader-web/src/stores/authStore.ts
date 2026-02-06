import { create } from 'zustand'
import { authApi } from '@/api'
import type { User } from '@/types'

/**
 * 业务用户 Store
 *
 * 只负责管理从 /user/current 获取的业务用户信息。
 * SSO 认证状态（token、isAuthenticated、isLoading）由 @hquant/casdoor 的 useCasdoor() 管理。
 */

interface UserState {
  /** 业务用户（来自后端 /user/current） */
  user: User | null
  /** 是否正在加载业务用户 */
  userLoading: boolean
}

interface UserActions {
  setUser: (user: User | null) => void
  /** 从后端拉取最新业务用户信息 */
  fetchCurrentUser: () => Promise<User | null>
  /** 清除业务用户 */
  clearUser: () => void
}

type UserStore = UserState & UserActions

export const useAuthStore = create<UserStore>((set) => ({
  user: null,
  userLoading: false,

  setUser: (user) => set({ user }),

  fetchCurrentUser: async () => {
    set({ userLoading: true })
    try {
      const response = await authApi.getCurrentUser()
      const user = response.data as User
      set({ user, userLoading: false })
      return user
    } catch {
      set({ user: null, userLoading: false })
      return null
    }
  },

  clearUser: () => set({ user: null }),
}))
