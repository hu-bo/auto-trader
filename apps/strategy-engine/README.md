# Strategy Engine - 策略引擎

## 概述

策略引擎是量化交易系统的核心计算层，负责：
- 接收实时市场数据
- 运行量化交易策略
- 生成交易信号发布
- 策略回测与优化
- 指标计算与分析

## 技术栈

| 类别 | 技术 | 说明 |
|------|------|------|
| 语言 | Python 3.11+ | 主要开发语言 |
| Web 框架 | FastAPI | 异步 HTTP 服务 |
| 消息队列 | NATS | 实时信号发布 |
| 消息队列| NATS | 接收实时数据(原始k线) |
| 数据库 | PostgreSQL | 策略/回测数据存储 |
| 量化库 | hquant-py | 技术指标计算 (Rust 绑定) |
| 认证 | Casdoor SDK | 统一身份认证 |

## NATS 消息主题

### 订阅主题

| 主题 | 说明 | 数据格式 |
|------|------|----------|
| `{prefix}.candle.{exchange}.{tradeType}.{symbol}.{period}` | K 线更新 | `exchange.candle.binance.spot.BTC-USDT.15m` |
| `{prefix}.orderbook.{exchange}.{tradeType}.{symbol}` | 订单簿更新 | `exchange.orderbook.okx.futures.ETH-USDT` |

### 发布主题

| 主题 | 说明 | 数据格式 |
|------|------|----------|
| `strategy.signals.{symbol}.{tradeType}` | 交易信号 | Signal |

## 参考文档

- [FastAPI 文档](https://fastapi.tiangolo.com/)
- [Celery 文档](https://docs.celeryq.dev/)
- [NATS 文档](https://docs.nats.io/)
- [hquant-py 文档](../packages/hquant-py/README.md)
- [接收实时数据nats源码](E:\Project\my-project\app-golang\apps\exchange-sync\internal\publisher\nats.go， )
- [接收实时数据nats](../docs/exchange-nats.md)
---