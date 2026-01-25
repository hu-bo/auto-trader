# @hquant/risk-model

> 可插拔、可回放、可解释的风险控制引擎

## 特性

- **分层架构**：账户级 → 品种级 → 仓位级，固定执行顺序
- **职责分离**：仅输出 `RiskDecision`，不直接下单
- **品种覆盖**：支持全局默认配置 + 品种级覆盖
- **冷却机制**：支持 `15m`、`1h` 等时间格式
- **审计日志**：每次评估可记录，支持回放分析
- **事件驱动**：订阅式 API，解耦策略与风控

## 安装

```bash
pnpm add @hquant/risk-model
```

## 快速开始

```typescript
import { RiskEngine, RiskConfig, RiskContext } from '@hquant/risk-model';

// 1. 定义风控配置
const config: RiskConfig = {
  account: {
    maxDailyLoss: 500,           // 单日最大亏损 (USDT)
    maxMarginUsagePct: 0.8,      // 最大保证金使用率
    onBreach: 'BLOCK_TRADING',   // BLOCK_TRADING | CLOSE_ALL
  },
  position: {
    stopProfitPct: 1.5,          // 止盈 (基于 margin 的盈亏率)
    stopLossPct: 0.8,            // 止损
    maxLossPerPosition: 200,     // 单仓最大亏损 (可选)
    onBreach: 'CLOSE_POSITION',  // CLOSE_POSITION | REDUCE_POSITION
    cooldown: '15m',             // 冷却时间
  },
  symbols: {
    BTCUSDT: {
      position: {
        stopProfitPct: 2.0,
        stopLossPct: 1.0,
      },
    },
    ETHUSDT: {
      position: {
        onBreach: 'REDUCE_POSITION',
        reduceRatio: 0.5,
      },
    },
  },
};

// 2. 创建引擎
const engine = new RiskEngine(config, { enableAudit: true });

// 3. 订阅决策事件
engine.onDecision((decisions) => {
  for (const d of decisions) {
    console.log(`[${d.level}] ${d.action}: ${d.reason}`);
  }
});

// 4. 评估风险
const context: RiskContext = {
  now: Date.now(),
  account: {
    equity: 10000,
    dailyPnl: -100,
    marginUsed: 5000,
    marginAvailable: 5000,
  },
  positions: [
    {
      symbol: 'BTCUSDT',
      market: 'FUTURES',
      side: 'LONG',
      qty: 0.1,
      entryPrice: 50000,
      markPrice: 55000,
      marginUsed: 1000,
      unrealizedPnl: 500,
    },
  ],
};

const decisions = engine.evaluate(context);
```

## 架构设计

```
┌──────────────────────────────┐
│        Market Data           │
└──────────────┬───────────────┘
               ↓
┌──────────────────────────────┐
│     Position Snapshot        │
└──────────────┬───────────────┘
               ↓
┌──────────────────────────────┐
│         RiskEngine           │
│  1. AccountRiskEvaluator     │  ← 系统级硬闸门
│  2. PositionRiskEvaluator    │  ← 含品种覆盖解析
└──────────────┬───────────────┘
               ↓
┌──────────────────────────────┐
│       RiskDecision           │
└──────────────────────────────┘
```

### 执行顺序（固定）

1. **Account Risk** - 账户级风控，一票否决
2. **Symbol Override Resolution** - 解析品种级配置覆盖
3. **Position Risk** - 仓位级风控（仅在账户未阻断时执行）

## API 参考

### RiskEngine

```typescript
const engine = new RiskEngine(config, options?);
```

| 方法 | 描述 |
|------|------|
| `evaluate(context)` | 评估风险，返回 `RiskDecision[]` |
| `onDecision(handler)` | 订阅决策事件，返回取消订阅函数 |
| `isAccountBlocked()` | 检查账户是否被阻断 |
| `resetAccountBlock()` | 重置账户阻断状态 |
| `resetPositionCooldown(symbol, side)` | 重置仓位冷却 |
| `getAuditLog()` | 获取审计日志 |
| `getConfig()` | 获取当前配置 |
| `destroy()` | 销毁引擎，清理资源 |

### RiskDecision

```typescript
interface RiskDecision {
  level: 'ACCOUNT' | 'POSITION';
  symbol?: string;
  action: 'BLOCK_TRADING' | 'CLOSE_ALL' | 'CLOSE_POSITION' | 'REDUCE_POSITION';
  params?: { reduceRatio?: number };
  reason: string;
  timestamp: number;
}
```

### 配置说明

#### 账户级配置 (account)

| 字段 | 类型 | 描述 |
|------|------|------|
| `maxDailyLoss` | `number` | 单日最大亏损 (USDT) |
| `maxMarginUsagePct` | `number` | 最大保证金使用率 (0-1) |
| `onBreach` | `string` | `BLOCK_TRADING` 或 `CLOSE_ALL` |

#### 仓位级配置 (position)

| 字段 | 类型 | 描述 |
|------|------|------|
| `stopProfitPct` | `number` | 止盈比例 (基于 margin) |
| `stopLossPct` | `number` | 止损比例 (基于 margin) |
| `maxLossPerPosition` | `number?` | 单仓最大亏损 (USDT) |
| `onBreach` | `string` | `CLOSE_POSITION` 或 `REDUCE_POSITION` |
| `reduceRatio` | `number?` | 减仓比例 (0-1) |
| `cooldown` | `string \| number` | 冷却时间 (`15m`, `1h`, 或毫秒) |

## 工具函数

```typescript
import {
  parseDuration,         // '15m' → 900000
  calculatePnlPct,       // 计算盈亏率
  calculateMarginUsagePct,
  formatPct,             // 0.5 → '50.00%'
  getPositionKey,        // 'BTCUSDT:LONG'
} from '@hquant/risk-model';
```

## 审计日志

启用审计后，每次触发都会记录：

```typescript
interface RiskAuditEntry {
  timestamp: number;
  inputSnapshot: RiskContext;
  triggeredRule: string;
  decision: RiskDecision;
}

// 使用
const engine = new RiskEngine(config, { enableAudit: true, maxAuditEntries: 1000 });
const log = engine.getAuditLog();
```

## License

GPL-3.0-or-later
