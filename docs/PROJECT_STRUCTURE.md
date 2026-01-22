# 项目结构总览

## 目录结构

```
auto-trader/
├── apps/                                    # 可部署单元
│   ├── strategy-engine/                     # 策略引擎 (Python)
│   │   ├── README.md                        # 技术文档
│   │   ├── src/
│   │   │   ├── api/                         # FastAPI 接口层
│   │   │   │   ├── v1/
│   │   │   │   │   ├── strategies.py        # 策略管理 API
│   │   │   │   │   ├── backtest.py          # 回测 API
│   │   │   │   │   └── signals.py           # 信号查询 API
│   │   │   │   └── models/                  # 请求/响应模型
│   │   │   ├── core/                        # 核心逻辑
│   │   │   │   ├── strategy_base.py         # 策略基类
│   │   │   │   ├── strategy_manager.py      # 策略管理器
│   │   │   │   ├── signal_generator.py      # 信号生成器
│   │   │   │   └── risk_assessor.py         # 风险评估器
│   │   │   ├── strategies/                  # 策略实现
│   │   │   │   ├── trend_following/         # 趋势跟踪
│   │   │   │   ├── mean_reversion/          # 均值回归
│   │   │   │   ├── arbitrage/               # 套利策略
│   │   │   │   └── machine_learning/        # 机器学习策略
│   │   │   ├── data/                        # 数据处理
│   │   │   │   ├── market_data.py           # 市场数据获取
│   │   │   │   ├── feature_engineering.py   # 特征工程
│   │   │   │   └── data_provider.py         # 数据提供者
│   │   │   ├── backtest/                    # 回测引擎
│   │   │   │   ├── engine.py                # 回测核心
│   │   │   │   ├── metrics.py               # 回测指标
│   │   │   │   └── optimizer.py             # 参数优化
│   │   │   ├── tasks/                       # Celery 任务
│   │   │   │   ├── strategy_tasks.py        # 策略任务
│   │   │   │   ├── backtest_tasks.py        # 回测任务
│   │   │   │   └── signal_tasks.py          # 信号任务
│   │   │   └── utils/                       # 工具类
│   │   │       ├── logger.py                # 日志
│   │   │       ├── config.py                # 配置
│   │   │       └── metrics.py               # 指标计算
│   │   ├── tests/                           # 测试
│   │   ├── config/                          # 配置文件
│   │   ├── scripts/                         # 脚本
│   │   ├── Dockerfile
│   │   ├── docker-compose.yml
│   │   ├── requirements.txt
│   │   └── pyproject.toml
│   │
│   ├── trading-engine/                      # 交易引擎 (Node.js)
│   │   ├── README.md                        # 技术文档
│   │   ├── src/
│   │   │   ├── api/                         # REST API 层
│   │   │   │   ├── v1/
│   │   │   │   │   ├── orders.controller.ts
│   │   │   │   │   ├── positions.controller.ts
│   │   │   │   │   ├── accounts.controller.ts
│   │   │   │   │   └── trades.controller.ts
│   │   │   │   └── dto/                     # DTO 定义
│   │   │   ├── core/                        # 核心逻辑
│   │   │   │   ├── order-manager.ts         # 订单管理器
│   │   │   │   ├── position-manager.ts      # 仓位管理器
│   │   │   │   ├── risk-checker.ts          # 风控检查器
│   │   │   │   └── signal-processor.ts      # 信号处理器
│   │   │   ├── exchange/                    # 交易所适配
│   │   │   │   ├── adapters/                # 交易所适配器
│   │   │   │   │   ├── binance.adapter.ts
│   │   │   │   │   ├── okx.adapter.ts
│   │   │   │   │   └── bybit.adapter.ts
│   │   │   │   ├── websocket.ts             # WebSocket 管理
│   │   │   │   └── rest-client.ts           # REST 客户端
│   │   │   ├── models/                      # 数据模型
│   │   │   │   ├── order.model.ts
│   │   │   │   ├── position.model.ts
│   │   │   │   ├── account.model.ts
│   │   │   │   └── trade.model.ts
│   │   │   ├── services/                    # 业务服务
│   │   │   │   ├── order-service.ts
│   │   │   │   ├── position-service.ts
│   │   │   │   ├── account-service.ts
│   │   │   │   └── trade-service.ts
│   │   │   ├── subscribers/                 # NATS 订阅者
│   │   │   │   ├── signal-subscriber.ts
│   │   │   │   └── order-subscriber.ts
│   │   │   ├── tasks/                       # 定时任务
│   │   │   │   ├── sync-tasks.ts            # 同步任务
│   │   │   │   └── cleanup-tasks.ts         # 清理任务
│   │   │   └── utils/                       # 工具类
│   │   │       ├── logger.ts
│   │   │       ├── config.ts
│   │   │       ├── metrics.ts
│   │   │       └── validator.ts
│   │   ├── tests/                           # 测试
│   │   ├── config/                          # 配置文件
│   │   ├── scripts/                         # 脚本
│   │   ├── Dockerfile
│   │   ├── docker-compose.yml
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   ├── user-service/                        # 用户服务 (Node.js)
│   │   ├── README.md                        # 技术文档
│   │   ├── src/
│   │   │   ├── api/                         # REST API 层
│   │   │   │   ├── v1/
│   │   │   │   │   ├── auth.controller.ts   # 认证
│   │   │   │   │   ├── users.controller.ts  # 用户管理
│   │   │   │   │   ├── configs.controller.ts # 配置管理
│   │   │   │   │   ├── api-keys.controller.ts # API 密钥
│   │   │   │   │   └── notifications.controller.ts # 通知
│   │   │   │   └── dto/                     # DTO 定义
│   │   │   ├── core/                        # 核心逻辑
│   │   │   │   ├── auth/                    # 认证模块
│   │   │   │   │   ├── jwt.strategy.ts
│   │   │   │   │   ├── oauth.strategy.ts
│   │   │   │   │   └── guard/
│   │   │   │   ├── user/                    # 用户模块
│   │   │   │   │   ├── user.service.ts
│   │   │   │   │   ├── user.repository.ts
│   │   │   │   │   └── user.validator.ts
│   │   │   │   ├── config/                  # 配置模块
│   │   │   │   │   ├── config.service.ts
│   │   │   │   │   ├── config.repository.ts
│   │   │   │   │   └── config.validator.ts
│   │   │   │   └── api-key/                # API 密钥模块
│   │   │   │       ├── api-key.service.ts
│   │   │   │       ├── api-key.repository.ts
│   │   │   │       └── api-key.generator.ts
│   │   │   ├── entities/                    # 数据实体
│   │   │   │   ├── user.entity.ts
│   │   │   │   ├── config.entity.ts
│   │   │   │   ├── api-key.entity.ts
│   │   │   │   ├── notification.entity.ts
│   │   │   │   └── preference.entity.ts
│   │   │   ├── services/                    # 业务服务
│   │   │   │   ├── auth.service.ts
│   │   │   │   ├── user.service.ts
│   │   │   │   ├── config.service.ts
│   │   │   │   ├── api-key.service.ts
│   │   │   │   ├── notification.service.ts
│   │   │   │   └── email.service.ts
│   │   │   ├── subscribers/                 # 事件订阅
│   │   │   │   ├── user.subscriber.ts
│   │   │   │   └── config.subscriber.ts
│   │   │   ├── tasks/                       # 定时任务
│   │   │   │   ├── cleanup-tasks.ts
│   │   │   │   └── notification-tasks.ts
│   │   │   └── utils/                       # 工具类
│   │   │       ├── logger.ts
│   │   │       ├── config.ts
│   │   │       ├── validator.ts
│   │   │       ├── crypto.ts
│   │   │       └── email.ts
│   │   ├── tests/                           # 测试
│   │   ├── config/                          # 配置文件
│   │   ├── scripts/                         # 脚本
│   │   ├── Dockerfile
│   │   ├── docker-compose.yml
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   └── admin-service/                       # 管理后台 (Node.js + React)
│       ├── README.md                        # 技术文档
│       ├── src/                             # 后端
│       │   ├── api/                         # REST API 层
│       │   │   ├── v1/
│       │   │   │   ├── system/              # 系统管理
│       │   │   │   │   ├── monitor.controller.ts
│       │   │   │   │   ├── config.controller.ts
│       │   │   │   │   └── health.controller.ts
│       │   │   │   ├── user/                # 用户管理
│       │   │   │   │   ├── user.controller.ts
│       │   │   │   │   ├── role.controller.ts
│       │   │   │   │   └── permission.controller.ts
│       │   │   │   ├── strategy/            # 策略管理
│       │   │   │   │   ├── strategy.controller.ts
│       │   │   │   │   ├── backtest.controller.ts
│       │   │   │   │   └── signal.controller.ts
│       │   │   │   ├── risk/                # 风控管理
│       │   │   │   │   ├── rule.controller.ts
│       │   │   │   │   ├── alert.controller.ts
│       │   │   │   │   └── violation.controller.ts
│       │   │   │   ├── trading/             # 交易管理
│       │   │   │   │   ├── order.controller.ts
│       │   │   │   │   ├── position.controller.ts
│       │   │   │   │   └── account.controller.ts
│       │   │   │   └── report/              # 报表管理
│       │   │   │       ├── dashboard.controller.ts
│       │   │   │       ├── analytics.controller.ts
│       │   │   │       └── export.controller.ts
│       │   │   └── dto/                     # DTO 定义
│       │   ├── core/                        # 核心逻辑
│       │   │   ├── system/                  # 系统模块
│       │   │   │   ├── monitor.service.ts
│       │   │   │   ├── config.service.ts
│       │   │   │   └── health.service.ts
│       │   │   ├── user/                    # 用户模块
│       │   │   │   ├── user.service.ts
│       │   │   │   ├── role.service.ts
│       │   │   │   └── permission.service.ts
│       │   │   ├── strategy/                # 策略模块
│       │   │   │   ├── strategy.service.ts
│       │   │   │   ├── backtest.service.ts
│       │   │   │   └── signal.service.ts
│       │   │   ├── risk/                    # 风控模块
│       │   │   │   ├── rule.service.ts
│       │   │   │   ├── alert.service.ts
│       │   │   │   └── violation.service.ts
│       │   │   ├── trading/                 # 交易模块
│       │   │   │   ├── order.service.ts
│       │   │   │   ├── position.service.ts
│       │   │   │   └── account.service.ts
│       │   │   └── report/                  # 报表模块
│       │   │       ├── dashboard.service.ts
│       │   │       ├── analytics.service.ts
│       │   │       └── export.service.ts
│       │   ├── entities/                    # 数据实体
│       │   │   ├── system/
│       │   │   │   ├── system-config.entity.ts
│       │   │   │   ├── system-log.entity.ts
│       │   │   │   └── system-alert.entity.ts
│       │   │   ├── user/
│       │   │   │   ├── admin-user.entity.ts
│       │   │   │   ├── role.entity.ts
│       │   │   │   └── permission.entity.ts
│       │   │   ├── strategy/
│       │   │   │   ├── strategy-template.entity.ts
│       │   │   │   └── backtest-result.entity.ts
│       │   │   ├── risk/
│       │   │   │   ├── risk-rule.entity.ts
│       │   │   │   └── risk-alert.entity.ts
│       │   │   └── report/
│       │   │       ├── dashboard-widget.entity.ts
│       │   │       └── report-template.entity.ts
│       │   ├── services/                    # 业务服务
│       │   │   ├── system.service.ts
│       │   │   ├── user.service.ts
│       │   │   ├── strategy.service.ts
│       │   │   ├── risk.service.ts
│       │   │   ├── trading.service.ts
│       │   │   ├── report.service.ts
│       │   │   └── notification.service.ts
│       │   ├── subscribers/                 # 事件订阅
│       │   │   ├── system.subscriber.ts
│       │   │   ├── user.subscriber.ts
│       │   │   └── trading.subscriber.ts
│       │   ├── tasks/                       # 定时任务
│       │   │   ├── system-tasks.ts
│       │   │   ├── report-tasks.ts
│       │   │   └── cleanup-tasks.ts
│       │   └── utils/                       # 工具类
│       │       ├── logger.ts
│       │       ├── config.ts
│       │       ├── validator.ts
│       │       ├── export.ts
│       │       └── chart.ts
│       ├── web/                             # 前端应用
│       │   ├── src/
│       │   │   ├── components/              # 组件
│       │   │   ├── pages/                   # 页面
│       │   │   │   ├── Dashboard/           # 仪表板
│       │   │   │   ├── System/              # 系统管理
│       │   │   │   ├── User/                # 用户管理
│       │   │   │   ├── Strategy/            # 策略管理
│       │   │   │   ├── Risk/                # 风控管理
│       │   │   │   ├── Trading/             # 交易管理
│       │   │   │   └── Report/              # 报表管理
│       │   │   ├── layouts/                 # 布局
│       │   │   ├── services/                # API 服务
│       │   │   ├── stores/                  # 状态管理
│       │   │   ├── utils/                   # 工具
│       │   │   └── styles/                  # 样式
│       │   ├── public/                      # 静态资源
│       │   └── package.json
│       ├── tests/                           # 测试
│       ├── config/                          # 配置文件
│       ├── scripts/                         # 脚本
│       ├── Dockerfile
│       ├── docker-compose.yml
│       ├── package.json
│       └── tsconfig.json
│
├── packages/                                # 共享能力
│   ├── contracts/                           # 核心数据结构 & 协议
│   │   ├── proto/                           # Protobuf 定义 (唯一真源)
│   │   │   ├── signal.proto                 # 信号协议
│   │   │   ├── order.proto                  # 订单协议
│   │   │   ├── position.proto               # 仓位协议
│   │   │   ├── account.proto                # 账户协议
│   │   │   └── risk.proto                   # 风控协议
│   │   ├── generated/                       # 生成的类型 (不可编辑)
│   │   │   ├── ts/                          # TypeScript 类型
│   │   │   ├── python/                      # Python 类型
│   │   │   ├── rust/                        # Rust 类型
│   │   │   └── go/                          # Go 类型
│   │   └── gen.sh                           # Proto 生成脚本
│   │
│   ├── risk-engine/                         # 风控规则 (Node.js)
│   │   ├── src/
│   │   │   ├── core/                        # 核心逻辑
│   │   │   │   ├── rule-base.ts             # 规则基类
│   │   │   │   ├── rule-engine.ts           # 规则引擎
│   │   │   │   └── context.ts               # 上下文
│   │   │   ├── rules/                       # 风控规则
│   │   │   │   ├── position-limit.ts        # 仓位限制
│   │   │   │   ├── daily-limit.ts           # 日限额
│   │   │   │   ├── drawdown-limit.ts        # 回撤限制
│   │   │   │   └── blacklist.ts             # 黑名单
│   │   │   └── utils/                       # 工具类
│   │   │       ├── logger.ts
│   │   │       └── validator.ts
│   │   ├── tests/                           # 测试
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   ├── hquant-py/                           # 组合 & 仓位模型 (Python)
│   │   ├── src/
│   │   │   ├── portfolio/                   # 组合管理
│   │   │   │   ├── portfolio.py             # 组合模型
│   │   │   │   ├── allocation.py            # 资产配置
│   │   │   │   └── rebalance.py             # 再平衡
│   │   │   ├── position/                    # 仓位管理
│   │   │   │   ├── position.py              # 仓位模型
│   │   │   │   ├── risk.py                  # 风险计算
│   │   │   │   └── performance.py           # 绩效计算
│   │   │   └── utils/                       # 工具类
│   │   │       ├── math.py                  # 数学工具
│   │   │       └── statistics.py            # 统计工具
│   │   ├── tests/                           # 测试
│   │   ├── requirements.txt
│   │   └── pyproject.toml
│   │
│   └── hquant-rust/                         # 指标库 (Rust)
│       ├── src/
│       │   ├── lib.rs                       # 库入口
│       │   ├── indicators/                  # 技术指标
│       │   │   ├── trend.rs                 # 趋势指标
│       │   │   ├── momentum.rs              # 动量指标
│       │   │   ├── volatility.rs            # 波动率指标
│       │   │   └── volume.rs                # 成交量指标
│       │   └── utils/                       # 工具类
│       │       ├── math.rs                  # 数学工具
│       │       └── statistics.rs            # 统计工具
│       ├── tests/                           # 测试
│       ├── Cargo.toml
│       └── Cargo.lock
│
├── infra/                                   # 基础设施
│   ├── exchange-adapters/                   # 交易所适配
│   │   ├── binance/
│   │   │   ├── adapter.py                   # Python 适配器
│   │   │   ├── adapter.ts                   # TypeScript 适配器
│   │   │   └── README.md
│   │   ├── okx/
│   │   │   ├── adapter.py
│   │   │   ├── adapter.ts
│   │   │   └── README.md
│   │   └── bybit/
│   │       ├── adapter.py
│   │       ├── adapter.ts
│   │       └── README.md
│   │
│   ├── message-bus/                         # NATS 消息总线
│   │   ├── subjects/                        # 主题定义
│   │   │   ├── market-data.ts
│   │   │   ├── signals.ts
│   │   │   ├── orders.ts
│   │   │   └── trades.ts
│   │   ├── publishers/                      # 消息发布
│   │   │   ├── market-data-publisher.ts
│   │   │   ├── signal-publisher.ts
│   │   │   └── order-publisher.ts
│   │   └── subscribers/                     # 消息订阅
│   │       ├── market-data-subscriber.ts
│   │       ├── signal-subscriber.ts
│   │       └── order-subscriber.ts
│   │
│   └── storage/                             # 数据存储
│       ├── database/                        # 数据库
│       │   ├── migrations/                  # 迁移脚本
│       │   ├── seeds/                       # 种子数据
│       │   └── schema/                      # 数据库结构
│       ├── cache/                           # 缓存
│       │   ├── redis/
│       │   └── memcached/
│       └── object-storage/                  # 对象存储
│           └── s3/
│
├── logs/                                    # 日志文件
│   ├── strategy.log                         # 策略引擎日志
│   ├── strategy.err                         # 策略引擎错误日志
│   ├── trading.log                          # 交易引擎日志
│   ├── trading.err                          # 交易引擎错误日志
│   ├── user.log                             # 用户服务日志
│   ├── user.err                             # 用户服务错误日志
│   ├── admin.log                            # 管理后台日志
│   └── admin.err                            # 管理后台错误日志
│
├── docs/                                    # 文档
│   ├── app.md                               # 架构设计文档
│   ├── PROJECT_STRUCTURE.md                 # 项目结构文档
│   ├── API.md                               # API 文档
│   ├── DEPLOYMENT.md                        # 部署文档
│   └── DEVELOPMENT.md                       # 开发文档
│
├── docker-compose.yml                       # Docker 编排
├── docker-compose.prod.yml                  # 生产环境编排
├── docker-compose.monitoring.yml            # 监控编排
├── .env.example                             # 环境变量模板
├── .gitignore
├── LICENSE
└── README.md                                # 项目总览
```

## 核心数据流

### 1. 实时交易流
```
市场数据 (NATS) → Strategy Engine → 信号生成 → NATS → Trading Engine → 风控检查 → 交易所 → 订单执行 → 仓位更新 → NATS → 用户通知
```

### 2. 回测流
```
历史数据 → Backtest Engine → 策略回测 → 指标计算 → 结果存储 → 报表生成 → 用户查看
```

### 3. 用户流
```
用户登录 → User Service → 认证授权 → 配置管理 → 策略启动 → 信号订阅 → 交易执行
```

### 4. 管理流
```
Admin Service → 系统监控 → 用户管理 → 策略管理 → 风控管理 → 报表导出
```

## 技术栈映射

| 组件 | 语言 | 框架 | 数据库 | 消息队列 |
|------|------|------|--------|----------|
| Strategy Engine | Python | FastAPI + Celery | PostgreSQL + Redis | NATS |
| Trading Engine | Node.js | NestJS | PostgreSQL + Redis | NATS |
| User Service | Node.js | NestJS | PostgreSQL + Redis | - |
| Admin Service | Node.js + React | NestJS + Ant Design | PostgreSQL + Redis | NATS |
| Risk Engine | Node.js | - | - | - |
| HQuant-Py | Python | - | - | - |
| HQuant-Rust | Rust | - | - | - |

## 部署架构

### 开发环境
```
Local Machine
├── Docker Compose
│   ├── Strategy Engine (localhost:8000)
│   ├── Trading Engine (localhost:3000)
│   ├── User Service (localhost:3001)
│   ├── Admin Service (localhost:8080)
│   ├── PostgreSQL
│   ├── Redis
│   └── NATS
```

### 生产环境
```
Kubernetes Cluster
├── Namespace: strategy
│   ├── Strategy Engine (Deployment)
│   └── Strategy Engine Service
├── Namespace: trading
│   ├── Trading Engine (Deployment)
│   └── Trading Engine Service
├── Namespace: user
│   ├── User Service (Deployment)
│   └── User Service Service
├── Namespace: admin
│   ├── Admin Service (Deployment)
│   ├── Admin Service Service
│   └── Admin Frontend (Deployment)
├── Namespace: infrastructure
│   ├── PostgreSQL (StatefulSet)
│   ├── Redis (StatefulSet)
│   ├── NATS (StatefulSet)
│   └── Elasticsearch (StatefulSet)
└── Namespace: monitoring
    ├── Prometheus (Deployment)
    ├── Grafana (Deployment)
    └── AlertManager (Deployment)
```

## 数据库设计

### 核心表关系
```
users (用户)
├── user_configs (用户配置)
├── api_keys (API 密钥)
├── notification_settings (通知设置)
└── strategies (策略)

strategies (策略)
├── backtests (回测)
├── signals (信号)
└── strategy_configs (策略配置)

orders (订单)
├── trades (成交)
└── positions (仓位)

risk_rules (风控规则)
├── risk_alerts (风控告警)
└── risk_violations (风控违规)

system_configs (系统配置)
├── system_logs (系统日志)
└── system_alerts (系统告警)
```

## 开发工作流

### 1. 本地开发
```bash
# 1. 克隆项目
git clone <repository>
cd auto-trader

# 2. 配置环境变量
cp .env.example .env
vim .env

# 3. 启动开发环境
docker-compose up -d

# 4. 查看日志
docker-compose logs -f <service>

# 5. 开发代码
# 修改代码后，服务会自动重启（如果配置了热重载）
```

### 2. 添加新功能
```bash
# 1. 创建特性分支
git checkout -b feature/new-feature

# 2. 开发代码
# - 修改/添加代码
# - 添加测试
# - 更新文档

# 3. 提交代码
git add .
git commit -m "feat: add new feature"

# 4. 推送分支
git push origin feature/new-feature

# 5. 创建 Pull Request
# - 等待代码审查
# - 修复问题
# - 合并到主分支
```

### 3. 部署流程
```bash
# 1. 构建镜像
docker-compose build

# 2. 运行测试
docker-compose run --rm strategy-engine pytest
docker-compose run --rm trading-engine npm test

# 3. 部署到生产
docker-compose -f docker-compose.prod.yml up -d

# 4. 监控部署
docker-compose logs -f
```

## 监控与告警

### 1. 监控指标
- **系统指标**: CPU、内存、磁盘、网络
- **应用指标**: 请求量、响应时间、错误率
- **业务指标**: 订单量、交易量、盈亏
- **风控指标**: 违规次数、告警数量

### 2. 告警规则
- **严重告警**: 系统宕机、数据丢失、资金异常
- **警告告警**: 性能下降、错误率上升、限额接近
- **信息告警**: 系统维护、配置变更、用户操作

### 3. 监控工具
- **Prometheus**: 指标收集
- **Grafana**: 可视化
- **AlertManager**: 告警管理
- **Elasticsearch**: 日志存储
- **Kibana**: 日志分析

## 安全架构

### 1. 认证授权
- JWT 令牌
- OAuth2 支持
- API 密钥
- 基于角色的访问控制 (RBAC)

### 2. 数据安全
- 数据库加密
- 传输加密 (HTTPS)
- 敏感数据脱敏
- 审计日志

### 3. 交易安全
- 风控前置
- 订单限额
- 仓位限制
- 异常检测

### 4. 网络安全
- 防火墙规则
- IP 白名单
- DDoS 防护
- WAF

## 性能优化

### 1. 数据库优化
- 索引优化
- 查询优化
- 连接池
- 数据分区

### 2. 缓存策略
- Redis 缓存
- 多级缓存
- 缓存预热
- 缓存失效

### 3. 并发处理
- 异步处理
- 多进程/多线程
- 消息队列
- 负载均衡

### 4. 资源管理
- 连接池
- 内存管理
- CPU 优化
- 磁盘 I/O

## 扩展性设计

### 1. 插件系统
- 策略插件
- 交易所插件
- 风控插件
- 通知插件

### 2. 多租户支持
- 租户隔离
- 租户配置
- 租户管理
- 租户计费

### 3. 微服务架构
- 服务发现
- 负载均衡
- 熔断器
- 链路追踪

## 参考文档

- [架构设计文档](app.md)
- [API 文档](API.md)
- [部署文档](DEPLOYMENT.md)
- [开发文档](DEVELOPMENT.md)
- [策略引擎文档](apps/strategy-engine/README.md)
- [交易引擎文档](apps/trading-engine/README.md)
- [用户服务文档](apps/user-service/README.md)
- [管理后台文档](apps/admin-service/README.md)

---

**版本**: 1.0.0
**最后更新**: 2026-01-22
**维护者**: 量化团队