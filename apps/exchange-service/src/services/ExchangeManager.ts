import {
  OkxTradeAdapter,
  OkxPublicAdapter,
  OkxWsUserDataAdapter,
  BinanceTradeAdapter,
  BinancePublicAdapter,
  BinanceWsUserDataAdapter,
  type ITradeAdapter,
  type IWsUserDataAdapter,
  type WsUserDataEvent,
  type WsOrderUpdate,
  type WsConnectionEvent,
  type WsErrorEvent,
  type TradeType,
} from '@hquant/exchange-adapter';
import { exchangeConfig } from '../config/index.js';
import { type AccountConfig, getTokenService } from './TokenService.js';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('ExchangeManager');

interface ExchangeInstance {
  tradeAdapter: ITradeAdapter;
  wsAdapter: IWsUserDataAdapter;
  config: AccountConfig;
  subscribedTradeTypes: Set<TradeType>;
}

type OrderUpdateHandler = (token: string, event: WsOrderUpdate) => void;

export class ExchangeManager {
  private instances: Map<string, ExchangeInstance> = new Map();
  private orderUpdateHandlers: Set<OrderUpdateHandler> = new Set();
  private initialized = false;

  /**
   * Initialize exchange manager and restore instances from Redis
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    logger.info('Initializing ExchangeManager...');
    const tokenService = getTokenService();
    const accounts = await tokenService.getAllActiveAccounts();

    for (const account of accounts) {
      try {
        await this.createInstance(account);
        logger.info({ token: account.token, exchange: account.exchange }, 'Instance restored');
      } catch (error) {
        logger.error({ error, token: account.token }, 'Failed to restore instance');
      }
    }

    this.initialized = true;
    logger.info({ count: this.instances.size }, 'ExchangeManager initialized');
  }

  /**
   * Create a new exchange instance
   */
  private async createInstance(config: AccountConfig): Promise<ExchangeInstance> {
    const adapterOptions = {
      apiKey: config.apiKey,
      apiSecret: config.apiSecret,
      passphrase: config.passphrase,
      demonet: config.demonet,
      httpsProxy: exchangeConfig.httpsProxy,
      socksProxy: exchangeConfig.socksProxy,
    };

    let tradeAdapter: ITradeAdapter;
    let wsAdapter: IWsUserDataAdapter;

    if (config.exchange === 'okx') {
      const publicAdapter = new OkxPublicAdapter({
        demonet: config.demonet,
        httpsProxy: exchangeConfig.httpsProxy,
        socksProxy: exchangeConfig.socksProxy,
      });
      tradeAdapter = new OkxTradeAdapter({
        ...adapterOptions,
        passphrase: config.passphrase || '',
        publicAdapter,
      });
      wsAdapter = new OkxWsUserDataAdapter({
        ...adapterOptions,
        passphrase: config.passphrase || '',
      });
    } else if (config.exchange === 'binance') {
      const publicAdapter = new BinancePublicAdapter({
        httpsProxy: exchangeConfig.httpsProxy,
        socksProxy: exchangeConfig.socksProxy,
      });
      tradeAdapter = new BinanceTradeAdapter({
        ...adapterOptions,
        publicAdapter,
      });
      wsAdapter = new BinanceWsUserDataAdapter(adapterOptions);
    } else {
      throw new Error(`Unsupported exchange: ${config.exchange}`);
    }

    // Initialize trade adapter
    const initResult = await tradeAdapter.init();
    if (!initResult.ok) {
      throw new Error(`Failed to initialize adapter: ${initResult.error.message}`);
    }

    const instance: ExchangeInstance = {
      tradeAdapter,
      wsAdapter,
      config,
      subscribedTradeTypes: new Set(),
    };

    // Setup WebSocket event handlers
    this.setupWsHandlers(instance);

    this.instances.set(config.token, instance);
    return instance;
  }

  /**
   * Setup WebSocket handlers for an instance
   */
  private setupWsHandlers(instance: ExchangeInstance): void {
    const { wsAdapter, config } = instance;

    wsAdapter.on('order', (event: WsOrderUpdate) => {
      logger.debug({ token: config.token, orderId: event.orderId }, 'Order update received');
      this.orderUpdateHandlers.forEach((handler) => {
        try {
          handler(config.token, event);
        } catch (error) {
          logger.error({ error }, 'Order update handler error');
        }
      });
    });

    wsAdapter.on('connected', () => {
      logger.info({ token: config.token }, 'WebSocket connected');
    });

    wsAdapter.on('disconnected', (event: WsConnectionEvent) => {
      logger.warn({ token: config.token, reason: event.reason }, 'WebSocket disconnected');
    });

    wsAdapter.on('error', (event: WsErrorEvent) => {
      logger.error({ token: config.token, code: event.code, message: event.message }, 'WebSocket error');
    });
  }

  /**
   * Get or create an exchange instance by token
   */
  async getInstance(token: string): Promise<ExchangeInstance | null> {
    let instance = this.instances.get(token);
    if (instance) {
      return instance;
    }

    // Try to load from database
    const tokenService = getTokenService();
    const config = await tokenService.getAccountConfig(token);
    if (!config) {
      return null;
    }

    try {
      instance = await this.createInstance(config);
      return instance;
    } catch (error) {
      logger.error({ error, token }, 'Failed to create instance');
      return null;
    }
  }

  /**
   * Get trade adapter by token
   */
  async getTradeAdapter(token: string): Promise<ITradeAdapter | null> {
    const instance = await this.getInstance(token);
    return instance?.tradeAdapter ?? null;
  }

  /**
   * Get WebSocket adapter by token
   */
  async getWsAdapter(token: string): Promise<IWsUserDataAdapter | null> {
    const instance = await this.getInstance(token);
    return instance?.wsAdapter ?? null;
  }

  /**
   * Subscribe to WebSocket user data for a specific trade type
   */
  async subscribeUserData(
    token: string,
    tradeType: TradeType,
    handler?: (event: WsUserDataEvent) => void
  ): Promise<boolean> {
    const instance = await this.getInstance(token);
    if (!instance) {
      return false;
    }

    if (instance.subscribedTradeTypes.has(tradeType)) {
      return true; // Already subscribed
    }

    try {
      await instance.wsAdapter.subscribe(
        { tradeType, autoReconnect: true },
        handler || (() => {})
      );
      instance.subscribedTradeTypes.add(tradeType);
      logger.info({ token, tradeType }, 'Subscribed to user data');
      return true;
    } catch (error) {
      logger.error({ error, token, tradeType }, 'Failed to subscribe');
      return false;
    }
  }

  /**
   * Unsubscribe from WebSocket user data
   */
  async unsubscribeUserData(token: string, tradeType?: TradeType): Promise<void> {
    const instance = this.instances.get(token);
    if (!instance) {
      return;
    }

    await instance.wsAdapter.unsubscribe(tradeType);
    if (tradeType) {
      instance.subscribedTradeTypes.delete(tradeType);
    } else {
      instance.subscribedTradeTypes.clear();
    }
  }

  /**
   * Register an order update handler
   */
  onOrderUpdate(handler: OrderUpdateHandler): () => void {
    this.orderUpdateHandlers.add(handler);
    return () => this.orderUpdateHandlers.delete(handler);
  }

  /**
   * Remove an exchange instance
   */
  async removeInstance(token: string): Promise<void> {
    const instance = this.instances.get(token);
    if (instance) {
      await instance.wsAdapter.close();
      await instance.tradeAdapter.destroy();
      this.instances.delete(token);
      logger.info({ token }, 'Instance removed');
    }
  }

  /**
   * Get account config for an instance
   */
  getAccountConfig(token: string): AccountConfig | null {
    const instance = this.instances.get(token);
    return instance?.config ?? null;
  }

  /**
   * Check if an instance exists
   */
  hasInstance(token: string): boolean {
    return this.instances.has(token);
  }

  /**
   * Get all active tokens
   */
  getActiveTokens(): string[] {
    return Array.from(this.instances.keys());
  }

  /**
   * Shutdown all instances
   */
  async shutdown(): Promise<void> {
    logger.info('Shutting down ExchangeManager...');
    const tokens = this.getActiveTokens();
    for (const token of tokens) {
      await this.removeInstance(token);
    }
    this.initialized = false;
    logger.info('ExchangeManager shutdown complete');
  }
}

// Singleton instance
let exchangeManager: ExchangeManager | null = null;

export function getExchangeManager(): ExchangeManager {
  if (!exchangeManager) {
    exchangeManager = new ExchangeManager();
  }
  return exchangeManager;
}
