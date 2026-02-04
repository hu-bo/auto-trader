# Trader Service Node.js Implementation Plan

## 概述

基于 [trader-service Python 版本](../trader-service/README-unified.md) 的完整功能规范，使用 **Midway.js + TypeScript** 重新实现量化交易核心服务平台。

### 为什么选择 Midway.js？

**Midway.js** 是阿里巴巴开源的面向未来的云端一体 Node.js 框架，具有以下优势：

1. **企业级架构**
   - 依赖注入（IoC）容器，管理组件生命周期
   - 装饰器风格，代码简洁易维护
   - 多框架支持（Koa、Express、Egg.js、gRPC 等）

2. **TypeScript 原生支持**
   - 全面类型提示和检查
   - 更好的代码提示和重构体验
   - 与 Prisma 完美配合

3. **丰富的组件生态**
   - 官方提供 Redis、gRPC、Bull、JWT、WebSocket 等组件
   - 开箱即用，配置简单
   - 统一的组件管理方式

4. **与 Python FastAPI 相似的设计理念**
   - 装饰器路由（@Controller、@Get、@Post）
   - 依赖注入（@Inject）
   - 自动参数验证（@Validate）
   - 易于从 FastAPI 迁移

5. **性能优异**
   - 基于 Koa 的高性能 HTTP 服务器
   - 支持 Node.js 20+ 最新特性
   - ESM 模块化，启动速度快

### 项目目标

✅ 已完成：Midway.js 项目初始化（使用 CLI）
🎯 目标：实现 Python 版本的所有功能，保持 API 接口兼容

## 技术栈映射

### Python → Node.js 技术选型

| 功能模块 | Python (原版) | Node.js (目标) | 说明 |
|---------|--------------|----------------|------|
| Web 框架 | FastAPI | **Midway.js (Koa)** | 阿里开源企业级框架，支持依赖注入、装饰器 |
| 运行时 | Uvicorn | **Node.js 20+** | 原生性能优化，ESM 模式 |
| 类型系统 | Python 3.11+ | **TypeScript 5+** | 静态类型检查 |
| 数据库 ORM | SQLAlchemy | **TypeORM** | Midway 官方推荐，装饰器风格，类似 SQLAlchemy |
| 数据验证 | Pydantic | **@midwayjs/validation** (Joi) | Midway 官方验证组件 |
| gRPC 客户端 | grpcio | **@midwayjs/grpc** / **@grpc/grpc-js** | Midway gRPC 组件 |
| 消息队列 | nats-py | **nats.js** | NATS 官方 JS 客户端 |
| Redis 客户端 | redis-py | **@midwayjs/redis** (ioredis) | Midway Redis 组件 |
| 认证 | packages/casdoor-py | **@midwayjs/jwt** + **@hquant/casdoor** | JWT 中间件 |
| 量化计算 | hquant-py (Rust) | **@hquant/js** (packages/hquant-js) | Rust/napi-rs，指标/聚合/回测/DSL |
| 任务调度 | - | **@midwayjs/bull-board** (基于 Redis) | 后台任务、回测队列 |
| 日志 | logging | **@midwayjs/logger** (winston) | Midway 内置日志系统 |
| 监控 | prometheus-client | **@midwayjs/prometheus** | Midway Prometheus 组件 |
| WebSocket | - | **@midwayjs/socketio** / **@midwayjs/ws** | 实时信号推送 |

---

## 项目结构设计

```
apps/trader-service-node/
├── src/
│   ├── configuration.ts                 # Midway 主配置文件（已存在）
│   ├── interface.ts                     # 全局 TypeScript 接口定义
│   │
│   ├── config/                          # 环境配置（已存在）
│   │   ├── config.default.ts            # 默认配置
│   │   ├── config.local.ts              # 本地开发配置
│   │   ├── config.prod.ts               # 生产环境配置
│   │   └── config.unittest.ts           # 单元测试配置
│   │
│   ├── controller/                      # 控制器（已存在）
│   │   ├── api/                         # API 路由控制器
│   │   │   └── v1/
│   │   │       ├── auth.controller.ts   # 认证接口
│   │   │       ├── user.controller.ts   # 用户管理
│   │   │       ├── exchange.controller.ts # 交易所配置
│   │   │       ├── strategy.controller.ts # 策略管理
│   │   │       ├── strategy-order.controller.ts # 用户策略订单
│   │   │       ├── order.controller.ts  # 订单管理
│   │   │       ├── position.controller.ts # 持仓管理
│   │   │       ├── signal.controller.ts # 信号查询
│   │   │       ├── backtest.controller.ts # 回测接口
│   │   │       ├── stats.controller.ts  # 统计接口
│   │   │       └── admin.controller.ts  # 后台管理
│   │   └── home.controller.ts           # 首页/健康检查
│   │   │
│   ├── service/                         # 业务服务层（已存在）
│   │   ├── user.service.ts              # 用户服务
│   │   ├── exchange.service.ts          # 交易所配置服务
│   │   ├── strategy.service.ts          # 策略服务
│   │   ├── strategy-order.service.ts    # 策略订单服务
│   │   ├── order.service.ts             # 订单服务
│   │   ├── position.service.ts          # 持仓服务
│   │   ├── signal.service.ts            # 信号服务
│   │   ├── backtest.service.ts          # 回测服务
│   │   ├── stats.service.ts             # 统计服务
│   │   └── admin.service.ts             # 后台管理服务
│   │
│   ├── core/                            # 核心业务逻辑
│   │   ├── strategy/                    # 策略引擎
│   │   │   ├── base-strategy.ts         # 策略基类
│   │   │   ├── dsl-strategy.ts          # DSL 策略
│   │   │   ├── typescript-strategy.ts   # TypeScript 策略
│   │   │   ├── python-strategy.ts       # Python 策略适配器
│   │   │   └── ml-strategy.ts           # ML 策略
│   │   ├── executor/                    # 策略执行器
│   │   │   ├── strategy-manager.ts      # 策略实例管理
│   │   │   ├── strategy-executor.ts     # 执行引擎
│   │   │   ├── indicator-calculator.ts  # 技术指标计算
│   │   │   └── context.ts               # 策略上下文（K线缓存）
│   │   ├── backtest/                    # 回测引擎
│   │   │   ├── backtest-engine.ts       # 回测引擎
│   │   │   ├── performance-calculator.ts # 绩效计算
│   │   │   └── virtual-account.ts       # 虚拟账户
│   │   ├── risk/                        # 风控管理
│   │   │   ├── risk-manager.ts          # 风控管理器
│   │   │   ├── account-risk-checker.ts  # 账户级风控
│   │   │   └── position-risk-checker.ts # 仓位级风控
│   │   └── signal/                      # 信号发布
│   │       └── signal-publisher.ts      # NATS 信号发布
│   │
│   ├── middleware/                      # 中间件（已存在）
│   │   ├── auth.middleware.ts           # JWT 认证中间件
│   │   ├── logger.middleware.ts         # 日志中间件
│   │   └── error-handler.middleware.ts  # 错误处理中间件
│   │
│   ├── filter/                          # 异常过滤器（已存在）
│   │   └── default.filter.ts            # 默认异常过滤器
│   │
│   ├── decorator/                       # 自定义装饰器
│   │   ├── current-user.decorator.ts    # 当前用户装饰器
│   │   └── role.decorator.ts            # 角色权限装饰器
│   │
│   ├── guard/                           # 守卫
│   │   ├── jwt.guard.ts                 # JWT 验证守卫
│   │   └── role.guard.ts                # 角色权限守卫
│   │
│   ├── dto/                             # 数据传输对象
│   │   ├── user/                        # 用户相关 DTO
│   │   │   ├── create-user.dto.ts
│   │   │   └── update-user.dto.ts
│   │   ├── exchange/                    # 交易所 DTO
│   │   │   ├── create-exchange.dto.ts
│   │   │   └── test-connection.dto.ts
│   │   ├── strategy/                    # 策略 DTO
│   │   │   ├── create-strategy.dto.ts
│   │   │   └── strategy-params.dto.ts
│   │   ├── strategy-order/              # 策略订单 DTO
│   │   │   ├── create-strategy-order.dto.ts
│   │   │   └── risk-config.dto.ts
│   │   ├── order/                       # 订单 DTO
│   │   │   ├── place-order.dto.ts
│   │   │   └── cancel-order.dto.ts
│   │   └── backtest/                    # 回测 DTO
│   │       └── create-backtest.dto.ts
│   │
│   ├── entity/                          # 数据库实体（TypeORM Entity）
│   │   ├── user.entity.ts               # 用户实体
│   │   ├── user-exchange.entity.ts      # 交易所配置实体
│   │   ├── strategy.entity.ts           # 策略实体
│   │   ├── strategy-order.entity.ts     # 策略订单实体
│   │   ├── signal.entity.ts             # 信号实体
│   │   └── backtest.entity.ts           # 回测实体
│   │
│   ├── grpc/                            # gRPC 客户端
│   │   ├── exchange-client.service.ts   # ExchangeService 客户端
│   │   ├── protos/                      # Proto 文件（链接到 packages/contracts）
│   │   │   └── exchange.proto
│   │   └── generated/                   # 生成的类型定义
│   │       └── exchange.ts
│   │
│   ├── mq/                              # 消息队列
│   │   ├── nats.service.ts              # NATS 客户端服务
│   │   ├── subscriber/                  # 订阅者
│   │   │   └── kline.subscriber.ts      # K线数据订阅
│   │   └── publisher/                   # 发布者
│   │       └── signal.publisher.ts      # 信号发布
│   │
│   ├── queue/                           # 任务队列（Bull）
│   │   ├── backtest.processor.ts        # 回测任务处理器
│   │   └── ml-training.processor.ts     # ML 训练任务处理器
│   │
│   ├── util/                            # 工具函数
│   │   ├── encryption.util.ts           # AES 加密（API Key）
│   │   ├── cache.util.ts                # 缓存工具
│   │   └── format.util.ts               # 格式化工具
│   │
│   └── types/                           # TypeScript 类型定义
│       ├── exchange.types.ts
│       ├── strategy.types.ts
│       └── signal.types.ts
│
├── migration/                           # TypeORM 数据库迁移文件
│   └── *.ts                             # 迁移脚本
│
├── scripts/                             # 工具脚本
│   ├── generate-proto.sh                # 生成 gRPC 类型
│   └── seed.ts                          # 数据库种子脚本
│
├── test/                                # 测试（已存在）
│   ├── controller/                      # 控制器测试
│   ├── service/                         # 服务测试
│   └── fixtures/                        # 测试数据
│
├── bootstrap.js                         # Midway 启动文件（已存在）
├── .env.example                         # 环境变量示例
├── .env.local                           # 本地环境变量
├── package.json                         # 依赖配置（已存在）
├── tsconfig.json                        # TypeScript 配置（已存在）
├── .eslintrc.json                       # ESLint 配置（已存在）
├── .prettierrc.cjs                      # Prettier 配置（已存在）
├── .mocharc.json                        # Mocha 测试配置（已存在）
├── Dockerfile                           # Docker 镜像
├── docker-compose.yml                   # Docker Compose 配置
└── README.md                            # 项目说明（已存在）
```

**注意**：Midway.js 采用约定优于配置的设计，自动扫描 `src` 目录下的 Controller、Service 等组件，无需手动注册模块。

---

## 核心模块实现计划

### Phase 1: 基础设施搭建 (Week 1-2)

> 本仓库为 pnpm workspace（turbo）：文中 `npm install` 可替换为 `pnpm -C apps/trader-service-node add ...`，`npm run` 可替换为 `pnpm -C apps/trader-service-node run ...`。

#### 1.1 项目初始化 ✅
- [x] 创建 Midway.js 项目（已完成，使用 CLI 创建）
- [ ] 验证 TypeScript 配置（确保 strict mode 已启用）
- [x] Prettier + ESLint 已集成
- [ ] 配置多环境变量管理（config.default.ts, config.local.ts, config.prod.ts）
- [ ] 配置 Midway 生命周期管理（configuration.ts）

#### 1.2 数据库集成（TypeORM）
- [ ] 安装 TypeORM 组件：`npm install @midwayjs/typeorm typeorm`
- [ ] 安装 PostgreSQL 驱动：`npm install pg`
- [ ] 在 configuration.ts 中导入 TypeORM 组件
- [ ] 在 config.default.ts 中配置 TypeORM 连接信息
- [ ] 创建 Entity 实体类（参考 Python 版 SQLAlchemy 模型）
  - [ ] User 实体（src/entity/user.entity.ts）
  - [ ] UserExchange 实体（src/entity/user-exchange.entity.ts）
  - [ ] Strategy 实体（src/entity/strategy.entity.ts）
  - [ ] StrategyOrder 实体（src/entity/strategy-order.entity.ts）
  - [ ] Signal 实体（src/entity/signal.entity.ts）
  - [ ] Backtest 实体（src/entity/backtest.entity.ts）
- [ ] 配置自动同步（开发环境）或生成迁移文件（生产环境）
- [ ] 测试数据库连接

#### 1.3 Redis 集成
- [ ] 安装 Midway Redis 组件：`npm install @midwayjs/redis`
- [ ] 在 configuration.ts 中配置 Redis 组件
- [ ] 在 config.default.ts 中配置 Redis 连接信息
- [ ] 创建缓存工具类（Cache Decorator）
- [ ] 测试 Redis 连接

#### 1.4 NATS 集成
- [ ] 安装 nats.js：`npm install nats`
- [ ] 创建 NatsService（使用 `@Provide()` 装饰器）
- [ ] 实现 connect/subscribe/publish 方法
- [ ] 在 configuration.ts 中注册 NATS 生命周期（onReady 时连接）
- [ ] 定义主题命名规范（参考 Python 版）
- [ ] 创建 K线订阅器（KlineSubscriber）
- [ ] 创建信号发布器（SignalPublisher）

#### 1.5 gRPC 客户端集成
- [ ] 安装 gRPC 依赖：`npm install @midwayjs/grpc @grpc/grpc-js @grpc/proto-loader`
- [ ] 从 `packages/contracts/proto/` 链接 exchange.proto
- [ ] 生成 TypeScript 类型定义：`npm install -D grpc-tools`
- [ ] 创建 ExchangeClientService（使用 `@Provide()` 装饰器）
- [ ] 实现 gRPC 方法调用封装：
  - InitAccount
  - PlaceOrder / CancelOrder
  - GetPositions / SyncPositions
  - GetBalance
- [ ] 实现连接池管理和错误重试

---

### Phase 2: 认证与用户管理 (Week 3)

#### 2.1 认证模块
- [ ] 安装 JWT 组件：`npm install @midwayjs/jwt`
- [ ] 安装 Casdoor SDK：`npm install casdoor-nodejs-sdk`
- [ ] 在 configuration.ts 中配置 JWT 组件
- [ ] 创建 AuthService（使用 `@Provide()` 装饰器）
  - [ ] 实现 Casdoor OAuth 2.0 集成
  - [ ] 实现 OAuth 回调处理
  - [ ] 实现 JWT Token 生成与验证
- [ ] 创建 AuthController
  - [ ] GET /api/v1/auth/login - 跳转到 Casdoor 登录
  - [ ] GET /api/v1/auth/callback - OAuth 回调处理
  - [ ] POST /api/v1/auth/logout - 登出
- [ ] 创建 JWT 中间件（JwtMiddleware）验证 Token
- [ ] 创建 @CurrentUser() 装饰器（提取当前用户）

#### 2.2 用户模块
- [ ] 创建 UserService
  - [ ] 使用 `@InjectEntityModel()` 注入 User Repository
  - [ ] 实现用户信息查询（通过 TypeORM Repository）
  - [ ] 实现用户创建/更新
  - [ ] 实现角色权限管理（RBAC）
  - [ ] 实现用户状态管理（激活/禁用）
- [ ] 创建 UserController
  - [ ] GET /api/v1/user/me - 获取当前用户信息
  - [ ] PUT /api/v1/user/me - 更新用户信息
- [ ] 创建角色守卫（RoleGuard）用于权限控制

#### 2.3 交易所配置模块
- [ ] 创建 ExchangeService
  - [ ] 实现交易所配置 CRUD
  - [ ] API Key 加密存储（AES-256-GCM）
  - [ ] 测试连接功能（调用 gRPC InitAccount）
  - [ ] 管理 ExchangeService Token 生命周期
- [ ] 创建 ExchangeController
  - [ ] GET /api/v1/exchanges - 获取交易所配置列表
  - [ ] POST /api/v1/exchanges - 添加交易所配置
  - [ ] PUT /api/v1/exchanges/:id - 更新交易所配置
  - [ ] DELETE /api/v1/exchanges/:id - 删除交易所配置
  - [ ] POST /api/v1/exchanges/:id/test - 测试交易所连接
- [ ] 创建加密工具（EncryptionUtil）

---

### Phase 3: 策略管理 (Week 4-5)

#### 3.1 策略模块
- [ ] 创建 StrategyService
  - [ ] 使用 `@InjectEntityModel()` 注入 Strategy Repository
  - [ ] 实现策略 CRUD（通过 TypeORM Repository）
  - [ ] 策略参数验证（使用 @midwayjs/validation）
  - [ ] 策略版本管理
  - [ ] 公共策略查询
- [ ] 创建 StrategyController
  - [ ] GET /api/v1/strategies - 获取策略列表
  - [ ] POST /api/v1/strategies - 创建策略
  - [ ] GET /api/v1/strategies/:id - 获取策略详情
  - [ ] PUT /api/v1/strategies/:id - 更新策略
  - [ ] DELETE /api/v1/strategies/:id - 删除策略
  - [ ] GET /api/v1/strategies/available - 获取可用策略列表
- [ ] 实现策略引擎基础类
  - [ ] BaseStrategy - 策略基类
  - [ ] DslStrategy - DSL 脚本解析器（支持 EMA/RSI/MACD）
  - [ ] TypeScriptStrategy - TypeScript 策略（动态加载）
  - [ ] PythonStrategy - Python 策略适配器（子进程调用）
  - [ ] MLStrategy - ML 模型策略

#### 3.2 用户策略订单模块
- [ ] 创建 StrategyOrderService
  - [ ] 实现策略订单 CRUD
  - [ ] 风控配置验证（账户级/仓位级）
  - [ ] 策略启动/停止逻辑
  - [ ] 策略运行统计
- [ ] 创建 StrategyOrderController
  - [ ] GET /api/v1/strategy-order - 获取策略订单列表
  - [ ] POST /api/v1/strategy-order - 创建策略订单
  - [ ] GET /api/v1/strategy-order/:id - 获取订单详情
  - [ ] PUT /api/v1/strategy-order/:id - 更新策略订单
  - [ ] DELETE /api/v1/strategy-order/:id - 解绑策略
  - [ ] POST /api/v1/strategy-order/:id/start - 启动策略
  - [ ] POST /api/v1/strategy-order/:id/stop - 停止策略
  - [ ] GET /api/v1/strategy-order/:id/stats - 获取运行统计

---

### Phase 4: 策略执行引擎 (Week 6-7)

#### 4.1 技术指标计算
- [ ] 优先集成 `@hquant/js`（workspace：`packages/hquant-js`，Rust/napi-rs）
- [ ] （备选）集成技术指标库：`technicalindicators`（纯 JS fallback）
- [ ] 指标覆盖（对齐 Python 版 README-unified）：SMA/EMA、RSI、MACD、Bollinger Bands、KDJ、CCI、Williams %R、OBV、CMF、VWAP
- [ ] 多周期聚合：使用 `KlineAggregator`（15m → 4h/1d）

#### 4.2 策略执行器
- [ ] 实现 StrategyManager（策略实例管理）
  - [ ] 策略实例缓存（按 strategy_id + symbol + exchange）
  - [ ] 引用计数管理（多用户共享）
  - [ ] 实例创建/销毁
- [ ] 实现 StrategyExecutor（执行引擎）
  - [ ] K 线数据订阅（NATS）
  - [ ] 策略上下文更新（滑动窗口）
  - [ ] 指标计算调度
  - [ ] 策略规则执行
  - [ ] 信号生成

#### 4.3 NATS 数据订阅
- [ ] 订阅 K 线主题：`exchange.candle.{exchange}.{tradeType}.{symbol}.{period}`
- [ ] 实现数据分发逻辑（路由到相关策略实例）
- [ ] 错误处理与重连

---

### Phase 5: 信号发布与交易执行 (Week 8)

#### 5.1 信号发布模块
- [ ] 实现信号发布器（NATS Publisher）
- [ ] 信号持久化（存储到 PostgreSQL）
- [ ] 创建 SignalController
  - [ ] GET /api/v1/signals - 查询信号列表（对齐 Python `/api/v1/signals`）
- [ ] WebSocket 推送（可选，使用 `@midwayjs/ws` / `@midwayjs/socketio`）

#### 5.2 订单执行模块
- [ ] 创建 OrderController（HTTP → gRPC 转发；查询参数对齐 Python：`exchange_id`、可选 `symbol/status/limit/offset`）
  - [ ] GET /api/v1/orders - 获取订单列表
  - [ ] POST /api/v1/orders - 手动下单
  - [ ] GET /api/v1/orders/:orderId - 获取订单详情
  - [ ] POST /api/v1/orders/:orderId/cancel - 取消订单
- [ ] 创建 PositionController（HTTP → gRPC 转发；查询参数对齐 Python：`exchange_id`、可选 `symbol`）
  - [ ] GET /api/v1/positions - 获取持仓列表
  - [ ] POST /api/v1/positions/sync - 同步持仓
  - [ ] POST /api/v1/positions/:positionId/close - 平仓
- [ ] 创建 AccountController（对齐 Python：无前缀路由）
  - [ ] GET /api/v1/balance - 获取账户余额
  - [ ] POST /api/v1/leverage - 设置杠杆
- [ ] 统一 gRPC 错误映射（503: 依赖缺失/未生成 proto，502: gRPC 请求失败）

#### 5.3 风控模块
- [ ] 创建 RiskService
  - [ ] 实现账户级风控检查
    - [ ] 单日最大亏损
    - [ ] 最大保证金使用率
    - [ ] 越界行为（BLOCK_TRADING / CLOSE_ALL）
  - [ ] 实现仓位级风控检查
    - [ ] 止盈止损
    - [ ] 单仓最大亏损
    - [ ] 冷却时间
  - [ ] 风控事件通知（NATS 发布）

---

### Phase 6: 回测与统计 (Week 9-10)

#### 6.1 回测引擎
- [ ] 安装 Bull 队列：`npm install @midwayjs/bull bullmq`
- [ ] 配置 Bull 队列（config.default.ts）
- [ ] 创建 BacktestService
  - [ ] 实现回测任务提交（投递到 Bull 队列）
  - [ ] 历史 K 线数据加载（从 PostgreSQL）
  - [ ] 虚拟账户模拟
  - [ ] 交易记录追踪
- [ ] 创建 BacktestProcessor（Bull 任务处理器）
  - [ ] 回测引擎核心逻辑
  - [ ] 绩效指标计算：
    - [ ] 总收益率、年化收益率
    - [ ] 夏普比率、索提诺比率
    - [ ] 最大回撤
    - [ ] 胜率、盈亏比
  - [ ] 回测报告生成
- [ ] 创建 BacktestController
  - [ ] POST /api/v1/backtests - 提交回测任务
  - [ ] GET /api/v1/backtests - 获取回测列表
  - [ ] GET /api/v1/backtests/:id - 获取回测结果
  - [ ] GET /api/v1/backtests/:id/progress - 获取回测进度
  - [ ] POST /api/v1/ml/train - 提交 ML 模型训练任务（对齐 Python，vNext 可先返回 501）
  - [ ] GET /api/v1/ml/models - 获取已训练模型列表（对齐 Python，vNext 可先返回 []）

#### 6.2 参数优化（可选）
- [ ] 网格搜索算法
- [ ] 遗传算法优化

#### 6.3 统计模块
- [ ] 创建 StatsService
  - [ ] 收益统计计算
  - [ ] 交易记录查询
  - [ ] 策略绩效分析
- [ ] 创建 StatsController
  - [ ] GET /api/v1/stats - 系统统计（对齐 Python，MVP 可先返回 `{}`）
  - [ ] （扩展）GET /api/v1/stats/revenue - 收益统计
  - [ ] （扩展）GET /api/v1/stats/trades - 交易记录
  - [ ] （扩展）GET /api/v1/stats/performance - 策略绩效

---

### Phase 7: 后台管理与监控 (Week 11)

#### 7.1 后台管理
- [ ] 创建 AdminService
  - [ ] 用户管理（查询所有用户、更新用户状态）
  - [ ] 全局策略监控（所有策略运行状态）
  - [ ] 系统订单统计（订单总量、成交统计）
- [ ] 创建 AdminController
  - [ ] GET /api/v1/admin/users - 获取用户列表
  - [ ] PUT /api/v1/admin/users/:id/status - 更新用户状态
  - [ ] GET /api/v1/admin/strategies - 获取所有策略统计
  - [ ] GET /api/v1/admin/orders - 获取所有订单

#### 7.2 监控与日志
- [ ] 安装 Prometheus 组件：`npm install @midwayjs/prometheus`
- [ ] 配置 Prometheus 组件（configuration.ts）
- [ ] 实现自定义指标：
  - [ ] HTTP 请求指标（Midway 自动收集）
  - [ ] gRPC 调用指标
  - [ ] 策略执行指标
  - [ ] 订单执行指标
- [ ] 配置 Midway Logger（config.default.ts）
  - [ ] 结构化日志格式
  - [ ] 日志级别配置（dev: info, prod: warn）
  - [ ] 日志轮转配置
  - [ ] 日志文件路径

#### 7.3 健康检查
- [ ] 创建 HomeController（已存在）
  - [ ] GET /health - 健康检查接口
  - [ ] 数据库连接检查（TypeORM Connection）
  - [ ] Redis 连接检查
  - [ ] NATS 连接检查
  - [ ] gRPC 连接检查
- [ ] 返回服务状态和版本信息

---

### Phase 8: 测试与部署 (Week 12)

#### 8.1 单元测试
- [ ] 使用 Mocha + Chai 编写单元测试（Midway 默认）
- [ ] 服务层测试
  - [ ] UserService 测试
  - [ ] StrategyService 测试
  - [ ] OrderService 测试
- [ ] 工具函数测试
  - [ ] 加密工具测试
  - [ ] 指标计算测试
- [ ] 策略引擎测试
  - [ ] BaseStrategy 测试
  - [ ] DslStrategy 测试

#### 8.2 集成测试
- [ ] 使用 @midwayjs/mock 编写集成测试
- [ ] API 接口测试
  - [ ] 认证流程测试
  - [ ] 策略 CRUD 测试
  - [ ] 订单执行测试
- [ ] gRPC 调用测试（Mock gRPC Server）
- [ ] NATS 消息测试（Mock NATS）

#### 8.3 E2E 测试
- [ ] 完整策略执行流程测试
  - [ ] 创建策略
  - [ ] 订阅策略
  - [ ] 启动策略
  - [ ] K线数据触发
  - [ ] 信号生成
  - [ ] 订单下单
- [ ] 回测流程测试

#### 8.4 Docker 部署
- [ ] 编写 Dockerfile（多阶段构建）
  ```dockerfile
  FROM node:20-alpine AS builder
  WORKDIR /app
  COPY package*.json ./
  RUN npm ci
  COPY . .
  RUN npm run build

  FROM node:20-alpine
  WORKDIR /app
  COPY --from=builder /app/dist ./dist
  COPY --from=builder /app/node_modules ./node_modules
  COPY --from=builder /app/package.json ./
  COPY --from=builder /app/bootstrap.js ./
  EXPOSE 9003
  CMD ["npm", "start"]
  ```
- [ ] 编写 docker-compose.yml
- [ ] 环境变量配置（.env.prod）
- [ ] CI/CD 配置（GitHub Actions / GitLab CI）

---

## 关键技术决策

### 1. ORM 选择：TypeORM
**选择 TypeORM 的理由**：
- ✅ **Midway 官方推荐**：官方文档完善，集成简单
- ✅ **装饰器风格**：与 Midway 风格一致，代码简洁
- ✅ **类似 SQLAlchemy**：Entity、Repository 模式，易于从 Python 迁移
- ✅ **成熟稳定**：广泛使用，社区活跃
- ✅ **迁移管理**：内置迁移工具，支持版本控制
- ✅ **TypeScript 原生**：完整类型支持，类型安全
- ✅ **Active Record / Data Mapper**：支持两种模式

**与 SQLAlchemy 对比**：
| 特性 | SQLAlchemy (Python) | TypeORM (TypeScript) |
|------|---------------------|----------------------|
| 模型定义 | 类 + 装饰器 | 类 + 装饰器 |
| 关系映射 | relationship() | @OneToMany() / @ManyToOne() |
| 查询构造 | Query API | QueryBuilder / Repository |
| 迁移工具 | Alembic | TypeORM CLI |
| 事务管理 | Session | Connection / EntityManager |

### 2. 技术指标计算库
**推荐：`@hquant/js`（workspace：`packages/hquant-js`）**
- ✅ Rust/napi-rs 原生性能（定位对齐 hquant-py）
- ✅ 内置指标 + 多周期聚合 + DSL + 回测引擎（减少重复实现）
- ✅ 与 monorepo 其他服务共享同一指标/DSL 语义，减少跨语言漂移

**备选：technicalindicators**
- ✅ 纯 JavaScript 实现，易于集成
- ✅ 常用指标覆盖较全
- ❌ 性能与多周期/回测能力弱于 `@hquant/js`

**备选：tulind**
- ✅ C 语言实现，性能高
- ❌ 需要编译，部署与跨平台兼容成本更高

**兜底：保留 hquant-py（子进程调用）**
- 使用 Node.js 子进程调用 Python 版 hquant-py
- 适合极端性能/指标缺失的场景（建议仅做 fallback）

### 3. Python 策略支持
**方案 A：完全移除 Python 策略**
- 仅支持 TypeScript 策略
- 简化架构

**方案 B：通过子进程调用**
- 使用 `child_process` 执行 Python 脚本
- 通过 JSON-RPC 通信
- 保留 Python 策略生态

**推荐：方案 B（兼容性考虑）**

### 4. 异步任务队列
**推荐：BullMQ (基于 Redis)**
- ✅ Midway 官方支持（@midwayjs/bull-board）
- ✅ 成熟稳定，Bull 的升级版
- ✅ Dashboard 可视化
- ✅ 更好的 TypeScript 支持
- 适用场景：回测任务、ML 训练任务、批量订单处理

**使用方式**：
```typescript
// configuration.ts
import { Configuration } from '@midwayjs/core';
import * as bull from '@midwayjs/bull-board';

@Configuration({
  imports: [bull],
  // ...
})
export class ContainerLifeCycle {}
```

---

## 数据库模型设计（TypeORM Entity）

### User Entity (src/entity/user.entity.ts)

```typescript
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, OneToMany } from 'typeorm';
import { UserExchange } from './user-exchange.entity';
import { Strategy } from './strategy.entity';
import { StrategyOrder } from './strategy-order.entity';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'casdoor_id', unique: true })
  casdoorId: string;

  @Column({ unique: true })
  username: string;

  @Column({ default: 'user' })
  role: string;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  // Relations
  @OneToMany(() => UserExchange, exchange => exchange.user)
  exchanges: UserExchange[];

  @OneToMany(() => Strategy, strategy => strategy.user)
  strategies: Strategy[];

  @OneToMany(() => StrategyOrder, order => order.user)
  strategyOrders: StrategyOrder[];
}
```

### UserExchange Entity (src/entity/user-exchange.entity.ts)

```typescript
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, OneToMany, JoinColumn } from 'typeorm';
import { User } from './user.entity';
import { StrategyOrder } from './strategy-order.entity';

@Entity('user_exchanges')
export class UserExchange {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id' })
  userId: string;

  @Column({ name: 'exchange_type' })
  exchangeType: string; // BINANCE, OKX

  @Column()
  name: string;

  @Column({ name: 'api_key' })
  apiKey: string; // 加密存储

  @Column({ name: 'api_secret' })
  apiSecret: string; // 加密存储

  @Column({ nullable: true })
  passphrase?: string;

  @Column({ name: 'is_testnet', default: false })
  isTestnet: boolean;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @Column({ nullable: true })
  token?: string; // ExchangeService Token

  @Column({ name: 'token_expiry', type: 'timestamp', nullable: true })
  tokenExpiry?: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  // Relations
  @ManyToOne(() => User, user => user.exchanges, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @OneToMany(() => StrategyOrder, order => order.exchange)
  strategyOrders: StrategyOrder[];
}
```

### Strategy Entity (src/entity/strategy.entity.ts)

```typescript
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, OneToMany, JoinColumn } from 'typeorm';
import { User } from './user.entity';
import { StrategyOrder } from './strategy-order.entity';

@Entity('strategies')
export class Strategy {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id' })
  userId: string;

  @Column()
  name: string;

  @Column({ nullable: true })
  description?: string;

  @Column({ default: 'neutral' }) // neutral, bullish, bearish
  tag: string;

  @Column({ type: 'text' })
  code: string;

  @Column({ type: 'jsonb', default: {} })
  params: Record<string, any>;

  @Column({ default: 1 })
  version: number;

  @Column({ default: 'active' }) // active, inactive
  status: string;

  @Column({ name: 'is_public', default: true })
  isPublic: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  // Relations
  @ManyToOne(() => User, user => user.strategies, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @OneToMany(() => StrategyOrder, order => order.strategy)
  strategyOrders: StrategyOrder[];
}
```

### StrategyOrder Entity (src/entity/strategy-order.entity.ts)

```typescript
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { User } from './user.entity';
import { Strategy } from './strategy.entity';
import { UserExchange } from './user-exchange.entity';

@Entity('strategy_orders')
export class StrategyOrder {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id' })
  userId: string;

  @Column({ name: 'strategy_id' })
  strategyId: string;

  @Column({ name: 'exchange_id' })
  exchangeId: string;

  @Column({ type: 'simple-array' })
  symbols: string[];

  @Column({ type: 'jsonb', default: {} })
  parameters: Record<string, any>;

  @Column({ name: 'risk_config', type: 'jsonb', default: {} })
  riskConfig: Record<string, any>;

  @Column({ default: false })
  live: boolean;

  @Column({ name: 'started_at', type: 'timestamp', nullable: true })
  startedAt?: Date;

  @Column({ name: 'stopped_at', type: 'timestamp', nullable: true })
  stoppedAt?: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  // Relations
  @ManyToOne(() => User, user => user.strategyOrders, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @ManyToOne(() => Strategy, strategy => strategy.strategyOrders, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'strategy_id' })
  strategy: Strategy;

  @ManyToOne(() => UserExchange, exchange => exchange.strategyOrders, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'exchange_id' })
  exchange: UserExchange;
}
```

### Signal Entity (src/entity/signal.entity.ts)

```typescript
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';

@Entity('signals')
@Index(['subscriptionId'])
@Index(['symbol'])
@Index(['timestamp'])
export class Signal {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'subscription_id' })
  subscriptionId: string;

  @Column()
  symbol: string;

  @Column() // BUY, SELL, HOLD
  action: string;

  @Column({ type: 'decimal', precision: 18, scale: 8 })
  price: number;

  @Column({ type: 'decimal', precision: 5, scale: 4 })
  confidence: number;

  @Column({ type: 'jsonb', default: {} })
  indicators: Record<string, any>;

  @Column({ type: 'timestamp' })
  timestamp: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
```

### Backtest Entity (src/entity/backtest.entity.ts)

```typescript
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('backtests')
export class Backtest {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id' })
  userId: string;

  @Column({ name: 'strategy_id' })
  strategyId: string;

  @Column()
  symbol: string;

  @Column({ name: 'start_date', type: 'timestamp' })
  startDate: Date;

  @Column({ name: 'end_date', type: 'timestamp' })
  endDate: Date;

  @Column({ name: 'initial_capital', type: 'decimal', precision: 18, scale: 2 })
  initialCapital: number;

  @Column({ type: 'jsonb', nullable: true })
  parameters?: Record<string, any>;

  @Column({ default: 'pending' }) // pending, running, completed, failed
  status: string;

  @Column({ type: 'jsonb', nullable: true })
  result?: Record<string, any>; // 回测结果

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  progress?: number; // 进度百分比

  @Column({ type: 'text', nullable: true })
  error?: string; // 错误信息

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
```

---

## 环境变量配置

```env
# .env.example

# Application
NODE_ENV=development
APP_PORT=9003

# Database (TypeORM)
DB_HOST=localhost
DB_PORT=15000
DB_USER=postgres
DB_PASSWORD=password
DB_NAME=trader_db
DB_SYNCHRONIZE=false  # 生产环境必须为 false
DB_LOGGING=false

# Redis
REDIS_HOST=localhost
REDIS_PORT=16000
REDIS_DB=0

# NATS
NATS_URL=nats://localhost:16002

# gRPC
EXCHANGE_GRPC_URL=localhost:50051

# Casdoor
CASDOOR_ENDPOINT=http://auth.8and1.cn
CASDOOR_CLIENT_ID=a1aa7c75ba336df51788
CASDOOR_CLIENT_SECRET=your_secret
CASDOOR_CALLBACK_URL=http://localhost:9003/api/v1/auth/callback

# JWT
JWT_SECRET=your_jwt_secret
JWT_EXPIRES_IN=7d

# Encryption
ENCRYPTION_KEY=your_32_byte_encryption_key

# Bull Queue
BULL_REDIS_HOST=localhost
BULL_REDIS_PORT=16000
BULL_REDIS_DB=1

# Logging
LOG_LEVEL=info
```

**配置文件示例 (config.local.ts)**：
```typescript
export default {
  typeorm: {
    dataSource: {
      default: {
        type: 'postgres',
        host: process.env.DB_HOST,
        port: parseInt(process.env.DB_PORT),
        username: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        synchronize: process.env.DB_SYNCHRONIZE === 'true', // 仅本地开发使用
        logging: process.env.DB_LOGGING === 'true',
      },
    },
  },
  redis: {
    client: {
      host: process.env.REDIS_HOST,
      port: parseInt(process.env.REDIS_PORT),
      db: parseInt(process.env.REDIS_DB),
    },
  },
};
```

---

## 依赖包清单

```json
{
  "dependencies": {
    "@midwayjs/bootstrap": "^4.0.0-beta.7",
    "@midwayjs/core": "^4.0.0-beta.7",
    "@midwayjs/koa": "^4.0.0-beta.7",
    "@midwayjs/logger": "^4.0.0",
    "@midwayjs/typeorm": "^4.0.0-beta.7",
    "@midwayjs/validation": "^4.0.0-beta.7",
    "@midwayjs/validation-joi": "^4.0.0-beta.7",
    "@midwayjs/jwt": "^4.0.0-beta.7",
    "@midwayjs/redis": "^4.0.0-beta.7",
    "@midwayjs/grpc": "^4.0.0-beta.7",
    "@midwayjs/bull-board": "^4.0.0-beta.7",
    "@midwayjs/prometheus": "^4.0.0-beta.7",
    "@midwayjs/ws": "^4.0.0-beta.7",
    "@midwayjs/info": "^4.0.0-beta.7",
    "typeorm": "^0.3.20",
    "pg": "^8.11.3",
    "@grpc/grpc-js": "^1.9.14",
    "@grpc/proto-loader": "^0.7.10",
    "@hquant/casdoor": "workspace:*",
    "@hquant/js": "workspace:*",
    "joi": "^17.13.3",
    "nats": "^2.19.0",
    "bullmq": "^5.1.0",
    "technicalindicators": "^3.1.0",
    "crypto-js": "^4.2.0"
  },
  "devDependencies": {
    "@midwayjs/mock": "^4.0.0-beta.7",
    "@types/mocha": "^10.0.1",
    "@types/node": "20",
    "@types/crypto-js": "^4.2.1",
    "c8": "^8.0.1",
    "cross-env": "^7.0.3",
    "mocha": "^10.2.0",
    "mwts": "^1.3.0",
    "mwtsc": "^1.4.0",
    "ts-node": "^10.9.2",
    "typescript": "^5.3.0",
    "grpc-tools": "^1.12.4"
  },
  "engines": {
    "node": ">=20.0.0"
  },
  "scripts": {
    "start": "cross-env NODE_ENV=production node ./bootstrap.js",
    "dev": "cross-env NODE_ENV=local mwtsc --watch --run @midwayjs/mock/app",
    "test": "cross-env NODE_ENV=unittest mocha",
    "cov": "cross-env c8 --all --reporter=text --reporter=lcovonly npm run test",
    "lint": "mwts check",
    "lint:fix": "mwts fix",
    "build": "mwtsc --cleanOutDir",
    "typeorm": "typeorm-ts-node-esm",
    "migration:generate": "npm run typeorm migration:generate -- -d src/data-source.ts",
    "migration:run": "npm run typeorm migration:run -- -d src/data-source.ts",
    "migration:revert": "npm run typeorm migration:revert -- -d src/data-source.ts",
    "proto:generate": "sh scripts/generate-proto.sh"
  }
}
```

**新增依赖说明**：
- `@midwayjs/*` - Midway 框架核心组件和扩展
- `@midwayjs/typeorm` - Midway TypeORM 组件
- `typeorm` - TypeORM 核心库
- `pg` - PostgreSQL 驱动
- `joi` - 数据验证库（Midway 验证组件依赖）
- `bullmq` - 任务队列（Bull 的升级版）
- `@hquant/casdoor` - Casdoor OAuth 认证封装（workspace：`packages/casdoor`）
- `crypto-js` - 加密工具（API Key 加密）
- `@hquant/js` - 量化指标/聚合/回测/DSL（workspace：`packages/hquant-js`）
- `technicalindicators` - 技术指标计算库（纯 JS fallback，可选）
- `mwts` / `mwtsc` - Midway TypeScript 工具链

---

## 实施里程碑

| Week | 里程碑 | 交付物 |
|------|--------|--------|
| 1-2 | 基础设施搭建 | 项目结构、数据库、Redis、NATS 集成 |
| 3 | 认证与用户管理 | 登录、用户信息、交易所配置接口 |
| 4-5 | 策略管理 | 策略 CRUD、策略订单管理 |
| 6-7 | 策略执行引擎 | 实时策略执行、技术指标计算 |
| 8 | 信号与交易执行 | 信号发布、订单执行、风控 |
| 9-10 | 回测与统计 | 回测引擎、绩效分析 |
| 11 | 后台管理与监控 | 管理接口、日志、监控 |
| 12 | 测试与部署 | 测试覆盖、Docker 部署 |

---

## 风险与挑战

### 技术风险
1. **技术指标性能**
   - 风险：JavaScript 实现性能不如 Rust 版 hquant-py
   - 缓解：
     - 优先使用 `@hquant/js`（Rust/napi-rs）
     - `technicalindicators` 作为纯 JS fallback
     - 实现增量计算
     - 必要时保留 Python 子进程调用

2. **Python 策略兼容性**
   - 风险：无法直接运行 Python 策略代码
   - 缓解：
     - 通过 child_process 执行 Python 脚本
     - 定义标准 JSON-RPC 通信协议
     - 提供策略迁移指南

3. **gRPC 类型安全**
   - 风险：Proto 定义变更导致类型不匹配
   - 缓解：
     - 使用 grpc-tools 自动生成 TypeScript 类型
     - CI/CD 中集成 Proto 变更检测

### 业务风险
1. **功能遗漏**
   - 风险：遗漏 Python 版本的某些功能
   - 缓解：
     - 对照 Python 版本功能清单
     - 逐模块实现并验证

2. **性能回归**
   - 风险：Node.js 版本性能不如 Python 版本
   - 缓解：
     - 压力测试
     - 性能基准对比
     - 优化热点代码

---

## 后续优化方向

### 短期（3 个月内）
- [ ] 完善单元测试覆盖率（目标：80%+）
- [ ] 性能优化（指标计算、数据库查询）
- [ ] 监控告警完善

### 中期（6 个月内）
- [ ] ML 模型训练与推理集成
- [ ] 策略市场功能
- [ ] WebSocket 实时信号推送

### 长期（1 年内）
- [ ] 微服务拆分（策略执行器独立服务）
- [ ] 分布式回测（多节点并行）
- [ ] 高频交易支持（毫秒级延迟）

---

## TypeORM 迁移管理

### 创建迁移文件

```bash
# 1. 创建数据源配置文件 src/data-source.ts
import { DataSource } from 'typeorm';

export const AppDataSource = new DataSource({
  type: 'postgres',
  host: 'localhost',
  port: 15000,
  username: 'postgres',
  password: 'password',
  database: 'trader_db',
  entities: ['src/entity/*.entity.ts'],
  migrations: ['migration/*.ts'],
  synchronize: false,
});

# 2. 生成迁移文件（根据 Entity 变更自动生成）
npm run migration:generate -- migration/InitDatabase

# 3. 执行迁移
npm run migration:run

# 4. 回滚迁移
npm run migration:revert
```

### 迁移文件示例

```typescript
// migration/1707000000000-InitDatabase.ts
import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitDatabase1707000000000 implements MigrationInterface {
  name = 'InitDatabase1707000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "users" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "casdoor_id" varchar NOT NULL UNIQUE,
        "username" varchar NOT NULL UNIQUE,
        "role" varchar NOT NULL DEFAULT 'user',
        "is_active" boolean NOT NULL DEFAULT true,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "user_exchanges" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "user_id" uuid NOT NULL,
        "exchange_type" varchar NOT NULL,
        "name" varchar NOT NULL,
        "api_key" varchar NOT NULL,
        "api_secret" varchar NOT NULL,
        "passphrase" varchar,
        "is_testnet" boolean NOT NULL DEFAULT false,
        "is_active" boolean NOT NULL DEFAULT true,
        "token" varchar,
        "token_expiry" TIMESTAMP,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "fk_user_exchanges_user" FOREIGN KEY ("user_id")
          REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);

    // ... 其他表创建语句
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "user_exchanges"`);
    await queryRunner.query(`DROP TABLE "users"`);
  }
}
```

### 开发环境 vs 生产环境

| 环境 | 同步模式 | 说明 |
|------|----------|------|
| **开发环境** | `synchronize: true` | 自动同步 Entity 变更到数据库（慎用） |
| **生产环境** | `synchronize: false` | 禁用自动同步，使用迁移文件 |

**推荐做法**：
- 本地开发：使用 `synchronize: true` 快速迭代
- 测试/生产：使用迁移文件，版本可控

---

## 参考文档

- [Midway.js 官方文档](https://midwayjs.org/)
- [Midway.js 组件列表](https://midwayjs.org/docs/extensions/intro)
- [Midway TypeORM 文档](https://midwayjs.org/docs/extensions/orm)
- [TypeORM 官方文档](https://typeorm.io/)
- [gRPC Node.js 文档](https://grpc.io/docs/languages/node/)
- [NATS.js 文档](https://github.com/nats-io/nats.js)
- [BullMQ 文档](https://docs.bullmq.io/)
- [@hquant/js](../../packages/hquant-js/README.md)
- [technicalindicators 文档](https://github.com/anandanand84/technicalindicators)
- [Casdoor SDK 文档](https://casdoor.org/docs/category/client-sdks)

---

## FastAPI vs Midway.js 对比

### 语法对比

| 功能 | Python FastAPI | Midway.js (TypeScript) |
|------|----------------|------------------------|
| **应用入口** | `app = FastAPI()` | `@Configuration()` 类 + `bootstrap.js` |
| **路由定义** | `@app.get("/users")` | `@Controller()` + `@Get()` |
| **依赖注入** | `Depends()` | `@Inject()` |
| **请求参数** | `def get_user(id: str = Path(...))` | `@Get('/:id')` + `@Param('id')` |
| **请求体** | `def create(user: UserModel)` | `@Post()` + `@Body()` + DTO 类 |
| **数据验证** | Pydantic 模型 | `@Rule()` + Joi 验证器 |
| **中间件** | `@app.middleware("http")` | `@Middleware()` 类 |
| **异常处理** | `@app.exception_handler()` | `@Filter()` 过滤器 |
| **配置管理** | `Settings` 类 | `config.default.ts` + `@Config()` |
| **后台任务** | `BackgroundTasks` | BullMQ 队列 |

### 代码示例对比

#### 定义路由

**FastAPI**:
```python
from fastapi import FastAPI, Depends

app = FastAPI()

@app.get("/api/v1/users/{user_id}")
async def get_user(user_id: str, current_user = Depends(get_current_user)):
    return {"id": user_id, "user": current_user}
```

**Midway.js**:
```typescript
import { Controller, Get, Param, Inject } from '@midwayjs/core';

@Controller('/api/v1/users')
export class UserController {
  @Inject()
  userService: UserService;

  @Get('/:userId')
  async getUser(@Param('userId') userId: string) {
    return this.userService.getUser(userId);
  }
}
```

#### 数据验证

**FastAPI**:
```python
from pydantic import BaseModel, EmailStr

class CreateUserRequest(BaseModel):
    username: str
    email: EmailStr
    age: int | None = None

@app.post("/users")
async def create_user(user: CreateUserRequest):
    return user
```

**Midway.js**:
```typescript
import { Rule, RuleType } from '@midwayjs/validation';
import { Controller, Post, Body, Validate } from '@midwayjs/core';

export class CreateUserDTO {
  @Rule(RuleType.string().required())
  username: string;

  @Rule(RuleType.string().email().required())
  email: string;

  @Rule(RuleType.number().optional())
  age?: number;
}

@Controller('/users')
export class UserController {
  @Post('/')
  @Validate()
  async createUser(@Body() dto: CreateUserDTO) {
    return dto;
  }
}
```

#### 依赖注入

**FastAPI**:
```python
from fastapi import Depends

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

@app.get("/users")
async def list_users(db: Session = Depends(get_db)):
    return db.query(User).all()
```

**Midway.js**:
```typescript
import { Provide } from '@midwayjs/core';
import { InjectEntityModel } from '@midwayjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../entity/user.entity';

@Provide()
export class UserService {
  @InjectEntityModel(User)
  userRepo: Repository<User>;

  async listUsers() {
    return this.userRepo.find();
  }
}

@Controller('/users')
export class UserController {
  @Inject()
  userService: UserService;

  @Get('/')
  async listUsers() {
    return this.userService.listUsers();
  }
}
```

---

## Midway.js 最佳实践

### 1. 依赖注入模式
```typescript
// Service 定义
import { Provide } from '@midwayjs/core';

@Provide()
export class UserService {
  async getUser(id: string) {
    // ...
  }
}

// Controller 中注入
import { Controller, Get, Inject } from '@midwayjs/core';

@Controller('/api/v1/users')
export class UserController {
  @Inject()
  userService: UserService;

  @Get('/:id')
  async getUser(@Param('id') id: string) {
    return this.userService.getUser(id);
  }
}
```

### 2. 配置管理
```typescript
// config/config.default.ts
import { MidwayConfig } from '@midwayjs/core';

export default {
  keys: 'your_cookie_keys',
  koa: {
    port: 9003,
  },
  typeorm: {
    dataSource: {
      default: {
        type: 'postgres',
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT) || 15000,
        username: process.env.DB_USER || 'postgres',
        password: process.env.DB_PASSWORD || 'password',
        database: process.env.DB_NAME || 'trader_db',
        synchronize: false, // 生产环境设为 false
        logging: false,
        entities: ['**/entity/*.entity{.ts,.js}'],
        migrations: ['**/migration/*.ts'],
      },
    },
  },
  redis: {
    client: {
      host: '127.0.0.1',
      port: 6379,
      db: 0,
    },
  },
} as MidwayConfig;

// 在 Service 中使用
@Provide()
export class MyService {
  @Config('redis')
  redisConfig;
}
```

### 3. 中间件使用
```typescript
// middleware/auth.middleware.ts
import { Middleware } from '@midwayjs/core';
import { Context, NextFunction } from '@midwayjs/koa';

@Middleware()
export class AuthMiddleware {
  resolve() {
    return async (ctx: Context, next: NextFunction) => {
      // 验证 JWT Token
      const token = ctx.headers.authorization;
      if (!token) {
        ctx.status = 401;
        ctx.body = { error: 'Unauthorized' };
        return;
      }
      await next();
    };
  }
}

// 在 Controller 中使用
@Controller('/api/v1/users', { middleware: [AuthMiddleware] })
export class UserController {
  // ...
}
```

### 4. 参数验证
```typescript
// dto/create-user.dto.ts
import { Rule, RuleType } from '@midwayjs/validation';

export class CreateUserDTO {
  @Rule(RuleType.string().required())
  username: string;

  @Rule(RuleType.string().email().required())
  email: string;

  @Rule(RuleType.number().min(18))
  age?: number;
}

// Controller 中使用
@Post('/')
@Validate()
async createUser(@Body() dto: CreateUserDTO) {
  // dto 已通过验证
  return this.userService.create(dto);
}
```

### 5. TypeORM Repository 使用
```typescript
import { Provide } from '@midwayjs/core';
import { InjectEntityModel } from '@midwayjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../entity/user.entity';

@Provide()
export class UserService {
  @InjectEntityModel(User)
  userRepo: Repository<User>;

  // 基本查询
  async findById(id: string) {
    return this.userRepo.findOne({ where: { id } });
  }

  // 关联查询
  async findWithExchanges(id: string) {
    return this.userRepo.findOne({
      where: { id },
      relations: ['exchanges', 'strategies'],
    });
  }

  // 条件查询
  async findActiveUsers() {
    return this.userRepo.find({
      where: { isActive: true },
      order: { createdAt: 'DESC' },
    });
  }

  // QueryBuilder 复杂查询
  async searchUsers(keyword: string) {
    return this.userRepo
      .createQueryBuilder('user')
      .where('user.username LIKE :keyword', { keyword: `%${keyword}%` })
      .orWhere('user.casdoorId LIKE :keyword', { keyword: `%${keyword}%` })
      .getMany();
  }

  // 事务操作
  async createUserWithExchange(userData: any, exchangeData: any) {
    return this.userRepo.manager.transaction(async (manager) => {
      const user = manager.create(User, userData);
      await manager.save(user);

      const exchange = manager.create(UserExchange, {
        ...exchangeData,
        userId: user.id,
      });
      await manager.save(exchange);

      return user;
    });
  }
}
```

### 6. 生命周期管理
```typescript
// configuration.ts
import { Configuration, App } from '@midwayjs/core';
import { ILifeCycle } from '@midwayjs/core';
import { Application } from '@midwayjs/koa';
import * as typeorm from '@midwayjs/typeorm';

@Configuration({
  imports: [
    require('@midwayjs/koa'),
    typeorm,
    require('@midwayjs/redis'),
    // ...
  ],
  importConfigs: [
    {
      default: {
        keys: 'your_cookie_keys',
      },
    },
  ],
})
export class ContainerLifeCycle implements ILifeCycle {
  @App()
  app: Application;

  async onReady() {
    // 服务启动后执行
    console.log('Application is ready');
    // 初始化 NATS 连接
    // 启动策略执行器
  }

  async onStop() {
    // 服务停止前执行
    console.log('Application is stopping');
    // 关闭 NATS 连接
    // 停止策略执行器
  }
}
```

---

**计划版本**: 1.0.0
**框架**: Midway.js 4.x (ESM)
**创建日期**: 2026-02-02
**预计完成时间**: 12 周
**优先级**: P0（核心项目）
