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
│   │   ├── strategy-order.controller.ts    # 策略订单管理
│   │   ├── order.controller.ts       # 订单管理
│   │   ├── risk.controller.ts        # 风控配置
│   │   ├── admin.controller.ts       # 后台管理
│   │   └── health.controller.ts      # 健康检查
│   ├── service/                      # 服务层
│   │   ├── user.service.ts           # 用户服务
│   │   ├── auth.service.ts           # 认证服务
│   │   ├── strategy.service.ts       # 策略服务
│   │   ├── strategy-order.service.ts # 策略订单服务
│   │   ├── order.service.ts          # 订单服务
│   │   ├── risk.service.ts           # 风控服务
│   │   └── notification.service.ts   # 通知服务
│   ├── entity/                       # 数据实体
│   │   ├── user.entity.ts            # 用户实体
│   │   ├── strategy-order.entity.ts  # 用户策略订单绑定
│   │   ├── user-exchange.entity.ts   # 用户交易所配置
│   │   ├── risk-config.entity.ts     # 风控配置
│   │   ├── order.entity.ts           # 订单记录
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
│   │   ├── strategy.dto.ts
│   │   └── strategy-order.dto.ts
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
  @PrimaryGeneratedColumn('increment')
  id: number;

  @Column({ unique: true })
  casdoorId: string;           // Casdoor 用户ID

  @Column()
  username: string;

  @Column({ default: 'user' })
  role: 'user' | 'admin';

  @Column({ default: true })
  isActive: boolean;

  @OneToMany(() => UserExchange, ue => ue.user)
  exchanges: UserExchange[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
```

### 2. 用户策略绑定

```typescript
// src/entity/strategy-order.entity.ts
import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, JoinColumn } from 'typeorm';
import { RiskConfig } from '@auto-trader/risk-model';

@Entity('strategy_order')
export class StrategyOrder {
  @PrimaryGeneratedColumn('increment')
  id: number;

  @Column()
  userId: number;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column()
  strategyId: string;          // 策略引擎中的策略ID

  @Column()
  strategyName: string;

  @Column()
  exchangeId: number;          // 使用的交易所配置

  @Column('simple-array')
  symbols: string[];           // 交易标的列表

  @Column({ default: 0 })
  live: 0 | 1; // 启动/停止

  @Column('jsonb', { nullable: true })
  parameters: Record<string, any>;  // 策略参数

  @Column('jsonb', { nullable: true })
  riskConfig: RiskConfig;  // 风控配置（来自 @auto-trader/risk-model）

  @Column('timestamp', { nullable: true })
  startedAt: Date;

  @Column('timestamp', { nullable: true })
  stoppedAt: Date;
}
```

**RiskConfig 结构说明**（详见 `@auto-trader/risk-model/src/types.ts`）：

```typescript
{
  // 账户级风险配置
  account: {
    maxDailyLoss: number;          // 单日最大亏损（USDT）
    maxMarginUsagePct: number;     // 最大保证金使用率 (0-1)
    onBreach: 'BLOCK_TRADING' | 'CLOSE_ALL';  // 越界行为
  },
  // 仓位级风险配置（默认）
  position: {
    stopProfitPct: number;         // 止盈比例（基于 margin 的盈亏率）
    stopLossPct: number;           // 止损比例（基于 margin 的盈亏率）
    maxLossPerPosition?: number;   // 单仓最大亏损（USDT，可选）
    onBreach: 'CLOSE_POSITION' | 'REDUCE_POSITION';  // 越界行为
    reduceRatio?: number;          // 减仓比例（仅 REDUCE_POSITION 时使用）
    cooldown: number | string;     // 风控冷却时间（毫秒或时间字符串如 "15m"）
  },
  // 品种级覆盖（可选）
  symbols?: {
    'BTCUSDT': {
      position: {
        stopProfitPct: 0.5,        // 覆盖默认止盈
        stopLossPct: 0.2,          // 覆盖默认止损
      }
    }
  }
}
```

### 3. 用户交易所配置

```typescript
// src/entity/user-exchange.entity.ts
import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, JoinColumn } from 'typeorm';

@Entity('user_exchanges')
export class UserExchange {
  @PrimaryGeneratedColumn('increment')
  id: number;

  @Column()
  userId: number;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column()
  exchangeType: 'binance' | 'okx' | 'huobi';

  @Column()
  name: string;                // 配置名称

  @Column({type: 'varchar', length: 256})
  access_key: string;     // 加密存储

  @Column({type: 'varchar', length: 256})
  secret_key: string;  // 加密存储

  @Column({ nullable: true })
  passphrase: string;          // OKX 需要

  @Column({ default: false })
  isTestnet: boolean;

  @Column({ default: true })
  isActive: boolean;
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
import { StrategyOrder } from '../entity/strategy-order.entity';
import { NatsService } from './nats.service';

@Provide()
export class StrategyService {
  @InjectEntityModel(StrategyOrder)
  strategyOrderRepo: Repository<StrategyOrder>;

  @Inject()
  natsService: NatsService;

  // 绑定策略
  async bindStrategy(userId: string, dto: BindStrategyDto): Promise<StrategyOrder> {
    const strategyOrder = this.strategyOrderRepo.create({
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

    return this.strategyOrderRepo.save(strategyOrder);
  }

  // 启动策略
  async startStrategy(userId: string, strategyOrderId: string): Promise<void> {
    const strategyOrder = await this.strategyOrderRepo.findOne({
      where: { id: strategyOrderId, userId },
    });

    if (!strategyOrder) {
      throw new Error('Strategy binding not found');
    }

    // 发送启动指令到策略引擎
    await this.natsService.publish('strategy.command.start', {
      strategyOrderId: strategyOrder.id,
      userId,
      strategyId: strategyOrder.strategyId,
      symbols: strategyOrder.symbols,
      parameters: strategyOrder.parameters,
      riskConfig: strategyOrder.riskConfig,
    });

    // 更新状态
    await this.strategyOrderRepo.update(strategyOrderId, {
      status: 'running',
      startedAt: new Date(),
    });
  }

  // 停止策略
  async stopStrategy(userId: string, strategyOrderId: string): Promise<void> {
    await this.natsService.publish('strategy.command.stop', {
      strategyOrderId,
      userId,
    });

    await this.strategyOrderRepo.update(strategyOrderId, {
      status: 'stopped',
      stoppedAt: new Date(),
    });
  }

  // 获取用户策略订单列表
  async getStrategyOrders(userId: string): Promise<StrategyOrder[]> {
    return this.strategyOrderRepo.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });
  }
}
```

### 7. 订单服务



### 8. 仓位服务



### 10. 通知服务


## API 接口

### 认证接口

### 用户接口

```typescript
// src/controller/user.controller.ts
@Controller('/api/user')
export class UserController {
  @Get('/current')            // 获取用户信息
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
