import { Config, Init, Destroy, Provide, Scope, ScopeEnum } from '@midwayjs/core';
import { connect, NatsConnection, Subscription, StringCodec } from 'nats';
import { createScopedLogger } from '../common/logger.js';

export interface SignalNatsConfig {
  url: string;
  user?: string;
  pass?: string;
}

/**
 * Dedicated NATS connection for strategy-engine signals.
 *
 * Connects to the local NATS instance shared with strategy-engine,
 * used for receiving strategy.engine.started notifications and signal messages.
 */
@Provide()
@Scope(ScopeEnum.Singleton)
export class SignalNatsService {
  @Config('signalNats')
  config!: SignalNatsConfig;

  private readonly logger = createScopedLogger('SignalNatsService');

  private nc: NatsConnection | null = null;
  private sc = StringCodec();
  private subscriptions: Map<string, Subscription> = new Map();

  @Init()
  async init() {
    try {
      const url = this.config?.url;
      if (!url) {
        this.logger.warn('[SignalNATS] No URL configured, skipping connection');
        return;
      }
      this.nc = await connect({
        servers: url,
        user: this.config.user || undefined,
        pass: this.config.pass || undefined,
      });
      this.logger.info('[SignalNATS] Connected to %s', url);
    } catch (err) {
      this.logger.error('[SignalNATS] Connection failed:', err);
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
    this.logger.info('[SignalNATS] Disconnected');
  }

  get isConnected(): boolean {
    return this.nc !== null && !this.nc.isClosed();
  }

  subscribe(subject: string, callback: (data: unknown, subject: string) => void): void {
    if (!this.nc) {
      this.logger.warn('[SignalNATS] Not connected, cannot subscribe to %s', subject);
      return;
    }

    if (this.subscriptions.has(subject)) {
      return;
    }

    const sub = this.nc.subscribe(subject);
    this.subscriptions.set(subject, sub);

    (async () => {
      for await (const msg of sub) {
        try {
          const raw = this.sc.decode(msg.data);
          console.log(raw);
          const data = JSON.parse(raw);
          callback(data, msg.subject);
        } catch (err) {
          this.logger.error('[SignalNATS] Failed to parse message on %s: %s', msg.subject, err);
        }
      }
    })();

    this.logger.info('[SignalNATS] Subscribed to %s', subject);
  }
}
