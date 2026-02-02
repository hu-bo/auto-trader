import * as React from 'react';
import { KLineData as KLineData$1, Chart, DeepPartial as DeepPartial$1, Styles, IndicatorCreate, OverlayCreate } from 'klinecharts';
export { Chart, Indicator, IndicatorCreate, Overlay, OverlayCreate, Styles } from 'klinecharts';

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
interface SymbolInfo {
    ticker: string;
    name?: string;
    shortName?: string;
    exchange?: string;
    market?: string;
    priceCurrency?: string;
    type?: string;
    logo?: string;
    [key: string]: unknown;
}
type PeriodTimespan = 'minute' | 'hour' | 'day' | 'week' | 'month' | 'year';
interface Period {
    multiplier: number;
    timespan: PeriodTimespan;
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
interface ChartReadyCallback {
    (chart: Chart): void;
}
type ChartActionType = 'onCrosshairChange' | 'onPeriodChange' | 'onSymbolChange' | 'onZoom' | 'onScroll';
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
    subscribeAction: (type: ChartActionType, callback: ChartActionCallback) => void;
    unsubscribeAction: (type: ChartActionType, callback?: ChartActionCallback) => void;
    searchSymbols: (search: string) => Promise<SymbolInfo[]>;
    applyNewData: (data: KLineData[], more?: boolean) => void;
    updateData: (data: KLineData) => void;
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
    private isLoading;
    private actionCallbacks;
    constructor(options: KLineChartProOptions);
    private registerBuiltinLocales;
    private registerBuiltinThemes;
    private initChart;
    private setupChartEvents;
    private emitAction;
    private loadData;
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
    subscribeAction(type: ChartActionType, callback: ChartActionCallback): void;
    unsubscribeAction(type: ChartActionType, callback?: ChartActionCallback): void;
    getChart(): Chart | null;
    resize(): void;
    searchSymbols(search: string): Promise<SymbolInfo[]>;
    applyNewData(data: KLineData[], more?: boolean): void;
    updateData(data: KLineData): void;
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
    onZoom?: (data: unknown) => void;
    onScroll?: (data: unknown) => void;
}
declare const KLineChart: React.ForwardRefExoticComponent<KLineChartProps & React.RefAttributes<KLineChartInstance>>;

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

declare const zhCN: {
    time: string;
    open: string;
    high: string;
    low: string;
    close: string;
    volume: string;
    turnover: string;
    change: string;
};
declare const zhTW: {
    time: string;
    open: string;
    high: string;
    low: string;
    close: string;
    volume: string;
    turnover: string;
    change: string;
};
declare const enUS: {
    time: string;
    open: string;
    high: string;
    low: string;
    close: string;
    volume: string;
    turnover: string;
    change: string;
};

declare const DEFAULT_PERIODS: Period[];
declare function getDefaultMainIndicators(): string[];
declare function getDefaultSubIndicators(): string[];
declare const BUILT_IN_INDICATORS: {
    main: string[];
    sub: string[];
};
declare const DRAWING_TOOL_GROUPS: DrawingToolGroup[];

export { BUILT_IN_INDICATORS, BaseDatafeed, type ChartActionCallback, type ChartActionType, type ChartReadyCallback, DEFAULT_PERIODS, DRAWING_TOOL_GROUPS, type Datafeed, type DatafeedSubscribeCallback, type DeepPartial, DefaultDatafeed, type DrawingTool, type DrawingToolGroup, type IndicatorInfo, KLineChart, type KLineChartInstance, KLineChartPro, type KLineChartProOptions, type KLineChartProps, type KLineChartInstance as KLineChartRef, type KLineData, type LocaleType, type Period, type PeriodTimespan, type SymbolInfo, type ThemeType, createChartInstance, darkTheme, enUS, getDefaultMainIndicators, getDefaultSubIndicators, lightTheme, zhCN, zhTW };
