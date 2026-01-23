import React, { useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { KLineChart, type KLineChartInstance, type SymbolInfo, type Period, type KLineData, type Datafeed, type DatafeedSubscribeCallback } from '../src/react'
import '../src/styles/index.css'

// 指标配置
const MAIN_INDICATORS = [
  { name: 'MA', label: 'MA 移动平均线' },
  { name: 'EMA', label: 'EMA 指数移动平均' },
  { name: 'SMA', label: 'SMA 简单移动平均' },
  { name: 'BOLL', label: 'BOLL 布林带' },
  { name: 'SAR', label: 'SAR 抛物线' },
  { name: 'BBI', label: 'BBI 多空指标' },
]

const SUB_INDICATORS = [
  { name: 'VOL', label: 'VOL 成交量' },
  { name: 'MACD', label: 'MACD 指数平滑异同' },
  { name: 'KDJ', label: 'KDJ 随机指标' },
  { name: 'RSI', label: 'RSI 相对强弱' },
  { name: 'BIAS', label: 'BIAS 乖离率' },
  { name: 'CCI', label: 'CCI 顺势指标' },
  { name: 'DMI', label: 'DMI 趋向指标' },
  { name: 'CR', label: 'CR 能量指标' },
  { name: 'PSY', label: 'PSY 心理线' },
  { name: 'TRIX', label: 'TRIX 三重指数' },
  { name: 'OBV', label: 'OBV 能量潮' },
  { name: 'WR', label: 'WR 威廉指标' },
  { name: 'MTM', label: 'MTM 动量指标' },
  { name: 'ROC', label: 'ROC 变动率' },
  { name: 'AO', label: 'AO 动量震荡' },
]

// 模拟数据生成器
function generateMockData(count: number, basePrice: number = 100): KLineData[] {
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

// 模拟 Datafeed 实现
class MockDatafeed implements Datafeed {
  private subscriptions: Map<string, ReturnType<typeof setInterval>> = new Map()
  private currentData: Map<string, KLineData[]> = new Map()

  async searchSymbols(search?: string): Promise<SymbolInfo[]> {
    const symbols: SymbolInfo[] = [
      { ticker: 'AAPL', name: 'Apple Inc.', shortName: 'AAPL', exchange: 'NASDAQ', market: 'stocks' },
      { ticker: 'GOOGL', name: 'Alphabet Inc.', shortName: 'GOOGL', exchange: 'NASDAQ', market: 'stocks' },
      { ticker: 'MSFT', name: 'Microsoft Corporation', shortName: 'MSFT', exchange: 'NASDAQ', market: 'stocks' },
      { ticker: 'AMZN', name: 'Amazon.com Inc.', shortName: 'AMZN', exchange: 'NASDAQ', market: 'stocks' },
      { ticker: 'TSLA', name: 'Tesla Inc.', shortName: 'TSLA', exchange: 'NASDAQ', market: 'stocks' },
      { ticker: 'BTC/USD', name: 'Bitcoin', shortName: 'BTC', exchange: 'Crypto', market: 'crypto' },
      { ticker: 'ETH/USD', name: 'Ethereum', shortName: 'ETH', exchange: 'Crypto', market: 'crypto' },
    ]

    if (!search) return symbols
    return symbols.filter(
      (s) =>
        s.ticker.toLowerCase().includes(search.toLowerCase()) ||
        s.name?.toLowerCase().includes(search.toLowerCase())
    )
  }

  async getHistoryKLineData(
    symbol: SymbolInfo,
    period: Period,
  ): Promise<KLineData[]> {
    const key = `${symbol.ticker}_${period.text}`
    const basePrices: Record<string, number> = {
      'AAPL': 175, 'GOOGL': 140, 'MSFT': 380, 'AMZN': 180,
      'TSLA': 250, 'BTC/USD': 42000, 'ETH/USD': 2500,
    }

    const basePrice = basePrices[symbol.ticker] || 100
    const data = generateMockData(500, basePrice)
    this.currentData.set(key, data)
    return data
  }

  subscribe(symbol: SymbolInfo, period: Period, callback: DatafeedSubscribeCallback): void {
    const key = `${symbol.ticker}_${period.text}`
    if (this.subscriptions.has(key)) return

    const intervalId = setInterval(() => {
      const data = this.currentData.get(key)
      if (data && data.length > 0) {
        const lastData = data[data.length - 1]
        const change = (Math.random() - 0.5) * 2
        const newClose = lastData.close + change

        callback({
          timestamp: Date.now(),
          open: lastData.close,
          high: Math.max(lastData.close, newClose) + Math.random() * 0.5,
          low: Math.min(lastData.close, newClose) - Math.random() * 0.5,
          close: newClose,
          volume: Math.floor(Math.random() * 1000000) + 100000,
        })
      }
    }, 2000)

    this.subscriptions.set(key, intervalId)
  }

  unsubscribe(symbol: SymbolInfo, period: Period): void {
    const key = `${symbol.ticker}_${period.text}`
    const intervalId = this.subscriptions.get(key)
    if (intervalId) {
      clearInterval(intervalId)
      this.subscriptions.delete(key)
    }
  }
}

const datafeed = new MockDatafeed()

const defaultPeriods: Period[] = [
  { multiplier: 1, timespan: 'minute', text: '1m' },
  { multiplier: 5, timespan: 'minute', text: '5m' },
  { multiplier: 15, timespan: 'minute', text: '15m' },
  { multiplier: 30, timespan: 'minute', text: '30m' },
  { multiplier: 1, timespan: 'hour', text: '1H' },
  { multiplier: 4, timespan: 'hour', text: '4H' },
  { multiplier: 1, timespan: 'day', text: '1D' },
  { multiplier: 1, timespan: 'week', text: '1W' },
]

// 指标弹窗组件
function IndicatorModal({
  visible,
  onClose,
  theme,
  mainIndicators,
  subIndicators,
  onMainIndicatorToggle,
  onSubIndicatorToggle,
}: {
  visible: boolean
  onClose: () => void
  theme: 'light' | 'dark'
  mainIndicators: Set<string>
  subIndicators: Set<string>
  onMainIndicatorToggle: (name: string) => void
  onSubIndicatorToggle: (name: string) => void
}) {
  if (!visible) return null

  const isDark = theme === 'dark'
  const bgColor = isDark ? '#252525' : '#ffffff'
  const borderColor = isDark ? '#3d3d3d' : '#e5e5e5'
  const textColor = isDark ? '#e5e5e5' : '#333333'
  const subTextColor = isDark ? '#929aa5' : '#666666'

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0,0,0,0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 2000,
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: bgColor,
          borderRadius: '8px',
          width: '480px',
          maxHeight: '80vh',
          overflow: 'hidden',
          boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: '16px 20px',
            borderBottom: `1px solid ${borderColor}`,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <span style={{ fontSize: '16px', fontWeight: 600, color: textColor }}>指标设置</span>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              fontSize: '20px',
              cursor: 'pointer',
              color: subTextColor,
              padding: '4px',
            }}
          >
            ×
          </button>
        </div>

        {/* Content */}
        <div style={{ padding: '16px 20px', maxHeight: '60vh', overflow: 'auto' }}>
          {/* 主图指标 */}
          <div style={{ marginBottom: '20px' }}>
            <div
              style={{
                fontSize: '14px',
                fontWeight: 500,
                color: textColor,
                marginBottom: '12px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <span
                style={{
                  width: '4px',
                  height: '16px',
                  backgroundColor: '#1677ff',
                  borderRadius: '2px',
                }}
              />
              主图指标
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              {MAIN_INDICATORS.map((indicator) => (
                <label
                  key={indicator.name}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '8px 12px',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    backgroundColor: mainIndicators.has(indicator.name)
                      ? (isDark ? 'rgba(22,119,255,0.15)' : 'rgba(22,119,255,0.08)')
                      : 'transparent',
                    border: `1px solid ${mainIndicators.has(indicator.name) ? '#1677ff' : borderColor}`,
                    transition: 'all 0.2s',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={mainIndicators.has(indicator.name)}
                    onChange={() => onMainIndicatorToggle(indicator.name)}
                    style={{ accentColor: '#1677ff' }}
                  />
                  <span style={{ fontSize: '13px', color: textColor }}>{indicator.label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* 副图指标 */}
          <div>
            <div
              style={{
                fontSize: '14px',
                fontWeight: 500,
                color: textColor,
                marginBottom: '12px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <span
                style={{
                  width: '4px',
                  height: '16px',
                  backgroundColor: '#52c41a',
                  borderRadius: '2px',
                }}
              />
              副图指标
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              {SUB_INDICATORS.map((indicator) => (
                <label
                  key={indicator.name}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '8px 12px',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    backgroundColor: subIndicators.has(indicator.name)
                      ? (isDark ? 'rgba(82,196,26,0.15)' : 'rgba(82,196,26,0.08)')
                      : 'transparent',
                    border: `1px solid ${subIndicators.has(indicator.name) ? '#52c41a' : borderColor}`,
                    transition: 'all 0.2s',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={subIndicators.has(indicator.name)}
                    onChange={() => onSubIndicatorToggle(indicator.name)}
                    style={{ accentColor: '#52c41a' }}
                  />
                  <span style={{ fontSize: '13px', color: textColor }}>{indicator.label}</span>
                </label>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function App() {
  const chartRef = useRef<KLineChartInstance>(null)
  const [theme, setTheme] = useState<'light' | 'dark'>('dark')
  const [symbol, setSymbol] = useState<SymbolInfo>({
    ticker: 'AAPL',
    name: 'Apple Inc.',
    shortName: 'AAPL',
    exchange: 'NASDAQ',
  })
  const [period, setPeriod] = useState<Period>({ multiplier: 1, timespan: 'hour', text: '1H' })
  const [searchResults, setSearchResults] = useState<SymbolInfo[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [showSearch, setShowSearch] = useState(false)
  const [showIndicatorModal, setShowIndicatorModal] = useState(false)

  // 已启用的指标
  const [mainIndicators, setMainIndicators] = useState<Set<string>>(new Set(['MA']))
  const [subIndicators, setSubIndicators] = useState<Set<string>>(new Set(['VOL']))

  // 存储副图指标的 paneId
  const subPaneIds = useRef<Map<string, string>>(new Map())

  const handleThemeToggle = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light'
    setTheme(newTheme)
    chartRef.current?.setTheme(newTheme)
  }

  const handlePeriodChange = (newPeriod: Period) => {
    setPeriod(newPeriod)
    chartRef.current?.setPeriod(newPeriod)
  }

  const handleSymbolChange = (newSymbol: SymbolInfo) => {
    setSymbol(newSymbol)
    chartRef.current?.setSymbol(newSymbol)
    setShowSearch(false)
    setSearchQuery('')
  }

  const handleSearch = async (query: string) => {
    setSearchQuery(query)
    if (query.length > 0) {
      const results = await datafeed.searchSymbols(query)
      setSearchResults(results)
      setShowSearch(true)
    } else {
      setSearchResults([])
      setShowSearch(false)
    }
  }

  const handleMainIndicatorToggle = (name: string) => {
    const newIndicators = new Set(mainIndicators)
    if (newIndicators.has(name)) {
      newIndicators.delete(name)
      chartRef.current?.removeIndicator('candle_pane', name)
    } else {
      newIndicators.add(name)
      chartRef.current?.createIndicator(name, false, { id: 'candle_pane' })
    }
    setMainIndicators(newIndicators)
  }

  const handleSubIndicatorToggle = (name: string) => {
    const newIndicators = new Set(subIndicators)
    if (newIndicators.has(name)) {
      newIndicators.delete(name)
      const paneId = subPaneIds.current.get(name)
      if (paneId) {
        chartRef.current?.removeIndicator(paneId, name)
        subPaneIds.current.delete(name)
      }
    } else {
      newIndicators.add(name)
      const paneId = chartRef.current?.createIndicator(name, true)
      if (paneId) {
        subPaneIds.current.set(name, paneId)
      }
    }
    setSubIndicators(newIndicators)
  }

  const isDark = theme === 'dark'

  return (
    <div
      style={{
        width: '100%',
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: isDark ? '#1a1a1a' : '#f5f5f5',
      }}
    >
      {/* Toolbar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          padding: '8px 16px',
          gap: '16px',
          backgroundColor: isDark ? '#252525' : '#ffffff',
          borderBottom: `1px solid ${isDark ? '#3d3d3d' : '#e5e5e5'}`,
          flexWrap: 'wrap',
        }}
      >
        {/* Symbol Search */}
        <div style={{ position: 'relative' }}>
          <input
            type="text"
            placeholder="搜索标的..."
            value={searchQuery || symbol.ticker}
            onChange={(e) => handleSearch(e.target.value)}
            onFocus={() => searchQuery && setShowSearch(true)}
            style={{
              padding: '6px 12px',
              border: `1px solid ${isDark ? '#3d3d3d' : '#e5e5e5'}`,
              borderRadius: '4px',
              backgroundColor: isDark ? '#1a1a1a' : '#ffffff',
              color: isDark ? '#e5e5e5' : '#333333',
              width: '160px',
              fontSize: '13px',
              outline: 'none',
            }}
          />
          {showSearch && searchResults.length > 0 && (
            <div
              style={{
                position: 'absolute',
                top: '100%',
                left: 0,
                right: 0,
                marginTop: '4px',
                backgroundColor: isDark ? '#252525' : '#ffffff',
                border: `1px solid ${isDark ? '#3d3d3d' : '#e5e5e5'}`,
                borderRadius: '6px',
                boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                zIndex: 1000,
                maxHeight: '300px',
                overflow: 'auto',
              }}
            >
              {searchResults.map((s) => (
                <div
                  key={s.ticker}
                  onClick={() => handleSymbolChange(s)}
                  style={{
                    padding: '10px 12px',
                    cursor: 'pointer',
                    borderBottom: `1px solid ${isDark ? '#3d3d3d' : '#f0f0f0'}`,
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = isDark ? '#333' : '#f5f5f5'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent'
                  }}
                >
                  <div style={{ fontWeight: 500, color: isDark ? '#e5e5e5' : '#333', fontSize: '13px' }}>
                    {s.ticker}
                  </div>
                  <div style={{ fontSize: '11px', color: isDark ? '#929aa5' : '#666', marginTop: '2px' }}>
                    {s.name}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Period Selector */}
        <div style={{ display: 'flex', gap: '4px' }}>
          {defaultPeriods.map((p) => (
            <button
              key={p.text}
              onClick={() => handlePeriodChange(p)}
              style={{
                padding: '4px 8px',
                border: 'none',
                borderRadius: '4px',
                fontSize: '12px',
                cursor: 'pointer',
                backgroundColor: period.text === p.text ? '#1677ff' : (isDark ? '#333' : '#f0f0f0'),
                color: period.text === p.text ? '#ffffff' : (isDark ? '#929aa5' : '#666'),
              }}
            >
              {p.text}
            </button>
          ))}
        </div>

        {/* Indicator Button */}
        <button
          onClick={() => setShowIndicatorModal(true)}
          style={{
            padding: '6px 12px',
            border: `1px solid ${isDark ? '#3d3d3d' : '#e5e5e5'}`,
            borderRadius: '4px',
            fontSize: '12px',
            cursor: 'pointer',
            backgroundColor: isDark ? '#1a1a1a' : '#ffffff',
            color: isDark ? '#929aa5' : '#666',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
          }}
        >
          <span>📊</span>
          <span>指标</span>
          <span
            style={{
              backgroundColor: '#1677ff',
              color: '#fff',
              padding: '0 6px',
              borderRadius: '10px',
              fontSize: '11px',
            }}
          >
            {mainIndicators.size + subIndicators.size}
          </span>
        </button>

        {/* Theme Toggle */}
        <button
          onClick={handleThemeToggle}
          style={{
            padding: '6px 12px',
            border: `1px solid ${isDark ? '#3d3d3d' : '#e5e5e5'}`,
            borderRadius: '4px',
            fontSize: '12px',
            cursor: 'pointer',
            backgroundColor: isDark ? '#1a1a1a' : '#ffffff',
            color: isDark ? '#929aa5' : '#666',
            marginLeft: 'auto',
          }}
        >
          {isDark ? '☀️ 亮色' : '🌙 暗色'}
        </button>
      </div>

      {/* Chart */}
      <div style={{ flex: 1, position: 'relative' }}>
        <KLineChart
          ref={chartRef}
          symbol={symbol}
          period={period}
          datafeed={datafeed}
          theme={theme}
          locale="zh-CN"
          mainIndicators={Array.from(mainIndicators)}
          subIndicators={Array.from(subIndicators)}
          onReady={(chart) => {
            console.log('Chart ready:', chart)
          }}
          style={{ width: '100%', height: '100%' }}
        />
      </div>

      {/* Indicator Modal */}
      <IndicatorModal
        visible={showIndicatorModal}
        onClose={() => setShowIndicatorModal(false)}
        theme={theme}
        mainIndicators={mainIndicators}
        subIndicators={subIndicators}
        onMainIndicatorToggle={handleMainIndicatorToggle}
        onSubIndicatorToggle={handleSubIndicatorToggle}
      />
    </div>
  )
}

const root = createRoot(document.getElementById('root')!)
root.render(<App />)
