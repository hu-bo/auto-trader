# Trading Engine - 交易引擎服务

## 概述

交易引擎是量化交易系统的执行层，负责：
- 接收并处理交易信号
- 执行订单管理（OMS）
- 风控前置检查
- 交易所适配与订单路由
- 仓位管理与资金管理
- 实时监控与异常处理

## 技术栈

- **语言**: Node.js 20+
- **框架**: Midway.js 3.x + TypeScript
- **数据库**: PostgreSQL (订单/仓位), Redis (缓存/状态)
- **消息队列**: NATS (信号订阅, 订单发布)
- **交易所连接**: CCXT, WebSocket
- **容器**: Docker + Docker Compose
- **监控**: Prometheus + Grafana

## 架构设计

### 1. 核心组件

```
trading-engine/
├── src/
│   ├── configuration.ts        # Midway 应用配置入口
│   ├── controller/             # 控制器层
│   │   ├── v1/
│   │   │   ├── orders.controller.ts
│   │   │   ├── positions.controller.ts
│   │   │   ├── accounts.controller.ts
│   │   │   └── trades.controller.ts
│   │   └── dto/                # DTO 定义
│   ├── service/                # 业务服务
│   │   ├── order.service.ts    # 订单服务
│   │   ├── position.service.ts # 仓位服务
│   │   ├── account.service.ts  # 账户服务
│   │   ├── trade.service.ts    # 成交服务
│   │   ├── risk.service.ts     # 风控服务
│   │   └── signal.service.ts   # 信号服务
│   ├── manager/                # 核心管理器
│   │   ├── order.manager.ts    # 订单管理器
│   │   ├── position.manager.ts # 仓位管理器
│   │   ├── risk.checker.ts     # 风控检查器
│   │   └── signal.processor.ts # 信号处理器
│   ├── exchange/               # 交易所适配
│   │   ├── adapter/            # 交易所适配器
│   │   │   ├── binance.adapter.ts
│   │   │   ├── okx.adapter.ts
│   │   │   └── bybit.adapter.ts
│   │   ├── websocket.manager.ts # WebSocket 管理
│   │   └── rest.client.ts      # REST 客户端
│   ├── entity/                 # 数据实体 (TypeORM)
│   │   ├── order.entity.ts
│   │   ├── position.entity.ts
│   │   ├── account.entity.ts
│   │   └── trade.entity.ts
│   ├── middleware/             # 中间件
│   │   └── auth.middleware.ts
│   ├── filter/                 # 异常过滤器
│   │   └── default.filter.ts
│   ├── subscriber/             # NATS 订阅者
│   │   ├── signal.subscriber.ts
│   │   └── order.subscriber.ts
│   ├── task/                   # 定时任务
│   │   ├── sync.task.ts        # 同步任务
│   │   └── cleanup.task.ts     # 清理任务
│   └── util/                   # 工具类
│       ├── logger.ts
│       ├── metrics.ts
│       └── validator.ts
├── src/config/                 # Midway 配置文件
│   ├── config.default.ts       # 默认配置
│   ├── config.local.ts         # 本地开发配置
│   └── config.prod.ts          # 生产环境配置
├── test/                       # 测试
├── scripts/                    # 脚本
├── bootstrap.js                # Midway 启动文件
├── Dockerfile
├── docker-compose.yml
├── package.json
└── tsconfig.json
```

### 2. 核心依赖 (package.json)

```json
{
  "name": "trading-engine",
  "version": "1.0.0",
  "scripts": {
    "dev": "cross-env NODE_ENV=local midway-bin dev --ts",
    "build": "midway-bin build -c",
    "start": "NODE_ENV=production node bootstrap.js",
    "test": "midway-bin test --ts"
  },
  "dependencies": {
    "@midwayjs/bootstrap": "^3.14.0",
    "@midwayjs/core": "^3.14.0",
    "@midwayjs/decorator": "^3.14.0",
    "@midwayjs/koa": "^3.14.0",
    "@midwayjs/typeorm": "^3.14.0",
    "@midwayjs/redis": "^3.14.0",
    "@midwayjs/task": "^3.14.0",
    "@midwayjs/validate": "^3.14.0",
    "typeorm": "^0.3.17",
    "pg": "^8.11.3",
    "ioredis": "^5.3.2",
    "ccxt": "^4.2.0",
    "nats": "^2.18.0",
    "prom-client": "^15.1.0",
    "ws": "^8.16.0"
  },
  "devDependencies": {
    "@midwayjs/cli": "^2.1.0",
    "@types/node": "^20.10.0",
    "@types/ws": "^8.5.10",
    "cross-env": "^7.0.3",
    "typescript": "~5.3.0"
  }
}
```

### 2. 订单管理流程

```
信号接收 → 风控检查 → 订单创建 → 交易所路由 → 订单执行 → 仓位更新 → 状态同步
```

### 3. 订单生命周期

```typescript
enum OrderStatus {
  PENDING = 'pending',      // 待处理
  OPEN = 'open',            // 已发送交易所
  PARTIALLY_FILLED = 'partially_filled',  // 部分成交
  FILLED = 'filled',        // 完全成交
  CANCELLED = 'cancelled',  // 已取消
  REJECTED = 'rejected',    // 已拒绝
  EXPIRED = 'expired',      // 已过期
  ERROR = 'error'           // 错误
}
```

## 核心模块详解

### 1. 订单管理器 (OrderManager)

```typescript
class OrderManager {
  private orders: Map<string, Order> = new Map();
  private pendingOrders: Order[] = [];
  private activeOrders: Order[] = [];

  // 创建订单
  async createOrder(order: Order): Promise<Order> {
    // 1. 风控检查
    await this.riskChecker.check(order);

    // 2. 生成订单ID
    const orderId = this.generateOrderId(order);

    // 3. 保存到数据库
    await this.orderRepository.save({ ...order, id: orderId });

    // 4. 发送到交易所
    const exchangeOrder = await this.exchangeAdapter.createOrder(order);

    // 5. 更新订单状态
    await this.updateOrderStatus(orderId, OrderStatus.OPEN);

    return { ...order, id: orderId };
  }

  // 取消订单
  async cancelOrder(orderId: string): Promise<boolean> {
    const order = await this.getOrder(orderId);
    if (!order) return false;

    // 发送取消请求
    await this.exchangeAdapter.cancelOrder(order);

    // 更新状态
    await this.updateOrderStatus(orderId, OrderStatus.CANCELLED);

    return true;
  }

  // 批量取消
  async cancelAllOrders(symbol?: string): Promise<number> {
    const orders = await this.getActiveOrders(symbol);
    let cancelled = 0;

    for (const order of orders) {
      try {
        await this.cancelOrder(order.id);
        cancelled++;
      } catch (error) {
        logger.error(`Failed to cancel order ${order.id}:`, error);
      }
    }

    return cancelled;
  }

  // 查询订单
  async getOrder(orderId: string): Promise<Order | null> {
    return this.orderRepository.findOne({ where: { id: orderId } });
  }

  // 获取订单列表
  async getOrders(filter: OrderFilter): Promise<Order[]> {
    return this.orderRepository.find({
      where: this.buildFilter(filter),
      order: { created_at: 'DESC' },
      take: filter.limit || 100,
      skip: (filter.page || 0) * (filter.limit || 100)
    });
  }
}
```

### 2. 仓位管理器 (PositionManager)

```typescript
class PositionManager {
  private positions: Map<string, Position> = new Map();

  // 更新仓位
  async updatePosition(order: Order): Promise<Position> {
    const symbol = order.symbol;
    let position = await this.getPosition(symbol);

    if (!position) {
      position = this.createEmptyPosition(symbol);
    }

    // 根据订单类型更新仓位
    switch (order.side) {
      case 'buy':
        position.long_quantity += order.filled_quantity;
        position.long_cost += order.filled_quantity * order.filled_price;
        break;
      case 'sell':
        position.short_quantity += order.filled_quantity;
        position.short_cost += order.filled_quantity * order.filled_price;
        break;
    }

    // 计算盈亏
    position = this.calculatePNL(position);

    // 保存到数据库
    await this.positionRepository.save(position);

    return position;
  }

  // 计算盈亏
  private calculatePNL(position: Position): Position {
    const currentPrice = this.getCurrentPrice(position.symbol);

    // 多头盈亏
    position.long_pnl = position.long_quantity > 0
      ? (currentPrice - position.long_cost / position.long_quantity) * position.long_quantity
      : 0;

    // 空头盈亏
    position.short_pnl = position.short_quantity > 0
      ? (position.short_cost / position.short_quantity - currentPrice) * position.short_quantity
      : 0;

    // 总盈亏
    position.total_pnl = position.long_pnl + position.short_pnl;

    // 持仓价值
    position.position_value = position.long_quantity * currentPrice + position.short_quantity * currentPrice;

    return position;
  }

  // 获取仓位
  async getPosition(symbol: string): Promise<Position | null> {
    return this.positionRepository.findOne({ where: { symbol } });
  }

  // 获取所有仓位
  async getAllPositions(): Promise<Position[]> {
    return this.positionRepository.find({ where: { is_active: true } });
  }

  // 仓位平仓
  async closePosition(symbol: string, side: 'long' | 'short' | 'all'): Promise<boolean> {
    const position = await this.getPosition(symbol);
    if (!position) return false;

    // 生成平仓订单
    const closeOrder = this.generateCloseOrder(position, side);

    // 发送平仓订单
    await this.orderManager.createOrder(closeOrder);

    return true;
  }
}
```

### 3. 风控检查器 (RiskChecker)

```typescript
class RiskChecker {
  // 检查订单是否符合风控规则
  async check(order: Order): Promise<void> {
    // 1. 检查仓位限制
    await this.checkPositionLimit(order);

    // 2. 检查单日交易限额
    await this.checkDailyLimit(order);

    // 3. 检查最大回撤
    await this.checkMaxDrawdown(order);

    // 4. 检查黑名单
    await this.checkBlacklist(order);

    // 5. 检查交易所限制
    await this.checkExchangeLimits(order);
  }

  // 检查仓位限制
  private async checkPositionLimit(order: Order): Promise<void> {
    const position = await this.positionManager.getPosition(order.symbol);
    const maxPositionPct = this.config.risk.max_position_pct;

    if (position) {
      const currentPositionValue = position.position_value;
      const orderValue = order.quantity * order.price;
      const totalValue = currentPositionValue + orderValue;

      if (totalValue / this.account.balance > maxPositionPct) {
        throw new RiskError(`仓位超过限制: ${maxPositionPct * 100}%`);
      }
    }
  }

  // 检查单日交易限额
  private async checkDailyLimit(order: Order): Promise<void> {
    const today = new Date().toISOString().split('T')[0];
    const dailyVolume = await this.tradeService.getDailyVolume(today);

    if (dailyVolume + order.quantity * order.price > this.config.risk.max_daily_volume) {
      throw new RiskError(`单日交易量超过限制`);
    }
  }

  // 检查最大回撤
  private async checkMaxDrawdown(order: Order): Promise<void> {
    const account = await this.accountService.getAccount();
    const maxDrawdown = this.config.risk.max_drawdown;

    if (account.drawdown < -maxDrawdown) {
      throw new RiskError(`回撤超过限制: ${maxDrawdown * 100}%`);
    }
  }
}
```

### 4. 信号处理器 (SignalProcessor)

```typescript
class SignalProcessor {
  // 处理信号
  async processSignal(signal: Signal): Promise<void> {
    logger.info(`Processing signal: ${signal.id}`);

    try {
      // 1. 验证信号
      await this.validateSignal(signal);

      // 2. 转换为订单
      const order = this.signalToOrder(signal);

      // 3. 风控检查
      await this.riskChecker.check(order);

      // 4. 创建订单
      const createdOrder = await this.orderManager.createOrder(order);

      // 5. 更新信号状态
      await this.updateSignalStatus(signal.id, 'completed');

      // 6. 发布订单事件
      await this.publishOrderEvent(createdOrder);

      logger.info(`Signal processed successfully: ${signal.id}`);
    } catch (error) {
      logger.error(`Failed to process signal ${signal.id}:`, error);

      // 更新信号状态为失败
      await this.updateSignalStatus(signal.id, 'rejected', error.message);
    }
  }

  // 信号转订单
  private signalToOrder(signal: Signal): Order {
    return {
      id: this.generateOrderId(),
      symbol: signal.symbol,
      exchange: signal.exchange,
      side: this.getSideFromSignalType(signal.type),
      type: 'limit', // 或 'market'
      quantity: signal.quantity,
      price: signal.price,
      stop_loss: signal.stop_loss,
      take_profit: signal.take_profit,
      status: OrderStatus.PENDING,
      created_at: new Date(),
      metadata: signal.metadata
    };
  }

  // 获取订单方向
  private getSideFromSignalType(type: SignalType): 'buy' | 'sell' {
    switch (type) {
      case SignalType.ENTRY_LONG:
      case SignalType.EXIT_SHORT:
        return 'buy';
      case SignalType.ENTRY_SHORT:
      case SignalType.EXIT_LONG:
        return 'sell';
      default:
        throw new Error(`Unsupported signal type: ${type}`);
    }
  }
}
```

## 交易所适配器

### 1. 适配器接口

```typescript
interface IExchangeAdapter {
  // 订单操作
  createOrder(order: Order): Promise<ExchangeOrder>;
  cancelOrder(order: Order): Promise<boolean>;
  cancelAllOrders(symbol?: string): Promise<number>;
  getOrder(orderId: string): Promise<ExchangeOrder | null>;
  getOrders(symbol?: string): Promise<ExchangeOrder[]>;

  // 账户信息
  getBalance(): Promise<Balance>;
  getPositions(): Promise<Position[]>;

  // 市场数据
  getTicker(symbol: string): Promise<Ticker>;
  getDepth(symbol: string, limit?: number): Promise<Depth>;
  getOHLCV(symbol: string, timeframe: string, limit?: number): Promise<OHLCV[]>;

  // WebSocket
  connectWebSocket(): Promise<void>;
  disconnectWebSocket(): Promise<void>;
  subscribeTicker(symbol: string): Promise<void>;
  subscribeOrderBook(symbol: string): Promise<void>;
  subscribeTrades(symbol: string): Promise<void>;
}
```

### 2. Binance 适配器示例

```typescript
class BinanceAdapter implements IExchangeAdapter {
  private client: ccxt.binance;
  private ws: WebSocket | null = null;
  private subscriptions: Set<string> = new Set();

  constructor(config: ExchangeConfig) {
    this.client = new ccxt.binance({
      apiKey: config.apiKey,
      secret: config.secret,
      sandbox: config.sandbox || false,
      timeout: 30000
    });
  }

  async createOrder(order: Order): Promise<ExchangeOrder> {
    try {
      const params: any = {};

      // 设置止损止盈
      if (order.stop_loss) {
        params.stopLossPrice = order.stop_loss;
      }
      if (order.take_profit) {
        params.takeProfitPrice = order.take_profit;
      }

      const exchangeOrder = await this.client.createOrder(
        order.symbol.replace('/', ''),
        order.type,
        order.side,
        order.quantity.toString(),
        order.price?.toString(),
        params
      );

      return this.parseExchangeOrder(exchangeOrder);
    } catch (error) {
      throw new ExchangeError(`Binance order failed: ${error.message}`);
    }
  }

  async cancelOrder(order: Order): Promise<boolean> {
    try {
      await this.client.cancelOrder(order.id, order.symbol.replace('/', ''));
      return true;
    } catch (error) {
      throw new ExchangeError(`Binance cancel failed: ${error.message}`);
    }
  }

  async getBalance(): Promise<Balance> {
    const balance = await this.client.fetchBalance();
    return {
      total: balance.total,
      available: balance.free,
      used: balance.used,
      currency: 'USDT'
    };
  }

  async connectWebSocket(): Promise<void> {
    if (this.ws) {
      await this.disconnectWebSocket();
    }

    const url = this.client.sandbox ? 'wss://testnet.binance.vision/ws' : 'wss://stream.binance.com:9443/ws';

    this.ws = new WebSocket(url);

    this.ws.on('open', () => {
      logger.info('Binance WebSocket connected');
    });

    this.ws.on('message', (data: Buffer) => {
      const message = JSON.parse(data.toString());
      this.handleWebSocketMessage(message);
    });

    this.ws.on('error', (error) => {
      logger.error('Binance WebSocket error:', error);
    });

    this.ws.on('close', () => {
      logger.info('Binance WebSocket closed');
      this.ws = null;
    });
  }

  async subscribeTicker(symbol: string): Promise<void> {
    const stream = `${symbol.toLowerCase()}@ticker`;
    this.subscriptions.add(stream);

    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        method: 'SUBSCRIBE',
        params: [stream],
        id: Date.now()
      }));
    }
  }

  private handleWebSocketMessage(message: any): void {
    if (message.e === 'trade') {
      // 处理成交
      this.emit('trade', this.parseTrade(message));
    } else if (message.e === 'depthUpdate') {
      // 处理深度更新
      this.emit('depth', this.parseDepth(message));
    } else if (message.e === '24hrTicker') {
      // 处理ticker
      this.emit('ticker', this.parseTicker(message));
    }
  }
}
```

## NATS 消息订阅

### 1. 信号订阅

```typescript
class SignalSubscriber {
  private nc: NatsConnection;

  async subscribe(): Promise<void> {
    this.nc = await connect({ servers: 'nats://nats:4222' });

    // 订阅信号主题
    const subscription = this.nc.subscribe('strategy.signals.>', {
      queue: 'trading-engine'
    });

    for await (const msg of subscription) {
      try {
        const signal = JSON.parse(msg.data.toString()) as Signal;
        await this.signalProcessor.processSignal(signal);
      } catch (error) {
        logger.error('Failed to process signal:', error);
      }
    }
  }

  async unsubscribe(): Promise<void> {
    if (this.nc) {
      await this.nc.close();
    }
  }
}
```

### 2. 订单事件发布

```typescript
class OrderPublisher {
  private nc: NatsConnection;

  async publishOrderEvent(order: Order): Promise<void> {
    if (!this.nc) {
      this.nc = await connect({ servers: 'nats://nats:4222' });
    }

    const subject = `trading.orders.${order.symbol}.${order.status}`;
    await this.nc.publish(subject, JSON.stringify(order));
  }

  async publishTradeEvent(trade: Trade): Promise<void> {
    if (!this.nc) {
      this.nc = await connect({ servers: 'nats://nats:4222' });
    }

    const subject = `trading.trades.${trade.symbol}`;
    await this.nc.publish(subject, JSON.stringify(trade));
  }
}
```

## API 接口

### 1. 订单 API

#### GET /api/v1/orders
获取订单列表

**查询参数**:
- `symbol`: 交易对
- `status`: 订单状态
- `side`: 买卖方向
- `start_time`: 开始时间
- `end_time`: 结束时间
- `page`: 页码
- `limit`: 每页数量

**响应示例**:
```json
{
  "orders": [
    {
      "id": "ord_001",
      "symbol": "BTC/USDT",
      "exchange": "binance",
      "side": "buy",
      "type": "limit",
      "quantity": 0.1,
      "price": 45000,
      "filled_quantity": 0.05,
      "filled_price": 45000,
      "status": "partially_filled",
      "created_at": "2026-01-22T10:00:00Z",
      "updated_at": "2026-01-22T10:01:00Z"
    }
  ],
  "total": 1,
  "page": 0,
  "limit": 100
}
```

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
  "take_profit": 46000
}
```

#### DELETE /api/v1/orders/{orderId}
取消订单

#### DELETE /api/v1/orders
批量取消订单

**查询参数**:
- `symbol`: 交易对（可选，不传则取消所有）

### 2. 仓位 API

#### GET /api/v1/positions
获取仓位列表

**响应示例**:
```json
{
  "positions": [
    {
      "symbol": "BTC/USDT",
      "long_quantity": 0.1,
      "long_cost": 4500,
      "long_pnl": 500,
      "short_quantity": 0,
      "short_cost": 0,
      "short_pnl": 0,
      "total_pnl": 500,
      "position_value": 4500,
      "is_active": true,
      "updated_at": "2026-01-22T10:00:00Z"
    }
  ]
}
```

#### POST /api/v1/positions/close
平仓

**请求示例**:
```json
{
  "symbol": "BTC/USDT",
  "side": "long",  // long, short, all
  "quantity": 0.1
}
```

### 3. 账户 API

#### GET /api/v1/accounts
获取账户信息

**响应示例**:
```json
{
  "balance": 100000,
  "available": 95000,
  "used": 5000,
  "pnl": 5000,
  "drawdown": -0.05,
  "updated_at": "2026-01-22T10:00:00Z"
}
```

#### GET /api/v1/accounts/balance
获取余额详情

### 4. 交易 API

#### GET /api/v1/trades
获取成交记录

**查询参数**:
- `symbol`: 交易对
- `order_id`: 订单ID
- `start_time`: 开始时间
- `end_time`: 结束时间
- `page`: 页码
- `limit`: 每页数量

## 数据库设计

### 1. 订单表 (orders)

```sql
CREATE TABLE orders (
  id VARCHAR(64) PRIMARY KEY,
  symbol VARCHAR(20) NOT NULL,
  exchange VARCHAR(20) NOT NULL,
  side VARCHAR(10) NOT NULL,
  type VARCHAR(20) NOT NULL,
  quantity DECIMAL(20, 8) NOT NULL,
  price DECIMAL(20, 8),
  stop_loss DECIMAL(20, 8),
  take_profit DECIMAL(20, 8),
  filled_quantity DECIMAL(20, 8) DEFAULT 0,
  filled_price DECIMAL(20, 8),
  status VARCHAR(20) NOT NULL,
  exchange_order_id VARCHAR(64),
  error_message TEXT,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  filled_at TIMESTAMP WITH TIME ZONE,

  INDEX idx_symbol_exchange (symbol, exchange),
  INDEX idx_status (status),
  INDEX idx_created_at (created_at),
  INDEX idx_exchange_order_id (exchange_order_id)
);
```

### 2. 仓位表 (positions)

```sql
CREATE TABLE positions (
  symbol VARCHAR(20) PRIMARY KEY,
  long_quantity DECIMAL(20, 8) DEFAULT 0,
  long_cost DECIMAL(20, 8) DEFAULT 0,
  long_pnl DECIMAL(20, 8) DEFAULT 0,
  short_quantity DECIMAL(20, 8) DEFAULT 0,
  short_cost DECIMAL(20, 8) DEFAULT 0,
  short_pnl DECIMAL(20, 8) DEFAULT 0,
  total_pnl DECIMAL(20, 8) DEFAULT 0,
  position_value DECIMAL(20, 8) DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  INDEX idx_active (is_active)
);
```

### 3. 成交表 (trades)

```sql
CREATE TABLE trades (
  id VARCHAR(64) PRIMARY KEY,
  order_id VARCHAR(64) NOT NULL,
  symbol VARCHAR(20) NOT NULL,
  exchange VARCHAR(20) NOT NULL,
  side VARCHAR(10) NOT NULL,
  quantity DECIMAL(20, 8) NOT NULL,
  price DECIMAL(20, 8) NOT NULL,
  fee DECIMAL(20, 8) DEFAULT 0,
  fee_currency VARCHAR(10),
  exchange_trade_id VARCHAR(64),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  FOREIGN KEY (order_id) REFERENCES orders(id),
  INDEX idx_order_id (order_id),
  INDEX idx_symbol_exchange (symbol, exchange),
  INDEX idx_created_at (created_at)
);
```

## 配置管理

### 1. 环境配置

```typescript
// src/config/config.default.ts
import { MidwayConfig } from '@midwayjs/core';

export default {
  keys: 'trading-engine-secret-key',
  koa: {
    port: 3000,
  },

  // TypeORM 数据库配置
  typeorm: {
    dataSource: {
      default: {
        type: 'postgres',
        host: process.env.DB_HOST || 'postgres',
        port: 5432,
        database: 'trading_db',
        username: 'trading_user',
        password: process.env.DB_PASSWORD,
        synchronize: false,
        logging: false,
        entities: ['**/entity/**/*.entity{.ts,.js}'],
      },
    },
  },

  // Redis 配置
  redis: {
    client: {
      host: process.env.REDIS_HOST || 'redis',
      port: 6379,
      db: 0,
    },
  },

  // NATS 配置
  nats: {
    servers: [process.env.NATS_URL || 'nats://nats:4222'],
    subjects: {
      signals: 'strategy.signals.>',
      orders: 'trading.orders.>',
      trades: 'trading.trades.>',
    },
  },

  // 交易所配置
  exchanges: {
    binance: {
      enabled: true,
      apiKey: process.env.BINANCE_API_KEY,
      secret: process.env.BINANCE_SECRET,
      sandbox: false,
      rateLimit: 1000,
    },
    okx: {
      enabled: false,
      apiKey: process.env.OKX_API_KEY,
      secret: process.env.OKX_SECRET,
      passphrase: process.env.OKX_PASSPHRASE,
    },
  },

  // 风控配置
  risk: {
    maxPositionPct: 0.3,
    maxDailyVolume: 1000000,
    maxDrawdown: 0.2,
    maxOrdersPerMinute: 100,
  },

  // 订单配置
  order: {
    defaultType: 'limit',
    timeout: 30000,
    retryCount: 3,
    retryDelay: 1000,
  },

  // WebSocket 配置
  websocket: {
    reconnectInterval: 5000,
    pingInterval: 30000,
    timeout: 60000,
  },
} as MidwayConfig;
```

```typescript
// src/config/config.local.ts (本地开发配置)
import { MidwayConfig } from '@midwayjs/core';

export default {
  typeorm: {
    dataSource: {
      default: {
        host: 'localhost',
        logging: true,
      },
    },
  },
  redis: {
    client: {
      host: 'localhost',
    },
  },
  exchanges: {
    binance: {
      sandbox: true,
    },
  },
} as MidwayConfig;
```

### 2. 交易所配置

```typescript
// config/exchanges.ts
export const exchangeConfigs = {
  binance: {
    name: 'Binance',
    baseUrl: 'https://api.binance.com',
    wsUrl: 'wss://stream.binance.com:9443/ws',
    rateLimit: 1000,
    symbols: {
      BTCUSDT: { minQty: 0.00001, maxQty: 9000, stepSize: 0.00001 },
      ETHUSDT: { minQty: 0.00001, maxQty: 9000, stepSize: 0.00001 }
    }
  },
  okx: {
    name: 'OKX',
    baseUrl: 'https://www.okx.com',
    wsUrl: 'wss://ws.okx.com:8443/ws/v5/public',
    rateLimit: 20,
    symbols: {
      BTC-USDT: { minQty: 0.00001, maxQty: 100000, stepSize: 0.00001 }
    }
  }
};
```

## 部署

### 1. Docker 部署

```dockerfile
# Dockerfile (Midway.js)
FROM node:20-alpine AS builder

WORKDIR /app

# 安装依赖
COPY package*.json ./
RUN npm ci

# 复制源代码
COPY . .

# 构建
RUN npm run build

# 生产镜像
FROM node:20-alpine

WORKDIR /app

# 只安装生产依赖
COPY package*.json ./
RUN npm ci --only=production

# 复制构建产物
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/bootstrap.js ./

# 暴露端口
EXPOSE 3000

# 启动 Midway 应用
CMD ["node", "bootstrap.js"]
```

```javascript
// bootstrap.js - Midway 启动文件
const { Bootstrap } = require('@midwayjs/bootstrap');

Bootstrap.run();
```

### 2. Docker Compose

```yaml
# docker-compose.yml
version: '3.8'

services:
  trading-engine:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - DB_PASSWORD=${DB_PASSWORD}
      - BINANCE_API_KEY=${BINANCE_API_KEY}
      - BINANCE_SECRET=${BINANCE_SECRET}
    depends_on:
      - postgres
      - redis
      - nats
    volumes:
      - ./logs:/app/logs
      - ./data:/app/data
    restart: unless-stopped

  postgres:
    image: postgres:15
    environment:
      POSTGRES_DB: trading_db
      POSTGRES_USER: trading_user
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    volumes:
      - redis_data:/data

  nats:
    image: nats:2.9
    command: ["-js", "-m", "8222"]

volumes:
  postgres_data:
  redis_data:
```

## 监控与日志

### 1. 日志配置

```typescript
// src/utils/logger.ts
import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    // 错误日志
    new DailyRotateFile({
      filename: '/app/logs/trading-error-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      maxSize: '10m',
      maxFiles: '30d'
    }),
    // 信息日志
    new DailyRotateFile({
      filename: '/app/logs/trading-info-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      maxSize: '10m',
      maxFiles: '30d'
    })
  ]
});

// 开发环境添加控制台输出
if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.simple()
    )
  }));
}

export default logger;
```

### 2. 指标监控

```typescript
// src/utils/metrics.ts
import promClient from 'prom-client';

export const metrics = {
  // 订单指标
  ordersCreated: new promClient.Counter({
    name: 'trading_orders_created_total',
    help: 'Total number of orders created',
    labelNames: ['symbol', 'exchange', 'side']
  }),

  ordersFilled: new promClient.Counter({
    name: 'trading_orders_filled_total',
    help: 'Total number of orders filled',
    labelNames: ['symbol', 'exchange', 'side']
  }),

  ordersRejected: new promClient.Counter({
    name: 'trading_orders_rejected_total',
    help: 'Total number of orders rejected',
    labelNames: ['symbol', 'exchange', 'side', 'reason']
  }),

  // 仓位指标
  positionValue: new promClient.Gauge({
    name: 'trading_position_value',
    help: 'Current position value',
    labelNames: ['symbol']
  }),

  positionPnl: new promClient.Gauge({
    name: 'trading_position_pnl',
    help: 'Current position P&L',
    labelNames: ['symbol']
  }),

  // 账户指标
  accountBalance: new promClient.Gauge({
    name: 'trading_account_balance',
    help: 'Account balance'
  }),

  accountPnl: new promClient.Gauge({
    name: 'trading_account_pnl',
    help: 'Account P&L'
  }),

  // 性能指标
  signalProcessingTime: new promClient.Histogram({
    name: 'trading_signal_processing_time_seconds',
    help: 'Signal processing time in seconds',
    buckets: [0.01, 0.05, 0.1, 0.5, 1, 5]
  }),

  orderExecutionTime: new promClient.Histogram({
    name: 'trading_order_execution_time_seconds',
    help: 'Order execution time in seconds',
    buckets: [0.01, 0.05, 0.1, 0.5, 1, 5]
  })
};
```

## 测试

### 1. 单元测试

```bash
npm run test:unit
```

### 2. 集成测试

```bash
npm run test:integration
```

### 3. E2E 测试

```bash
npm run test:e2e
```

## 开发指南

### 1. 添加新交易所适配器

```typescript
// src/exchange/adapters/new-exchange.adapter.ts
import { IExchangeAdapter } from '../interfaces/exchange.interface';

export class NewExchangeAdapter implements IExchangeAdapter {
  // 实现接口方法
  async createOrder(order: Order): Promise<ExchangeOrder> {
    // 实现逻辑
  }

  async cancelOrder(order: Order): Promise<boolean> {
    // 实现逻辑
  }

  // ... 其他方法
}
```

### 2. 注册适配器

```typescript
// src/exchange/adapters/index.ts
import { BinanceAdapter } from './binance.adapter';
import { OkxAdapter } from './okx.adapter';
import { NewExchangeAdapter } from './new-exchange.adapter';

export const adapters = {
  binance: BinanceAdapter,
  okx: OkxAdapter,
  newExchange: NewExchangeAdapter
};
```

## 性能优化

### 1. 连接池管理
- 使用连接池管理交易所连接
- WebSocket 连接复用
- 数据库连接池

### 2. 缓存策略
- Redis 缓存账户余额
- 缓存市场数据
- 缓存订单状态

### 3. 批量处理
- 批量取消订单
- 批量查询订单
- 批量更新仓位

## 安全考虑

### 1. API 密钥管理
- 使用环境变量
- 加密存储
- 定期轮换

### 2. 访问控制
- JWT 认证
- IP 白名单
- API 速率限制

### 3. 数据安全
- 敏感信息脱敏
- 审计日志
- 数据备份

## 故障处理

### 1. 交易所连接失败
- 自动重连
- 切换备用交易所
- 降级处理

### 2. 订单执行失败
- 自动重试
- 订单状态同步
- 人工干预

### 3. 网络问题
- 超时重试
- 断线重连
- 心跳检测

## 监控告警

### 1. 系统告警
- CPU/内存使用率
- 磁盘空间
- 网络延迟

### 2. 业务告警
- 订单失败率
- 仓位异常
- 资金异常

### 3. 交易所告警
- 连接状态
- API 限流
- 服务维护

## 参考文档

- [Midway.js 文档](https://midwayjs.org/)
- [Midway.js GitHub](https://github.com/midwayjs/midway)
- [CCXT 文档](https://docs.ccxt.com/)
- [NATS 文档](https://docs.nats.io/)
- [TypeScript 文档](https://www.typescriptlang.org/docs/)

---

**维护者**: 量化团队
**版本**: 1.0.0
**最后更新**: 2026-01-22