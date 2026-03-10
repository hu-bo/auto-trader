const STORAGE_PREFIX = 'hquant_'

type StoragePayload<T> = {
  __value: T
  __expiresAt?: number
}

type StorageOptions = {
  ttlMs?: number
}

export class LocalStorageStore {
  private prefix: string

  constructor(prefix: string) {
    this.prefix = prefix
  }

  private getKey(key: string): string {
    return `${this.prefix}${key}`
  }

  get<T>(key: string, defaultValue: T | null = null): T | null {
    try {
      const raw = localStorage.getItem(this.getKey(key))
      if (raw === null) return defaultValue
      const parsed = JSON.parse(raw) as StoragePayload<T> | T
      if (parsed && typeof parsed === 'object' && '__value' in parsed) {
        const payload = parsed as StoragePayload<T>
        if (typeof payload.__expiresAt === 'number' && Date.now() > payload.__expiresAt) {
          localStorage.removeItem(this.getKey(key))
          return defaultValue
        }
        return payload.__value
      }
      return parsed as T
    } catch {
      return defaultValue
    }
  }

  set<T>(key: string, value: T, options: StorageOptions = {}): void {
    try {
      const payload: StoragePayload<T> = { __value: value }
      if (typeof options.ttlMs === 'number' && Number.isFinite(options.ttlMs) && options.ttlMs > 0) {
        payload.__expiresAt = Date.now() + options.ttlMs
      }
      localStorage.setItem(this.getKey(key), JSON.stringify(payload))
    } catch (error) {
      console.error('Failed to save to localStorage:', error)
    }
  }

  remove(key: string): void {
    try {
      localStorage.removeItem(this.getKey(key))
    } catch (error) {
      console.error('Failed to remove from localStorage:', error)
    }
  }

  clear(): void {
    try {
      const keysToRemove: string[] = []
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i)
        if (key?.startsWith(this.prefix)) {
          keysToRemove.push(key)
        }
      }
      keysToRemove.forEach((key) => localStorage.removeItem(key))
    } catch (error) {
      console.error('Failed to clear localStorage:', error)
    }
  }
}

export const storage = new LocalStorageStore(STORAGE_PREFIX)

// 存储的 key 常量
export const STORAGE_KEYS = {
  THEME: 'theme',
  LOCALE: 'locale',
  SIDEBAR_COLLAPSED: 'sidebar_collapsed',
  SELECTED_EXCHANGE: 'selected_exchange',
  TRADING_SYMBOL: 'trading_symbol',
  TRADING_INTERVAL: 'trading_interval',
  TRADING_TRADE_TYPE: 'trading_trade_type',
  TOKEN: 'token',
  MARKET_FILTER: 'market_filter',
  ORDER_FORM_CACHE: 'order_form_cache',
} as const
