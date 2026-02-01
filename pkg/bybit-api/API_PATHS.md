# Bybit API V5 完整路径清单

本文档列出从 TypeScript 版本识别出的所有 API 路径，按功能模块分类。

## 1. Market Data（市场数据）- Public

### 基础市场数据
- `GET /v5/market/time` - 服务器时间
- `GET /v5/market/kline` - K线数据
- `GET /v5/market/mark-price-kline` - 标记价格K线
- `GET /v5/market/index-price-kline` - 指数价格K线
- `GET /v5/market/premium-index-price-kline` - 溢价指数价格K线
- `GET /v5/market/instruments-info` - 交易对信息
- `GET /v5/market/orderbook` - 订单簿
- `GET /v5/market/rpi_orderbook` - RPI订单簿
- `GET /v5/market/tickers` - 24h行情
- `GET /v5/market/recent-trade` - 最近成交
- `GET /v5/market/funding/history` - 资金费率历史
- `GET /v5/market/open-interest` - 持仓量
- `GET /v5/market/historical-volatility` - 历史波动率
- `GET /v5/market/insurance` - 保险基金
- `GET /v5/market/risk-limit` - 风险限额
- `GET /v5/market/delivery-price` - 交割价格
- `GET /v5/market/new-delivery-price` - 新交割价格
- `GET /v5/market/account-ratio` - 多空比
- `GET /v5/market/index-price-components` - 指数价格成分
- `GET /v5/market/price-limit` - 价格限制
- `GET /v5/market/adlAlert` - ADL预警
- `GET /v5/market/fee-group-info` - 费率分组信息

### Spread Trading（价差交易）
- `GET /v5/spread/instrument` - 价差交易对信息
- `GET /v5/spread/orderbook` - 价差订单簿
- `GET /v5/spread/tickers` - 价差行情
- `GET /v5/spread/recent-trade` - 价差最近成交

## 2. Trading（交易）- Private

### 订单管理
- `POST /v5/order/create` - 创建订单
- `POST /v5/order/create-batch` - 批量创建订单
- `POST /v5/order/amend` - 修改订单
- `POST /v5/order/amend-batch` - 批量修改订单
- `POST /v5/order/cancel` - 取消订单
- `POST /v5/order/cancel-batch` - 批量取消订单
- `POST /v5/order/cancel-all` - 取消全部订单
- `POST /v5/order/disconnected-cancel-all` - 断线取消全部
- `GET /v5/order/realtime` - 实时订单查询
- `GET /v5/order/history` - 历史订单查询
- `GET /v5/order/spot-borrow-check` - 现货借贷检查
- `GET /v5/order/pre-check` - 下单前检查

### 成交历史
- `GET /v5/execution/list` - 成交记录

### Spread Trading 订单
- `POST /v5/spread/order/create` - 创建价差订单
- `POST /v5/spread/order/amend` - 修改价差订单
- `POST /v5/spread/order/cancel` - 取消价差订单
- `POST /v5/spread/order/cancel-all` - 取消全部价差订单
- `GET /v5/spread/order/realtime` - 实时价差订单
- `GET /v5/spread/order/history` - 历史价差订单
- `GET /v5/spread/execution/list` - 价差成交记录

## 3. Position（持仓）- Private

### 持仓管理
- `GET /v5/position/list` - 持仓列表
- `GET /v5/position/closed-pnl` - 已平仓盈亏
- `GET /v5/position/get-closed-positions` - 已平仓持仓
- `GET /v5/position/move-history` - 仓位转移历史
- `POST /v5/position/move-positions` - 转移仓位

### 持仓设置
- `POST /v5/position/set-leverage` - 设置杠杆
- `POST /v5/position/switch-isolated` - 切换逐仓/全仓
- `POST /v5/position/switch-mode` - 切换持仓模式
- `POST /v5/position/set-risk-limit` - 设置风险限额
- `POST /v5/position/confirm-pending-mmr` - 确认待定维持保证金率
- `POST /v5/position/set-tpsl-mode` - 设置止盈止损模式
- `POST /v5/position/trading-stop` - 设置止盈止损
- `POST /v5/position/set-auto-add-margin` - 设置自动追加保证金
- `POST /v5/position/add-margin` - 追加/减少保证金

## 4. Account（账户）- Private

### 账户信息
- `GET /v5/account/info` - 账户信息
- `GET /v5/account/wallet-balance` - 钱包余额
- `GET /v5/account/fee-rate` - 费率
- `GET /v5/account/instruments-info` - 账户交易对信息
- `GET /v5/account/user-setting-config` - 用户设置配置
- `GET /v5/account/smp-group` - SMP分组

### 抵押品管理
- `GET /v5/account/collateral-info` - 抵押品信息
- `POST /v5/account/set-collateral-switch` - 设置抵押品开关
- `POST /v5/account/set-collateral-switch-batch` - 批量设置抵押品开关
- `GET /v5/account/coin-greeks` - 币种希腊值

### 账户设置
- `POST /v5/account/set-margin-mode` - 设置保证金模式
- `POST /v5/account/set-hedging-mode` - 设置对冲模式
- `POST /v5/account/set-limit-px-action` - 设置限价单价格行为
- `POST /v5/account/upgrade-to-uta` - 升级到统一账户

### 做市商保护（MMP）
- `POST /v5/account/mmp-modify` - 修改MMP
- `POST /v5/account/mmp-reset` - 重置MMP
- `GET /v5/account/mmp-state` - MMP状态

### 借贷
- `GET /v5/account/borrow-history` - 借贷历史
- `POST /v5/account/borrow` - 借贷
- `POST /v5/account/repay` - 还款
- `POST /v5/account/quick-repayment` - 快速还款
- `POST /v5/account/no-convert-repay` - 不转换还款

### DCP & 其他
- `GET /v5/account/query-dcp-info` - 查询DCP信息
- `GET /v5/account/transaction-log` - 交易日志
- `GET /v5/account/contract-transaction-log` - 合约交易日志
- `POST /v5/account/demo-apply-money` - 模拟账户申请资金
- `GET /v5/account/withdrawal` - 提现（查询）

## 5. Asset（资产）- Private

### 充值
- `GET /v5/asset/deposit/query-address` - 查询充值地址
- `GET /v5/asset/deposit/query-record` - 查询充值记录
- `GET /v5/asset/deposit/query-sub-member-record` - 查询子账户充值记录
- `GET /v5/asset/deposit/query-sub-member-address` - 查询子账户充值地址
- `GET /v5/asset/deposit/query-internal-record` - 查询内部充值记录
- `GET /v5/asset/deposit/query-allowed-list` - 查询允许充值列表
- `POST /v5/asset/deposit/deposit-to-account` - 充值到账户

### 提现
- `POST /v5/asset/withdraw/create` - 创建提现
- `POST /v5/asset/withdraw/cancel` - 取消提现
- `GET /v5/asset/withdraw/query-record` - 查询提现记录
- `GET /v5/asset/withdraw/query-address` - 查询提现地址
- `GET /v5/asset/withdraw/withdrawable-amount` - 可提现金额
- `GET /v5/asset/withdraw/vasp/list` - VASP列表

### 资产信息
- `GET /v5/asset/coin/query-info` - 查询币种信息
- `GET /v5/asset/transfer/query-asset-info` - 查询资产信息
- `GET /v5/asset/transfer/query-account-coins-balance` - 查询账户币种余额
- `GET /v5/asset/transfer/query-account-coin-balance` - 查询账户单币种余额
- `GET /v5/asset/transfer/query-transfer-coin-list` - 查询可转账币种列表
- `GET /v5/asset/covert/small-balance-list` - 小额余额列表

### 划转
- `POST /v5/asset/transfer/inter-transfer` - 内部划转
- `POST /v5/asset/transfer/universal-transfer` - 通用划转
- `GET /v5/asset/transfer/query-inter-transfer-list` - 查询内部划转列表
- `GET /v5/asset/transfer/query-universal-transfer-list` - 查询通用划转列表
- `POST /v5/asset/transfer/save-transfer-sub-member` - 保存子账户划转
- `GET /v5/asset/transfer/query-sub-member-list` - 查询子账户列表

### 兑换
- `POST /v5/asset/exchange/quote-apply` - 申请兑换报价
- `POST /v5/asset/exchange/convert-execute` - 执行兑换
- `GET /v5/asset/exchange/convert-result-query` - 查询兑换结果
- `GET /v5/asset/exchange/query-convert-history` - 查询兑换历史
- `GET /v5/asset/exchange/query-coin-list` - 查询可兑换币种
- `GET /v5/asset/exchange/order-record` - 兑换订单记录

### 交割/结算
- `GET /v5/asset/delivery-record` - 交割记录
- `GET /v5/asset/settlement-record` - 结算记录

### 其他
- `GET /v5/asset/coin-greeks` - 币种希腊值

## 6. Spot Margin Trade（现货保证金交易）- Private

### UTA Spot Margin
- `GET /v5/spot-margin-trade/data` - VIP保证金数据
- `GET /v5/spot-margin-trade/interest-rate-history` - 利率历史
- `POST /v5/spot-margin-trade/set-leverage` - 设置杠杆
- `POST /v5/spot-margin-trade/switch-mode` - 切换模式
- `GET /v5/spot-margin-trade/state` - 保证金状态
- `GET /v5/spot-margin-trade/max-borrowable` - 最大可借
- `GET /v5/spot-margin-trade/position-tiers` - 持仓档位
- `GET /v5/spot-margin-trade/get-auto-repay-mode` - 获取自动还款模式
- `POST /v5/spot-margin-trade/set-auto-repay-mode` - 设置自动还款模式
- `GET /v5/spot-margin-trade/repayment-available-amount` - 可还款金额
- `GET /v5/spot-margin-trade/coinstate` - 币种状态

### Cross Margin（全仓保证金）
- `GET /v5/spot-cross-margin-trade/loan-info` - 借贷信息
- `GET /v5/spot-cross-margin-trade/account` - 账户信息
- `GET /v5/spot-cross-margin-trade/orders` - 订单
- `GET /v5/spot-cross-margin-trade/repay-history` - 还款历史
- `POST /v5/spot-cross-margin-trade/loan` - 借贷
- `POST /v5/spot-cross-margin-trade/repay` - 还款
- `POST /v5/spot-cross-margin-trade/switch` - 切换
- `GET /v5/spot-cross-margin-trade/pledge-token` - 质押代币
- `GET /v5/spot-cross-margin-trade/borrow-token` - 可借代币

## 7. Crypto Loan（加密货币借贷）- Private

### Common（新版通用）
- `GET /v5/crypto-loan-common/loanable-data` - 可借币种
- `GET /v5/crypto-loan-common/collateral-data` - 抵押币种
- `GET /v5/crypto-loan-common/max-loan` - 最大可借
- `GET /v5/crypto-loan-common/max-collateral-amount` - 最大抵押金额
- `POST /v5/crypto-loan-common/adjust-ltv` - 调整LTV
- `GET /v5/crypto-loan-common/adjustment-history` - 调整历史
- `GET /v5/crypto-loan-common/position` - 借贷仓位

### Flexible Loan（灵活借贷）
- `POST /v5/crypto-loan-flexible/borrow` - 借贷
- `POST /v5/crypto-loan-flexible/repay` - 还款
- `POST /v5/crypto-loan-flexible/repay-collateral` - 抵押物还款
- `GET /v5/crypto-loan-flexible/ongoing-coin` - 进行中的借贷
- `GET /v5/crypto-loan-flexible/borrow-history` - 借贷历史
- `GET /v5/crypto-loan-flexible/repayment-history` - 还款历史

### Fixed Loan（定期借贷）
- `GET /v5/crypto-loan-fixed/supply-order-quote` - 供应订单报价
- `GET /v5/crypto-loan-fixed/borrow-order-quote` - 借贷订单报价
- `POST /v5/crypto-loan-fixed/borrow` - 借贷
- `POST /v5/crypto-loan-fixed/supply` - 供应
- `POST /v5/crypto-loan-fixed/borrow-order-cancel` - 取消借贷订单
- `POST /v5/crypto-loan-fixed/supply-order-cancel` - 取消供应订单
- `GET /v5/crypto-loan-fixed/borrow-contract-info` - 借贷合约信息
- `GET /v5/crypto-loan-fixed/supply-contract-info` - 供应合约信息
- `GET /v5/crypto-loan-fixed/borrow-order-info` - 借贷订单信息
- `GET /v5/crypto-loan-fixed/supply-order-info` - 供应订单信息
- `GET /v5/crypto-loan-fixed/repayment-history` - 还款历史
- `POST /v5/crypto-loan-fixed/renew` - 续期
- `GET /v5/crypto-loan-fixed/renew-info` - 续期信息
- `POST /v5/crypto-loan-fixed/fully-repay` - 全额还款

### Legacy（旧版 - 已弃用）
- `GET /v5/crypto-loan/loanable-data` - 可借币种
- `GET /v5/crypto-loan/collateral-data` - 抵押币种
- `POST /v5/crypto-loan/borrow` - 借贷
- `POST /v5/crypto-loan/repay` - 还款
- `GET /v5/crypto-loan/ongoing-orders` - 进行中订单
- `GET /v5/crypto-loan/repayment-history` - 还款历史
- `GET /v5/crypto-loan/borrow-history` - 借贷历史
- `POST /v5/crypto-loan/adjust-ltv` - 调整LTV
- `GET /v5/crypto-loan/adjustment-history` - 调整历史
- `GET /v5/crypto-loan/max-collateral-amount` - 最大抵押金额
- `GET /v5/crypto-loan/borrowable-collateralisable-number` - 可借抵押数量

### Institutional Loan（机构借贷）
- `GET /v5/ins-loan/product-infos` - 产品信息
- `GET /v5/ins-loan/ensure-tokens` - 保证代币
- `GET /v5/ins-loan/ensure-tokens-convert` - 保证代币转换
- `POST /v5/ins-loan/association-uid` - 关联UID
- `GET /v5/ins-loan/ltv` - LTV
- `GET /v5/ins-loan/ltv-convert` - LTV转换
- `POST /v5/ins-loan/repay-loan` - 还款
- `GET /v5/ins-loan/loan-order` - 借贷订单
- `GET /v5/ins-loan/repaid-history` - 还款历史

## 8. Earn（理财）- Private

- `GET /v5/earn/product` - 理财产品
- `POST /v5/earn/place-order` - 下单
- `GET /v5/earn/order` - 订单
- `GET /v5/earn/position` - 持仓
- `GET /v5/earn/yield` - 收益
- `GET /v5/earn/hourly-yield` - 小时收益

## 9. RFQ（询价）- Private

### RFQ管理
- `POST /v5/rfq/create-rfq` - 创建询价
- `POST /v5/rfq/cancel-rfq` - 取消询价
- `POST /v5/rfq/cancel-all-rfq` - 取消全部询价
- `GET /v5/rfq/config` - 询价配置
- `GET /v5/rfq/rfq-realtime` - 实时询价
- `GET /v5/rfq/rfq-list` - 询价列表

### 报价管理
- `POST /v5/rfq/create-quote` - 创建报价
- `POST /v5/rfq/execute-quote` - 执行报价
- `POST /v5/rfq/cancel-quote` - 取消报价
- `POST /v5/rfq/cancel-all-quotes` - 取消全部报价
- `GET /v5/rfq/quote-realtime` - 实时报价
- `GET /v5/rfq/quote-list` - 报价列表
- `POST /v5/rfq/accept-other-quote` - 接受非LP报价

### 成交记录
- `GET /v5/rfq/trade-list` - 成交列表
- `GET /v5/rfq/public-trades` - 公开成交

## 10. P2P Trading（P2P交易）- Private

### 用户信息
- `GET /v5/p2p/user/personal/info` - 个人信息
- `GET /v5/p2p/user/payment/list` - 支付方式列表
- `GET /v5/p2p/user/order/personal/info` - 个人订单信息

### 广告管理
- `GET /v5/p2p/item/online` - 在线广告
- `GET /v5/p2p/item/personal/list` - 个人广告列表
- `GET /v5/p2p/item/info` - 广告信息
- `POST /v5/p2p/item/create` - 创建广告
- `POST /v5/p2p/item/update` - 更新广告
- `POST /v5/p2p/item/cancel` - 取消广告

### 订单管理
- `GET /v5/p2p/order/simplifyList` - 订单简化列表
- `GET /v5/p2p/order/pending/simplifyList` - 待处理订单列表
- `GET /v5/p2p/order/info` - 订单信息
- `GET /v5/p2p/order/message/listpage` - 订单消息列表
- `POST /v5/p2p/order/message/send` - 发送订单消息
- `POST /v5/p2p/order/pay` - 标记已支付
- `POST /v5/p2p/order/finish` - 完成订单

### 文件上传
- `POST /v5/p2p/oss/upload_file` - 上传文件

## 11. Broker（经纪商）- Private

### 账户管理
- `GET /v5/broker/account-info` - 账户信息
- `GET /v5/broker/earnings-info` - 收益信息
- `GET /v5/broker/asset/query-sub-member-deposit-record` - 查询子账户充值记录

### 奖励管理
- `GET /v5/broker/award/info` - 奖励信息
- `GET /v5/broker/award/distribution-record` - 奖励分配记录
- `POST /v5/broker/award/distribute-award` - 分配奖励

## 12. User（用户管理）- Private

### 子账户管理
- `GET /v5/user/query-sub-members` - 查询子账户
- `GET /v5/user/submembers` - 子账户列表
- `POST /v5/user/create-sub-member` - 创建子账户
- `POST /v5/user/del-submember` - 删除子账户
- `POST /v5/user/frozen-sub-member` - 冻结子账户
- `GET /v5/user/get-member-type` - 获取成员类型

### API密钥管理
- `GET /v5/user/query-api` - 查询API密钥
- `POST /v5/user/create-sub-api` - 创建子账户API
- `POST /v5/user/update-api` - 更新API密钥
- `POST /v5/user/update-sub-api` - 更新子账户API
- `POST /v5/user/delete-api` - 删除API密钥
- `POST /v5/user/delete-sub-api` - 删除子账户API
- `GET /v5/user/sub-apikeys` - 子账户API密钥列表

### 其他
- `GET /v5/user/aff-customer-info` - 联盟客户信息
- `POST /v5/user/create-demo-member` - 创建模拟账户

## 13. Pre-Upgrade（升级前数据）- Private

- `GET /v5/pre-upgrade/order/history` - 历史订单
- `GET /v5/pre-upgrade/execution/list` - 成交记录
- `GET /v5/pre-upgrade/position/closed-pnl` - 已平仓盈亏
- `GET /v5/pre-upgrade/account/transaction-log` - 交易日志
- `GET /v5/pre-upgrade/asset/delivery-record` - 交割记录
- `GET /v5/pre-upgrade/asset/settlement-record` - 结算记录

## 14. System & Utilities（系统工具）

### 系统状态
- `GET /v5/system/status` - 系统状态

### API限流
- `GET /v5/apilimit/query` - 查询API限流
- `GET /v5/apilimit/query-all` - 查询全部API限流
- `GET /v5/apilimit/query-cap` - 查询API限流上限
- `POST /v5/apilimit/set` - 设置API限流

### 其他
- `GET /v5/fiat/query-coin-list` - 查询法币交易对
- `GET /v5/affiliate/aff-user-list` - 联盟用户列表

## 统计

- **总计 API 端点**: 247+
- **GET 请求**: ~160
- **POST 请求**: ~87
- **主要模块**: 14个
- **子模块**: 30+

## 迁移注意事项

1. **优先级**: 按使用频率优先实现 Market、Trading、Position、Account 模块
2. **认证**: Private 端点需要 HMAC-SHA256 或 RSA 签名
3. **限流**: 注意每个端点的限流规则
4. **参数验证**: Go 实现时需要严格验证必填/可选参数
5. **错误处理**: 统一错误响应格式
6. **类型定义**: 为每个请求/响应定义对应的 Go struct
