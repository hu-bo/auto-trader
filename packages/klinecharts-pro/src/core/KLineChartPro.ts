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
  private isLoading = false
  private actionCallbacks: Map<ChartActionType, Set<ChartActionCallback>> = new Map()

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
    this.loadData()
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
  }

  private emitAction(type: ChartActionType, data: unknown): void {
    const callbacks = this.actionCallbacks.get(type)
    if (callbacks) {
      callbacks.forEach((callback) => callback(data))
    }
  }

  private async loadData(): Promise<void> {
    if (this.isLoading) return
    this.isLoading = true

    try {
      this.datafeed.unsubscribe(this.currentSymbol, this.currentPeriod)

      const now = Date.now()
      const from = now - this.getPeriodDuration() * 500
      const data = await this.datafeed.getHistoryKLineData(
        this.currentSymbol,
        this.currentPeriod,
        from,
        now
      )

      if (this.chart && data.length > 0) {
        this.chart.applyNewData(data)
      }

      this.datafeed.subscribe(
        this.currentSymbol,
        this.currentPeriod,
        (newData: KLineData) => {
          this.chart?.updateData(newData)
        }
      )
    } catch (error) {
      console.error('Failed to load data:', error)
    } finally {
      this.isLoading = false
    }
  }

  private getPeriodDuration(): number {
    const multipliers: Record<string, number> = {
      minute: 60 * 1000,
      hour: 60 * 60 * 1000,
      day: 24 * 60 * 60 * 1000,
      week: 7 * 24 * 60 * 60 * 1000,
      month: 30 * 24 * 60 * 60 * 1000,
      year: 365 * 24 * 60 * 60 * 1000,
    }
    return (multipliers[this.currentPeriod.timespan] || 60 * 1000) * this.currentPeriod.multiplier
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
    this.loadData()
    this.emitAction('onSymbolChange', { oldSymbol, newSymbol: symbol })
  }

  getSymbol(): SymbolInfo {
    return this.currentSymbol
  }

  setPeriod(period: Period): void {
    const oldPeriod = this.currentPeriod
    this.currentPeriod = period
    this.loadData()
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
    this.chart?.removeIndicator(paneId, name)

    if (name) {
      this.subPaneIds.delete(name)
    }
  }

  createOverlay(overlay: string | OverlayCreate, paneId?: string): string | null {
    const result = this.chart?.createOverlay(overlay, paneId)
    if (result) {
      return Array.isArray(result) ? result[0] || null : result
    }
    return null
  }

  removeOverlay(overlayId?: string | { id?: string; groupId?: string; name?: string }): void {
    this.chart?.removeOverlay(overlayId)
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

  applyNewData(data: KLineData[], more?: boolean): void {
    this.chart?.applyNewData(data, more)
  }

  updateData(data: KLineData): void {
    this.chart?.updateData(data)
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
