# 项目结构总览

> 说明：本文档描述的是“目标目录结构”（用于指导实现与拆分模块）。

## 目录结构

```
auto-trader/
├── apps/                                    # 可部署单元
│   ├── strategy-engine/                     # 策略引擎 (Python)
│   │   │   ├── docker-compose.yml           # docker部署
│   │   │   └── .drone.yml                   # drone CI/CD部署
│   ├── exchange-service/                    # 交易下单服务 (midwayjs)
│   │   │   ├── docker-compose.yml           # docker部署
│   │   │   └── .drone.yml                   # drone CI/CD部署
│   ├── trader-service/                      # 用户交易服务 + 后台管理服务 (midwayjs)
│   │   │   ├── docker-compose.yml           # docker部署
│   │   │   └── .drone.yml                   # drone CI/CD部署
│   └── trader-web/                          # 用户交易 + 后台管理 (React, semi , vite)
│   │   │   ├── dist                         # 无需docker，nginx配置路径
│   │   │   └── .drone.yml                   # drone CI/CD部署
│
├── packages/                                # 共享能力
│   ├── contracts/                           # 核心数据结构 & 协议
│   │   ├── proto/                           # Protobuf 定义 (唯一真源)
│   │   ├── generated/                       # 生成的类型 (不可编辑)
│   │   │   ├── ts/                          # TypeScript 类型
│   │   │   ├── python/                      # Python 类型
│   │   │   ├── rust/                        # Rust 类型
│   │   │   └── go/                          # Go 类型
│   │   └── gen.sh                           # Proto 生成脚本
│   ├── hquant-adapters/                     # 交易所适配（抹平下单接口参数差异）
│   ├── klinecharts-pro/                     # 基于klinecharts封装完成的图表库，参考 https://github.com/klinecharts/pro (@klinecharts/pro过于封闭，所以需要自定义)
│   ├── hquant-py/                           # 对hquant-rust的封装
│   └── hquant-rust/                         # 量化库：包含各种指标 (Rust)
│       ├── src/
│       │   ├── lib.rs                       # 库入口
│       │   ├── indicators/                  # 技术指标
│       │   └── utils/                       # 工具类
│       ├── tests/                           # 测试
│       ├── Cargo.toml
│       └── Cargo.lock
├── logs/                                    # 日志文件
│   ├── strategy.log                         # 策略引擎日志
│   ├── strategy.err                         # 策略引擎错误日志
│   ├── exchange-service.log                 # 交易引擎日志
│   ├── exchange-service.err                 # 交易引擎错误日志
│   ├── trader-service.log                   # 用户交易服务日志
│   ├── trader-service.err                   # 用户服务错误日志
│
├── docs/                                    # 文档
├── infra/                                   # 基架
│   ├── docker-compose.dev.yml               # 项目结构文档
│   ├── docker-compose.dev.yml               # 部署文档
│   └── DEVELOPMENT.md                       # 开发文档
├── .env.example                             # 环境变量模板
├── .gitignore
├── LICENSE
└── README.md                                # 项目总介绍 + dev启动说明 + 各模块功能
```

## 核心数据流

### 1. 实时交易流
```
市场数据 (NATS) → strategy-engine → 信号生成 → NATS → exchange-service → 风控检查 → trader-service → 订单执行 → 仓位更新 → NATS → 用户通知
```

### 2. 回测流
```
历史数据 → hquant-py → 策略回测 → 指标计算 → 结果存储 → 报表生成 → 用户查看
```

### 3. 用户流
```
用户登录 → trader-service → 认证授权（casdoor-react-sdk） → 绑定策略 + 配置风控 → 策略启动 → 信号订阅 → 交易执行
```

### 4. 管理流
```
trader-web + strategy-engine → 策略管理 → 添加/删除/编辑策略 → 风控管理 → 策略收益统计(收益率，买交易次数，卖交易次数)
```

## 安全架构

### 1. 认证授权（统一casdoor）
- python `from casdoor import CasdoorSDK`
- nodejs `import { SDK } from 'casdoor-nodejs-sdk';`

### 2. 数据安全
- 数据库加密(用户的交易所密钥、密码)
- 传输加密 (HTTPS)

## 性能优化

### 1. 数据库优化
- 索引优化

### 3. 并发处理
- 异步处理
- 多进程/多线程
- 消息队列

### 4. 资源管理
- 连接池
- 内存管理（循环队列、列式（SoA）内存模型）
- CPU 优化
- 磁盘 I/O

## 参考文档
- [部署文档](DEPLOYMENT.md)
- [策略引擎文档](apps/strategy-engine/README.md)
- [交易服务文档](apps/exchange-service/README.md)
- [平台服务文档](apps/trader-service/README.md)
- [平台前端文档](apps/trader-web/README.md)
---

**版本**: 1.0.0
**最后更新**: 2026-01-22
**维护者**: 量化团队
