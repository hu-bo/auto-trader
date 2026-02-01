# Exchange Sync

加密货币交易所实时数据聚合服务。从 Binance 和 OKX 获取 WebSocket 实时数据流，聚合为标准化 K 线，并通过 HTTP API 和 NATS 消息队列对外提供服务。

## 功能特性

- 多交易所数据归一化 (Binance, OKX)
- 5m → 15m/4h/1d K 线聚合
- 大单过滤 (≥$5000 USDT)
- 实时推送 + 历史查询
- REST API 同步交易所历史数据

## 快速开始

### 环境要求

- Go 1.22+
- PostgreSQL 15+ (可选)

### 安装

```bash
# 克隆项目
cd apps/exchange-sync

# 安装依赖
make deps

# 构建
make build
```

### 配置

复制配置文件并修改：

```bash
cp config.yaml config.local.yaml
```

编辑 `config.local.yaml`:

```yaml
server:
  http_port: 9003

nats:
  enabled: true
  url: "nats://localhost:15001"
  subject_prefix: "exchange"
  batch_window_ms: 200

database:
  host: localhost
  port: 15000
  user: exchange_sync_user
  password: "123456"
  database: exchange_info

proxy: "socks5://127.0.0.1:7890"  # 可选
```

### 运行

```bash
# 启动本地 PostgreSQL (可选)
make docker-up

# 运行服务
make run

# 或开发模式 (热重载)
make dev
```

## API 接口

### REST API

| 方法 | 路径 | 说明 |
|-----|------|------|
| GET | `/health` | 健康检查 |
| GET | `/api/orderbook` | 获取大单订单簿 |
| GET | `/api/trace-price` | 获取追踪价格 |
| GET | `/api/candles` | 获取历史 K 线 |
| GET | `/api/candle/current` | 获取当前 K 线 |
| GET | `/api/candle/fill-miss` | 填充缺失数据 |
| POST | `/api/subscribe` | 动态订阅 |
| POST | `/api/unsubscribe` | 取消订阅 |

### 示例请求

```bash
# 健康检查
curl http://localhost:9003/health

# 获取订单簿 (±10% 范围)
curl "http://localhost:9003/api/orderbook?exchange=binance&symbol=BTC-USDT&range=0.1"

# 获取历史 K 线
curl "http://localhost:9003/api/candles?exchange=binance&symbol=BTC-USDT&period=15m&limit=100"

# 获取历史 K 线 (列式存储，减少 ~70% 体积，更利于压缩)
curl "http://localhost:9003/api/candles?exchange=binance&symbol=BTC-USDT&period=15m&limit=100&column=true"

# 获取历史 K 线 (紧凑格式)
curl "http://localhost:9003/api/candles?exchange=binance&symbol=BTC-USDT&period=15m&limit=100&compact=true"

# 动态订阅
curl -X POST "http://localhost:9003/api/subscribe" \
  -H "Content-Type: application/json" \
  -d '{"exchange":"binance","symbols":[{"symbol":"ETH-USDT","trade_type":"spot"}]}'

# 获取所有交易对
curl "http://localhost:9003/api/symbols?exchange=binance"

# 获取指定类型的交易对
curl "http://localhost:9003/api/symbols?exchange=binance&trade_type=spot"

# 获取所有交易对 (按 24h 成交额排序)
curl "http://localhost:9003/api/symbols?exchange=binance&orderBy=amount24h"

# 获取所有交易对 (按 24h 涨幅排序)
curl "http://localhost:9003/api/symbols?exchange=binance&orderBy=change24h"

# 更新交易对同步开关 (开启)
curl -X PUT "http://localhost:9003/api/symbols" \
  -H "Content-Type: application/json" \
  -d '{"exchange":"binance","symbol":"ETH-USDT","trade_type":"spot","sync_enabled":true}'

# 更新交易对同步开关 (关闭)
curl -X PUT "http://localhost:9003/api/symbols" \
  -H "Content-Type: application/json" \
  -d '{"exchange":"binance","symbol":"SUI-USDT","trade_type":"spot","sync_enabled":false}'
```

### 列式存储格式 (column=true)

当请求 K 线数据时添加 `column=true` 参数，返回 Column-Oriented 格式。每个字段一个数组，相同类型数据连续存储，更有利于 gzip 压缩，可减少约 70% 的传输体积。

**响应格式：**

```json
{
  "code": 0,
  "status": "ok",
  "message": "success",
  "data": {
    "timestamp":  [1703001600000, 1703002500000],
    "open":       [42000.5, 42050.0],
    "high":       [42100.0, 42200.0],
    "low":        [41900.0, 41950.0],
    "close":      [42050.0, 42150.0],
    "volume":     [100.5, 150.3],
    "buy_volume": [60.3, 80.1]
  }
}
```

**前端解码 (JavaScript/TypeScript)：**

```typescript
interface ColumnResponse {
  timestamp: number[];
  open: number[];
  high: number[];
  low: number[];
  close: number[];
  volume: number[];
  buy_volume: number[];
}

interface Candle {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  buy_volume: number;
}

/**
 * 解码列式存储数据
 */
function decodeColumnFormat(data: ColumnResponse): Candle[] {
  const len = data.timestamp.length;
  const result: Candle[] = new Array(len);
  for (let i = 0; i < len; i++) {
    result[i] = {
      timestamp: data.timestamp[i],
      open: data.open[i],
      high: data.high[i],
      low: data.low[i],
      close: data.close[i],
      volume: data.volume[i],
      buy_volume: data.buy_volume[i],
    };
  }
  return result;
}

// 使用示例
const response = await fetch('/api/candles?symbol=BTC-USDT&column=true');
const { data } = await response.json();
const candles: Candle[] = decodeColumnFormat(data);
```

### NATS 消息主题

实时数据通过 NATS 发布，下游服务可订阅以下主题：

| 主题格式 | 说明 | 示例 |
|---------|------|------|
| `{prefix}.candle.{exchange}.{tradeType}.{symbol}.{period}` | K 线更新 | `exchange.candle.binance.spot.BTC-USDT.15m` |
| `{prefix}.orderbook.{exchange}.{tradeType}.{symbol}` | 订单簿更新 | `exchange.orderbook.okx.futures.ETH-USDT` |

默认前缀: `exchange`

#### Node.js 订阅示例

```javascript
const { connect, StringCodec } = require('nats');

async function main() {
  const nc = await connect({ servers: 'nats://localhost:15001' });
  const sc = StringCodec();

  // 订阅 Binance BTC-USDT 现货 15m K线
  const sub = nc.subscribe('exchange.candle.binance.spot.BTC-USDT.15m');

  for await (const msg of sub) {
    const candle = JSON.parse(sc.decode(msg.data));
    console.log('Candle:', candle);
  }
}

main();
```

#### Python 订阅示例

```python
import asyncio
import json
import nats

async def main():
    nc = await nats.connect("nats://localhost:15001")

    async def handler(msg):
        candle = json.loads(msg.data.decode())
        print(f"Candle: {candle}")

    # 订阅所有交易所的 BTC-USDT 所有周期 K线
    await nc.subscribe("exchange.candle.*.*.BTC-USDT.*", cb=handler)

    # 保持运行
    await asyncio.Event().wait()

asyncio.run(main())
```

## 开发命令

```bash
make build       # 构建
make run         # 构建并运行
make dev         # 热重载开发模式
make test        # 运行测试
make test-cover  # 测试覆盖率
make lint        # 代码检查
make fmt         # 格式化代码
make clean       # 清理构建产物
```

## 项目结构

```
apps/exchange-sync/
├── cmd/
│   └── main.go                 # 入口
├── internal/
│   ├── api/
│   │   ├── server.go           # HTTP 服务器
│   │   └── handler.go          # REST API 处理器
│   ├── publisher/
│   │   └── nats.go             # NATS 消息发布器
│   ├── aggregator/
│   │   ├── period.go           # K线周期聚合器
│   │   └── orderbook.go        # 订单簿管理器
│   ├── config/
│   │   └── config.go           # 配置加载
│   ├── exchange/
│   │   ├── types.go            # 通用接口和类型
│   │   ├── binance/
│   │   │   └── client.go       # Binance 客户端
│   │   └── okx/
│   │       └── client.go       # OKX 客户端
│   ├── service/
│   │   ├── sync.go             # 历史数据同步
│   │   └── ws_sync.go          # WebSocket 同步服务
│   └── storage/
│       ├── repository.go       # 存储接口
│       └── postgres.go         # PostgreSQL 实现
├── pkg/utils/
│   ├── parse.go                # 工具函数
│   └── batch.go                # 批量处理工具
├── config.yaml                 # 默认配置
├── Makefile                    # 构建脚本
└── README.md                   # 本文档
```

## License

MIT
