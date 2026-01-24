import * as React from 'react'
import { useRef, useEffect, useCallback, forwardRef, useImperativeHandle } from 'react'
import { KLineChartPro } from '../core/KLineChartPro'
import { createChartInstance } from '../core/createChartInstance'
import type {
  KLineChartProOptions,
  SymbolInfo,
  Period,
  KLineChartInstance,
  ChartActionCallback,
  TradeMarker,
} from '../types'
import type { DeepPartial, Styles } from 'klinecharts'

export interface KLineChartProps extends Omit<KLineChartProOptions, 'container'> {
  className?: string
  style?: React.CSSProperties
  markers?: TradeMarker[]
  onReady?: (chart: KLineChartPro) => void
  onSymbolChange?: (data: { oldSymbol: SymbolInfo; newSymbol: SymbolInfo }) => void
  onPeriodChange?: (data: { oldPeriod: Period; newPeriod: Period }) => void
  onCrosshairChange?: (data: unknown) => void
  onZoom?: (data: unknown) => void
  onScroll?: (data: unknown) => void
}

function KLineChartInner(
  props: KLineChartProps,
  ref: React.ForwardedRef<KLineChartInstance>
): React.ReactElement {
  const {
    className,
    style,
    markers,
    onReady,
    onSymbolChange,
    onPeriodChange,
    onCrosshairChange,
    onZoom,
    onScroll,
    ...options
  } = props

  const containerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<KLineChartPro | null>(null)

  const handleSymbolChange = useCallback(
    (data: { oldSymbol: SymbolInfo; newSymbol: SymbolInfo }) => {
      onSymbolChange?.(data)
    },
    [onSymbolChange]
  )

  const handlePeriodChange = useCallback(
    (data: { oldPeriod: Period; newPeriod: Period }) => {
      onPeriodChange?.(data)
    },
    [onPeriodChange]
  )

  const handleCrosshairChange = useCallback(
    (data: unknown) => {
      onCrosshairChange?.(data)
    },
    [onCrosshairChange]
  )

  const handleZoom = useCallback(
    (data: unknown) => {
      onZoom?.(data)
    },
    [onZoom]
  )

  const handleScroll = useCallback(
    (data: unknown) => {
      onScroll?.(data)
    },
    [onScroll]
  )

  useEffect(() => {
    if (!containerRef.current) return

    const chart = new KLineChartPro({
      container: containerRef.current,
      ...options,
    })

    chartRef.current = chart

    if (onSymbolChange) {
      chart.subscribeAction('onSymbolChange', handleSymbolChange as ChartActionCallback)
    }
    if (onPeriodChange) {
      chart.subscribeAction('onPeriodChange', handlePeriodChange as ChartActionCallback)
    }
    if (onCrosshairChange) {
      chart.subscribeAction('onCrosshairChange', handleCrosshairChange)
    }
    if (onZoom) {
      chart.subscribeAction('onZoom', handleZoom)
    }
    if (onScroll) {
      chart.subscribeAction('onScroll', handleScroll)
    }

    onReady?.(chart)

    return () => {
      chart.destroy()
      chartRef.current = null
    }
  }, [])

  useEffect(() => {
    if (!chartRef.current) return

    if (options.theme) {
      chartRef.current.setTheme(options.theme)
    }
  }, [options.theme])

  useEffect(() => {
    if (!chartRef.current) return

    if (options.locale) {
      chartRef.current.setLocale(options.locale)
    }
  }, [options.locale])

  useEffect(() => {
    if (!chartRef.current) return

    if (options.timezone) {
      chartRef.current.setTimezone(options.timezone)
    }
  }, [options.timezone])

  useEffect(() => {
    if (!chartRef.current) return

    if (options.styles) {
      chartRef.current.setStyles(options.styles as DeepPartial<Styles>)
    }
  }, [options.styles])

  useEffect(() => {
    if (!chartRef.current) return

    if (markers && markers.length > 0) {
      chartRef.current.setMarkers(markers)
    } else {
      chartRef.current.clearMarkers()
    }
  }, [markers])

  useEffect(() => {
    const handleResize = () => {
      chartRef.current?.resize()
    }

    window.addEventListener('resize', handleResize)
    return () => {
      window.removeEventListener('resize', handleResize)
    }
  }, [])

  useImperativeHandle(
    ref,
    () => createChartInstance(() => chartRef.current, options.symbol, options.period),
    [options.symbol, options.period]
  )

  return React.createElement('div', {
    ref: containerRef,
    className: className,
    style: {
      width: '100%',
      height: '100%',
      ...style,
    },
  })
}

export const KLineChart = forwardRef<KLineChartInstance, KLineChartProps>(KLineChartInner)

KLineChart.displayName = 'KLineChart'

export type { KLineChartInstance as KLineChartRef }
