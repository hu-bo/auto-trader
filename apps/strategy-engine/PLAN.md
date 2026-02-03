# Strategy Engine (策略信号引擎)

> 轻量级实时策略信号服务 - 接收行情、计算指标、生成信号、推送通知

## 概述

Strategy Engine 是一个独立的轻量级服务模块，专注于实时策略信号的生成与推送。从 trader-service 中抽离，**不依赖数据库**，仅通过 NATS 订阅行情数据，计算技术指标，生成交易信号，并通过 NATS 实时推送给客户端。

### 核心能力

| 功能 | 说明 |
|------|------|
| 行情订阅 | 通过 NATS(exchange-adapter-service) 订阅实时 K 线数据 |
| 策略管理订阅 | gRPC  暴露给trader-service-node服务 |
| 指标计算 | 基于 hquant-py 高性能技术指标计算 |
| 信号生成 | 执行策略逻辑，生成 BUY/SELL/HOLD 信号 |
| 实时推送 | 通过 NATS推送信号给trader-service-node触发下单 |

### 设计原则

- **无状态**：不依赖数据库，策略配置通过 API 动态加载
- **轻量级**：专注信号生成与推送，不涉及下单、风控等业务
- **高性能**：Rust 底层指标计算，异步事件驱动
- **易扩展**：支持动态添加/移除策略实例

---

## 系统架构

```
┌─────────────────────────────────────────────────────────────────────┐
│                        Strategy Engine                               │
│                       (Python FastAPI)                               │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │                      API Layer                               │    │
│  │  ┌─────────────────────┐  ┌───────────────────────────────┐ │    │
│  │  │   gRPC              │  │   NATS (信号推送)               ││    │
│  │  │   (策略管理)         │  │                                ││    │
│  │  └─────────────────────┘  └───────────────────────────────┘ │    │
│  └─────────────────────────────────────────────────────────────┘    │
│                                    │                                 │
│  ┌─────────────────────────────────┼─────────────────────────────┐  │
│  │                     Core Engine Layer                          │  │
│  │                                                                 │  │
│  │  ┌──────────────────┐  ┌──────────────────┐                   │  │
│  │  │ Strategy Manager │  │ Strategy Executor │                   │  │
│  │  │ (策略实例管理)    │  │ (策略执行引擎)    │                   │  │
│  │  └──────────────────┘  └──────────────────┘                   │  │
│  │                                                                 │  │
│  │  ┌──────────────────┐  ┌──────────────────┐                   │  │
│  │  │ Indicator Calc   │  │ Signal Generator │                   │  │
│  │  │ (指标计算器)      │  │ (信号生成器)      │                   │  │
│  │  └──────────────────┘  └──────────────────┘                   │  │
│  └─────────────────────────────────────────────────────────────────┘  │
│                                    │                                 │
│  ┌─────────────────────────────────┼─────────────────────────────┐  │
│  │                     Infrastructure Layer                       │  │
│  │  ┌──────────────────┐  ┌──────────────────────────────────┐   │  │
│  │  │      NATS        │  │       hquant-py (Rust)            │   │  │
│  │  │   (行情订阅)      │  │       (指标计算引擎)               │   │  │
│  │  └──────────────────┘  └──────────────────────────────────┘   │  │
│  └─────────────────────────────────────────────────────────────────┘  │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### 技术栈

| 类别 | 技术 | 说明 |
|------|------|------|
| Web 框架 | FastAPI | 异步 HTTP 服务 |
| ASGI 服务器 | Uvicorn | 生产级 ASGI 服务器 |
| 消息队列 | NATS | 实时行情数据订阅 |
| 量化计算 | hquant-py | 技术指标计算（Rust 绑定） |
| 数据验证 | Pydantic 2.x | 请求/响应模型验证 |

---

## 数据流设计

```
                            NATS
                              │
    ┌─────────────────────────┼─────────────────────────┐
    │                         │                         │
    ▼                         ▼                         ▼
exchange.candle.          exchange.candle.          exchange.candle.
binance.spot.             binance.spot.             okx.futures.
BTC-USDT.15m              ETH-USDT.15m              BTC-USDT.15m
    │                         │                         │
    └─────────────────────────┼─────────────────────────┘
                              │
                              ▼
                    ┌─────────────────┐
                    │  NATS Subscriber │
                    │  (行情数据接收)   │
                    └────────┬────────┘
                             │
                             ▼
                    ┌─────────────────┐
                    │ Strategy Manager │
                    │ (路由到策略实例)  │
                    └────────┬────────┘
                             │
            ┌────────────────┼────────────────┐
            │                │                │
            ▼                ▼                ▼
    ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
    │ EMA Strategy │ │ RSI Strategy │ │ MACD Strategy│
    │   Instance   │ │   Instance   │ │   Instance   │
    └──────┬───────┘ └──────┬───────┘ └──────┬───────┘
           │                │                │
           └────────────────┼────────────────┘
                            │
                            ▼
                  ┌──────────────────┐
                  │ Indicator Calc   │
                  │ (hquant-py)      │
                  └────────┬─────────┘
                           │
                           ▼
                  ┌──────────────────┐
                  │ Signal Generator │
                  │ 生成 BUY/SELL/HOLD│
                  └────────┬─────────┘
                           │
                           ▼
                  ┌──────────────────┐
                  │ NATS Server │
                  │   (信号推送)      │
                  └────────┬─────────┘
                           │
            ┌──────────────┼──────────────┐
            │              │              │
            ▼              ▼              ▼
        Client A       Client B       Client C
        (Web/App)      (Web/App)      (Web/App)
```

---

## 模块设计

### 1. NATS 订阅模块 (Data Subscriber)

#### 功能描述

- 订阅 NATS K 线数据主题
- 解析行情数据并分发到对应策略实例
- 支持动态订阅/取消订阅

#### NATS 订阅主题

| 主题格式 | 示例 | 说明 |
|----------|------|------|
| `{prefix}.candle.{exchange}.{tradeType}.{symbol}.{period}` | `exchange.candle.binance.spot.BTC-USDT.15m` | K 线更新 |

#### K 线数据结构
数据来源go服务
```golang
// NormalizedCandle 标准化K线
type NormalizedCandle struct {
	Symbol       string  `json:"symbol"`        // 交易对: BTC-USDT
	Exchange     string  `json:"exchange"`      // 交易所: binance | okx
	TradeType    string  `json:"trade_type"`    // 类型: spot | futures
	Period       string  `json:"period"`        // 周期: 15m | 4h | 1d
	Timestamp    int64   `json:"timestamp"`     // 周期起始时间 (毫秒)
	Open         float64 `json:"open"`          // 开盘价
	High         float64 `json:"high"`          // 最高价
	Low          float64 `json:"low"`           // 最低价
	Close        float64 `json:"close"`         // 收盘价
	Volume       float64 `json:"volume"`        // 总成交量
	BuyVolume    float64 `json:"buy_volume"`    // 主动买入成交量
	SymbolFamily string  `json:"symbol_family"` // 资产族: BTC, ETH
}
```

### 2. 策略管理模块 (Strategy Manager)

#### 功能描述

- 管理策略实例的生命周期（创建/销毁）
- 维护策略实例注册表
- 路由行情数据到对应策略

#### 策略实例 Key

```
策略实例 Key = (strategy_type, symbol, exchange, trade_type, period)

示例：
- EMA 策略 + BTC-USDT + binance + spot + 15m
- RSI 策略 + ETH-USDT + okx + futures + 1h
```

#### 内存数据结构

```python
# 策略注册表 (内存)
strategy_registry: Dict[str, StrategyInstance] = {}

```

### 3. 指标计算模块 (Indicator Calculator)

#### 功能描述

- 基于 hquant-py 计算技术指标
- 维护 K 线滑动窗口（最近 N 条）
- 支持多周期聚合（15m → 4h/1d）

#### 支持的技术指标(hquant-py 已支持)

| 类别 | 指标 |
|------|------|
| 趋势类 | SMA、EMA、MACD、Bollinger Bands |
| 动量类 | RSI、KDJ、CCI、Williams %R |
| 成交量类 | OBV、CMF、VWAP |

#### 数据缓存

使用循环队列缓存 candle数据 （默认capacity=2000）

### 4. 信号生成模块 (Signal Generator)

#### 功能描述

- 执行策略逻辑
- 生成交易信号 (BUY/SELL/HOLD)
- 计算信号置信度

#### 信号数据结构

```python
class Signal(BaseModel):
    signal_id: str          # UUID
    strategy_id: str        # 111111
    strategy_name: str      # EMA/RSI/MACD
    exchange: str           # binance/okx
    trade_type: str         # spot/futures
    symbol: str             # BTC-USDT
    period: str             # 15m
    action: str             # BUY/SELL/HOLD
    price: float            # 当前价格
    confidence: float       # 信号置信度 (0-1)
    timestamp: datetime     # 信号时间戳
```

### 5. Nats 推送模块 (Signal Publisher)

#### 功能描述

- 按策略/交易对分组推送信号
- 支持客户端添加策略/删除策略

#### 添加策略

```python
# 客户端发送，strategy_id + exchange + symbol + trade_type 唯一
{
    "strategy_id": 112121,
    "strategy_name": "做多策略",
    "code": "IF RSI > 40 THEN SELL",
    "exchange": "binance",
    "trade_type": "spot",
    "symbol": "BTC-USDT"
}
```
#### 删除策略

```python
# 客户端发送
{
    "strategy_id": 112121,
    "exchange": "binance",
    "trade_type": "spot",
    "symbol": "BTC-USDT"
}
```
---

## 项目结构

```
apps/strategy-engine/
├── app/
│   ├── main.py                       # FastAPI + Socket.IO 应用入口
│   ├── config.py                     # 配置管理 (Pydantic Settings)
│   │
│   ├── api/                          # REST API/gRPC
│   │   ├── __init__.py
│   │   └── v1/
│   │       ├── __init__.py
│   │       ├── router.py             # 路由聚合
│   │       ├── strategies.py         # 策略管理 API
│   │       └── health.py             # 健康检查
│   │
│   ├── core/                         # 核心引擎
│   │   ├── __init__.py
│   │   ├── strategy_manager.py       # 策略实例管理
│   │   ├── strategy_executor.py      # 策略执行引擎
│   │   ├── indicator_calculator.py   # 指标计算器 (hquant-py)
│   │   └── signal_generator.py       # 信号生成器
│   │
│   ├── nats/                         # NATS 集成
│   │   ├── __init__.py
│   │   ├── client.py                 # NATS 客户端
│   │   ├── subscriber.py             # K 线数据订阅
│   │   └── topics.py                 # 主题定义
│   │
│   ├── models/                       # Pydantic 模型
│   │   ├── __init__.py
│   │   ├── candle.py                 # K 线数据模型
│   │   ├── signal.py                 # 信号模型
│   │   ├── strategy.py               # 策略配置模型
│   │   └── subscription.py           # 订阅请求模型
│   │
│   └── utils/                        # 工具函数
│       ├── __init__.py
│       └── circular_buffer.py        # 滑动窗口缓存
│
├── tests/                            # 测试
│   ├── unit/
│   └── integration/
│
├── pyproject.toml                    # Poetry 依赖管理
├── Dockerfile
└── README.md
```

---

## API 设计

### REST API

#### 策略管理

| 接口 | 方法 | 说明 |
|------|------|------|
| `/api/v1/strategies` | GET | 获取当前运行的策略实例列表 |
| `/api/v1/strategies` | POST | 创建策略实例 |
| `/api/v1/strategies` | PUT | 更新策略内容 |
| `/api/v1/strategies` | DELETE | 销毁策略实例 |
#### 健康检查

| 接口 | 方法 | 说明 |
|------|------|------|
| `/health` | GET | 服务存活检查 |
| `/health/ready` | GET | 服务就绪检查 (含 NATS 连接状态) |


#### 订阅信号

- K 线更新：`{prefix}.{exchange}.{tradeType}.{symbol}`
  - 示例：`signal.binance.spot.BTC-USDT`
---

## 依赖管理

### pyproject.toml

```toml
[tool.poetry]
name = "strategy-engine"
version = "1.0.0"
description = "Lightweight Strategy Signal Engine"
python = "^3.11"

[tool.poetry.dependencies]
# Web Framework
fastapi = "^0.109.0"
uvicorn = {extras = ["standard"], version = "^0.27.0"}

# Message Queue
nats-py = "^2.6.0"

# Data Validation
pydantic = "^2.5.3"
pydantic-settings = "^2.1.0"

# Quantitative
hquant-py = {path = "../../packages/hquant-py"}

# Utils
python-dateutil = "^2.8.2"
```

---

## 配置管理

### 环境变量

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `APP_ENV` | 运行环境 | development |
| `NATS_URL` | NATS 连接地址 | nats://localhost:16002 |

### config.py

```python
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    app_env: str = "development"
    app_port: int = 9002
    nats_url: str = "nats://localhost:16002"
    nats_subject_prefix: str = "exchange"
    candle_buffer_size: int = 1000
    log_level: str = "INFO"

    class Config:
        env_file = ".env"
```

---

## 部署方案

### Docker 部署

| 服务 | 端口 | 说明 |
|------|------|------|
| NATS | 16002 | 消息队列 |

### Dockerfile

```dockerfile
FROM python:3.11-slim

WORKDIR /app

# Install dependencies
COPY pyproject.toml poetry.lock ./
RUN pip install poetry && poetry install --no-dev

# Copy source
COPY app ./app

EXPOSE 9002

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "9002"]
```

---

## 实现步骤

### Phase 1: 基础框架

1. 初始化项目结构
2. 配置 FastAPI + Socket.IO
3. 实现 NATS 客户端连接
4. 实现健康检查 API

### Phase 2: 核心引擎

1. 实现 K 线数据订阅
2. 实现滑动窗口缓存
3. 集成 hquant-py 指标计算
4. 实现策略基类



### Phase 5: 测试与优化

1. 单元测试
2. 集成测试
3. 性能优化
4. 文档完善

---

**版本**: 1.0.0
**端口**: 9002 (HTTP + Socket.IO)
**最后更新**: 2026-02-02
