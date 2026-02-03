import type { Styles, KLineData as BaseKLineData, Chart, Indicator, Overlay, OverlayCreate, IndicatorCreate, DeepPartial as KCDeepPartial } from 'klinecharts'

export type { Chart, Indicator, Overlay, Styles, IndicatorCreate, OverlayCreate }

export type DeepPartial<T> = KCDeepPartial<T>

export interface KLineData extends BaseKLineData {
  timestamp: number
  open: number
  high: number
  low: number
  close: number
  volume?: number
  turnover?: number
}

export interface TradeMarker {
  timestamp: number
  text: string
  color?: string
  position?: 'above' | 'below'
}

export interface BarClickEvent {
  dataIndex: number
  x: number
  data: KLineData | null
}

export interface SymbolInfo {
  ticker: string
  name?: string
  shortName?: string
  exchange?: string
  market?: string
  priceCurrency?: string
  type?: string
  logo?: string
  [key: string]: unknown
}

export type PeriodTimespan = 'minute' | 'hour' | 'day' | 'week' | 'month' | 'year'

export interface Period {
  multiplier: number
  timespan: PeriodTimespan
  text: string
}

export type DatafeedSubscribeCallback = (data: KLineData) => void

export interface Datafeed {
  searchSymbols(search?: string): Promise<SymbolInfo[]>
  getHistoryKLineData(
    symbol: SymbolInfo,
    period: Period,
    from: number,
    to: number
  ): Promise<KLineData[]>
  subscribe(
    symbol: SymbolInfo,
    period: Period,
    callback: DatafeedSubscribeCallback
  ): void
  unsubscribe(symbol: SymbolInfo, period: Period): void
}

export type ThemeType = 'light' | 'dark' | string

export type LocaleType = 'zh-CN' | 'zh-TW' | 'en-US' | string

export interface DrawingTool {
  name: string
  icon: string
  overlayName: string
}

export interface DrawingToolGroup {
  name: string
  icon: string
  tools: DrawingTool[]
}

export interface IndicatorInfo {
  name: string
  shortName?: string
  paneId?: string
  calcParams?: number[]
}

export interface KLineChartProOptions {
  container: string | HTMLElement
  styles?: DeepPartial<Styles>
  watermark?: string | Node
  theme?: ThemeType
  locale?: LocaleType
  drawingBarVisible?: boolean
  symbol: SymbolInfo
  period: Period
  periods?: Period[]
  timezone?: string
  mainIndicators?: string[]
  subIndicators?: string[]
  datafeed: Datafeed
}

export interface ChartReadyCallback {
  (chart: Chart): void
}

export type ChartActionType =
  | 'onCrosshairChange'
  | 'onBarClick'
  | 'onPeriodChange'
  | 'onSymbolChange'
  | 'onZoom'
  | 'onScroll'

export interface ChartActionCallback {
  (data: unknown): void
}

export interface KLineChartInstance {
  setTheme: (theme: ThemeType) => void
  getTheme: () => ThemeType
  setStyles: (styles: DeepPartial<Styles>) => void
  getStyles: () => Styles | null
  setLocale: (locale: LocaleType) => void
  getLocale: () => LocaleType
  setTimezone: (timezone: string) => void
  getTimezone: () => string
  setSymbol: (symbol: SymbolInfo) => void
  getSymbol: () => SymbolInfo
  setPeriod: (period: Period) => void
  getPeriod: () => Period
  getPeriods: () => Period[]
  createIndicator: (
    indicator: string | IndicatorCreate,
    isStack?: boolean,
    paneOptions?: { id?: string; height?: number; minHeight?: number; dragEnabled?: boolean }
  ) => string | null
  removeIndicator: (paneId: string, name?: string) => void
  createOverlay: (overlay: string | OverlayCreate, paneId?: string) => string | null
  removeOverlay: (overlayId?: string | { id?: string; groupId?: string; name?: string }) => void
  setMarkers: (markers: TradeMarker[]) => void
  clearMarkers: () => void
  subscribeAction: (type: ChartActionType, callback: ChartActionCallback) => void
  unsubscribeAction: (type: ChartActionType, callback?: ChartActionCallback) => void
  searchSymbols: (search: string) => Promise<SymbolInfo[]>
  applyNewData: (data: KLineData[], more?: boolean) => void
  updateData: (data: KLineData) => void
  getDataList: () => KLineData[]
  scrollToRealTime: () => void
  scrollToDataIndex: (dataIndex: number) => void
  scrollToTimestamp: (timestamp: number) => void
  zoomAtCoordinate: (scale: number, coordinate?: { x: number; y: number }) => void
  zoomAtDataIndex: (scale: number, dataIndex: number) => void
  zoomAtTimestamp: (scale: number, timestamp: number) => void
  resize: () => void
  getChart: () => Chart | null
}
