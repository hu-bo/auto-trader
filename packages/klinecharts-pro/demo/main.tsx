import React, { useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import {
  KLineChart,
  type KLineChartInstance,
  type SymbolInfo,
  type Period,
  type KLineData,
  type Datafeed,
  type DatafeedSubscribeCallback,
} from '../src/react'
import '../src/styles/index.css'

// Mock data generator
function generateMockData(count: number, basePrice = 100): KLineData[] {
  const data: KLineData[] = []
  let currentPrice = basePrice
  const now = Date.now()
  const interval = 60 * 60 * 1000

  for (let i = count - 1; i >= 0; i--) {
    const timestamp = now - i * interval
    const change = (Math.random() - 0.5) * 4
    const open = currentPrice
    const close = currentPrice + change
    const high = Math.max(open, close) + Math.random() * 2
    const low = Math.min(open, close) - Math.random() * 2
    const volume = Math.floor(Math.random() * 10000000) + 1000000
    data.push({ timestamp, open, high, low, close, volume })
    currentPrice = close
  }
  return data
}

// Mock Datafeed
class MockDatafeed implements Datafeed {
  private subscriptions = new Map<string, ReturnType<typeof setInterval>>()
  private currentData = new Map<string, KLineData[]>()

  async searchSymbols(search?: string): Promise<SymbolInfo[]> {
    const symbols: SymbolInfo[] = [
      { ticker: 'AAPL', name: 'Apple Inc.', shortName: 'AAPL', exchange: 'NASDAQ', market: 'stocks' },
      { ticker: 'GOOGL', name: 'Alphabet Inc.', shortName: 'GOOGL', exchange: 'NASDAQ', market: 'stocks' },
      { ticker: 'MSFT', name: 'Microsoft Corp.', shortName: 'MSFT', exchange: 'NASDAQ', market: 'stocks' },
      { ticker: 'AMZN', name: 'Amazon.com Inc.', shortName: 'AMZN', exchange: 'NASDAQ', market: 'stocks' },
      { ticker: 'TSLA', name: 'Tesla Inc.', shortName: 'TSLA', exchange: 'NASDAQ', market: 'stocks' },
      { ticker: 'BTC/USD', name: 'Bitcoin', shortName: 'BTC', exchange: 'Crypto', market: 'crypto' },
      { ticker: 'ETH/USD', name: 'Ethereum', shortName: 'ETH', exchange: 'Crypto', market: 'crypto' },
    ]
    if (!search) return symbols
    const lower = search.toLowerCase()
    return symbols.filter(
      (s) => s.ticker.toLowerCase().includes(lower) || s.name?.toLowerCase().includes(lower)
    )
  }

  async getHistoryKLineData(symbol: SymbolInfo, period: Period): Promise<KLineData[]> {
    const key = `${symbol.ticker}_${period.text}`
    const basePrices: Record<string, number> = {
      AAPL: 175, GOOGL: 140, MSFT: 380, AMZN: 180, TSLA: 250, 'BTC/USD': 42000, 'ETH/USD': 2500,
    }
    const data = generateMockData(500, basePrices[symbol.ticker] || 100)
    this.currentData.set(key, data)
    return data
  }

  subscribe(symbol: SymbolInfo, period: Period, callback: DatafeedSubscribeCallback): void {
    const key = `${symbol.ticker}_${period.text}`
    if (this.subscriptions.has(key)) return
    const id = setInterval(() => {
      const data = this.currentData.get(key)
      if (data && data.length > 0) {
        const last = data[data.length - 1]
        const change = (Math.random() - 0.5) * 2
        const newClose = last.close + change
        callback({
          timestamp: Date.now(),
          open: last.close,
          high: Math.max(last.close, newClose) + Math.random() * 0.5,
          low: Math.min(last.close, newClose) - Math.random() * 0.5,
          close: newClose,
          volume: Math.floor(Math.random() * 1000000) + 100000,
        })
      }
    }, 2000)
    this.subscriptions.set(key, id)
  }

  unsubscribe(symbol: SymbolInfo, period: Period): void {
    const key = `${symbol.ticker}_${period.text}`
    const id = this.subscriptions.get(key)
    if (id) {
      clearInterval(id)
      this.subscriptions.delete(key)
    }
  }
}

const datafeed = new MockDatafeed()

const defaultPeriods: Period[] = [
  { span: 1, type: 'minute', text: '1m' },
  { span: 5, type: 'minute', text: '5m' },
  { span: 15, type: 'minute', text: '15m' },
  { span: 30, type: 'minute', text: '30m' },
  { span: 1, type: 'hour', text: '1H' },
  { span: 4, type: 'hour', text: '4H' },
  { span: 1, type: 'day', text: '1D' },
  { span: 1, type: 'week', text: '1W' },
]

function App() {
  const chartRef = useRef<KLineChartInstance>(null)
  const [theme, setTheme] = useState<'light' | 'dark'>('dark')
  const isDark = theme === 'dark'

  return (
    <div style={{
      width: '100%', height: '100vh', display: 'flex', flexDirection: 'column',
      backgroundColor: isDark ? '#1a1a1a' : '#f5f5f5',
    }}>
      {/* Only external control: theme toggle */}
      <div style={{
        display: 'flex', alignItems: 'center', padding: '8px 16px',
        backgroundColor: isDark ? '#252525' : '#ffffff',
        borderBottom: `1px solid ${isDark ? '#3d3d3d' : '#e5e5e5'}`,
        justifyContent: 'flex-end',
      }}>
        <button onClick={() => {
          const next = isDark ? 'light' : 'dark'
          setTheme(next)
          chartRef.current?.setTheme(next)
        }} style={{
          padding: '6px 12px',
          border: `1px solid ${isDark ? '#3d3d3d' : '#e5e5e5'}`,
          borderRadius: 4, fontSize: 12, cursor: 'pointer',
          backgroundColor: isDark ? '#1a1a1a' : '#ffffff',
          color: isDark ? '#929aa5' : '#666',
        }}>
          {isDark ? '☀️ 亮色' : '🌙 暗色'}
        </button>
      </div>

      {/* Chart with built-in toolbar: symbol search + period selector + indicator */}
      <div style={{ flex: 1, position: 'relative' }}>
        <KLineChart
          ref={chartRef}
          symbol={{ ticker: 'AAPL', name: 'Apple Inc.', shortName: 'AAPL', exchange: 'NASDAQ' }}
          period={{ span: 1, type: 'hour', text: '1H' }}
          periods={defaultPeriods}
          datafeed={datafeed}
          theme={theme}
          locale="zh-CN"
          toolbarVisible={true}
          mainIndicators={['MA']}
          subIndicators={['VOL']}
          onSymbolChange={(data) => console.log('Symbol changed:', data.newSymbol.ticker)}
          onPeriodChange={(data) => console.log('Period changed:', data.newPeriod.text)}
          onReady={(chart) => console.log('Chart ready:', chart)}
          style={{ width: '100%', height: '100%' }}
        />
      </div>
    </div>
  )
}

const root = createRoot(document.getElementById('root')!)
root.render(<App />)
