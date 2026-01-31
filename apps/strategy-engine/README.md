# Strategy Engine - 策略引擎

## 概述

策略引擎是量化交易系统的核心计算层，负责：
- 接收实时市场数据
- 运行量化交易策略
- 生成交易信号发布
- 策略回测与优化
- 指标计算与分析

### 核心能力

- **实时策略运行**：支持多用户、多策略、多交易对并发运行
- **高性能计算**：基于 Rust 的技术指标计算引擎（hquant-py）
- **灵活策略定义**：支持 DSL 脚本、Python 代码、ML 模型等多种策略形式
- **完整回测系统**：历史数据回测、策略优化、绩效分析
- **动态资源管理**：策略实例按需创建/销毁，优化资源使用

## 技术栈

| 类别 | 技术 | 说明 |
|------|------|------|
| 语言 | Python 3.11+ | 主要开发语言 |
| Web 框架 | FastAPI | 异步 HTTP 服务 |
| 消息队列 | NATS | 实时信号发布 |
| 消息队列| NATS | 接收实时数据(原始k线) |
| 数据库 | PostgreSQL | 策略/回测数据存储 |
| 量化库 | hquant-py | 技术指标计算 (Rust 绑定) |
| 认证 | JWT/OAuth 2.0 | Authorization: Bearer <JWT> |

## NATS 消息主题

### 订阅主题

| 主题 | 说明 | 数据格式 |
|------|------|----------|
| `{prefix}.candle.{exchange}.{tradeType}.{symbol}.{period}` | K 线更新 | `exchange.candle.binance.spot.BTC-USDT.15m` |
| `{prefix}.orderbook.{exchange}.{tradeType}.{symbol}` | 订单簿更新 | `exchange.orderbook.okx.futures.ETH-USDT` |

### 发布主题

| 主题 | 说明 | 数据格式 |
|------|------|----------|
| `strategy.signals.{symbol}.{tradeType}` | 交易信号 | Signal |


## 策略复用

用户复用：策略绑定用户
交易产品复用：策略绑定用户+symbol

举例：
A用户 使用EMA策略 量化交易 BTC-USDT/ETH-USDT
B用户 使用EMA策略 量化交易 BTC-USDT/ETH-USDT
C用户 使用向量策略 量化交易 BTC-USDT/ETH-USDT

总策略：EMA策略、向量策略
中数据流：BTC-USDT、ETH-USDT
总用户：A用户、B用户、C用户
当策略下单删除时，策略使用人数为0，策略则被移除


## 系统架构

### 整体架构图

```
┌─────────────────────────────────────────────────────────────────┐
│                         Strategy Engine                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌──────────────┐   ┌──────────────┐   ┌──────────────┐        │
│  │  FastAPI     │   │   Strategy   │   │   Backtest   │        │
│  │  Web Server  │──▶│   Manager    │──▶│   Engine     │        │
│  └──────────────┘   └──────────────┘   └──────────────┘        │
│         │                   │                   │                │
│         │                   ▼                   │                │
│         │          ┌──────────────┐             │                │
│         │          │   Strategy   │             │                │
│         │          │   Executor   │◀────────────┘                │
│         │          └──────────────┘                              │
│         │                   │                                     │
│         │                   ▼                                     │
│         │          ┌──────────────┐                              │
│         └─────────▶│   Indicator  │                              │
│                    │   Calculator │                              │
│                    └──────────────┘                              │
│                           │                                       │
└───────────────────────────┼───────────────────────────────────────┘
                            │
            ┌───────────────┼───────────────┐
            │               │               │
            ▼               ▼               ▼
    ┌──────────┐    ┌──────────┐   ┌──────────┐
    │   NATS   │    │   NATS   │   │PostgreSQL│
    │ (订阅数据) │    │ (发布信号) │   │  (存储)  │
    └──────────┘    └──────────┘   └──────────┘
```

### 核心模块

#### 1. Strategy Manager（策略管理器）

**职责**：
- 策略生命周期管理（创建、启动、停止、销毁）
- 用户策略订阅管理（用户-策略-交易对绑定关系）
- 策略实例池管理（复用机制）
- 资源动态分配与回收

**核心逻辑**：
```python
# 策略实例 Key = (strategy_id, symbol, exchange, trade_type)
# 策略订阅 Key = (user_id, strategy_id, symbol, exchange, trade_type)

当用户订阅策略时：
  if 策略实例已存在:
    增加引用计数
    创建用户订阅记录
  else:
    创建新策略实例
    订阅 NATS 数据流
    启动策略执行器
    创建用户订阅记录

当用户取消订阅时：
  删除用户订阅记录
  引用计数 -= 1
  if 引用计数 == 0:
    停止策略执行器
    取消 NATS 订阅
    销毁策略实例
```

#### 2. Strategy Executor（策略执行器）

**职责**：
- 接收实时市场数据（K 线、订单簿）
- 调用指标计算引擎
- 执行策略逻辑
- 生成交易信号
- 发布信号到 NATS

**策略类型支持**：

| 类型 | 实现方式 | 适用场景 |
|------|----------|----------|
| DSL 脚本 | hquant DSL 解析器 | 简单技术指标策略 |
| Python 代码 | 动态加载 Python 模块 | 复杂逻辑策略 |
| ML 模型 | PyTorch/ONNX 推理 | 深度学习策略 |

**执行流程**：
```python
1. 接收 K 线数据（通过 NATS）
2. 更新策略上下文（历史数据缓存）
3. 调用指标计算（hquant-py）
4. 执行策略规则/模型推理
5. 生成交易信号（BUY/SELL/HOLD）
6. 发布信号到 NATS（多用户分发）
```

#### 3. Indicator Calculator（指标计算器）

**职责**：
- 技术指标计算（基于 hquant-py）
- K 线数据聚合（1m → 5m/15m/1h/1d）
- 指标结果缓存管理

**支持的指标**：
- 趋势类：SMA、EMA、MACD、Bollinger Bands
- 动量类：RSI、KDJ、CCI、Williams %R
- 成交量类：OBV、CMF、VWAP
- 自定义指标：支持 Python 扩展

**性能优化**：
- Rust 底层实现（hquant-py）
- 增量计算（只计算新增数据）
- 结果缓存（避免重复计算）

#### 4. Backtest Engine（回测引擎）

**职责**：
- 历史数据回测
- 策略绩效评估
- 参数优化（网格搜索、遗传算法）
- 风险指标计算

**回测流程**：
```python
1. 加载历史 K 线数据（PostgreSQL）
2. 初始化回测账户（初始资金、手续费率）
3. 逐 K 线回放，执行策略
4. 记录每笔交易（开仓/平仓）
5. 计算绩效指标（收益率、夏普比、最大回撤）
6. 生成回测报告（JSON/HTML）
```

**绩效指标**：
- 总收益率、年化收益率
- 夏普比率、索提诺比率
- 最大回撤、胜率、盈亏比
- 交易次数、持仓时间分布

## 数据流设计

### 实时策略执行流

```
NATS (K 线数据)
  │
  ├─▶ strategy.BTC-USDT.EMA  ──▶ 计算指标 ──▶ 执行策略 ──▶ NATS (信号)
  │         ├─▶ User A 订阅                           │
  │         └─▶ User B 订阅                           ├─▶ strategy.signals.BTC-USDT.spot (User A)
  │                                                    └─▶ strategy.signals.BTC-USDT.spot (User B)
  │
  └─▶ strategy.ETH-USDT.RSI  ──▶ 计算指标 ──▶ 执行策略 ──▶ NATS (信号)
            └─▶ User C 订阅                           └─▶ strategy.signals.ETH-USDT.spot (User C)
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

## API 接口设计

### 接口类型

策略引擎提供两种接口类型：

| 接口类型 | 适用场景 | 端口 | 协议 |
|---------|---------|------|------|
| **REST API** | Web 前端、第三方集成 | 8002 | HTTP/HTTPS |
| **gRPC API** | 内部微服务调用（高性能） | 50051 | gRPC/TLS |

### gRPC 接口设计

#### Proto 定义

```protobuf
// strategy_engine.proto
syntax = "proto3";

package strategy_engine.v1;

import "google/protobuf/timestamp.proto";
import "google/protobuf/empty.proto";

// 策略服务
service StrategyService {
  // 创建策略
  rpc CreateStrategy(CreateStrategyRequest) returns (StrategyResponse);

  // 获取策略详情
  rpc GetStrategy(GetStrategyRequest) returns (StrategyResponse);

  // 列出用户策略
  rpc ListStrategies(ListStrategiesRequest) returns (ListStrategiesResponse);

  // 删除策略
  rpc DeleteStrategy(DeleteStrategyRequest) returns (google.protobuf.Empty);
}

// 订阅服务
service SubscriptionService {
  // 订阅策略（启动实时运行）
  rpc Subscribe(SubscribeRequest) returns (SubscriptionResponse);

  // 取消订阅
  rpc Unsubscribe(UnsubscribeRequest) returns (google.protobuf.Empty);

  // 获取订阅状态
  rpc GetSubscription(GetSubscriptionRequest) returns (SubscriptionResponse);

  // 列出用户订阅
  rpc ListSubscriptions(ListSubscriptionsRequest) returns (ListSubscriptionsResponse);
}

// 信号服务
service SignalService {
  // 获取实时信号
  rpc GetSignals(GetSignalsRequest) returns (GetSignalsResponse);

  // 订阅信号流（Server Streaming）
  rpc StreamSignals(StreamSignalsRequest) returns (stream SignalEvent);
}

// 回测服务
service BacktestService {
  // 运行回测
  rpc RunBacktest(RunBacktestRequest) returns (BacktestResponse);

  // 获取回测结果
  rpc GetBacktest(GetBacktestRequest) returns (BacktestResponse);

  // 获取回测进度（Server Streaming）
  rpc StreamBacktestProgress(StreamBacktestProgressRequest) returns (stream BacktestProgressEvent);
}

// ========== 消息定义 ==========

// 策略类型
enum StrategyType {
  STRATEGY_TYPE_UNSPECIFIED = 0;
  STRATEGY_TYPE_DSL = 1;
  STRATEGY_TYPE_PYTHON = 2;
  STRATEGY_TYPE_ML = 3;
}

// 创建策略请求
message CreateStrategyRequest {
  string name = 1;
  string description = 2;
  StrategyType type = 3;
  string code = 4;
  map<string, string> params = 5;
}

// 策略响应
message StrategyResponse {
  string strategy_id = 1;
  string user_id = 2;
  string name = 3;
  string description = 4;
  StrategyType type = 5;
  string code = 6;
  map<string, string> params = 7;
  google.protobuf.Timestamp created_at = 8;
  google.protobuf.Timestamp updated_at = 9;
}

// 订阅请求
message SubscribeRequest {
  string strategy_id = 1;
  string exchange = 2;       // binance, okx, etc.
  string trade_type = 3;     // spot, futures
  string symbol = 4;         // BTC-USDT
  string period = 5;         // 1m, 5m, 15m, 1h, 1d
}

// 订阅响应
message SubscriptionResponse {
  string subscription_id = 1;
  string user_id = 2;
  string strategy_id = 3;
  string exchange = 4;
  string trade_type = 5;
  string symbol = 6;
  string period = 7;
  SubscriptionStatus status = 8;
  google.protobuf.Timestamp started_at = 9;
  google.protobuf.Timestamp stopped_at = 10;
}

enum SubscriptionStatus {
  SUBSCRIPTION_STATUS_UNSPECIFIED = 0;
  SUBSCRIPTION_STATUS_RUNNING = 1;
  SUBSCRIPTION_STATUS_STOPPED = 2;
}

// 信号事件
message SignalEvent {
  string signal_id = 1;
  string subscription_id = 2;
  string symbol = 3;
  SignalAction action = 4;
  double price = 5;
  double confidence = 6;
  map<string, double> indicators = 7;
  google.protobuf.Timestamp timestamp = 8;
}

enum SignalAction {
  SIGNAL_ACTION_UNSPECIFIED = 0;
  SIGNAL_ACTION_BUY = 1;
  SIGNAL_ACTION_SELL = 2;
  SIGNAL_ACTION_HOLD = 3;
}

// 运行回测请求
message RunBacktestRequest {
  string strategy_id = 1;
  string exchange = 2;
  string symbol = 3;
  string period = 4;
  string start_date = 5;     // YYYY-MM-DD
  string end_date = 6;       // YYYY-MM-DD
  double initial_margin = 7;
  double taker_fee_rate = 8;
}

// 回测响应
message BacktestResponse {
  string backtest_id = 1;
  string user_id = 2;
  string strategy_id = 3;
  BacktestStatus status = 4;
  int32 progress = 5;        // 0-100
  BacktestResult result = 6;
  google.protobuf.Timestamp created_at = 7;
  google.protobuf.Timestamp completed_at = 8;
}

enum BacktestStatus {
  BACKTEST_STATUS_UNSPECIFIED = 0;
  BACKTEST_STATUS_RUNNING = 1;
  BACKTEST_STATUS_COMPLETED = 2;
  BACKTEST_STATUS_FAILED = 3;
}

message BacktestResult {
  double total_return = 1;
  double annual_return = 2;
  double sharpe_ratio = 3;
  double max_drawdown = 4;
  double win_rate = 5;
  int32 total_trades = 6;
  double final_equity = 7;
}

// 其他请求消息（省略具体字段）
message GetStrategyRequest { string strategy_id = 1; }
message DeleteStrategyRequest { string strategy_id = 1; }
message ListStrategiesRequest { int32 page_size = 1; string page_token = 2; }
message ListStrategiesResponse { repeated StrategyResponse strategies = 1; string next_page_token = 2; }
message UnsubscribeRequest { string subscription_id = 1; }
message GetSubscriptionRequest { string subscription_id = 1; }
message ListSubscriptionsRequest { int32 page_size = 1; string page_token = 2; }
message ListSubscriptionsResponse { repeated SubscriptionResponse subscriptions = 1; string next_page_token = 2; }
message GetSignalsRequest { string subscription_id = 1; int32 limit = 2; }
message GetSignalsResponse { repeated SignalEvent signals = 1; }
message StreamSignalsRequest { string subscription_id = 1; }
message GetBacktestRequest { string backtest_id = 1; }
message StreamBacktestProgressRequest { string backtest_id = 1; }
message BacktestProgressEvent { string backtest_id = 1; int32 progress = 2; }
```

#### gRPC 使用示例

**Python 客户端**：
```python
import grpc
from strategy_engine.v1 import strategy_service_pb2, strategy_service_pb2_grpc

# 建立 TLS 连接
credentials = grpc.ssl_channel_credentials(
    root_certificates=open('certs/ca.crt', 'rb').read(),
    private_key=open('certs/client.key', 'rb').read(),
    certificate_chain=open('certs/client.crt', 'rb').read()
)

channel = grpc.secure_channel('strategy-engine:50051', credentials)
stub = strategy_service_pb2_grpc.StrategyServiceStub(channel)

# 创建策略
request = strategy_service_pb2.CreateStrategyRequest(
    name="EMA 交叉策略",
    description="双均线金叉死叉",
    type=strategy_service_pb2.STRATEGY_TYPE_DSL,
    code="IF EMA(5) > EMA(20) THEN BUY\nIF EMA(5) < EMA(20) THEN SELL",
    params={"fast_period": "5", "slow_period": "20"}
)

# 添加认证 Token
metadata = [('authorization', 'Bearer <JWT>')]
response = stub.CreateStrategy(request, metadata=metadata)
print(f"Strategy created: {response.strategy_id}")

# 订阅策略
subscription_stub = strategy_service_pb2_grpc.SubscriptionServiceStub(channel)
subscribe_request = strategy_service_pb2.SubscribeRequest(
    strategy_id=response.strategy_id,
    exchange="binance",
    trade_type="spot",
    symbol="BTC-USDT",
    period="15m"
)
subscription_response = subscription_stub.Subscribe(subscribe_request, metadata=metadata)

# 流式订阅信号
signal_stub = strategy_service_pb2_grpc.SignalServiceStub(channel)
stream_request = strategy_service_pb2.StreamSignalsRequest(
    subscription_id=subscription_response.subscription_id
)
for signal in signal_stub.StreamSignals(stream_request, metadata=metadata):
    print(f"Signal: {signal.action} {signal.symbol} @ {signal.price}")
```

**Golang 客户端**：
```go
package main

import (
    "context"
    "crypto/tls"
    "crypto/x509"
    "io/ioutil"
    "log"

    "google.golang.org/grpc"
    "google.golang.org/grpc/credentials"
    pb "your-module/strategy_engine/v1"
)

func main() {
    // 加载 TLS 证书
    cert, _ := tls.LoadX509KeyPair("certs/client.crt", "certs/client.key")
    certPool := x509.NewCertPool()
    ca, _ := ioutil.ReadFile("certs/ca.crt")
    certPool.AppendCertsFromPEM(ca)

    creds := credentials.NewTLS(&tls.Config{
        Certificates: []tls.Certificate{cert},
        RootCAs:      certPool,
    })

    // 建立连接
    conn, err := grpc.Dial("strategy-engine:50051", grpc.WithTransportCredentials(creds))
    if err != nil {
        log.Fatalf("Failed to connect: %v", err)
    }
    defer conn.Close()

    client := pb.NewStrategyServiceClient(conn)

    // 创建策略
    ctx := context.Background()
    req := &pb.CreateStrategyRequest{
        Name:        "EMA 交叉策略",
        Description: "双均线金叉死叉",
        Type:        pb.StrategyType_STRATEGY_TYPE_DSL,
        Code:        "IF EMA(5) > EMA(20) THEN BUY\nIF EMA(5) < EMA(20) THEN SELL",
        Params:      map[string]string{"fast_period": "5", "slow_period": "20"},
    }

    resp, err := client.CreateStrategy(ctx, req)
    if err != nil {
        log.Fatalf("CreateStrategy failed: %v", err)
    }
    log.Printf("Strategy created: %s", resp.StrategyId)
}
```

### REST API 接口

#### 策略管理

#### 创建策略
```http
POST /api/v1/strategies
Authorization: Bearer <JWT>
Content-Type: application/json

{
  "name": "EMA 交叉策略",
  "description": "双均线金叉死叉",
  "type": "dsl",  // dsl | python | ml
  "code": "IF EMA(5) > EMA(20) THEN BUY\nIF EMA(5) < EMA(20) THEN SELL",
  "params": {
    "fast_period": 5,
    "slow_period": 20
  }
}

Response:
{
  "strategy_id": "uuid-xxxx",
  "name": "EMA 交叉策略",
  "status": "created",
  "created_at": "2026-01-31T10:00:00Z"
}
```

#### 订阅策略（启动实时运行）
```http
POST /api/v1/subscriptions
Authorization: Bearer <JWT>
Content-Type: application/json

{
  "strategy_id": "uuid-xxxx",
  "exchange": "binance",
  "trade_type": "spot",
  "symbol": "BTC-USDT",
  "period": "15m"
}

Response:
{
  "subscription_id": "uuid-yyyy",
  "status": "running",
  "started_at": "2026-01-31T10:01:00Z"
}
```

#### 取消订阅（停止运行）
```http
DELETE /api/v1/subscriptions/{subscription_id}
Authorization: Bearer <JWT>

Response:
{
  "status": "stopped",
  "stopped_at": "2026-01-31T12:00:00Z"
}
```

### 回测接口

#### 运行回测
```http
POST /api/v1/backtests
Authorization: Bearer <JWT>
Content-Type: application/json

{
  "strategy_id": "uuid-xxxx",
  "exchange": "binance",
  "symbol": "BTC-USDT",
  "period": "15m",
  "start_date": "2025-01-01",
  "end_date": "2025-12-31",
  "initial_margin": 10000,
  "taker_fee_rate": 0.001
}

Response:
{
  "backtest_id": "uuid-zzzz",
  "status": "running",
  "progress": 0
}
```

#### 获取回测结果
```http
GET /api/v1/backtests/{backtest_id}
Authorization: Bearer <JWT>

Response:
{
  "backtest_id": "uuid-zzzz",
  "status": "completed",
  "progress": 100,
  "result": {
    "total_return": 0.235,       // 23.5% 收益率
    "annual_return": 0.235,
    "sharpe_ratio": 1.87,
    "max_drawdown": 0.12,
    "win_rate": 0.62,
    "total_trades": 156,
    "final_equity": 12350.00
  },
  "trades": [...],  // 交易明细
  "equity_curve": [...]  // 资金曲线
}
```

### 信号查询

#### 获取实时信号
```http
GET /api/v1/signals?subscription_id={subscription_id}&limit=10
Authorization: Bearer <JWT>

Response:
{
  "signals": [
    {
      "signal_id": "uuid-aaaa",
      "timestamp": "2026-01-31T10:15:00Z",
      "symbol": "BTC-USDT",
      "action": "BUY",
      "price": 42350.00,
      "confidence": 0.85,
      "indicators": {
        "ema_5": 42300.00,
        "ema_20": 42100.00,
        "rsi": 45.2
      }
    }
  ]
}
```

## 数据库设计

### 策略表（strategies）

```sql
CREATE TABLE strategies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  name VARCHAR(100) NOT NULL,
  description TEXT,
  type VARCHAR(20) NOT NULL,  -- dsl, python, ml
  code TEXT NOT NULL,
  params JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_strategies_user_id ON strategies(user_id);
```

### 策略订阅表（strategy_subscriptions）

```sql
CREATE TABLE strategy_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  strategy_id UUID NOT NULL REFERENCES strategies(id),
  exchange VARCHAR(20) NOT NULL,
  trade_type VARCHAR(20) NOT NULL,  -- spot, futures
  symbol VARCHAR(20) NOT NULL,
  period VARCHAR(10) NOT NULL,      -- 1m, 5m, 15m, 1h, 1d
  status VARCHAR(20) NOT NULL,      -- running, stopped
  started_at TIMESTAMP,
  stopped_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_subscription_unique ON strategy_subscriptions(
  user_id, strategy_id, exchange, trade_type, symbol, period
) WHERE status = 'running';
```

### 交易信号表（trading_signals）

```sql
CREATE TABLE trading_signals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id UUID NOT NULL REFERENCES strategy_subscriptions(id),
  symbol VARCHAR(20) NOT NULL,
  action VARCHAR(10) NOT NULL,  -- BUY, SELL, HOLD
  price DECIMAL(20, 8) NOT NULL,
  confidence DECIMAL(5, 4),
  indicators JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_signals_subscription ON trading_signals(subscription_id, created_at DESC);
CREATE INDEX idx_signals_symbol ON trading_signals(symbol, created_at DESC);
```

### 回测记录表（backtests）

```sql
CREATE TABLE backtests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  strategy_id UUID NOT NULL REFERENCES strategies(id),
  exchange VARCHAR(20) NOT NULL,
  symbol VARCHAR(20) NOT NULL,
  period VARCHAR(10) NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  initial_margin DECIMAL(20, 8) NOT NULL,
  taker_fee_rate DECIMAL(10, 8) NOT NULL,
  status VARCHAR(20) NOT NULL,  -- running, completed, failed
  progress INTEGER DEFAULT 0,
  result JSONB,                 -- 回测结果（收益率、夏普比等）
  created_at TIMESTAMP DEFAULT NOW(),
  completed_at TIMESTAMP
);

CREATE INDEX idx_backtests_user_id ON backtests(user_id, created_at DESC);
```

## ML/DeepLearning 策略支持

### 模型架构

支持的深度学习模型：
- **TCN (Temporal Convolutional Network)**：时序卷积网络，适合捕捉长期依赖
- **Transformer-lite**：轻量级 Transformer，适合多特征融合
- **LSTM/GRU**：经典循环神经网络

### 数据向量化

```python
# K 线数据 → 特征向量
features = [
  # 价格特征
  (close - open) / open,      # 涨跌幅
  (high - low) / open,        # 振幅

  # 技术指标特征
  rsi_14,                     # RSI
  (ema_5 - ema_20) / ema_20,  # EMA 差值

  # 成交量特征
  volume / volume_ma_20,      # 成交量比

  # 时间特征
  hour_sin, hour_cos,         # 小时（周期编码）
  day_of_week_sin, day_of_week_cos
]

# 历史窗口：过去 60 个时间步
X = features[-60:]  # shape: (60, feature_dim)
```

### 模型推理

```python
# 加载 ONNX 模型
import onnxruntime as ort

session = ort.InferenceSession("strategy_model.onnx")
prediction = session.run(None, {"input": X})[0]

# 预测结果 → 交易信号
if prediction[0] > 0.6:      # 上涨概率 > 60%
  signal = "BUY"
elif prediction[0] < 0.4:    # 下跌概率 > 60%
  signal = "SELL"
else:
  signal = "HOLD"
```

### 模型训练（离线）

```python
# 数据准备
historical_data = load_from_postgres(symbol, start_date, end_date)
X_train, y_train = prepare_features(historical_data)

# 模型训练
model = TCNModel(input_dim=10, hidden_dim=64, output_dim=1)
model.train(X_train, y_train, epochs=100)

# 导出 ONNX
torch.onnx.export(model, X_sample, "strategy_model.onnx")

# 回测验证
backtest_result = backtest_engine.run(model, test_data)
print(f"Sharpe Ratio: {backtest_result['sharpe_ratio']}")
```

## SSL/TLS 证书配置

### 证书生成

#### 1. 生成 CA 证书（Certificate Authority）

```bash
# 创建证书目录
mkdir -p certs && cd certs

# 生成 CA 私钥
openssl genrsa -out ca.key 4096

# 生成 CA 证书（有效期 10 年）
openssl req -new -x509 -days 3650 -key ca.key -out ca.crt \
  -subj "/C=CN/ST=Beijing/L=Beijing/O=TradingOrg/OU=IT/CN=Trading CA"
```

#### 2. 生成服务端证书

```bash
# 生成服务端私钥
openssl genrsa -out server.key 4096

# 生成证书签名请求 (CSR)
openssl req -new -key server.key -out server.csr \
  -subj "/C=CN/ST=Beijing/L=Beijing/O=TradingOrg/OU=IT/CN=strategy-engine"

# 创建扩展配置文件（支持 SAN）
cat > server_ext.cnf <<EOF
subjectAltName = DNS:strategy-engine,DNS:localhost,IP:127.0.0.1
EOF

# 使用 CA 签发服务端证书（有效期 1 年）
openssl x509 -req -days 365 -in server.csr \
  -CA ca.crt -CAkey ca.key -CAcreateserial \
  -out server.crt -extfile server_ext.cnf
```

#### 3. 生成客户端证书（用于双向认证）

```bash
# 生成客户端私钥
openssl genrsa -out client.key 4096

# 生成客户端 CSR
openssl req -new -key client.key -out client.csr \
  -subj "/C=CN/ST=Beijing/L=Beijing/O=TradingOrg/OU=IT/CN=strategy-client"

# 签发客户端证书
openssl x509 -req -days 365 -in client.csr \
  -CA ca.crt -CAkey ca.key -CAcreateserial \
  -out client.crt
```

#### 4. 验证证书

```bash
# 验证服务端证书
openssl verify -CAfile ca.crt server.crt

# 验证客户端证书
openssl verify -CAfile ca.crt client.crt

# 查看证书详情
openssl x509 -in server.crt -text -noout
```

### 证书目录结构

```
certs/
├── ca.crt              # CA 证书（公钥）
├── ca.key              # CA 私钥
├── server.crt          # 服务端证书
├── server.key          # 服务端私钥
├── client.crt          # 客户端证书
├── client.key          # 客户端私钥
└── README.md           # 证书说明文档
```

### 证书配置（应用代码）

#### gRPC 服务端配置

```python
# app/grpc/server.py
import grpc
from concurrent import futures
from app.grpc.services import (
    StrategyServiceServicer,
    SubscriptionServiceServicer,
    SignalServiceServicer,
    BacktestServiceServicer
)
from app.grpc.generated import (
    strategy_service_pb2_grpc,
    subscription_service_pb2_grpc,
    signal_service_pb2_grpc,
    backtest_service_pb2_grpc
)

def serve():
    # 读取 SSL 证书
    with open('/app/certs/server.key', 'rb') as f:
        server_key = f.read()
    with open('/app/certs/server.crt', 'rb') as f:
        server_cert = f.read()
    with open('/app/certs/ca.crt', 'rb') as f:
        ca_cert = f.read()

    # 配置 TLS（双向认证）
    server_credentials = grpc.ssl_server_credentials(
        [(server_key, server_cert)],
        root_certificates=ca_cert,
        require_client_auth=True  # 启用双向认证
    )

    # 创建 gRPC 服务器
    server = grpc.server(futures.ThreadPoolExecutor(max_workers=10))

    # 注册服务
    strategy_service_pb2_grpc.add_StrategyServiceServicer_to_server(
        StrategyServiceServicer(), server
    )
    subscription_service_pb2_grpc.add_SubscriptionServiceServicer_to_server(
        SubscriptionServiceServicer(), server
    )
    signal_service_pb2_grpc.add_SignalServiceServicer_to_server(
        SignalServiceServicer(), server
    )
    backtest_service_pb2_grpc.add_BacktestServiceServicer_to_server(
        BacktestServiceServicer(), server
    )

    # 绑定端口（TLS）
    server.add_secure_port('[::]:50051', server_credentials)

    print("gRPC server started on port 50051 (TLS)")
    server.start()
    server.wait_for_termination()

if __name__ == '__main__':
    serve()
```

#### FastAPI HTTPS 配置（可选）

```python
# app/main.py
import uvicorn
from fastapi import FastAPI

app = FastAPI(title="Strategy Engine API")

# ... API 路由定义 ...

if __name__ == "__main__":
    # 启用 HTTPS
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=8002,
        ssl_keyfile="/app/certs/server.key",
        ssl_certfile="/app/certs/server.crt",
        ssl_ca_certs="/app/certs/ca.crt"
    )
```

## 项目结构

```
apps/strategy-engine/
├── app/
│   ├── main.py                 # FastAPI 应用入口
│   ├── config.py               # 配置管理
│   ├── dependencies.py         # 依赖注入
│   │
│   ├── api/                    # HTTP REST API
│   │   ├── v1/
│   │   │   ├── strategies.py   # 策略管理 API
│   │   │   ├── subscriptions.py # 订阅管理 API
│   │   │   ├── backtests.py    # 回测 API
│   │   │   └── signals.py      # 信号查询 API
│   │   └── router.py
│   │
│   ├── grpc/                   # gRPC API
│   │   ├── server.py           # gRPC 服务器启动
│   │   ├── services/           # gRPC 服务实现
│   │   │   ├── strategy_service.py
│   │   │   ├── subscription_service.py
│   │   │   ├── signal_service.py
│   │   │   └── backtest_service.py
│   │   ├── interceptors/       # gRPC 拦截器
│   │   │   ├── auth.py         # JWT 认证
│   │   │   └── logging.py      # 日志记录
│   │   └── generated/          # 自动生成的 protobuf 代码
│   │       ├── strategy_service_pb2.py
│   │       ├── strategy_service_pb2_grpc.py
│   │       └── ...
│   │
│   ├── core/                   # 核心业务逻辑
│   │   ├── strategy_manager.py # 策略管理器
│   │   ├── strategy_executor.py # 策略执行器
│   │   ├── indicator_calculator.py # 指标计算器
│   │   ├── backtest_engine.py  # 回测引擎
│   │   └── signal_publisher.py # 信号发布器
│   │
│   ├── strategies/             # 策略实现
│   │   ├── base.py             # 策略基类
│   │   ├── dsl_strategy.py     # DSL 策略
│   │   ├── python_strategy.py  # Python 策略
│   │   └── ml_strategy.py      # ML 策略
│   │
│   ├── models/                 # 数据模型（Pydantic）
│   │   ├── strategy.py
│   │   ├── subscription.py
│   │   ├── signal.py
│   │   └── backtest.py
│   │
│   ├── db/                     # 数据库
│   │   ├── models.py           # SQLAlchemy 模型
│   │   ├── session.py          # 数据库连接
│   │   └── migrations/         # Alembic 迁移
│   │
│   ├── nats/                   # NATS 集成
│   │   ├── subscriber.py       # 订阅 K 线数据
│   │   ├── publisher.py        # 发布交易信号
│   │   └── topics.py           # 主题定义
│   │
│   └── utils/                  # 工具函数
│       ├── logger.py
│       ├── metrics.py          # 绩效指标计算
│       └── cache.py            # 缓存管理
│
├── protos/                     # Protocol Buffers 定义
│   └── strategy_engine.proto
│
├── certs/                      # SSL/TLS 证书（不提交到 Git）
│   ├── ca.crt
│   ├── ca.key
│   ├── server.crt
│   ├── server.key
│   ├── client.crt
│   ├── client.key
│   └── .gitkeep
│
├── scripts/                    # 工具脚本
│   ├── generate_certs.sh       # 证书生成脚本
│   └── generate_proto.sh       # protobuf 代码生成脚本
│
├── tests/                      # 测试
│   ├── unit/
│   ├── integration/
│   └── e2e/
│
├── pyproject.toml              # Poetry 依赖管理
├── Dockerfile
├── docker-compose.yml
├── .gitignore
└── README.md
```

## 部署方案

### Docker 部署

#### Dockerfile
```dockerfile
FROM python:3.11-slim

WORKDIR /app

# 安装系统依赖
RUN apt-get update && apt-get install -y \
    curl \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# 安装 Rust（用于编译 hquant-py）
RUN curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
ENV PATH="/root/.cargo/bin:${PATH}"

# 安装 Python 依赖
COPY pyproject.toml poetry.lock ./
RUN pip install poetry && \
    poetry config virtualenvs.create false && \
    poetry install --no-dev

# 复制 protobuf 定义并生成代码
COPY protos/ ./protos/
RUN python -m grpc_tools.protoc \
    -I./protos \
    --python_out=./app/grpc/generated \
    --grpc_python_out=./app/grpc/generated \
    ./protos/*.proto

# 复制应用代码
COPY . .

# 创建证书目录
RUN mkdir -p /app/certs

# 暴露端口
EXPOSE 8002 50051

# 启动脚本（同时启动 REST API 和 gRPC）
COPY scripts/start.sh /start.sh
RUN chmod +x /start.sh

CMD ["/start.sh"]
```

#### 启动脚本（scripts/start.sh）

```bash
#!/bin/bash
set -e

# 启动 gRPC 服务器（后台）
python -m app.grpc.server &

# 启动 FastAPI（前台）
uvicorn app.main:app \
  --host 0.0.0.0 \
  --port 8002 \
  --ssl-keyfile /app/certs/server.key \
  --ssl-certfile /app/certs/server.crt

# 等待所有后台进程
wait
```

#### docker-compose.yml
```yaml
version: '3.8'

services:
  strategy-engine:
    build: .
    ports:
      - "8002:8002"   # REST API (HTTPS)
      - "50051:50051" # gRPC (TLS)
    environment:
      - DATABASE_URL=postgresql://user:pass@postgres:5432/trading
      - NATS_URL=nats://nats:4222
      - REDIS_URL=redis://redis:6379/0
      - JWT_SECRET=${JWT_SECRET}
      - GRPC_ENABLE_TLS=true
    depends_on:
      - postgres
      - nats
      - redis
    volumes:
      - ./models:/app/models      # ML 模型目录
      - ./certs:/app/certs:ro     # SSL 证书（只读）
    restart: unless-stopped
    networks:
      - trading-network

  postgres:
    image: postgres:15
    environment:
      - POSTGRES_USER=user
      - POSTGRES_PASSWORD=pass
      - POSTGRES_DB=trading
    volumes:
      - postgres_data:/var/lib/postgresql/data
    restart: unless-stopped
    networks:
      - trading-network

  nats:
    image: nats:2.10
    ports:
      - "4222:4222"
    restart: unless-stopped
    networks:
      - trading-network

  redis:
    image: redis:7-alpine
    restart: unless-stopped
    networks:
      - trading-network

volumes:
  postgres_data:

networks:
  trading-network:
    driver: bridge
```

### Kubernetes 部署

#### 1. 创建 Secret（存储证书）

```bash
# 创建证书 Secret
kubectl create secret generic strategy-engine-certs \
  --from-file=ca.crt=./certs/ca.crt \
  --from-file=server.crt=./certs/server.crt \
  --from-file=server.key=./certs/server.key \
  --namespace=trading

# 创建数据库密码 Secret
kubectl create secret generic db-secret \
  --from-literal=url=postgresql://user:pass@postgres:5432/trading \
  --namespace=trading
```

#### 2. Deployment 配置

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: strategy-engine
  namespace: trading
spec:
  replicas: 3  # 多副本（负载均衡）
  selector:
    matchLabels:
      app: strategy-engine
  template:
    metadata:
      labels:
        app: strategy-engine
    spec:
      containers:
      - name: strategy-engine
        image: your-registry/strategy-engine:latest
        ports:
        - name: http
          containerPort: 8002
          protocol: TCP
        - name: grpc
          containerPort: 50051
          protocol: TCP
        env:
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: db-secret
              key: url
        - name: NATS_URL
          value: "nats://nats:4222"
        - name: REDIS_URL
          value: "redis://redis:6379/0"
        - name: JWT_SECRET
          valueFrom:
            secretKeyRef:
              name: jwt-secret
              key: secret
        - name: GRPC_ENABLE_TLS
          value: "true"
        volumeMounts:
        - name: certs
          mountPath: /app/certs
          readOnly: true
        - name: models
          mountPath: /app/models
        resources:
          requests:
            memory: "1Gi"
            cpu: "500m"
          limits:
            memory: "2Gi"
            cpu: "2000m"
        livenessProbe:
          httpGet:
            path: /health
            port: 8002
            scheme: HTTPS  # 使用 HTTPS
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /ready
            port: 8002
            scheme: HTTPS
          initialDelaySeconds: 10
          periodSeconds: 5
      volumes:
      - name: certs
        secret:
          secretName: strategy-engine-certs
      - name: models
        persistentVolumeClaim:
          claimName: ml-models-pvc
---
apiVersion: v1
kind: Service
metadata:
  name: strategy-engine
  namespace: trading
spec:
  type: ClusterIP
  selector:
    app: strategy-engine
  ports:
  - name: http
    port: 8002
    targetPort: 8002
    protocol: TCP
  - name: grpc
    port: 50051
    targetPort: 50051
    protocol: TCP
---
# Ingress 配置（可选，用于外部访问）
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: strategy-engine-ingress
  namespace: trading
  annotations:
    nginx.ingress.kubernetes.io/ssl-passthrough: "true"
    nginx.ingress.kubernetes.io/backend-protocol: "HTTPS"
spec:
  ingressClassName: nginx
  tls:
  - hosts:
    - strategy-engine.trading.com
    secretName: strategy-engine-certs
  rules:
  - host: strategy-engine.trading.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: strategy-engine
            port:
              number: 8002
```

## 性能优化方案

### 1. 计算性能优化

#### 使用 Rust 加速
- 技术指标计算：hquant-py（Rust + PyO3）
- 性能提升：10-100 倍（相比纯 Python）

#### 增量计算
```python
# 避免每次都重新计算所有历史数据
class IndicatorCache:
    def update_rsi(self, new_bar):
        # 只计算新增的一个 K 线
        self.rsi_values.append(
            calculate_rsi_incremental(
                self.rsi_values[-1],
                new_bar,
                self.period
            )
        )
```

#### 并行计算
```python
# 多策略并行执行（asyncio）
async def execute_strategies(bars):
    tasks = [
        execute_strategy(strategy, bar)
        for strategy, bar in zip(strategies, bars)
    ]
    await asyncio.gather(*tasks)
```

### 2. 内存优化

#### K 线数据滑动窗口
```python
# 只保留最近 N 条 K 线（例如 1000 条）
class SlidingWindow:
    def __init__(self, capacity=1000):
        self.data = deque(maxlen=capacity)

    def push(self, bar):
        self.data.append(bar)  # 自动淘汰最老数据
```

#### 指标结果缓存
```python
# Redis 缓存（避免重复计算）
cache_key = f"indicator:{symbol}:{period}:{indicator_name}"
result = redis.get(cache_key)
if result is None:
    result = calculate_indicator(...)
    redis.setex(cache_key, ttl=300, value=result)  # 5 分钟过期
```

### 3. 数据库优化

#### 索引优化
```sql
-- 策略订阅查询优化
CREATE INDEX idx_subscription_active ON strategy_subscriptions(
  exchange, trade_type, symbol, period
) WHERE status = 'running';

-- 信号查询优化（时间范围查询）
CREATE INDEX idx_signals_time ON trading_signals(created_at DESC)
INCLUDE (symbol, action, price);
```

#### 分区表（大数据量）
```sql
-- 按月分区（交易信号表）
CREATE TABLE trading_signals (
  ...
) PARTITION BY RANGE (created_at);

CREATE TABLE trading_signals_2026_01 PARTITION OF trading_signals
  FOR VALUES FROM ('2026-01-01') TO ('2026-02-01');
```

#### 连接池配置
```python
# SQLAlchemy 连接池
engine = create_engine(
    DATABASE_URL,
    pool_size=20,        # 连接池大小
    max_overflow=10,     # 最大溢出连接数
    pool_pre_ping=True   # 连接健康检查
)
```

### 4. NATS 优化

#### 批量消费
```python
# 批量接收 K 线数据（减少网络开销）
async def batch_consumer(batch_size=10):
    batch = []
    async for msg in subscription:
        batch.append(msg)
        if len(batch) >= batch_size:
            await process_batch(batch)
            batch = []
```

#### 消费者组（负载均衡）
```python
# 多个策略引擎实例共享负载
await js.subscribe(
    "candle.binance.spot.BTC-USDT.15m",
    "strategy-workers",  # 消费者组
    durable="strategy-engine"
)
```

### 5. 监控指标

#### 关键性能指标（KPI）

| 指标 | 目标 | 说明 |
|------|------|------|
| 信号延迟 | < 100ms | K 线到达 → 信号发布 |
| API 响应时间 | < 200ms | P95 延迟 |
| 策略执行成功率 | > 99.9% | 无错误运行 |
| 内存使用 | < 2GB | 单实例内存 |
| CPU 使用 | < 60% | 平均 CPU 占用 |

#### Prometheus 监控
```python
from prometheus_client import Counter, Histogram

# 信号计数器
signal_counter = Counter(
    'strategy_signals_total',
    'Total trading signals',
    ['symbol', 'action']
)

# 执行延迟直方图
execution_latency = Histogram(
    'strategy_execution_seconds',
    'Strategy execution latency',
    ['strategy_id']
)
```

## gRPC 服务实现示例

### 策略服务实现

```python
# app/grpc/services/strategy_service.py
import grpc
from app.grpc.generated import strategy_service_pb2, strategy_service_pb2_grpc
from app.core.strategy_manager import StrategyManager
from app.db.session import get_db
from google.protobuf.timestamp_pb2 import Timestamp

class StrategyServiceServicer(strategy_service_pb2_grpc.StrategyServiceServicer):
    def __init__(self):
        self.manager = StrategyManager()

    def CreateStrategy(self, request, context):
        # 从 metadata 获取用户信息（由 auth interceptor 注入）
        user_id = context.invocation_metadata().get('user_id')

        if not user_id:
            context.abort(grpc.StatusCode.UNAUTHENTICATED, 'Missing authentication')

        # 创建策略
        strategy = self.manager.create_strategy(
            user_id=user_id,
            name=request.name,
            description=request.description,
            type=request.type,
            code=request.code,
            params=dict(request.params)
        )

        # 构造响应
        response = strategy_service_pb2.StrategyResponse(
            strategy_id=str(strategy.id),
            user_id=str(strategy.user_id),
            name=strategy.name,
            description=strategy.description,
            type=request.type,
            code=strategy.code,
            params=strategy.params
        )

        # 设置时间戳
        response.created_at.FromDatetime(strategy.created_at)
        response.updated_at.FromDatetime(strategy.updated_at)

        return response

    def GetStrategy(self, request, context):
        user_id = context.invocation_metadata().get('user_id')

        strategy = self.manager.get_strategy(request.strategy_id, user_id)
        if not strategy:
            context.abort(grpc.StatusCode.NOT_FOUND, 'Strategy not found')

        # ... 返回策略详情 ...

    def ListStrategies(self, request, context):
        user_id = context.invocation_metadata().get('user_id')

        strategies = self.manager.list_strategies(
            user_id=user_id,
            page_size=request.page_size,
            page_token=request.page_token
        )

        # ... 返回策略列表 ...
```

### 信号流式服务实现

```python
# app/grpc/services/signal_service.py
import grpc
import asyncio
from app.grpc.generated import signal_service_pb2, signal_service_pb2_grpc
from app.nats.subscriber import NATSSubscriber

class SignalServiceServicer(signal_service_pb2_grpc.SignalServiceServicer):
    def __init__(self):
        self.nats = NATSSubscriber()

    async def StreamSignals(self, request, context):
        """Server-side streaming: 实时推送交易信号"""
        user_id = context.invocation_metadata().get('user_id')

        # 验证订阅权限
        subscription = get_subscription(request.subscription_id, user_id)
        if not subscription:
            context.abort(grpc.StatusCode.PERMISSION_DENIED, 'Access denied')

        # 订阅 NATS 主题
        topic = f"strategy.signals.{subscription.symbol}.{subscription.trade_type}"

        async for signal in self.nats.subscribe(topic):
            # 过滤当前用户的信号
            if signal.get('user_id') == user_id:
                yield signal_service_pb2.SignalEvent(
                    signal_id=signal['signal_id'],
                    subscription_id=str(subscription.id),
                    symbol=signal['symbol'],
                    action=signal['action'],
                    price=signal['price'],
                    confidence=signal.get('confidence', 0.0),
                    indicators=signal.get('indicators', {}),
                    timestamp=signal['timestamp']
                )

            # 检查客户端是否断开
            if context.is_active() is False:
                break
```

### gRPC 认证拦截器

```python
# app/grpc/interceptors/auth.py
import grpc
import jwt
from functools import wraps

class AuthInterceptor(grpc.ServerInterceptor):
    def __init__(self, jwt_secret):
        self.jwt_secret = jwt_secret

    def intercept_service(self, continuation, handler_call_details):
        # 获取 metadata
        metadata = dict(handler_call_details.invocation_metadata)

        # 提取 JWT Token
        auth_header = metadata.get('authorization', '')
        if not auth_header.startswith('Bearer '):
            return self._abort_unauthenticated(handler_call_details)

        token = auth_header[7:]  # 去除 "Bearer " 前缀

        try:
            # 验证 JWT
            payload = jwt.decode(token, self.jwt_secret, algorithms=['HS256'])
            user_id = payload.get('user_id')

            # 将 user_id 注入到 context metadata
            handler_call_details.invocation_metadata.append(('user_id', user_id))

            # 继续执行
            return continuation(handler_call_details)

        except jwt.ExpiredSignatureError:
            return self._abort_unauthenticated(handler_call_details, 'Token expired')
        except jwt.InvalidTokenError:
            return self._abort_unauthenticated(handler_call_details, 'Invalid token')

    def _abort_unauthenticated(self, handler_call_details, message='Unauthenticated'):
        def abort(request, context):
            context.abort(grpc.StatusCode.UNAUTHENTICATED, message)

        return grpc.unary_unary_rpc_method_handler(
            abort,
            request_deserializer=handler_call_details.method_descriptor.request_deserializer,
            response_serializer=handler_call_details.method_descriptor.response_serializer
        )

# 使用拦截器
from app.config import settings

server = grpc.server(
    futures.ThreadPoolExecutor(max_workers=10),
    interceptors=[AuthInterceptor(settings.JWT_SECRET)]
)
```

### 日志拦截器

```python
# app/grpc/interceptors/logging.py
import grpc
import time
import logging

logger = logging.getLogger(__name__)

class LoggingInterceptor(grpc.ServerInterceptor):
    def intercept_service(self, continuation, handler_call_details):
        start_time = time.time()
        method = handler_call_details.method

        logger.info(f"gRPC call started: {method}")

        # 执行请求
        response = continuation(handler_call_details)

        # 记录执行时间
        elapsed = time.time() - start_time
        logger.info(f"gRPC call finished: {method} - {elapsed:.3f}s")

        return response
```

## 安全方案

### 1. 认证授权

#### REST API
- JWT Token 验证（每个 API 请求）
- Token 过期时间：1 小时（可刷新）

#### gRPC API
- TLS 双向认证（服务端 + 客户端证书）
- JWT Token 验证（通过 metadata 传递）
- 拦截器统一验证

#### 权限隔离
- 用户只能访问自己的策略/信号
- 数据库查询强制带 user_id 过滤

### 2. 代码沙箱（Python 策略）
```python
# 限制执行环境（避免恶意代码）
import RestrictedPython

def execute_python_strategy(code, context):
    compiled = compile_restricted(code, '<user_strategy>', 'exec')
    safe_globals = {
        '__builtins__': safe_builtins,
        'hquant': hquant,  # 只允许使用 hquant API
    }
    exec(compiled, safe_globals, context)
```

### 3. 资源限制
```python
# 策略执行超时（防止死循环）
import signal

def timeout_handler(signum, frame):
    raise TimeoutError("Strategy execution timeout")

signal.signal(signal.SIGALRM, timeout_handler)
signal.alarm(5)  # 5 秒超时
try:
    execute_strategy()
finally:
    signal.alarm(0)
```

## 测试方案

### 单元测试
```python
# tests/unit/test_strategy_executor.py
import pytest
from app.core.strategy_executor import StrategyExecutor

def test_ema_strategy():
    executor = StrategyExecutor(strategy_type="dsl")
    signal = executor.execute(
        code="IF EMA(5) > EMA(20) THEN BUY",
        bars=[...]  # 测试数据
    )
    assert signal.action == "BUY"
```

### 集成测试
```python
# tests/integration/test_nats_flow.py
async def test_signal_publishing():
    # 模拟 K 线数据发布
    await nats_client.publish("candle.binance.spot.BTC-USDT.15m", bar_data)

    # 验证信号接收
    signal = await wait_for_signal(timeout=1.0)
    assert signal.symbol == "BTC-USDT"
    assert signal.action in ["BUY", "SELL", "HOLD"]
```

### 性能测试
```python
# tests/performance/test_throughput.py
def test_strategy_throughput():
    # 1000 条 K 线 / 秒
    start = time.time()
    for _ in range(1000):
        executor.execute(bar)
    elapsed = time.time() - start
    assert elapsed < 1.0  # 要求 1 秒内完成
```

## 快速启动指南

### 1. 生成 SSL 证书

```bash
# 运行证书生成脚本
cd apps/strategy-engine
chmod +x scripts/generate_certs.sh
./scripts/generate_certs.sh

# 验证证书
openssl verify -CAfile certs/ca.crt certs/server.crt
```

### 2. 生成 Protocol Buffers 代码

```bash
# 安装 grpc 工具
pip install grpcio-tools

# 生成 Python 代码
chmod +x scripts/generate_proto.sh
./scripts/generate_proto.sh
```

**scripts/generate_proto.sh**：
```bash
#!/bin/bash
set -e

# 创建生成目录
mkdir -p app/grpc/generated

# 生成 Python 代码
python -m grpc_tools.protoc \
  -I./protos \
  --python_out=./app/grpc/generated \
  --grpc_python_out=./app/grpc/generated \
  ./protos/strategy_engine.proto

# 创建 __init__.py
touch app/grpc/generated/__init__.py

echo "✅ Protocol Buffers code generated successfully"
```

### 3. 安装依赖

```bash
# 使用 Poetry
cd apps/strategy-engine
poetry install

# 或使用 pip
pip install -r requirements.txt
```

**pyproject.toml 依赖**：
```toml
[tool.poetry.dependencies]
python = "^3.11"
fastapi = "^0.109.0"
uvicorn = {extras = ["standard"], version = "^0.27.0"}
grpcio = "^1.60.0"
grpcio-tools = "^1.60.0"
protobuf = "^4.25.0"
sqlalchemy = "^2.0.25"
asyncpg = "^0.29.0"
nats-py = "^2.6.0"
redis = "^5.0.1"
pydantic = "^2.5.3"
pydantic-settings = "^2.1.0"
pyjwt = "^2.8.0"
alembic = "^1.13.1"
prometheus-client = "^0.19.0"
```

### 4. 启动服务

#### 开发环境（本地）

```bash
# 启动依赖服务
docker-compose up -d postgres nats redis

# 运行数据库迁移
poetry run alembic upgrade head

# 同时启动 REST API 和 gRPC
poetry run python -m app.grpc.server &  # 后台启动 gRPC
poetry run uvicorn app.main:app --reload --port 8002  # 启动 FastAPI
```

#### 生产环境（Docker）

```bash
# 构建镜像
docker-compose build

# 启动所有服务
docker-compose up -d

# 查看日志
docker-compose logs -f strategy-engine
```

### 5. 测试 API

#### 测试 REST API

```bash
# 健康检查
curl https://localhost:8002/health

# 创建策略（需要 JWT Token）
curl -X POST https://localhost:8002/api/v1/strategies \
  -H "Authorization: Bearer <JWT>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "EMA 交叉策略",
    "type": "dsl",
    "code": "IF EMA(5) > EMA(20) THEN BUY"
  }'
```

#### 测试 gRPC

```bash
# 使用 grpcurl 测试
grpcurl -insecure \
  -d '{"name": "Test Strategy", "type": 1, "code": "IF RSI < 30 THEN BUY"}' \
  -H "authorization: Bearer <JWT>" \
  localhost:50051 \
  strategy_engine.v1.StrategyService/CreateStrategy
```

#### 测试 Python 客户端

```python
# test_grpc_client.py
import grpc
from app.grpc.generated import strategy_service_pb2, strategy_service_pb2_grpc

# 建立连接
with open('certs/ca.crt', 'rb') as f:
    ca_cert = f.read()
with open('certs/client.key', 'rb') as f:
    client_key = f.read()
with open('certs/client.crt', 'rb') as f:
    client_cert = f.read()

credentials = grpc.ssl_channel_credentials(ca_cert, client_key, client_cert)
channel = grpc.secure_channel('localhost:50051', credentials)
stub = strategy_service_pb2_grpc.StrategyServiceStub(channel)

# 调用服务
request = strategy_service_pb2.CreateStrategyRequest(
    name="Test Strategy",
    type=strategy_service_pb2.STRATEGY_TYPE_DSL,
    code="IF RSI < 30 THEN BUY"
)

metadata = [('authorization', 'Bearer <JWT>')]
response = stub.CreateStrategy(request, metadata=metadata)
print(f"Created: {response.strategy_id}")
```

## 常见问题（FAQ）

### Q1: gRPC 和 REST API 如何选择？

- **REST API**：适用于 Web 前端、第三方集成、简单查询
- **gRPC**：适用于内部微服务、高性能场景、流式数据（信号推送）

### Q2: 证书过期怎么办？

```bash
# 重新生成证书
cd apps/strategy-engine
./scripts/generate_certs.sh

# 重启服务
docker-compose restart strategy-engine
```

### Q3: 如何更新 protobuf 定义？

```bash
# 1. 修改 protos/strategy_engine.proto
# 2. 重新生成代码
./scripts/generate_proto.sh

# 3. 重启服务
docker-compose restart strategy-engine
```

### Q4: gRPC 双向认证失败？

检查证书配置：
```bash
# 验证证书链
openssl verify -CAfile certs/ca.crt certs/client.crt

# 检查服务端证书 SAN
openssl x509 -in certs/server.crt -text | grep -A1 "Subject Alternative Name"
```

### Q5: 如何监控 gRPC 性能？

使用 Prometheus + Grafana：
```python
from prometheus_client import Counter, Histogram

grpc_requests_total = Counter(
    'grpc_requests_total',
    'Total gRPC requests',
    ['method', 'status']
)

grpc_request_duration = Histogram(
    'grpc_request_duration_seconds',
    'gRPC request latency',
    ['method']
)
```

## 性能基准

### gRPC vs REST API

| 指标 | gRPC (TLS) | REST (HTTPS) | 提升 |
|------|-----------|--------------|------|
| 平均延迟 | 5ms | 15ms | 3x |
| 吞吐量 | 10k req/s | 4k req/s | 2.5x |
| 连接复用 | 是（HTTP/2） | 否（HTTP/1.1） | - |
| 流式传输 | 原生支持 | 需要 WebSocket | - |
| 消息体积 | Protobuf（小） | JSON（大） | ~30% |

### 压力测试

```bash
# 使用 ghz 进行 gRPC 压测
ghz --insecure \
  --proto protos/strategy_engine.proto \
  --call strategy_engine.v1.StrategyService/GetStrategy \
  -d '{"strategy_id": "xxx"}' \
  -c 100 \
  -n 10000 \
  localhost:50051

# 输出结果
# Requests: 10000
# Duration: 2.5s
# RPS: 4000
# Average: 25ms
# P95: 45ms
# P99: 80ms
```

## 参考文档

- [FastAPI 文档](https://fastapi.tiangolo.com/)
- [gRPC Python 文档](https://grpc.io/docs/languages/python/)
- [Protocol Buffers 文档](https://protobuf.dev/)
- [NATS 文档](https://docs.nats.io/)
- [hquant-py 文档](../../packages/hquant-py/README.md)
- [PostgreSQL 分区表](https://www.postgresql.org/docs/current/ddl-partitioning.html)
- [Prometheus Python Client](https://github.com/prometheus/client_python)
- [OpenSSL 证书生成](https://www.openssl.org/docs/man1.1.1/man1/openssl-req.html)

---

**版本**：v1.0
**最后更新**：2026-01-31
**维护者**：Trading Team