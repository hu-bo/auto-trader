# hquant/exchange-adapter

多平台交易适配器，旨在抹平 OKX、Binance 等主流加密货币交易所的 API 差异。通过提供一个统一、标准化的接口，简化量化交易策略的开发和部署流程。

## ✨ 核心特性

- **统一接口**: 为不同交易所的交易和查询操作提供一致的调用方式。
- **固化流程**: 标准化下单前的校验流程（参数校验 → 余额检查 → 精度格式化）。
- **统一数据结构**: 无论是交易对信息、订单、余额还是持仓，都返回统一的、经过清洗的数据格式。
- **职责分离**:
  - **`PublicAdapter`**: 无需 API Key，负责查询市场行情、交易对信息等公开数据。
  - **`TradeAdapter`**: 需要 API Key，负责下单、撤单、查询私有账户信息。
- **高可扩展性**: 提供清晰的基类和接口，方便快速集成新的交易所。
- **现代化的错误处理**: 采用 Go/Rust 风格的 `Result` 模式，使错误处理更安全、更明确。

## 🚀 快速开始

### 开发命令

在项目根目录执行以下命令：

```bash
# 运行 ticker_stream 示例（订阅 Ticker 数据流，聚合成 15m/4h/1d K线）
go run ./pkg/exchange-adapter/example/ticker_stream

# 指定交易所和交易类型
EXCHANGE=okx TRADE_TYPE=spot go run ./pkg/exchange-adapter/example/ticker_stream

# 使用 SOCKS5 代理
SOCKS_PROXY=127.0.0.1:7891 go run ./pkg/exchange-adapter/example/ticker_stream

# 指定订阅模式（multi: 多周期聚合 | kline: K线独立订阅）
MODE=multi go run ./pkg/exchange-adapter/example/ticker_stream

# 过滤低交易量交易对（百分比，默认 0.3 即过滤后 30% 低交易量）
VOLUME_FILTER=0.2 go run ./pkg/exchange-adapter/example/ticker_stream

# 黑名单过滤交易对（逗号分隔，支持 BTCUSDT/BTC-USDT/BTC-USDT-SWAP）
BLACKLIST=USDT,BUSD go run ./pkg/exchange-adapter/example/ticker_stream
```

### 构建命令

```bash
# 构建 exchange-adapter 包（用于依赖此包的服务）
go build ./pkg/exchange-adapter

# 构建依赖 exchange-adapter 的服务（如 exchange-adapter-service）
go build -o apps/exchange-adapter-service/exchange-adapter-service ./apps/exchange-adapter-service/cmd/main.go

# 在工作区中构建所有 Go 模块
go build ./...

# 清理构建缓存
go clean -cache
```

### 环境变量配置

创建 `.env.local` 文件（已在 `.gitignore` 中）：

```bash
# 交易所选择
EXCHANGE=binance              # binance | okx (默认: binance)
TRADE_TYPE=futures            # spot | futures (默认: futures)

# 代理配置（WebSocket 仅支持 SOCKS5）
SOCKS_PROXY=127.0.0.1:7891

# 订阅模式
MODE=multi                     # multi | kline (默认: multi)

# 交易量过滤
VOLUME_FILTER=0.3              # 0.0-1.0，默认 0.3

# 黑名单
BLACKLIST=USDT,BUSD
```

## 📦 项目结构

```
pkg/exchange-adapter/
├── core/                      # 核心接口和基类
├── exchanges/                 # 交易所实现
│   ├── binance/              # Binance 适配器
│   └── okx/                  # OKX 适配器
├── aggregator/               # 数据聚合器（K线聚合、大单检测等）
├── marketdata/               # 市场数据定义和常量
├── example/                  # 示例代码
│   └── ticker_stream/        # Ticker 数据流示例
└── README.md
```

## 🔧 常见开发任务

### 调试日志

设置日志级别（在应用启动时配置）：

```bash
# 调试模式（显示详细日志）
LOG_LEVEL=debug go run ./pkg/exchange-adapter/example/ticker_stream

# 生产模式（仅显示错误和重要信息）
LOG_LEVEL=info go run ./pkg/exchange-adapter/example/ticker_stream
```

### 修改依赖后重新构建

当修改了 `pkg/okx-api`、`pkg/binance-api` 等依赖包后，需要重新构建使用它们的服务：

```bash
# 清理 Go 模块缓存
go clean -modcache

# 重新构建 exchange-adapter-service
go build -o apps/exchange-adapter-service/exchange-adapter-service ./apps/exchange-adapter-service/cmd/main.go

# 或在工作区中重新构建所有模块
go build ./...
```

### 测试

```bash
# 运行所有测试
go test ./...

# 运行特定包的测试
go test ./pkg/exchange-adapter/...

# 显示详细测试输出
go test -v ./...

# 运行测试并生成覆盖率报告
go test -cover ./...
```

