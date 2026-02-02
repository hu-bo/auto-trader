import React from 'react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuthStore } from '@/stores/authStore'
import { Loading } from '@/components/common'

interface AuthGuardProps {
  children?: React.ReactNode
}

export const AuthGuard: React.FC<AuthGuardProps> = ({ children }) => {
  const { isAuthenticated, isLoading } = useAuthStore()
  const location = useLocation()

  if (isLoading) {
    return <Loading fullscreen tip="正在验证登录状态..." />
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  return children ? <>{children}</> : <Outlet />
}

export const AdminGuard: React.FC = () => {
  const { user, isLoading } = useAuthStore()

  if (isLoading) {
    return <Loading fullscreen tip="正在验证权限..." />
  }

  if (user?.role !== 'admin') {
    return <Navigate to="/dashboard" replace />
  }

  return <Outlet />
}

export const GuestGuard: React.FC<AuthGuardProps> = ({ children }) => {
  const { isAuthenticated, isLoading } = useAuthStore()
  const location = useLocation()

  if (isLoading) {
    return <Loading fullscreen />
  }

  if (isAuthenticated) {
    const from = (location.state as { from?: { pathname: string } })?.from?.pathname || '/dashboard'
    return <Navigate to={from} replace />
  }

  return children ? <>{children}</> : <Outlet />
}
