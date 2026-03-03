import { KLineChartPro } from '@klinecharts/pro'
import type { Datafeed, SymbolInfo, Period, DatafeedSubscribeCallback } from '@klinecharts/pro'
import '@klinecharts/pro/dist/klinecharts-pro.css'

// ============ 配置 ============
const API_BASE = 'http://exchange-sync.8and1.cn/api'
const EXCHANGE = 'binance'
const TRADE_TYPE = 'spot'

// ============ 工具函数 ============
function periodToString(period: Period): string {
  const { multiplier, timespan } = period
  switch (timespan) {
    case 'minute': return `${multiplier}m`
    case 'hour': return `${multiplier}h`
    case 'day': return `${multiplier}d`
    case 'week': return `${multiplier}w`
    case 'month': return `${multiplier}M`
    default: return '15m'
  }
}

async function fetchJson<T>(path: string, params: Record<string, string | number> = {}): Promise<T> {
  const qs = new URLSearchParams()
  Object.entries(params).forEach(([k, v]) => qs.set(k, String(v)))
  const url = `${API_BASE}${path}?${qs}`
  const res = await fetch(url, {
    headers: {
      'X-API-Key': 'xxx'
    }
  })
  if (!res.ok) throw new Error(`API ${res.status}: ${url}`)
  const json = await res.json()
  return json.data ?? json
}

// ============ TradingDatafeed ============
class TradingDatafeed implements Datafeed {
  private callbacks: Map<string, DatafeedSubscribeCallback> = new Map()
  private allSymbols: SymbolInfo[] | null = null

  async searchSymbols(search?: string): Promise<SymbolInfo[]> {
    if (!this.allSymbols) {
      try {
        const res = await fetchJson<{ symbols: any[] }>('/market/symbols', {
          exchange: EXCHANGE,
          trade_type: TRADE_TYPE,
        })
        this.allSymbols = (res.symbols || [])
          .filter((s: any) => s.syncEnabled)
          .map((s: any) => ({
            ticker: s.symbol,
            name: `${s.baseCurrency}/${s.quoteCurrency}`,
            exchange: s.exchange,
            market: s.tradeType,
          }))
      } catch (err) {
        console.error('[Datafeed] Failed to load symbols:', err)
        this.allSymbols = []
      }
    }

    if (!search) return this.allSymbols
    const lower = search.toLowerCase()
    return this.allSymbols.filter(
      (s) =>
        s.ticker.toLowerCase().includes(lower) ||
        (s.name && s.name.toLowerCase().includes(lower))
    )
  }

  async getHistoryKLineData(
    symbol: SymbolInfo,
    period: Period,
    from: number,
    to: number
  ): Promise<any[]> {
    try {
      const data = await fetchJson<any[]>('/candles', {
        exchange: EXCHANGE,
        symbol: symbol.ticker,
        trade_type: TRADE_TYPE,
        period: periodToString(period),
        start_time: from,
        end_time: to,
        start: new Date(from).toISOString(),
        end: new Date(to).toISOString(),
      })

      if (!Array.isArray(data)) return []
      return data
        .map((c) => ({
          timestamp: c.timestamp,
          open: c.open,
          high: c.high,
          low: c.low,
          close: c.close,
          volume: c.volume,
        }))
        .sort((a, b) => a.timestamp - b.timestamp)
    } catch (err) {
      console.error('[Datafeed] Failed to fetch candles:', err)
      return []
    }
  }

  subscribe(symbol: SymbolInfo, period: Period, callback: DatafeedSubscribeCallback): void {
    const periodStr = periodToString(period)
    const key = `${EXCHANGE}:${TRADE_TYPE}:${symbol.ticker}:${periodStr}`
    this.callbacks.set(key, callback)
    console.log(`[Datafeed] subscribe: ${key}`)
  }

  unsubscribe(symbol: SymbolInfo, period: Period): void {
    const periodStr = periodToString(period)
    const key = `${EXCHANGE}:${TRADE_TYPE}:${symbol.ticker}:${periodStr}`
    this.callbacks.delete(key)
    console.log(`[Datafeed] unsubscribe: ${key}`)
  }
}

// ============ 创建图表 ============
const chart = new KLineChartPro({
  container: document.getElementById('container')!,
  symbol: {
    ticker: 'BTC-USDT',
    name: 'BTC/USDT',
    exchange: EXCHANGE,
    market: TRADE_TYPE,
  },
  period: { multiplier: 15, timespan: 'minute', text: '15m' },
  datafeed: new TradingDatafeed(),
  theme: 'dark',
  locale: 'zh-CN',
  mainIndicators: ['MA'],
  subIndicators: ['VOL'],
})

// 暴露到全局方便调试
;(window as any).chart = chart
