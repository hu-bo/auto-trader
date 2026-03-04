import type {
  Styles,
  KLineData as BaseKLineData,
  Chart,
  Indicator,
  Overlay,
  OverlayCreate,
  IndicatorCreate,
  DeepPartial as KCDeepPartial,
  Period as KCPeriod,
  DataLoader,
  DataLoaderGetBarsParams,
  DataLoaderSubscribeBarParams,
  DataLoaderUnsubscribeBarParams,
} from 'klinecharts'

export type {
  Chart, Indicator, Overlay, Styles, IndicatorCreate, OverlayCreate,
  DataLoader, DataLoaderGetBarsParams, DataLoaderSubscribeBarParams, DataLoaderUnsubscribeBarParams,
  KCPeriod,
}

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

/**
 * Extended SymbolInfo for klinecharts-pro.
 * klinecharts v10 requires `ticker`. `pricePrecision` and `volumePrecision`
 * are optional here — they default to sensible values in klinecharts.
 * We keep extra fields (name, exchange, etc.) for UI display.
 */
export interface SymbolInfo {
  ticker: string
  pricePrecision?: number
  volumePrecision?: number
  name?: string
  shortName?: string
  exchange?: string
  market?: string
  priceCurrency?: string
  type?: string
  logo?: string
  [key: string]: unknown
}

export type PeriodTimespan = 'minute' | 'hour' | 'day' | 'week' | 'month' | 'year' | string

/**
 * Period definition aligned with official @klinecharts/pro API.
 * Uses `multiplier` / `timespan` instead of klinecharts v10 internal `span` / `type`.
 */
export interface Period {
  multiplier: number
  timespan: PeriodTimespan
  text: string
}

/** Convert our Period to klinecharts v10 internal Period (`{ type, span }`). */
export function toKCPeriod(period: Period): KCPeriod {
  return { type: period.timespan as KCPeriod['type'], span: period.multiplier }
}

/** Convert klinecharts v10 internal Period to our Period (needs `text` lookup). */
export function fromKCPeriod(kcPeriod: KCPeriod, text = ''): Period {
  return { multiplier: kcPeriod.span, timespan: kcPeriod.type, text }
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
