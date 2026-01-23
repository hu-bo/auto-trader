/** K线数据输入 */
export interface BarInput {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

/** 交易信号输出 */
export interface SignalOutput {
  side: 'BUY' | 'SELL' | 'HOLD';
  strength: number;
  reason: string;
  timestamp: number;
}

/** 均线类型 */
export type MAType = 'SMA' | 'EMA' | 'WMA';

/** 量化引擎接口 */
export interface IEngine {
  /** 添加 MA 指标 */
  addMa(name: string, period: number, maType: MAType): void;

  /** 追加一根 K 线并返回可能的信号 */
  appendBar(bar: BarInput): SignalOutput[];

  /** 更新最后一根 K 线 */
  updateLastBar(bar: BarInput): void;

  /** 批量加载历史数据 */
  loadHistory(bars: BarInput[]): void;

  /** 获取指标数值 */
  indicatorValue(name: string): number | null;

  /** 检查指标是否就绪 */
  indicatorReady(name: string): boolean;

  /** 重置引擎 */
  reset(): void;
}
