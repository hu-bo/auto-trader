import { useEffect } from 'react'
import { RouterProvider } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { CasdoorProvider } from '@hquant/casdoor/client/react'
import { router } from '@/routes'
import { useAuthStore } from '@/stores/authStore'
import { useAppStore } from '@/stores/appStore'
import { ErrorBoundary } from '@/components/common'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 5 * 60 * 1000, // 5 minutes
    },
  },
})

const casdoorConfig = {
  endpoint: 'http://sso.8and1.cn',
  clientId: '7b474919541526399765',
  orgName: '8PLUS1',
  appName: '8PLUS1',
  redirectUri: `${window.location.origin}/callback`,
  logoutRedirectUri: `${window.location.origin}/login`,
  storage: {
    type: 'localStorage' as const,
    prefix: 'hquant_casdoor_',
  },
  silentRefresh: true,
  refreshBeforeExpiry: 60,
}

function AppInitializer({ children }: { children: React.ReactNode }) {
  const initAuth = useAuthStore((state) => state.initialize)
  const initApp = useAppStore((state) => state.initialize)

  useEffect(() => {
    initAuth()
    initApp()
  }, [initAuth, initApp])

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
