# Strategy Engine - 策略引擎

## 概述

策略引擎是量化交易系统的核心计算层，负责：
- 接收实时市场数据
- 运行量化交易策略
- 生成交易信号
- 策略回测与优化
- 指标计算与分析

## 技术栈

| 类别 | 技术 | 说明 |
|------|------|------|
| 语言 | Python 3.11+ | 主要开发语言 |
| Web 框架 | FastAPI | 异步 HTTP 服务 |
| 任务队列 | Celery + Redis | 异步任务处理 |
| 消息队列 | NATS | 实时信号发布 |
| 消息队列| NATS | 接收实时数据 |
| 数据库 | PostgreSQL | 策略/回测数据存储 |
| 缓存 | Redis | 状态缓存/任务队列 |
| 量化库 | hquant-py | 技术指标计算 (Rust 绑定) |
| 认证 | Casdoor SDK | 统一身份认证 |

## 目录结构

```
strategy-engine/
├── src/
│   ├── main.py                    # FastAPI 应用入口
│   ├── config/                    # 配置管理
│   │   ├── __init__.py
│   │   ├── settings.py            # 配置定义
│   │   └── logging.py             # 日志配置
│   ├── api/                       # HTTP API 层
│   │   ├── __init__.py
│   │   ├── v1/
│   │   │   ├── __init__.py
│   │   │   ├── strategy.py        # 策略管理接口
│   │   │   ├── backtest.py        # 回测接口
│   │   │   ├── signal.py          # 信号查询接口
│   │   │   └── health.py          # 健康检查接口
│   │   └── deps.py                # 依赖注入
│   ├── core/                      # 核心业务逻辑
│   │   ├── __init__.py
│   │   ├── engine.py              # 策略引擎核心
│   │   ├── signal_generator.py    # 信号生成器
│   │   ├── backtest_engine.py     # 回测引擎
│   │   └── indicator_engine.py    # 指标计算引擎
│   ├── strategies/                # 策略实现
│   │   ├── __init__.py
│   │   ├── base.py                # 策略基类
│   │   ├── trend_following.py     # 趋势跟踪策略
│   │   ├── mean_reversion.py      # 均值回归策略
│   │   ├── momentum.py            # 动量策略
│   │   └── grid_trading.py        # 网格交易策略
│   ├── models/                    # 数据模型
│   │   ├── __init__.py
│   │   ├── strategy.py            # 策略模型
│   │   ├── signal.py              # 信号模型
│   │   ├── backtest.py            # 回测模型
│   │   └── market_data.py         # 行情数据模型
│   ├── services/                  # 业务服务
│   │   ├── __init__.py
│   │   ├── strategy_service.py    # 策略服务
│   │   ├── backtest_service.py    # 回测服务
│   │   ├── market_data_service.py # 行情数据服务
│   │   └── nats_service.py        # NATS 消息服务
│   ├── tasks/                     # Celery 异步任务
│   │   ├── __init__.py
│   │   ├── celery_app.py          # Celery 应用配置
│   │   ├── backtest_tasks.py      # 回测任务
│   │   └── signal_tasks.py        # 信号生成任务
│   ├── subscribers/               # NATS 订阅者
│   │   ├── __init__.py
│   │   └── market_data_sub.py     # 行情数据订阅
│   └── utils/                     # 工具类
│       ├── __init__.py
│       ├── logger.py              # 日志工具
│       ├── cache.py               # 缓存工具
│       └── validators.py          # 数据验证
├── tests/                         # 测试
│   ├── __init__.py
│   ├── test_strategies/           # 策略测试
│   ├── test_backtest/             # 回测测试
│   └── conftest.py                # pytest 配置
├── alembic/                       # 数据库迁移
│   ├── versions/
│   └── env.py
├── requirements.txt               # 依赖列表
├── requirements-dev.txt           # 开发依赖
├── Dockerfile
├── docker-compose.yml
├── .drone.yml
├── alembic.ini
└── pyproject.toml
```

## 核心模块

### 1. 策略基类

## API 接口

### 1. 策略管理

#### GET /api/v1/strategies
获取策略列表

**响应示例**:
```json
{
  "strategies": [
    {
      "id": "strategy_001",
      "name": "趋势跟踪策略",
      "type": "trend_following",
      "status": "running",
      "config": {
        "fast_period": 10,
        "slow_period": 30,
        "stop_loss_pct": 0.02
      },
      "created_at": "2026-01-22T10:00:00Z"
    }
  ]
}
```

#### POST /api/v1/strategies
创建策略

**请求示例**:
```json
{
  "name": "我的趋势策略",
  "type": "trend_following",
  "symbol": "BTC/USDT",
  "exchange": "binance",
  "config": {
    "fast_period": 10,
    "slow_period": 30,
    "stop_loss_pct": 0.02,
    "take_profit_pct": 0.05,
    "quantity": 0.1
  }
}
```

#### POST /api/v1/strategies/{id}/start
启动策略

#### POST /api/v1/strategies/{id}/stop
停止策略

### 2. 回测接口

#### POST /api/v1/backtest
运行回测

**请求示例**:
```json
{
  "strategy_type": "trend_following",
  "symbol": "BTC/USDT",
  "exchange": "binance",
  "start_date": "2025-01-01",
  "end_date": "2025-12-31",
  "initial_capital": 100000,
  "config": {
    "fast_period": 10,
    "slow_period": 30
  }
}
```

**响应示例**:
```json
{
  "task_id": "backtest_001",
  "status": "pending"
}
```

#### GET /api/v1/backtest/{task_id}
获取回测结果

### 3. 信号查询

#### GET /api/v1/signals
获取历史信号

**查询参数**:
- `strategy_id`: 策略ID
- `symbol`: 交易对
- `start_time`: 开始时间
- `end_time`: 结束时间
- `page`: 页码
- `limit`: 每页数量

### 4. 健康检查

#### GET /health
```json
{
  "status": "ok",
  "service": "strategy-engine",
  "version": "1.0.0",
  "timestamp": "2026-01-22T10:00:00Z"
}
```

## 配置管理

### 环境配置

```python
# src/config/settings.py
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    # 应用配置
    APP_NAME: str = "strategy-engine"
    APP_PORT: int = 9101
    DEBUG: bool = False

    # 数据库配置
    DATABASE_URL: str = "postgresql://user:pass@localhost:5432/strategy_db"

    # Redis 配置
    REDIS_URL: str = "redis://localhost:6379/0"

    # NATS 配置
    NATS_URL: str = "nats://localhost:4222"
    NATS_USER: str = "trader_user"
    NATS_PASS: str = "p123456"

    # Celery 配置
    CELERY_BROKER_URL: str = "redis://localhost:6379/1"
    CELERY_RESULT_BACKEND: str = "redis://localhost:6379/2"

    # Casdoor 认证配置
    CASDOOR_ENDPOINT: str = "https://auth.example.com"
    CASDOOR_CLIENT_ID: str = ""
    CASDOOR_CLIENT_SECRET: str = ""
    CASDOOR_ORG_NAME: str = "auto-trader"
    CASDOOR_APP_NAME: str = "strategy-engine"

    class Config:
        env_file = ".env"

settings = Settings()
```

## 部署

### Docker 部署

```dockerfile
# Dockerfile
FROM python:3.11-slim

WORKDIR /app

# 安装系统依赖
RUN apt-get update && apt-get install -y \
    gcc \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# 安装 Python 依赖
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# 复制源代码
COPY src/ ./src/
COPY alembic/ ./alembic/
COPY alembic.ini .

# 暴露端口
EXPOSE 9101

# 启动命令
CMD ["uvicorn", "src.main:app", "--host", "0.0.0.0", "--port", "9101"]
```

```yaml
# docker-compose.yml
version: '3.8'

services:
  strategy-engine:
    build: .
    container_name: strategy-engine
    ports:
      - "9101:9101"
    environment:
      - DATABASE_URL=postgresql://user:pass@postgres:5432/strategy_db
      - REDIS_URL=redis://redis:6379/0
      - NATS_URL=nats://nats:4222
    depends_on:
      - postgres
      - redis
      - nats
    volumes:
      - ./logs:/app/logs
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:9101/health"]
      interval: 30s
      timeout: 10s
      retries: 3
    networks:
      - shared_network

  celery-worker:
    build: .
    container_name: strategy-celery-worker
    command: celery -A src.tasks.celery_app worker -l info
    environment:
      - DATABASE_URL=postgresql://user:pass@postgres:5432/strategy_db
      - REDIS_URL=redis://redis:6379/0
      - CELERY_BROKER_URL=redis://redis:6379/1
    depends_on:
      - redis
    volumes:
      - ./logs:/app/logs
    restart: unless-stopped
    networks:
      - shared_network

networks:
  shared_network:
    external: true
```

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
| `strategy.status.{strategy_id}` | 策略状态 | StatusUpdate |

## 测试

```bash
# 运行单元测试
pytest tests/ -v

# 运行覆盖率测试
pytest tests/ --cov=src --cov-report=html

# 运行特定测试
pytest tests/test_strategies/ -v
```

## 参考文档

- [FastAPI 文档](https://fastapi.tiangolo.com/)
- [Celery 文档](https://docs.celeryq.dev/)
- [NATS 文档](https://docs.nats.io/)
- [hquant-py 文档](../packages/hquant-py/README.md)
- [接收实时数据nats源码](E:\Project\my-project\app-golang\apps\exchange-sync\internal\publisher\nats.go， )
- [接收实时数据nats](../docs/exchange-nats.md)
---

**版本**: 1.0.0
**最后更新**: 2026-01-23
**维护者**: 量化团队
