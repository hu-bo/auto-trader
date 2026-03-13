import axios from 'axios';

export interface SymbolPrecision {
  pricePrecision: number;
  quantityPrecision: number;
  tickSize: string;
  stepSize: string;
  contractValue?: number;
}

type StepSpec = {
  scale: number;
  stepInt: number;
  fractionDigits: number;
};

const countFractionDigits = (value: string): number => {
  const normalized = value.trim();
  const dotIndex = normalized.indexOf('.');
  if (dotIndex < 0) return 0;
  return normalized.slice(dotIndex + 1).replace(/0+$/, '').length;
};

const parseStepSpec = (step: string | undefined): StepSpec | null => {
  const normalized = step?.trim();
  if (!normalized) return null;

  const stepNumber = Number(normalized);
  if (!Number.isFinite(stepNumber) || stepNumber <= 0) return null;

  const fractionDigits = countFractionDigits(normalized);
  const scale = 10 ** fractionDigits;
  const stepInt = Math.round(stepNumber * scale);
  if (!Number.isFinite(stepInt) || stepInt <= 0) return null;

  return { scale, stepInt, fractionDigits };
};

const parsePositiveNumber = (value: unknown): number | null => {
  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return parsed;
};

export const truncateToIncrement = (value: number, step: string | undefined): number => {
  if (!Number.isFinite(value)) return value;

  const spec = parseStepSpec(step);
  if (!spec) return value;

  const scaledValue = Math.floor(value * spec.scale + 1e-9);
  const alignedValue = Math.floor(scaledValue / spec.stepInt) * spec.stepInt;
  const raw = alignedValue / spec.scale;
  return Number(raw.toFixed(spec.fractionDigits));
};

export const truncateToPrecision = (value: number, precision: number): number => {
  if (!Number.isFinite(value)) return value;
  if (!Number.isFinite(precision) || precision < 0) return value;

  const factor = 10 ** precision;
  const raw = Math.floor(value * factor) / factor;
  return Number(raw.toFixed(precision));
};

/** cache key: `${exchange}:${tradeType}:${symbol}` */
type PrecisionMap = Map<string, SymbolPrecision>;

const REFRESH_INTERVAL = 24 * 60 * 60 * 1000; // 24h

class ExchangeSync {
  private baseUrl = '';
  private apiKey = '';
  private precisionCache: PrecisionMap = new Map();
  private refreshTimer: ReturnType<typeof setInterval> | null = null;
  private initPromise: Promise<void> | null = null;

  private get headers() {
    return this.apiKey ? { 'X-API-Key': this.apiKey } : {};
  }

  // ────────── lifecycle ──────────

  /**
   * 幂等初始化，多次调用只执行一次
   */
  init(config: { http: string; apiKey: string }): Promise<void> {
    if (!this.initPromise) {
      this.initPromise = this.doInit(config);
    }
    return this.initPromise;
  }

  private async doInit(config: { http: string; apiKey: string }) {
    this.baseUrl = config.http;
    this.apiKey = config.apiKey;
    await this.loadAllPrecision();
    this.refreshTimer = setInterval(() => {
      this.loadAllPrecision().catch(err =>
        console.error('[ExchangeSync] precision refresh failed:', err)
      );
    }, REFRESH_INTERVAL);
    console.log('[ExchangeSync] precision cache initialized, count=%d', this.precisionCache.size);
  }

  destroy() {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
      this.refreshTimer = null;
    }
  }

  // ────────── precision ──────────

  private async loadAllPrecision() {
    const exchanges = ['binance', 'okx'];
    const tradeTypes = ['spot', 'futures'];
    const next: PrecisionMap = new Map();

    for (const exchange of exchanges) {
      for (const tradeType of tradeTypes) {
        try {
          const resp = await axios.get(`${this.baseUrl}/api/symbols`, {
            params: { exchange, trade_type: tradeType },
            headers: this.headers,
            timeout: 15000,
          });
          const symbols: any[] = resp.data?.data?.symbols ?? [];
          for (const s of symbols) {
            const contractValue = parsePositiveNumber(s.contractValue ?? s.contract_value);
            next.set(`${exchange}:${tradeType}:${s.symbol}`, {
              pricePrecision: s.pricePrecision ?? 0,
              quantityPrecision: s.quantityPrecision ?? 0,
              tickSize: s.tickSize ?? '',
              stepSize: s.stepSize ?? '',
              contractValue: contractValue ?? undefined,
            });
          }
        } catch (err: any) {
          console.warn('[ExchangeSync] load precision %s/%s failed:', exchange, tradeType, err.message);
        }
      }
    }

    if (next.size > 0) {
      this.precisionCache = next;
    }
  }

  getSymbolPrecision(exchange: string, tradeType: string, symbol: string): SymbolPrecision | undefined {
    return this.precisionCache.get(`${exchange}:${tradeType}:${symbol}`);
  }

  getContractValue(exchange: string, tradeType: string, symbol: string): number | undefined {
    return this.getSymbolPrecision(exchange, tradeType, symbol)?.contractValue;
  }

  getContractValueMap(exchange: string, tradeType: string, symbols: string[]): Map<string, number> {
    const out = new Map<string, number>();
    for (const symbol of symbols) {
      const value = this.getContractValue(exchange, tradeType, symbol);
      if (value != null) {
        out.set(symbol, value);
      }
    }
    return out;
  }

  /** 按精度向下截断价格 */
  truncatePrice(value: number, exchange: string, tradeType: string, symbol: string): number {
    const p = this.getSymbolPrecision(exchange, tradeType, symbol);
    if (!p) return value;

    if (parseStepSpec(p.tickSize)) {
      return truncateToIncrement(value, p.tickSize);
    }

    return truncateToPrecision(value, p.pricePrecision);
  }

  /** 按精度向下截断数量 */
  truncateQuantity(value: number, exchange: string, tradeType: string, symbol: string): number {
    const p = this.getSymbolPrecision(exchange, tradeType, symbol);
    if (!p) return value;

    if (parseStepSpec(p.stepSize)) {
      return truncateToIncrement(value, p.stepSize);
    }

    return truncateToPrecision(value, p.quantityPrecision);
  }

  // ────────── HTTP proxies ──────────

  async getTickerPriceMap(exchange: string, tradeType: string): Promise<Map<string, number>> {
    const resp = await axios.get(`${this.baseUrl}/api/tickers/price-map`, {
      params: { exchange, trade_type: tradeType },
      headers: this.headers,
      timeout: 5000,
    });
    const data: Record<string, number> = resp.data?.data ?? {};
    return new Map(Object.entries(data));
  }

  async getTickers(exchange: string, tradeType?: string) {
    const resp = await axios.get(`${this.baseUrl}/api/tickers`, {
      params: { exchange, trade_type: tradeType },
      headers: this.headers,
      timeout: 10000,
    });
    return resp.data?.data;
  }

  async getCandles(params: {
    exchange: string; symbol: string; tradeType?: string;
    period?: string; limit?: string; startTime?: string;
    endTime?: string; column?: string;
  }) {
    const resp = await axios.get(`${this.baseUrl}/api/candles`, {
      params: {
        exchange: params.exchange, symbol: params.symbol,
        trade_type: params.tradeType, period: params.period,
        limit: params.limit, start_time: params.startTime,
        end_time: params.endTime, column: params.column,
      },
      headers: this.headers,
      timeout: 10000,
    });
    return resp.data;
  }

  async getCurrentCandle(params: {
    exchange: string; symbol: string; tradeType?: string; period?: string;
  }) {
    const resp = await axios.get(`${this.baseUrl}/api/candle/current`, {
      params: {
        exchange: params.exchange, symbol: params.symbol,
        trade_type: params.tradeType, period: params.period,
      },
      headers: this.headers,
      timeout: 10000,
    });
    return resp.data;
  }

  async getSymbols(params: {
    exchange: string; tradeType?: string; symbol?: string;
    orderBy?: string; order?: string;
  }) {
    const resp = await axios.get(`${this.baseUrl}/api/symbols`, {
      params: {
        exchange: params.exchange, trade_type: params.tradeType,
        symbol: params.symbol, orderBy: params.orderBy, order: params.order,
      },
      headers: this.headers,
      timeout: 10000,
    });
    return resp.data;
  }
}

export const exchangeSync = new ExchangeSync();
