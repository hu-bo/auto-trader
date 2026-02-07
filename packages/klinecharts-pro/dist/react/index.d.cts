import React from 'react';
import { KLineData as KLineData$1, Period as Period$1, Chart, DeepPartial as DeepPartial$1, Styles, IndicatorCreate, OverlayCreate, Locales } from 'klinecharts';
export { Chart, DataLoader, DataLoaderGetBarsParams, DataLoaderSubscribeBarParams, DataLoaderUnsubscribeBarParams, Indicator, IndicatorCreate, Overlay, OverlayCreate, Styles } from 'klinecharts';

type DeepPartial<T> = DeepPartial$1<T>;
interface KLineData extends KLineData$1 {
    timestamp: number;
    open: number;
    high: number;
    low: number;
    close: number;
    volume?: number;
    turnover?: number;
}
interface TradeMarker {
    timestamp: number;
    text: string;
    color?: string;
    position?: 'above' | 'below';
}
interface BarClickEvent {
    dataIndex: number;
    x: number;
    data: KLineData | null;
}
/**
 * Extended SymbolInfo for klinecharts-pro.
 * klinecharts v10 requires `ticker`. `pricePrecision` and `volumePrecision`
 * are optional here — they default to sensible values in klinecharts.
 * We keep extra fields (name, exchange, etc.) for UI display.
 */
interface SymbolInfo {
    ticker: string;
    pricePrecision?: number;
    volumePrecision?: number;
    name?: string;
    shortName?: string;
    exchange?: string;
    market?: string;
    priceCurrency?: string;
    type?: string;
    logo?: string;
    [key: string]: unknown;
}
type PeriodType = Period$1['type'];
/**
 * Extended Period for klinecharts-pro.
 * klinecharts v10 uses `{ type, span }`. We add `text` for UI display.
 */
interface Period extends Period$1 {
    text: string;
}
type DatafeedSubscribeCallback = (data: KLineData) => void;
interface Datafeed {
    searchSymbols(search?: string): Promise<SymbolInfo[]>;
    getHistoryKLineData(symbol: SymbolInfo, period: Period, from: number, to: number): Promise<KLineData[]>;
    subscribe(symbol: SymbolInfo, period: Period, callback: DatafeedSubscribeCallback): void;
    unsubscribe(symbol: SymbolInfo, period: Period): void;
}
type ThemeType = 'light' | 'dark' | string;
type LocaleType = 'zh-CN' | 'zh-TW' | 'en-US' | string;
interface DrawingTool {
    name: string;
    icon: string;
    overlayName: string;
}
interface DrawingToolGroup {
    name: string;
    icon: string;
    tools: DrawingTool[];
}
interface IndicatorInfo {
    name: string;
    shortName?: string;
    paneId?: string;
    calcParams?: number[];
}
interface KLineChartProOptions {
    container: string | HTMLElement;
    styles?: DeepPartial<Styles>;
    watermark?: string | Node;
    theme?: ThemeType;
    locale?: LocaleType;
    drawingBarVisible?: boolean;
    symbol: SymbolInfo;
    period: Period;
    periods?: Period[];
    timezone?: string;
    mainIndicators?: string[];
    subIndicators?: string[];
    datafeed: Datafeed;
}
/** @deprecated Use PeriodType instead */
type PeriodTimespan = PeriodType;
interface ChartReadyCallback {
    (chart: Chart): void;
}
type ChartActionType = 'onCrosshairChange' | 'onBarClick' | 'onPeriodChange' | 'onSymbolChange' | 'onZoom' | 'onScroll';
interface ChartActionCallback {
    (data: unknown): void;
}
interface KLineChartInstance {
    setTheme: (theme: ThemeType) => void;
    getTheme: () => ThemeType;
    setStyles: (styles: DeepPartial<Styles>) => void;
    getStyles: () => Styles | null;
    setLocale: (locale: LocaleType) => void;
    getLocale: () => LocaleType;
    setTimezone: (timezone: string) => void;
    getTimezone: () => string;
    setSymbol: (symbol: SymbolInfo) => void;
    getSymbol: () => SymbolInfo;
    setPeriod: (period: Period) => void;
    getPeriod: () => Period;
    getPeriods: () => Period[];
    createIndicator: (indicator: string | IndicatorCreate, isStack?: boolean, paneOptions?: {
        id?: string;
        height?: number;
        minHeight?: number;
        dragEnabled?: boolean;
    }) => string | null;
    removeIndicator: (paneId: string, name?: string) => void;
    createOverlay: (overlay: string | OverlayCreate, paneId?: string) => string | null;
    removeOverlay: (overlayId?: string | {
        id?: string;
        groupId?: string;
        name?: string;
    }) => void;
    setMarkers: (markers: TradeMarker[]) => void;
    clearMarkers: () => void;
    subscribeAction: (type: ChartActionType, callback: ChartActionCallback) => void;
    unsubscribeAction: (type: ChartActionType, callback?: ChartActionCallback) => void;
    searchSymbols: (search: string) => Promise<SymbolInfo[]>;
    getDataList: () => KLineData[];
    scrollToRealTime: () => void;
    scrollToDataIndex: (dataIndex: number) => void;
    scrollToTimestamp: (timestamp: number) => void;
    zoomAtCoordinate: (scale: number, coordinate?: {
        x: number;
        y: number;
    }) => void;
    zoomAtDataIndex: (scale: number, dataIndex: number) => void;
    zoomAtTimestamp: (scale: number, timestamp: number) => void;
    resize: () => void;
    getChart: () => Chart | null;
}

declare class KLineChartPro {
    private container;
    private chart;
    private datafeed;
    private currentSymbol;
    private currentPeriod;
    private currentTheme;
    private currentLocale;
    private currentTimezone;
    private periods;
    private mainIndicators;
    private subIndicators;
    private subPaneIds;
    private actionCallbacks;
    private markerGroupId;
    constructor(options: KLineChartProOptions);
    private registerBuiltinLocales;
    private registerBuiltinThemes;
    private initChart;
    /**
     * v10: Use setDataLoader instead of setLoadDataCallback / applyNewData / updateData.
     * getBars handles initial load + backward/forward scrolling.
     * subscribeBar / unsubscribeBar handle real-time updates.
     */
    private setupDataLoader;
    /** Find our extended Period (with text) matching a klinecharts Period */
    private findPeriod;
    private setupChartEvents;
    private emitAction;
    private getPeriodDuration;
    setTheme(theme: ThemeType): void;
    getTheme(): ThemeType;
    setStyles(styles: DeepPartial$1<Styles>): void;
    getStyles(): Styles | null;
    setLocale(locale: LocaleType): void;
    getLocale(): LocaleType;
    setTimezone(timezone: string): void;
    getTimezone(): string;
    setSymbol(symbol: SymbolInfo): void;
    getSymbol(): SymbolInfo;
    setPeriod(period: Period): void;
    getPeriod(): Period;
    getPeriods(): Period[];
    setWatermark(watermark: string | Node): void;
    createIndicator(indicator: string | IndicatorCreate, isStack?: boolean, paneOptions?: {
        id?: string;
        height?: number;
        minHeight?: number;
        dragEnabled?: boolean;
    }): string | null;
    removeIndicator(paneId: string, name?: string): void;
    createOverlay(overlay: string | OverlayCreate, paneId?: string): string | null;
    removeOverlay(overlayId?: string | {
        id?: string;
        groupId?: string;
        name?: string;
    }): void;
    setMarkers(markers: TradeMarker[]): void;
    clearMarkers(): void;
    subscribeAction(type: ChartActionType, callback: ChartActionCallback): void;
    unsubscribeAction(type: ChartActionType, callback?: ChartActionCallback): void;
    getChart(): Chart | null;
    resize(): void;
    searchSymbols(search: string): Promise<SymbolInfo[]>;
    getDataList(): KLineData[];
    scrollToRealTime(): void;
    scrollToDataIndex(dataIndex: number): void;
    scrollToTimestamp(timestamp: number): void;
    zoomAtCoordinate(scale: number, coordinate?: {
        x: number;
        y: number;
    }): void;
    zoomAtDataIndex(scale: number, dataIndex: number): void;
    zoomAtTimestamp(scale: number, timestamp: number): void;
    convertToPixel(points: Array<{
        timestamp?: number;
        dataIndex?: number;
        value?: number;
    }>, finder: {
        paneId?: string;
        absolute?: boolean;
    }): Array<{
        x: number;
        y: number;
    }>;
    convertFromPixel(coordinates: Array<{
        x: number;
        y: number;
    }>, finder: {
        paneId?: string;
        absolute?: boolean;
    }): Array<{
        timestamp: number;
        dataIndex: number;
        value: number;
    }>;
    getSize(paneId?: string): {
        width: number;
        height: number;
    } | null;
    destroy(): void;
}

interface KLineChartProps extends Omit<KLineChartProOptions, 'container'> {
    className?: string;
    style?: React.CSSProperties;
    markers?: TradeMarker[];
    /** Hide the built-in toolbar (symbol search + period selector + indicator) */
    toolbarVisible?: boolean;
    ref?: React.Ref<KLineChartInstance>;
    onReady?: (chart: KLineChartPro) => void;
    onSymbolChange?: (data: {
        oldSymbol: SymbolInfo;
        newSymbol: SymbolInfo;
    }) => void;
    onPeriodChange?: (data: {
        oldPeriod: Period;
        newPeriod: Period;
    }) => void;
    onCrosshairChange?: (data: unknown) => void;
    onBarClick?: (data: BarClickEvent) => void;
    onZoom?: (data: unknown) => void;
    onScroll?: (data: unknown) => void;
}
declare function KLineChart(props: KLineChartProps): React.ReactElement;

interface IndicatorModalProps {
    visible: boolean;
    onClose: () => void;
    theme: 'light' | 'dark' | string;
    /** Current active main indicator (single select, null = none) */
    mainIndicator: string | null;
    subIndicators: Set<string>;
    onMainSelect: (name: string | null) => void;
    onSubToggle: (name: string) => void;
}
declare function IndicatorModal({ visible, onClose, theme, mainIndicator, subIndicators, onMainSelect, onSubToggle, }: IndicatorModalProps): React.ReactElement | null;

declare function createChartInstance(getChart: () => KLineChartPro | null, defaultSymbol: SymbolInfo, defaultPeriod: Period): KLineChartInstance;

declare abstract class BaseDatafeed implements Datafeed {
    abstract searchSymbols(search?: string): Promise<SymbolInfo[]>;
    abstract getHistoryKLineData(symbol: SymbolInfo, period: Period, from: number, to: number): Promise<KLineData[]>;
    abstract subscribe(symbol: SymbolInfo, period: Period, callback: DatafeedSubscribeCallback): void;
    abstract unsubscribe(symbol: SymbolInfo, period: Period): void;
}
declare class DefaultDatafeed implements Datafeed {
    private apiKey;
    private baseUrl;
    private subscriptions;
    constructor(apiKey: string);
    private getSubscriptionKey;
    private periodToPolygonTimespan;
    searchSymbols(search?: string): Promise<SymbolInfo[]>;
    getHistoryKLineData(symbol: SymbolInfo, period: Period, from: number, to: number): Promise<KLineData[]>;
    subscribe(symbol: SymbolInfo, period: Period, callback: DatafeedSubscribeCallback): void;
    unsubscribe(symbol: SymbolInfo, period: Period): void;
    private getPollInterval;
    destroy(): void;
}

declare const lightTheme: DeepPartial$1<Styles>;
declare const darkTheme: DeepPartial$1<Styles>;

declare const zhCN: Locales;
declare const zhTW: Locales;
declare const enUS: Locales;

declare const DEFAULT_PERIODS: Period[];
declare function getDefaultMainIndicators(): string[];
declare function getDefaultSubIndicators(): string[];
declare const BUILT_IN_INDICATORS: {
    main: string[];
    sub: string[];
};
declare const DRAWING_TOOL_GROUPS: DrawingToolGroup[];

export { BUILT_IN_INDICATORS, type BarClickEvent, BaseDatafeed, type ChartActionCallback, type ChartActionType, type ChartReadyCallback, DEFAULT_PERIODS, DRAWING_TOOL_GROUPS, type Datafeed, type DatafeedSubscribeCallback, type DeepPartial, DefaultDatafeed, type DrawingTool, type DrawingToolGroup, type IndicatorInfo, IndicatorModal, type IndicatorModalProps, KLineChart, type KLineChartInstance, KLineChartPro, type KLineChartProOptions, type KLineChartProps, type KLineChartInstance as KLineChartRef, type KLineData, type LocaleType, type Period, type PeriodTimespan, type PeriodType, type SymbolInfo, type ThemeType, type TradeMarker, createChartInstance, darkTheme, enUS, getDefaultMainIndicators, getDefaultSubIndicators, lightTheme, zhCN, zhTW };
