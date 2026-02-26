import { init, dispose, registerLocale, registerStyles } from 'klinecharts'
import type { Chart, IndicatorCreate, OverlayCreate, DeepPartial, Styles, ActionType } from 'klinecharts'
import type {
  KLineChartProOptions,
  SymbolInfo,
  Period,
  ThemeType,
  LocaleType,
  Datafeed,
  KLineData,
  ChartActionType,
  ChartActionCallback,
  BarClickEvent,
  TradeMarker,
} from '../types'
import { DEFAULT_PERIODS, getDefaultMainIndicators, getDefaultSubIndicators } from './defaults'
import { darkTheme, lightTheme } from '../themes'
import { zhCN, zhTW, enUS } from '../locales'

export class KLineChartPro {
  private container: HTMLElement
  private chart: Chart | null = null
  private datafeed: Datafeed
  private currentSymbol: SymbolInfo
  private currentPeriod: Period
  private currentTheme: ThemeType = 'light'
  private currentLocale: LocaleType = 'en-US'
  private currentTimezone: string = Intl.DateTimeFormat().resolvedOptions().timeZone
  private periods: Period[]
  private mainIndicators: string[]
  private subIndicators: string[]
  private subPaneIds: Map<string, string> = new Map()
  private actionCallbacks: Map<ChartActionType, Set<ChartActionCallback>> = new Map()
  private markerGroupId = 'trade_markers'

  constructor(options: KLineChartProOptions) {
    const containerElement =
      typeof options.container === 'string'
        ? document.getElementById(options.container)
        : options.container

    if (!containerElement) {
      throw new Error('Container element not found')
    }

    this.container = containerElement
    this.datafeed = options.datafeed
    this.currentSymbol = options.symbol
    this.currentPeriod = options.period
    this.periods = options.periods || DEFAULT_PERIODS
    this.mainIndicators = options.mainIndicators || getDefaultMainIndicators()
    this.subIndicators = options.subIndicators || getDefaultSubIndicators()

    if (options.theme) {
      this.currentTheme = options.theme
    }
    if (options.locale) {
      this.currentLocale = options.locale
    }
    if (options.timezone) {
      this.currentTimezone = options.timezone
    }

    this.registerBuiltinLocales()
    this.registerBuiltinThemes()
    this.initChart(options)
  }

  private registerBuiltinLocales(): void {
    registerLocale('zh-CN', zhCN)
    registerLocale('zh-TW', zhTW)
    registerLocale('en-US', enUS)
  }

  private registerBuiltinThemes(): void {
    registerStyles('dark', darkTheme)
    registerStyles('light', lightTheme)
  }

  private initChart(options: KLineChartProOptions): void {
    this.chart = init(this.container, {
      locale: this.currentLocale,
      timezone: this.currentTimezone,
      styles: options.styles as DeepPartial<Styles>,
    })

    if (!this.chart) {
      throw new Error('Failed to initialize chart')
    }

    this.setTheme(this.currentTheme)

    this.mainIndicators.forEach((indicator) => {
      this.chart?.createIndicator(indicator, false, { id: 'candle_pane' })
    })

    this.subIndicators.forEach((indicator) => {
      const paneId = this.chart?.createIndicator(indicator, true)
      if (paneId && typeof paneId === 'string') {
        this.subPaneIds.set(indicator, paneId)
      }
    })

    if (options.watermark) {
      this.setWatermark(options.watermark)
    }

    this.setupChartEvents()
    this.setupDataLoader()

    // Set period first, then symbol.
    // klinecharts resets and triggers init loading on each call; this order avoids duplicate initial fetch.
    this.chart.setPeriod(this.currentPeriod)
    this.chart.setSymbol(this.currentSymbol)
  }

  /**
   * v10: Use setDataLoader instead of setLoadDataCallback / applyNewData / updateData.
   * getBars handles initial load + backward/forward scrolling.
   * subscribeBar / unsubscribeBar handle real-time updates.
   */
  private setupDataLoader(): void {
    if (!this.chart) return

    const self = this

    this.chart.setDataLoader({
      getBars: async ({ type, timestamp, symbol, period, callback }) => {
        // Map klinecharts v10 Period back to our extended Period (with text)
        const extPeriod = self.findPeriod(period) || self.currentPeriod
        const duration = self.getPeriodDuration(extPeriod) * 500

        const normalizeData = (data: KLineData[]): KLineData[] => {
          const map = new Map<number, KLineData>()
          data.forEach((item) => {
            if (typeof item?.timestamp === 'number') {
              map.set(item.timestamp, item)
            }
          })
          return Array.from(map.values()).sort((a, b) => a.timestamp - b.timestamp)
        }

        try {
          if (type === 'init') {
            const to = Date.now()
            const from = to - duration
            const data = await self.datafeed.getHistoryKLineData(
              symbol as SymbolInfo, extPeriod, from, to
            )
            const normalized = normalizeData(data)
            callback(normalized, { forward: normalized.length > 0, backward: false })
            return
          }

          if (type === 'forward') {
            // klinecharts v10: forward = prepend older bars on the left side.
            const boundary = typeof timestamp === 'number' ? timestamp : Date.now()
            const from = boundary - duration
            const data = await self.datafeed.getHistoryKLineData(
              symbol as SymbolInfo, extPeriod, from, boundary
            )
            const normalized = normalizeData(data).filter((item) => item.timestamp < boundary)
            callback(normalized, { forward: normalized.length > 0, backward: false })
            return
          }

          if (type === 'backward') {
            // klinecharts v10: backward = append newer bars on the right side.
            const boundary = typeof timestamp === 'number' ? timestamp : Date.now()
            const now = Date.now()
            const to = Math.min(boundary + duration, now)

            if (to <= boundary) {
              callback([], { forward: false, backward: false })
              return
            }

            const data = await self.datafeed.getHistoryKLineData(
              symbol as SymbolInfo, extPeriod, boundary, to
            )
            const normalized = normalizeData(data).filter((item) => item.timestamp > boundary)
            callback(normalized, { forward: false, backward: normalized.length > 0 && to < now })
            return
          }

          callback([], { forward: false, backward: false })
        } catch (err) {
          console.error('Failed to load data:', err)
          callback([], { forward: false, backward: false })
        }
      },

      subscribeBar: ({ symbol, period, callback }) => {
        const extPeriod = self.findPeriod(period) || self.currentPeriod
        self.datafeed.subscribe(symbol as SymbolInfo, extPeriod, callback)
      },

      unsubscribeBar: ({ symbol, period }) => {
        const extPeriod = self.findPeriod(period) || self.currentPeriod
        self.datafeed.unsubscribe(symbol as SymbolInfo, extPeriod)
      },
    })
  }

  /** Find our extended Period (with text) matching a klinecharts Period */
  private findPeriod(kcPeriod: { type: string; span: number }): Period | undefined {
    return this.periods.find(
      (p) => p.type === kcPeriod.type && p.span === kcPeriod.span
    )
  }

  private setupChartEvents(): void {
    if (!this.chart) return

    this.chart.subscribeAction('onCrosshairChange' as ActionType, (data: unknown) => {
      this.emitAction('onCrosshairChange', data)
    })

    this.chart.subscribeAction('onZoom' as ActionType, (data: unknown) => {
      this.emitAction('onZoom', data)
    })

    this.chart.subscribeAction('onScroll' as ActionType, (data: unknown) => {
      this.emitAction('onScroll', data)
    })

    this.chart.subscribeAction('onCandleBarClick' as ActionType, (data: unknown) => {
      const partial = data as { dataIndex?: unknown; x?: unknown; data?: unknown } | null
      const event: BarClickEvent = {
        dataIndex: typeof partial?.dataIndex === 'number' ? partial.dataIndex : -1,
        x: typeof partial?.x === 'number' ? partial.x : 0,
        data: (partial?.data as KLineData) || null,
      }
      this.emitAction('onBarClick', event)
    })
  }

  private emitAction(type: ChartActionType, data: unknown): void {
    const callbacks = this.actionCallbacks.get(type)
    if (callbacks) {
      callbacks.forEach((callback) => callback(data))
    }
  }

  private getPeriodDuration(period?: Period): number {
    const p = period || this.currentPeriod
    const multipliers: Record<string, number> = {
      second: 1000,
      minute: 60 * 1000,
      hour: 60 * 60 * 1000,
      day: 24 * 60 * 60 * 1000,
      week: 7 * 24 * 60 * 60 * 1000,
      month: 30 * 24 * 60 * 60 * 1000,
      year: 365 * 24 * 60 * 60 * 1000,
    }
    return (multipliers[p.type] || 60 * 1000) * p.span
  }

  setTheme(theme: ThemeType): void {
    if (!this.chart) return
    this.currentTheme = theme
    this.chart.setStyles(theme)
  }

  getTheme(): ThemeType {
    return this.currentTheme
  }

  setStyles(styles: DeepPartial<Styles>): void {
    this.chart?.setStyles(styles)
  }

  getStyles(): Styles | null {
    return this.chart?.getStyles() || null
  }

  setLocale(locale: LocaleType): void {
    if (!this.chart) return
    this.currentLocale = locale
    this.chart.setLocale(locale)
  }

  getLocale(): LocaleType {
    return this.currentLocale
  }

  setTimezone(timezone: string): void {
    if (!this.chart) return
    this.currentTimezone = timezone
    this.chart.setTimezone(timezone)
  }

  getTimezone(): string {
    return this.currentTimezone
  }

  setSymbol(symbol: SymbolInfo): void {
    const oldSymbol = this.currentSymbol
    this.currentSymbol = symbol
    // v10: setSymbol triggers setDataLoader.getBars automatically
    this.chart?.setSymbol(symbol)
    this.emitAction('onSymbolChange', { oldSymbol, newSymbol: symbol })
  }

  getSymbol(): SymbolInfo {
    return this.currentSymbol
  }

  setPeriod(period: Period): void {
    const oldPeriod = this.currentPeriod
    this.currentPeriod = period
    // v10: setPeriod triggers setDataLoader.getBars automatically
    this.chart?.setPeriod(period)
    this.emitAction('onPeriodChange', { oldPeriod, newPeriod: period })
  }

  getPeriod(): Period {
    return this.currentPeriod
  }

  getPeriods(): Period[] {
    return this.periods
  }

  setWatermark(watermark: string | Node): void {
    if (!this.chart) return

    if (typeof watermark === 'string') {
      this.chart.createOverlay({
        name: 'simpleAnnotation',
        extendData: watermark,
        styles: {
          text: {
            color: 'rgba(128, 128, 128, 0.1)',
            size: 48,
            weight: 'bold',
          },
        },
      } as OverlayCreate)
    }
  }

  createIndicator(
    indicator: string | IndicatorCreate,
    isStack?: boolean,
    paneOptions?: { id?: string; height?: number; minHeight?: number; dragEnabled?: boolean }
  ): string | null {
    if (!this.chart) return null

    const result = this.chart.createIndicator(indicator, isStack ?? false, paneOptions)

    if (result && typeof indicator === 'string') {
      const paneId = Array.isArray(result) ? result[0] : result
      if (paneId) {
        this.subPaneIds.set(indicator, paneId)
      }
    }

    return Array.isArray(result) ? result[0] || null : result
  }

  removeIndicator(paneId: string, name?: string): void {
    this.chart?.removeIndicator({ paneId, name })

    if (name) {
      this.subPaneIds.delete(name)
    }
  }

  createOverlay(overlay: string | OverlayCreate, paneId?: string): string | null {
    if (paneId && typeof overlay === 'object') {
      overlay.paneId = paneId
    }
    const result = this.chart?.createOverlay(overlay)
    if (result) {
      return Array.isArray(result) ? result[0] || null : result
    }
    return null
  }

  removeOverlay(overlayId?: string | { id?: string; groupId?: string; name?: string }): void {
    if (typeof overlayId === 'string') {
      this.chart?.removeOverlay({ id: overlayId })
    } else {
      this.chart?.removeOverlay(overlayId)
    }
  }

  setMarkers(markers: TradeMarker[]): void {
    if (!this.chart) return

    this.clearMarkers()

    markers.forEach((marker) => {
      const defaultColor = marker.color || '#1677FF'
      const position = marker.position || 'above'

      this.chart?.createOverlay({
        name: 'simpleAnnotation',
        groupId: this.markerGroupId,
        points: [{ timestamp: marker.timestamp }],
        extendData: marker.text,
        styles: {
          point: {
            color: defaultColor,
            borderColor: defaultColor,
            borderSize: 1,
            radius: 3,
            activeColor: defaultColor,
            activeBorderColor: defaultColor,
            activeBorderSize: 1,
            activeRadius: 4,
          },
          line: {
            color: defaultColor,
          },
          text: {
            color: defaultColor,
            size: 12,
            weight: 'normal',
            paddingLeft: 4,
            paddingRight: 4,
            paddingTop: 2,
            paddingBottom: 2,
            borderRadius: 2,
            backgroundColor: 'transparent',
          },
          ...(position === 'below' ? { position: 'bottom' } : {}),
        },
      } as OverlayCreate)
    })
  }

  clearMarkers(): void {
    this.chart?.removeOverlay({ groupId: this.markerGroupId })
  }

  subscribeAction(type: ChartActionType, callback: ChartActionCallback): void {
    if (!this.actionCallbacks.has(type)) {
      this.actionCallbacks.set(type, new Set())
    }
    this.actionCallbacks.get(type)?.add(callback)
  }

  unsubscribeAction(type: ChartActionType, callback?: ChartActionCallback): void {
    if (callback) {
      this.actionCallbacks.get(type)?.delete(callback)
    } else {
      this.actionCallbacks.delete(type)
    }
  }

  getChart(): Chart | null {
    return this.chart
  }

  resize(): void {
    this.chart?.resize()
  }

  async searchSymbols(search: string): Promise<SymbolInfo[]> {
    return this.datafeed.searchSymbols(search)
  }

  getDataList(): KLineData[] {
    return (this.chart?.getDataList() as KLineData[]) || []
  }

  scrollToRealTime(): void {
    this.chart?.scrollToRealTime()
  }

  scrollToDataIndex(dataIndex: number): void {
    this.chart?.scrollToDataIndex(dataIndex)
  }

  scrollToTimestamp(timestamp: number): void {
    this.chart?.scrollToTimestamp(timestamp)
  }

  zoomAtCoordinate(scale: number, coordinate?: { x: number; y: number }): void {
    this.chart?.zoomAtCoordinate(scale, coordinate)
  }

  zoomAtDataIndex(scale: number, dataIndex: number): void {
    this.chart?.zoomAtDataIndex(scale, dataIndex)
  }

  zoomAtTimestamp(scale: number, timestamp: number): void {
    this.chart?.zoomAtTimestamp(scale, timestamp)
  }

  convertToPixel(
    points: Array<{ timestamp?: number; dataIndex?: number; value?: number }>,
    finder: { paneId?: string; absolute?: boolean }
  ): Array<{ x: number; y: number }> {
    const result = this.chart?.convertToPixel(points, finder)
    if (!result) return []
    if (Array.isArray(result)) {
      return result.map((r) => ({ x: r.x ?? 0, y: r.y ?? 0 }))
    }
    return [{ x: (result as { x?: number }).x ?? 0, y: (result as { y?: number }).y ?? 0 }]
  }

  convertFromPixel(
    coordinates: Array<{ x: number; y: number }>,
    finder: { paneId?: string; absolute?: boolean }
  ): Array<{ timestamp: number; dataIndex: number; value: number }> {
    const result = this.chart?.convertFromPixel(coordinates, finder)
    if (!result) return []
    if (Array.isArray(result)) {
      return result.map((r) => ({
        timestamp: r.timestamp ?? 0,
        dataIndex: r.dataIndex ?? 0,
        value: r.value ?? 0,
      }))
    }
    const partial = result as { timestamp?: number; dataIndex?: number; value?: number }
    return [{ timestamp: partial.timestamp ?? 0, dataIndex: partial.dataIndex ?? 0, value: partial.value ?? 0 }]
  }

  getSize(paneId?: string): { width: number; height: number } | null {
    return this.chart?.getSize(paneId) || null
  }

  destroy(): void {
    this.datafeed.unsubscribe(this.currentSymbol, this.currentPeriod)
    this.actionCallbacks.clear()

    if (this.chart) {
      dispose(this.container)
      this.chart = null
    }
  }
}
