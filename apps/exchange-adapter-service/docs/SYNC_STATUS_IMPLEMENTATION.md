# Symbol Sync Status API 实现总结

## 概述

新增了两个 API 端点，用于查看交易对同步状态和最后更新时间。这些 API 基于数据库表 `symbol_sync_status` 实现。

## 实现的功能

### 1. 单个交易对同步状态查询

**端点**: `GET /api/sync/status`

**功能**: 查询指定交易对的同步状态，包括最早数据时间戳和最近同步时间戳。

**实现位置**:
- Handler: `apps/exchange-adapter-service/internal/api/handler.go` - `GetSymbolSyncStatus()`
- Repository: `apps/exchange-adapter-service/internal/storage/postgres.go` - `GetSymbolSyncStatus()`

### 2. 批量交易对同步状态查询

**端点**: `GET /api/sync/status/all`

**功能**: 批量查询交易所所有交易对的同步状态，支持按交易类型过滤。

**实现位置**:
- Handler: `apps/exchange-adapter-service/internal/api/handler.go` - `GetAllSymbolsSyncStatus()`
- Repository: `apps/exchange-adapter-service/internal/storage/postgres.go` - `GetAllSymbolsSyncStatus()`

## 修改的文件

### 1. `internal/api/handler.go`

新增两个 handler 方法：
- `GetSymbolSyncStatus()`: 处理单个交易对查询
- `GetAllSymbolsSyncStatus()`: 处理批量查询

### 2. `internal/api/server.go`

注册新的路由：
```go
api.GET("/sync/status", s.handler.GetSymbolSyncStatus)
api.GET("/sync/status/all", s.handler.GetAllSymbolsSyncStatus)
```

### 3. `internal/storage/repository.go`

扩展 Repository 接口：
- 新增 `GetAllSymbolsSyncStatus()` 方法
- 新增 `SymbolSyncStatusWithTime` 结构体（包含 created_at 和 updated_at 字段）
- 添加 `time` 包导入

### 4. `internal/storage/postgres.go`

实现新的 repository 方法：
- `GetAllSymbolsSyncStatus()`: 执行 SQL 查询获取所有交易对的同步状态
- `GetPool()`: 暴露数据库连接池（用于自定义查询）

## 数据结构

### SymbolSyncStatus

基础同步状态结构（已存在）：
```go
type SymbolSyncStatus struct {
    Exchange       string `json:"exchange"`
    Symbol         string `json:"symbol"`
    TradeType      string `json:"trade_type"`
    EarliestDataTs int64  `json:"earliest_data_ts"`
    LatestSyncTs   int64  `json:"latest_sync_ts"`
}
```

### SymbolSyncStatusWithTime

扩展的同步状态结构（新增）：
```go
type SymbolSyncStatusWithTime struct {
    Exchange       string    `json:"exchange"`
    Symbol         string    `json:"symbol"`
    TradeType      string    `json:"trade_type"`
    EarliestDataTs int64     `json:"earliest_data_ts"`
    LatestSyncTs   int64     `json:"latest_sync_ts"`
    CreatedAt      time.Time `json:"created_at"`
    UpdatedAt      time.Time `json:"updated_at"`
}
```

## API 使用示例

### 查询单个交易对

```bash
curl "http://localhost:8080/api/sync/status?exchange=binance&symbol=BTC-USDT&trade_type=spot"
```

响应：
```json
{
  "code": 0,
  "status": "ok",
  "message": "success",
  "data": {
    "exchange": "binance",
    "symbol": "BTC-USDT",
    "trade_type": "spot",
    "earliest_data_ts": 1704067200000,
    "latest_sync_ts": 1708704000000
  }
}
```

### 查询所有交易对

```bash
curl "http://localhost:8080/api/sync/status/all?exchange=binance&trade_type=spot"
```

响应：
```json
{
  "code": 0,
  "status": "ok",
  "message": "success",
  "data": {
    "exchange": "binance",
    "count": 2,
    "statuses": [
      {
        "exchange": "binance",
        "symbol": "BTC-USDT",
        "trade_type": "spot",
        "earliest_data_ts": 1704067200000,
        "latest_sync_ts": 1708704000000,
        "created_at": "2024-01-01T00:00:00Z",
        "updated_at": "2024-02-23T10:30:00Z"
      }
    ]
  }
}
```

## 数据库表

API 基于以下数据库表：

```sql
CREATE TABLE IF NOT EXISTS symbol_sync_status (
    id BIGSERIAL PRIMARY KEY,
    exchange VARCHAR(16) NOT NULL,
    symbol VARCHAR(24) NOT NULL,
    trade_type VARCHAR(10) NOT NULL,
    earliest_data_ts BIGINT DEFAULT 0,
    latest_sync_ts BIGINT DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE (exchange, symbol, trade_type)
);
```

## 测试建议

1. **单个交易对查询测试**
   - 测试存在的交易对
   - 测试不存在的交易对（应返回 404）
   - 测试缺少必填参数（应返回 400）

2. **批量查询测试**
   - 测试不带 trade_type 参数（返回所有类型）
   - 测试带 trade_type 参数（只返回指定类型）
   - 测试空结果（交易所没有同步记录）

3. **性能测试**
   - 测试大量交易对的查询性能
   - 验证索引是否生效

## 注意事项

1. 时间戳均为毫秒级 Unix 时间戳
2. API 需要数据库配置才能使用，否则返回 503
3. 如果配置了 API Key，需要在请求头中携带认证信息
4. `updated_at` 字段会在每次更新同步状态时自动更新

## 相关文档

- API 使用文档: `docs/SYNC_STATUS_API.md`
- 数据库迁移文件: `internal/storage/db/migrations/003_symbol_sync_status.sql`
