RiskEngine 技术方案设计（基于最终配置）
1. 设计目标

构建一个 可插拔、可回放、可解释 的风险控制引擎，满足：

账户级：一票否决，系统级硬闸门

仓位级：可减仓 / 可平仓 / 有时间约束

品种级：覆盖默认规则

多市场：futures / delivery / spot 统一抽象

与策略引擎解耦，仅输出 RiskDecision

2. 风险配置（最终版本，作为事实来源）
{
  // =========================
  // 账户级风险（全局硬闸门）
  // =========================
  "account": {
    // 单日最大亏损（USDT）
    "maxDailyLoss": 500,

    // 最大保证金使用率
    "maxMarginUsagePct": 0.8,

    // 账户级越界行为
    "onBreach": "BLOCK_TRADING"
    // BLOCK_TRADING | CLOSE_ALL
  },

  // =========================
  // 仓位级风险（默认规则）
  // =========================
  "position": {
    // 基于 margin 的盈亏率
    "stopProfitPct": 1.5,
    "stopLossPct": 0.8,

    // 单仓最大亏损（USDT）
    "maxLossPerPosition": 200,

    // 仓位级越界行为
    // CLOSE_POSITION | REDUCE_POSITION
    "onBreach": "CLOSE_POSITION",

    // 风控冷却时间
    "cooldown": "15m"
  },

  // =========================
  // 品种级覆盖
  // =========================
  "symbols": {
    "BTCUSDT": {
      "position": {
        "stopProfitPct": 2.0,
        "stopLossPct": 1.0,
        "onBreach": "CLOSE_POSITION",
        "cooldown": "15m"
      }
    },
    "ETHUSDT": {
      "position": {
        "stopProfitPct": 1.2,
        "stopLossPct": 0.6,
        "onBreach": "REDUCE_POSITION",
        "reduceRatio": 0.5,
        "cooldown": "15m"
      }
    }
  }
}

3. 系统总体架构
┌──────────────────────────────┐
│        Market Data           │
└──────────────┬───────────────┘
               ↓
┌──────────────────────────────┐
│     Position Snapshot        │
│  (PnL / Margin / Exposure)   │
└──────────────┬───────────────┘
               ↓
┌──────────────────────────────┐
│         RiskEngine           │
│                              │
│  1. AccountRiskEvaluator     │
│  2. SymbolRiskEvaluator      │
│  3. PositionRiskEvaluator    │
│                              │
└──────────────┬───────────────┘
               ↓
┌──────────────────────────────┐
│       RiskDecision           │
│ (BLOCK / CLOSE / REDUCE ...) │
└──────────────┬───────────────┘
               ↓
┌──────────────────────────────┐
│     Execution / Strategy     │
└──────────────────────────────┘

4. 核心抽象设计
4.1 风控输入（RiskContext）
interface RiskContext {
  now: number;

  account: {
    equity: number;
    dailyPnl: number;
    marginUsed: number;
    marginAvailable: number;
  };

  positions: PositionSnapshot[];
}

4.2 统一仓位抽象（跨 futures / delivery / spot）
interface PositionSnapshot {
  symbol: string;
  market: "FUTURES" | "DELIVERY" | "SPOT";

  side: "LONG" | "SHORT";

  qty: number;
  entryPrice: number;
  markPrice: number;

  marginUsed: number;
  unrealizedPnl: number;
}

5. RiskEngine 执行顺序（非常重要）
固定顺序，不可更改
1️⃣ Account Risk
2️⃣ Symbol Override Resolution
3️⃣ Position Risk

原因

account 是 系统级硬闸门

position 风控不允许在账户已死亡时执行

6. Account 风控设计
6.1 判定条件
if (dailyPnl <= -maxDailyLoss)
if (marginUsed / equity >= maxMarginUsagePct)

6.2 行为映射
onBreach:
  BLOCK_TRADING → 禁止新开仓，仅允许平仓
  CLOSE_ALL     → 平掉所有仓位

6.3 特点（设计约束）

不需要 cooldown

不允许 REDUCE

一次触发即生效

7. Position / Symbol 风控设计
7.1 规则解析顺序
symbol.position 覆盖 > 全局 position 默认

7.2 止盈 / 止损计算方式
盈亏率（基于 margin）
pnlPct = unrealizedPnl / marginUsed


触发条件：

pnlPct >= stopProfitPct
pnlPct <= -stopLossPct

7.3 cooldown 语义
字段	语义
cooldown	减仓后冷却时间，禁止再次触发
7.4 风控状态存储（必须）
interface RiskState {
  lastBreachAt: number;
}

if (now - lastBreachAt < windowDuration) {
  skip();
}

8. REDUCE_POSITION 的执行策略（关键）
8.1 选择减仓目标（排序优先级）
1. unrealizedPnl 最差
2. marginUsed 最大
3. leverage 最大

8.2 减仓数量
reduceQty = qty * reduceRatio

9. RiskDecision 输出（引擎唯一职责）
interface RiskDecision {
  level: "ACCOUNT" | "POSITION";
  symbol?: string;

  action:
    | "BLOCK_TRADING"
    | "CLOSE_ALL"
    | "CLOSE_POSITION"
    | "REDUCE_POSITION";

  params?: {
    reduceRatio?: number;
  };

  reason: string;
}


RiskEngine 不直接下单，只产出决策

10. 可回放与审计（强烈建议）
每一次评估都记录：
{
  timestamp,
  inputSnapshot,
  triggeredRule,
  decision
}