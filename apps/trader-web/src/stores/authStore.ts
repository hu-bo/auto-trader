import { create } from 'zustand'
import { getStorage, setStorage, removeStorage, STORAGE_KEYS } from '@/utils/storage'
import type { User } from '@/types'

interface AuthState {
  user: User | null
  accessToken: string | null
  isAuthenticated: boolean
  isLoading: boolean
}

interface AuthActions {
  setUser: (user: User | null) => void
  setToken: (token: string | null) => void
  login: (user: User, token: string) => void
  logout: () => void
  setLoading: (loading: boolean) => void
  initialize: () => void
}

type AuthStore = AuthState & AuthActions

export const useAuthStore = create<AuthStore>((set) => ({
  user: null,
  accessToken: null,
  isAuthenticated: false,
  isLoading: true,

  setUser: (user) => {
    if (user) {
      setStorage(STORAGE_KEYS.USER, user)
    } else {
      removeStorage(STORAGE_KEYS.USER)
    }
    set({ user, isAuthenticated: !!user })
  },

  setToken: (token) => {
    if (token) {
      setStorage(STORAGE_KEYS.TOKEN, token)
    } else {
      removeStorage(STORAGE_KEYS.TOKEN)
    }
    set({ accessToken: token })
  },

  login: (user, token) => {
    setStorage(STORAGE_KEYS.USER, user)
    setStorage(STORAGE_KEYS.TOKEN, token)
    set({
      user,
      accessToken: token,
      isAuthenticated: true,
      isLoading: false,
    })
  },

  logout: () => {
    removeStorage(STORAGE_KEYS.USER)
    removeStorage(STORAGE_KEYS.TOKEN)
    removeStorage(STORAGE_KEYS.REFRESH_TOKEN)
    set({
      user: null,
      accessToken: null,
      isAuthenticated: false,
      isLoading: false,
    })
  },

  setLoading: (loading) => set({ isLoading: loading }),

  initialize: () => {
    const user = getStorage<User>(STORAGE_KEYS.USER)
    const token = getStorage<string>(STORAGE_KEYS.TOKEN)

    set({
      user,
      accessToken: token,
      isAuthenticated: !!(user && token),
      isLoading: false,
    })
  },
}))
