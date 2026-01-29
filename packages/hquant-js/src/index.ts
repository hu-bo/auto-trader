/**
 * HQuant - High-performance quantitative trading engine powered by Rust
 *
 * @example
 * ```ts
 * const engine = new Engine(1000)
 * engine.addIndicator('ma20', { type: 'ema', period: 20 })
 * engine.addIndicator('rsi', { type: 'rsi', period: 14 })
 * const signals = engine.pushKline({ timestamp: 1, open: 100, high: 105, low: 95, close: 102, volume: 1000 })
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

export type PositionSide = 'LONG' | 'SHORT'

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

export type FuturesPosition = {
  positionSide: PositionSide
  entryPrice: number
  markPrice: number
  positionAmt: number
  margin: number
  unrealizedPnl: number
}

// ============================================================================
// Indicator Config
// ============================================================================

export type IndicatorConfig = {
  type: string
  period?: number
  fast?: number
  slow?: number
  signal?: number
  stdDev?: number
  multiplier?: number
}

// ============================================================================
// Native type shape
// ============================================================================

type Native = {
  Engine: new (capacity: number) => {
    addIndicator(name: string, config: IndicatorConfig): void
    setupAggregator(baseTf: string, targetTfs: string[], capacity: number): void
    pushKline(bar: Bar): Signal[]
    updateLast(bar: Bar): void
    feedKline(bar: Bar): AggregatorEvent[]
    getLastBar(): Bar | null
    getKlineCount(): number
    getIndicatorValue(name: string): number | null
    getIndicatorResult(name: string): IndicatorResult | null
    isIndicatorReady(name: string): boolean
    pollSignals(): Signal[]
    reset(): void
  }

  HQuant: new (capacity: number, periods?: string[]) => {
    addIndicator(name: string, config: IndicatorConfig): void
    addStrategy(name: string, dsl: string): number
    feedKline(bar: Bar): AggregatorEvent[]
    pushBar(bar: Bar): void
    pushKline(bar: Bar): Signal[]
    updateLast(bar: Bar): void
    pollSignals(): DslSignal[]
    getIndicatorValue(name: string): number | null
    getIndicatorResult(name: string): IndicatorResult | null
    isIndicatorReady(name: string): boolean
    reset(): void
  }

  Backtest: new (config: BacktestConfig) => {
    openPosition(price: number, size: number, positionSide: PositionSide): void
    closePosition(price: number, positionSide: PositionSide): void
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
    applySignal(action: 'BUY' | 'SELL' | 'HOLD', price: number, margin: number, positionSide?: PositionSide, isMaker?: boolean): void
    openPosition(positionSide: PositionSide, price: number, margin: number, isMaker?: boolean): void
    closePosition(positionSide: PositionSide, price: number, margin: number, isMaker?: boolean): void
    onPrice(price: number): void
    result(price: number): FuturesBacktestResult
    getPositions(): FuturesPosition[]
  }

  validateDsl(source: string): boolean
}

// ============================================================================
// Load native & re-export
// ============================================================================

const native = require('../native/hquant.node') as Native

// Re-export native classes
export class Engine extends native.Engine {}
export class HQuant extends native.HQuant {}
export class Backtest extends native.Backtest {}
export class KlineAggregator extends native.KlineAggregator {}
export class DslStrategy extends native.DslStrategy {}
export class FuturesBacktest extends native.FuturesBacktest {}
export const validateDsl = native.validateDsl
