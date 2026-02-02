import { useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useCasdoor } from '@hquant/casdoor/client/react'
import { useAuthStore } from '@/stores/authStore'
import { authApi } from '@/api'

export function useAuth() {
  const navigate = useNavigate()
  const { login: casdoorLogin, logout: casdoorLogout } = useCasdoor()
  const {
    user,
    accessToken,
    isAuthenticated,
    isLoading,
    login: storeLogin,
    logout: storeLogout,
    setLoading,
  } = useAuthStore()

  const login = useCallback(() => {
    casdoorLogin()
  }, [casdoorLogin])

  const logout = useCallback(async () => {
    try {
      await authApi.logout()
    } catch {
      // 忽略登出错误
    } finally {
      storeLogout()
      casdoorLogout()
      navigate('/login')
    }
  }, [casdoorLogout, storeLogout, navigate])

  const handleCallback = useCallback(
    async (code: string) => {
      setLoading(true)
      try {
        const response = await authApi.callback(code)
        console.log(response)
        alert(1)
        // response 现在是 ApiResponse 格式，data 包含 { token, user }
        if (response.data) {
          storeLogin(response.data.user, response.data.access_token)
          navigate('/dashboard')
          return true
        }
        return false
      } catch (error) {
        console.error('Login callback failed:', error)
        return false
      } finally {
        setLoading(false)
      }
    },
    [storeLogin, navigate, setLoading]
  )

  const fetchCurrentUser = useCallback(async () => {
    if (!accessToken) return null
    try {
      const response = await authApi.getCurrentUser()
      // response 现在是 ApiResponse 格式
      return response.data
    } catch {
      storeLogout()
      return null
    }
  }, [accessToken, storeLogout])

  return {
    user,
    accessToken,
    isAuthenticated,
    isLoading,
    login,
    logout,
    handleCallback,
    fetchCurrentUser,
  }
}
