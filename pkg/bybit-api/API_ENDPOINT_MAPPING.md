# Bybit API 端点到 Go 文件映射

本文档详细说明每个 API 端点应该在哪个 Go 文件中实现。

## 文件组织原则

1. **按模块分类**: 每个主要功能模块一个文件
2. **请求响应分离**: request/ 和 response/ 目录分别存放
3. **客户端方法**: 所有方法都在 `rest_client.go` 中实现
4. **类型定义**: 在对应的 types 文件中定义

## 端点映射表

### 1. Market Data (市场数据) - rest_client.go

实现文件: `pkg/bybit-api/rest_client.go`
请求类型: `pkg/bybit-api/types/request/v5_market.go`
响应类型: `pkg/bybit-api/types/response/v5_market.go`

| 方法名 | HTTP | 端点 | 请求类型 | 响应类型 |
|--------|------|------|----------|----------|
| `GetServerTime()` | GET | `/v5/market/time` | - | `ServerTimeResponse` |
| `GetKline()` | GET | `/v5/market/kline` | `GetKlineRequest` | `KlineResponse` |
| `GetMarkPriceKline()` | GET | `/v5/market/mark-price-kline` | `GetMarkPriceKlineRequest` | `KlineResponse` |
| `GetIndexPriceKline()` | GET | `/v5/market/index-price-kline` | `GetIndexPriceKlineRequest` | `KlineResponse` |
| `GetPremiumIndexPriceKline()` | GET | `/v5/market/premium-index-price-kline` | `GetPremiumIndexPriceKlineRequest` | `KlineResponse` |
| `GetInstrumentsInfo()` | GET | `/v5/market/instruments-info` | `GetInstrumentsInfoRequest` | `InstrumentsInfoResponse` |
| `GetOrderbook()` | GET | `/v5/market/orderbook` | `GetOrderbookRequest` | `OrderbookResponse` |
| `GetTickers()` | GET | `/v5/market/tickers` | `GetTickersRequest` | `TickersResponse` |
| `GetFundingRateHistory()` | GET | `/v5/market/funding/history` | `GetFundingRateHistoryRequest` | `FundingRateHistoryResponse` |
| `GetPublicTradingHistory()` | GET | `/v5/market/recent-trade` | `GetPublicTradingHistoryRequest` | `PublicTradingHistoryResponse` |
| `GetOpenInterest()` | GET | `/v5/market/open-interest` | `GetOpenInterestRequest` | `OpenInterestResponse` |
| `GetHistoricalVolatility()` | GET | `/v5/market/historical-volatility` | `GetHistoricalVolatilityRequest` | `HistoricalVolatilityResponse` |
| `GetInsurance()` | GET | `/v5/market/insurance` | `GetInsuranceRequest` | `InsuranceResponse` |
| `GetRiskLimit()` | GET | `/v5/market/risk-limit` | `GetRiskLimitRequest` | `RiskLimitResponse` |
| `GetDeliveryPrice()` | GET | `/v5/market/delivery-price` | `GetDeliveryPriceRequest` | `DeliveryPriceResponse` |
| `GetLongShortRatio()` | GET | `/v5/market/account-ratio` | `GetLongShortRatioRequest` | `LongShortRatioResponse` |

### 2. Trading (交易) - rest_client.go

实现文件: `pkg/bybit-api/rest_client.go`
请求类型: `pkg/bybit-api/types/request/v5_trade.go`
响应类型: `pkg/bybit-api/types/response/v5_trade.go`

| 方法名 | HTTP | 端点 | 请求类型 | 响应类型 |
|--------|------|------|----------|----------|
| `SubmitOrder()` | POST | `/v5/order/create` | `SubmitOrderRequest` | `OrderResponse` |
| `AmendOrder()` | POST | `/v5/order/amend` | `AmendOrderRequest` | `OrderResponse` |
| `CancelOrder()` | POST | `/v5/order/cancel` | `CancelOrderRequest` | `OrderResponse` |
| `GetActiveOrders()` | GET | `/v5/order/realtime` | `GetActiveOrdersRequest` | `OrderListResponse` |
| `GetHistoricOrders()` | GET | `/v5/order/history` | `GetHistoricOrdersRequest` | `OrderListResponse` |
| `BatchSubmitOrders()` | POST | `/v5/order/create-batch` | `BatchSubmitOrdersRequest` | `BatchOrderResponse` |
| `BatchAmendOrders()` | POST | `/v5/order/amend-batch` | `BatchAmendOrdersRequest` | `BatchOrderResponse` |
| `BatchCancelOrders()` | POST | `/v5/order/cancel-batch` | `BatchCancelOrdersRequest` | `BatchOrderResponse` |
| `CancelAllOrders()` | POST | `/v5/order/cancel-all` | `CancelAllOrdersRequest` | `CancelAllOrdersResponse` |
| `GetExecutionList()` | GET | `/v5/execution/list` | `GetExecutionListRequest` | `ExecutionListResponse` |

### 3. Position (持仓) - rest_client.go

实现文件: `pkg/bybit-api/rest_client.go`
请求类型: `pkg/bybit-api/types/request/v5_position.go`
响应类型: `pkg/bybit-api/types/response/v5_position.go`

| 方法名 | HTTP | 端点 | 请求类型 | 响应类型 |
|--------|------|------|----------|----------|
| `GetPositionInfo()` | GET | `/v5/position/list` | `GetPositionInfoRequest` | `PositionListResponse` |
| `SetLeverage()` | POST | `/v5/position/set-leverage` | `SetLeverageRequest` | `SetLeverageResponse` |
| `SwitchIsolatedMargin()` | POST | `/v5/position/switch-isolated` | `SwitchIsolatedMarginRequest` | `SwitchIsolatedMarginResponse` |
| `SwitchPositionMode()` | POST | `/v5/position/switch-mode` | `SwitchPositionModeRequest` | `SwitchPositionModeResponse` |
| `SetTradingStop()` | POST | `/v5/position/trading-stop` | `SetTradingStopRequest` | `SetTradingStopResponse` |
| `SetAutoAddMargin()` | POST | `/v5/position/set-auto-add-margin` | `SetAutoAddMarginRequest` | `SetAutoAddMarginResponse` |
| `AddOrReduceMargin()` | POST | `/v5/position/add-margin` | `AddOrReduceMarginRequest` | `AddOrReduceMarginResponse` |
| `GetClosedPnL()` | GET | `/v5/position/closed-pnl` | `GetClosedPnLRequest` | `ClosedPnLResponse` |

### 4. Account (账户) - rest_client.go

实现文件: `pkg/bybit-api/rest_client.go`
请求类型: `pkg/bybit-api/types/request/v5_account.go`
响应类型: `pkg/bybit-api/types/response/v5_account.go`

| 方法名 | HTTP | 端点 | 请求类型 | 响应类型 |
|--------|------|------|----------|----------|
| `GetAccountInfo()` | GET | `/v5/account/info` | `GetAccountInfoRequest` | `AccountInfoResponse` |
| `GetWalletBalance()` | GET | `/v5/account/wallet-balance` | `GetWalletBalanceRequest` | `WalletBalanceResponse` |
| `GetFeeRate()` | GET | `/v5/account/fee-rate` | `GetFeeRateRequest` | `FeeRateResponse` |
| `GetCollateralInfo()` | GET | `/v5/account/collateral-info` | `GetCollateralInfoRequest` | `CollateralInfoResponse` |
| `SetCollateralCoin()` | POST | `/v5/account/set-collateral-switch` | `SetCollateralCoinRequest` | `SetCollateralCoinResponse` |
| `SetMarginMode()` | POST | `/v5/account/set-margin-mode` | `SetMarginModeRequest` | `SetMarginModeResponse` |
| `GetBorrowHistory()` | GET | `/v5/account/borrow-history` | `GetBorrowHistoryRequest` | `BorrowHistoryResponse` |
| `GetTransactionLog()` | GET | `/v5/account/transaction-log` | `GetTransactionLogRequest` | `TransactionLogResponse` |

### 5. Asset (资产) - rest_client.go

实现文件: `pkg/bybit-api/rest_client.go`
请求类型: `pkg/bybit-api/types/request/v5_asset.go`
响应类型: `pkg/bybit-api/types/response/v5_asset.go`

| 方法名 | HTTP | 端点 | 请求类型 | 响应类型 |
|--------|------|------|----------|----------|
| `GetCoinInfo()` | GET | `/v5/asset/coin/query-info` | `GetCoinInfoRequest` | `CoinInfoResponse` |
| `GetDepositAddress()` | GET | `/v5/asset/deposit/query-address` | `GetDepositAddressRequest` | `DepositAddressResponse` |
| `GetDepositRecords()` | GET | `/v5/asset/deposit/query-record` | `GetDepositRecordsRequest` | `DepositRecordsResponse` |
| `GetWithdrawalRecords()` | GET | `/v5/asset/withdraw/query-record` | `GetWithdrawalRecordsRequest` | `WithdrawalRecordsResponse` |
| `Withdraw()` | POST | `/v5/asset/withdraw/create` | `WithdrawRequest` | `WithdrawResponse` |
| `CancelWithdrawal()` | POST | `/v5/asset/withdraw/cancel` | `CancelWithdrawalRequest` | `CancelWithdrawalResponse` |
| `GetWithdrawableAmount()` | GET | `/v5/asset/withdraw/withdrawable-amount` | `GetWithdrawableAmountRequest` | `WithdrawableAmountResponse` |
| `CreateInternalTransfer()` | POST | `/v5/asset/transfer/inter-transfer` | `CreateInternalTransferRequest` | `InternalTransferResponse` |
| `CreateUniversalTransfer()` | POST | `/v5/asset/transfer/universal-transfer` | `CreateUniversalTransferRequest` | `UniversalTransferResponse` |
| `GetUniversalTransferRecords()` | GET | `/v5/asset/transfer/query-universal-transfer-list` | `GetUniversalTransferRecordsRequest` | `UniversalTransferRecordsResponse` |

### 6. User (用户管理) - rest_client.go

实现文件: `pkg/bybit-api/rest_client.go`
请求类型: `pkg/bybit-api/types/request/v5_user.go`
响应类型: `pkg/bybit-api/types/response/v5_user.go`

| 方法名 | HTTP | 端点 | 请求类型 | 响应类型 |
|--------|------|------|----------|----------|
| `CreateSubMember()` | POST | `/v5/user/create-sub-member` | `CreateSubMemberRequest` | `CreateSubMemberResponse` |
| `GetSubMembers()` | GET | `/v5/user/query-sub-members` | `GetSubMembersRequest` | `SubMembersResponse` |
| `CreateSubApiKey()` | POST | `/v5/user/create-sub-api` | `CreateSubApiKeyRequest` | `CreateSubApiKeyResponse` |
| `GetApiKey()` | GET | `/v5/user/query-api` | `GetApiKeyRequest` | `ApiKeyResponse` |

## WebSocket 映射

实现文件: `pkg/bybit-api/websocket_client.go`
类型定义: `pkg/bybit-api/types/websocket/`

### Public Topics
- `orderbook.{depth}.{symbol}` -> `SubscribeOrderbook(symbol, depth)`
- `publicTrade.{symbol}` -> `SubscribePublicTrade(symbol)`
- `tickers.{symbol}` -> `SubscribeTicker(symbol)`
- `kline.{interval}.{symbol}` -> `SubscribeKline(symbol, interval)`

### Private Topics
- `position` -> `SubscribePosition()`
- `execution` -> `SubscribeExecution()`
- `order` -> `SubscribeOrder()`
- `wallet` -> `SubscribeWallet()`

## 实现进度跟踪

### Phase 1: 基础设施 (优先级: P0)
- [ ] `util/crypto.go` - 签名算法
- [ ] `util/base_rest_client.go` - HTTP 客户端基类
- [ ] `util/request_utils.go` - 请求工具
- [ ] `types/shared.go` - 共享类型

### Phase 2: Market Data (优先级: P0)
- [ ] `types/request/v5_market.go` - 市场数据请求类型
- [ ] `types/response/v5_market.go` - 市场数据响应类型
- [ ] `rest_client.go` - 市场数据方法 (15个)

### Phase 3: Trading (优先级: P0)
- [ ] `types/request/v5_trade.go` - 交易请求类型
- [ ] `types/response/v5_trade.go` - 交易响应类型
- [ ] `rest_client.go` - 交易方法 (10个)

### Phase 4: Position (优先级: P1)
- [ ] `types/request/v5_position.go` - 持仓请求类型
- [ ] `types/response/v5_position.go` - 持仓响应类型
- [ ] `rest_client.go` - 持仓方法 (8个)

### Phase 5: Account (优先级: P1)
- [ ] `types/request/v5_account.go` - 账户请求类型
- [ ] `types/response/v5_account.go` - 账户响应类型
- [ ] `rest_client.go` - 账户方法 (8个)

### Phase 6: Asset (优先级: P1)
- [ ] `types/request/v5_asset.go` - 资产请求类型
- [ ] `types/response/v5_asset.go` - 资产响应类型
- [ ] `rest_client.go` - 资产方法 (10个)

### Phase 7: WebSocket (优先级: P2)
- [ ] `util/base_ws_client.go` - WebSocket 基类
- [ ] `types/websocket/ws_general.go` - WebSocket 通用类型
- [ ] `types/websocket/ws_events.go` - WebSocket 事件类型
- [ ] `websocket_client.go` - WebSocket 客户端

### Phase 8: Advanced Features (优先级: P3)
- [ ] Crypto Loan APIs
- [ ] Earn APIs
- [ ] RFQ APIs
- [ ] P2P Trading APIs
- [ ] Broker APIs

## 总结

- **总端点数**: 247+
- **核心模块**: 6个 (Market, Trade, Position, Account, Asset, User)
- **实现文件**: 1个主文件 (rest_client.go) + 多个类型定义文件
- **预计工作量**: 10-15天 (完整实现所有端点)
