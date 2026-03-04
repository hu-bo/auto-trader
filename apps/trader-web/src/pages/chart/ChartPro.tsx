import React, { useRef, useEffect, useMemo } from 'react'
import { KLineChartPro } from '@hquant/klinecharts-pro'
import '@hquant/klinecharts-pro/styles.css'
import { useAppStore } from '@/stores/appStore'
import { TradingDatafeed } from '@/components/charts/KLineChart'

const ChartPro: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<KLineChartPro | null>(null)
  const { theme, selectedExchange } = useAppStore()

  const exchange = selectedExchange?.name || 'binance'
  const datafeed = useMemo(() => new TradingDatafeed(exchange, 'spot'), [exchange])

  useEffect(() => {
    if (!containerRef.current) return

    const chart = new KLineChartPro({
      container: containerRef.current,
      symbol: {
        ticker: 'BTC-USDT',
        name: 'BTC/USDT',
        exchange,
        market: 'spot',
      },
      period: { multiplier: 15, timespan: 'minute', text: '15m' },
      datafeed,
      theme: theme === 'dark' ? 'dark' : 'light',
      locale: 'zh-CN',
      mainIndicators: ['MA'],
      subIndicators: ['VOL'],
    })
    chartRef.current = chart

    return () => {
      chart.destroy()
      chartRef.current = null
    }
  }, [datafeed])

  useEffect(() => {
    chartRef.current?.setTheme(theme === 'dark' ? 'dark' : 'light')
  }, [theme])

  useEffect(() => {
    return () => { datafeed.destroy() }
  }, [datafeed])

  return (
    <div
      ref={containerRef}
      style={{ width: '100%', height: 'calc(100vh - 112px)' }}
    />
  )
}

export default ChartPro
