# Exchange Service - 交易下单服务

## 概述

交易下单服务是量化交易系统的订单执行层，负责：
- 接收策略引擎的交易信号
- 风控前置检查
- 交易所订单路由与执行
- 订单状态同步
- 仓位与资金管理
- 实时行情数据分发

## 技术栈

| 类别 | 技术 | 说明 |
|------|------|------|
| 语言 | Node.js 20+ | 运行环境 |
| 框架 | Midway.js 3.x | 企业级 Node.js 框架 |
| 数据库 | PostgreSQL | 订单/仓位数据存储 |
| 缓存 | Redis | 状态缓存/限流 |
| 消息队列 | NATS | 信号订阅/事件发布 |
| 交易所 | hquant-adapters | 交易所统一适配层 |
| 认证 | Casdoor SDK | openAPI |

## 目录结构

```
exchange-service/
├── src/
│   ├── configuration.ts           # Midway 应用配置入口
│   ├── controller/                # 控制器层
│   │   ├── v1/
│   │   │   ├── order.controller.ts      # 订单接口
│   │   │   ├── position.controller.ts   # 仓位接口
│   │   │   ├── account.controller.ts    # 账户接口
│   │   │   ├── market.controller.ts     # 行情接口
│   │   │   └── health.controller.ts     # 健康检查
│   │   └── dto/                   # DTO 定义
│   │       ├── order.dto.ts
│   │       ├── position.dto.ts
│   │       └── market.dto.ts
│   ├── service/                   # 业务服务
│   │   ├── order.service.ts       # 订单服务
│   │   ├── position.service.ts    # 仓位服务
│   │   ├── account.service.ts     # 账户服务
│   │   ├── risk.service.ts        # 风控服务
│   │   ├── market.service.ts      # 行情服务
│   │   └── nats.service.ts        # NATS 消息服务
│   ├── manager/                   # 核心管理器
│   │   ├── order.manager.ts       # 订单管理器
│   │   ├── position.manager.ts    # 仓位管理器
│   │   ├── risk.checker.ts        # 风控检查器
│   │   └── signal.processor.ts    # 信号处理器
│   ├── exchange/                  # 交易所适配
│   │   ├── adapter/               # 交易所适配器
│   │   │   ├── base.adapter.ts    # 适配器基类
│   │   │   ├── binance.adapter.ts # Binance 适配器
│   │   │   ├── okx.adapter.ts     # OKX 适配器
│   │   │   └── index.ts           # 适配器工厂
│   │   ├── websocket.manager.ts   # WebSocket 管理
│   │   └── rate-limiter.ts        # 限流器
│   ├── entity/                    # 数据实体 (TypeORM)
│   │   ├── order.entity.ts
│   │   ├── trade.entity.ts
│   │   ├── position.entity.ts
│   │   └── account.entity.ts
│   ├── subscriber/                # NATS 订阅者
│   │   ├── signal.subscriber.ts   # 信号订阅
│   │   └── market.subscriber.ts   # 行情订阅
│   ├── middleware/                # 中间件
│   │   ├── auth.middleware.ts     # 认证中间件
│   │   └── logger.middleware.ts   # 日志中间件
│   ├── filter/                    # 异常过滤器
│   │   └── default.filter.ts
│   ├── task/                      # 定时任务
│   │   ├── sync.task.ts           # 同步任务
│   │   └── cleanup.task.ts        # 清理任务
│   └── util/                      # 工具类
│       ├── logger.ts
│       ├── crypto.ts              # 加密工具
│       └── validator.ts
├── src/config/                    # Midway 配置文件
│   ├── config.default.ts
│   ├── config.local.ts
│   └── config.prod.ts
├── test/                          # 测试
├── bootstrap.js                   # Midway 启动文件
├── Dockerfile
├── docker-compose.yml
├── .drone.yml
├── package.json
└── tsconfig.json
```

## 核心模块

### 1. 应用配置入口

```typescript
// src/configuration.ts
import { Configuration, App } from '@midwayjs/core';
import * as koa from '@midwayjs/koa';
import * as typeorm from '@midwayjs/typeorm';
import * as redis from '@midwayjs/redis';
import * as task from '@midwayjs/task';
import * as validate from '@midwayjs/validate';
import { join } from 'path';
import { DefaultErrorFilter } from './filter/default.filter';
import { AuthMiddleware } from './middleware/auth.middleware';
import { LoggerMiddleware } from './middleware/logger.middleware';
import { NatsService } from './service/nats.service';
import { SignalSubscriber } from './subscriber/signal.subscriber';

@Configuration({
  imports: [koa, typeorm, redis, task, validate],
  importConfigs: [join(__dirname, './config')],
})
export class MainConfiguration {
  @App('koa')
  app: koa.Application;

  @Inject()
  natsService: NatsService;

  @Inject()
  signalSubscriber: SignalSubscriber;

  async onReady() {
    // 添加中间件
    this.app.useMiddleware([LoggerMiddleware, AuthMiddleware]);
    this.app.useFilter([DefaultErrorFilter]);

    // 连接 NATS 并订阅信号
    await this.natsService.connect();
    await this.signalSubscriber.subscribe();
  }

  async onStop() {
    await this.natsService.disconnect();
  }
}
```

### 2. 订单实体

```typescript
// src/entity/order.entity.ts
import { Entity, Column, PrimaryColumn, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

export enum OrderStatus {
  PENDING = 'pending',
  OPEN = 'open',
  PARTIALLY_FILLED = 'partially_filled',
  FILLED = 'filled',
  CANCELLED = 'cancelled',
  REJECTED = 'rejected',
  ERROR = 'error',
}

export enum OrderSide {
  BUY = 'buy',
  SELL = 'sell',
}

export enum OrderType {
  MARKET = 'market',
  LIMIT = 'limit',
  STOP_LOSS = 'stop_loss',
  TAKE_PROFIT = 'take_profit',
}

@Entity('orders')
export class Order {
  @PrimaryColumn({ length: 64 })
  id: string;

  @Column({ length: 64 })
  @Index()
  user_id: string;

  @Column({ length: 64, nullable: true })
  strategy_id: string;

  @Column({ length: 20 })
  @Index()
  symbol: string;

  @Column({ length: 20 })
  exchange: string;

  @Column({ type: 'enum', enum: OrderSide })
  side: OrderSide;

  @Column({ type: 'enum', enum: OrderType })
  type: OrderType;

  @Column({ type: 'decimal', precision: 20, scale: 8 })
  quantity: number;

  @Column({ type: 'decimal', precision: 20, scale: 8, nullable: true })
  price: number;

  @Column({ type: 'decimal', precision: 20, scale: 8, nullable: true })
  stop_loss: number;

  @Column({ type: 'decimal', precision: 20, scale: 8, nullable: true })
  take_profit: number;

  @Column({ type: 'decimal', precision: 20, scale: 8, default: 0 })
  filled_quantity: number;

  @Column({ type: 'decimal', precision: 20, scale: 8, nullable: true })
  filled_price: number;

  @Column({ type: 'enum', enum: OrderStatus, default: OrderStatus.PENDING })
  @Index()
  status: OrderStatus;

  @Column({ length: 64, nullable: true })
  exchange_order_id: string;

  @Column({ type: 'text', nullable: true })
  error_message: string;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any>;

  @CreateDateColumn()
  @Index()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  @Column({ type: 'timestamp', nullable: true })
  filled_at: Date;
}
```

### 3. 风控检查器

```typescript
// src/manager/risk.checker.ts
import { Provide, Inject, Config } from '@midwayjs/core';
import { ILogger } from '@midwayjs/logger';
import { PositionService } from '../service/position.service';
import { AccountService } from '../service/account.service';

export interface RiskCheckResult {
  passed: boolean;
  reason?: string;
  details?: Record<string, any>;
}

export interface RiskConfig {
  maxPositionPct: number;        // 最大仓位比例
  maxDailyVolume: number;        // 最大单日交易量
  maxDrawdown: number;           // 最大回撤
  maxOrdersPerMinute: number;    // 每分钟最大订单数
  maxLossPerTrade: number;       // 单笔最大亏损
}

@Provide()
export class RiskChecker {
  @Inject()
  logger: ILogger;

  @Inject()
  positionService: PositionService;

  @Inject()
  accountService: AccountService;

  @Config('risk')
  riskConfig: RiskConfig;

  async check(userId: string, order: any): Promise<RiskCheckResult> {
    const checks = await Promise.all([
      this.checkPositionLimit(userId, order),
      this.checkDailyVolume(userId, order),
      this.checkDrawdown(userId),
      this.checkOrderFrequency(userId),
      this.checkMaxLoss(userId, order),
    ]);

    const failedCheck = checks.find(c => !c.passed);
    if (failedCheck) {
      this.logger.warn(`Risk check failed for user ${userId}: ${failedCheck.reason}`);
      return failedCheck;
    }

    return { passed: true };
  }

  private async checkPositionLimit(userId: string, order: any): Promise<RiskCheckResult> {
    const account = await this.accountService.getAccount(userId);
    const position = await this.positionService.getPosition(userId, order.symbol);

    const currentValue = position ? position.value : 0;
    const orderValue = order.quantity * order.price;
    const totalValue = currentValue + orderValue;
    const positionPct = totalValue / account.balance;

    if (positionPct > this.riskConfig.maxPositionPct) {
      return {
        passed: false,
        reason: `仓位比例超限: ${(positionPct * 100).toFixed(2)}% > ${this.riskConfig.maxPositionPct * 100}%`,
        details: { currentPct: positionPct, maxPct: this.riskConfig.maxPositionPct }
      };
    }

    return { passed: true };
  }

  private async checkDailyVolume(userId: string, order: any): Promise<RiskCheckResult> {
    const today = new Date().toISOString().split('T')[0];
    const dailyVolume = await this.accountService.getDailyVolume(userId, today);
    const orderValue = order.quantity * order.price;

    if (dailyVolume + orderValue > this.riskConfig.maxDailyVolume) {
      return {
        passed: false,
        reason: `单日交易量超限`,
        details: { dailyVolume, orderValue, maxVolume: this.riskConfig.maxDailyVolume }
      };
    }

    return { passed: true };
  }

  private async checkDrawdown(userId: string): Promise<RiskCheckResult> {
    const account = await this.accountService.getAccount(userId);

    if (account.drawdown < -this.riskConfig.maxDrawdown) {
      return {
        passed: false,
        reason: `回撤超限: ${(account.drawdown * 100).toFixed(2)}%`,
        details: { drawdown: account.drawdown, maxDrawdown: this.riskConfig.maxDrawdown }
      };
    }

    return { passed: true };
  }

  private async checkOrderFrequency(userId: string): Promise<RiskCheckResult> {
    const recentOrders = await this.positionService.getRecentOrderCount(userId, 60); // 最近60秒

    if (recentOrders >= this.riskConfig.maxOrdersPerMinute) {
      return {
        passed: false,
        reason: `订单频率超限: ${recentOrders}次/分钟`,
        details: { recentOrders, maxOrders: this.riskConfig.maxOrdersPerMinute }
      };
    }

    return { passed: true };
  }

  private async checkMaxLoss(userId: string, order: any): Promise<RiskCheckResult> {
    if (order.stop_loss) {
      const potentialLoss = Math.abs(order.price - order.stop_loss) * order.quantity;
      const account = await this.accountService.getAccount(userId);
      const lossPct = potentialLoss / account.balance;

      if (lossPct > this.riskConfig.maxLossPerTrade) {
        return {
          passed: false,
          reason: `单笔潜在亏损超限: ${(lossPct * 100).toFixed(2)}%`,
          details: { potentialLoss, lossPct, maxLossPct: this.riskConfig.maxLossPerTrade }
        };
      }
    }

    return { passed: true };
  }
}
```

### 4. 信号处理器

```typescript
// src/manager/signal.processor.ts
import { Provide, Inject } from '@midwayjs/core';
import { ILogger } from '@midwayjs/logger';
import { OrderManager } from './order.manager';
import { RiskChecker } from './risk.checker';
import { NatsService } from '../service/nats.service';
import { Order, OrderSide, OrderType, OrderStatus } from '../entity/order.entity';
import { v4 as uuidv4 } from 'uuid';

export interface Signal {
  type: 'entry_long' | 'exit_long' | 'entry_short' | 'exit_short';
  symbol: string;
  exchange: string;
  price: number;
  quantity: number;
  stop_loss?: number;
  take_profit?: number;
  metadata?: {
    strategy_id?: string;
    user_id?: string;
    [key: string]: any;
  };
}

@Provide()
export class SignalProcessor {
  @Inject()
  logger: ILogger;

  @Inject()
  orderManager: OrderManager;

  @Inject()
  riskChecker: RiskChecker;

  @Inject()
  natsService: NatsService;

  async processSignal(signal: Signal): Promise<void> {
    this.logger.info(`Processing signal: ${signal.type} ${signal.symbol}`);

    const userId = signal.metadata?.user_id;
    if (!userId) {
      this.logger.warn('Signal missing user_id, skipping');
      return;
    }

    try {
      // 1. 转换为订单
      const order = this.signalToOrder(signal);

      // 2. 风控检查
      const riskResult = await this.riskChecker.check(userId, order);
      if (!riskResult.passed) {
        await this.publishSignalRejected(signal, riskResult.reason);
        return;
      }

      // 3. 创建订单
      const createdOrder = await this.orderManager.createOrder(order);

      // 4. 发布订单创建事件
      await this.publishOrderCreated(createdOrder);

      this.logger.info(`Signal processed successfully: ${createdOrder.id}`);
    } catch (error) {
      this.logger.error(`Failed to process signal: ${error.message}`);
      await this.publishSignalRejected(signal, error.message);
    }
  }

  private signalToOrder(signal: Signal): Partial<Order> {
    const side = this.getSideFromSignalType(signal.type);
    const type = signal.price ? OrderType.LIMIT : OrderType.MARKET;

    return {
      id: `ord_${uuidv4().replace(/-/g, '').slice(0, 16)}`,
      user_id: signal.metadata?.user_id,
      strategy_id: signal.metadata?.strategy_id,
      symbol: signal.symbol,
      exchange: signal.exchange,
      side,
      type,
      quantity: signal.quantity,
      price: signal.price,
      stop_loss: signal.stop_loss,
      take_profit: signal.take_profit,
      status: OrderStatus.PENDING,
      metadata: signal.metadata,
    };
  }

  private getSideFromSignalType(type: string): OrderSide {
    switch (type) {
      case 'entry_long':
      case 'exit_short':
        return OrderSide.BUY;
      case 'entry_short':
      case 'exit_long':
        return OrderSide.SELL;
      default:
        throw new Error(`Unknown signal type: ${type}`);
    }
  }

  private async publishOrderCreated(order: Order): Promise<void> {
    await this.natsService.publish(`exchange.orders.${order.symbol}.created`, order);
  }

  private async publishSignalRejected(signal: Signal, reason: string): Promise<void> {
    await this.natsService.publish(`exchange.signals.rejected`, {
      signal,
      reason,
      timestamp: new Date().toISOString(),
    });
  }
}
```

### 5. 交易所适配器

```typescript
// src/exchange/adapter/base.adapter.ts
export interface ExchangeOrder {
  id: string;
  symbol: string;
  side: 'buy' | 'sell';
  type: 'market' | 'limit';
  quantity: number;
  price?: number;
  status: string;
  filled_quantity: number;
  filled_price?: number;
  created_at: Date;
}

export interface Balance {
  currency: string;
  total: number;
  available: number;
  used: number;
}

export interface Position {
  symbol: string;
  side: 'long' | 'short';
  quantity: number;
  entry_price: number;
  unrealized_pnl: number;
}

export abstract class BaseExchangeAdapter {
  protected apiKey: string;
  protected apiSecret: string;
  protected sandbox: boolean;

  constructor(config: { apiKey: string; apiSecret: string; sandbox?: boolean }) {
    this.apiKey = config.apiKey;
    this.apiSecret = config.apiSecret;
    this.sandbox = config.sandbox || false;
  }

  // 订单操作
  abstract createOrder(order: Partial<ExchangeOrder>): Promise<ExchangeOrder>;
  abstract cancelOrder(orderId: string, symbol: string): Promise<boolean>;
  abstract getOrder(orderId: string, symbol: string): Promise<ExchangeOrder | null>;
  abstract getOpenOrders(symbol?: string): Promise<ExchangeOrder[]>;

  // 账户操作
  abstract getBalance(): Promise<Balance[]>;
  abstract getPositions(): Promise<Position[]>;

  // 行情数据
  abstract getTicker(symbol: string): Promise<{ price: number; volume: number }>;
  abstract getOrderBook(symbol: string, limit?: number): Promise<{ bids: number[][]; asks: number[][] }>;

  // WebSocket
  abstract connectWebSocket(): Promise<void>;
  abstract disconnectWebSocket(): Promise<void>;
  abstract subscribeOrderUpdates(callback: (order: ExchangeOrder) => void): void;
  abstract subscribeTickerUpdates(symbol: string, callback: (ticker: any) => void): void;
}
```

```typescript
// src/exchange/adapter/binance.adapter.ts
import { BaseExchangeAdapter, ExchangeOrder, Balance, Position } from './base.adapter';
import * as ccxt from 'ccxt';
import WebSocket from 'ws';

export class BinanceAdapter extends BaseExchangeAdapter {
  private client: ccxt.binance;
  private ws: WebSocket | null = null;
  private orderUpdateCallback: ((order: ExchangeOrder) => void) | null = null;

  constructor(config: { apiKey: string; apiSecret: string; sandbox?: boolean }) {
    super(config);
    this.client = new ccxt.binance({
      apiKey: this.apiKey,
      secret: this.apiSecret,
      sandbox: this.sandbox,
      enableRateLimit: true,
    });
  }

  async createOrder(order: Partial<ExchangeOrder>): Promise<ExchangeOrder> {
    const result = await this.client.createOrder(
      order.symbol,
      order.type,
      order.side,
      order.quantity,
      order.price
    );

    return {
      id: result.id,
      symbol: result.symbol,
      side: result.side as 'buy' | 'sell',
      type: result.type as 'market' | 'limit',
      quantity: result.amount,
      price: result.price,
      status: result.status,
      filled_quantity: result.filled,
      filled_price: result.average,
      created_at: new Date(result.timestamp),
    };
  }

  async cancelOrder(orderId: string, symbol: string): Promise<boolean> {
    try {
      await this.client.cancelOrder(orderId, symbol);
      return true;
    } catch (error) {
      return false;
    }
  }

  async getOrder(orderId: string, symbol: string): Promise<ExchangeOrder | null> {
    try {
      const result = await this.client.fetchOrder(orderId, symbol);
      return {
        id: result.id,
        symbol: result.symbol,
        side: result.side as 'buy' | 'sell',
        type: result.type as 'market' | 'limit',
        quantity: result.amount,
        price: result.price,
        status: result.status,
        filled_quantity: result.filled,
        filled_price: result.average,
        created_at: new Date(result.timestamp),
      };
    } catch {
      return null;
    }
  }

  async getOpenOrders(symbol?: string): Promise<ExchangeOrder[]> {
    const orders = await this.client.fetchOpenOrders(symbol);
    return orders.map(o => ({
      id: o.id,
      symbol: o.symbol,
      side: o.side as 'buy' | 'sell',
      type: o.type as 'market' | 'limit',
      quantity: o.amount,
      price: o.price,
      status: o.status,
      filled_quantity: o.filled,
      filled_price: o.average,
      created_at: new Date(o.timestamp),
    }));
  }

  async getBalance(): Promise<Balance[]> {
    const balance = await this.client.fetchBalance();
    return Object.entries(balance.total)
      .filter(([_, value]) => value > 0)
      .map(([currency, total]) => ({
        currency,
        total: total as number,
        available: balance.free[currency] || 0,
        used: balance.used[currency] || 0,
      }));
  }

  async getPositions(): Promise<Position[]> {
    const positions = await this.client.fetchPositions();
    return positions
      .filter(p => Math.abs(p.contracts) > 0)
      .map(p => ({
        symbol: p.symbol,
        side: p.side as 'long' | 'short',
        quantity: Math.abs(p.contracts),
        entry_price: p.entryPrice,
        unrealized_pnl: p.unrealizedPnl,
      }));
  }

  async getTicker(symbol: string): Promise<{ price: number; volume: number }> {
    const ticker = await this.client.fetchTicker(symbol);
    return { price: ticker.last, volume: ticker.quoteVolume };
  }

  async getOrderBook(symbol: string, limit = 20): Promise<{ bids: number[][]; asks: number[][] }> {
    const orderbook = await this.client.fetchOrderBook(symbol, limit);
    return { bids: orderbook.bids, asks: orderbook.asks };
  }

  async connectWebSocket(): Promise<void> {
    const listenKey = await this.getListenKey();
    const url = this.sandbox
      ? `wss://testnet.binance.vision/ws/${listenKey}`
      : `wss://stream.binance.com:9443/ws/${listenKey}`;

    this.ws = new WebSocket(url);

    this.ws.on('message', (data: Buffer) => {
      const msg = JSON.parse(data.toString());
      if (msg.e === 'executionReport' && this.orderUpdateCallback) {
        this.orderUpdateCallback(this.parseOrderUpdate(msg));
      }
    });
  }

  async disconnectWebSocket(): Promise<void> {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  subscribeOrderUpdates(callback: (order: ExchangeOrder) => void): void {
    this.orderUpdateCallback = callback;
  }

  subscribeTickerUpdates(symbol: string, callback: (ticker: any) => void): void {
    // 实现 ticker 订阅
  }

  private async getListenKey(): Promise<string> {
    const response = await this.client.publicPostUserDataStream();
    return response.listenKey;
  }

  private parseOrderUpdate(msg: any): ExchangeOrder {
    return {
      id: msg.i.toString(),
      symbol: msg.s,
      side: msg.S.toLowerCase() as 'buy' | 'sell',
      type: msg.o.toLowerCase() as 'market' | 'limit',
      quantity: parseFloat(msg.q),
      price: parseFloat(msg.p),
      status: this.mapOrderStatus(msg.X),
      filled_quantity: parseFloat(msg.z),
      filled_price: parseFloat(msg.L),
      created_at: new Date(msg.T),
    };
  }

  private mapOrderStatus(status: string): string {
    const statusMap: Record<string, string> = {
      NEW: 'open',
      PARTIALLY_FILLED: 'partially_filled',
      FILLED: 'filled',
      CANCELED: 'cancelled',
      REJECTED: 'rejected',
      EXPIRED: 'expired',
    };
    return statusMap[status] || status.toLowerCase();
  }
}
```

## API 接口

### 1. 订单接口

#### POST /api/v1/orders
创建订单

**请求示例**:
```json
{
  "symbol": "BTC/USDT",
  "exchange": "binance",
  "side": "buy",
  "type": "limit",
  "quantity": 0.1,
  "price": 45000,
  "stop_loss": 44000,
  "take_profit": 47000
}
```

**响应示例**:
```json
{
  "id": "ord_abc123",
  "symbol": "BTC/USDT",
  "exchange": "binance",
  "side": "buy",
  "type": "limit",
  "quantity": 0.1,
  "price": 45000,
  "status": "open",
  "created_at": "2026-01-23T10:00:00Z"
}
```

#### GET /api/v1/orders
获取订单列表

#### GET /api/v1/orders/:id
获取订单详情

#### DELETE /api/v1/orders/:id
取消订单

### 2. 仓位接口

#### GET /api/v1/positions
获取仓位列表

**响应示例**:
```json
{
  "positions": [
    {
      "symbol": "BTC/USDT",
      "side": "long",
      "quantity": 0.5,
      "entry_price": 45000,
      "current_price": 46000,
      "unrealized_pnl": 500,
      "pnl_pct": 2.22
    }
  ]
}
```

#### POST /api/v1/positions/close
平仓

### 3. 账户接口

#### GET /api/v1/accounts
获取账户信息

**响应示例**:
```json
{
  "balance": 100000,
  "available": 95000,
  "used": 5000,
  "unrealized_pnl": 500,
  "total_pnl": 5000,
  "drawdown": -0.02
}
```

### 4. 健康检查

#### GET /health
```json
{
  "status": "ok",
  "service": "exchange-service",
  "version": "1.0.0",
  "exchanges": {
    "binance": "connected",
    "okx": "connected"
  }
}
```

## 配置管理

```typescript
// src/config/config.default.ts
import { MidwayConfig } from '@midwayjs/core';

export default {
  keys: 'exchange-service-secret',
  koa: {
    port: 9102,
  },

  typeorm: {
    dataSource: {
      default: {
        type: 'postgres',
        host: process.env.DB_HOST || 'localhost',
        port: 5432,
        database: 'exchange_db',
        username: 'exchange_user',
        password: process.env.DB_PASSWORD,
        synchronize: false,
        entities: ['**/entity/**/*.entity{.ts,.js}'],
      },
    },
  },

  redis: {
    client: {
      host: process.env.REDIS_HOST || 'localhost',
      port: 6379,
      db: 0,
    },
  },

  nats: {
    servers: [process.env.NATS_URL || 'nats://localhost:4222'],
    user: process.env.NATS_USER || 'trader_user',
    pass: process.env.NATS_PASS || 'p123456',
  },

  exchanges: {
    binance: {
      enabled: true,
      apiKey: process.env.BINANCE_API_KEY,
      apiSecret: process.env.BINANCE_SECRET,
      sandbox: process.env.NODE_ENV !== 'production',
    },
    okx: {
      enabled: false,
      apiKey: process.env.OKX_API_KEY,
      apiSecret: process.env.OKX_SECRET,
      passphrase: process.env.OKX_PASSPHRASE,
    },
  },

  risk: {
    maxPositionPct: 0.3,
    maxDailyVolume: 1000000,
    maxDrawdown: 0.2,
    maxOrdersPerMinute: 100,
    maxLossPerTrade: 0.02,
  },
} as MidwayConfig;
```

## NATS 消息主题

### 订阅主题

| 主题 | 说明 |
|------|------|
| `strategy.signals.>` | 策略信号 |
| `market.tickers.>` | 行情 Ticker |

### 发布主题

| 主题 | 说明 |
|------|------|
| `exchange.orders.{symbol}.created` | 订单创建 |
| `exchange.orders.{symbol}.filled` | 订单成交 |
| `exchange.orders.{symbol}.cancelled` | 订单取消 |
| `exchange.signals.rejected` | 信号拒绝 |
| `exchange.positions.updated` | 仓位更新 |

## 部署

### Docker 部署

```yaml
# docker-compose.yml
version: '3.8'

services:
  exchange-service:
    build: .
    container_name: exchange-service
    ports:
      - "9102:9102"
    environment:
      - NODE_ENV=production
      - DB_HOST=postgres
      - DB_PASSWORD=${DB_PASSWORD}
      - REDIS_HOST=redis
      - NATS_URL=nats://nats:4222
      - BINANCE_API_KEY=${BINANCE_API_KEY}
      - BINANCE_SECRET=${BINANCE_SECRET}
    depends_on:
      - postgres
      - redis
      - nats
    volumes:
      - ./logs:/app/logs
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:9102/health"]
      interval: 30s
      timeout: 10s
      retries: 3
    networks:
      - shared_network

networks:
  shared_network:
    external: true
```

## 参考文档

- [Midway.js 文档](https://midwayjs.org/)
- [CCXT 文档](https://docs.ccxt.com/)
- [NATS 文档](https://docs.nats.io/)

---

**版本**: 1.0.0
**最后更新**: 2026-01-23
**维护者**: 量化团队
