# Trader Service (用户交易服务 + 后台管理服务)

> 基于 Midway.js 3.x 的用户交易与后台管理服务

## 概述

trader-service 是量化交易系统的核心业务服务，负责：
- 用户认证与授权（Casdoor 集成）
- 策略绑定与风控配置
- 订单执行与仓位管理
- 交易记录与收益统计
- 后台管理功能

## 技术栈

| 技术 | 版本 | 说明 |
|------|------|------|
| Midway.js | 3.x | Node.js 企业级框架 |
| TypeORM | 0.3.x | ORM 框架 |
| PostgreSQL | 15+ | 主数据库 |
| Redis | 7+ | 缓存与会话 |
| NATS | 2.x | 消息队列 |
| Casdoor SDK | latest | 统一认证 |

## 目录结构

```
trader-service/
├── src/
│   ├── configuration.ts              # 应用配置入口
│   ├── controller/                   # 控制器
│   │   ├── user.controller.ts        # 用户管理
│   │   ├── strategy.controller.ts    # 策略管理
│   │   ├── order.controller.ts       # 订单管理
│   │   ├── position.controller.ts    # 仓位管理
│   │   ├── risk.controller.ts        # 风控配置
│   │   ├── stats.controller.ts       # 统计报表
│   │   ├── admin.controller.ts       # 后台管理
│   │   └── health.controller.ts      # 健康检查
│   ├── service/                      # 服务层
│   │   ├── user.service.ts           # 用户服务
│   │   ├── auth.service.ts           # 认证服务
│   │   ├── strategy.service.ts       # 策略服务
│   │   ├── order.service.ts          # 订单服务
│   │   ├── position.service.ts       # 仓位服务
│   │   ├── risk.service.ts           # 风控服务
│   │   ├── stats.service.ts          # 统计服务
│   │   └── notification.service.ts   # 通知服务
│   ├── entity/                       # 数据实体
│   │   ├── user.entity.ts            # 用户实体
│   │   ├── user-strategy.entity.ts   # 用户策略绑定
│   │   ├── user-exchange.entity.ts   # 用户交易所配置
│   │   ├── risk-config.entity.ts     # 风控配置
│   │   ├── order.entity.ts           # 订单记录
│   │   ├── position.entity.ts        # 持仓记录
│   │   └── trade-record.entity.ts    # 交易记录
│   ├── middleware/                   # 中间件
│   │   ├── auth.middleware.ts        # 认证中间件
│   │   └── admin.middleware.ts       # 管理员中间件
│   ├── filter/                       # 过滤器
│   │   └── exception.filter.ts       # 异常处理
│   ├── decorator/                    # 装饰器
│   │   ├── auth.decorator.ts         # 认证装饰器
│   │   └── admin.decorator.ts        # 管理员装饰器
│   ├── dto/                          # 数据传输对象
│   │   ├── user.dto.ts
│   │   ├── strategy.dto.ts
│   │   └── order.dto.ts
│   └── interface/                    # 接口定义
│       └── index.ts
├── test/                             # 测试
├── bootstrap.js                      # 启动入口
├── package.json
├── tsconfig.json
├── Dockerfile
└── docker-compose.yml
```

## 核心实现

### 1. 用户实体

```typescript
// src/entity/user.entity.ts
import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, OneToMany } from 'typeorm';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  casdoorId: string;           // Casdoor 用户ID

  @Column()
  username: string;

  @Column()
  email: string;

  @Column({ default: 'user' })
  role: 'user' | 'admin';

  @Column({ default: true })
  isActive: boolean;

  @Column('jsonb', { nullable: true })
  preferences: Record<string, any>;

  @OneToMany(() => UserStrategy, us => us.user)
  strategies: UserStrategy[];

  @OneToMany(() => UserExchange, ue => ue.user)
  exchanges: UserExchange[];

  @CreateDateColumn()
  createdAt: Date;
}
```

### 2. 用户策略绑定

```typescript
// src/entity/user-strategy.entity.ts
import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, JoinColumn } from 'typeorm';

@Entity('user_strategies')
export class UserStrategy {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  userId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column()
  strategyId: string;          // 策略引擎中的策略ID

  @Column()
  strategyName: string;

  @Column()
  exchangeId: string;          // 使用的交易所配置

  @Column('simple-array')
  symbols: string[];           // 交易标的列表

  @Column('decimal', { precision: 18, scale: 8 })
  allocation: number;          // 资金分配比例

  @Column({ default: 'stopped' })
  status: 'running' | 'stopped' | 'paused';

  @Column('jsonb', { nullable: true })
  parameters: Record<string, any>;  // 策略参数

  @Column('jsonb', { nullable: true })
  riskConfig: {
    maxPositionSize: number;
    maxDailyLoss: number;
    maxDrawdown: number;
    stopLossPercent: number;
    takeProfitPercent: number;
  };

  @Column('timestamp', { nullable: true })
  startedAt: Date;

  @Column('timestamp', { nullable: true })
  stoppedAt: Date;
}
```

### 3. 用户交易所配置

```typescript
// src/entity/user-exchange.entity.ts
import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, JoinColumn } from 'typeorm';

@Entity('user_exchanges')
export class UserExchange {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  userId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column()
  exchangeType: 'binance' | 'okx' | 'huobi';

  @Column()
  name: string;                // 配置名称

  @Column({ type: 'text' })
  apiKeyEncrypted: string;     // 加密存储

  @Column({ type: 'text' })
  apiSecretEncrypted: string;  // 加密存储

  @Column({ nullable: true })
  passphrase: string;          // OKX 需要

  @Column({ default: false })
  isTestnet: boolean;

  @Column({ default: true })
  isActive: boolean;

  @Column('jsonb', { nullable: true })
  permissions: string[];       // 权限列表
}
```

### 4. 认证服务 (Casdoor)

```typescript
// src/service/auth.service.ts
import { Provide, Inject, Config } from '@midwayjs/core';
import { SDK as CasdoorSDK } from 'casdoor-nodejs-sdk';

@Provide()
export class AuthService {
  @Config('casdoor')
  casdoorConfig: any;

  private sdk: CasdoorSDK;

  @Init()
  async init() {
    this.sdk = new CasdoorSDK({
      serverUrl: this.casdoorConfig.endpoint,
      clientId: this.casdoorConfig.clientId,
      clientSecret: this.casdoorConfig.clientSecret,
      certificate: this.casdoorConfig.certificate,
      orgName: this.casdoorConfig.orgName,
      appName: this.casdoorConfig.appName,
    });
  }

  // 验证 Token
  async verifyToken(token: string): Promise<any> {
    try {
      const claims = await this.sdk.parseJwtToken(token);
      return claims;
    } catch (error) {
      throw new UnauthorizedError('Invalid token');
    }
  }

  // 获取用户信息
  async getUserInfo(token: string): Promise<any> {
    const userInfo = await this.sdk.getUserInfo(token);
    return userInfo;
  }

  // 刷新 Token
  async refreshToken(refreshToken: string): Promise<any> {
    const tokens = await this.sdk.refreshToken(refreshToken);
    return tokens;
  }

  // 获取登录 URL
  getLoginUrl(redirectUri: string, state: string): string {
    return this.sdk.getSigninUrl(redirectUri, state);
  }

  // 通过授权码获取 Token
  async getTokenByCode(code: string, redirectUri: string): Promise<any> {
    const tokens = await this.sdk.getOAuthToken(code, redirectUri);
    return tokens;
  }
}
```

### 5. 认证中间件

```typescript
// src/middleware/auth.middleware.ts
import { Middleware, IMiddleware, Inject } from '@midwayjs/core';
import { Context, NextFunction } from '@midwayjs/koa';
import { AuthService } from '../service/auth.service';
import { UserService } from '../service/user.service';

@Middleware()
export class AuthMiddleware implements IMiddleware<Context, NextFunction> {
  @Inject()
  authService: AuthService;

  @Inject()
  userService: UserService;

  resolve() {
    return async (ctx: Context, next: NextFunction) => {
      const token = ctx.get('Authorization')?.replace('Bearer ', '');

      if (!token) {
        ctx.status = 401;
        ctx.body = { error: 'Unauthorized' };
        return;
      }

      try {
        const claims = await this.authService.verifyToken(token);

        // 获取或创建本地用户
        let user = await this.userService.findByCasdoorId(claims.sub);
        if (!user) {
          user = await this.userService.createFromCasdoor(claims);
        }

        ctx.user = user;
        await next();
      } catch (error) {
        ctx.status = 401;
        ctx.body = { error: 'Invalid token' };
      }
    };
  }

  static getName(): string {
    return 'auth';
  }
}
```

### 6. 策略服务

```typescript
// src/service/strategy.service.ts
import { Provide, Inject } from '@midwayjs/core';
import { InjectEntityModel } from '@midwayjs/typeorm';
import { Repository } from 'typeorm';
import { UserStrategy } from '../entity/user-strategy.entity';
import { NatsService } from './nats.service';

@Provide()
export class StrategyService {
  @InjectEntityModel(UserStrategy)
  userStrategyRepo: Repository<UserStrategy>;

  @Inject()
  natsService: NatsService;

  // 绑定策略
  async bindStrategy(userId: string, dto: BindStrategyDto): Promise<UserStrategy> {
    const userStrategy = this.userStrategyRepo.create({
      userId,
      strategyId: dto.strategyId,
      strategyName: dto.strategyName,
      exchangeId: dto.exchangeId,
      symbols: dto.symbols,
      allocation: dto.allocation,
      parameters: dto.parameters,
      riskConfig: dto.riskConfig,
      status: 'stopped',
    });

    return this.userStrategyRepo.save(userStrategy);
  }

  // 启动策略
  async startStrategy(userId: string, userStrategyId: string): Promise<void> {
    const userStrategy = await this.userStrategyRepo.findOne({
      where: { id: userStrategyId, userId },
    });

    if (!userStrategy) {
      throw new Error('Strategy binding not found');
    }

    // 发送启动指令到策略引擎
    await this.natsService.publish('strategy.command.start', {
      userStrategyId: userStrategy.id,
      userId,
      strategyId: userStrategy.strategyId,
      symbols: userStrategy.symbols,
      parameters: userStrategy.parameters,
      riskConfig: userStrategy.riskConfig,
    });

    // 更新状态
    await this.userStrategyRepo.update(userStrategyId, {
      status: 'running',
      startedAt: new Date(),
    });
  }

  // 停止策略
  async stopStrategy(userId: string, userStrategyId: string): Promise<void> {
    await this.natsService.publish('strategy.command.stop', {
      userStrategyId,
      userId,
    });

    await this.userStrategyRepo.update(userStrategyId, {
      status: 'stopped',
      stoppedAt: new Date(),
    });
  }

  // 获取用户策略列表
  async getUserStrategies(userId: string): Promise<UserStrategy[]> {
    return this.userStrategyRepo.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });
  }
}
```

### 7. 订单服务

```typescript
// src/service/order.service.ts
import { Provide, Inject } from '@midwayjs/core';
import { InjectEntityModel } from '@midwayjs/typeorm';
import { Repository } from 'typeorm';
import { Order } from '../entity/order.entity';
import { NatsService } from './nats.service';

@Provide()
export class OrderService {
  @InjectEntityModel(Order)
  orderRepo: Repository<Order>;

  @Inject()
  natsService: NatsService;

  // 订阅订单更新
  async subscribeOrderUpdates() {
    await this.natsService.subscribe('order.updates.>', async (msg) => {
      const orderData = JSON.parse(msg.data.toString());
      await this.handleOrderUpdate(orderData);
    });
  }

  // 处理订单更新
  async handleOrderUpdate(orderData: any): Promise<void> {
    const order = await this.orderRepo.findOne({
      where: { exchangeOrderId: orderData.orderId },
    });

    if (order) {
      await this.orderRepo.update(order.id, {
        status: orderData.status,
        filledQty: orderData.filledQty,
        avgPrice: orderData.avgPrice,
        updatedAt: new Date(),
      });

      // 通知用户
      await this.natsService.publish(`user.${order.userId}.orders`, {
        type: 'order_update',
        order: { ...order, ...orderData },
      });
    }
  }

  // 查询用户订单
  async getUserOrders(userId: string, query: OrderQueryDto): Promise<{
    orders: Order[];
    total: number;
  }> {
    const [orders, total] = await this.orderRepo.findAndCount({
      where: {
        userId,
        ...(query.status && { status: query.status }),
        ...(query.symbol && { symbol: query.symbol }),
      },
      order: { createdAt: 'DESC' },
      skip: query.offset || 0,
      take: query.limit || 20,
    });

    return { orders, total };
  }

  // 手动下单
  async createManualOrder(userId: string, dto: CreateOrderDto): Promise<Order> {
    const order = this.orderRepo.create({
      userId,
      exchangeId: dto.exchangeId,
      symbol: dto.symbol,
      side: dto.side,
      type: dto.type,
      quantity: dto.quantity,
      price: dto.price,
      status: 'pending',
      source: 'manual',
    });

    const savedOrder = await this.orderRepo.save(order);

    // 发送到交易服务执行
    await this.natsService.publish('order.execute', {
      orderId: savedOrder.id,
      userId,
      ...dto,
    });

    return savedOrder;
  }
}
```

### 8. 仓位服务

```typescript
// src/service/position.service.ts
import { Provide, Inject } from '@midwayjs/core';
import { InjectEntityModel } from '@midwayjs/typeorm';
import { Repository } from 'typeorm';
import { Position } from '../entity/position.entity';
import { NatsService } from './nats.service';

@Provide()
export class PositionService {
  @InjectEntityModel(Position)
  positionRepo: Repository<Position>;

  @Inject()
  natsService: NatsService;

  // 订阅仓位更新
  async subscribePositionUpdates() {
    await this.natsService.subscribe('position.updates.>', async (msg) => {
      const positionData = JSON.parse(msg.data.toString());
      await this.handlePositionUpdate(positionData);
    });
  }

  // 处理仓位更新
  async handlePositionUpdate(data: any): Promise<void> {
    let position = await this.positionRepo.findOne({
      where: {
        userId: data.userId,
        exchangeId: data.exchangeId,
        symbol: data.symbol,
      },
    });

    if (position) {
      await this.positionRepo.update(position.id, {
        quantity: data.quantity,
        avgPrice: data.avgPrice,
        unrealizedPnl: data.unrealizedPnl,
        updatedAt: new Date(),
      });
    } else {
      position = this.positionRepo.create({
        userId: data.userId,
        exchangeId: data.exchangeId,
        symbol: data.symbol,
        quantity: data.quantity,
        avgPrice: data.avgPrice,
        side: data.side,
      });
      await this.positionRepo.save(position);
    }

    // 通知用户
    await this.natsService.publish(`user.${data.userId}.positions`, {
      type: 'position_update',
      position: data,
    });
  }

  // 获取用户仓位
  async getUserPositions(userId: string): Promise<Position[]> {
    return this.positionRepo.find({
      where: { userId, quantity: Not(0) },
      order: { updatedAt: 'DESC' },
    });
  }

  // 获取仓位汇总
  async getPositionSummary(userId: string): Promise<{
    totalValue: number;
    totalPnl: number;
    totalPnlPercent: number;
  }> {
    const positions = await this.getUserPositions(userId);

    const totalValue = positions.reduce((sum, p) =>
      sum + p.quantity * p.currentPrice, 0);
    const totalPnl = positions.reduce((sum, p) =>
      sum + p.unrealizedPnl, 0);
    const totalCost = positions.reduce((sum, p) =>
      sum + p.quantity * p.avgPrice, 0);

    return {
      totalValue,
      totalPnl,
      totalPnlPercent: totalCost > 0 ? (totalPnl / totalCost) * 100 : 0,
    };
  }
}
```

### 9. 统计服务

```typescript
// src/service/stats.service.ts
import { Provide, Inject } from '@midwayjs/core';
import { InjectEntityModel } from '@midwayjs/typeorm';
import { Repository, Between } from 'typeorm';
import { TradeRecord } from '../entity/trade-record.entity';
import { Order } from '../entity/order.entity';

@Provide()
export class StatsService {
  @InjectEntityModel(TradeRecord)
  tradeRecordRepo: Repository<TradeRecord>;

  @InjectEntityModel(Order)
  orderRepo: Repository<Order>;

  // 获取策略收益统计
  async getStrategyStats(userId: string, userStrategyId: string, period: string): Promise<{
    totalReturn: number;
    returnPercent: number;
    buyCount: number;
    sellCount: number;
    winRate: number;
    maxDrawdown: number;
    sharpeRatio: number;
  }> {
    const dateRange = this.getDateRange(period);

    const trades = await this.tradeRecordRepo.find({
      where: {
        userId,
        userStrategyId,
        createdAt: Between(dateRange.start, dateRange.end),
      },
      order: { createdAt: 'ASC' },
    });

    const orders = await this.orderRepo.find({
      where: {
        userId,
        userStrategyId,
        status: 'filled',
        createdAt: Between(dateRange.start, dateRange.end),
      },
    });

    const buyCount = orders.filter(o => o.side === 'buy').length;
    const sellCount = orders.filter(o => o.side === 'sell').length;

    const totalReturn = trades.reduce((sum, t) => sum + t.realizedPnl, 0);
    const initialCapital = trades[0]?.capital || 0;
    const returnPercent = initialCapital > 0
      ? (totalReturn / initialCapital) * 100
      : 0;

    const winningTrades = trades.filter(t => t.realizedPnl > 0).length;
    const winRate = trades.length > 0
      ? (winningTrades / trades.length) * 100
      : 0;

    const maxDrawdown = this.calculateMaxDrawdown(trades);
    const sharpeRatio = this.calculateSharpeRatio(trades);

    return {
      totalReturn,
      returnPercent,
      buyCount,
      sellCount,
      winRate,
      maxDrawdown,
      sharpeRatio,
    };
  }

  // 获取用户总体统计
  async getUserOverallStats(userId: string): Promise<{
    totalPnl: number;
    todayPnl: number;
    weekPnl: number;
    monthPnl: number;
    activeStrategies: number;
    totalTrades: number;
  }> {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
    const monthAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);

    const [totalPnl, todayPnl, weekPnl, monthPnl, totalTrades] = await Promise.all([
      this.getPnlSum(userId),
      this.getPnlSum(userId, today),
      this.getPnlSum(userId, weekAgo),
      this.getPnlSum(userId, monthAgo),
      this.orderRepo.count({ where: { userId, status: 'filled' } }),
    ]);

    return {
      totalPnl,
      todayPnl,
      weekPnl,
      monthPnl,
      activeStrategies: 0, // 从策略服务获取
      totalTrades,
    };
  }

  private calculateMaxDrawdown(trades: TradeRecord[]): number {
    let peak = 0;
    let maxDrawdown = 0;
    let cumReturn = 0;

    for (const trade of trades) {
      cumReturn += trade.realizedPnl;
      if (cumReturn > peak) {
        peak = cumReturn;
      }
      const drawdown = peak > 0 ? (peak - cumReturn) / peak : 0;
      if (drawdown > maxDrawdown) {
        maxDrawdown = drawdown;
      }
    }

    return maxDrawdown * 100;
  }

  private calculateSharpeRatio(trades: TradeRecord[]): number {
    if (trades.length < 2) return 0;

    const returns = trades.map(t => t.returnPercent);
    const avgReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
    const variance = returns.reduce((sum, r) =>
      sum + Math.pow(r - avgReturn, 2), 0) / returns.length;
    const stdDev = Math.sqrt(variance);

    const riskFreeRate = 0.02 / 252; // 年化2%无风险利率，按日
    return stdDev > 0 ? (avgReturn - riskFreeRate) / stdDev * Math.sqrt(252) : 0;
  }
}
```

### 10. 通知服务

```typescript
// src/service/notification.service.ts
import { Provide, Inject } from '@midwayjs/core';
import { NatsService } from './nats.service';
import { RedisService } from '@midwayjs/redis';

@Provide()
export class NotificationService {
  @Inject()
  natsService: NatsService;

  @Inject()
  redisService: RedisService;

  // 发送订单通知
  async sendOrderNotification(userId: string, order: any): Promise<void> {
    const notification = {
      type: 'order',
      title: `订单${order.status === 'filled' ? '成交' : '更新'}`,
      message: `${order.symbol} ${order.side} ${order.filledQty}@${order.avgPrice}`,
      data: order,
      timestamp: new Date().toISOString(),
    };

    // 推送到 NATS (WebSocket 订阅)
    await this.natsService.publish(`user.${userId}.notifications`, notification);

    // 存储到 Redis 通知列表
    await this.redisService.lpush(
      `notifications:${userId}`,
      JSON.stringify(notification)
    );
    await this.redisService.ltrim(`notifications:${userId}`, 0, 99);
  }

  // 发送风控告警
  async sendRiskAlert(userId: string, alert: {
    type: string;
    level: 'warning' | 'danger';
    message: string;
  }): Promise<void> {
    const notification = {
      type: 'risk_alert',
      ...alert,
      timestamp: new Date().toISOString(),
    };

    await this.natsService.publish(`user.${userId}.alerts`, notification);
  }

  // 获取未读通知
  async getNotifications(userId: string, limit = 20): Promise<any[]> {
    const notifications = await this.redisService.lrange(
      `notifications:${userId}`,
      0,
      limit - 1
    );
    return notifications.map(n => JSON.parse(n));
  }
}
```

## API 接口

### 认证接口

```typescript
// src/controller/auth.controller.ts
@Controller('/api/auth')
export class AuthController {
  @Get('/login')              // 获取登录 URL
  @Post('/callback')          // OAuth 回调
  @Post('/refresh')           // 刷新 Token
  @Post('/logout')            // 登出
}
```

### 用户接口

```typescript
// src/controller/user.controller.ts
@Controller('/api/user')
export class UserController {
  @Get('/profile')            // 获取用户信息
  @Put('/profile')            // 更新用户信息
  @Get('/preferences')        // 获取偏好设置
  @Put('/preferences')        // 更新偏好设置
}
```

### 交易所配置接口

```typescript
// src/controller/exchange.controller.ts
@Controller('/api/exchanges')
export class ExchangeController {
  @Get('/')                   // 获取交易所配置列表
  @Post('/')                  // 添加交易所配置
  @Put('/:id')                // 更新交易所配置
  @Del('/:id')                // 删除交易所配置
  @Post('/:id/test')          // 测试连接
}
```

### 策略接口

```typescript
// src/controller/strategy.controller.ts
@Controller('/api/strategies')
export class StrategyController {
  @Get('/available')          // 获取可用策略列表
  @Get('/bindings')           // 获取用户绑定的策略
  @Post('/bind')              // 绑定策略
  @Put('/bindings/:id')       // 更新策略配置
  @Del('/bindings/:id')       // 解绑策略
  @Post('/bindings/:id/start') // 启动策略
  @Post('/bindings/:id/stop')  // 停止策略
  @Get('/bindings/:id/stats')  // 获取策略统计
}
```

### 订单接口

```typescript
// src/controller/order.controller.ts
@Controller('/api/orders')
export class OrderController {
  @Get('/')                   // 获取订单列表
  @Get('/:id')                // 获取订单详情
  @Post('/')                  // 手动下单
  @Post('/:id/cancel')        // 取消订单
}
```

### 仓位接口

```typescript
// src/controller/position.controller.ts
@Controller('/api/positions')
export class PositionController {
  @Get('/')                   // 获取持仓列表
  @Get('/summary')            // 获取持仓汇总
  @Post('/:id/close')         // 平仓
}
```

### 统计接口

```typescript
// src/controller/stats.controller.ts
@Controller('/api/stats')
export class StatsController {
  @Get('/overview')           // 获取总览统计
  @Get('/pnl')                // 获取收益曲线
  @Get('/trades')             // 获取交易记录
  @Get('/strategies/:id')     // 获取策略统计
}
```

### 后台管理接口

```typescript
// src/controller/admin.controller.ts
@Controller('/api/admin')
export class AdminController {
  @Get('/users')              // 获取用户列表
  @Get('/users/:id')          // 获取用户详情
  @Put('/users/:id/status')   // 更新用户状态
  @Get('/strategies')         // 获取所有策略统计
  @Get('/orders')             // 获取所有订单
  @Get('/system/stats')       // 系统统计
}
```

## 配置

### 应用配置

```typescript
// src/config/config.default.ts
import { MidwayConfig } from '@midwayjs/core';

export default {
  keys: 'trader-service-secret-key',
  koa: {
    port: 9103,
  },
  typeorm: {
    dataSource: {
      default: {
        type: 'postgres',
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT) || 15000,
        username: process.env.DB_USER || 'postgres',
        password: process.env.DB_PASS || 'postgres',
        database: process.env.DB_NAME || 'trader',
        synchronize: false,
        logging: false,
        entities: ['**/entity/*.entity{.ts,.js}'],
      },
    },
  },
  redis: {
    client: {
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT) || 16000,
      password: process.env.REDIS_PASS,
      db: 0,
    },
  },
  nats: {
    servers: process.env.NATS_URL || 'nats://localhost:16001',
    user: process.env.NATS_USER || 'trader_user',
    pass: process.env.NATS_PASS || 'p123456',
  },
  casdoor: {
    endpoint: process.env.CASDOOR_ENDPOINT || 'https://auth.example.com',
    clientId: process.env.CASDOOR_CLIENT_ID,
    clientSecret: process.env.CASDOOR_CLIENT_SECRET,
    certificate: process.env.CASDOOR_CERTIFICATE,
    orgName: process.env.CASDOOR_ORG_NAME || 'built-in',
    appName: process.env.CASDOOR_APP_NAME || 'trader',
  },
  encryption: {
    algorithm: 'aes-256-gcm',
    secretKey: process.env.ENCRYPTION_KEY,
  },
} as MidwayConfig;
```

## 数据加密

```typescript
// src/utils/encryption.ts
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

export class EncryptionUtil {
  private algorithm = 'aes-256-gcm';
  private secretKey: Buffer;

  constructor(secretKey: string) {
    this.secretKey = Buffer.from(secretKey, 'hex');
  }

  encrypt(text: string): string {
    const iv = randomBytes(16);
    const cipher = createCipheriv(this.algorithm, this.secretKey, iv);

    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    const authTag = cipher.getAuthTag();

    return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
  }

  decrypt(encryptedText: string): string {
    const [ivHex, authTagHex, encrypted] = encryptedText.split(':');

    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    const decipher = createDecipheriv(this.algorithm, this.secretKey, iv);

    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  }
}
```

## Docker 部署

### Dockerfile

```dockerfile
FROM node:20-alpine

WORKDIR /app

COPY package.json pnpm-lock.yaml ./
COPY node_modules ./node_modules
COPY dist ./dist
COPY bootstrap.js ./

ENV NODE_ENV=production
ENV TZ=Asia/Shanghai

EXPOSE 9103

CMD ["node", "bootstrap.js"]
```

### docker-compose.yml

```yaml
version: '3.8'

services:
  trader-service:
    build: .
    container_name: trader-service
    ports:
      - "9103:9103"
    environment:
      - NODE_ENV=production
      - DB_HOST=postgres
      - DB_PORT=5432
      - REDIS_HOST=redis
      - REDIS_PORT=6379
      - NATS_URL=nats://nats:4222
    volumes:
      - ./config:/app/config
      - ./logs:/app/logs
    depends_on:
      - postgres
      - redis
      - nats
    networks:
      - shared_network
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:9103/health"]
      interval: 30s
      timeout: 10s
      retries: 3

networks:
  shared_network:
    external: true
```

## 健康检查

```typescript
// src/controller/health.controller.ts
import { Controller, Get, Inject } from '@midwayjs/core';
import { RedisService } from '@midwayjs/redis';

@Controller('/health')
export class HealthController {
  @Inject()
  redisService: RedisService;

  @Get('/')
  async check() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      service: 'trader-service',
      version: '1.0.0',
    };
  }

  @Get('/ready')
  async readiness() {
    const checks = [];

    // Redis 检查
    try {
      await this.redisService.ping();
      checks.push({ name: 'redis', status: 'ok' });
    } catch (e) {
      checks.push({ name: 'redis', status: 'error', message: e.message });
    }

    // 数据库检查由 TypeORM 自动管理

    const allOk = checks.every(c => c.status === 'ok');
    return {
      status: allOk ? 'ok' : 'error',
      checks,
    };
  }
}
```

## 参考文档

- [Midway.js 文档](https://midwayjs.org/docs/intro)
- [Casdoor Node.js SDK](https://github.com/casdoor/casdoor-nodejs-sdk)
- [TypeORM 文档](https://typeorm.io/)
- [NATS 文档](https://docs.nats.io/)

---

**版本**: 1.0.0
**端口**: 9103
**最后更新**: 2026-01-23
