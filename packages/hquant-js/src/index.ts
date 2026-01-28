/**
 * HQuant - High-performance quantitative trading engine powered by Rust
 *
 * @example
 * ```ts
 * import { HQuant, Indicators } from '@hquant/js'
 *
 * const engine = new HQuant(1000, ['15m', '1h', '4h'])
 * const ind = new Indicators()
 *
 * engine.addRsiIndicator('rsi', ind.rsi().period(14))
 * engine.addMaIndicator('ma20', ind.ma().period(20).ema())
 *
 * const events = engine.feedKline({
 *   timestamp: Date.now(),
 *   open: 100,
 *   high: 105,
 *   low: 95,
 *   close: 102,
 *   volume: 1000,
 * })
 * ```
 */

// Import native bindings
const native = require('../native/hquant.node')

// ============================================================================
// Types
// ============================================================================

export interface Bar {
  timestamp: number
  open: number
  high: number
  low: number
  close: number
  volume: number
  buyVolume?: number
}

export interface Signal {
  side: 'BUY' | 'SELL' | 'HOLD'
  strength: number
  reason: string
  timestamp: number
}

export interface IndicatorResult {
  value: number
  timestamp: number
  extra?: number[]
}

export interface BacktestStats {
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

export interface Trade {
  timestamp: number
  side: string
  price: number
  size: number
  fee: number
  pnl: number
}

export interface AggregatorEvent {
  kind: string
  period: string
  candle?: Bar
}

export interface BacktestConfig {
  marketType?: 'spot' | 'futures'
  initialCapital: number
  leverage?: number
  makerFee?: number
  takerFee?: number
  slippage?: number
  positionSizePct?: number
}

export interface LabeledVector {
  label: number
  vector: number[]
}

// ============================================================================
// Indicator Builders
// ============================================================================

/** MA Indicator Builder */
export class MAIndicator {
  private _inner: any

  constructor() {
    this._inner = new native.MAIndicator()
  }

  /** Set period (default: 20) */
  period(p: number): this {
    this._inner.period(p)
    return this
  }

  /** Use Simple Moving Average */
  sma(): this {
    this._inner.sma()
    return this
  }

  /** Use Exponential Moving Average */
  ema(): this {
    this._inner.ema()
    return this
  }

  /** Use Weighted Moving Average */
  wma(): this {
    this._inner.wma()
    return this
  }

  /** @internal */
  get inner() {
    return this._inner
  }
}

/** RSI Indicator Builder */
export class RSIIndicator {
  private _inner: any

  constructor() {
    this._inner = new native.RSIIndicator()
  }

  /** Set period (default: 14) */
  period(p: number): this {
    this._inner.period(p)
    return this
  }

  /** @internal */
  get inner() {
    return this._inner
  }
}

/** MACD Indicator Builder */
export class MACDIndicator {
  private _inner: any

  constructor() {
    this._inner = new native.MACDIndicator()
  }

  /** Set fast period (default: 12) */
  fast(p: number): this {
    this._inner.fast(p)
    return this
  }

  /** Set slow period (default: 26) */
  slow(p: number): this {
    this._inner.slow(p)
    return this
  }

  /** Set signal period (default: 9) */
  signal(p: number): this {
    this._inner.signal(p)
    return this
  }

  /** @internal */
  get inner() {
    return this._inner
  }
}

/** ATR Indicator Builder */
export class ATRIndicator {
  private _inner: any

  constructor() {
    this._inner = new native.ATRIndicator()
  }

  /** Set period (default: 14) */
  period(p: number): this {
    this._inner.period(p)
    return this
  }

  /** @internal */
  get inner() {
    return this._inner
  }
}

/** Bollinger Bands Indicator Builder */
export class BOLLIndicator {
  private _inner: any

  constructor() {
    this._inner = new native.BOLLIndicator()
  }

  /** Set period (default: 20) */
  period(p: number): this {
    this._inner.period(p)
    return this
  }

  /** Set standard deviation multiplier (default: 2.0) */
  stdDev(factor: number): this {
    this._inner.stdDev(factor)
    return this
  }

  /** Alias for stdDev */
  multiplier(factor: number): this {
    return this.stdDev(factor)
  }

  /** @internal */
  get inner() {
    return this._inner
  }
}

/** VRI Indicator Builder */
export class VRIIndicator {
  private _inner: any

  constructor() {
    this._inner = new native.VRIIndicator()
  }

  /** Set period (default: 14) */
  period(p: number): this {
    this._inner.period(p)
    return this
  }

  /** @internal */
  get inner() {
    return this._inner
  }
}

// ============================================================================
// Indicators Factory
// ============================================================================

/** Factory for creating indicator builders */
export class Indicators {
  /** Create MA indicator builder */
  ma(): MAIndicator {
    return new MAIndicator()
  }

  /** Create RSI indicator builder */
  rsi(): RSIIndicator {
    return new RSIIndicator()
  }

  /** Create MACD indicator builder */
  macd(): MACDIndicator {
    return new MACDIndicator()
  }

  /** Create ATR indicator builder */
  atr(): ATRIndicator {
    return new ATRIndicator()
  }

  /** Create Bollinger Bands indicator builder */
  boll(): BOLLIndicator {
    return new BOLLIndicator()
  }

  /** Create VRI indicator builder */
  vri(): VRIIndicator {
    return new VRIIndicator()
  }
}

// ============================================================================
// HQuant Engine
// ============================================================================

/**
 * Multi-period quantitative engine with built-in aggregator.
 * Ideal for production use with WebSocket data streams.
 */
export class HQuant {
  private _inner: any

  /**
   * Create a new HQuant engine
   * @param capacity - Maximum K-lines to store
   * @param periods - Timeframes (first is base, rest are targets for aggregation)
   */
  constructor(capacity: number, periods?: string[]) {
    this._inner = new native.HQuant(capacity, periods)
  }

  /** Add MA indicator */
  addMaIndicator(name: string, indicator: MAIndicator): void {
    this._inner.addMaIndicator(name, indicator.inner)
  }

  /** Add RSI indicator */
  addRsiIndicator(name: string, indicator: RSIIndicator): void {
    this._inner.addRsiIndicator(name, indicator.inner)
  }

  /** Add MACD indicator */
  addMacdIndicator(name: string, indicator: MACDIndicator): void {
    this._inner.addMacdIndicator(name, indicator.inner)
  }

  /** Add ATR indicator */
  addAtrIndicator(name: string, indicator: ATRIndicator): void {
    this._inner.addAtrIndicator(name, indicator.inner)
  }

  /** Add Bollinger Bands indicator */
  addBollIndicator(name: string, indicator: BOLLIndicator): void {
    this._inner.addBollIndicator(name, indicator.inner)
  }

  /** Add VRI indicator */
  addVriIndicator(name: string, indicator: VRIIndicator): void {
    this._inner.addVriIndicator(name, indicator.inner)
  }

  /**
   * Feed raw K-line data from WebSocket stream.
   * Returns aggregator events when higher timeframe candles complete.
   */
  feedKline(bar: Bar): AggregatorEvent[] {
    return this._inner.feedKline(bar)
  }

  /** Push completed K-line (for historical data loading) */
  pushKline(bar: Bar): Signal[] {
    return this._inner.pushKline(bar)
  }

  /** Update last K-line (for realtime price updates within same candle) */
  updateLast(bar: Bar): void {
    this._inner.updateLast(bar)
  }

  /** Poll accumulated signals */
  pollSignals(): Signal[] {
    return this._inner.pollSignals()
  }

  /** Get indicator value */
  getIndicatorValue(name: string): number | null {
    return this._inner.getIndicatorValue(name)
  }

  /** Get indicator result with extra data */
  getIndicatorResult(name: string): IndicatorResult | null {
    return this._inner.getIndicatorResult(name)
  }

  /** Check if indicator is ready */
  isIndicatorReady(name: string): boolean {
    return this._inner.isIndicatorReady(name)
  }

  /** Reset engine */
  reset(): void {
    this._inner.reset()
  }
}

// ============================================================================
// Engine (Simple version without aggregator)
// ============================================================================

/** Simple quantitative engine without built-in aggregator */
export class Engine {
  private _inner: any

  constructor(capacity: number) {
    this._inner = new native.Engine(capacity)
  }

  addMaIndicator(name: string, indicator: MAIndicator): void {
    this._inner.addMaIndicator(name, indicator.inner)
  }

  addRsiIndicator(name: string, indicator: RSIIndicator): void {
    this._inner.addRsiIndicator(name, indicator.inner)
  }

  addMacdIndicator(name: string, indicator: MACDIndicator): void {
    this._inner.addMacdIndicator(name, indicator.inner)
  }

  addAtrIndicator(name: string, indicator: ATRIndicator): void {
    this._inner.addAtrIndicator(name, indicator.inner)
  }

  addBollIndicator(name: string, indicator: BOLLIndicator): void {
    this._inner.addBollIndicator(name, indicator.inner)
  }

  addVriIndicator(name: string, indicator: VRIIndicator): void {
    this._inner.addVriIndicator(name, indicator.inner)
  }

  addVwap(name: string): void {
    this._inner.addVwap(name)
  }

  addObv(name: string): void {
    this._inner.addObv(name)
  }

  setupAggregator(baseTf: string, targetTfs: string[], capacity: number): void {
    this._inner.setupAggregator(baseTf, targetTfs, capacity)
  }

  pushKline(bar: Bar): Signal[] {
    return this._inner.pushKline(bar)
  }

  updateLast(bar: Bar): void {
    this._inner.updateLast(bar)
  }

  getIndicatorValue(name: string): number | null {
    return this._inner.getIndicatorValue(name)
  }

  getIndicatorResult(name: string): IndicatorResult | null {
    return this._inner.getIndicatorResult(name)
  }

  isIndicatorReady(name: string): boolean {
    return this._inner.isIndicatorReady(name)
  }

  getLastBar(): Bar | null {
    return this._inner.getLastBar()
  }

  getKlineCount(): number {
    return this._inner.getKlineCount()
  }

  feedKline(bar: Bar): AggregatorEvent[] {
    return this._inner.feedKline(bar)
  }

  reset(): void {
    this._inner.reset()
  }
}

// ============================================================================
// Backtest
// ============================================================================

/** Backtest engine for strategy evaluation */
export class Backtest {
  private _inner: any

  constructor(config: BacktestConfig) {
    this._inner = new native.Backtest({
      marketType: config.marketType,
      initialCapital: config.initialCapital,
      leverage: config.leverage,
      makerFee: config.makerFee,
      takerFee: config.takerFee,
      slippage: config.slippage,
      positionSizePct: config.positionSizePct,
    })
  }

  /** Open long position */
  openLong(price: number, size: number): void {
    this._inner.openLong(price, size)
  }

  /** Open short position (futures only) */
  openShort(price: number, size: number): void {
    this._inner.openShort(price, size)
  }

  /** Close current position */
  close(price: number): void {
    this._inner.close(price)
  }

  /** Get backtest result */
  result(): BacktestStats {
    return this._inner.result()
  }

  /** Get trades */
  getTrades(): Trade[] {
    return this._inner.getTrades()
  }

  /** Get equity curve */
  getEquityCurve(): number[] {
    return this._inner.getEquityCurve()
  }

  /** Get current equity */
  getEquity(): number {
    return this._inner.getEquity()
  }

  /** Reset backtest */
  reset(): void {
    this._inner.reset()
  }
}

// ============================================================================
// Aggregator
// ============================================================================

/** Multi-timeframe K-line aggregator */
export class KlineAggregator {
  private _inner: any

  constructor(baseTf: string, targetTfs: string[], capacity: number) {
    this._inner = new native.KlineAggregator(baseTf, targetTfs, capacity)
  }

  /** Push K-line and get completed events */
  pushKline(bar: Bar): AggregatorEvent[] {
    return this._inner.pushKline(bar)
  }

  /** Update last K-line */
  updateLast(bar: Bar): void {
    this._inner.updateLast(bar)
  }

  /** Flush all pending candles */
  flush(): void {
    this._inner.flush()
  }

  /** Reset aggregator */
  reset(): void {
    this._inner.reset()
  }
}

// ============================================================================
// DSL Strategy
// ============================================================================

/**
 * DSL Strategy engine for custom trading strategies
 *
 * @example
 * ```ts
 * const strategy = new DslStrategy(`
 *   IF RSI(14) < 30 AND close > EMA(20) THEN BUY
 *   IF RSI(14) > 70 THEN SELL
 * `)
 * const signals = strategy.evaluate(bar, {})
 * ```
 */
export class DslStrategy {
  private _inner: any

  constructor(source: string) {
    this._inner = new native.DslStrategy(source)
  }

  /** Load labeled vectors for similarity matching */
  loadStore(name: string, vectors: LabeledVector[]): void {
    this._inner.loadStore(name, vectors)
  }

  /** Set similarity threshold (default: 0.9) */
  setThreshold(threshold: number): void {
    this._inner.setThreshold(threshold)
  }

  /** Evaluate strategy with given bar data */
  evaluate(bar: Bar, indicators: Record<string, number>): Signal[] {
    return this._inner.evaluate(bar, indicators)
  }

  /** Reset strategy state */
  reset(): void {
    this._inner.reset()
  }
}

/** Validate DSL source code without creating an engine */
export function validateDsl(source: string): boolean {
  return native.validateDsl(source)
}

// Re-export for convenience
export { native }
