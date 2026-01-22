# Strategy Engine - 策略引擎服务

## 概述

策略引擎是量化交易系统的核心决策层，负责：
- 运行量化策略模型
- 生成交易信号
- 执行回测和模拟交易
- 管理策略生命周期

## 技术栈

- **语言**: Python 3.11+
- **框架**: FastAPI + Celery (异步任务队列)
- **数据处理**: Pandas, NumPy, TA-Lib
- **机器学习**: Scikit-learn, PyTorch (可选)
- **数据库**: PostgreSQL (策略配置), Redis (缓存)
- **消息队列**: NATS (与交易引擎通信)
- **容器**: Docker + Docker Compose

## 架构设计

### 1. 核心组件

```
strategy-engine/
├── src/
│   ├── api/                    # FastAPI 接口层
│   │   ├── v1/
│   │   │   ├── strategies.py   # 策略管理 API
│   │   │   ├── backtest.py     # 回测 API
│   │   │   └── signals.py      # 信号查询 API
│   │   └── models/             # 请求/响应模型
│   ├── core/                   # 核心逻辑
│   │   ├── strategy_base.py    # 策略基类
│   │   ├── strategy_manager.py # 策略管理器
│   │   ├── signal_generator.py # 信号生成器
│   │   └── risk_assessor.py    # 风险评估器
│   ├── strategies/             # 策略实现
│   │   ├── trend_following/    # 趋势跟踪
│   │   ├── mean_reversion/     # 均值回归
│   │   ├── arbitrage/          # 套利策略
│   │   └── machine_learning/   # 机器学习策略
│   ├── data/                   # 数据处理
│   │   ├── market_data.py      # 市场数据获取
│   │   ├── feature_engineering.py  # 特征工程
│   │   └── data_provider.py    # 数据提供者
│   ├── backtest/               # 回测引擎
│   │   ├── engine.py           # 回测核心
│   │   ├── metrics.py          # 回测指标
│   │   └── optimizer.py        # 参数优化
│   ├── tasks/                  # Celery 任务
│   │   ├── strategy_tasks.py   # 策略任务
│   │   ├── backtest_tasks.py   # 回测任务
│   │   └── signal_tasks.py     # 信号任务
│   └── utils/                  # 工具类
│       ├── logger.py           # 日志
│       ├── config.py           # 配置
│       └── metrics.py          # 指标计算
├── tests/                      # 测试
├── config/                     # 配置文件
├── scripts/                    # 脚本
├── Dockerfile
├── docker-compose.yml
├── requirements.txt
└── pyproject.toml
```

### 2. 策略架构

#### 策略基类 (StrategyBase)
```python
class StrategyBase:
    """策略基类"""

    def __init__(self, config: dict):
        self.config = config
        self.name = config.get('name', 'unknown')
        self.symbol = config.get('symbol')
        self.exchange = config.get('exchange')
        self.params = config.get('params', {})

    def on_data(self, data: pd.DataFrame) -> List[Signal]:
        """处理市场数据，生成信号"""
        raise NotImplementedError

    def on_signal(self, signal: Signal) -> None:
        """处理信号回调"""
        pass

    def get_metrics(self) -> dict:
        """获取策略指标"""
        return {}
```

#### 策略管理器 (StrategyManager)
```python
class StrategyManager:
    """策略管理器"""

    def __init__(self):
        self.strategies = {}  # 策略实例
        self.status = {}      # 策略状态

    def load_strategy(self, config: dict) -> str:
        """加载策略"""
        pass

    def start_strategy(self, strategy_id: str) -> bool:
        """启动策略"""
        pass

    def stop_strategy(self, strategy_id: str) -> bool:
        """停止策略"""
        pass

    def get_strategy_status(self, strategy_id: str) -> dict:
        """获取策略状态"""
        pass
```

### 3. 信号生成流程

```
市场数据 → 特征工程 → 策略计算 → 风险评估 → 信号生成 → NATS发布
```

### 4. 回测引擎

#### 回测配置
```python
@dataclass
class BacktestConfig:
    symbol: str
    exchange: str
    start_date: str
    end_date: str
    initial_capital: float = 100000.0
    commission: float = 0.001
    slippage: float = 0.0001
    frequency: str = '1m'  # 1m, 5m, 1h, 1d
```

#### 回测指标
- **收益指标**: 总收益、年化收益、最大回撤、夏普比率
- **风险指标**: 波动率、VaR、CVaR
- **交易指标**: 胜率、盈亏比、交易次数、持仓时间

## API 接口

### 1. 策略管理 API

#### GET /api/v1/strategies
获取策略列表

**响应示例**:
```json
{
  "strategies": [
    {
      "id": "trend_001",
      "name": "趋势跟踪策略",
      "type": "trend_following",
      "status": "running",
      "symbol": "BTC/USDT",
      "exchange": "binance",
      "created_at": "2026-01-22T10:00:00Z"
    }
  ],
  "total": 1
}
```

#### POST /api/v1/strategies
创建策略

**请求示例**:
```json
{
  "name": "趋势跟踪策略",
  "type": "trend_following",
  "symbol": "BTC/USDT",
  "exchange": "binance",
  "params": {
    "fast_period": 20,
    "slow_period": 50,
    "stop_loss_pct": 0.02,
    "take_profit_pct": 0.05
  }
}
```

#### PUT /api/v1/strategies/{strategy_id}/start
启动策略

#### PUT /api/v1/strategies/{strategy_id}/stop
停止策略

### 2. 回测 API

#### POST /api/v1/backtest/run
运行回测

**请求示例**:
```json
{
  "strategy_id": "trend_001",
  "config": {
    "symbol": "BTC/USDT",
    "exchange": "binance",
    "start_date": "2024-01-01",
    "end_date": "2024-12-31",
    "initial_capital": 100000,
    "commission": 0.001
  }
}
```

**响应示例**:
```json
{
  "backtest_id": "bt_001",
  "status": "completed",
  "metrics": {
    "total_return": 0.156,
    "annual_return": 0.156,
    "max_drawdown": -0.085,
    "sharpe_ratio": 1.23,
    "win_rate": 0.58,
    "profit_factor": 1.85,
    "total_trades": 142
  },
  "equity_curve": [...],
  "trades": [...]
}
```

#### GET /api/v1/backtest/{backtest_id}
获取回测结果

### 3. 信号 API

#### GET /api/v1/signals
查询信号

**查询参数**:
- `strategy_id`: 策略ID
- `symbol`: 交易对
- `type`: 信号类型
- `status`: 信号状态
- `start_time`: 开始时间
- `end_time`: 结束时间
- `page`: 页码
- `page_size`: 每页数量

## 数据流

### 1. 实时数据流
```
NATS (market-data) → Data Provider → Feature Engineering → Strategy → Signal Generator → NATS (signals)
```

### 2. 回测数据流
```
Database (历史数据) → Backtest Engine → Strategy → Signal Generator → Metrics Calculator → Database
```

## 配置管理

### 1. 环境配置
```yaml
# config/config.yaml
app:
  name: "strategy-engine"
  env: "production"
  debug: false

database:
  postgres:
    host: "postgres"
    port: 5432
    database: "strategy_db"
    user: "strategy_user"
    password: "${DB_PASSWORD}"

redis:
  host: "redis"
  port: 6379
  db: 0

nats:
  url: "nats://nats:4222"
  subjects:
    market_data: "market.data.>"
    signals: "strategy.signals.>"
    orders: "trading.orders.>"

celery:
  broker: "redis://redis:6379/0"
  backend: "redis://redis:6379/0"
```

### 2. 策略配置
```yaml
# strategies/trend_following.yaml
name: "趋势跟踪策略"
type: "trend_following"
symbol: "BTC/USDT"
exchange: "binance"
params:
  fast_period: 20
  slow_period: 50
  stop_loss_pct: 0.02
  take_profit_pct: 0.05
  atr_period: 14
  atr_multiplier: 2.0
risk:
  max_position_pct: 0.3
  max_daily_loss: 0.05
  max_drawdown: 0.2
```

## 部署

### 1. Docker 部署
```dockerfile
# Dockerfile
FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8000

CMD ["uvicorn", "src.api.app:app", "--host", "0.0.0.0", "--port", "8000"]
```

### 2. Docker Compose
```yaml
# docker-compose.yml
version: '3.8'

services:
  strategy-engine:
    build: .
    ports:
      - "8000:8000"
    environment:
      - ENV=production
      - DB_PASSWORD=${DB_PASSWORD}
    depends_on:
      - postgres
      - redis
      - nats
    volumes:
      - ./logs:/app/logs
      - ./data:/app/data

  postgres:
    image: postgres:15
    environment:
      POSTGRES_DB: strategy_db
      POSTGRES_USER: strategy_user
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    volumes:
      - redis_data:/data

  nats:
    image: nats:2.9
    command: ["-js", "-m", "8222"]

volumes:
  postgres_data:
  redis_data:
```

## 监控与日志

### 1. 日志配置
```python
# src/utils/logger.py
import logging
from logging.handlers import RotatingFileHandler

def setup_logger(name: str):
    logger = logging.getLogger(name)
    logger.setLevel(logging.INFO)

    # 文件日志
    file_handler = RotatingFileHandler(
        f'/app/logs/{name}.log',
        maxBytes=10*1024*1024,  # 10MB
        backupCount=5
    )

    # 控制台日志
    console_handler = logging.StreamHandler()

    formatter = logging.Formatter(
        '%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    )
    file_handler.setFormatter(formatter)
    console_handler.setFormatter(formatter)

    logger.addHandler(file_handler)
    logger.addHandler(console_handler)

    return logger
```

### 2. 指标监控
- **Prometheus**: 暴露 `/metrics` 端点
- **Grafana**: 可视化监控面板
- **AlertManager**: 告警通知

## 测试

### 1. 单元测试
```bash
pytest tests/unit/ -v
```

### 2. 集成测试
```bash
pytest tests/integration/ -v
```

### 3. 回测测试
```bash
pytest tests/backtest/ -v
```

## 开发指南

### 1. 添加新策略
```python
# src/strategies/custom/my_strategy.py
from src.core.strategy_base import StrategyBase
from src.core.signal_generator import Signal

class MyStrategy(StrategyBase):
    """自定义策略示例"""

    def __init__(self, config: dict):
        super().__init__(config)
        self.param1 = self.params.get('param1', 10)
        self.param2 = self.params.get('param2', 20)

    def on_data(self, data: pd.DataFrame) -> List[Signal]:
        # 实现策略逻辑
        signals = []

        # 示例：简单均线交叉
        data['ma_fast'] = data['close'].rolling(self.param1).mean()
        data['ma_slow'] = data['close'].rolling(self.param2).mean()

        if data['ma_fast'].iloc[-1] > data['ma_slow'].iloc[-1]:
            signals.append(Signal(
                type=SignalType.ENTRY_LONG,
                symbol=self.symbol,
                quantity=0.1,
                price=data['close'].iloc[-1]
            ))

        return signals
```

### 2. 策略注册
```python
# src/strategies/__init__.py
from .trend_following import TrendFollowingStrategy
from .mean_reversion import MeanReversionStrategy
from .custom.my_strategy import MyStrategy

STRATEGY_REGISTRY = {
    'trend_following': TrendFollowingStrategy,
    'mean_reversion': MeanReversionStrategy,
    'my_strategy': MyStrategy,
}
```

## 性能优化

### 1. 数据缓存
- 使用 Redis 缓存市场数据
- 实现 LRU 缓存策略
- 定期预热缓存

### 2. 并行处理
- 使用 Celery 分布式任务
- 多进程数据处理
- 异步 I/O 操作

### 3. 内存优化
- 使用 NumPy 数组代替列表
- 及时释放不再使用的数据
- 使用生成器处理大数据集

## 安全考虑

### 1. API 安全
- JWT 认证
- API 速率限制
- 输入验证

### 2. 数据安全
- 敏感信息加密存储
- 数据库访问控制
- 审计日志

## 故障处理

### 1. 常见问题
- **数据源中断**: 切换备用数据源
- **策略异常**: 自动暂停策略
- **网络问题**: 重试机制

### 2. 恢复机制
- 策略状态持久化
- 断点续传
- 自动重启

## 扩展性

### 1. 插件系统
- 支持动态加载策略
- 模块化架构
- 配置驱动

### 2. 多语言支持
- Python 核心策略
- Rust 高性能计算（可选）
- Go 网络服务（可选）

## 监控指标

### 1. 系统指标
- CPU 使用率
- 内存使用率
- 磁盘 I/O
- 网络流量

### 2. 业务指标
- 策略运行数量
- 信号生成频率
- 回测成功率
- 交易胜率

## 版本管理

### 1. 策略版本
- 策略配置版本化
- 回测结果关联版本
- 策略回滚支持

### 2. API 版本
- REST API 版本控制
- 向后兼容
- 版本迁移工具

## 参考文档

- [FastAPI 文档](https://fastapi.tiangolo.com/)
- [Celery 文档](https://docs.celeryq.dev/)
- [Pandas 文档](https://pandas.pydata.org/)
- [TA-Lib 文档](https://ta-lib.org/)

---

**维护者**: 量化团队
**版本**: 1.0.0
**最后更新**: 2026-01-22