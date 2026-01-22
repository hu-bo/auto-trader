# Auto Trader - 量化交易平台

> 一个完整的量化交易系统，支持策略开发、回测、实盘交易、风控管理和用户管理。

## 项目概述

Auto Trader 是一个企业级量化交易平台，采用微服务架构设计，支持多策略、多交易所、多币种的量化交易。系统提供完整的策略开发、回测、实盘交易、风险控制和用户管理功能。

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
- **图表**: ECharts

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

### 4. 访问服务
- **策略引擎**: http://localhost:8000
- **交易引擎**: http://localhost:3000
- **用户服务**: http://localhost:3001
- **管理后台**: http://localhost:8080
- **Grafana**: http://localhost:3000 (admin/admin)
- **Prometheus**: http://localhost:9090

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

## 监控与告警

### 1. 系统监控
- **CPU/内存/磁盘**: Prometheus + Grafana
- **服务健康**: 健康检查端点
- **业务指标**: 自定义指标

### 2. 告警规则
- **系统告警**: CPU > 80%, 内存 > 80%
- **交易告警**: 订单失败率 > 10%, 仓位异常
- **风控告警**: 回撤 > 20%, 违规交易

### 3. 日志管理
- **应用日志**: 按服务分类
- **交易日志**: 按订单/信号分类
- **审计日志**: 用户操作记录

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

### 2. 生产部署
```bash
# 1. 配置环境变量
export ENV=production
export DB_PASSWORD=your_password
export JWT_SECRET=your_secret

# 2. 启动服务
docker-compose -f docker-compose.prod.yml up -d

# 3. 设置监控
docker-compose -f docker-compose.monitoring.yml up -d
```

### 3. Kubernetes 部署
```bash
# 应用 Kubernetes 配置
kubectl apply -f k8s/

# 查看部署状态
kubectl get pods
kubectl get services
```

## 安全考虑

### 1. 认证与授权
- JWT 令牌认证
- OAuth2 支持
- 基于角色的访问控制 (RBAC)
- API 密钥管理

### 2. 数据安全
- 敏感数据加密存储
- 数据库访问控制
- 审计日志
- 数据备份

### 3. 交易安全
- 风控前置检查
- 订单限额
- 仓位限制
- 异常检测

### 4. 网络安全
- HTTPS 加密
- IP 白名单
- API 速率限制
- DDoS 防护

## 故障处理

### 1. 常见问题
- **数据库连接失败**: 检查数据库服务状态
- **交易所 API 限流**: 降低请求频率
- **网络延迟**: 检查网络连接
- **内存不足**: 优化代码或增加资源

### 2. 恢复机制
- **自动重试**: 指数退避重试
- **降级处理**: 备用方案
- **数据恢复**: 定期备份
- **服务重启**: 自动重启失败服务

## 性能优化

### 1. 数据库优化
- 索引优化
- 查询优化
- 连接池管理
- 数据分区

### 2. 缓存策略
- Redis 缓存
- 多级缓存
- 缓存失效策略
- 预热缓存

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

## 扩展性

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

## 开发团队

- **架构师**: 资深系统工程师
- **量化开发**: 量化交易员
- **前端开发**: UI/UX 工程师
- **运维**: DevOps 工程师

## 贡献指南

1. Fork 项目
2. 创建特性分支
3. 提交代码
4. 创建 Pull Request
5. 代码审查
6. 合并

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