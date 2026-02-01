# Risk Control Engine

> 可插拔、可回放、可解释的风险控制引擎 (Go 版本)

[![Go Version](https://img.shields.io/badge/go-%3E%3D1.19-blue.svg)](https://golang.org/)
[![License](https://img.shields.io/badge/license-GPL--3.0-green.svg)](LICENSE)

## 特性

- **分层架构**：账户级 → 品种级 → 仓位级，固定执行顺序
- **职责分离**：仅输出 `RiskDecision`，不直接下单
- **品种覆盖**：支持全局默认配置 + 品种级覆盖
- **冷却机制**：支持 `15m`、`1h` 等时间格式
- **审计日志**：每次评估可记录，支持回放分析
- **事件驱动**：订阅式 API，解耦策略与风控
- **线程安全**：所有公开方法均线程安全

## 安装

```bash
go get github.com/yourusername/yourproject/pkg/risk
```

## 快速开始

```go
package main

import (
    "fmt"
    "time"
    "github.com/yourusername/yourproject/pkg/risk"
)

func main() {
    // 1. 定义风控配置
    config := risk.RiskConfig{
        Account: risk.AccountRiskConfig{
            MaxDailyLoss:      500,   // 单日最大亏损 (USDT)
            MaxMarginUsagePct: 0.8,   // 最大保证金使用率
            OnBreach:          risk.AccountBreachBlockTrading,
        },
        Position: risk.PositionRiskConfig{
            StopProfitPct: 1.5,  // 止盈 (基于 margin 的盈亏率)
            StopLossPct:   0.8,  // 止损
            OnBreach:      risk.PositionBreachClosePosition,
            Cooldown:      "15m", // 冷却时间
        },
        Symbols: map[string]risk.SymbolRiskOverride{
            "BTCUSDT": {
                Position: &risk.PositionRiskConfig{
                    StopProfitPct: 2.0, // 品种级覆盖
                    StopLossPct:   1.0,
                },
            },
        },
    }

    // 2. 创建引擎
    engine := risk.NewRiskEngine(config, &risk.RiskEngineOptions{
        EnableAudit:     true,
        MaxAuditEntries: 1000,
    })

    // 3. 订阅决策事件
    unsubscribe := engine.OnDecision(func(decisions []risk.RiskDecision) {
        for _, d := range decisions {
            fmt.Printf("[%s] %s: %s\n", d.Level, d.Action, d.Reason)
        }
    })
    defer unsubscribe()

    // 4. 评估风险
    ctx := risk.RiskContext{
        Now: time.Now(),
        Account: risk.AccountSnapshot{
            Equity:          10000,
            DailyPnl:        -100,
            MarginUsed:      5000,
            MarginAvailable: 5000,
        },
        Positions: []risk.PositionSnapshot{
            {
                Symbol:        "BTCUSDT",
                Market:        risk.MarketFutures,
                Side:          risk.PositionSideLong,
                Qty:           0.1,
                EntryPrice:    50000,
                MarkPrice:     55000,
                MarginUsed:    1000,
                UnrealizedPnl: 500,
            },
        },
    }

    decisions := engine.Evaluate(ctx)

    // 5. 处理决策
    for _, decision := range decisions {
        // 根据决策执行相应操作
        handleDecision(decision)
    }
}

func handleDecision(decision risk.RiskDecision) {
    switch decision.Action {
    case risk.RiskActionBlockTrading:
        // 阻止所有交易
    case risk.RiskActionCloseAll:
        // 关闭所有仓位
    case risk.RiskActionClosePosition:
        // 关闭特定仓位
    case risk.RiskActionReducePosition:
        // 减少仓位
    }
}
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

```go
engine := risk.NewRiskEngine(config, options)
```

| 方法 | 描述 |
|------|------|
| `Evaluate(ctx)` | 评估风险，返回 `[]RiskDecision` |
| `OnDecision(handler)` | 订阅决策事件，返回取消订阅函数 |
| `IsAccountBlocked()` | 检查账户是否被阻断 |
| `ResetAccountBlock()` | 重置账户阻断状态 |
| `ResetPositionCooldown(symbol, side)` | 重置仓位冷却 |
| `GetAuditLog()` | 获取审计日志 |
| `GetConfig()` | 获取当前配置 |
| `GetState()` | 获取当前状态 |
| `Destroy()` | 销毁引擎，清理资源 |

### RiskDecision

```go
type RiskDecision struct {
    Level     RiskLevel
    Symbol    *string
    Action    RiskAction
    Params    *RiskDecisionParams
    Reason    string
    Timestamp time.Time
}
```

### 配置说明

#### 账户级配置 (Account)

| 字段 | 类型 | 描述 |
|------|------|------|
| `MaxDailyLoss` | `float64` | 单日最大亏损 (USDT) |
| `MaxMarginUsagePct` | `float64` | 最大保证金使用率 (0-1) |
| `OnBreach` | `AccountBreachAction` | `BLOCK_TRADING` 或 `CLOSE_ALL` |

#### 仓位级配置 (Position)

| 字段 | 类型 | 描述 |
|------|------|------|
| `StopProfitPct` | `float64` | 止盈比例 (基于 margin) |
| `StopLossPct` | `float64` | 止损比例 (基于 margin) |
| `MaxLossPerPosition` | `*float64` | 单仓最大亏损 (USDT) |
| `OnBreach` | `PositionBreachAction` | `CLOSE_POSITION` 或 `REDUCE_POSITION` |
| `ReduceRatio` | `*float64` | 减仓比例 (0-1) |
| `Cooldown` | `interface{}` | 冷却时间 (`"15m"`, `"1h"`, 或毫秒) |

## 工具函数

```go
import "github.com/yourusername/yourproject/pkg/risk"

// 解析时间字符串: "15m" → 15分钟
duration, err := risk.ParseCooldown("15m")

// 计算盈亏率
pnlPct := risk.CalculatePnlPct(position)

// 计算保证金使用率
marginPct := risk.CalculateMarginUsagePct(account)

// 格式化百分比: 0.5 → "50.00%"
formatted := risk.FormatPct(0.5, 2)

// 生成仓位键: "BTCUSDT:LONG"
key := risk.GetPositionKey("BTCUSDT", risk.PositionSideLong)
```

## 审计日志

启用审计后，每次触发都会记录：

```go
type RiskAuditEntry struct {
    Timestamp     time.Time
    InputSnapshot RiskContext
    TriggeredRule string
    Decision      RiskDecision
}

// 使用
engine := risk.NewRiskEngine(config, &risk.RiskEngineOptions{
    EnableAudit:     true,
    MaxAuditEntries: 1000,
})
log := engine.GetAuditLog()
```

## 线程安全

所有公开方法均线程安全，可以在多个 goroutine 中并发调用：

```go
// 并发评估
var wg sync.WaitGroup
for i := 0; i < 10; i++ {
    wg.Add(1)
    go func() {
        defer wg.Done()
        decisions := engine.Evaluate(ctx)
        // 处理决策
    }()
}
wg.Wait()
```

## 测试

```bash
# 运行所有测试
go test ./...

# 运行测试并显示覆盖率
go test -cover ./...

# 运行基准测试
go test -bench=. ./...
```

## TypeScript 版本

本项目从 TypeScript 版本迁移而来。TypeScript 版本位于：
- 源目录：`packages/risk-model`

## 迁移指南

### TypeScript → Go 映射

| TypeScript | Go |
|------------|-----|
| `interface` | `struct` |
| `type` | `type` alias |
| `Map<string, T>` | `map[string]T` |
| `Array<T>` | `[]T` |
| `undefined \| null` | `*T` (pointer) |
| `number` | `float64` |
| `string` | `string` |
| `boolean` | `bool` |
| `Date` | `time.Time` |

### 主要差异

1. **错误处理**：Go 使用显式错误返回而非异常
2. **空值处理**：Go 使用指针表示可选值
3. **并发安全**：Go 版本添加了 mutex 保护
4. **事件处理**：Go 版本使用回调 ID 管理订阅

## License

GPL-3.0-or-later

## 贡献

欢迎提交 Issue 和 Pull Request！
