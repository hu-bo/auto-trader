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

```python
# src/strategies/base.py
from abc import ABC, abstractmethod
from typing import Optional, List, Dict, Any
from dataclasses import dataclass
from enum import Enum

class SignalType(Enum):
    ENTRY_LONG = "entry_long"      # 开多
    EXIT_LONG = "exit_long"        # 平多
    ENTRY_SHORT = "entry_short"    # 开空
    EXIT_SHORT = "exit_short"      # 平空
    HOLD = "hold"                  # 持有

@dataclass
class Signal:
    type: SignalType
    symbol: str
    exchange: str
    price: float
    quantity: float
    stop_loss: Optional[float] = None
    take_profit: Optional[float] = None
    metadata: Optional[Dict[str, Any]] = None

@dataclass
class MarketData:
    symbol: str
    exchange: str
    timestamp: int
    open: float
    high: float
    low: float
    close: float
    volume: float

class BaseStrategy(ABC):
    """策略基类，所有策略必须继承此类"""

    def __init__(self, config: Dict[str, Any]):
        self.config = config
        self.name = self.__class__.__name__
        self.positions: Dict[str, float] = {}

    @abstractmethod
    def on_bar(self, bar: MarketData) -> Optional[Signal]:
        """K线数据回调，返回交易信号"""
        pass

    @abstractmethod
    def on_tick(self, tick: Dict[str, Any]) -> Optional[Signal]:
        """Tick数据回调，返回交易信号"""
        pass

    def on_signal_executed(self, signal: Signal, result: Dict[str, Any]):
        """信号执行回调"""
        pass

    def get_indicators(self, bars: List[MarketData]) -> Dict[str, Any]:
        """计算技术指标"""
        return {}
```

### 2. 趋势跟踪策略示例

```python
# src/strategies/trend_following.py
from typing import Optional, List, Dict, Any
import hquant_py as hq
from .base import BaseStrategy, Signal, SignalType, MarketData

class TrendFollowingStrategy(BaseStrategy):
    """双均线趋势跟踪策略"""

    def __init__(self, config: Dict[str, Any]):
        super().__init__(config)
        self.fast_period = config.get("fast_period", 10)
        self.slow_period = config.get("slow_period", 30)
        self.stop_loss_pct = config.get("stop_loss_pct", 0.02)
        self.take_profit_pct = config.get("take_profit_pct", 0.05)
        self.bars_buffer: List[MarketData] = []
        self.position = 0  # 1: 多头, -1: 空头, 0: 空仓

    def on_bar(self, bar: MarketData) -> Optional[Signal]:
        self.bars_buffer.append(bar)

        # 需要足够的历史数据
        if len(self.bars_buffer) < self.slow_period + 1:
            return None

        # 保持固定长度的缓冲区
        if len(self.bars_buffer) > self.slow_period * 2:
            self.bars_buffer = self.bars_buffer[-self.slow_period * 2:]

        # 计算均线
        closes = [b.close for b in self.bars_buffer]
        fast_ma = hq.sma(closes, self.fast_period)
        slow_ma = hq.sma(closes, self.slow_period)

        # 获取最新值
        fast_ma_curr = fast_ma[-1]
        fast_ma_prev = fast_ma[-2]
        slow_ma_curr = slow_ma[-1]
        slow_ma_prev = slow_ma[-2]

        # 金叉：快线上穿慢线 -> 开多
        if fast_ma_prev <= slow_ma_prev and fast_ma_curr > slow_ma_curr:
            if self.position <= 0:
                self.position = 1
                return Signal(
                    type=SignalType.ENTRY_LONG,
                    symbol=bar.symbol,
                    exchange=bar.exchange,
                    price=bar.close,
                    quantity=self.config.get("quantity", 1.0),
                    stop_loss=bar.close * (1 - self.stop_loss_pct),
                    take_profit=bar.close * (1 + self.take_profit_pct),
                    metadata={"fast_ma": fast_ma_curr, "slow_ma": slow_ma_curr}
                )

        # 死叉：快线下穿慢线 -> 平多
        elif fast_ma_prev >= slow_ma_prev and fast_ma_curr < slow_ma_curr:
            if self.position > 0:
                self.position = 0
                return Signal(
                    type=SignalType.EXIT_LONG,
                    symbol=bar.symbol,
                    exchange=bar.exchange,
                    price=bar.close,
                    quantity=self.config.get("quantity", 1.0),
                    metadata={"fast_ma": fast_ma_curr, "slow_ma": slow_ma_curr}
                )

        return None

    def on_tick(self, tick: Dict[str, Any]) -> Optional[Signal]:
        # 本策略不处理 tick 数据
        return None
```

### 3. 策略引擎核心

```python
# src/core/engine.py
import asyncio
from typing import Dict, Optional, Type
from loguru import logger
from ..strategies.base import BaseStrategy, Signal, MarketData
from ..services.nats_service import NatsService

class StrategyEngine:
    """策略引擎核心"""

    def __init__(self, nats_service: NatsService):
        self.nats = nats_service
        self.strategies: Dict[str, BaseStrategy] = {}
        self.running = False

    def register_strategy(
        self,
        strategy_id: str,
        strategy_class: Type[BaseStrategy],
        config: Dict
    ):
        """注册策略实例"""
        strategy = strategy_class(config)
        self.strategies[strategy_id] = strategy
        logger.info(f"Strategy registered: {strategy_id} ({strategy.name})")

    def unregister_strategy(self, strategy_id: str):
        """注销策略实例"""
        if strategy_id in self.strategies:
            del self.strategies[strategy_id]
            logger.info(f"Strategy unregistered: {strategy_id}")

    async def process_bar(self, bar: MarketData) -> list[Signal]:
        """处理K线数据，返回所有策略产生的信号"""
        signals = []

        for strategy_id, strategy in self.strategies.items():
            try:
                signal = strategy.on_bar(bar)
                if signal:
                    signal.metadata = signal.metadata or {}
                    signal.metadata["strategy_id"] = strategy_id
                    signals.append(signal)

                    # 发布信号到 NATS
                    await self.publish_signal(signal)

            except Exception as e:
                logger.error(f"Strategy {strategy_id} error: {e}")

        return signals

    async def publish_signal(self, signal: Signal):
        """发布信号到 NATS"""
        subject = f"strategy.signals.{signal.symbol}.{signal.type.value}"
        await self.nats.publish(subject, signal.__dict__)
        logger.info(f"Signal published: {subject}")

    async def start(self):
        """启动策略引擎"""
        self.running = True
        logger.info("Strategy engine started")

        # 订阅市场数据
        await self.nats.subscribe(
            "market.bars.>",
            self._on_market_data
        )

    async def stop(self):
        """停止策略引擎"""
        self.running = False
        logger.info("Strategy engine stopped")

    async def _on_market_data(self, msg):
        """市场数据回调"""
        try:
            data = msg.data
            bar = MarketData(**data)
            await self.process_bar(bar)
        except Exception as e:
            logger.error(f"Process market data error: {e}")
```

### 4. 回测引擎

```python
# src/core/backtest_engine.py
from typing import List, Dict, Any, Optional
from dataclasses import dataclass, field
from datetime import datetime
import pandas as pd
from loguru import logger
from ..strategies.base import BaseStrategy, Signal, SignalType, MarketData

@dataclass
class BacktestResult:
    """回测结果"""
    strategy_name: str
    symbol: str
    start_date: str
    end_date: str
    initial_capital: float
    final_capital: float
    total_return: float           # 总收益率
    annual_return: float          # 年化收益率
    max_drawdown: float           # 最大回撤
    sharpe_ratio: float           # 夏普比率
    win_rate: float               # 胜率
    profit_factor: float          # 盈亏比
    total_trades: int             # 总交易次数
    winning_trades: int           # 盈利次数
    losing_trades: int            # 亏损次数
    avg_profit: float             # 平均盈利
    avg_loss: float               # 平均亏损
    trades: List[Dict] = field(default_factory=list)
    equity_curve: List[Dict] = field(default_factory=list)

class BacktestEngine:
    """回测引擎"""

    def __init__(
        self,
        strategy: BaseStrategy,
        initial_capital: float = 100000,
        commission: float = 0.001,
        slippage: float = 0.0005
    ):
        self.strategy = strategy
        self.initial_capital = initial_capital
        self.commission = commission
        self.slippage = slippage

        # 状态
        self.capital = initial_capital
        self.position = 0
        self.entry_price = 0
        self.trades: List[Dict] = []
        self.equity_curve: List[Dict] = []

    def run(self, bars: List[MarketData]) -> BacktestResult:
        """运行回测"""
        logger.info(f"Starting backtest: {len(bars)} bars")

        for bar in bars:
            # 更新权益曲线
            self._update_equity(bar)

            # 获取策略信号
            signal = self.strategy.on_bar(bar)

            if signal:
                self._execute_signal(signal, bar)

        # 强制平仓
        if self.position != 0:
            self._close_position(bars[-1])

        # 计算回测指标
        return self._calculate_metrics(bars)

    def _execute_signal(self, signal: Signal, bar: MarketData):
        """执行交易信号"""
        if signal.type == SignalType.ENTRY_LONG and self.position == 0:
            # 开多
            price = bar.close * (1 + self.slippage)
            cost = price * signal.quantity * (1 + self.commission)

            if cost <= self.capital:
                self.position = signal.quantity
                self.entry_price = price
                self.capital -= cost

                self.trades.append({
                    "type": "ENTRY_LONG",
                    "timestamp": bar.timestamp,
                    "price": price,
                    "quantity": signal.quantity,
                    "cost": cost
                })

        elif signal.type == SignalType.EXIT_LONG and self.position > 0:
            # 平多
            price = bar.close * (1 - self.slippage)
            revenue = price * self.position * (1 - self.commission)
            pnl = revenue - self.entry_price * self.position

            self.capital += revenue

            self.trades.append({
                "type": "EXIT_LONG",
                "timestamp": bar.timestamp,
                "price": price,
                "quantity": self.position,
                "revenue": revenue,
                "pnl": pnl
            })

            self.position = 0
            self.entry_price = 0

    def _close_position(self, bar: MarketData):
        """强制平仓"""
        if self.position > 0:
            signal = Signal(
                type=SignalType.EXIT_LONG,
                symbol=bar.symbol,
                exchange=bar.exchange,
                price=bar.close,
                quantity=self.position
            )
            self._execute_signal(signal, bar)

    def _update_equity(self, bar: MarketData):
        """更新权益曲线"""
        position_value = self.position * bar.close if self.position > 0 else 0
        equity = self.capital + position_value

        self.equity_curve.append({
            "timestamp": bar.timestamp,
            "equity": equity,
            "capital": self.capital,
            "position_value": position_value
        })

    def _calculate_metrics(self, bars: List[MarketData]) -> BacktestResult:
        """计算回测指标"""
        equity_df = pd.DataFrame(self.equity_curve)
        trades_df = pd.DataFrame(self.trades)

        # 基本指标
        final_capital = self.capital
        total_return = (final_capital - self.initial_capital) / self.initial_capital

        # 最大回撤
        equity_df["peak"] = equity_df["equity"].cummax()
        equity_df["drawdown"] = (equity_df["equity"] - equity_df["peak"]) / equity_df["peak"]
        max_drawdown = abs(equity_df["drawdown"].min())

        # 交易统计
        exit_trades = trades_df[trades_df["type"] == "EXIT_LONG"] if len(trades_df) > 0 else pd.DataFrame()

        if len(exit_trades) > 0:
            winning_trades = len(exit_trades[exit_trades["pnl"] > 0])
            losing_trades = len(exit_trades[exit_trades["pnl"] <= 0])
            win_rate = winning_trades / len(exit_trades) if len(exit_trades) > 0 else 0

            avg_profit = exit_trades[exit_trades["pnl"] > 0]["pnl"].mean() if winning_trades > 0 else 0
            avg_loss = abs(exit_trades[exit_trades["pnl"] <= 0]["pnl"].mean()) if losing_trades > 0 else 0
            profit_factor = avg_profit / avg_loss if avg_loss > 0 else 0
        else:
            winning_trades = losing_trades = 0
            win_rate = avg_profit = avg_loss = profit_factor = 0

        # 年化收益率 (假设252个交易日)
        days = (bars[-1].timestamp - bars[0].timestamp) / (24 * 3600 * 1000)
        annual_return = (1 + total_return) ** (365 / days) - 1 if days > 0 else 0

        # 夏普比率 (假设无风险利率为3%)
        if len(equity_df) > 1:
            returns = equity_df["equity"].pct_change().dropna()
            sharpe_ratio = (returns.mean() * 252 - 0.03) / (returns.std() * (252 ** 0.5)) if returns.std() > 0 else 0
        else:
            sharpe_ratio = 0

        return BacktestResult(
            strategy_name=self.strategy.name,
            symbol=bars[0].symbol if bars else "",
            start_date=str(bars[0].timestamp) if bars else "",
            end_date=str(bars[-1].timestamp) if bars else "",
            initial_capital=self.initial_capital,
            final_capital=final_capital,
            total_return=total_return,
            annual_return=annual_return,
            max_drawdown=max_drawdown,
            sharpe_ratio=sharpe_ratio,
            win_rate=win_rate,
            profit_factor=profit_factor,
            total_trades=len(exit_trades),
            winning_trades=winning_trades,
            losing_trades=losing_trades,
            avg_profit=avg_profit,
            avg_loss=avg_loss,
            trades=self.trades,
            equity_curve=self.equity_curve
        )
```

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
| `market.bars.{exchange}.{symbol}` | K线数据 | MarketData |
| `market.ticks.{exchange}.{symbol}` | Tick数据 | TickData |

### 发布主题

| 主题 | 说明 | 数据格式 |
|------|------|----------|
| `strategy.signals.{symbol}.{type}` | 交易信号 | Signal |
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

---

**版本**: 1.0.0
**最后更新**: 2026-01-23
**维护者**: 量化团队
