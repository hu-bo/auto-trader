# Exchange Sync 重构方案

## 背景

将 `apps/exchange-sync/pkg` 提升到根目录 `pkg/`，以便其他服务（如 `exchange-adapter-service`）复用。

---

## 分析结论

### 1. `exchange-sync/internal/exchange` vs `pkg/exchange-adapter`

**结论：不能简单替换，需要保留两者**

| 维度 | exchange-sync/internal/exchange | pkg/exchange-adapter |
|-----|--------------------------------|---------------------|
| **目的** | 市场数据订阅（公开数据） | 交易执行（私有数据） |
| **WebSocket 类型** | 公共流（无需认证） | 用户数据流（需要认证） |
| **订阅内容** | K线、深度、成交、24h ticker | 订单更新、账户更新、持仓变化 |
| **使用场景** | 行情数据采集和聚合 | 下单、撤单、订单跟踪 |
| **依赖** | `wsconn` 包 | 自己的 WebSocket 管理 |

**原因**:
- `exchange-sync/internal/exchange` 订阅的是**市场公开数据流**（如 Binance 的 `wss://stream.binance.com:9443/ws`）
- `pkg/exchange-adapter` 的 `WsUserDataAdapter` 订阅的是**用户私有数据流**（需要 API Key 认证）
- 两者连接的 WebSocket 端点、认证方式、消息格式都完全不同

### 2. `wsconn` 包是否可以废弃？

**结论：不能废弃，应该提升到根 pkg 目录**

`wsconn` 提供了通用的 WebSocket 连接管理能力：
- ✅ 自动重连
- ✅ 心跳管理（支持主动/被动两种模式）
- ✅ 订阅管理
- ✅ 线程安全

**建议**: 将 `wsconn` 迁移到 `pkg/wsconn`，让 `pkg/exchange-adapter` 也可以复用这个能力，减少重复代码。

### 3. `apps/exchange-sync/pkg` 包的使用情况

```
logger    - 11 处引用（日志模块）
utils     - 10 处引用（工具函数）
wsconn    -  2 处引用（WebSocket 管理）
queue     -  未统计（队列）
```

---

## 迁移方案

### 阶段一：迁移通用包到根目录

```
apps/exchange-sync/pkg/                →  pkg/
├── logger/                            →  pkg/sync-utils/logger/
├── wsconn/                            →  pkg/wsconn/
├── utils/                             →  pkg/sync-utils/utils/
└── queue/                             →  pkg/sync-utils/queue/
```

**目录规划**:
- `pkg/wsconn/` - WebSocket 连接管理（独立包，可复用）
- `pkg/sync-utils/` - exchange-sync 专用工具（logger、utils、queue）

**为什么这样划分**:
1. `wsconn` 是通用能力，其他服务也可能用到
2. `logger/utils/queue` 是 exchange-sync 特定的，放在 `sync-utils` 命名空间下

### 阶段二：更新 import 路径

**更新范围**: `apps/exchange-sync/` 下的所有 `.go` 文件

```go
// 前
import "exchange-sync/pkg/logger"
import "exchange-sync/pkg/wsconn"
import "exchange-sync/pkg/utils"
import "exchange-sync/pkg/queue"

// 后
import "auto-trader/pkg/sync-utils/logger"
import "auto-trader/pkg/wsconn"
import "auto-trader/pkg/sync-utils/utils"
import "auto-trader/pkg/sync-utils/queue"
```

### 阶段三：验证编译

```bash
cd apps/exchange-sync
go mod tidy
make build
make test
```

---

## 实施步骤

### Step 1: 创建目标目录

```bash
mkdir -p pkg/wsconn
mkdir -p pkg/sync-utils/{logger,utils,queue}
```

### Step 2: 移动文件

```bash
# WebSocket 管理（独立）
mv apps/exchange-sync/pkg/wsconn/* pkg/wsconn/

# Exchange-sync 工具包
mv apps/exchange-sync/pkg/logger/* pkg/sync-utils/logger/
mv apps/exchange-sync/pkg/utils/* pkg/sync-utils/utils/
mv apps/exchange-sync/pkg/queue/* pkg/sync-utils/queue/
```

### Step 3: 更新 package 声明

```bash
# pkg/wsconn 保持不变（已经是 package wsconn）
# pkg/sync-utils/* 保持不变（logger/utils/queue）
```

### Step 4: 批量更新 import

```bash
cd apps/exchange-sync

# 更新 wsconn
find . -name "*.go" -type f -exec sed -i '' 's|"exchange-sync/pkg/wsconn"|"auto-trader/pkg/wsconn"|g' {} +

# 更新 logger
find . -name "*.go" -type f -exec sed -i '' 's|"exchange-sync/pkg/logger"|"auto-trader/pkg/sync-utils/logger"|g' {} +

# 更新 utils
find . -name "*.go" -type f -exec sed -i '' 's|"exchange-sync/pkg/utils"|"auto-trader/pkg/sync-utils/utils"|g' {} +

# 更新 queue
find . -name "*.go" -type f -exec sed -i '' 's|"exchange-sync/pkg/queue"|"auto-trader/pkg/sync-utils/queue"|g' {} +
```

### Step 5: 更新 go.mod

在根目录 `go.work` 中确保包含：

```go
use (
    ./apps/exchange-sync
    ./pkg/wsconn
    ./pkg/sync-utils
    // ...
)
```

### Step 6: 清理旧目录

```bash
rm -rf apps/exchange-sync/pkg
```

### Step 7: 编译验证

```bash
cd apps/exchange-sync
go mod tidy
make build
make test
```

---

## 风险评估

### 低风险
- ✅ 纯内部重构，不影响外部 API
- ✅ 文件移动，代码逻辑不变
- ✅ 所有引用都在同一个仓库内

### 需要注意
- ⚠️ 确保 `go.work` 正确配置
- ⚠️ CI/CD 构建脚本可能需要更新
- ⚠️ 如果有硬编码的路径需要一并更新

---

## 后续优化建议

### 1. `pkg/exchange-adapter` 复用 `pkg/wsconn`

当前 `pkg/exchange-adapter` 的 WebSocket 管理可以考虑复用 `pkg/wsconn`，减少重复代码。

**对比**:
- `pkg/wsconn/session.go` - 已有自动重连、心跳、订阅管理
- `pkg/exchange-adapter/core/base_ws_user_data_adapter.go` - 自己实现了类似功能

**建议**: 在未来可以让 `WsUserDataAdapter` 底层使用 `wsconn.Session`。

### 2. 日志统一

考虑将 `pkg/sync-utils/logger` 升级为项目统一的日志模块（如 `pkg/logger`），供所有服务使用。

---

## Checklist

- [ ] Step 1: 创建目标目录
- [ ] Step 2: 移动文件
- [ ] Step 3: 更新 package 声明（如有需要）
- [ ] Step 4: 批量更新 import
- [ ] Step 5: 更新 go.work
- [ ] Step 6: 清理旧目录
- [ ] Step 7: 编译验证
- [ ] Step 8: 运行测试
- [ ] Step 9: 更新文档/README
- [ ] Step 10: 提交代码

---

## 附录：文件清单

### 需要迁移的文件

```
apps/exchange-sync/pkg/
├── logger/
│   └── logger.go                → pkg/sync-utils/logger/logger.go
├── wsconn/
│   ├── manager.go               → pkg/wsconn/manager.go
│   └── session.go               → pkg/wsconn/session.go
├── utils/
│   ├── batch.go                 → pkg/sync-utils/utils/batch.go
│   ├── compress.go              → pkg/sync-utils/utils/compress.go
│   ├── parse.go                 → pkg/sync-utils/utils/parse.go
│   └── period.go                → pkg/sync-utils/utils/period.go
└── queue/
    └── queue.go                 → pkg/sync-utils/utils/queue.go
```

### 需要更新 import 的文件

```
apps/exchange-sync/
├── cmd/main.go
├── internal/
│   ├── aggregator/*
│   ├── api/*
│   ├── exchange/*
│   ├── publisher/*
│   ├── service/*
│   └── storage/*
└── pkg/ (删除)
```
