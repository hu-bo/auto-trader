# Admin Service - 管理后台服务1

## 概述

管理后台是量化交易系统的管理控制中心，负责：
- 系统监控与运维
- 用户管理与权限控制
- 策略管理与配置
- 风控规则管理
- 数据统计与报表
- 系统配置与维护

## 技术栈

- **语言**: Node.js 20+
- **框架**: Midway.js 3.x + TypeScript
- **前端**: React 18 + Ant Design
- **数据库**: PostgreSQL (管理数据), Redis (缓存)
- **消息队列**: NATS (系统事件)
- **监控**: Prometheus + Grafana
- **日志**: ELK Stack (Elasticsearch, Logstash, Kibana)
- **容器**: Docker + Docker Compose

## 架构设计

### 1. 核心组件

```
admin-service/
├── src/
│   ├── configuration.ts        # Midway 应用配置入口
│   ├── controller/             # 控制器层
│   │   ├── v1/
│   │   │   ├── system/         # 系统管理
│   │   │   │   ├── monitor.controller.ts
│   │   │   │   ├── config.controller.ts
│   │   │   │   └── health.controller.ts
│   │   │   ├── user/           # 用户管理
│   │   │   │   ├── user.controller.ts
│   │   │   │   ├── role.controller.ts
│   │   │   │   └── permission.controller.ts
│   │   │   ├── strategy/       # 策略管理
│   │   │   │   ├── strategy.controller.ts
│   │   │   │   ├── backtest.controller.ts
│   │   │   │   └── signal.controller.ts
│   │   │   ├── risk/           # 风控管理
│   │   │   │   ├── rule.controller.ts
│   │   │   │   ├── alert.controller.ts
│   │   │   │   └── violation.controller.ts
│   │   │   ├── trading/        # 交易管理
│   │   │   │   ├── order.controller.ts
│   │   │   │   ├── position.controller.ts
│   │   │   │   └── account.controller.ts
│   │   │   └── report/         # 报表管理
│   │   │       ├── dashboard.controller.ts
│   │   │       ├── analytics.controller.ts
│   │   │       └── export.controller.ts
│   │   └── dto/                # DTO 定义
│   ├── service/                # 服务层
│   │   ├── system/             # 系统模块
│   │   │   ├── monitor.service.ts
│   │   │   ├── config.service.ts
│   │   │   └── health.service.ts
│   │   ├── user/               # 用户模块
│   │   │   ├── user.service.ts
│   │   │   ├── role.service.ts
│   │   │   └── permission.service.ts
│   │   ├── strategy/           # 策略模块
│   │   │   ├── strategy.service.ts
│   │   │   ├── backtest.service.ts
│   │   │   └── signal.service.ts
│   │   ├── risk/               # 风控模块
│   │   │   ├── rule.service.ts
│   │   │   ├── alert.service.ts
│   │   │   └── violation.service.ts
│   │   ├── trading/            # 交易模块
│   │   │   ├── order.service.ts
│   │   │   ├── position.service.ts
│   │   │   └── account.service.ts
│   │   └── report/             # 报表模块
│   │       ├── dashboard.service.ts
│   │       ├── analytics.service.ts
│   │       └── export.service.ts
│   ├── entity/                 # 数据实体 (TypeORM)
│   │   ├── system/
│   │   │   ├── system-config.entity.ts
│   │   │   ├── system-log.entity.ts
│   │   │   └── system-alert.entity.ts
│   │   ├── user/
│   │   │   ├── admin-user.entity.ts
│   │   │   ├── role.entity.ts
│   │   │   └── permission.entity.ts
│   │   ├── strategy/
│   │   │   ├── strategy-template.entity.ts
│   │   │   └── backtest-result.entity.ts
│   │   ├── risk/
│   │   │   ├── risk-rule.entity.ts
│   │   │   └── risk-alert.entity.ts
│   │   └── report/
│   │       ├── dashboard-widget.entity.ts
│   │       └── report-template.entity.ts
│   ├── middleware/             # 中间件
│   │   ├── auth.middleware.ts
│   │   ├── logger.middleware.ts
│   │   └── permission.middleware.ts
│   ├── filter/                 # 异常过滤器
│   │   └── default.filter.ts
│   ├── decorator/              # 自定义装饰器
│   │   ├── permission.decorator.ts
│   │   └── roles.decorator.ts
│   ├── queue/                  # 队列任务
│   │   ├── system.queue.ts
│   │   ├── report.queue.ts
│   │   └── cleanup.queue.ts
│   ├── task/                   # 定时任务
│   │   ├── system.task.ts
│   │   ├── report.task.ts
│   │   └── cleanup.task.ts
│   └── util/                   # 工具类
│       ├── logger.ts
│       ├── validator.ts
│       ├── export.ts
│       └── chart.ts
├── src/config/                 # Midway 配置文件
│   ├── config.default.ts       # 默认配置
│   ├── config.local.ts         # 本地开发配置
│   ├── config.prod.ts          # 生产环境配置
│   └── config.unittest.ts      # 单元测试配置
├── web/                        # 前端应用
│   ├── src/
│   │   ├── components/         # 组件
│   │   ├── pages/              # 页面
│   │   ├── layouts/            # 布局
│   │   ├── services/           # API 服务
│   │   ├── stores/             # 状态管理
│   │   ├── utils/              # 工具
│   │   └── styles/             # 样式
│   ├── public/                 # 静态资源
│   └── package.json
├── test/                       # 测试
├── scripts/                    # 脚本
├── bootstrap.js                # Midway 启动文件
├── Dockerfile
├── docker-compose.yml
├── package.json
└── tsconfig.json
```

### 2. 核心依赖 (package.json)

```json
{
  "name": "admin-service",
  "version": "1.0.0",
  "scripts": {
    "dev": "cross-env NODE_ENV=local midway-bin dev --ts",
    "build": "midway-bin build -c",
    "start": "NODE_ENV=production node bootstrap.js",
    "test": "midway-bin test --ts",
    "lint": "eslint --ext .ts src/"
  },
  "dependencies": {
    "@midwayjs/bootstrap": "^3.14.0",
    "@midwayjs/core": "^3.14.0",
    "@midwayjs/decorator": "^3.14.0",
    "@midwayjs/koa": "^3.14.0",
    "@midwayjs/typeorm": "^3.14.0",
    "@midwayjs/redis": "^3.14.0",
    "@midwayjs/jwt": "^3.14.0",
    "@midwayjs/task": "^3.14.0",
    "@midwayjs/validate": "^3.14.0",
    "@midwayjs/logger": "^3.14.0",
    "typeorm": "^0.3.17",
    "pg": "^8.11.3",
    "ioredis": "^5.3.2",
    "prom-client": "^15.1.0",
    "exceljs": "^4.4.0"
  },
  "devDependencies": {
    "@midwayjs/cli": "^2.1.0",
    "@types/node": "^20.10.0",
    "cross-env": "^7.0.3",
    "typescript": "~5.3.0"
  }
}
```

### 3. 权限架构

#### 角色定义
```typescript
export enum AdminRole {
  SUPER_ADMIN = 'super_admin',      // 超级管理员
  SYSTEM_ADMIN = 'system_admin',    // 系统管理员
  RISK_ADMIN = 'risk_admin',        // 风控管理员
  STRATEGY_ADMIN = 'strategy_admin', // 策略管理员
  VIEWER = 'viewer',                // 只读用户
}
```

#### 权限矩阵
```typescript
export const ROLE_PERMISSIONS: Record<AdminRole, string[]> = {
  [AdminRole.SUPER_ADMIN]: [
    'system:*',
    'user:*',
    'strategy:*',
    'risk:*',
    'trading:*',
    'report:*'
  ],
  [AdminRole.SYSTEM_ADMIN]: [
    'system:read',
    'system:write',
    'user:read',
    'user:write',
    'report:read'
  ],
  [AdminRole.RISK_ADMIN]: [
    'risk:read',
    'risk:write',
    'trading:read',
    'report:read'
  ],
  [AdminRole.STRATEGY_ADMIN]: [
    'strategy:read',
    'strategy:write',
    'trading:read',
    'report:read'
  ],
  [AdminRole.VIEWER]: [
    'system:read',
    'user:read',
    'strategy:read',
    'risk:read',
    'trading:read',
    'report:read'
  ]
};
```

## API 接口

### 1. 系统管理 API

#### GET /api/v1/system/health
系统健康检查

**响应示例**:
```json
{
  "status": "healthy",
  "timestamp": "2026-01-22T10:00:00Z",
  "services": {
    "database": "connected",
    "redis": "connected",
    "nats": "connected",
    "strategy-engine": "healthy",
    "trading-engine": "healthy",
    "user-service": "healthy"
  },
  "uptime": "24h 30m",
  "version": "1.0.0"
}
```

#### GET /api/v1/system/metrics
系统指标

**响应示例**:
```json
{
  "cpu": {
    "usage": 45.2,
    "cores": 8
  },
  "memory": {
    "total": 16384,
    "used": 8192,
    "free": 8192,
    "usage": 50.0
  },
  "disk": {
    "total": 512000,
    "used": 256000,
    "free": 256000,
    "usage": 50.0
  },
  "network": {
    "in": 1024,
    "out": 512
  }
}
```

#### GET /api/v1/system/logs
系统日志

**查询参数**:
- `level`: 日志级别 (error, warn, info, debug)
- `service`: 服务名称
- `start_time`: 开始时间
- `end_time`: 结束时间
- `page`: 页码
- `limit`: 每页数量

#### GET /api/v1/system/configs
系统配置

**响应示例**:
```json
{
  "configs": [
    {
      "key": "trading.max_position_pct",
      "value": 0.3,
      "description": "最大仓位比例",
      "updated_at": "2026-01-22T10:00:00Z",
      "updated_by": "admin"
    }
  ]
}
```

#### PUT /api/v1/system/configs/{key}
更新系统配置

**请求示例**:
```json
{
  "value": 0.4,
  "description": "更新最大仓位比例"
}
```

#### POST /api/v1/system/restart
重启系统服务

**请求示例**:
```json
{
  "services": ["strategy-engine", "trading-engine"],
  "reason": "配置更新"
}
```

### 2. 用户管理 API

#### GET /api/v1/users
获取用户列表

**查询参数**:
- `role`: 角色过滤
- `status`: 状态过滤
- `email`: 邮箱搜索
- `page`: 页码
- `limit`: 每页数量

**响应示例**:
```json
{
  "users": [
    {
      "id": "user_001",
      "email": "user@example.com",
      "name": "张三",
      "role": "user",
      "status": "active",
      "email_verified": true,
      "last_login": "2026-01-22T10:00:00Z",
      "created_at": "2026-01-22T10:00:00Z",
      "stats": {
        "total_orders": 142,
        "total_trades": 284,
        "total_pnl": 5000,
        "win_rate": 0.58
      }
    }
  ],
  "total": 100,
  "page": 0,
  "limit": 20
}
```

#### GET /api/v1/users/{userId}
获取用户详情

#### PUT /api/v1/users/{userId}/status
更新用户状态

**请求示例**:
```json
{
  "status": "suspended",
  "reason": "违反风控规则"
}
```

#### PUT /api/v1/users/{userId}/role
更新用户角色

**请求示例**:
```json
{
  "role": "premium"
}
```

#### GET /api/v1/users/{userId}/stats
用户统计信息

#### GET /api/v1/users/{userId}/activity
用户活动记录

### 3. 角色管理 API

#### GET /api/v1/roles
获取角色列表

**响应示例**:
```json
{
  "roles": [
    {
      "id": "role_001",
      "name": "user",
      "description": "普通用户",
      "permissions": [
        "strategy:read",
        "strategy:write",
        "trading:read",
        "trading:write"
      ],
      "user_count": 100,
      "created_at": "2026-01-22T10:00:00Z"
    }
  ]
}
```

#### POST /api/v1/roles
创建角色

**请求示例**:
```json
{
  "name": "premium",
  "description": "高级用户",
  "permissions": [
    "strategy:read",
    "strategy:write",
    "strategy:delete",
    "trading:read",
    "trading:write",
    "trading:delete",
    "risk:read"
  ]
}
```

#### PUT /api/v1/roles/{roleId}
更新角色

#### DELETE /api/v1/roles/{roleId}
删除角色

### 4. 策略管理 API

#### GET /api/v1/strategies
获取策略列表

**查询参数**:
- `status`: 策略状态
- `type`: 策略类型
- `user_id`: 用户ID
- `page`: 页码
- `limit`: 每页数量

**响应示例**:
```json
{
  "strategies": [
    {
      "id": "strategy_001",
      "name": "趋势跟踪策略",
      "type": "trend_following",
      "status": "running",
      "symbol": "BTC/USDT",
      "exchange": "binance",
      "user_id": "user_001",
      "user_email": "user@example.com",
      "stats": {
        "total_orders": 142,
        "total_trades": 284,
        "total_pnl": 5000,
        "win_rate": 0.58,
        "sharpe_ratio": 1.23,
        "max_drawdown": -0.085
      },
      "created_at": "2026-01-22T10:00:00Z",
      "updated_at": "2026-01-22T10:00:00Z"
    }
  ],
  "total": 50,
  "page": 0,
  "limit": 20
}
```

#### GET /api/v1/strategies/{strategyId}
获取策略详情

#### PUT /api/v1/strategies/{strategyId}/status
更新策略状态

**请求示例**:
```json
{
  "status": "paused",
  "reason": "市场波动过大"
}
```

#### GET /api/v1/strategies/{strategyId}/backtests
策略回测历史

#### GET /api/v1/strategies/{strategyId}/signals
策略信号历史

### 5. 回测管理 API

#### GET /api/v1/backtests
获取回测列表

**查询参数**:
- `strategy_id`: 策略ID
- `status`: 回测状态
- `start_time`: 开始时间
- `end_time`: 结束时间
- `page`: 页码
- `limit`: 每页数量

**响应示例**:
```json
{
  "backtests": [
    {
      "id": "bt_001",
      "strategy_id": "strategy_001",
      "strategy_name": "趋势跟踪策略",
      "symbol": "BTC/USDT",
      "exchange": "binance",
      "status": "completed",
      "config": {
        "start_date": "2024-01-01",
        "end_date": "2024-12-31",
        "initial_capital": 100000,
        "commission": 0.001
      },
      "metrics": {
        "total_return": 0.156,
        "annual_return": 0.156,
        "max_drawdown": -0.085,
        "sharpe_ratio": 1.23,
        "win_rate": 0.58,
        "profit_factor": 1.85,
        "total_trades": 142
      },
      "created_at": "2026-01-22T10:00:00Z",
      "completed_at": "2026-01-22T10:30:00Z"
    }
  ],
  "total": 100,
  "page": 0,
  "limit": 20
}
```

#### GET /api/v1/backtests/{backtestId}
获取回测详情

#### DELETE /api/v1/backtests/{backtestId}
删除回测

### 6. 信号管理 API

#### GET /api/v1/signals
获取信号列表

**查询参数**:
- `strategy_id`: 策略ID
- `symbol`: 交易对
- `type`: 信号类型
- `status`: 信号状态
- `start_time`: 开始时间
- `end_time`: 结束时间
- `page`: 页码
- `limit`: 每页数量

**响应示例**:
```json
{
  "signals": [
    {
      "id": "signal_001",
      "type": "entry_long",
      "source": "strategy",
      "status": "completed",
      "symbol": "BTC/USDT",
      "exchange": "binance",
      "quantity": 0.1,
      "price": 45000,
      "strategy_id": "strategy_001",
      "created_at": "2026-01-22T10:00:00Z",
      "executed_at": "2026-01-22T10:01:00Z"
    }
  ],
  "total": 1000,
  "page": 0,
  "limit": 20
}
```

#### GET /api/v1/signals/{signalId}
获取信号详情

### 7. 风控管理 API

#### GET /api/v1/risk/rules
获取风控规则列表

**响应示例**:
```json
{
  "rules": [
    {
      "id": "rule_001",
      "name": "最大仓位限制",
      "type": "position_limit",
      "condition": "position_value / account_balance > 0.3",
      "action": "reject",
      "priority": 1,
      "is_active": true,
      "created_at": "2026-01-22T10:00:00Z"
    }
  ]
}
```

#### POST /api/v1/risk/rules
创建风控规则

**请求示例**:
```json
{
  "name": "单日最大亏损",
  "type": "daily_loss_limit",
  "condition": "daily_loss / account_balance > 0.05",
  "action": "pause_all",
  "priority": 2,
  "description": "单日亏损超过5%时暂停所有策略"
}
```

#### PUT /api/v1/risk/rules/{ruleId}
更新风控规则

#### DELETE /api/v1/risk/rules/{ruleId}
删除风控规则

#### GET /api/v1/risk/alerts
获取风控告警

**查询参数**:
- `level`: 告警级别 (critical, warning, info)
- `status`: 告警状态
- `start_time`: 开始时间
- `end_time`: 结束时间

#### GET /api/v1/risk/violations
获取违规记录

### 8. 交易管理 API

#### GET /api/v1/trading/orders
获取订单列表

**查询参数**:
- `symbol`: 交易对
- `status`: 订单状态
- `user_id`: 用户ID
- `start_time`: 开始时间
- `end_time`: 结束时间
- `page`: 页码
- `limit`: 每页数量

#### GET /api/v1/trading/positions
获取仓位列表

#### GET /api/v1/trading/accounts
获取账户列表

#### GET /api/v1/trading/trades
获取成交记录

### 9. 报表管理 API

#### GET /api/v1/report/dashboard
仪表板数据

**响应示例**:
```json
{
  "summary": {
    "total_users": 1000,
    "active_users": 800,
    "total_strategies": 500,
    "active_strategies": 300,
    "total_orders": 100000,
    "total_trades": 200000,
    "total_pnl": 5000000,
    "total_volume": 1000000000
  },
  "trends": {
    "daily_users": [...],
    "daily_orders": [...],
    "daily_pnl": [...]
  },
  "top_strategies": [...],
  "top_users": [...],
  "alerts": [...]
}
```

#### GET /api/v1/report/analytics
数据分析

**查询参数**:
- `metric`: 指标类型 (pnl, volume, win_rate, etc.)
- `period`: 时间周期 (day, week, month, year)
- `start_time`: 开始时间
- `end_time`: 结束时间
- `group_by`: 分组维度 (user, strategy, symbol)

#### POST /api/v1/report/export
导出报表

**请求示例**:
```json
{
  "type": "excel",
  "data": "analytics",
  "config": {
    "start_time": "2024-01-01",
    "end_time": "2024-12-31",
    "metrics": ["pnl", "volume", "win_rate"]
  }
}
```

**响应示例**:
```json
{
  "export_id": "export_001",
  "status": "processing",
  "download_url": "/api/v1/report/export/export_001/download"
}
```

## 数据库设计

### 1. 管理用户表 (admin_users)

```sql
CREATE TABLE admin_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  name VARCHAR(100) NOT NULL,
  role VARCHAR(50) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'active',
  last_login TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  INDEX idx_email (email),
  INDEX idx_role (role),
  INDEX idx_status (status)
);
```

### 2. 角色表 (admin_roles)

```sql
CREATE TABLE admin_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) UNIQUE NOT NULL,
  description TEXT,
  permissions JSONB NOT NULL DEFAULT '[]',
  is_system BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  INDEX idx_name (name)
);
```

### 3. 系统配置表 (system_configs)

```sql
CREATE TABLE system_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key VARCHAR(255) UNIQUE NOT NULL,
  value JSONB NOT NULL,
  type VARCHAR(50) NOT NULL,
  description TEXT,
  is_encrypted BOOLEAN DEFAULT FALSE,
  updated_by VARCHAR(255),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  INDEX idx_key (key),
  INDEX idx_type (type)
);
```

### 4. 系统日志表 (system_logs)

```sql
CREATE TABLE system_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  level VARCHAR(20) NOT NULL,
  service VARCHAR(100) NOT NULL,
  message TEXT NOT NULL,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  INDEX idx_level (level),
  INDEX idx_service (service),
  INDEX idx_created_at (created_at)
);
```

### 5. 系统告警表 (system_alerts)

```sql
CREATE TABLE system_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  level VARCHAR(20) NOT NULL,
  type VARCHAR(100) NOT NULL,
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  metadata JSONB,
  status VARCHAR(20) NOT NULL DEFAULT 'active',
  resolved_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  INDEX idx_level (level),
  INDEX idx_type (type),
  INDEX idx_status (status),
  INDEX idx_created_at (created_at)
);
```

### 6. 风控规则表 (risk_rules)

```sql
CREATE TABLE risk_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  type VARCHAR(100) NOT NULL,
  condition TEXT NOT NULL,
  action VARCHAR(100) NOT NULL,
  priority INTEGER NOT NULL DEFAULT 1,
  is_active BOOLEAN DEFAULT TRUE,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  INDEX idx_type (type),
  INDEX idx_priority (priority),
  INDEX idx_is_active (is_active)
);
```

### 7. 风控告警表 (risk_alerts)

```sql
CREATE TABLE risk_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  level VARCHAR(20) NOT NULL,
  rule_id UUID,
  rule_name VARCHAR(255),
  user_id UUID,
  user_email VARCHAR(255),
  symbol VARCHAR(20),
  message TEXT NOT NULL,
  metadata JSONB,
  status VARCHAR(20) NOT NULL DEFAULT 'active',
  resolved_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  INDEX idx_level (level),
  INDEX idx_rule_id (rule_id),
  INDEX idx_user_id (user_id),
  INDEX idx_status (status),
  INDEX idx_created_at (created_at)
);
```

### 8. 风控违规表 (risk_violations)

```sql
CREATE TABLE risk_violations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_id UUID NOT NULL,
  rule_name VARCHAR(255) NOT NULL,
  user_id UUID NOT NULL,
  user_email VARCHAR(255) NOT NULL,
  symbol VARCHAR(20),
  violation_data JSONB NOT NULL,
  action_taken VARCHAR(100) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  FOREIGN KEY (rule_id) REFERENCES risk_rules(id),
  INDEX idx_rule_id (rule_id),
  INDEX idx_user_id (user_id),
  INDEX idx_created_at (created_at)
);
```

## 配置管理

### 1. 环境配置

```typescript
// src/config/config.default.ts
import { MidwayConfig } from '@midwayjs/core';

export default {
  // 应用配置
  keys: 'admin-service-secret-key',
  koa: {
    port: 3002,
  },

  // TypeORM 数据库配置
  typeorm: {
    dataSource: {
      default: {
        type: 'postgres',
        host: process.env.DB_HOST || 'postgres',
        port: 5432,
        database: 'admin_db',
        username: 'admin_user',
        password: process.env.DB_PASSWORD,
        synchronize: false,
        logging: false,
        entities: ['**/entity/**/*.entity{.ts,.js}'],
      },
    },
  },

  // Redis 配置
  redis: {
    client: {
      host: process.env.REDIS_HOST || 'redis',
      port: 6379,
      db: 0,
    },
  },

  // JWT 配置
  jwt: {
    secret: process.env.JWT_SECRET,
    expiresIn: '1h',
  },

  // 定时任务配置
  task: {
    prefix: 'admin-task',
    defaultJobOptions: {
      repeat: {
        tz: 'Asia/Shanghai',
      },
    },
  },

  // 导出配置
  export: {
    tempDir: '/tmp/exports',
    maxFileSize: '100MB',
    retentionDays: 30,
  },

  // 速率限制
  rateLimit: {
    api: 100,     // 100次/分钟
    export: 10,   // 10次/小时
  },
} as MidwayConfig;
```

```typescript
// src/config/config.local.ts (本地开发配置)
import { MidwayConfig } from '@midwayjs/core';

export default {
  typeorm: {
    dataSource: {
      default: {
        host: 'localhost',
        logging: true,
      },
    },
  },
  redis: {
    client: {
      host: 'localhost',
    },
  },
} as MidwayConfig;
```

```typescript
// src/config/config.prod.ts (生产环境配置)
import { MidwayConfig } from '@midwayjs/core';

export default {
  koa: {
    port: 3002,
  },
  typeorm: {
    dataSource: {
      default: {
        host: process.env.DB_HOST || 'postgres',
        password: process.env.DB_PASSWORD,
      },
    },
  },
  elasticsearch: {
    node: process.env.ES_HOST || 'http://elasticsearch:9200',
  },
  nats: {
    servers: [process.env.NATS_URL || 'nats://nats:4222'],
  },
} as MidwayConfig;
```

### 2. 仪表板配置

```typescript
// config/dashboard.ts
export const dashboardWidgets = {
  // 系统概览
  system_overview: {
    title: '系统概览',
    type: 'stats',
    metrics: [
      { key: 'total_users', label: '总用户数', icon: 'user' },
      { key: 'active_users', label: '活跃用户', icon: 'team' },
      { key: 'total_strategies', label: '总策略数', icon: 'strategy' },
      { key: 'active_strategies', label: '运行中策略', icon: 'play-circle' }
    ]
  },

  // 交易概览
  trading_overview: {
    title: '交易概览',
    type: 'stats',
    metrics: [
      { key: 'total_orders', label: '总订单数', icon: 'shopping-cart' },
      { key: 'total_trades', label: '总成交数', icon: 'swap' },
      { key: 'total_pnl', label: '总盈亏', icon: 'dollar' },
      { key: 'total_volume', label: '总交易量', icon: 'bar-chart' }
    ]
  },

  // 告警概览
  alert_overview: {
    title: '告警概览',
    type: 'stats',
    metrics: [
      { key: 'critical_alerts', label: '严重告警', icon: 'warning', color: 'red' },
      { key: 'warning_alerts', label: '警告告警', icon: 'exclamation', color: 'orange' },
      { key: 'info_alerts', label: '信息告警', icon: 'info-circle', color: 'blue' }
    ]
  },

  // 用户增长趋势
  user_growth: {
    title: '用户增长趋势',
    type: 'line_chart',
    metric: 'daily_users',
    period: '30d'
  },

  // 交易量趋势
  volume_trend: {
    title: '交易量趋势',
    type: 'line_chart',
    metric: 'daily_volume',
    period: '30d'
  },

  // 盈亏趋势
  pnl_trend: {
    title: '盈亏趋势',
    type: 'line_chart',
    metric: 'daily_pnl',
    period: '30d'
  },

  // 策略表现
  strategy_performance: {
    title: '策略表现',
    type: 'table',
    columns: ['strategy', 'pnl', 'win_rate', 'sharpe_ratio', 'status']
  },

  // 用户排名
  user_ranking: {
    title: '用户排名',
    type: 'table',
    columns: ['user', 'pnl', 'volume', 'win_rate', 'rank']
  },

  // 告警列表
  alert_list: {
    title: '最新告警',
    type: 'list',
    max_items: 10
  }
};
```

## 前端架构

### 1. 技术栈
- **框架**: React 18
- **UI 库**: Ant Design 5
- **状态管理**: Zustand
- **路由**: React Router 6
- **图表**: klinecharts（封装成 `@klinecharts/pro` 风格的 K 线专业组件；不使用 ECharts）
- **构建**: Vite

### 2. 页面结构

```
web/src/
├── pages/
│   ├── Dashboard/              # 仪表板
│   │   ├── index.tsx
│   │   ├── components/
│   │   └── widgets/
│   ├── System/                 # 系统管理
│   │   ├── Monitor/            # 监控
│   │   ├── Config/             # 配置
│   │   ├── Logs/               # 日志
│   │   └── Health/             # 健康检查
│   ├── User/                   # 用户管理
│   │   ├── List/               # 用户列表
│   │   ├── Detail/             # 用户详情
│   │   ├── Role/               # 角色管理
│   │   └── Permission/         # 权限管理
│   ├── Strategy/               # 策略管理
│   │   ├── List/               # 策略列表
│   │   ├── Detail/             # 策略详情
│   │   ├── Backtest/           # 回测管理
│   │   └── Signal/             # 信号管理
│   ├── Risk/                   # 风控管理
│   │   ├── Rule/               # 规则管理
│   │   ├── Alert/              # 告警管理
│   │   └── Violation/          # 违规记录
│   ├── Trading/                # 交易管理
│   │   ├── Order/              # 订单管理
│   │   ├── Position/           # 仓位管理
│   │   ├── Account/            # 账户管理
│   │   └── Trade/              # 成交管理
│   └── Report/                 # 报表管理
│       ├── Dashboard/          # 仪表板
│       ├── Analytics/          # 数据分析
│       └── Export/             # 数据导出
├── components/                 # 公共组件
│   ├── Layout/                 # 布局组件
│   ├── Table/                  # 表格组件
│   ├── Chart/                  # 图表组件
│   ├── Form/                   # 表单组件
│   └── Modal/                  # 模态框组件
├── services/                   # API 服务
│   ├── system.ts
│   ├── user.ts
│   ├── strategy.ts
│   ├── risk.ts
│   ├── trading.ts
│   └── report.ts
├── stores/                     # 状态管理
│   ├── auth.store.ts
│   ├── system.store.ts
│   ├── user.store.ts
│   └── ui.store.ts
└── utils/                      # 工具
    ├── request.ts
    ├── auth.ts
    ├── export.ts
    └── chart.ts
```

### 3. 主要页面示例

#### 仪表板页面
```tsx
// pages/Dashboard/index.tsx
import React from 'react';
import { Row, Col, Card } from 'antd';
import { SystemOverview, TradingOverview, AlertOverview } from './widgets';
import { UserGrowthChart, VolumeTrendChart, PnLTrendChart } from './components';

const Dashboard: React.FC = () => {
  return (
    <div className="dashboard">
      <Row gutter={[16, 16]}>
        <Col span={24}>
          <Card title="系统概览">
            <SystemOverview />
          </Card>
        </Col>
        <Col span={24}>
          <Card title="交易概览">
            <TradingOverview />
          </Card>
        </Col>
        <Col span={24}>
          <Card title="告警概览">
            <AlertOverview />
          </Card>
        </Col>
        <Col span={12}>
          <Card title="用户增长趋势">
            <UserGrowthChart />
          </Card>
        </Col>
        <Col span={12}>
          <Card title="交易量趋势">
            <VolumeTrendChart />
          </Card>
        </Col>
        <Col span={12}>
          <Card title="盈亏趋势">
            <PnLTrendChart />
          </Card>
        </Col>
        <Col span={12}>
          <Card title="策略表现">
            <StrategyPerformanceTable />
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default Dashboard;
```

#### 用户列表页面
```tsx
// pages/User/List/index.tsx
import React, { useState } from 'react';
import { Table, Button, Input, Select, Space, Tag } from 'antd';
import { UserOutlined, SearchOutlined } from '@ant-design/icons';
import { useUserStore } from '@/stores/user.store';

const UserList: React.FC = () => {
  const [filters, setFilters] = useState({
    role: '',
    status: '',
    email: ''
  });
  const { users, loading, fetchUsers } = useUserStore();

  const columns = [
    {
      title: '邮箱',
      dataIndex: 'email',
      key: 'email',
      render: (text: string) => <a href={`mailto:${text}`}>{text}</a>
    },
    {
      title: '姓名',
      dataIndex: 'name',
      key: 'name'
    },
    {
      title: '角色',
      dataIndex: 'role',
      key: 'role',
      render: (role: string) => {
        const colors = {
          super_admin: 'red',
          system_admin: 'orange',
          risk_admin: 'purple',
          strategy_admin: 'blue',
          user: 'green'
        };
        return <Tag color={colors[role] || 'default'}>{role}</Tag>;
      }
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => {
        const colors = {
          active: 'success',
          suspended: 'warning',
          inactive: 'default'
        };
        return <Tag color={colors[status] || 'default'}>{status}</Tag>;
      }
    },
    {
      title: '最后登录',
      dataIndex: 'last_login',
      key: 'last_login',
      render: (text: string) => text ? new Date(text).toLocaleString() : '-'
    },
    {
      title: '操作',
      key: 'action',
      render: (record: any) => (
        <Space>
          <Button type="link" onClick={() => handleView(record.id)}>
            查看
          </Button>
          <Button type="link" danger onClick={() => handleSuspend(record.id)}>
            暂停
          </Button>
        </Space>
      )
    }
  ];

  return (
    <div className="user-list">
      <div className="toolbar">
        <Space>
          <Input
            placeholder="搜索邮箱"
            prefix={<SearchOutlined />}
            onChange={(e) => setFilters({ ...filters, email: e.target.value })}
          />
          <Select
            placeholder="角色"
            style={{ width: 120 }}
            onChange={(value) => setFilters({ ...filters, role: value })}
            allowClear
          >
            <Select.Option value="super_admin">超级管理员</Select.Option>
            <Select.Option value="system_admin">系统管理员</Select.Option>
            <Select.Option value="risk_admin">风控管理员</Select.Option>
            <Select.Option value="strategy_admin">策略管理员</Select.Option>
            <Select.Option value="user">用户</Select.Option>
          </Select>
          <Select
            placeholder="状态"
            style={{ width: 120 }}
            onChange={(value) => setFilters({ ...filters, status: value })}
            allowClear
          >
            <Select.Option value="active">活跃</Select.Option>
            <Select.Option value="suspended">暂停</Select.Option>
            <Select.Option value="inactive">不活跃</Select.Option>
          </Select>
          <Button type="primary" icon={<UserOutlined />}>
            新增用户
          </Button>
        </Space>
      </div>
      <Table
        columns={columns}
        dataSource={users}
        rowKey="id"
        loading={loading}
        pagination={{ pageSize: 20 }}
      />
    </div>
  );
};

export default UserList;
```

## 部署

### 1. Docker 部署

```dockerfile
# Dockerfile (后端 - Midway.js)
FROM node:20-alpine AS builder

WORKDIR /app

# 安装依赖
COPY package*.json ./
RUN npm ci

# 复制源代码
COPY . .

# 构建
RUN npm run build

# 生产镜像
FROM node:20-alpine

WORKDIR /app

# 只安装生产依赖
COPY package*.json ./
RUN npm ci --only=production

# 复制构建产物
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/bootstrap.js ./

# 暴露端口
EXPOSE 3002

# 启动 Midway 应用
CMD ["node", "bootstrap.js"]
```

```javascript
// bootstrap.js - Midway 启动文件
const { Bootstrap } = require('@midwayjs/bootstrap');

Bootstrap.run();
```

```dockerfile
# Dockerfile (前端)
FROM node:20-alpine as builder

WORKDIR /app/web

COPY web/package*.json ./
RUN npm ci

COPY web/ .
RUN npm run build

FROM nginx:alpine

COPY --from=builder /app/web/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/nginx.conf

EXPOSE 8080

CMD ["nginx", "-g", "daemon off;"]
```

### 2. Docker Compose

```yaml
# docker-compose.yml
version: '3.8'

services:
  admin-backend:
    build:
      context: .
      dockerfile: Dockerfile.backend
    ports:
      - "3002:3002"
    environment:
      - NODE_ENV=production
      - DB_PASSWORD=${DB_PASSWORD}
      - JWT_SECRET=${JWT_SECRET}
      - ADMIN_PASSWORD=${ADMIN_PASSWORD}
    depends_on:
      - postgres
      - redis
      - nats
      - elasticsearch
    volumes:
      - ./logs:/app/logs
      - ./exports:/app/exports
    restart: unless-stopped

  admin-frontend:
    build:
      context: .
      dockerfile: Dockerfile.frontend
    ports:
      - "8080:8080"
    depends_on:
      - admin-backend
    restart: unless-stopped

  postgres:
    image: postgres:15
    environment:
      POSTGRES_DB: admin_db
      POSTGRES_USER: admin_user
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

  elasticsearch:
    image: elasticsearch:8.11
    environment:
      - discovery.type=single-node
      - xpack.security.enabled=false
    volumes:
      - elasticsearch_data:/usr/share/elasticsearch/data
    ports:
      - "9200:9200"

  prometheus:
    image: prom/prometheus:latest
    volumes:
      - ./prometheus.yml:/etc/prometheus/prometheus.yml
      - prometheus_data:/prometheus
    ports:
      - "9090:9090"

  grafana:
    image: grafana/grafana:latest
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=${GRAFANA_PASSWORD}
    volumes:
      - grafana_data:/var/lib/grafana
    ports:
      - "3000:3000"

volumes:
  postgres_data:
  redis_data:
  elasticsearch_data:
  prometheus_data:
  grafana_data:
```

## 监控与日志

### 1. 日志配置

```typescript
// src/config/config.default.ts 中的日志配置
export default {
  midwayLogger: {
    default: {
      level: 'info',
      consoleLevel: 'info',
    },
    clients: {
      coreLogger: {
        level: 'warn',
      },
      appLogger: {
        level: 'info',
        fileLogName: 'admin-app.log',
      },
    },
  },
} as MidwayConfig;
```

```typescript
// src/middleware/logger.middleware.ts
import { Middleware, IMiddleware, Inject } from '@midwayjs/core';
import { Context, NextFunction } from '@midwayjs/koa';
import { ILogger } from '@midwayjs/logger';

@Middleware()
export class LoggerMiddleware implements IMiddleware<Context, NextFunction> {
  @Inject()
  logger: ILogger;

  resolve() {
    return async (ctx: Context, next: NextFunction) => {
      const startTime = Date.now();

      await next();

      const responseTime = Date.now() - startTime;
      this.logger.info(`${ctx.method} ${ctx.url} ${ctx.status} - ${responseTime}ms`);
    };
  }

  static getName() {
    return 'logger';
  }
}
```

### 2. 指标监控

```typescript
// src/service/system/metrics.service.ts
import { Provide, Init, Scope, ScopeEnum } from '@midwayjs/core';
import * as promClient from 'prom-client';

@Provide()
@Scope(ScopeEnum.Singleton)
export class MetricsService {
  private registry: promClient.Registry;

  // 系统指标
  systemCpuUsage: promClient.Gauge<string>;
  systemMemoryUsage: promClient.Gauge<string>;
  systemDiskUsage: promClient.Gauge<string>;

  // 业务指标
  adminUsers: promClient.Gauge<string>;
  adminLogins: promClient.Counter<string>;

  // API 指标
  apiRequests: promClient.Counter<string>;
  apiResponseTime: promClient.Histogram<string>;

  // 导出指标
  exportsCreated: promClient.Counter<string>;
  exportsCompleted: promClient.Counter<string>;
  exportsFailed: promClient.Counter<string>;

  @Init()
  async init() {
    this.registry = new promClient.Registry();
    promClient.collectDefaultMetrics({ register: this.registry });

    this.systemCpuUsage = new promClient.Gauge({
      name: 'admin_system_cpu_usage',
      help: 'System CPU usage percentage',
      registers: [this.registry],
    });

    this.systemMemoryUsage = new promClient.Gauge({
      name: 'admin_system_memory_usage',
      help: 'System memory usage percentage',
      registers: [this.registry],
    });

    this.apiRequests = new promClient.Counter({
      name: 'admin_api_requests_total',
      help: 'Total number of API requests',
      labelNames: ['method', 'path', 'status'],
      registers: [this.registry],
    });

    this.apiResponseTime = new promClient.Histogram({
      name: 'admin_api_response_time_seconds',
      help: 'API response time in seconds',
      labelNames: ['method', 'path'],
      buckets: [0.01, 0.05, 0.1, 0.5, 1, 5],
      registers: [this.registry],
    });

    this.adminLogins = new promClient.Counter({
      name: 'admin_logins_total',
      help: 'Total number of admin logins',
      registers: [this.registry],
    });

    this.exportsCreated = new promClient.Counter({
      name: 'admin_exports_created_total',
      help: 'Total number of exports created',
      registers: [this.registry],
    });

    this.exportsCompleted = new promClient.Counter({
      name: 'admin_exports_completed_total',
      help: 'Total number of exports completed',
      registers: [this.registry],
    });
  }

  async getMetrics(): Promise<string> {
    return this.registry.metrics();
  }
}
```

```typescript
// src/controller/metrics.controller.ts
import { Controller, Get, Inject, ContentType } from '@midwayjs/core';
import { MetricsService } from '../service/system/metrics.service';

@Controller('/metrics')
export class MetricsController {
  @Inject()
  metricsService: MetricsService;

  @Get('/')
  @ContentType('text/plain')
  async getMetrics(): Promise<string> {
    return await this.metricsService.getMetrics();
  }
}
```

## 测试

### 1. 单元测试

```bash
npm run test:unit
```

### 2. 集成测试

```bash
npm run test:integration
```

### 3. E2E 测试

```bash
npm run test:e2e
```

## 开发指南

### 1. 应用配置入口

```typescript
// src/configuration.ts
import { Configuration, App } from '@midwayjs/core';
import * as koa from '@midwayjs/koa';
import * as typeorm from '@midwayjs/typeorm';
import * as redis from '@midwayjs/redis';
import * as jwt from '@midwayjs/jwt';
import * as task from '@midwayjs/task';
import * as validate from '@midwayjs/validate';
import { join } from 'path';
import { DefaultErrorFilter } from './filter/default.filter';
import { AuthMiddleware } from './middleware/auth.middleware';
import { LoggerMiddleware } from './middleware/logger.middleware';

@Configuration({
  imports: [
    koa,
    typeorm,
    redis,
    jwt,
    task,
    validate,
  ],
  importConfigs: [join(__dirname, './config')],
})
export class MainConfiguration {
  @App('koa')
  app: koa.Application;

  async onReady() {
    // 添加中间件
    this.app.useMiddleware([LoggerMiddleware, AuthMiddleware]);
    // 添加异常过滤器
    this.app.useFilter([DefaultErrorFilter]);
  }
}
```

### 2. 添加新仪表板组件

```typescript
// src/service/report/dashboard.service.ts
import { Provide, Inject } from '@midwayjs/core';
import { InjectEntityModel } from '@midwayjs/typeorm';
import { Repository } from 'typeorm';
import { AdminUser } from '../../entity/user/admin-user.entity';
import { StrategyTemplate } from '../../entity/strategy/strategy-template.entity';

@Provide()
export class DashboardService {
  @InjectEntityModel(AdminUser)
  userRepository: Repository<AdminUser>;

  @InjectEntityModel(StrategyTemplate)
  strategyRepository: Repository<StrategyTemplate>;

  async getWidgetData(widgetId: string, params: any): Promise<any> {
    switch (widgetId) {
      case 'system_overview':
        return this.getSystemOverview();
      case 'trading_overview':
        return this.getTradingOverview();
      case 'alert_overview':
        return this.getAlertOverview();
      case 'user_growth':
        return this.getUserGrowth(params.period);
      case 'volume_trend':
        return this.getVolumeTrend(params.period);
      case 'pnl_trend':
        return this.getPnLTrend(params.period);
      case 'strategy_performance':
        return this.getStrategyPerformance();
      case 'user_ranking':
        return this.getUserRanking();
      case 'alert_list':
        return this.getAlertList(params.limit);
      default:
        throw new Error(`Unknown widget: ${widgetId}`);
    }
  }

  private async getSystemOverview(): Promise<any> {
    const [totalUsers, activeUsers, totalStrategies, activeStrategies] = await Promise.all([
      this.userRepository.count(),
      this.userRepository.count({ where: { status: 'active' } }),
      this.strategyRepository.count(),
      this.strategyRepository.count({ where: { status: 'running' } })
    ]);

    return {
      total_users: totalUsers,
      active_users: activeUsers,
      total_strategies: totalStrategies,
      active_strategies: activeStrategies
    };
  }
}
```

### 3. 添加新导出格式

```typescript
// src/service/report/export.service.ts
import { Provide, Config } from '@midwayjs/core';
import * as ExcelJS from 'exceljs';

@Provide()
export class ExportService {
  @Config('export')
  exportConfig: { tempDir: string; maxFileSize: string; retentionDays: number };

  async exportData(format: string, data: any, config: any): Promise<string> {
    switch (format) {
      case 'excel':
        return this.exportToExcel(data, config);
      case 'csv':
        return this.exportToCSV(data, config);
      case 'pdf':
        return this.exportToPDF(data, config);
      case 'json':
        return this.exportToJSON(data, config);
      default:
        throw new Error(`Unsupported format: ${format}`);
    }
  }

  private async exportToExcel(data: any, config: any): Promise<string> {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Data');

    // 添加表头
    worksheet.addRow(Object.keys(data[0]));

    // 添加数据
    data.forEach((row: any) => {
      worksheet.addRow(Object.values(row));
    });

    // 保存文件
    const filename = `export_${Date.now()}.xlsx`;
    const filepath = `${this.exportConfig.tempDir}/${filename}`;
    await workbook.xlsx.writeFile(filepath);

    return filename;
  }
}
```

### 4. 控制器示例

```typescript
// src/controller/v1/system/health.controller.ts
import { Controller, Get, Inject } from '@midwayjs/core';
import { Context } from '@midwayjs/koa';
import { HealthService } from '../../../service/system/health.service';

@Controller('/api/v1/system')
export class HealthController {
  @Inject()
  ctx: Context;

  @Inject()
  healthService: HealthService;

  @Get('/health')
  async getHealth() {
    return await this.healthService.checkHealth();
  }

  @Get('/metrics')
  async getMetrics() {
    return await this.healthService.getMetrics();
  }
}
```

### 5. 定时任务示例

```typescript
// src/task/cleanup.task.ts
import { Provide, Task, TaskLocal } from '@midwayjs/task';
import { Inject } from '@midwayjs/core';
import { ILogger } from '@midwayjs/logger';

@Provide()
export class CleanupTask {
  @Inject()
  logger: ILogger;

  // 每天凌晨 3 点执行
  @Task('0 0 3 * * *')
  async cleanExpiredExports() {
    this.logger.info('开始清理过期导出文件...');
    // 清理逻辑
  }

  // 每小时执行一次
  @Task('0 0 * * * *')
  async cleanExpiredSessions() {
    this.logger.info('开始清理过期会话...');
    // 清理逻辑
  }
}
```

## 安全考虑

### 1. 访问控制
- 基于角色的访问控制 (RBAC)
- 多因素认证 (MFA)
- IP 白名单
- 会话超时

### 2. 数据安全
- 敏感数据加密
- 数据脱敏
- 访问审计
- 数据备份

### 3. API 安全
- JWT 认证
- API 速率限制
- 输入验证
- 输出编码

### 4. 系统安全
- 定期安全扫描
- 漏洞修复
- 安全补丁
- 安全监控

## 故障处理

### 1. 数据库连接失败
- 自动重连
- 连接池管理
- 降级处理

### 2. 服务不可用
- 健康检查
- 自动重启
- 负载均衡

### 3. 导出失败
- 重试机制
- 队列处理
- 通知机制

## 扩展性

### 1. 插件系统
- 自定义仪表板组件
- 自定义导出格式
- 自定义报表模板

### 2. 多租户支持
- 租户隔离
- 租户配置
- 租户管理

### 3. 微服务架构
- 服务发现
- 负载均衡
- 熔断器

## 参考文档

- [Midway.js 文档](https://midwayjs.org/)
- [Midway.js GitHub](https://github.com/midwayjs/midway)
- [React 文档](https://react.dev/)
- [Ant Design 文档](https://ant.design/)
- [klinecharts](https://github.com/klinecharts/KLineChart)
- [`@klinecharts/pro`](https://pro.klinecharts.com/)

---

**维护者**: 量化团队
**版本**: 1.0.0
**最后更新**: 2026-01-22
