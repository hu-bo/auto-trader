export interface User {
  id: string
  username: string
  displayName?: string
  avatar?: string
  email?: string
  phone?: string
  role: UserRole
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export type UserRole = 'admin' | 'user'

export interface TokenResponse {
  access_token: string
  token_type: string
  expires_in: number
  refresh_token?: string
}

export interface AuthState {
  user: User | null
  accessToken: string | null
  isAuthenticated: boolean
  isLoading: boolean
}

export interface LoginCredentials {
  username: string
  password: string
}

export interface UserStatusUpdate {
  isActive: boolean
}
