import { useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useCasdoor } from '@hquant/casdoor/client/react'
import type { CasdoorUser, TokenResponse } from '@hquant/casdoor'
import { useAuthStore } from '@/stores/authStore'
import { authApi } from '@/api'

/**
 * 统一认证 Hook
 *
 * 组合 casdoor（SSO 状态）+ authStore（业务用户）。
 * - SSO 层：token、isAuthenticated、isLoading、login/logout 由 useCasdoor() 提供
 * - 业务层：user（来自 /user/current）由 authStore 提供
 */
export function useAuth() {
  const navigate = useNavigate()
  const casdoor = useCasdoor()
  const { user, fetchCurrentUser, clearUser } = useAuthStore()

  const login = useCallback(() => {
    casdoor.login()
  }, [casdoor])

  const logout = useCallback(async () => {
    try {
      await authApi.logout()
    } catch {
      // 忽略登出错误
    } finally {
      clearUser()
      casdoor.logout()
    }
  }, [casdoor, clearUser])

  /**
   * OAuth 回调处理
   * 利用 casdoor client 的 handleCallback，传入后端 token 交换函数。
   * casdoor client 会自动从 URL 中提取 code 并调用 serverExchangeToken。
   */
  const handleCallback = useCallback(async () => {

    const success = await casdoor.handleCallback(async (code: string) => {
      const response = await authApi.callback(code)
      const data = response.data!
      
      return {
        token: data.token,
        user: data.user,
      }
    })

    if (success) {
      await fetchCurrentUser()
      navigate('/dashboard')
    }

    return success
  }, [casdoor, fetchCurrentUser, navigate])

  return {
    /** 业务用户（来自 /user/current） */
    user,
    /** SSO access token */
    accessToken: casdoor.accessToken,
    /** 是否已认证（SSO 层） */
    isAuthenticated: casdoor.isAuthenticated,
    /** 是否正在加载（SSO 层） */
    isLoading: casdoor.isLoading,
    login,
    logout,
    handleCallback,
    fetchCurrentUser,
  }
}
