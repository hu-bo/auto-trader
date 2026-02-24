import { useEffect } from 'react'
import { RouterProvider } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { CasdoorProvider, useCasdoor } from '@hquant/casdoor/client/react'
import { router } from '@/routes'
import { useAuthStore } from '@/stores/authStore'
import { useAppStore } from '@/stores/appStore'
import { ErrorBoundary } from '@/components/common'
import { casdoorConfig } from '@/config/casdoor'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 5 * 60 * 1000,
    },
  },
})

/**
 * 应用初始化：
 * - casdoor 自动从 storage 恢复 SSO 状态
 * - 如果已认证，拉取业务用户 /user/current
 * - 初始化 app store（主题等）
 */
function AppInitializer({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useCasdoor()
  const fetchCurrentUser = useAuthStore((s) => s.fetchCurrentUser)
  const initApp = useAppStore((s) => s.initialize)

  useEffect(() => {
    initApp()
  }, [initApp])

  // SSO 认证恢复后，自动拉取业务用户
  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      fetchCurrentUser()
    }
  }, [isLoading, isAuthenticated, fetchCurrentUser])

  return <>{children}</>
}

function App() {
  return (
    <ErrorBoundary>
      <CasdoorProvider config={casdoorConfig}>
        <QueryClientProvider client={queryClient}>
          <AppInitializer>
            <RouterProvider router={router} />
          </AppInitializer>
        </QueryClientProvider>
      </CasdoorProvider>
    </ErrorBoundary>
  )
}

export default App
