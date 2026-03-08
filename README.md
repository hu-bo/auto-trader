# Auto Trader - 量化交易平台

> 一个完整的量化交易系统，支持策略开发、回测、实盘交易、风控管理和用户管理。

## 项目概述

Auto Trader 是一个企业级量化交易平台，采用微服务架构设计，支持多策略、多交易所、多币种的量化交易。系统提供完整的策略开发、回测、实盘交易、风险控制和用户管理功能。

> 当前仓库以“架构设计 + 技术文档 + 协议定义”为主，服务代码与目录会按 `docs/PROJECT_STRUCTURE.md` 的目标结构逐步实现与落地。

## 架构概览

```
auto-trader/
├── apps/                    # 可部署单元
│   ├── strategy-engine/     # 策略引擎 (Python)
│   ├── trading-engine/      # 交易引擎 (Node.js)
│   ├── user-service/        # 用户服务 (Node.js)
│   └── admin-service/       # 管理后台 (Node.js + React)
│
├── packages/                # 共享能力
│   ├── contracts/           # 核心数据结构 & 协议
│   │   ├── proto/           # Protobuf 定义
│   │   └── generated/       # 生成的类型定义
│   ├── risk-engine/         # 风控规则 (Node.js)
│   ├── hquant-py/           # 组合 & 仓位模型 (Python)
│   └── hquant-rust/         # 指标库 (Rust)
│
├── infra/                   # 基础设施
│   ├── exchange-adapters/   # 交易所适配
│   ├── message-bus/         # NATS 消息总线
│   └── storage/             # 数据存储
│
├── logs/                    # 日志文件
├── docs/                    # 文档
└── docker-compose.yml       # Docker 编排
```

## 核心组件

### 1. Strategy Engine (策略引擎)
- **语言**: Python 3.11+
- **框架**: FastAPI + Celery
- **功能**:
  - 策略开发与管理
  - 实时信号生成
  - 回测引擎
  - 参数优化
- **文档**: [apps/strategy-engine/README.md](apps/strategy-engine/README.md)

### 2. Trading Engine (交易引擎)
- **语言**: Node.js 20+
- **框架**: NestJS + TypeScript
- **功能**:
  - 订单管理 (OMS)
  - 仓位管理
  - 交易所适配
  - 风控前置
- **文档**: [apps/trading-engine/README.md](apps/trading-engine/README.md)

### 3. User Service (用户服务)
- **语言**: Node.js 20+
- **框架**: NestJS + TypeScript
- **功能**:
  - 用户认证与授权
  - 策略配置管理
  - API 密钥管理
  - 通知设置
- **文档**: [apps/user-service/README.md](apps/user-service/README.md)

### 4. Admin Service (管理后台)
- **语言**: Node.js 20+ (后端) + React 18 (前端)
- **框架**: NestJS + Ant Design
- **功能**:
  - 系统监控
  - 用户管理
  - 策略管理
  - 风控管理
  - 数据报表
- **文档**: [apps/admin-service/README.md](apps/admin-service/README.md)

## 技术栈

### 后端
- **Python**: FastAPI, Celery, Pandas, NumPy, TA-Lib
- **Node.js**: NestJS, TypeScript, PostgreSQL, Redis
- **Rust**: 高性能指标计算
- **消息队列**: NATS
- **数据库**: PostgreSQL, Redis

### 前端
- **React**: React 18
- **UI 库**: Ant Design 5
- **状态管理**: Zustand
- **图表**: klinecharts（封装成 `@klinecharts/pro` 风格的 K 线专业组件；不使用 ECharts）

### 基础设施
- **容器**: Docker, Docker Compose
- **监控**: Prometheus, Grafana
- **日志**: Elasticsearch, Logstash, Kibana
- **CI/CD**: GitHub Actions

## 数据流

### 实时交易流
```
市场数据 → Strategy Engine → 信号生成 → NATS → Trading Engine → 风控检查 → 交易所 → 订单执行 → 仓位更新
```

### 回测流
```
历史数据 → Backtest Engine → 策略回测 → 指标计算 → 结果存储 → 报表生成
```

### 用户流
```
用户登录 → User Service → 认证授权 → 配置管理 → 策略启动 → 信号订阅
```

## 快速开始

### 1. 环境要求
- Docker 20.10+
- Docker Compose 2.0+
- Node.js 20+
- Python 3.11+
- PostgreSQL 15+
- Redis 7+

### 2. 配置环境变量
```bash
# 复制环境变量模板
cp .env.example .env

# 编辑环境变量
vim .env
```

### 3. 启动服务
```bash
# 启动所有服务
docker-compose up -d

# 查看服务状态
docker-compose ps

# 查看日志
docker-compose logs -f <service-name>
```

## 开发指南

### 1. 添加新策略
```python
# apps/strategy-engine/src/strategies/custom/my_strategy.py
from src.core.strategy_base import StrategyBase
from src.core.signal_generator import Signal

class MyStrategy(StrategyBase):
    def on_data(self, data: pd.DataFrame) -> List[Signal]:
        # 实现策略逻辑
        signals = []
        # ... 策略代码
        return signals
```

### 2. 添加新交易所适配器
```typescript
// apps/trading-engine/src/exchange/adapters/new-exchange.adapter.ts
import { IExchangeAdapter } from '../interfaces/exchange.interface';

export class NewExchangeAdapter implements IExchangeAdapter {
  async createOrder(order: Order): Promise<ExchangeOrder> {
    // 实现交易所 API
  }
}
```

### 3. 添加新风控规则
```typescript
// packages/risk-engine/src/rules/custom-rule.ts
import { RiskRule, RiskContext } from '../core/rule-base';

export class CustomRule extends RiskRule {
  async check(context: RiskContext): Promise<boolean> {
    // 实现风控逻辑
    return true;
  }
}
```

## 配置管理

### 1. 环境配置
```yaml
# config/config.yaml
app:
  name: "auto-trader"
  env: "production"
  debug: false

database:
  postgres:
    host: "postgres"
    port: 5432
    database: "autotrader"
    user: "autotrader"
    password: "${DB_PASSWORD}"

redis:
  host: "redis"
  port: 6379

nats:
  url: "nats://nats:4222"
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
risk:
  max_position_pct: 0.3
  max_daily_loss: 0.05
```

## 测试

### 1. 单元测试
```bash
# Python
cd apps/strategy-engine
pytest tests/unit/

# Node.js
cd apps/trading-engine
npm run test:unit
```

### 2. 集成测试
```bash
# Python
cd apps/strategy-engine
pytest tests/integration/

# Node.js
cd apps/trading-engine
npm run test:integration
```

### 3. 回测测试
```bash
cd apps/strategy-engine
pytest tests/backtest/
```

## 部署

### 1. Docker 部署
```bash
# 构建镜像
docker-compose build

# 启动服务
docker-compose up -d

# 停止服务
docker-compose down
```


## 许可证

MIT License

## 联系方式

- **邮箱**: support@autotrader.com
- **文档**: [docs/](docs/)
- **问题反馈**: GitHub Issues

---

**版本**: 1.0.0
**最后更新**: 2026-01-22
**维护者**: 量化团队
