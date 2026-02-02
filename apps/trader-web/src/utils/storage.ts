const STORAGE_PREFIX = 'hquant_'

// 带前缀的 key
function getKey(key: string): string {
  return `${STORAGE_PREFIX}${key}`
}

// 获取存储的值
export function getStorage<T>(key: string, defaultValue: T | null = null): T | null {
  try {
    const item = localStorage.getItem(getKey(key))
    if (item === null) return defaultValue
    return JSON.parse(item) as T
  } catch {
    return defaultValue
  }
}

// 设置存储的值
export function setStorage<T>(key: string, value: T): void {
  try {
    localStorage.setItem(getKey(key), JSON.stringify(value))
  } catch (error) {
    console.error('Failed to save to localStorage:', error)
  }
}

// 移除存储的值
export function removeStorage(key: string): void {
  try {
    localStorage.removeItem(getKey(key))
  } catch (error) {
    console.error('Failed to remove from localStorage:', error)
  }
}

// 清除所有存储
export function clearStorage(): void {
  try {
    const keysToRemove: string[] = []
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key?.startsWith(STORAGE_PREFIX)) {
        keysToRemove.push(key)
      }
    }
    keysToRemove.forEach((key) => localStorage.removeItem(key))
  } catch (error) {
    console.error('Failed to clear localStorage:', error)
  }
}

// 存储的 key 常量
export const STORAGE_KEYS = {
  TOKEN: 'token',
  REFRESH_TOKEN: 'refresh_token',
  USER: 'user',
  THEME: 'theme',
  LOCALE: 'locale',
  SIDEBAR_COLLAPSED: 'sidebar_collapsed',
  SELECTED_EXCHANGE: 'selected_exchange',
  TRADING_SYMBOL: 'trading_symbol',
  TRADING_INTERVAL: 'trading_interval',
} as const
