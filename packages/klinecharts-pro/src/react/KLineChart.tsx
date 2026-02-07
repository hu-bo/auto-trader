import React, { useRef, useEffect, useCallback, useImperativeHandle, useState, useMemo } from 'react'
import { KLineChartPro } from '../core/KLineChartPro'
import { createChartInstance } from '../core/createChartInstance'
import { IndicatorModal } from './IndicatorModal'
import type {
  KLineChartProOptions,
  SymbolInfo,
  Period,
  KLineChartInstance,
  ChartActionCallback,
  TradeMarker,
  BarClickEvent,
} from '../types'
import type { DeepPartial, Styles } from 'klinecharts'

export interface KLineChartProps extends Omit<KLineChartProOptions, 'container'> {
  className?: string
  style?: React.CSSProperties
  markers?: TradeMarker[]
  /** Hide the built-in toolbar (symbol search + period selector + indicator) */
  toolbarVisible?: boolean
  ref?: React.Ref<KLineChartInstance>
  onReady?: (chart: KLineChartPro) => void
  onSymbolChange?: (data: { oldSymbol: SymbolInfo; newSymbol: SymbolInfo }) => void
  onPeriodChange?: (data: { oldPeriod: Period; newPeriod: Period }) => void
  onCrosshairChange?: (data: unknown) => void
  onBarClick?: (data: BarClickEvent) => void
  onZoom?: (data: unknown) => void
  onScroll?: (data: unknown) => void
}

export function KLineChart(props: KLineChartProps): React.ReactElement {
  const {
    className,
    style,
    markers,
    toolbarVisible = true,
    ref,
    onReady,
    onSymbolChange,
    onPeriodChange,
    onCrosshairChange,
    onBarClick,
    onZoom,
    onScroll,
    ...options
  } = props

  const containerRef = useRef<HTMLDivElement>(null)
  const chartContainerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<KLineChartPro | null>(null)
  const searchRef = useRef<HTMLDivElement>(null)
  const subPaneIds = useRef<Map<string, string>>(new Map())

  // Symbol search state
  const [searchText, setSearchText] = useState('')
  const [allSymbols, setAllSymbols] = useState<SymbolInfo[]>([])
  const [symbolsLoaded, setSymbolsLoaded] = useState(false)
  const [showResults, setShowResults] = useState(false)

  // Current symbol & period synced with chart
  const [currentSymbol, setCurrentSymbol] = useState<SymbolInfo>(options.symbol)
  const [currentPeriod, setCurrentPeriod] = useState<Period>(options.period)

  // Indicator state
  const [mainIndicator, setMainIndicator] = useState<string | null>(
    options.mainIndicators?.[0] || 'MA'
  )
  const [subIndicatorsSet, setSubIndicatorsSet] = useState<Set<string>>(
    new Set(options.subIndicators || ['VOL'])
  )
  const [showIndicatorModal, setShowIndicatorModal] = useState(false)

  const periods = options.periods || []

  // Preload all symbols once
  useEffect(() => {
    if (!toolbarVisible) return
    let cancelled = false
    options.datafeed.searchSymbols().then((symbols) => {
      if (!cancelled) {
        setAllSymbols(symbols)
        setSymbolsLoaded(true)
      }
    })
    return () => { cancelled = true }
  }, [options.datafeed, toolbarVisible])

  // Local filter
  const filteredResults = useMemo(() => {
    if (!searchText.trim()) return allSymbols
    const lower = searchText.toLowerCase()
    return allSymbols.filter(
      (s) =>
        s.ticker.toLowerCase().includes(lower) ||
        (s.name && s.name.toLowerCase().includes(lower)) ||
        (s.shortName && s.shortName.toLowerCase().includes(lower))
    )
  }, [searchText, allSymbols])

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowResults(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleSymbolSelect = useCallback((symbol: SymbolInfo) => {
    setCurrentSymbol(symbol)
    setShowResults(false)
    setSearchText('')
    chartRef.current?.setSymbol(symbol)
  }, [])

  const handlePeriodSelect = useCallback((period: Period) => {
    setCurrentPeriod(period)
    chartRef.current?.setPeriod(period)
  }, [])

  // Indicator handlers
  const handleMainIndicatorSelect = useCallback((name: string | null) => {
    setMainIndicator((prev) => {
      // Remove previous
      if (prev) chartRef.current?.removeIndicator('candle_pane', prev)
      // Add new (if not deselecting)
      if (name) chartRef.current?.createIndicator(name, false, { id: 'candle_pane' })
      return name
    })
  }, [])

  const handleSubIndicatorToggle = useCallback((name: string) => {
    setSubIndicatorsSet((prev) => {
      const next = new Set(prev)
      if (next.has(name)) {
        next.delete(name)
        const paneId = subPaneIds.current.get(name)
        if (paneId) {
          chartRef.current?.removeIndicator(paneId, name)
          subPaneIds.current.delete(name)
        }
      } else {
        next.add(name)
        const paneId = chartRef.current?.createIndicator(name, true)
        if (paneId) subPaneIds.current.set(name, paneId)
      }
      return next
    })
  }, [])

  const indicatorCount = (mainIndicator ? 1 : 0) + subIndicatorsSet.size

  // Event callbacks
  const handleSymbolChange = useCallback(
    (data: { oldSymbol: SymbolInfo; newSymbol: SymbolInfo }) => {
      setCurrentSymbol(data.newSymbol)
      onSymbolChange?.(data)
    },
    [onSymbolChange]
  )

  const handlePeriodChange = useCallback(
    (data: { oldPeriod: Period; newPeriod: Period }) => {
      setCurrentPeriod(data.newPeriod)
      onPeriodChange?.(data)
    },
    [onPeriodChange]
  )

  const handleCrosshairChange = useCallback(
    (data: unknown) => { onCrosshairChange?.(data) },
    [onCrosshairChange]
  )

  const handleBarClick = useCallback(
    (data: BarClickEvent) => { onBarClick?.(data) },
    [onBarClick]
  )

  const handleZoom = useCallback(
    (data: unknown) => { onZoom?.(data) },
    [onZoom]
  )

  const handleScroll = useCallback(
    (data: unknown) => { onScroll?.(data) },
    [onScroll]
  )

  // Initialize chart
  useEffect(() => {
    if (!chartContainerRef.current) return

    const chart = new KLineChartPro({
      container: chartContainerRef.current,
      ...options,
    })

    chartRef.current = chart

    chart.subscribeAction('onSymbolChange', handleSymbolChange as ChartActionCallback)
    chart.subscribeAction('onPeriodChange', handlePeriodChange as ChartActionCallback)
    if (onCrosshairChange) chart.subscribeAction('onCrosshairChange', handleCrosshairChange)
    if (onBarClick) chart.subscribeAction('onBarClick', handleBarClick as ChartActionCallback)
    if (onZoom) chart.subscribeAction('onZoom', handleZoom)
    if (onScroll) chart.subscribeAction('onScroll', handleScroll)

    onReady?.(chart)

    return () => {
      chart.destroy()
      chartRef.current = null
    }
  }, [])

  // Sync props
  useEffect(() => { if (options.theme) chartRef.current?.setTheme(options.theme) }, [options.theme])
  useEffect(() => { if (options.locale) chartRef.current?.setLocale(options.locale) }, [options.locale])
  useEffect(() => { if (options.timezone) chartRef.current?.setTimezone(options.timezone) }, [options.timezone])
  useEffect(() => { if (options.styles) chartRef.current?.setStyles(options.styles as DeepPartial<Styles>) }, [options.styles])

  useEffect(() => {
    if (!chartRef.current) return
    if (markers && markers.length > 0) {
      chartRef.current.setMarkers(markers)
    } else {
      chartRef.current.clearMarkers()
    }
  }, [markers])

  useEffect(() => {
    const handleResize = () => { chartRef.current?.resize() }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  useImperativeHandle(
    ref,
    () => createChartInstance(() => chartRef.current, options.symbol, options.period),
    [options.symbol, options.period]
  )

  const themeClass = options.theme === 'dark' ? 'dark' : 'light'

  return (
    <div
      ref={containerRef}
      className={`klinecharts-pro-container ${toolbarVisible ? 'with-toolbar' : ''} ${className || ''}`.trim()}
      data-theme={themeClass}
      style={{ width: '100%', height: '100%', position: 'relative', ...style }}
    >
      {toolbarVisible && (
        <div className="klinecharts-pro-toolbar">
          {/* Symbol search */}
          <div className="klinecharts-pro-search" ref={searchRef}>
            <input
              className="klinecharts-pro-search-input"
              type="text"
              placeholder={currentSymbol.name || currentSymbol.ticker}
              value={searchText}
              onChange={(e) => {
                setSearchText(e.target.value)
                setShowResults(true)
              }}
              onFocus={() => setShowResults(true)}
            />
            {showResults && symbolsLoaded && (
              <div className="klinecharts-pro-search-results">
                {filteredResults.length === 0 ? (
                  <div
                    className="klinecharts-pro-search-result-item"
                    style={{ color: '#999', cursor: 'default' }}
                  >
                    No results
                  </div>
                ) : (
                  filteredResults.slice(0, 50).map((s) => (
                    <div
                      key={s.ticker}
                      className={`klinecharts-pro-search-result-item ${s.ticker === currentSymbol.ticker ? 'active' : ''}`}
                      onClick={() => handleSymbolSelect(s)}
                    >
                      <div className="klinecharts-pro-search-result-item-ticker">{s.ticker}</div>
                      {s.name && (
                        <div className="klinecharts-pro-search-result-item-name">{s.name}</div>
                      )}
                    </div>
                  ))
                )}
              </div>
            )}
          </div>

          {/* Period selector */}
          <div className="klinecharts-pro-period-selector">
            {periods.map((p) => (
              <button
                key={p.text}
                className={`klinecharts-pro-period-btn ${p.text === currentPeriod.text ? 'active' : ''}`}
                onClick={() => handlePeriodSelect(p)}
              >
                {p.text}
              </button>
            ))}
          </div>

          {/* Indicator button */}
          <div className="klinecharts-pro-indicator-selector">
            <button
              className="klinecharts-pro-indicator-btn"
              onClick={() => setShowIndicatorModal(true)}
            >
              <span>📊</span>
              <span>指标</span>
              {indicatorCount > 0 && (
                <span style={{
                  backgroundColor: '#1677ff', color: '#fff',
                  padding: '0 6px', borderRadius: 10, fontSize: 11, lineHeight: '18px',
                }}>
                  {indicatorCount}
                </span>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Chart canvas */}
      <div
        ref={chartContainerRef}
        className="klinecharts-pro-chart"
        style={{ position: 'absolute', left: 0, right: 0, bottom: 0, top: toolbarVisible ? 45 : 0 }}
      />

      {/* Indicator modal */}
      <IndicatorModal
        visible={showIndicatorModal}
        onClose={() => setShowIndicatorModal(false)}
        theme={themeClass}
        mainIndicator={mainIndicator}
        subIndicators={subIndicatorsSet}
        onMainSelect={handleMainIndicatorSelect}
        onSubToggle={handleSubIndicatorToggle}
      />
    </div>
  )
}

export type { KLineChartInstance as KLineChartRef }
