import { Provide, Init, Destroy, Config, Logger } from '@midwayjs/core';
import { ILogger } from '@midwayjs/logger';
import { InjectEntityModel } from '@midwayjs/typeorm';
import { Repository } from 'typeorm';
import { Signal } from '../entity/signal.entity.js';
import { connect, NatsConnection, StringCodec } from 'nats';

interface SignalMessage {
  signal_id?: string;
  strategy_id: string;
  strategy_name: string;
  exchange: string;
  trade_type: string;
  symbol: string;
  period: string;
  action: string;
  price: number;
  confidence: number;
  timestamp: string;
}

@Provide()
export class SignalService {
  @InjectEntityModel(Signal)
  signalRepository!: Repository<Signal>;

  @Config('nats')
  natsConfig!: {
    url: string;
    prefix: string;
  };

  @Logger()
  logger!: ILogger;

  private nc?: NatsConnection;
  private sc = StringCodec();
  private subscriptions: Map<string, any> = new Map();

  @Init()
  async init() {
    try {
      this.nc = await connect({
        servers: this.natsConfig.url,
      });
      this.logger.info(`Connected to NATS at ${this.natsConfig.url}`);
    } catch (error) {
      this.logger.error('Failed to connect to NATS:', error);
    }
  }

  @Destroy()
  async destroy() {
    // Unsubscribe all
    for (const [subject, sub] of this.subscriptions.entries()) {
      await sub.unsubscribe();
      this.logger.info(`Unsubscribed from ${subject}`);
    }
    this.subscriptions.clear();

    // Close connection
    if (this.nc) {
      await this.nc.close();
      this.logger.info('NATS connection closed');
    }
  }

  /**
   * Subscribe to signal updates
   * @param exchange - Exchange name (e.g., 'binance', 'okx')
   * @param tradeType - Trade type (e.g., 'spot', 'futures')
   * @param symbol - Trading pair (e.g., 'BTC-USDT')
   */
  async subscribe(exchange: string, tradeType: string, symbol: string) {
    if (!this.nc) {
      throw new Error('NATS connection not established');
    }

    const subject = `${this.natsConfig.prefix}.${exchange}.${tradeType}.${symbol}`;

    // Check if already subscribed
    if (this.subscriptions.has(subject)) {
      this.logger.warn(`Already subscribed to ${subject}`);
      return;
    }

    const sub = this.nc.subscribe(subject);
    this.subscriptions.set(subject, sub);

    this.logger.info(`Subscribed to ${subject}`);

    // Process messages
    (async () => {
      for await (const msg of sub) {
        try {
          const data = JSON.parse(this.sc.decode(msg.data));
          await this.handleSignalMessage(data);
        } catch (error) {
          this.logger.error(`Error processing message from ${subject}:`, error);
        }
      }
    })();
  }

  /**
   * Unsubscribe from signal updates
   */
  async unsubscribe(exchange: string, tradeType: string, symbol: string) {
    const subject = `${this.natsConfig.prefix}.${exchange}.${tradeType}.${symbol}`;

    const sub = this.subscriptions.get(subject);
    if (sub) {
      await sub.unsubscribe();
      this.subscriptions.delete(subject);
      this.logger.info(`Unsubscribed from ${subject}`);
    }
  }

  /**
   * Handle incoming signal message
   */
  private async handleSignalMessage(data: SignalMessage) {
    try {
      const signal = this.signalRepository.create({
        strategyId: data.strategy_id,
        strategyName: data.strategy_name,
        exchange: data.exchange,
        tradeType: data.trade_type,
        symbol: data.symbol,
        period: data.period,
        action: data.action,
        price: data.price.toString(),
        confidence: data.confidence.toString(),
        timestamp: new Date(data.timestamp),
      });

      await this.signalRepository.save(signal);
      this.logger.info(
        `Signal saved: ${data.strategy_name} ${data.symbol} ${data.action} @ ${data.price} (confidence: ${data.confidence})`
      );
    } catch (error) {
      this.logger.error('Error saving signal:', error);
    }
  }

  /**
   * Get all active subscriptions
   */
  getActiveSubscriptions(): string[] {
    return Array.from(this.subscriptions.keys());
  }

  /**
   * List signals with pagination
   */
  async listSignals(page = 1, limit = 50) {
    const [signals, total] = await this.signalRepository.findAndCount({
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return {
      data: signals,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Get signals by symbol
   */
  async getSignalsBySymbol(symbol: string, limit = 50) {
    return await this.signalRepository.find({
      where: { symbol },
      order: { createdAt: 'DESC' },
      take: limit,
    });
  }

  /**
   * Get signals by strategy
   */
  async getSignalsByStrategy(strategyId: string, limit = 50) {
    return await this.signalRepository.find({
      where: { strategyId },
      order: { timestamp: 'DESC' },
      take: limit,
    });
  }

  /**
   * Get signals by exchange and symbol
   */
  async getSignalsByExchangeAndSymbol(
    exchange: string,
    symbol: string,
    limit = 50
  ) {
    return await this.signalRepository.find({
      where: { exchange, symbol },
      order: { timestamp: 'DESC' },
      take: limit,
    });
  }

  /**
   * Get latest signal for a symbol
   */
  async getLatestSignal(exchange: string, symbol: string) {
    return await this.signalRepository.findOne({
      where: { exchange, symbol },
      order: { timestamp: 'DESC' },
    });
  }
}
