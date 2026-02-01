# Exchange Adapter Service（Go）技术方案

> **服务定位**: 统一的交易所适配层，提供标准化的交易执行和市场数据查询能力
>
> **核心能力**: 下单、查询订单、撤单 + 市场数据查询（K线、订单簿、交易对信息）
>
> **关键约束**: 下单无状态设计，下单不依赖数据库，订单与账户由上游服务管理(市场数据同步到数据库)

---

## 1. 服务定位与职责

### 1.1 核心交易能力

**交易执行** (基于 [pkg/exchange-adapter](../../pkg/exchange-adapter))
- ✅ 下单：支持市价/限价/止损等订单类型，单笔与批量下单
- ✅ 查询订单：按 orderId 查询、查询未成交订单列表
- ✅ 撤单：单笔与批量撤单
- ✅ 账户操作：查询余额、持仓、设置杠杆

**市场数据查询** (整合 [apps/exchange-sync](../exchange-sync))
- 📊 K线数据：获取历史K线、当前周期K线（支持 15m/4h/1d）
- 📈 订单簿：获取大单订单簿（≥$5000 USDT）
- 💱 交易对信息：查询交易对规则、精度、状态
- 💰 实时价格：获取当前价格

**风控校验** (可选，基于 [pkg/risk](../../pkg/risk))
- 🛡️ 下单前风控检查
- 📊 账户级与持仓级风险评估

### 1.2 设计原则

- **无状态**: 下单模块不依赖数据库，所有状态由上游服务管理
- **Token 会话**: 内存管理 token → AccountConfig 映射，支持 TTL
- **适配器复用**: 统一使用 `pkg/exchange-adapter` 对接多交易所
- **订单推送**: 通过 WebSocket 实时推送订单状态变化（gRPC stream）
- **模块化集成**: 将 exchange-sync 的市场数据能力集成为独立模块

---

## 2. 依赖库替换

| 原依赖（Node.js） | 新依赖（Go） | 说明 |
|-----------------|-------------|------|
| `@hquant/exchange-adapter` | [pkg/exchange-adapter](../../pkg/exchange-adapter) | 交易所适配器（OKX/Binance/Bybit） |
| `@hquant/risk-model` | [pkg/risk](../../pkg/risk) | 风控引擎 |
| - | [apps/exchange-sync](../exchange-sync) | 市场数据服务（K线、订单簿） |

---

## 3. 系统架构

### 3.1 整体架构图

```
┌─────────────────────────────────────────────────────────────┐
│                    上游服务（策略/订单管理）                     │
└─────────────────────┬───────────────────────────────────────┘
                      │ gRPC
                      ↓
┌─────────────────────────────────────────────────────────────┐
│         Exchange Adapter Service (gRPC Server)              │
├─────────────────────────────────────────────────────────────┤
│  Session Layer    │ Token → AccountConfig (内存 + TTL)       │
├─────────────────────────────────────────────────────────────┤
│  Trading Layer    │ ┌──────────────────────────────────┐   │
│                   │ │   pkg/exchange-adapter           │   │
│                   │ │  • TradeAdapter                  │   │
│                   │ │  • WsUserDataAdapter             │   │
│                   │ └──────────────────────────────────┘   │
├─────────────────────────────────────────────────────────────┤
│  Market Data      │ ┌──────────────────────────────────┐   │
│                   │ │   Exchange Sync Client           │   │
│                   │ │  • REST API 调用                  │   │
│                   │ │  • K线/订单簿/交易对查询          │   │
│                   │ │  • K线数据格式统一并同步到数据库        │   │
│                   │ └──────────────────────────────────┘   │
├─────────────────────────────────────────────────────────────┤
│  Risk Layer       │ pkg/risk (下单前需要经过风控模块)                        │
└─────────────────────────────────────────────────────────────┘
                      │
                      ↓
            ┌─────────────────────┐
            │   Exchange APIs     │
            │  (OKX/Binance/...)  │
            └─────────────────────┘
```

### 3.2 模块划分

```
apps/exchange-adapter-service/
├── cmd/
│   └── main.go                     # 服务入口
├── internal/
│   ├── config/                     # 配置管理
│   │   └── config.go
│   ├── grpc/                       # gRPC 服务
│   │   ├── server.go               # gRPC server 启动
│   │   ├── handler_trading.go      # 交易相关 RPC
│   │   └── interceptors/           # 拦截器（日志/鉴权/恢复）
│   ├── api/                        # HTTP API（健康检查/管理）
│   │   ├── server.go               # Echo server
│   │   ├── handler_market.go       # 市场数据(保持现状：/Users/hubo/Work/Coding/MyProject/auto-trader/apps/exchange-sync/internal/api/handler.go)
│   │   └── handler.go              # /health, /ready, /version
│   ├── session/                    # 会话管理
│   │   ├── store.go                # Token → AccountConfig 映射
│   │   └── types.go                # AccountConfig 定义
│   ├── trading/                    # 交易执行层
│   │   ├── manager.go              # ExchangeManager: 管理 adapter 实例
│   │   ├── service.go              # 下单/撤单业务逻辑
│   │   └── stream.go               # 订单更新流推送
│   ├── market/                     # 市场数据层（集成 exchange-sync）
│   │   ├── client.go               # Exchange Sync HTTP Client
│   │   └── service.go              # K线/订单簿查询服务
│   └── risk/                       # 风控集成
│       └── evaluator.go            # 调用 pkg/risk 评估
├── proto/
│   └── exchange.proto              # gRPC 接口定义
├── gen/                            # protoc 生成代码
├── config.yaml                     # 配置文件
├── Makefile
└── README.md
```

---

## 4. 核心接口设计（gRPC）

### 4.1 会话管理

```protobuf
service ExchangeAdapter {
  // 初始化账户会话
  rpc InitAccount(InitAccountRequest) returns (InitAccountResponse);

  // 验证 Token
  rpc ValidateToken(ValidateTokenRequest) returns (ValidateTokenResponse);

  // 注销 Token
  rpc InvalidateToken(InvalidateTokenRequest) returns (Empty);
}

message InitAccountRequest {
  string exchange = 1;           // okx | binance | bybit
  string api_key = 2;
  string api_secret = 3;
  string passphrase = 4;         // OKX 需要
  bool testnet = 5;
  string risk_config_json = 7;   // 可选，风控配置
}

message InitAccountResponse {
  string token = 1;              // 会话 token
  int64 expires_at = 2;          // 过期时间戳（秒）
}
```

### 4.2 交易执行

```protobuf
service ExchangeAdapter {
  // 下单
  rpc PlaceOrder(PlaceOrderRequest) returns (PlaceOrderResponse);

  // 批量下单
  rpc PlaceOrders(PlaceOrdersRequest) returns (PlaceOrdersResponse);

  // 撤单
  rpc CancelOrder(CancelOrderRequest) returns (CancelOrderResponse);

  // 查询订单
  rpc GetOrder(GetOrderRequest) returns (Order);

  // 查询未成交订单
  rpc GetOpenOrders(GetOpenOrdersRequest) returns (GetOpenOrdersResponse);

  // 订阅订单更新（流式推送）
  rpc SubscribeOrders(SubscribeOrdersRequest) returns (stream OrderUpdate);
}

message PlaceOrderRequest {
  string token = 1;
  string symbol = 2;              // BTC-USDT
  TradeType trade_type = 3;       // SPOT | FUTURES
  Side side = 4;                  // BUY | SELL
  OrderType order_type = 5;       // MARKET | LIMIT | STOP
  string quantity = 6;            // 数量（字符串避免精度问题）
  string price = 7;               // 价格（LIMIT 必填）
  string client_order_id = 8;     // 客户端订单ID（可选）
}

message PlaceOrderResponse {
  string order_id = 1;            // 交易所订单ID
  string client_order_id = 2;     // 客户端订单ID
  OrderStatus status = 3;         // 订单状态
  string raw_response = 4;        // 原始响应（JSON）
}
```

### 4.3 市场数据

```protobuf
service ExchangeAdapter {
  // 获取历史 K 线
  rpc GetCandles(GetCandlesRequest) returns (GetCandlesResponse);

  // 获取当前 K 线
  rpc GetCurrentCandle(GetCurrentCandleRequest) returns (Candle);

  // 获取订单簿
  rpc GetOrderBook(GetOrderBookRequest) returns (OrderBook);

  // 获取价格
  rpc GetPrice(GetPriceRequest) returns (GetPriceResponse);

  // 获取交易对信息
  rpc GetSymbolInfo(GetSymbolInfoRequest) returns (SymbolInfo);
}

message GetCandlesRequest {
  string exchange = 1;
  string symbol = 2;
  TradeType trade_type = 3;
  string period = 4;              // 15m | 4h | 1d
  int32 limit = 5;
  int64 start_time = 6;           // 可选
  int64 end_time = 7;             // 可选
}

message Candle {
  int64 timestamp = 1;
  double open = 2;
  double high = 3;
  double low = 4;
  double close = 5;
  double volume = 6;
  double buy_volume = 7;
}
```

### 4.4 账户查询

```protobuf
service ExchangeAdapter {
  // 查询余额
  rpc GetBalance(GetBalanceRequest) returns (GetBalanceResponse);

  // 查询持仓
  rpc GetPositions(GetPositionsRequest) returns (GetPositionsResponse);

  // 设置杠杆
  rpc SetLeverage(SetLeverageRequest) returns (SetLeverageResponse);
}
```

---

## 5. 核心流程设计

### 5.1 InitAccount（建立会话）

```
上游                Service              SessionStore         pkg/exchange-adapter
 │                    │                      │                         │
 │──InitAccount────→  │                      │                         │
 │  (credentials)     │                      │                         │
 │                    │──Generate Token────→ │                         │
 │                    │                      │                         │
 │                    │──Save Config────────→│                         │
 │                    │  (token→AccountConfig,TTL)                     │
 │                    │                      │                         │
 │                    │──Create Adapter──────┼────────────────────────→│
 │                    │  (lazy or eager)     │                         │
 │                    │                      │                         │
 │←──Token+Expires─── │                      │                         │
```

**实现要点**:
- Token 生成：`HMAC(api_key + timestamp, secret_key)` 或随机 UUID
- TTL：默认 24 小时，可配置
- Adapter 创建：可懒加载（首次下单时创建）或预热（InitAccount 时创建）

### 5.2 PlaceOrder（下单）

```
上游              Service           SessionStore      pkg/risk      pkg/exchange-adapter
 │                  │                   │                │                 │
 │──PlaceOrder────→ │                   │                │                 │
 │  (token+order)   │                   │                │                 │
 │                  │──Get Config──────→│                │                 │
 │                  │←─AccountConfig────│                │                 │
 │                  │                   │                │                 │
 │                  │──Risk Check───────┼───────────────→│                 │
 │                  │  (optional)       │                │                 │
 │                  │←─Pass/Reject──────┼────────────────│                 │
 │                  │                   │                │                 │
 │                  │──PlaceOrder───────┼────────────────┼────────────────→│
 │                  │                   │                │                 │
 │                  │──Ensure WS────────┼────────────────┼────────────────→│
 │                  │  Subscribe        │                │                 │
 │                  │                   │                │                 │
 │←─OrderResponse── │                   │                │                 │
```

**实现要点**:
- Token 验证：检查是否存在、是否过期
- 风控（可选）：获取 balance/positions → 调用 `pkg/risk.Evaluate`
- WS 订阅：确保对应 tradeType 的 WsUserDataAdapter 已订阅
- 返回：exchangeOrderId + clientOrderId + status

### 5.3 SubscribeOrders（订单更新流）

```
上游              Service         ExchangeManager      WsUserDataAdapter
 │                  │                   │                     │
 │──Subscribe─────→ │                   │                     │
 │  (token+type)    │                   │                     │
 │                  │──Ensure WS────────→│                     │
 │                  │  Subscribe        │                     │
 │                  │                   │──Subscribe──────────→│
 │                  │                   │                     │
 │                  │                   │                     │
 │                  │                   │←─OrderUpdate────────│
 │                  │←─Dispatch─────────│                     │
 │←─OrderUpdate──── │  (filter by      │                     │
 │                  │   token+type)     │                     │
 │                  │                   │                     │
 │←─OrderUpdate──── │                   │                     │
```

**实现要点**:
- 流管理：按 `token + tradeType` 建立独立订阅通道
- 过滤推送：只推送匹配 token 的订单更新
- 重连处理：WS 断开自动重连，上游无感知

### 5.4 GetCandles（获取K线）

```
上游              Service         ExchangeSyncClient      exchange-sync
 │                  │                   │                     │
 │──GetCandles────→ │                   │                     │
 │                  │──HTTP Request────→│                     │
 │                  │                   │──GET /api/candles─→│
 │                  │                   │                     │
 │                  │                   │←─Response───────────│
 │                  │←─Candles──────────│                     │
 │←─Response─────── │                   │                     │
```

**实现要点**:
- HTTP Client：调用 exchange-sync 的 REST API
- 数据转换：exchange-sync 响应 → gRPC Candle 消息
- 错误处理：exchange-sync 不可用时返回合适的错误码

---

## 6. 集成 Exchange Sync

### 6.1 集成方式

**选项 1：HTTP Client 调用** (推荐)
- Exchange Adapter Service 作为 exchange-sync 的 HTTP 客户端
- 调用 exchange-sync 的 REST API 获取市场数据
- 优点：解耦、exchange-sync 可独立部署和扩展

**选项 2：直接复用代码**
- 将 exchange-sync 的核心逻辑作为 Go package 引入
- 缺点：耦合度高、维护成本大

**决策：选择选项 1**

### 6.2 配置

```yaml
# config.yaml
server:
  grpc_port: 9001
  http_port: 9002

exchange_sync:
  enabled: true
  base_url: "http://localhost:9003"
  timeout_seconds: 10

session:
  token_ttl_hours: 24
  cleanup_interval_minutes: 60

risk:
  enabled: true
  default_config: |
    {
      "max_position_size": 100000,
      "max_daily_loss": 5000
    }
```

### 6.3 市场数据服务实现

```go
// internal/market/client.go
type ExchangeSyncClient struct {
    baseURL string
    client  *http.Client
}

func (c *ExchangeSyncClient) GetCandles(ctx context.Context, req *GetCandlesRequest) ([]Candle, error) {
    url := fmt.Sprintf("%s/api/candles?exchange=%s&symbol=%s&period=%s&limit=%d",
        c.baseURL, req.Exchange, req.Symbol, req.Period, req.Limit)

    resp, err := c.client.Get(url)
    if err != nil {
        return nil, err
    }
    defer resp.Body.Close()

    var result struct {
        Code int      `json:"code"`
        Data []Candle `json:"data"`
    }

    if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
        return nil, err
    }

    return result.Data, nil
}

func (c *ExchangeSyncClient) GetOrderBook(ctx context.Context, req *GetOrderBookRequest) (*OrderBook, error) {
    // 类似实现
}

func (c *ExchangeSyncClient) GetSymbolInfo(ctx context.Context, exchange, symbol string) (*SymbolInfo, error) {
    // 类似实现
}
```

---

## 7. 会话管理（无数据库）

### 7.1 SessionStore 设计

```go
// internal/session/store.go
type AccountConfig struct {
    Exchange   string
    APIKey     string
    APISecret  string
    Passphrase string
    Testnet    bool
    Proxy      string
    RiskConfig string // JSON
    CreatedAt  time.Time
    ExpiresAt  time.Time
}

type SessionStore struct {
    mu       sync.RWMutex
    sessions map[string]*AccountConfig
    ttl      time.Duration
}

func (s *SessionStore) Create(config *AccountConfig) (token string, err error) {
    token = generateToken(config.APIKey)
    config.CreatedAt = time.Now()
    config.ExpiresAt = config.CreatedAt.Add(s.ttl)

    s.mu.Lock()
    s.sessions[token] = config
    s.mu.Unlock()

    return token, nil
}

func (s *SessionStore) Get(token string) (*AccountConfig, error) {
    s.mu.RLock()
    defer s.mu.RUnlock()

    config, exists := s.sessions[token]
    if !exists {
        return nil, ErrTokenNotFound
    }

    if time.Now().After(config.ExpiresAt) {
        return nil, ErrTokenExpired
    }

    return config, nil
}

func (s *SessionStore) Delete(token string) {
    s.mu.Lock()
    delete(s.sessions, token)
    s.mu.Unlock()
}

// 定期清理过期 token
func (s *SessionStore) StartCleanup(interval time.Duration) {
    ticker := time.NewTicker(interval)
    go func() {
        for range ticker.C {
            s.cleanup()
        }
    }()
}
```

### 7.2 Token 生成策略

```go
func generateToken(apiKey string) string {
    // 方案1: HMAC
    h := hmac.New(sha256.New, []byte(secretKey))
    h.Write([]byte(apiKey + time.Now().String()))
    return base64.URLEncoding.EncodeToString(h.Sum(nil))

    // 方案2: UUID（简单）
    return uuid.New().String()
}
```

---

## 8. 风控集成

### 8.1 风控调用流程

```go
// internal/risk/evaluator.go
type RiskEvaluator struct {
    engine *risk.Engine
}

func (r *RiskEvaluator) EvaluateOrder(
    ctx context.Context,
    order *PlaceOrderRequest,
    config *risk.Config,
    account *AccountSnapshot,
    positions []PositionSnapshot,
) error {
    riskCtx := &risk.RiskContext{
        Account:   account,
        Positions: positions,
        Order: &risk.OrderSnapshot{
            Symbol:   order.Symbol,
            Side:     order.Side,
            Quantity: order.Quantity,
            Price:    order.Price,
        },
    }

    result := r.engine.Evaluate(riskCtx, config)
    if result.Blocked {
        return fmt.Errorf("risk blocked: %s", result.Reason)
    }

    return nil
}
```

### 8.2 风控配置

```go
// 上游传入的风控配置示例
{
  "account_rules": {
    "max_equity_loss_pct": 0.05,      // 最大权益损失 5%
    "max_margin_usage_pct": 0.8       // 最大保证金使用率 80%
  },
  "position_rules": {
    "max_position_value": 100000,     // 单仓位最大价值
    "max_leverage": 10                // 最大杠杆
  }
}
```

---

## 9. 实施路线图

### 第一阶段：基础框架（2-3 天）

**目标**: 搭建服务骨架，实现会话管理

- [ ] 创建项目结构
- [ ] 配置管理（Viper）
- [ ] 日志初始化（zap）
- [ ] HTTP Server（Echo：/health, /ready）
- [ ] gRPC Server 启动
- [ ] SessionStore 实现（内存 + TTL + 清理）
- [ ] InitAccount / ValidateToken / InvalidateToken RPC

**验收标准**:
- `curl http://localhost:9002/health` 返回成功
- gRPC InitAccount 可正常创建 token
- Token 过期后自动失效

### 第二阶段：交易执行（3-4 天）

**目标**: 实现核心交易能力

- [ ] ExchangeManager：管理 TradeAdapter 实例
- [ ] PlaceOrder RPC 实现
- [ ] CancelOrder RPC 实现
- [ ] GetOrder / GetOpenOrders RPC 实现
- [ ] WsUserDataAdapter 集成
- [ ] SubscribeOrders 流式推送

**验收标准**:
- 可以通过 gRPC 成功下单
- 订单状态变化可通过 stream 实时推送
- 支持多交易所（OKX/Binance）

### 第三阶段：市场数据（2-3 天）

**目标**: 集成 exchange-sync 市场数据

- [ ] ExchangeSyncClient HTTP 客户端
- [ ] GetCandles RPC 实现
- [ ] GetCurrentCandle RPC 实现
- [ ] GetOrderBook RPC 实现
- [ ] GetPrice RPC 实现
- [ ] GetSymbolInfo RPC 实现

**验收标准**:
- 可以查询历史 K 线数据
- 可以获取订单簿和交易对信息
- exchange-sync 服务不可用时能正确降级

### 第四阶段：风控集成（1-2 天）

**目标**: 集成风控能力（可选）

- [ ] RiskEvaluator 实现
- [ ] 下单前风控检查
- [ ] 风控配置解析
- [ ] 风控错误码映射

**验收标准**:
- 下单前可执行风控检查
- 风控拒绝订单时返回明确错误
- 可通过配置开关风控

### 第五阶段：稳定性与可观测性（2-3 天）

**目标**: 生产就绪

- [ ] gRPC Interceptors（日志/恢复/超时）
- [ ] 优雅退出
- [ ] 指标采集（Prometheus）
- [ ] 单元测试
- [ ] 集成测试
- [ ] 压力测试

**验收标准**:
- 进程退出时优雅关闭所有连接
- 所有 RPC 调用有日志和指标
- 测试覆盖率 > 60%

---

## 10. 技术选型

| 组件 | 技术选型 | 说明 |
|-----|---------|------|
| HTTP 框架 | Echo v4 | 参考 exchange-sync，轻量高效 |
| gRPC | google.golang.org/grpc | 标准库 |
| 配置 | Viper | 支持 YAML/ENV |
| 日志 | Zap | 高性能结构化日志 |
| 指标 | Prometheus | 标准监控方案 |
| 测试 | testify | 断言与 mock |

---

## 11. 配置文件

```yaml
# config.yaml
server:
  grpc_port: 9001
  http_port: 9002

# Exchange Sync 集成
exchange_sync:
  enabled: true
  base_url: "http://localhost:9003"
  timeout_seconds: 10

# Session 管理
session:
  token_ttl_hours: 24
  cleanup_interval_minutes: 60

# 风控
risk:
  enabled: true
  default_config: |
    {
      "account_rules": {
        "max_equity_loss_pct": 0.05
      }
    }

# 日志
log:
  level: info
  format: json

# 代理（可选）
proxy: ""

# 证书（mTLS）
security:
  tls_enabled: false
  cert_file: ""
  key_file: ""
  ca_file: ""
```

---

## 12. FAQ

### Q1: 为什么不用数据库？

**A**: 本服务定位为"执行层"，不承担订单的长期存储和管理职责。订单的持久化由上游服务（订单服务/策略服务）负责。这样设计的好处：
- 服务更轻量、更容易水平扩展
- 减少技术栈复杂度
- 职责清晰、边界明确

### Q2: Token 过期后怎么办？

**A**: 上游服务需要重新调用 InitAccount 建立新会话。可以在上游实现自动重连逻辑。

### Q3: 多实例部署怎么办？

**A**: MVP 阶段设计为单实例。后续如需多实例，有两种方案：
1. 引入 Redis 存储 token → AccountConfig 映射
2. 改为无状态设计，每次请求携带完整凭证（需考虑安全性）

### Q4: exchange-sync 服务挂了怎么办？

**A**: 市场数据查询会返回错误，但不影响交易执行。可以在上游做降级处理。

### Q5: 如何保证订单推送的可靠性？

**A**:
- WS 断线自动重连
- gRPC stream 支持重新订阅
- 建议上游做订单轮询兜底

---

## 13. 开放问题

以下问题需要与上游服务确认：

1. ✅ **Proto 定义来源**: 使用仓库内 [packages/contracts/proto/exchange.proto](../../packages/contracts/proto/exchange.proto)
2. ✅ **mTLS 证书**: apps 统一使用一个证书
3. ❓ **clientOrderId**: 上游是否需要？（答：不需要传入，但需要返回）
4. ❓ **GetOrders 语义**: 查上游订单？还是查交易所订单？（答：查交易所）
5. ❓ **撤单方式**: 只支持 exchangeOrderId？还是也支持 clientOrderId？
6. ❓ **风控数据来源**: 上游提供账户权益？还是服务自行查询？

---

## 附录

### A. 参考文档

- [pkg/exchange-adapter 文档](../../pkg/exchange-adapter/doc.go)
- [pkg/risk 文档](../../pkg/risk/types.go)
- [apps/exchange-sync README](../exchange-sync/README.md)
- [apps/exchange-sync API 文档](../exchange-sync/docs/api-integration.md)

### B. 相关文件

- [packages/contracts/proto/exchange.proto](../../packages/contracts/proto/exchange.proto)

