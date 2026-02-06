export interface User {
  id: number
  casdoorid: string
  username: string
  displayname: string
  role: UserRole
  isadmin: boolean
  isactive: boolean
  created_at: string
  updated_at: string
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
