import type { Datafeed, SymbolInfo, Period, KLineData, DatafeedSubscribeCallback } from '../types'

export abstract class BaseDatafeed implements Datafeed {
  abstract searchSymbols(search?: string): Promise<SymbolInfo[]>
  abstract getHistoryKLineData(
    symbol: SymbolInfo,
    period: Period,
    from: number,
    to: number
  ): Promise<KLineData[]>
  abstract subscribe(
    symbol: SymbolInfo,
    period: Period,
    callback: DatafeedSubscribeCallback
  ): void
  abstract unsubscribe(symbol: SymbolInfo, period: Period): void
}

interface PolygonTickerResult {
  ticker: string
  name: string
  market: string
  locale: string
  primary_exchange: string
  type: string
  currency_name: string
}

interface PolygonAggResult {
  t: number
  o: number
  h: number
  l: number
  c: number
  v: number
  vw?: number
  n?: number
}

export class DefaultDatafeed implements Datafeed {
  private apiKey: string
  private baseUrl = 'https://api.polygon.io'
  private subscriptions: Map<string, ReturnType<typeof setInterval>> = new Map()

  constructor(apiKey: string) {
    this.apiKey = apiKey
  }

  private getSubscriptionKey(symbol: SymbolInfo, period: Period): string {
    return `${symbol.ticker}_${period.span}_${period.type}`
  }

  private periodToPolygonTimespan(period: Period): string {
    const timespanMap: Record<string, string> = {
      minute: 'minute',
      hour: 'hour',
      day: 'day',
      week: 'week',
      month: 'month',
      year: 'year',
    }
    return timespanMap[period.type] || 'day'
  }

  async searchSymbols(search?: string): Promise<SymbolInfo[]> {
    if (!search || search.length < 1) {
      return []
    }

    try {
      const response = await fetch(
        `${this.baseUrl}/v3/reference/tickers?search=${encodeURIComponent(search)}&active=true&limit=20&apiKey=${this.apiKey}`
      )
      const data = await response.json()

      if (data.results) {
        return data.results.map((item: PolygonTickerResult) => ({
          ticker: item.ticker,
          name: item.name,
          shortName: item.ticker,
          exchange: item.primary_exchange,
          market: item.market,
          priceCurrency: item.currency_name,
          type: item.type,
        }))
      }
      return []
    } catch (error) {
      console.error('Failed to search symbols:', error)
      return []
    }
  }

  async getHistoryKLineData(
    symbol: SymbolInfo,
    period: Period,
    from: number,
    to: number
  ): Promise<KLineData[]> {
    const timespan = this.periodToPolygonTimespan(period)
    const fromDate = new Date(from).toISOString().split('T')[0]
    const toDate = new Date(to).toISOString().split('T')[0]

    try {
      const response = await fetch(
        `${this.baseUrl}/v2/aggs/ticker/${symbol.ticker}/range/${period.span}/${timespan}/${fromDate}/${toDate}?adjusted=true&sort=asc&limit=50000&apiKey=${this.apiKey}`
      )
      const data = await response.json()

      if (data.results) {
        return data.results.map((item: PolygonAggResult) => ({
          timestamp: item.t,
          open: item.o,
          high: item.h,
          low: item.l,
          close: item.c,
          volume: item.v,
        }))
      }
      return []
    } catch (error) {
      console.error('Failed to get history kline data:', error)
      return []
    }
  }

  subscribe(
    symbol: SymbolInfo,
    period: Period,
    callback: DatafeedSubscribeCallback
  ): void {
    const key = this.getSubscriptionKey(symbol, period)

    if (this.subscriptions.has(key)) {
      return
    }

    const pollInterval = this.getPollInterval(period)
    const intervalId = setInterval(async () => {
      const now = Date.now()
      const from = now - pollInterval * 2
      const data = await this.getHistoryKLineData(symbol, period, from, now)
      if (data.length > 0) {
        callback(data[data.length - 1])
      }
    }, pollInterval)

    this.subscriptions.set(key, intervalId)
  }

  unsubscribe(symbol: SymbolInfo, period: Period): void {
    const key = this.getSubscriptionKey(symbol, period)
    const intervalId = this.subscriptions.get(key)

    if (intervalId) {
      clearInterval(intervalId)
      this.subscriptions.delete(key)
    }
  }

  private getPollInterval(period: Period): number {
    const baseIntervals: Record<string, number> = {
      minute: 60 * 1000,
      hour: 60 * 60 * 1000,
      day: 24 * 60 * 60 * 1000,
      week: 7 * 24 * 60 * 60 * 1000,
      month: 30 * 24 * 60 * 60 * 1000,
      year: 365 * 24 * 60 * 60 * 1000,
    }
    const base = baseIntervals[period.type] || 60 * 1000
    return Math.min(base * period.span, 60 * 1000)
  }

  destroy(): void {
    this.subscriptions.forEach((intervalId) => {
      clearInterval(intervalId)
    })
    this.subscriptions.clear()
  }
}

export type { Datafeed, DatafeedSubscribeCallback }
