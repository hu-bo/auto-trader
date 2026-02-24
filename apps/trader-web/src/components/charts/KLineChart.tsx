import React, { useRef, useEffect, useMemo } from 'react'
import { KLineChart as KLineChartComponent, type KLineChartRef } from '@hquant/klinecharts-pro/react'
import type { Datafeed, SymbolInfo, Period, KLineData } from '@hquant/klinecharts-pro'
import '@hquant/klinecharts-pro/styles.css'
import { useAppStore } from '@/stores/appStore'
import { marketApi } from '@/api/market'
import { io, Socket } from 'socket.io-client'

interface KLineChartProps {
  symbol?: string
  interval?: string
  height?: number
  exchange?: string
  tradeType?: string
  /** Show built-in toolbar (symbol search + period + indicator). Default true */
  toolbarVisible?: boolean
  onSymbolChange?: (symbol: string) => void
  onIntervalChange?: (interval: string) => void
}

function periodToString(period: Period): string {
  const { span, type } = period
  switch (type) {
    case 'minute': return `${span}m`
    case 'hour': return `${span}h`
    case 'day': return `${span}d`
    case 'week': return `${span}w`
    case 'month': return `${span}M`
    default: return '15m'
  }
}

class TradingDatafeed implements Datafeed {
  private socket: Socket | null = null
  private callbacks: Map<string, (data: KLineData) => void> = new Map()
  private exchange: string
  private tradeType: string
  private allSymbols: SymbolInfo[] | null = null
  private loadingPromise: Promise<SymbolInfo[]> | null = null

  constructor(exchange = 'binance', tradeType = 'spot') {
    this.exchange = exchange
    this.tradeType = tradeType
  }

  private ensureSocket(): Socket {
    if (!this.socket) {
      const wsUrl = (import.meta as any).env?.VITE_WS_MARKET_URL || 'http://localhost:9004'
      this.socket = io(wsUrl, {
        path: '/ws',
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionAttempts: 10,
        reconnectionDelay: 1000,
      })

      this.socket.on('connect', () => console.log('[KLine WS] Connected'))

      this.socket.on('kline', (data: Record<string, unknown>) => {
        const key = `${data.exchange}:${data.trade_type}:${data.symbol}:${data.period}`
        const cb = this.callbacks.get(key)
        if (cb) {
          cb({
            timestamp: data.timestamp as number,
            open: data.open as number,
            high: data.high as number,
            low: data.low as number,
            close: data.close as number,
            volume: data.volume as number,
          })
        }
      })

      this.socket.on('disconnect', () => console.log('[KLine WS] Disconnected'))
    }
    return this.socket
  }

  private async loadAllSymbols(): Promise<SymbolInfo[]> {
    if (this.allSymbols) return this.allSymbols
    if (this.loadingPromise) return this.loadingPromise

    this.loadingPromise = (async () => {
      try {
        const res = await marketApi.getSymbols({
          exchange: this.exchange,
          tradeType: this.tradeType,
        })
        const symbols = (res?.symbols || [])
          .filter((s: any) => s.syncEnabled)
          .map((s: any) => ({
            ticker: s.symbol,
            name: `${s.baseCurrency}/${s.quoteCurrency}`,
            exchange: s.exchange,
            market: s.tradeType,
          }))
        this.allSymbols = symbols
        return symbols
      } catch (err) {
        console.error('[KLine] Failed to load symbols:', err)
        this.allSymbols = []
        return []
      } finally {
        this.loadingPromise = null
      }
    })()

    return this.loadingPromise
  }

  async searchSymbols(search?: string): Promise<SymbolInfo[]> {
    const symbols = await this.loadAllSymbols()
    if (!search) return symbols
    const lower = search.toLowerCase()
    return symbols.filter(
      (s) =>
        s.ticker.toLowerCase().includes(lower) ||
        s.name?.toLowerCase().includes(lower)
    )
  }

  async getHistoryKLineData(
    symbol: SymbolInfo,
    period: Period,
    _from: number,
    _to: number
  ): Promise<KLineData[]> {
    try {
      const periodStr = periodToString(period)
      const data = await marketApi.getCandles({
        exchange: this.exchange,
        symbol: symbol.ticker,
        trade_type: this.tradeType,
        period: periodStr,
        start_time: _from,
        end_time: _to,
      })
      if (!Array.isArray(data)) return []
      return data.map((c) => ({
        timestamp: c.timestamp,
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
        volume: c.volume,
      }))
    } catch (err) {
      console.error('[KLine] Failed to fetch history:', err)
      return []
    }
  }

  subscribe(symbol: SymbolInfo, period: Period, callback: (data: KLineData) => void): void {
    const periodStr = periodToString(period)
    const key = `${this.exchange}:${this.tradeType}:${symbol.ticker}:${periodStr}`
    this.callbacks.set(key, callback)
    const socket = this.ensureSocket()
    socket.emit('subscribe:kline', {
      exchange: this.exchange,
      tradeType: this.tradeType,
      symbol: symbol.ticker,
      period: periodStr,
    })
  }

  unsubscribe(symbol: SymbolInfo, period: Period): void {
    const periodStr = periodToString(period)
    const key = `${this.exchange}:${this.tradeType}:${symbol.ticker}:${periodStr}`
    this.callbacks.delete(key)
    if (this.socket?.connected) {
      this.socket.emit('unsubscribe:kline', {
        exchange: this.exchange,
        tradeType: this.tradeType,
        symbol: symbol.ticker,
        period: periodStr,
      })
    }
  }

  destroy(): void {
    this.callbacks.clear()
    if (this.socket) {
      this.socket.disconnect()
      this.socket = null
    }
  }
}

const periods: Period[] = [
  { span: 15, type: 'minute', text: '15m' },
  { span: 4, type: 'hour', text: '4H' },
  { span: 1, type: 'day', text: '1D' },
]

export const KLineChart: React.FC<KLineChartProps> = ({
  symbol = 'BTC-USDT',
  interval = '15m',
  height = 500,
  exchange = 'binance',
  tradeType = 'spot',
  toolbarVisible = true,
  onSymbolChange,
  onIntervalChange,
}) => {
  const chartRef = useRef<KLineChartRef>(null)
  const { theme } = useAppStore()
  const datafeed = useMemo(() => new TradingDatafeed(exchange, tradeType), [exchange, tradeType])

  const currentPeriod = useMemo(() => {
    return periods.find((p) => p.text === interval) || periods[0]
  }, [interval])

  const symbolInfo: SymbolInfo = useMemo(
    () => ({
      ticker: symbol,
      name: symbol.replace('-', '/'),
    }),
    [symbol]
  )

  useEffect(() => {
    chartRef.current?.setTheme(theme)
  }, [theme])

  useEffect(() => {
    return () => { datafeed.destroy() }
  }, [datafeed])

  return (
    <KLineChartComponent
      ref={chartRef}
      symbol={symbolInfo}
      period={currentPeriod}
      periods={periods}
      datafeed={datafeed}
      theme={theme}
      locale="zh-CN"
      toolbarVisible={toolbarVisible}
      mainIndicators={['MA']}
      subIndicators={['VOL']}
      onSymbolChange={(data) => onSymbolChange?.(data.newSymbol.ticker)}
      onPeriodChange={(data) => onIntervalChange?.(data.newPeriod.text)}
      style={{ width: '100%', height }}
    />
  )
}
