# Exchange Service

交易下单服务 - 量化交易系统的订单执行层

## 功能

- 接收策略引擎的交易信号
- 风控前置检查 (集成 `@hquant/risk-model`)
- 交易所订单路由与执行 (集成 `@hquant/exchange-adapter`)
- 订单状态 WebSocket 实时同步
- 仓位与资金管理
- Token 鉴权机制

## 技术栈

| 类别 | 技术 | 说明 |
|------|------|------|
| 运行时 | Node.js 20+ | 运行环境 |
| 通信 | gRPC | 服务间通信 |
| 数据库 | PostgreSQL + TypeORM | 订单/仓位数据存储 |
| 缓存 | Redis + ioredis | 配置缓存、实例恢复 |
| 校验 | Zod | 参数校验 |
| 日志 | Pino | 结构化日志 |

## 项目结构

```
src/
├── config/           # 配置管理
├── database/         # TypeORM 数据库连接
├── entities/         # 数据库实体
│   ├── Account.ts    # 账户
│   ├── Order.ts      # 订单
│   └── Position.ts   # 持仓
├── grpc/             # gRPC 服务
│   ├── server.ts
│   └── handlers/
├── services/         # 业务服务
│   ├── TokenService.ts       # Token 鉴权
│   ├── ExchangeManager.ts    # 交易所实例管理
│   ├── RiskService.ts        # 风控服务
│   └── OrderService.ts       # 订单服务
├── utils/            # 工具函数
│   ├── logger.ts
│   └── redis.ts
└── index.ts          # 入口
```

## 快速开始

### 1. 环境配置

```bash
cp .env.example .env
```

编辑 `.env` 文件配置数据库和 Redis 连接信息。

### 2. 安装依赖

```bash
pnpm install
```

### 3. 启动服务

```bash
# 开发模式
pnpm dev

# 生产模式
pnpm build
pnpm start
```

服务默认监听:
- gRPC: `0.0.0.0:50051`

## 核心流程

### 初始化流程

```
应用服务 → 提供交易所 API 密钥 → Exchange Service 初始化
         ↓
    生成 Token 并缓存到 Redis
         ↓
    返回 Token 给应用服务
```

### 下单流程

```
应用服务 → Token + 下单参数 → Exchange Service
         ↓
    1. Token 验证
    2. 从内存/Redis 获取交易所实例
    3. 风控前置检查
    4. 执行下单
    5. 保存订单记录
    6. 订阅 WebSocket 订单更新
         ↓
    返回订单结果
```

### 服务重启恢复

```
服务启动 → 从数据库读取活跃账户
         ↓
    从 Redis 读取配置
         ↓
    重新初始化交易所实例
```

## gRPC 接口

### 账户管理

| 方法 | 说明 |
|------|------|
| `InitAccount` | 初始化账户，返回 Token |
| `ValidateToken` | 验证 Token 有效性 |
| `InvalidateToken` | 注销 Token |

### 订单管理

| 方法 | 说明 |
|------|------|
| `PlaceOrder` | 下单 |
| `PlaceOrders` | 批量下单 |
| `CancelOrder` | 撤单 |
| `GetOrder` | 查询订单 |
| `GetOrders` | 查询订单列表 |

### 持仓与余额

| 方法 | 说明 |
|------|------|
| `GetPositions` | 获取持仓 |
| `SyncPositions` | 同步持仓 |
| `GetBalance` | 获取余额 |

### 其他

| 方法 | 说明 |
|------|------|
| `GetPrice` | 获取行情价格 |
| `SetLeverage` | 设置杠杆 |
| `SubscribeOrders` | 订单更新流 (stream) |

## 使用示例

### Node.js 客户端

```typescript
import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';

const packageDefinition = protoLoader.loadSync('proto/exchange.proto');
const proto = grpc.loadPackageDefinition(packageDefinition) as any;

const client = new proto.exchange.ExchangeService(
  'localhost:50051',
  grpc.credentials.createInsecure()
);

// 1. 初始化账户
client.initAccount({
  exchange: 'EXCHANGE_OKX',
  apiKey: 'your-api-key',
  apiSecret: 'your-api-secret',
  passphrase: 'your-passphrase',
  demonet: true,
}, (err, response) => {
  if (response.success) {
    const token = response.token;

    // 2. 下单
    client.placeOrder({
      token,
      symbol: 'BTC-USDT',
      tradeType: 'TRADE_TYPE_FUTURES',
      side: 'ORDER_SIDE_BUY',
      orderType: 'ORDER_TYPE_LIMIT',
      quantity: 0.01,
      price: 50000,
      positionSide: 'POSITION_SIDE_LONG',
      leverage: 10,
    }, (err, orderResponse) => {
      console.log('Order:', orderResponse);
    });
  }
});
```

## 环境变量

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `GRPC_PORT` | 50051 | gRPC 端口 |
| `DB_HOST` | localhost | 数据库主机 |
| `DB_PORT` | 5432 | 数据库端口 |
| `DB_NAME` | trader | 数据库名 |
| `DB_USER` | trader_user | 数据库用户 |
| `DB_PASSWORD` | 123456 | 数据库密码 |
| `REDIS_HOST` | localhost | Redis 主机 |
| `REDIS_PORT` | 6379 | Redis 端口 |
| `DEMONET` | true | 是否使用模拟交易 |
| `RISK_ENABLED` | true | 是否启用风控 |
| `RISK_MAX_DAILY_LOSS` | 500 | 最大日亏损 |
| `RISK_MAX_MARGIN_USAGE_PCT` | 0.8 | 最大保证金使用率 |
| `LOG_LEVEL` | info | 日志级别 |

## 支持的交易所

- OKX (现货、U本位永续、币本位交割)
- Binance (现货、U本位永续、币本位交割)

## 风控规则

服务集成了 `@hquant/risk-model` 风控引擎，支持：

- **账户级风控**：最大日亏损、最大保证金使用率
- **仓位级风控**：止盈止损比例、单仓最大亏损
- **品种级覆盖**：针对特定交易对的风控规则

## License

GPL-3.0-or-later
