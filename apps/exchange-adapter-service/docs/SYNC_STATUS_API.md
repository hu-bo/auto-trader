# Symbol Sync Status API

本文档说明如何使用交易对同步状态查询 API。

## API 端点

### 1. 获取单个交易对的同步状态

查询指定交易对的最后更新时间和同步状态。

**请求**

```
GET /api/sync/status?exchange=binance&symbol=BTC-USDT&trade_type=spot
```

**参数**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| exchange | string | 是 | 交易所名称 (如: binance, okx, bybit) |
| symbol | string | 是 | 交易对符号 (如: BTC-USDT) |
| trade_type | string | 否 | 交易类型 (默认: spot)，可选值: spot, futures, swap |

**响应示例**

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

**字段说明**

- `earliest_data_ts`: 最早有数据的时间戳（毫秒）
- `latest_sync_ts`: 最近一次同步到的时间戳（毫秒）

### 2. 获取所有交易对的同步状态

批量查询交易所所有交易对的同步状态。

**请求**

```
GET /api/sync/status/all?exchange=binance&trade_type=spot
```

**参数**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| exchange | string | 是 | 交易所名称 (如: binance, okx, bybit) |
| trade_type | string | 否 | 交易类型过滤，不传则返回所有类型 |

**响应示例**

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
      },
      {
        "exchange": "binance",
        "symbol": "ETH-USDT",
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

**字段说明**

- `count`: 返回的交易对数量
- `statuses`: 交易对同步状态列表
  - `earliest_data_ts`: 最早有数据的时间戳（毫秒）
  - `latest_sync_ts`: 最近一次同步到的时间戳（毫秒）
  - `created_at`: 记录创建时间
  - `updated_at`: 记录最后更新时间

## 使用示例

### cURL 示例

```bash
# 查询单个交易对
curl "http://localhost:8080/api/sync/status?exchange=binance&symbol=BTC-USDT&trade_type=spot"

# 查询所有交易对
curl "http://localhost:8080/api/sync/status/all?exchange=binance&trade_type=spot"

# 如果启用了 API Key 认证
curl -H "X-API-Key: your-api-key" \
  "http://localhost:8080/api/sync/status/all?exchange=binance"
```

### JavaScript 示例

```javascript
// 查询单个交易对
async function getSymbolSyncStatus(exchange, symbol, tradeType = 'spot') {
  const response = await fetch(
    `http://localhost:8080/api/sync/status?exchange=${exchange}&symbol=${symbol}&trade_type=${tradeType}`
  );
  const data = await response.json();
  return data.data;
}

// 查询所有交易对
async function getAllSymbolsSyncStatus(exchange, tradeType = '') {
  const url = new URL('http://localhost:8080/api/sync/status/all');
  url.searchParams.append('exchange', exchange);
  if (tradeType) {
    url.searchParams.append('trade_type', tradeType);
  }
  
  const response = await fetch(url);
  const data = await response.json();
  return data.data;
}

// 使用示例
const status = await getSymbolSyncStatus('binance', 'BTC-USDT');
console.log('Latest sync:', new Date(status.latest_sync_ts));

const allStatuses = await getAllSymbolsSyncStatus('binance', 'spot');
console.log(`Found ${allStatuses.count} symbols`);
```

## 错误响应

当请求失败时，API 会返回错误响应：

```json
{
  "code": 400,
  "status": "error",
  "message": "exchange is required"
}
```

常见错误码：

- `400`: 请求参数错误
- `404`: 未找到同步状态记录
- `500`: 服务器内部错误
- `503`: 数据库未配置或服务不可用

## 数据库表结构

同步状态数据存储在 `symbol_sync_status` 表中：

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

## 注意事项

1. 时间戳均为毫秒级 Unix 时间戳
2. 如果交易对从未同步过，查询单个交易对会返回 404
3. 查询所有交易对时，只返回有同步记录的交易对
4. `updated_at` 字段会在每次更新同步状态时自动更新
