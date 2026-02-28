import { createBrowserRouter, Navigate } from 'react-router-dom'
import { MainLayout } from '@/components/layout'
import { AuthGuard, AdminGuard, GuestGuard } from './guards'

// 页面组件 - 懒加载
import { lazy, Suspense } from 'react'
import { Loading } from '@/components/common'

const Login = lazy(() => import('@/pages/auth/Login'))
const Callback = lazy(() => import('@/pages/auth/Callback'))
const Dashboard = lazy(() => import('@/pages/dashboard/Dashboard'))
const TradingView = lazy(() => import('@/pages/trading/TradingView'))
const MarketList = lazy(() => import('@/pages/market/MarketList'))
const Positions = lazy(() => import('@/pages/position/Positions'))
const Orders = lazy(() => import('@/pages/order/Orders'))
const StrategyOrders = lazy(() => import('@/pages/order/StrategyOrders'))
const StrategyDebugger = lazy(() => import('@/pages/strategy/StrategyDebugger'))
const BatchTrading = lazy(() => import('@/pages/batch/BatchTrading'))
const ExchangeConfig = lazy(() => import('@/pages/exchange/ExchangeConfig'))
const Settings = lazy(() => import('@/pages/settings/Settings'))
const UserManage = lazy(() => import('@/pages/admin/UserManage'))
const StrategyLibrary = lazy(() => import('@/pages/admin/StrategyLibrary'))

const LazyPage = ({ children }: { children: React.ReactNode }) => (
  <Suspense fallback={<Loading />}>{children}</Suspense>
)

export const router = createBrowserRouter([
  {
    path: '/login',
    element: (
      <GuestGuard>
        <LazyPage>
          <Login />
        </LazyPage>
      </GuestGuard>
    ),
  },
  {
    path: '/callback',
    element: (
      <LazyPage>
        <Callback />
      </LazyPage>
    ),
  },
  {
    path: '/',
    element: (
      <AuthGuard>
        <MainLayout />
      </AuthGuard>
    ),
    children: [
      { index: true, element: <Navigate to="/dashboard" replace /> },
      {
        path: 'dashboard',
        element: (
          <LazyPage>
            <Dashboard />
          </LazyPage>
        ),
      },
      {
        path: 'trading/:symbol',
        element: (
          <LazyPage>
            <TradingView />
          </LazyPage>
        ),
      },
      {
        path: 'market',
        element: (
          <LazyPage>
            <MarketList />
          </LazyPage>
        ),
      },
      {
        path: 'positions',
        element: (
          <LazyPage>
            <Positions />
          </LazyPage>
        ),
      },
      {
        path: 'orders',
        element: (
          <LazyPage>
            <Orders />
          </LazyPage>
        ),
      },
      {
        path: 'strategy-orders',
        element: (
          <LazyPage>
            <StrategyOrders />
          </LazyPage>
        ),
      },
      {
        path: 'batch-trading',
        element: (
          <LazyPage>
            <BatchTrading />
          </LazyPage>
        ),
      },
      {
        path: 'strategy-debugger',
        element: (
          <LazyPage>
            <StrategyDebugger />
          </LazyPage>
        ),
      },
      {
        path: 'exchanges',
        element: (
          <LazyPage>
            <ExchangeConfig />
          </LazyPage>
        ),
      },
      {
        path: 'settings',
        element: (
          <LazyPage>
            <Settings />
          </LazyPage>
        ),
      },
      {
        path: 'admin',
        element: <AdminGuard />,
        children: [
          {
            path: 'users',
            element: (
              <LazyPage>
                <UserManage />
              </LazyPage>
            ),
          },
          {
            path: 'strategy-library',
            element: (
              <LazyPage>
                <StrategyLibrary />
              </LazyPage>
            ),
          },
        ],
      },
    ],
  },
  {
    path: '*',
    element: <Navigate to="/dashboard" replace />,
  },
])
