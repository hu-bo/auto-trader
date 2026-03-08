import { create } from 'zustand'
import { marketApi } from '@/api/market'
import type { SymbolData } from '@/api/market'

const normalizeTradeType = (tradeType?: string) => tradeType || 'spot'

export const getMarketSymbolsKey = (exchange: string, tradeType?: string) => (
  `${exchange}:${normalizeTradeType(tradeType)}`
)

interface MarketState {
  symbolsByKey: Record<string, SymbolData[]>
  syncEnabledByKey: Record<string, SymbolData[]>
  loadingByKey: Record<string, boolean>
  errorByKey: Record<string, string | null>
  fetchSymbols: (exchange: string, tradeType?: string, options?: { force?: boolean }) => Promise<SymbolData[]>
  getSyncEnabledSymbols: (exchange: string, tradeType?: string) => SymbolData[]
}

export const useMarketStore = create<MarketState>((set, get) => ({
  symbolsByKey: {},
  syncEnabledByKey: {},
  loadingByKey: {},
  errorByKey: {},
  fetchSymbols: async (exchange, tradeType, options) => {
    const key = getMarketSymbolsKey(exchange, tradeType)
    const cached = get().symbolsByKey[key]
    if (!options?.force && cached && cached.length > 0) return cached

    if (get().loadingByKey[key]) return cached || []

    set((state) => ({
      loadingByKey: { ...state.loadingByKey, [key]: true },
      errorByKey: { ...state.errorByKey, [key]: null },
    }))

    try {
      const res = await marketApi.getSymbols({ exchange, tradeType: normalizeTradeType(tradeType) })
      const symbols = res?.symbols || []
      const syncEnabled = symbols.filter((s) => s.syncEnabled)

      set((state) => ({
        symbolsByKey: { ...state.symbolsByKey, [key]: symbols },
        syncEnabledByKey: { ...state.syncEnabledByKey, [key]: syncEnabled },
      }))

      return symbols
    } catch (err: any) {
      set((state) => ({
        errorByKey: { ...state.errorByKey, [key]: err?.message || 'Failed to fetch symbols' },
      }))
      return []
    } finally {
      set((state) => ({
        loadingByKey: { ...state.loadingByKey, [key]: false },
      }))
    }
  },
  getSyncEnabledSymbols: (exchange, tradeType) => {
    const key = getMarketSymbolsKey(exchange, tradeType)
    return get().syncEnabledByKey[key] || []
  },
}))
