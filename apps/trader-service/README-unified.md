# Trading Platform Service (量化交易统一服务)

> 基于 Python FastAPI 的量化交易核心服务平台

## 概述

Trading Platform Service 是量化交易系统的核心业务平台，整合用户管理、策略引擎、交易执行、风控管理等功能于一体。

### 核心能力

| 模块 | 说明 |
|------|------|
| 用户管理 | 用户认证授权（Casdoor）、交易所配置、权限管理 |
| 策略管理 | 策略创建、编辑、版本管理、参数配置 |
| 用户策略绑定 | 用户订阅策略、交易对配置、风控规则绑定 |
| 策略执行 | 实时策略运行、多用户多策略并发、信号生成 |
| 离线策略探索 | 历史回测、参数优化、ML/DeepLearning 模型训练 |
| 数据订阅 | 实时 K 线、订单簿数据订阅 |
| 信号发布 | 交易信号生成与分发 |
| 风控管理 | 账户级/仓位级风控、止盈止损配置 |
| 交易执行 | 通过 gRPC 调用下单服务（ExchangeService） |

---

## 系统架构

### 整体架构

```
┌─────────────────────────────────────────────────────────────────────────┐
│                      Trading Platform Service                            │
│                         (Python FastAPI)                                 │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │                        API Gateway Layer                         │    │
│  │  ┌───────────────────────────┐  ┌───────────────────────────┐   │    │
│  │  │       REST API            │  │   WebSocket (信号推送)     │   │    │
│  │  │   (FastAPI + Uvicorn)     │  │                           │   │    │
│  │  └───────────────────────────┘  └───────────────────────────┘   │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                                    │                                     │
│  ┌─────────────────────────────────┼─────────────────────────────────┐  │
│  │                     Core Business Layer                            │  │
│  │                                                                     │  │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────────┐ │  │
│  │  │ 用户管理模块  │  │ 策略管理模块  │  │ 用户策略绑定模块         │ │  │
│  │  │ User Module  │  │Strategy Mgmt │  │ User-Strategy Binding    │ │  │
│  │  └──────────────┘  └──────────────┘  └──────────────────────────┘ │  │
│  │                                                                     │  │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────────┐ │  │
│  │  │ 策略执行模块  │  │ 离线探索模块  │  │ 风控管理模块             │ │  │
│  │  │ Executor     │  │ Backtest/ML  │  │ Risk Management          │ │  │
│  │  └──────────────┘  └──────────────┘  └──────────────────────────┘ │  │
│  │                                                                     │  │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────────┐ │  │
│  │  │ 数据订阅模块  │  │ 信号发布模块  │  │ 交易执行模块             │ │  │
│  │  │ Data Sub     │  │ Signal Pub   │  │ Order Executor           │ │  │
│  │  └──────────────┘  └──────────────┘  └──────────────────────────┘ │  │
│  └─────────────────────────────────────────────────────────────────────┘  │
│                                    │                                     │
│  ┌─────────────────────────────────┼─────────────────────────────────┐  │
│  │                     Infrastructure Layer                           │  │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────────┐   │  │
│  │  │PostgreSQL│  │  Redis   │  │   NATS   │  │ hquant-py (Rust) │   │  │
│  │  │  数据库   │  │  缓存    │  │  消息队列 │  │  指标计算引擎     │   │  │
│  │  └──────────┘  └──────────┘  └──────────┘  └──────────────────┘   │  │
│  └─────────────────────────────────────────────────────────────────────┘  │
│                                    │                                     │
│                                    │ gRPC                                │
│                                    ▼                                     │
│                    ┌───────────────────────────────┐                     │
│                    │      ExchangeService          │                     │
│                    │      (下单服务 gRPC)           │                     │
│                    │  PlaceOrder / CancelOrder     │                     │
│                    │  GetPositions / GetBalance    │                     │
│                    └───────────────────────────────┘                     │
└─────────────────────────────────────────────────────────────────────────┘
```

### 技术栈

| 类别 | 技术 | 说明 |
|------|------|------|
| Web 框架 | FastAPI | 异步 HTTP 服务，高性能 |
| ASGI 服务器 | Uvicorn | 生产级 ASGI 服务器 |
| gRPC 客户端 | grpcio | 调用 ExchangeService 下单服务 |
| 量化计算 | hquant-py | 技术指标计算（Rust 绑定，高性能） |
| 数据库 | PostgreSQL 15+ | 主数据存储 |
| ORM | SQLAlchemy 2.0 | 异步数据库访问 |
| 缓存 | Redis 7+ | 会话、缓存、实时状态 |
| 消息队列 | NATS 2.x | 实时数据订阅、信号发布 |
| 认证 | Casdoor / JWT | 统一认证授权 |
| 数据验证 | Pydantic 2.x | 请求/响应模型验证 |

---

## 模块设计

### 1. 用户管理模块 (User Module)

#### 功能描述

- **用户认证**：集成 Casdoor 实现 OAuth 2.0 / OIDC 统一认证
- **用户信息管理**：基本信息、角色权限、账户状态
- **交易所配置**：用户绑定交易所 API Key（加密存储）
- **多交易所支持**：Binance、OKX 等主流交易所

#### 数据实体

| 实体 | 字段 | 说明 |
|------|------|------|
| User | id, casdoor_id, username, role, is_active, created_at | 用户信息 |
| UserExchange | id, user_id, exchange_type, name, api_key, api_secret, passphrase, is_testnet, is_active | 用户交易所配置 |

#### API 接口

| 接口 | 方法 | 说明 |
|------|------|------|
| `/api/v1/auth/callback` | GET | Casdoor OAuth 回调 |
| `/api/v1/auth/logout` | POST | 登出 |
| `/api/v1/user/me` | GET | 获取当前用户信息 |
| `/api/v1/exchanges` | GET | 获取交易所配置列表 |
| `/api/v1/exchanges` | POST | 添加交易所配置 |
| `/api/v1/exchanges/{id}` | PUT | 更新交易所配置 |
| `/api/v1/exchanges/{id}` | DELETE | 删除交易所配置 |
| `/api/v1/exchanges/{id}/test` | POST | 测试交易所连接 |

---

### 2. 策略管理模块 (Strategy Management)

#### 功能描述

- **策略定义**：支持多种策略类型
  - DSL 脚本策略：使用 hquant DSL 语法定义简单技术指标策略
  - Python 代码策略：支持复杂逻辑的 Python 策略
  - ML 模型策略：PyTorch/ONNX 模型推理
- **策略参数**：可配置的策略参数（如均线周期、阈值等）
- **策略版本**：策略代码版本管理
- **策略市场**：公共策略发布与订阅

#### 策略类型

| 类型 | 实现方式 | 适用场景 |
|------|----------|----------|
| DSL 脚本 | hquant DSL 解析器 | 简单技术指标策略（EMA/RSI/MACD 等） |
| Python 代码 | 动态加载 Python 模块 | 复杂逻辑策略 |
| ML 模型 | ONNX Runtime 推理 | 深度学习预测策略 |

#### 数据实体

| 实体 | 字段 | 说明 |
|------|------|------|
| Strategy | id, user_id, name, description, tag, code, params, version, status, is_public, created_at | 策略定义 |
tag 定义：中性 看多 做空
status: 启动 停用
#### API 接口

| 接口 | 方法 | 说明 |
|------|------|------|
| `/api/v1/strategies` | GET | 获取策略列表 |
| `/api/v1/strategies` | POST | 创建策略(所有人创建的都是公共策略) |
| `/api/v1/strategies/{id}` | GET | 获取策略详情 |
| `/api/v1/strategies/{id}` | PUT | 更新策略() |
| `/api/v1/strategies/{id}` | DELETE | 删除策略 |
| `/api/v1/strategies/available` | GET | 获取可用策略列表（含公共策略） |

---

### 3. 用户策略绑定模块 (User-Strategy Binding)

#### 功能描述

- **策略订阅**：用户绑定策略 + 交易对 + 交易所
- **参数配置**：覆盖策略默认参数
- **风控配置**：绑定账户级/仓位级风控规则
- **状态管理**：启动/停止策略运行
- **策略复用**：多用户共享同一策略实例（相同策略+交易对）

#### 策略复用机制

```
策略实例 Key = (strategy_id, symbol, exchange, trade_type)

示例：
- 用户 A 使用 EMA 策略交易 BTC-USDT
- 用户 B 使用 EMA 策略交易 BTC-USDT
→ 共享同一个策略执行实例，分别发布信号

当最后一个用户取消订阅时，策略实例销毁
```

#### 数据实体

| 实体 | 字段 | 说明 |
|------|------|------|
| StrategyOrder | id, user_id, strategy_id, exchange_id, symbols, parameters, risk_config, live, started_at, stopped_at | 用户策略绑定 |

#### 风控配置结构

| 层级 | 配置项 | 说明 |
|------|--------|------|
| 账户级 | max_daily_loss | 单日最大亏损（USDT） |
| 账户级 | max_margin_usage_pct | 最大保证金使用率 |
| 账户级 | on_breach | 越界行为（BLOCK_TRADING / CLOSE_ALL） |
| 仓位级 | stop_profit_pct | 止盈比例 |
| 仓位级 | stop_loss_pct | 止损比例 |
| 仓位级 | max_loss_per_position | 单仓最大亏损 |
| 仓位级 | cooldown | 风控冷却时间 |
| 品种级 | symbols.{symbol} | 特定品种覆盖配置 |

#### API 接口

| 接口 | 方法 | 说明 |
|------|------|------|
| `/api/v1/strategy-order` | GET | 获取策略绑定列表 |
| `/api/v1/strategy-order` | POST | 创建策略绑定 |
| `/api/v1/strategy-order/{id}` | GET | 获取绑定详情 |
| `/api/v1/strategy-order/{id}` | PUT | 更新策略绑定 |
| `/api/v1/strategy-order/{id}` | DELETE | 解绑策略 |
| `/api/v1/strategy-order/{id}/start` | POST | 启动策略 |
| `/api/v1/strategy-order/{id}/stop` | POST | 停止策略 |
| `/api/v1/strategy-order/{id}/stats` | GET | 获取策略运行统计 |

---

### 4. 策略执行模块 (Strategy Executor)

#### 功能描述

- **实时执行**：接收市场数据，执行策略逻辑，生成交易信号
- **多策略并发**：支持多用户、多策略、多交易对并发运行
- **指标计算**：基于 hquant-py 高性能技术指标计算
- **动态管理**：策略实例按需创建/销毁，优化资源使用

#### 执行流程

1. 接收 K 线数据（通过 NATS 订阅）
2. 更新策略上下文（历史数据缓存）
3. 调用指标计算（hquant-py，支持 15m → 4h/1d 聚合）
4. 执行策略规则/模型推理
5. 生成交易信号（BUY/SELL/HOLD）
6. 发布信号到 NATS（多用户分发）
7. 调用交易执行模块下单

#### 支持的技术指标

| 类别 | 指标 |
|------|------|
| 趋势类 | SMA、EMA、MACD、Bollinger Bands |
| 动量类 | RSI、KDJ、CCI、Williams %R |
| 成交量类 | OBV、CMF、VWAP |
| 自定义 | 支持 Python 扩展 |

#### 性能优化

- Rust 底层实现（hquant-py），10-100 倍性能提升
- 增量计算，只计算新增数据
- 结果缓存，避免重复计算
- K 线数据滑动窗口（默认保留最近 1000 条）

---

### 5. 离线策略探索模块 (Offline Exploration)

#### 功能描述

- **历史回测**：基于历史 K 线数据进行策略回测
- **绩效评估**：计算收益率、夏普比、最大回撤等指标
- **参数优化**：网格搜索、遗传算法优化策略参数
- **ML 模型训练**：深度学习策略模型离线训练

#### 回测流程

1. 加载历史 K 线数据（PostgreSQL）
2. 初始化回测账户（初始资金、手续费率）
3. 逐 K 线回放，执行策略
4. 记录每笔交易（开仓/平仓）
5. 计算绩效指标
6. 生成回测报告

#### 绩效指标

| 指标 | 说明 |
|------|------|
| total_return | 总收益率 |
| annual_return | 年化收益率 |
| sharpe_ratio | 夏普比率 |
| sortino_ratio | 索提诺比率 |
| max_drawdown | 最大回撤 |
| win_rate | 胜率 |
| profit_loss_ratio | 盈亏比 |
| total_trades | 总交易次数 |

#### ML/DeepLearning 支持

| 模型类型 | 说明 |
|----------|------|
| TCN | 时序卷积网络，适合捕捉长期依赖 |
| Transformer-lite | 轻量级 Transformer，适合多特征融合 |
| LSTM/GRU | 经典循环神经网络 |

**特征工程**：
- 价格特征：涨跌幅、振幅
- 技术指标特征：RSI、EMA 差值等
- 成交量特征：成交量比
- 时间特征：周期编码（hour_sin/cos、day_of_week）

#### API 接口

| 接口 | 方法 | 说明 |
|------|------|------|
| `/api/v1/backtests` | POST | 运行回测 |
| `/api/v1/backtests` | GET | 获取回测列表 |
| `/api/v1/backtests/{id}` | GET | 获取回测结果 |
| `/api/v1/backtests/{id}/progress` | GET | 获取回测进度 |
| `/api/v1/ml/train` | POST | 提交 ML 模型训练任务 |
| `/api/v1/ml/models` | GET | 获取已训练模型列表 |

---

### 6. 数据订阅模块 (Data Subscription)

#### 功能描述

- **K 线数据订阅**：实时接收交易所 K 线数据
- **订单簿数据**：实时订单簿深度数据
- **多周期聚合**：15m → 4h/1d 自动聚合

#### NATS 订阅主题

| 主题格式 | 示例 | 说明 |
|----------|------|------|
| `{prefix}.candle.{exchange}.{tradeType}.{symbol}.{period}` | `exchange.candle.binance.spot.BTC-USDT.15m` | K 线更新 |
| `{prefix}.orderbook.{exchange}.{tradeType}.{symbol}` | `exchange.orderbook.okx.futures.ETH-USDT` | 订单簿更新 |

---

### 7. 信号发布模块 (Signal Publishing)

#### 功能描述

- **信号生成**：策略执行后生成 BUY/SELL/HOLD 信号
- **信号分发**：按用户+交易对发布到 NATS
- **信号存储**：持久化信号记录用于分析

#### NATS 发布主题

| 主题格式 | 示例 | 说明 |
|----------|------|------|
| `signals.{exchange}.{symbol}.{tradeType}` | `signals.binance.BTC-USDT.spot` | 交易信号 |

#### 信号数据结构

| 字段 | 类型 | 说明 |
|------|------|------|
| signal_id | string | 信号唯一 ID |
| subscription_id | string | 用户订阅 ID |
| symbol | string | 交易对 |
| action | enum | BUY / SELL / HOLD |
| price | number | 当前价格 |
| confidence | number | 信号置信度 (0-1) |
| indicators | object | 相关指标值 |
| timestamp | datetime | 信号时间戳 |

---

### 8. 交易执行模块 (Order Executor)

#### 功能描述

通过 gRPC 调用 ExchangeService 下单服务，实现交易执行。

#### gRPC 服务调用 (ExchangeService)

**服务端点**：`exchange-service:50051`

| 方法 | 请求 | 响应 | 说明 |
|------|------|------|------|
| InitAccount | InitAccountRequest | InitAccountResponse | 初始化账户，获取 Token |
| ValidateToken | ValidateTokenRequest | ValidateTokenResponse | 验证 Token 有效性 |
| InvalidateToken | InvalidateTokenRequest | InvalidateTokenResponse | 注销账户 Token |
| PlaceOrder | PlaceOrderRequest | PlaceOrderResponse | 下单 |
| PlaceOrders | PlaceOrdersRequest | PlaceOrdersResponse | 批量下单 |
| CancelOrder | CancelOrderRequest | CancelOrderResponse | 撤单 |
| GetOrder | GetOrderRequest | GetOrderResponse | 查询订单 |
| GetOrders | GetOrdersRequest | GetOrdersResponse | 查询订单列表 |
| GetPositions | GetPositionsRequest | GetPositionsResponse | 获取持仓 |
| SyncPositions | SyncPositionsRequest | SyncPositionsResponse | 同步持仓 |
| GetBalance | GetBalanceRequest | GetBalanceResponse | 获取余额 |
| GetPrice | GetPriceRequest | GetPriceResponse | 获取行情 |
| SetLeverage | SetLeverageRequest | SetLeverageResponse | 设置杠杆 |
| SubscribeOrders | SubscribeOrdersRequest | stream OrderUpdate | 订单更新流 |

#### 枚举类型

| 枚举 | 值 | 说明 |
|------|------|------|
| Exchange | OKX, BINANCE | 交易所类型 |
| TradeType | SPOT, FUTURES, DELIVERY | 交易类型 |
| OrderSide | BUY, SELL | 订单方向 |
| PositionSide | LONG, SHORT | 持仓方向 |
| OrderType | LIMIT, MARKET, MAKER_ONLY | 订单类型 |
| OrderStatus | PENDING, OPEN, PARTIAL, FILLED, CANCELED, REJECTED, EXPIRED | 订单状态 |

#### 交易执行流程

1. 用户添加交易所配置时，调用 `InitAccount` 获取 Token
2. 策略信号触发时，调用 `PlaceOrder` 下单
3. 风控触发时，调用 `CancelOrder` 撤单或 `PlaceOrder` 平仓
4. 定期调用 `SyncPositions` 同步持仓状态
5. 通过 `SubscribeOrders` 监听订单状态更新

#### API 接口 (HTTP -> gRPC 转发)

| 接口 | 方法 | 说明 |
|------|------|------|
| `/api/v1/orders` | GET | 获取订单列表 |
| `/api/v1/orders` | POST | 手动下单 |
| `/api/v1/orders/{id}` | GET | 获取订单详情 |
| `/api/v1/orders/{id}/cancel` | POST | 取消订单 |
| `/api/v1/positions` | GET | 获取持仓列表 |
| `/api/v1/positions/sync` | POST | 同步持仓 |
| `/api/v1/positions/{id}/close` | POST | 平仓 |
| `/api/v1/balance` | GET | 获取账户余额 |
| `/api/v1/leverage` | POST | 设置杠杆 |

---

### 9. 统计与后台管理模块 (Stats & Admin)

#### 功能描述

- **收益统计**：收益曲线、交易记录、绩效分析
- **用户管理**：用户列表、状态管理
- **策略监控**：全局策略运行状态
- **系统统计**：订单统计、系统指标

#### API 接口

| 接口 | 方法 | 说明 |
|------|------|------|
| `/api/v1/admin/users` | GET | 获取用户列表 |
| `/api/v1/admin/users/{id}/status` | PUT | 更新用户状态 |
| `/api/v1/admin/strategies` | GET | 获取所有策略统计(内部使用，实现service) |
| `/api/v1/admin/orders` | GET | 获取所有订单(内部使用，实现service) |

---

## 数据流设计

### 实时策略执行流

```
NATS (K 线数据)
  │
  ├─▶ strategy.BTC-USDT.EMA  ──▶ 计算指标 ──▶ 执行策略 ──▶ 生成信号
  │         ├─▶ User A 订阅                           │
  │         └─▶ User B 订阅                           │
  │                                                    │
  │                                                    ▼
  │                                           ┌───────────────┐
  │                                           │  信号分发      │
  │                                           └───────┬───────┘
  │                                                   │
  │                         ┌─────────────────────────┼─────────────────────────┐
  │                         │                         │                         │
  │                         ▼                         ▼                         ▼
  │                  NATS (信号)              gRPC PlaceOrder           风控检查
  │                  signals.binance.         ExchangeService           RiskModule
  │                  BTC-USDT.spot                  │
  │                                                 ▼
  │                                          交易所下单执行
  │
  └─▶ strategy.ETH-USDT.RSI  ──▶ 计算指标 ──▶ 执行策略 ──▶ 生成信号 ...
```

### 订单执行流

```
用户/策略触发下单
       │
       ▼
┌─────────────────┐
│ Order Executor  │
│   (FastAPI)     │
└────────┬────────┘
         │
         │ gRPC
         ▼
┌─────────────────┐
│ ExchangeService │
│   (下单服务)     │
└────────┬────────┘
         │
    ┌────┴────┐
    │         │
    ▼         ▼
 Binance    OKX
```

### 回测数据流

```
PostgreSQL (历史 K 线)
  │
  ▼
回测引擎
  ├─▶ 加载策略配置
  ├─▶ 初始化虚拟账户
  ├─▶ 逐 K 线回放
  ├─▶ 记录交易日志
  └─▶ 计算绩效指标
  │
  ▼
返回回测报告 (JSON)
```

---

## 项目结构

```
apps/trader-service/
├── app/
│   ├── main.py                       # FastAPI 应用入口
│   ├── config.py                     # 配置管理 (Pydantic Settings)
│   ├── dependencies.py               # 依赖注入
│   │
│   ├── api/                          # REST API 路由
│   │   ├── __init__.py
│   │   └── v1/
│   │       ├── __init__.py
│   │       ├── router.py             # 路由聚合
│   │       ├── auth.py               # 认证接口
│   │       ├── users.py              # 用户管理
│   │       ├── exchanges.py          # 交易所配置
│   │       ├── strategies.py         # 策略管理
│   │       ├── strategy_orders.py    # 用户策略订单
│   │       ├── orders.py             # 订单管理 (HTTP -> gRPC)
│   │       ├── positions.py          # 持仓管理 (HTTP -> gRPC)
│   │       ├── signals.py            # 信号查询
│   │       ├── backtests.py          # 回测接口
│   │       ├── stats.py              # 统计接口
│   │       └── admin.py              # 后台管理
│   │
│   ├── core/                         # 核心业务逻辑
│   │   ├── __init__.py
│   │   ├── strategy_manager.py       # 策略管理器
│   │   ├── strategy_executor.py      # 策略执行器
│   │   ├── indicator_calculator.py   # 指标计算器 (hquant-py)
│   │   ├── backtest_engine.py        # 回测引擎
│   │   ├── signal_publisher.py       # 信号发布器
│   │   ├── order_executor.py         # 订单执行器 (gRPC 客户端)
│   │   └── risk_manager.py           # 风控管理器
│   │
│   ├── strategies/                   # 策略实现
│   │   ├── __init__.py
│   │   ├── base.py                   # 策略基类
│   │   ├── dsl_strategy.py           # DSL 策略
│   │   ├── python_strategy.py        # Python 策略
│   │   └── ml_strategy.py            # ML 策略
│   │
│   ├── ml/                           # ML 模型
│   │   ├── __init__.py
│   │   ├── models/                   # 模型定义
│   │   ├── training/                 # 训练逻辑
│   │   └── inference/                # 推理逻辑
│   │
│   ├── grpc_client/                  # gRPC 客户端
│   │   ├── __init__.py
│   │   ├── exchange_client.py        # ExchangeService 客户端
│   │   └── generated/                # protobuf 生成代码
│   │       ├── exchange_pb2.py
│   │       └── exchange_pb2_grpc.py
│   │
│   ├── models/                       # Pydantic 模型 (Request/Response)
│   │   ├── __init__.py
│   │   ├── user.py
│   │   ├── exchange.py
│   │   ├── strategy.py
│   │   ├── strategy_order.py
│   │   ├── order.py
│   │   ├── position.py
│   │   ├── signal.py
│   │   └── backtest.py
│   │
│   ├── db/                           # 数据库
│   │   ├── __init__.py
│   │   ├── session.py                # 异步数据库连接
│   │   ├── models.py                 # SQLAlchemy ORM 模型
│   │   └── migrations/               # Alembic 迁移
│   │
│   ├── nats/                         # NATS 集成
│   │   ├── __init__.py
│   │   ├── client.py                 # NATS 客户端
│   │   ├── subscriber.py             # 订阅 K 线数据
│   │   ├── publisher.py              # 发布交易信号
│   │   └── topics.py                 # 主题定义
│   │
│   ├── services/                     # 业务服务层
│   │   ├── __init__.py
│   │   ├── user_service.py           # 用户服务 packages/casdoor-py
│   │   ├── exchange_service.py       # 交易所配置服务
│   │   ├── strategy_service.py       # 策略服务
│   │   ├── strategy_order_service.py # 策略订单配置
│   │   ├── order_service.py          # 订单服务
│   │   ├── position_service.py       # 持仓服务
│   │   ├── signal_service.py         # 信号服务
│   │   ├── backtest_service.py       # 回测服务
│   │   └── stats_service.py          # 统计服务
│   │
│   ├── middleware/                   # 中间件
│   │   ├── __init__.py
│   │   ├── auth.py                   # JWT 认证中间件 packages/casdoor-py
│   │   ├── logging.py                # 日志中间件
│   │   └── error_handler.py          # 异常处理
│   │
│   └── utils/                        # 工具函数
│       ├── __init__.py
│       ├── encryption.py             # 加密工具 (API Key)
│       ├── cache.py                  # Redis 缓存
│       └── metrics.py                # Prometheus 指标
│
├── protos/                           # Protocol Buffers 定义
│   └── exchange.proto                # 链接到 packages/contracts/proto/
│
├── scripts/                          # 工具脚本
│   ├── generate_proto.sh             # 生成 protobuf 代码
│   └── start.sh                      # 启动脚本
│
├── tests/                            # 测试
│   ├── unit/
│   ├── integration/
│   └── e2e/
│
├── pyproject.toml                    # Poetry 依赖管理
├── alembic.ini                       # Alembic 配置
├── Dockerfile
├── docker-compose.yml
└── README.md
```

---

## 依赖管理

### pyproject.toml

```toml
[tool.poetry]
name = "trader-service"
version = "1.0.0"
description = "Quantitative Trading Platform Service"
python = "^3.11"

[tool.poetry.dependencies]
# Web Framework
fastapi = "^0.109.0"
uvicorn = {extras = ["standard"], version = "^0.27.0"}
python-multipart = "^0.0.6"

# Database
sqlalchemy = {extras = ["asyncio"], version = "^2.0.25"}
asyncpg = "^0.29.0"
alembic = "^1.13.1"

# Cache & Message Queue
redis = "^5.0.1"
nats-py = "^2.6.0"

# gRPC
grpcio = "^1.60.0"
grpcio-tools = "^1.60.0"
protobuf = "^4.25.0"

# Data Validation
pydantic = "^2.5.3"
pydantic-settings = "^2.1.0"


# Quantitative
hquant-py = {path = "../../packages/hquant-py"}
onnxruntime = "^1.16.0"

# Monitoring
prometheus-client = "^0.19.0"

# Utils
python-dateutil = "^2.8.2"
```

---

## 配置管理

### 环境变量

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `APP_ENV` | 运行环境 | development |
| `APP_PORT` | 服务端口 | 9001 |
| `DATABASE_URL` | PostgreSQL 连接 | postgresql+asyncpg://...  |
| `REDIS_URL` | Redis 连接 | redis://localhost:16000/0 |
| `NATS_URL` | NATS 连接 | nats://localhost:16002 |
| `EXCHANGE_GRPC_URL` | 下单服务 gRPC 地址 | exchange-service:50051 |
| `CASDOOR_ENDPOINT` | Casdoor 服务地址 | http://auth.8and1.cn |
| `CASDOOR_CLIENT_ID` | Casdoor 客户端 ID | a1aa7c75ba336df51788 |
| `CASDOOR_CLIENT_SECRET` | Casdoor 客户端密钥 | - |
| `ENCRYPTION_KEY` | API Key 加密密钥 | - |

---

## 安全方案

### 认证授权

- Casdoor 集成：OAuth 2.0 / OIDC 统一认证å
- gRPC 调用：使用 ExchangeService Token 认证

### 数据安全

- API Key 加密存储：AES-256-GCM 加密
- 权限隔离：用户只能访问自己的数据

### 策略安全

- Python 代码沙箱：RestrictedPython 限制执行环境
- 执行超时：5 秒超时保护，防止死循环
- 资源限制：内存/CPU 使用限制

---

## 部署方案

### Docker 部署

| 服务 | 端口 | 说明 |
|------|------|------|
| trader-service | 9001 | 量化交易统一服务 |
| exchange-service | 50051 | 下单服务 (gRPC) |
| PostgreSQL | 15000 | 主数据库 |
| Redis | 16000 | 缓存/会话 |
| NATS | 15002 | 消息队列 |


### 健康检查

| 端点 | 说明 |
|------|------|
| `/health` | 服务存活检查 |

---


## 参考文档

- [FastAPI 文档](https://fastapi.tiangolo.com/)
- [gRPC Python 文档](https://grpc.io/docs/languages/python/)
- [SQLAlchemy 2.0 异步文档](https://docs.sqlalchemy.org/en/20/orm/extensions/asyncio.html)
- [Casdoor 文档](https://casdoor.org/docs/overview)
- [NATS 文档](https://docs.nats.io/)
- [hquant-py 文档](../../packages/hquant-py/README.md)
- [ExchangeService Proto](../../packages/contracts/proto/exchange.proto)

---

**版本**: 1.0.0
**端口**: 9001 (HTTP)
**最后更新**: 2026-02-01
