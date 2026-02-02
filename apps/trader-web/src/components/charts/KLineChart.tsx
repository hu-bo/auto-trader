import React, { useRef, useEffect, useMemo } from 'react'
import { KLineChart as KLineChartComponent, type KLineChartRef } from '@hquant/klinecharts-pro/react'
import type { Datafeed, SymbolInfo, Period, KLineData } from '@hquant/klinecharts-pro'
import '@hquant/klinecharts-pro/styles.css'
import { useAppStore } from '@/stores/appStore'

interface KLineChartProps {
  symbol?: string
  interval?: string
  height?: number
  onSymbolChange?: (symbol: string) => void
  onIntervalChange?: (interval: string) => void
}

// 自定义 Datafeed，连接到后端 API
class TradingDatafeed implements Datafeed {
  async searchSymbols(search?: string): Promise<SymbolInfo[]> {
    // 返回常用交易对
    const symbols: SymbolInfo[] = [
      { ticker: 'BTC-USDT', name: 'Bitcoin', exchange: 'Binance' },
      { ticker: 'ETH-USDT', name: 'Ethereum', exchange: 'Binance' },
      { ticker: 'BNB-USDT', name: 'Binance Coin', exchange: 'Binance' },
      { ticker: 'SOL-USDT', name: 'Solana', exchange: 'Binance' },
      { ticker: 'XRP-USDT', name: 'Ripple', exchange: 'Binance' },
      { ticker: 'DOGE-USDT', name: 'Dogecoin', exchange: 'Binance' },
      { ticker: 'ADA-USDT', name: 'Cardano', exchange: 'Binance' },
      { ticker: 'AVAX-USDT', name: 'Avalanche', exchange: 'Binance' },
    ]

    if (!search) return symbols
    const lowerSearch = search.toLowerCase()
    return symbols.filter(
      (s) =>
        s.ticker.toLowerCase().includes(lowerSearch) ||
        s.name?.toLowerCase().includes(lowerSearch)
    )
  }

  async getHistoryKLineData(
    symbol: SymbolInfo,
    period: Period,
    from: number,
    to: number
  ): Promise<KLineData[]> {
    // TODO: 连接真实的 K 线数据 API
    // 目前返回模拟数据
    const data: KLineData[] = []
    const now = Date.now()
    const intervalMs = this.getIntervalMs(period)

    for (let i = 500; i >= 0; i--) {
      const timestamp = now - i * intervalMs
      const basePrice = 40000 + Math.random() * 10000
      const volatility = 0.02

      data.push({
        timestamp,
        open: basePrice,
        high: basePrice * (1 + Math.random() * volatility),
        low: basePrice * (1 - Math.random() * volatility),
        close: basePrice * (1 + (Math.random() - 0.5) * volatility),
        volume: Math.random() * 1000000,
      })
    }

    return data
  }

  subscribe(
    symbol: SymbolInfo,
    period: Period,
    callback: (data: KLineData) => void
  ): void {
    // TODO: 实现 WebSocket 订阅实时数据
  }

  unsubscribe(symbol: SymbolInfo, period: Period): void {
    // TODO: 取消订阅
  }

  private getIntervalMs(period: Period): number {
    const multiplier = period.multiplier
    switch (period.timespan) {
      case 'minute':
        return multiplier * 60 * 1000
      case 'hour':
        return multiplier * 60 * 60 * 1000
      case 'day':
        return multiplier * 24 * 60 * 60 * 1000
      case 'week':
        return multiplier * 7 * 24 * 60 * 60 * 1000
      case 'month':
        return multiplier * 30 * 24 * 60 * 60 * 1000
      default:
        return 60 * 1000
    }
  }
}

const periods: Period[] = [
  { multiplier: 1, timespan: 'minute', text: '1m' },
  { multiplier: 5, timespan: 'minute', text: '5m' },
  { multiplier: 15, timespan: 'minute', text: '15m' },
  { multiplier: 30, timespan: 'minute', text: '30m' },
  { multiplier: 1, timespan: 'hour', text: '1H' },
  { multiplier: 4, timespan: 'hour', text: '4H' },
  { multiplier: 1, timespan: 'day', text: '1D' },
  { multiplier: 1, timespan: 'week', text: '1W' },
]

export const KLineChart: React.FC<KLineChartProps> = ({
  symbol = 'BTC-USDT',
  interval = '15m',
  height = 500,
  onSymbolChange,
  onIntervalChange,
}) => {
  const chartRef = useRef<KLineChartRef>(null)
  const { theme } = useAppStore()
  const datafeed = useMemo(() => new TradingDatafeed(), [])

  const currentPeriod = useMemo(() => {
    return periods.find((p) => p.text === interval) || periods[2]
  }, [interval])

  const symbolInfo: SymbolInfo = useMemo(
    () => ({
      ticker: symbol,
      name: symbol.replace('-', '/'),
    }),
    [symbol]
  )

  useEffect(() => {
    if (chartRef.current) {
      chartRef.current.setTheme(theme)
    }
  }, [theme])

  return (
    <KLineChartComponent
      ref={chartRef}
      symbol={symbolInfo}
      period={currentPeriod}
      periods={periods}
      datafeed={datafeed}
      theme={theme}
      locale="zh-CN"
      drawingBarVisible={true}
      mainIndicators={['MA']}
      subIndicators={['VOL']}
      onSymbolChange={(data) => {
        onSymbolChange?.(data.newSymbol.ticker)
      }}
      onPeriodChange={(data) => {
        onIntervalChange?.(data.newPeriod.text)
      }}
      style={{ width: '100%', height }}
    />
  )
}
