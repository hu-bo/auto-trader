import { Config, Init, Destroy, Provide, Scope, ScopeEnum, Logger } from '@midwayjs/core';
import type { ILogger } from '@midwayjs/core';
import { connect, NatsConnection, Subscription, StringCodec } from 'nats';

export interface NatsConfig {
  url: string;
  user?: string;
  pass?: string;
  subjectPrefix: string;
}

@Provide()
@Scope(ScopeEnum.Singleton)
export class NatsService {
  @Config('nats')
  natsConfig!: NatsConfig;

  @Logger()
  logger!: ILogger;

  private nc: NatsConnection | null = null;
  private sc = StringCodec();
  private subscriptions: Map<string, Subscription> = new Map();

  @Init()
  async init() {
    try {
      const url = this.natsConfig?.url;
      if (!url) {
        this.logger.warn('[NATS] No URL configured, skipping connection');
        return;
      }
      this.nc = await connect({
        servers: url,
        user: this.natsConfig.user || undefined,
        pass: this.natsConfig.pass || undefined,
      });
      this.logger.info('[NATS] Connected to %s', url);
    } catch (err) {
      this.logger.error('[NATS] Connection failed:', err);
    }
  }

  @Destroy()
  async destroy() {
    for (const sub of this.subscriptions.values()) {
      sub.unsubscribe();
    }
    this.subscriptions.clear();
    if (this.nc) {
      await this.nc.drain();
      this.nc = null;
    }
    this.logger.info('[NATS] Disconnected');
  }

  get isConnected(): boolean {
    return this.nc !== null && !this.nc.isClosed();
  }

  /**
   * 订阅 NATS 主题，收到消息时调用 callback
   */
  subscribe(subject: string, callback: (data: unknown, subject: string) => void): void {
    if (!this.nc) {
      this.logger.warn('[NATS] Not connected, cannot subscribe to %s', subject);
      return;
    }

    if (this.subscriptions.has(subject)) {
      return; // 已订阅
    }

    const sub = this.nc.subscribe(subject);
    this.subscriptions.set(subject, sub);

    (async () => {
      for await (const msg of sub) {
        try {
          const raw = this.sc.decode(msg.data);
          const data = JSON.parse(raw);
          callback(data, msg.subject);
        } catch (err) {
          this.logger.error('[NATS] Failed to parse message on %s: %s', msg.subject, err);
        }
      }
    })();

    this.logger.info('[NATS] Subscribed to %s', subject);
  }

  /**
   * 取消订阅
   */
  unsubscribe(subject: string): void {
    const sub = this.subscriptions.get(subject);
    if (sub) {
      sub.unsubscribe();
      this.subscriptions.delete(subject);
      this.logger.info('[NATS] Unsubscribed from %s', subject);
    }
  }

  /**
   * 构建 K 线主题
   */
  buildCandleSubject(exchange: string, tradeType: string, symbol: string, period: string): string {
    const prefix = this.natsConfig?.subjectPrefix ?? 'exchange';
    return `${prefix}.candle.${exchange}.${tradeType}.${symbol}.${period}`;
  }

  /**
   * 构建订单簿主题
   */
  buildOrderbookSubject(exchange: string, tradeType: string, symbol: string): string {
    const prefix = this.natsConfig?.subjectPrefix ?? 'exchange';
    return `${prefix}.orderbook.${exchange}.${tradeType}.${symbol}`;
  }

  /**
   * 使用通配符订阅所有 K 线
   */
  subscribeCandleWildcard(callback: (data: unknown, subject: string) => void): void {
    const prefix = this.natsConfig?.subjectPrefix ?? 'exchange';
    this.subscribe(`${prefix}.candle.>`, callback);
  }
}
