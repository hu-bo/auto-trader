import { create } from 'zustand'
import { storage, STORAGE_KEYS } from '@/utils/storage'
import type { Exchange } from '@/types'

type ThemeMode = 'light' | 'dark'
type TradeTypeMode = 'spot' | 'futures'

interface AppState {
  theme: ThemeMode
  sidebarCollapsed: boolean
  selectedExchange: Exchange | null
  tradingSymbol: string
  tradingInterval: string
  tradingTradeType: TradeTypeMode
}

interface AppActions {
  setTheme: (theme: ThemeMode) => void
  toggleTheme: () => void
  setSidebarCollapsed: (collapsed: boolean) => void
  toggleSidebar: () => void
  setSelectedExchange: (exchange: Exchange | null) => void
  setTradingSymbol: (symbol: string) => void
  setTradingInterval: (interval: string) => void
  setTradingTradeType: (tradeType: TradeTypeMode) => void
  initialize: () => void
}

type AppStore = AppState & AppActions

export const useAppStore = create<AppStore>((set, get) => ({
  theme: 'dark',
  sidebarCollapsed: false,
  selectedExchange: null,
  tradingSymbol: 'BTC-USDT',
  tradingInterval: '15m',
  tradingTradeType: 'spot',

  setTheme: (theme) => {
    storage.set(STORAGE_KEYS.THEME, theme)
    document.body.setAttribute('theme-mode', theme)
    set({ theme })
  },

  toggleTheme: () => {
    const newTheme = get().theme === 'dark' ? 'light' : 'dark'
    get().setTheme(newTheme)
  },

  setSidebarCollapsed: (collapsed) => {
    storage.set(STORAGE_KEYS.SIDEBAR_COLLAPSED, collapsed)
    set({ sidebarCollapsed: collapsed })
  },

  toggleSidebar: () => {
    get().setSidebarCollapsed(!get().sidebarCollapsed)
  },

  setSelectedExchange: (exchange) => {
    set({ selectedExchange: exchange })
  },

  setTradingSymbol: (symbol) => {
    storage.set(STORAGE_KEYS.TRADING_SYMBOL, symbol)
    set({ tradingSymbol: symbol })
  },

  setTradingInterval: (interval) => {
    storage.set(STORAGE_KEYS.TRADING_INTERVAL, interval)
    set({ tradingInterval: interval })
  },

  setTradingTradeType: (tradeType) => {
    storage.set(STORAGE_KEYS.TRADING_TRADE_TYPE, tradeType)
    set({ tradingTradeType: tradeType })
  },

  initialize: () => {
    const theme = storage.get<ThemeMode>(STORAGE_KEYS.THEME) || 'dark'
    const sidebarCollapsed = storage.get<boolean>(STORAGE_KEYS.SIDEBAR_COLLAPSED) || false
    const tradingSymbol = storage.get<string>(STORAGE_KEYS.TRADING_SYMBOL) || 'BTC-USDT'
    const tradingInterval = storage.get<string>(STORAGE_KEYS.TRADING_INTERVAL) || '15m'
    const tradingTradeType = storage.get<TradeTypeMode>(STORAGE_KEYS.TRADING_TRADE_TYPE) || 'spot'

    document.body.setAttribute('theme-mode', theme)

    set({
      theme,
      sidebarCollapsed,
      tradingSymbol,
      tradingInterval,
      tradingTradeType,
    })
  },
}))
