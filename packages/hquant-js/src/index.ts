/**
 * HQuant - High-performance quantitative trading engine powered by Rust
 *
 * @example
 * ```ts
 * const engine = new Engine(1000)
 * const ind = new Indicators()
 *
 * engine.addMaIndicator('ma20', ind.ma().period(20).ema())
 * engine.addRsiIndicator('rsi', ind.rsi().period(14))
 * engine.addRsiStrategy('rsi', 30, 70)
 * engine.setupBacktest({ initialCapital: 10000 })
 *
 * const signals = engine.pushKline({ timestamp: 1, open: 100, high: 105, low: 95, close: 102, volume: 1000 })
 * const result = engine.backtestResult()
 * ```
 */

// ============================================================================
// Types
// ============================================================================

export type Bar = {
  timestamp: number
  open: number
  high: number
  low: number
  close: number
  volume: number
  buyVolume?: number
}

export type Signal = {
  side: 'BUY' | 'SELL' | 'HOLD'
  strength: number
  reason: string
  timestamp: number
}

/** Signal from DSL strategy (compatible with jx-quant) */
export type DslSignal = {
  strategyId: number
  action: 'BUY' | 'SELL' | 'HOLD'
  timestamp: number
}

export type IndicatorResult = {
  value: number
  timestamp: number
  extra?: number[]
}

export type BacktestStats = {
  totalTrades: number
  winningTrades: number
  losingTrades: number
  totalPnl: number
  maxDrawdown: number
  maxDrawdownPct: number
  sharpeRatio: number
  winRate: number
  finalEquity: number
  returnPct: number
  liquidations: number
}

export type Trade = {
  timestamp: number
  side: string
  price: number
  size: number
  fee: number
  pnl: number
}

export type AggregatorEvent = {
  kind: string
  period: string
  candle?: Bar
}

export type BacktestConfig = {
  marketType?: 'spot' | 'futures'
  initialCapital: number
  leverage?: number
  makerFee?: number
  takerFee?: number
  slippage?: number
  positionSizePct?: number
}

export type LabeledVector = {
  label: number
  vector: number[]
}

/** Futures backtest configuration (compatible with jx-quant) */
export type FuturesBacktestConfig = {
  initialMargin: number
  leverage: number
  contractSize: number
  makerFeeRate: number
  takerFeeRate: number
  maintenanceMarginRate: number
}

/** Futures backtest result (compatible with jx-quant) */
export type FuturesBacktestResult = {
  equity: number
  profit: number
  profitRate: number
  maxDrawdownRate: number
  liquidated: boolean
}

// ============================================================================
// Builder interfaces (methods return `this` for chaining)
// ============================================================================

export interface IMAIndicator {
  period(p: number): this
  sma(): this
  ema(): this
  wma(): this
}
export interface IRSIIndicator {
  period(p: number): this
}
export interface IMACDIndicator {
  fast(p: number): this
  slow(p: number): this
  signal(p: number): this
}
export interface IATRIndicator {
  period(p: number): this
}
export interface IBOLLIndicator {
  period(p: number): this
  stdDev(factor: number): this
  multiplier(factor: number): this
}
export interface IVRIIndicator {
  period(p: number): this
}

// ============================================================================
// Native type shape
// ============================================================================

type Native = {
  MaIndicator: new () => IMAIndicator
  RsiIndicator: new () => IRSIIndicator
  MacdIndicator: new () => IMACDIndicator
  AtrIndicator: new () => IATRIndicator
  BollIndicator: new () => IBOLLIndicator
  VriIndicator: new () => IVRIIndicator
  Indicators: new () => {
    ma(): IMAIndicator
    rsi(): IRSIIndicator
    macd(): IMACDIndicator
    atr(): IATRIndicator
    boll(): IBOLLIndicator
    vri(): IVRIIndicator
  }

  Engine: new (capacity: number) => {
    addMaIndicator(name: string, indicator: IMAIndicator): void
    addRsiIndicator(name: string, indicator: IRSIIndicator): void
    addMacdIndicator(name: string, indicator: IMACDIndicator): void
    addAtrIndicator(name: string, indicator: IATRIndicator): void
    addBollIndicator(name: string, indicator: IBOLLIndicator): void
    addVriIndicator(name: string, indicator: IVRIIndicator): void
    addVwap(name: string): void
    addObv(name: string): void
    setupAggregator(baseTf: string, targetTfs: string[], capacity: number): void
    pushKline(bar: Bar): Signal[]
    updateLast(bar: Bar): void
    feedKline(bar: Bar): AggregatorEvent[]
    getLastBar(): Bar | null
    getKlineCount(): number
    getIndicatorValue(name: string): number | null
    getIndicatorResult(name: string): IndicatorResult | null
    isIndicatorReady(name: string): boolean
    addRsiStrategy(indicatorName: string, oversold?: number, overbought?: number): void
    addMacdStrategy(indicatorName: string): void
    addBollStrategy(indicatorName: string): void
    addMaCrossStrategy(fastMa: string, slowMa: string): void
    setupBacktest(config: BacktestConfig): void
    backtestResult(): BacktestStats | null
    backtestTrades(): Trade[]
    backtestEquityCurve(): number[]
    pollSignals(): Signal[]
    reset(): void
  }

  HQuant: new (capacity: number, periods?: string[]) => {
    addMaIndicator(name: string, indicator: IMAIndicator): void
    addRsiIndicator(name: string, indicator: IRSIIndicator): void
    addMacdIndicator(name: string, indicator: IMACDIndicator): void
    addAtrIndicator(name: string, indicator: IATRIndicator): void
    addBollIndicator(name: string, indicator: IBOLLIndicator): void
    addVriIndicator(name: string, indicator: IVRIIndicator): void
    addRsi(period: number): number
    addStrategy(name: string, dsl: string): number
    feedKline(bar: Bar): AggregatorEvent[]
    pushBar(bar: Bar): void
    pushKline(bar: Bar): Signal[]
    updateLast(bar: Bar): void
    pollSignals(): DslSignal[]
    getIndicatorValue(name: string): number | null
    getIndicatorResult(name: string): IndicatorResult | null
    isIndicatorReady(name: string): boolean
    addRsiStrategy(indicatorName: string, oversold?: number, overbought?: number): void
    addMacdStrategy(indicatorName: string): void
    addBollStrategy(indicatorName: string): void
    addMaCrossStrategy(fastMa: string, slowMa: string): void
    setupBacktest(config: BacktestConfig): void
    backtestResult(): BacktestStats | null
    backtestTrades(): Trade[]
    backtestEquityCurve(): number[]
    reset(): void
  }

  Backtest: new (config: BacktestConfig) => {
    openLong(price: number, size: number): void
    openShort(price: number, size: number): void
    close(price: number): void
    result(): BacktestStats
    getTrades(): Trade[]
    getEquityCurve(): number[]
    getEquity(): number
    reset(): void
  }

  KlineAggregator: new (baseTf: string, targetTfs: string[], capacity: number) => {
    pushKline(bar: Bar): AggregatorEvent[]
    updateLast(bar: Bar): void
    flush(): void
    reset(): void
  }

  DslStrategy: new (source: string) => {
    loadStore(name: string, vectors: LabeledVector[]): void
    setThreshold(threshold: number): void
    evaluate(bar: Bar, indicators: Record<string, number>): Signal[]
    reset(): void
  }

  FuturesBacktest: new (config: FuturesBacktestConfig) => {
    applySignal(action: 'BUY' | 'SELL' | 'HOLD', price: number, margin: number): void
    onPrice(price: number): void
    result(price: number): FuturesBacktestResult
  }

  validateDsl(source: string): boolean
}

// ============================================================================
// Load native & re-export
// ============================================================================

const native = require('../native/hquant.node') as Native

// Re-export native classes
export class MAIndicator extends native.MaIndicator {}
export class RSIIndicator extends native.RsiIndicator {}
export class MACDIndicator extends native.MacdIndicator {}
export class ATRIndicator extends native.AtrIndicator {}
export class BOLLIndicator extends native.BollIndicator {}
export class VRIIndicator extends native.VriIndicator {}
export class Indicators extends native.Indicators {}
export class Engine extends native.Engine {}
export class HQuant extends native.HQuant {}
export class Backtest extends native.Backtest {}
export class KlineAggregator extends native.KlineAggregator {}
export class DslStrategy extends native.DslStrategy {}
export class FuturesBacktest extends native.FuturesBacktest {}
export const validateDsl = native.validateDsl
