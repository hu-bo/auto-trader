# Exchange Service - 交易下单服务

## 概述

交易下单服务是量化交易系统的订单执行层，负责：
- 接收策略引擎的交易信号
- 风控前置检查
- 交易所订单路由与执行
- 订单状态同步(如果未成交需要利用exchange-adapter ws监听order)
- 仓位与资金管理

## 技术栈

| 类别 | 技术 | 说明 |
|------|------|------|
| 语言 | Node.js 20+ | 运行环境 |
| 框架 | Koa 3.0  | 配合zod 校验参数 |
| 数据库 | PostgreSQL | 订单/仓位数据存储（使用typeORM） |
| 交易所 | hquant-adapters | 交易所统一适配层 |

## 参考依赖(本项目的核心)
交易核心sdk： /Users/hubo/Work/Coding/MyProject/auto-trader/packages/exchange-adapter
exchange-adapter 使用案例： /Users/hubo/Work/Coding/MyProject/auto-trader/packages/exchange-adapter/example
风险模型：/Users/hubo/Work/Coding/MyProject/auto-trader/packages/risk-model
ps: 本项目的核心就是把 exchange-adapter 变成服务

## 数据库
db: trader 
user: trader_user 
pass_word: 123456

## 流程

应用服务 -> 提供交易所账户密钥 -> Exchange Service 初始化(同时缓存到redis) -> 返回token

下单 -> token + 下单参数 -> 去内存缓存找到实例 

当前服务重启 ->  redis 读取配置 初始化sdk实例

## 安全
提供token鉴权
对应用服务都提供一个接口用于生成一个token，每个接口调用都需要用token

# 通信
grpc-node