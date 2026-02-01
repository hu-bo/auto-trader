# Bybit API 迁移总结

## 项目概览

从 TypeScript 版本 (`node-pkg/bybit-api`) 迁移到 Go 版本 (`pkg/bybit-api`)。

**源项目**: node-pkg/bybit-api (TypeScript)
**目标项目**: pkg/bybit-api (Golang)
**主要版本**: V5 API (优先支持)

## 📊 统计数据

### API 端点统计
- **总 API 端点**: 247+
- **GET 请求**: ~160
- **POST 请求**: ~87
- **主要模块**: 14个
- **子模块**: 30+

### 文件统计
| 类别 | TypeScript | Go |
|------|-----------|-----|
| 核心客户端 | 3个 | 3个 |
| 请求类型 | 24个 | 14个 (仅V5) |
| 响应类型 | 16个 | 14个 (仅V5) |
| WebSocket类型 | 4个 | 4个 |
| 工具文件 | 8个 | 8个 |

### 代码行数估算
- **TypeScript 总行数**: ~50,000+
- **Go 预计行数**: ~30,000+ (Go更简洁)

## 📁 目录结构

### 已创建的目录结构
```
pkg/bybit-api/
├── README.md                    ✅ 已存在
├── API_PATHS.md                 ✅ 已创建 (247+ API端点清单)
├── API_ENDPOINT_MAPPING.md      ✅ 已创建 (端点到文件映射)
├── DIRECTORY_STRUCTURE.md       ✅ 已创建 (目录结构映射)
├── MIGRATION_SUMMARY.md         ✅ 本文件
├── go.mod                       ✅ 已存在
├── go.sum                       ✅ 已存在
│
├── types/                       ✅ 已创建
│   ├── request/                 ✅ 已创建
│   ├── response/                ✅ 已创建
│   └── websocket/               ✅ 已创建
│
├── util/                        ✅ 已创建
│   ├── rest/                    ✅ 已创建
│   └── websocket/               ✅ 已创建
│
├── constants/                   ✅ 已创建
└── examples/                    ✅ 已创建
```

## 🎯 API 模块分类

### 1. Market Data (市场数据) - Public
**端点数**: 22个
**优先级**: P0 (最高)
**特点**: 公开数据，无需认证，易于测试

主要端点:
- 服务器时间
- K线数据 (现货、标记、指数、溢价)
- 交易对信息
- 订单簿
- 行情数据
- 资金费率
- 持仓量
- 风险限额

### 2. Trading (交易) - Private
**端点数**: 26个
**优先级**: P0 (最高)
**特点**: 核心功能，高频使用

主要端点:
- 订单管理 (创建、修改、取消)
- 批量操作 (最多20个订单)
- 订单查询 (实时、历史)
- 成交记录
- 价差交易

### 3. Position (持仓) - Private
**端点数**: 15个
**优先级**: P1 (高)
**特点**: 持仓管理核心功能

主要端点:
- 持仓查询
- 杠杆设置
- 保证金模式切换
- 止盈止损
- 盈亏查询

### 4. Account (账户) - Private
**端点数**: 25个
**优先级**: P1 (高)
**特点**: 账户信息和设置

主要端点:
- 账户信息
- 钱包余额
- 费率查询
- 抵押品管理
- 借贷管理
- 交易日志

### 5. Asset (资产) - Private
**端点数**: 35个
**优先级**: P1 (高)
**特点**: 资金管理

主要端点:
- 充值 (地址、记录)
- 提现 (创建、查询、取消)
- 内部划转
- 通用划转
- 币种信息
- 兑换功能

### 6. User (用户管理) - Private
**端点数**: 15个
**优先级**: P2 (中)
**特点**: 账户和API管理

主要端点:
- 子账户管理
- API密钥管理
- 联盟客户信息

### 7. Spot Margin Trade (现货保证金) - Private
**端点数**: 20个
**优先级**: P2 (中)
**特点**: 现货杠杆交易

模块:
- UTA 现货保证金 (11个端点)
- 全仓保证金 (9个端点)

### 8. Crypto Loan (加密借贷) - Private
**端点数**: 35个
**优先级**: P3 (低)
**特点**: 借贷服务

模块:
- 通用借贷 (7个端点)
- 灵活借贷 (6个端点)
- 定期借贷 (12个端点)
- 机构借贷 (9个端点)
- Legacy (已弃用，暂不迁移)

### 9. Earn (理财) - Private
**端点数**: 6个
**优先级**: P3 (低)
**特点**: 理财产品

### 10. RFQ (询价) - Private
**端点数**: 13个
**优先级**: P3 (低)
**特点**: 大宗交易

### 11. P2P Trading - Private
**端点数**: 13个
**优先级**: P3 (低)
**特点**: 点对点交易

### 12. Broker (经纪商) - Private
**端点数**: 6个
**优先级**: P3 (低)
**特点**: 需要经纪商权限

### 13. Pre-Upgrade (升级前数据) - Private
**端点数**: 6个
**优先级**: P4 (最低)
**特点**: 历史数据查询

### 14. System & Utilities
**端点数**: 10个
**优先级**: P2 (中)
**特点**: 系统状态和工具

## 🔧 WebSocket 支持

### WebSocket 连接类型
Bybit V5 需要 **6个并行 WebSocket 连接**:

1. **v5SpotPublic** - 现货公开数据
2. **v5LinearPublic** - 线性合约公开数据
3. **v5InversePublic** - 反向合约公开数据
4. **v5OptionPublic** - 期权公开数据
5. **v5Private** - 私有账户数据
6. **v5PrivateTrade** - WebSocket API 交易

### WebSocket Topics (30+)

**Public Topics** (无需认证):
- `orderbook.{depth}.{symbol}` - 订单簿
- `publicTrade.{symbol}` - 公开成交
- `tickers.{symbol}` - 行情
- `kline.{interval}.{symbol}` - K线
- `liquidation.{symbol}` - 清算
- 等等...

**Private Topics** (需要认证):
- `position` - 持仓更新
- `execution` - 成交通知
- `order` - 订单更新
- `wallet` - 余额更新
- `greeks` - 希腊值

**WebSocket API** (6个操作):
- `order.create` - 创建订单
- `order.amend` - 修改订单
- `order.cancel` - 取消订单
- `order.create-batch` - 批量创建
- `order.amend-batch` - 批量修改
- `order.cancel-batch` - 批量取消

## 📋 实施计划

### Phase 1: 基础设施 (1-2天) ⏳
**目标**: 建立项目基础

文件清单:
- [ ] `util/crypto.go` - HMAC-SHA256 & RSA 签名
- [ ] `util/base_rest_client.go` - Resty HTTP 客户端封装
- [ ] `util/request_utils.go` - 参数序列化、时间戳
- [ ] `types/shared.go` - 基础类型定义
- [ ] `constants/enum.go` - 枚举常量

技术要点:
- 集成 `go-resty/resty` (HTTP)
- 集成 `bytedance/sonic` (JSON)
- 实现签名算法
- 配置连接池和重试

### Phase 2: Market Data API (2-3天) ⏳
**目标**: 实现公开市场数据 API

文件清单:
- [ ] `types/request/v5_market.go` - 15种请求类型
- [ ] `types/response/v5_market.go` - 15种响应类型
- [ ] `rest_client.go` - 22个方法

实现方法:
- `GetServerTime()`
- `GetKline()`, `GetMarkPriceKline()`, etc.
- `GetInstrumentsInfo()`
- `GetOrderbook()`
- `GetTickers()`
- 等等 (共22个)

测试方式:
- 使用公开端点，无需API密钥
- 易于单元测试和集成测试

### Phase 3: Trading API (3-4天) ⏳
**目标**: 实现交易核心功能

文件清单:
- [ ] `types/request/v5_trade.go` - 10种请求类型
- [ ] `types/response/v5_trade.go` - 10种响应类型
- [ ] `rest_client.go` - 新增26个方法

实现方法:
- `SubmitOrder()`, `AmendOrder()`, `CancelOrder()`
- `BatchSubmitOrders()`, `BatchAmendOrders()`, `BatchCancelOrders()`
- `GetActiveOrders()`, `GetHistoricOrders()`
- `GetExecutionList()`
- 价差交易方法

测试方式:
- 使用 Testnet API密钥
- 小额订单测试

### Phase 4: Position API (2-3天) ⏳
**目标**: 实现持仓管理

文件清单:
- [ ] `types/request/v5_position.go` - 8种请求类型
- [ ] `types/response/v5_position.go` - 8种响应类型
- [ ] `rest_client.go` - 新增15个方法

实现方法:
- `GetPositionInfo()`
- `SetLeverage()`, `SwitchIsolatedMargin()`, `SwitchPositionMode()`
- `SetTradingStop()`, `SetAutoAddMargin()`, `AddOrReduceMargin()`
- `GetClosedPnL()`

### Phase 5: Account API (2-3天) ⏳
**目标**: 实现账户管理

文件清单:
- [ ] `types/request/v5_account.go` - 12种请求类型
- [ ] `types/response/v5_account.go` - 12种响应类型
- [ ] `rest_client.go` - 新增25个方法

实现方法:
- `GetAccountInfo()`, `GetWalletBalance()`, `GetFeeRate()`
- `GetCollateralInfo()`, `SetCollateralCoin()`
- `SetMarginMode()`, `SetMarginMode()`
- `GetBorrowHistory()`, `GetTransactionLog()`

### Phase 6: Asset API (2-3天) ⏳
**目标**: 实现资产管理

文件清单:
- [ ] `types/request/v5_asset.go` - 15种请求类型
- [ ] `types/response/v5_asset.go` - 15种响应类型
- [ ] `rest_client.go` - 新增35个方法

实现方法:
- 充值相关 (7个方法)
- 提现相关 (7个方法)
- 划转相关 (6个方法)
- 兑换相关 (6个方法)
- 其他资产功能

### Phase 7: User Management (1-2天) ⏳
**目标**: 实现用户和API密钥管理

文件清单:
- [ ] `types/request/v5_user.go` - 8种请求类型
- [ ] `types/response/v5_user.go` - 8种响应类型
- [ ] `rest_client.go` - 新增15个方法

### Phase 8: WebSocket Client (3-5天) ⏳
**目标**: 实现 WebSocket 流式数据

文件清单:
- [ ] `util/base_ws_client.go` - WebSocket 基类
- [ ] `util/websocket/ws_store.go` - 连接管理
- [ ] `util/websocket/ws_util.go` - 工具函数
- [ ] `types/websocket/ws_general.go` - 通用类型
- [ ] `types/websocket/ws_events.go` - 事件类型
- [ ] `types/websocket/ws_confirmations.go` - 确认类型
- [ ] `websocket_client.go` - 主客户端

技术要点:
- 使用 `lxzan/gws` 库
- 实现6个并行连接
- 自动重连机制
- 心跳检测
- 订阅管理

### Phase 9: Advanced Features (可选，5-7天) ⏸️
**目标**: 高级功能模块

模块:
- [ ] Crypto Loan (借贷)
- [ ] Earn (理财)
- [ ] RFQ (询价)
- [ ] P2P Trading
- [ ] Broker
- [ ] Spot Margin Trade

## 🎓 技术栈

| 组件 | 库 | 版本 | 用途 |
|------|-----|------|------|
| HTTP Client | `go-resty/resty` | v2.11.0 | REST API |
| JSON | `bytedance/sonic` | v1.10.2 | 高性能JSON |
| WebSocket | `lxzan/gws` | v1.8.0 | WebSocket连接 |
| Go 版本 | - | 1.21+ | - |

## ✅ 已完成工作

1. ✅ 识别所有247+ API端点
2. ✅ 创建目录结构
3. ✅ 编写 API_PATHS.md (API路径清单)
4. ✅ 编写 API_ENDPOINT_MAPPING.md (端点映射)
5. ✅ 编写 DIRECTORY_STRUCTURE.md (目录结构)
6. ✅ 编写 MIGRATION_SUMMARY.md (本文档)

## 📝 下一步行动

### 立即执行 (今天)
1. 实现 `util/crypto.go` - 签名算法
2. 实现 `util/base_rest_client.go` - HTTP客户端
3. 实现基础类型定义

### 本周目标
1. 完成 Phase 1-2 (基础设施 + Market Data)
2. 编写单元测试
3. 测试公开API端点

### 两周目标
1. 完成 Phase 3-5 (Trading + Position + Account)
2. Testnet 集成测试
3. 性能测试

### 一个月目标
1. 完成核心功能 (Phase 1-7)
2. 完成 WebSocket 客户端
3. 生产环境就绪

## 📊 进度跟踪

### 核心模块进度
- [ ] 基础设施 (0%)
- [ ] Market Data (0%)
- [ ] Trading (0%)
- [ ] Position (0%)
- [ ] Account (0%)
- [ ] Asset (0%)
- [ ] User (0%)
- [ ] WebSocket (0%)

### 整体进度
**文档阶段**: ✅ 100% 完成
**实现阶段**: ⏳ 0% (准备开始)

## 🔗 参考链接

- **TypeScript 源码**: `/Users/hubo/Work/Coding/MyProject/app-golang/node-pkg/bybit-api`
- **Go 目标目录**: `/Users/hubo/Work/Coding/MyProject/app-golang/pkg/bybit-api`
- **Bybit API 文档**: https://bybit-exchange.github.io/docs/v5/intro
- **项目 README**: [pkg/bybit-api/README.md](README.md)

## 📌 注意事项

1. **只迁移 V5 API**: 忽略旧版本 (V1-V3)
2. **优先核心功能**: 先实现高频使用的模块
3. **测试驱动开发**: 每个模块都要有测试
4. **参考 TypeScript**: 保持 API 接口一致性
5. **性能优化**: 利用 Go 的并发特性
6. **错误处理**: 统一错误类型和处理方式

---

**文档创建时间**: 2026-01-31
**最后更新**: 2026-01-31
**状态**: 📋 规划完成，等待实施
