import type { KLineChartPro } from './KLineChartPro'
import type {
  KLineChartInstance,
  SymbolInfo,
  Period,
  ThemeType,
  LocaleType,
  KLineData,
  TradeMarker,
} from '../types'
import type { DeepPartial, Styles } from 'klinecharts'

export function createChartInstance(
  getChart: () => KLineChartPro | null,
  defaultSymbol: SymbolInfo,
  defaultPeriod: Period
): KLineChartInstance {
  return {
    setTheme: (theme: ThemeType) => getChart()?.setTheme(theme),
    getTheme: () => getChart()?.getTheme() || 'light',
    setStyles: (styles: DeepPartial<Styles>) => getChart()?.setStyles(styles),
    getStyles: () => getChart()?.getStyles() || null,
    setLocale: (locale: LocaleType) => getChart()?.setLocale(locale),
    getLocale: () => getChart()?.getLocale() || 'en-US',
    setTimezone: (timezone: string) => getChart()?.setTimezone(timezone),
    getTimezone: () => getChart()?.getTimezone() || '',
    setSymbol: (symbol: SymbolInfo) => getChart()?.setSymbol(symbol),
    getSymbol: () => getChart()?.getSymbol() || defaultSymbol,
    setPeriod: (period: Period) => getChart()?.setPeriod(period),
    getPeriod: () => getChart()?.getPeriod() || defaultPeriod,
    getPeriods: () => getChart()?.getPeriods() || [],
    createIndicator: (indicator, isStack, paneOptions) =>
      getChart()?.createIndicator(indicator, isStack, paneOptions) || null,
    removeIndicator: (paneId, name) => getChart()?.removeIndicator(paneId, name),
    createOverlay: (overlay, paneId) => getChart()?.createOverlay(overlay, paneId) || null,
    removeOverlay: (overlayId) => getChart()?.removeOverlay(overlayId),
    setMarkers: (markers: TradeMarker[]) => getChart()?.setMarkers(markers),
    clearMarkers: () => getChart()?.clearMarkers(),
    subscribeAction: (type, callback) => getChart()?.subscribeAction(type, callback),
    unsubscribeAction: (type, callback) => getChart()?.unsubscribeAction(type, callback),
    searchSymbols: (search) => getChart()?.searchSymbols(search) || Promise.resolve([]),
    getDataList: () => getChart()?.getDataList() || [],
    scrollToRealTime: () => getChart()?.scrollToRealTime(),
    scrollToDataIndex: (dataIndex) => getChart()?.scrollToDataIndex(dataIndex),
    scrollToTimestamp: (timestamp) => getChart()?.scrollToTimestamp(timestamp),
    zoomAtCoordinate: (scale, coordinate) => getChart()?.zoomAtCoordinate(scale, coordinate),
    zoomAtDataIndex: (scale, dataIndex) => getChart()?.zoomAtDataIndex(scale, dataIndex),
    zoomAtTimestamp: (scale, timestamp) => getChart()?.zoomAtTimestamp(scale, timestamp),
    resize: () => getChart()?.resize(),
    getChart: () => getChart()?.getChart() || null,
  }
}
