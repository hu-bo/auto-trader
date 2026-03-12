---
name: okx-trading-guide
description: OKX 交易接口开发指南，包括下单参数、交易模式、持仓方向、订单类型等完整规则。当你需要构建 OKX 下单请求、处理订单参数或理解交易规则时，请使用此技能。
---

# OKX 交易开发指南

## 文件说明

### TRADER_ORDER.md

**内容**：OKX 下单接口关键参数的完整说明。

**包含**：
- `tdMode`：各账户模式（现货/合约/跨币种保证金/组合保证金）下的交易模式取值
- `clOrdId`：客户自定义订单 ID 的使用规则
- `posSide`：买卖模式与开平仓模式下的持仓方向及 side/posSide 组合规则
- `ordType`：普通委托（limit/market）和高级委托（post_only/fok/ioc/optimal_limit_ioc）说明
- `sz`：不同场景下交易数量的含义
- `reduceOnly`：只减仓的适用范围和限制规则
- `tgtCcy`：币币市价单委托数量单位及注意事项
- `px`：期权委托价格的取整规则
- 附带止盈止损：分批止盈的完整规则和错误码
- `stpMode`：强制自成交保护的三种模式
- `tradeQuoteCcy`：特定地区用户必填字段
- 订单限速规则

**何时使用**：构建下单请求、排查参数错误、理解各字段约束时。

## 快速导航

| 需求 | 查看 |
|------|------|
| 下单参数完整规则 | [TRADER_ORDER.md](TRADER_ORDER.md) |
