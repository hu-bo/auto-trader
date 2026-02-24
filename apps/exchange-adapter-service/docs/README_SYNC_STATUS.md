# Symbol Sync Status API 文档

## 概述

本功能为 exchange-adapter-service 新增了两个 API 端点，用于查询交易对的同步状态和最后更新时间。

## 快速开始

### 1. 确保数据库表已创建

同步状态数据存储在 `symbol_sync_status` 表中，该表通过迁移文件自动创建：

```
internal/storage/db/migrations/003_symbol_sync_status.sql
```

服务启动时会自动执行迁移。

### 2. 启动服务

```bash
cd apps/exchange-adapter-service
go run cmd/main.go
```

### 3. 测试 API

使用提供的测试脚本：

```bash
# 基本测试（默认 localhost:8080）
./docs/test_sync_status_api.sh

# 指定服务器地址
./docs/test_sync_status_api.sh http://your-server:8080

# 带 API Key 认证
./docs/test_sync_status_api.sh http://your-server:8080 your-api-key
```

或使用 curl 手动测试：

```bash
# 查询单个交易对
curl "http://localhost:8080/api/sync/status?exchange=binance&symbol=BTC-USDT&trade_type=spot"

# 查询所有交易对
curl "http://localhost:8080/api/sync/status/all?exchange=binance&trade_type=spot"
```

## 文档索引

- **[API 使用文档](./SYNC_STATUS_API.md)** - 详细的 API 使用说明和示例
- **[实现总结](./SYNC_STATUS_IMPLEMENTATION.md)** - 技术实现细节和代码结构
- **[测试脚本](./test_sync_status_api.sh)** - 自动化测试脚本

## API 端点

### 1. 获取单个交易对同步状态

```
GET /api/sync/status?exchange={exchange}&symbol={symbol}&trade_type={trade_type}
```

**参数**:
- `exchange` (必填): 交易所名称
- `symbol` (必填): 交易对符号
- `trade_type` (可选): 交易类型，默认 "spot"

**响应示例**:
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

### 2. 获取所有交易对同步状态

```
GET /api/sync/status/all?exchange={exchange}&trade_type={trade_type}
```

**参数**:
- `exchange` (必填): 交易所名称
- `trade_type` (可选): 交易类型过滤

**响应示例**:
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

## 数据字段说明

- `earliest_data_ts`: 最早有数据的时间戳（毫秒）
- `latest_sync_ts`: 最近一次同步到的时间戳（毫秒）
- `created_at`: 记录创建时间
- `updated_at`: 记录最后更新时间

## 实现的文件

### 新增文件
- `docs/SYNC_STATUS_API.md` - API 使用文档
- `docs/SYNC_STATUS_IMPLEMENTATION.md` - 实现总结
- `docs/test_sync_status_api.sh` - 测试脚本
- `docs/README_SYNC_STATUS.md` - 本文件

### 修改的文件
- `internal/api/handler.go` - 新增两个 handler 方法
- `internal/api/server.go` - 注册新路由
- `internal/storage/repository.go` - 扩展接口定义
- `internal/storage/postgres.go` - 实现查询方法

## 使用场景

1. **监控同步进度**: 查看各个交易对的数据同步到什么时间点
2. **故障排查**: 发现某个交易对长时间未更新时进行告警
3. **数据完整性检查**: 验证历史数据的时间范围
4. **管理界面**: 在前端展示同步状态列表

## 注意事项

1. 时间戳均为毫秒级 Unix 时间戳
2. 如果交易对从未同步过，查询单个交易对会返回 404
3. 查询所有交易对时，只返回有同步记录的交易对
4. 如果配置了 API Key，需要在请求头中携带 `X-API-Key` 或 `Authorization: Bearer <key>`

## 相关数据库表

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

## 前端集成示例

```javascript
// 获取单个交易对同步状态
async function getSymbolSyncStatus(exchange, symbol, tradeType = 'spot') {
  const response = await fetch(
    `/api/sync/status?exchange=${exchange}&symbol=${symbol}&trade_type=${tradeType}`
  );
  const data = await response.json();
  
  if (data.code === 0) {
    const { latest_sync_ts } = data.data;
    const lastUpdate = new Date(latest_sync_ts);
    console.log(`Last sync: ${lastUpdate.toLocaleString()}`);
    return data.data;
  } else {
    console.error('Error:', data.message);
    return null;
  }
}

// 获取所有交易对同步状态
async function getAllSymbolsSyncStatus(exchange, tradeType = '') {
  const url = new URL('/api/sync/status/all', window.location.origin);
  url.searchParams.append('exchange', exchange);
  if (tradeType) {
    url.searchParams.append('trade_type', tradeType);
  }
  
  const response = await fetch(url);
  const data = await response.json();
  
  if (data.code === 0) {
    console.log(`Found ${data.data.count} symbols`);
    return data.data.statuses;
  } else {
    console.error('Error:', data.message);
    return [];
  }
}

// 使用示例
const status = await getSymbolSyncStatus('binance', 'BTC-USDT');
const allStatuses = await getAllSymbolsSyncStatus('binance', 'spot');
```

## 问题反馈

如有问题或建议，请联系开发团队。
