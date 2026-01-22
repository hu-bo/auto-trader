# Auto Trader – Unified Architecture Design（量化交易平台统一架构）

> 设计视角：  
> - 系统工程：稳定性 / 可维护性 / 可演进 / 可观测  
> - 量化交易：回测一致性 / 风控闭环 / 执行可审计  

本文件是“目标架构”与“落地约束”的统一说明，用于指导 `apps/*`、`packages/*` 的实现与接口边界。

---

## 1. 核心目标（对标成熟量化框架的关键经验）

1. **Backtest ↔ Live 一致性（Parity）**：同一策略逻辑尽量复用同一套事件/执行语义，减少“回测好看、实盘崩溃”的系统性偏差。  
2. **端到端可审计（Auditability）**：从行情 → 信号 → 风控决策 → 下单 → 成交 → 持仓变化，全链路可回放。  
3. **强约束的契约（Contracts First）**：跨语言/跨服务以 Protobuf 为唯一真源，Schema 版本化。  
4. **幂等与可恢复（Idempotent & Recoverable）**：交易类系统默认会重试、会断连、会重复消息；设计必须“重放安全”。  
5. **分层解耦（Alpha/Risk/Portfolio/Execution）**：策略产出 Alpha 信号；组合层做仓位/风险预算；执行层做订单与交易所差异；风控贯穿全链路。  

---

## 2. 系统分层与职责边界

- **Data Plane（数据面）**：行情接入、归一化、K 线/逐笔/盘口的统一表达与存储。  
- **Decision Plane（决策面 / Strategy Engine）**：策略计算、信号生成、回测/仿真、策略生命周期管理。  
- **Execution Plane（执行面 / Trading Engine）**：OMS/仓位/账户、交易所适配、撮合结果同步、对账与重连。  
- **Risk Plane（风控面 / Risk Engine）**：前置风控（pre-trade）、事中风控（in-flight）、事后风控（post-trade）、熔断/杀开关。  
- **Control Plane（控制面 / User + Admin）**：用户、权限、配置、可视化、审计与运维工具。  

> 关键边界：Strategy Engine 不直接触达交易所；所有订单必须经过 Trading Engine（以及 Risk Engine）。

---

## 3. 关键链路（事件驱动的“单向流水线”）

### 3.1 实盘交易链路
```
Market Data → Strategy Engine → Signal → (NATS) → Trading Engine → (Risk) → Exchange
                                                  ↓
                                            Order/Fill Events
                                                  ↓
                                        Position/Account Updates
                                                  ↓
                                           Admin/Monitoring
```

### 3.2 回测/仿真链路（建议同语义不同数据源）
```
Historical Data → Backtest Runner → Strategy Logic → Signal → Simulated Execution → Metrics/Report
```

落地要点：
- 回测执行器必须模拟：手续费、滑点、撮合延迟、部分成交、最小下单量、价格精度、资金冻结、撤单失败等“真实交易摩擦”。  
- 统一产出“订单事件/成交事件/仓位事件”，确保回测结果可与实盘同构对齐。  

---

## 4. 消息总线（NATS）设计建议

### 4.1 主题命名与版本
- `md.v1.candle.{exchange}.{symbol}.{interval}`（K 线）
- `sig.v1.signal.{strategyId}`（策略信号）
- `ord.v1.command.{accountId}`（下单指令）
- `ord.v1.event.{accountId}`（订单事件）
- `pos.v1.event.{accountId}`（仓位事件）
- `risk.v1.decision.{accountId}`（风控决策/拒绝原因）

### 4.2 统一消息信封（Envelope）
建议所有消息统一包含（字段名仅示例）：
- `event_id`：全局唯一（用于幂等/去重）
- `trace_id`：链路追踪
- `ts`：事件时间（来源时间 + 接收时间）
- `schema_version`：Schema 版本
- `producer`：生产者服务/实例

> 幂等底线：Trading Engine 对“下单指令”必须支持 `client_order_id`/`idempotency_key` 去重，避免重复下单。

---

## 5. 风控体系（大胆但务实的“多层闸门”）

### 5.1 Pre-trade（交易前）
- 单笔额度/数量/名义价值限制
- 账户/策略维度的最大杠杆、最大净敞口、最大单边敞口
- 频率限制（每秒下单/撤单上限）、交易所限频预算
- 黑白名单：symbol/exchange/时段

### 5.2 In-flight（事中）
- 未成交订单数上限、挂单总名义上限
- 价格偏离保护（相对 mid/mark/index 的偏离阈值）
- 交易所连接状态与撮合回执超时

### 5.3 Post-trade（事后）
- 仓位/资金一致性校验（reconciliation）
- 异常成交（极端价格/异常滑点）告警与回滚预案
- 按策略/账户的回撤、PnL 触发的动态降频/停机（kill switch）

---

## 6. 执行层（Trading Engine）建议升级点

1. **OMS 事件化**：订单状态变更以事件追加（append-only）形式记录，便于回放与审计。  
2. **对账循环（Reconciliation Loop）**：周期性从交易所拉取 open orders / fills / balances，与本地状态对齐。  
3. **适配器分层**：  
   - REST：下单、撤单、查询  
   - WS：行情/订单回执推送  
   - Normalizer：把交易所差异转换为统一 contract  
4. **降级策略**：WS 断连时自动切换到 REST 轮询补偿；限频触发时按优先级丢弃非关键请求。  

---

## 7. 策略层（Strategy Engine）建议升级点

- **策略隔离**：每个策略实例独立状态（内存/缓存 key 空间隔离），避免串扰。  
- **冷启动与预热**：策略启动时先拉取足够历史窗口，确保指标初始化一致。  
- **时间语义统一**：明确使用 `event_time`（行情时间） vs `process_time`（处理时间），回测以 `event_time` 驱动。  
- **可复现运行（Deterministic Mode）**：回测/仿真默认固定随机种子、固定撮合规则，输出可复现。  

---

## 8. 前端（Admin）图表约束：只用 klinecharts

要求：**不使用 ECharts**。K 线与交易标记采用 `klinecharts`，并封装出接近 `@klinecharts/pro` 的“专业 K 线组件效果”。

建议封装组件（命名仅建议）：
- `KLinePro`：统一承载 K 线、指标、交易标记、快捷交互（缩放/拖动/十字线/区间测量）。  
- 数据适配层：把后端的 candle/indicator/trade-marker 数据转换成 klinecharts 所需结构，保证 UI 不直接依赖后端细节。  

功能清单（优先级从高到低）：
1. 多周期切换（1m/5m/1h/1d），增量更新（append/update last candle）  
2. 指标：MA/EMA/RSI/MACD（支持开关与参数）  
3. 标记：下单/成交/止损止盈/风控拒单原因（tooltip 展示）  
4. 主题：深色/浅色 + 交易所常见配色（涨跌色）  

---

## 9. 单仓（Monorepo）结构（目标态）

```
auto-trader/
├── apps/                       # 可部署单元
│   ├── strategy-engine/        # 决策层服务（Python）
│   ├── trading-engine/         # 执行层服务（Node.js）
│   ├── user-service/           # 用户 & 配置管理（Node.js）
│   └── admin-service/          # 管理后台（Node.js + Web）
│
├── packages/                   # 共享能力（强约束）
│   ├── contracts/              # 核心数据结构 & 协议（Protobuf）
│   │   ├── proto/              # 唯一真源（schema versioning）
│   │   ├── generated/          # 不可编辑，由生成脚本产出
│   │   └── gen.sh              # 生成脚本（ts/python/rust/...）
│   ├── risk-engine/            # 风控规则库/引擎（前置）
│   ├── hquant-py/              # 组合、仓位、资金模型（Python）
│   └── hquant-rust/            # 指标库（Rust，纯函数）
│
└── docs/                       # 架构与设计文档
```

> 说明：`infra/`、`storage/`、`message-bus/` 等可作为“环境侧能力”存在，不一定要和业务代码同仓实现，但需要在文档与部署编排里明确依赖与责任边界。
