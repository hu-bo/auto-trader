# Quant Trading Platform – Unified Architecture Design

> 角色视角：  
> - 资深系统工程师（稳定性 / 可维护性 / 可演进）  
> - 专业量化交易员（回测 / 风控 / 策略）  

## 2. 单仓（Monorepo）结构

├── apps/                    # 可部署单元
│   ├── strategy-engine/     # 决策层服务（Python）
│   ├── trading-engine/      # 交易服务（Node.js）
│   ├── user-service/        # 用户 & 配置管理（Node.js）
│   └── admin-service/       # 管理后台（Node.js）
│
├── packages/                # 共享能力（强约束）
│   ├── contracts/           # 核心数据结构 & 协议
│   │   ├── proto/           # 唯一真源
│   │   │   ├── signal.proto
│   │   │   ├── order.proto
│   │   │   ├── position.proto
│   │   │   ├── account.proto
│   │   │   └── risk.proto
│   │   ├── generated/        # 不可编辑由gen.sh生成
│   │   │   ├── ts/
│   │   │   ├── python/
│   │   │   ├── rust/
│   │   │   └── go/
│   │   └── gen.sh           # proto生成类型(ts-proto、ts-proto、prost-types)
│   ├── risk-engine/         # 风控规则（前置）(nodejs)
│   ├── hquant-py/           # 组合 & 仓位模型
│   └── hquant-rust/         # 指标库（纯函数）
│
├── infra/                   # 基础设施
│   ├── exchange-adapters/   # 各交易所适配
│   ├── message-bus/         # NATS(已有不用实现)
│   └── storage/             # DB / Object Storage(已有不用实现)
│
├── logs/
│   ├── strategy.log  
│   ├── strategy.err  
│   ├── trading.log  
│   ├── trading.err  
│   ├── user.log  
│   ├── user.err  
│   └── admin.log
│   └── admin.err
└── docs/