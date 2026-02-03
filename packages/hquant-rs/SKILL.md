---
name: hquant-rs
description: Work on the hquant Rust quant engine and its Node.js (@hquant/js) and Python (hquant) bindings, including building FFI artifacts, writing DSL strategies, multi-period aggregation/feed-bar flows, backtests, and e2e tests/docs in packages/hquant-rs, packages/hquant-js, and packages/hquant-py.
---

# hquant-rs 使用说明书（Rust + Node + Python）

本 Skill 仅包含使用说明（不包含实现细节），用于在本仓库内快速完成：构建、运行、封装与 e2e 验证。

## 目录速览

- Rust 核心：`packages/hquant-rs/src`
  - `src/hquant.rs`: 单周期引擎 `HQuant`
  - `src/multi.rs`: 多周期引擎 `MultiHQuant`（支持 `@<period>`）
  - `src/dsl/`: DSL 解析与执行
  - `src/aggregator.rs`: 多周期 K 线聚合器 `Aggregator`
  - `src/backtest/`: 现货/合约回测
  - `src/ffi/node.rs`: Node (napi-rs) 绑定
  - `src/ffi/python.rs`: Python (PyO3) 绑定
- Node 包：`packages/hquant-js`
  - e2e：`packages/hquant-js/__test__/e2e.test.ts`
- Python 包：`packages/hquant-py`
  - Python API：`packages/hquant-py/python/hquant/__init__.py`
  - e2e：`packages/hquant-py/test_e2e.py`

## 构建与运行（常用）

### Rust（仅核心）

```bash
cd packages/hquant-rs
cargo test
```

### Node（@hquant/js）

1) 构建 native addon（两种方式任选其一）

```bash
cd packages/hquant-rs
cargo build --release --features ffi-node

# macOS
cp target/release/libhquant.dylib ../hquant-js/native/hquant.node
# Linux
cp target/release/libhquant.so ../hquant-js/native/hquant.node
```

2) 运行 e2e

```bash
cd packages/hquant-js
npm test
```

> 注意：`ffi-node` 与 `ffi-python` 不能同时启用（见 `packages/hquant-rs/src/lib.rs`）。

### Python（hquant）

1) 构建/安装开发版（maturin）

```bash
cd packages/hquant-py
maturin develop --features ffi-python
```

2) 运行 e2e

```bash
cd packages/hquant-py
pytest -q test_e2e.py
```

## 多周期（feed_bar 流）

多周期有两种常用方式：

- **方式 A（推荐：多周期 DSL）**：`MultiHQuant`
  - Node：`MultiHQuant`
  - Python：`MultiHQuant`
  - 适用：需要在 DSL 里使用 `close@4h` 这种跨周期引用（`addMultiStrategy/add_multi_strategy`）
- **方式 B（聚合器 + 单周期引擎）**：`KlineAggregator/Aggregator` + `HQuant`
  - 适用：只想拿到聚合后的 K 线事件、或者策略只跑在单一周期，上层自行组织

典型流程：

1) base 周期 bar 喂给 `MultiHQuant.feedBar/feed_bar`（内部会完成多周期聚合与路由）；
2) `MultiHQuant.pollSignals/poll_signals` 拉取信号；
3) 将信号喂给回测器或真实下单逻辑（合约回测推荐 `FuturesBacktest`）。

> `period` 字符串可能是 `15m/1h` 或 `M15/H1`（取决于 native 模块版本）；e2e 测试里对两种格式都做了兼容。

## 组合策略

组合策略指：同一引擎中注册多个策略（多个 `addStrategy/add_strategy`），在同一 bar 流下产生不同信号，再统一在上层处理。

- Node：`HQuant.addStrategy(...)`，`HQuant.pollSignals()`
- Python：`HQuant.add_strategy(...)`，`HQuant.poll_signals()`

## 回测

- 现货/简化回测：
  - Node：`Backtest`
  - Python：`Backtest`（对应 Rust `PyBacktest`）
- 合约回测（含简化爆仓逻辑）：
  - Node：`FuturesBacktest`
  - Python：`FuturesBacktest`

最小回测驱动方式（伪代码）：

1) bar → 引擎 → signals
2) `BUY` → `open_position/openPosition`
3) `SELL` → `close_position/closePosition`
4) `result()/backtest_result()` 获取统计

## DSL 快速记忆

- 每条规则一行：`IF <条件> THEN BUY|SELL|HOLD`
- 变量：`LET v = <表达式>`
- 支持：`AND/OR/NOT`、比较运算、括号
- 指标/函数：`RSI/SMA/EMA/STDDEV/MACD/BOLL/NORMALIZE/SIMILARITY/VEC_STORE`
- `@<period>`：在 `MultiHQuant` 下可用（Rust/Node/Python），例如 `close@4h`；单周期 `HQuant` 会拒绝带 `@` 的字段引用。

## DSL 语法特性总览

### 完整语法参考表

| 类别 | 特性 | 语法示例 | 说明 |
|------|------|---------|------|
| **变量定义** | LET | `LET rsi = RSI(14)` | 定义可复用的中间变量 |
| **字段引用** | 基础字段 | `open`, `high`, `low`, `close`, `volume`, `buy_volume` | 6种 Bar 字段 |
| **多周期** | @period 后缀 | `close@4h`, `high@1d`, `volume@15m` | 仅在 MultiHQuant 中可用 |
| **指标函数** | RSI | `RSI(14)` | 相对强弱指标 |
| | | `RSI(close@4h, 14)` | 指定字段和周期（多周期） |
| | | `RSI(close, period=14)` | 使用关键字参数 |
| | SMA | `SMA(20)` | 简单移动平均（默认 close） |
| | | `SMA(close, 20)` | 显式指定字段 |
| | | `SMA(close@4h, 50)` | 多周期 SMA |
| | EMA | `EMA(close, 12)` | 指数移动平均 |
| | | `EMA(close@4h, period=26)` | 关键字参数 |
| | STDDEV | `STDDEV(close, 20)` | 标准差（波动率） |
| | | `STDDEV(close@4h, 20)` | 多周期标准差 |
| **归一化** | NORMALIZE | `NORMALIZE(close, 30)` | MinMax 归一化（默认） |
| | 归一化方法 | `NORMALIZE(close, 30, method="minmax")` | MinMax: [0, 1] |
| | | `NORMALIZE(close, 30, method="zscore")` | ZScore: μ=0, σ=1 |
| | | `NORMALIZE(close, 30, method="l2")` | L2 单位向量归一化 |
| | | `NORMALIZE(close@4h, 50, method="zscore")` | 多周期归一化 |
| **相似度** | SIMILARITY | `SIMILARITY("store", NORMALIZE(close, 30))` | 余弦相似度（默认） |
| | 相似度方法 | `method="cosine"` | 余弦相似度 [-1, 1] |
| | | `method="pearson"` 或 `"corr"` | Pearson 相关系数 |
| | | `method="euclidean"` 或 `"l2"` | 欧氏距离（越小越相似） |
| | | `method="manhattan"` 或 `"l1"` | 曼哈顿距离 |
| | | `method="chebyshev"` | 切比雪夫距离 |
| | 阈值 | `threshold=0.8` | 可选阈值参数 |
| | VEC_STORE | `VEC_STORE("name")` | 向量存储引用 |
| **比较运算符** | 小于 | `<` | `rsi < 30` |
| | 小于等于 | `<=` | `close <= sma` |
| | 大于 | `>` | `rsi > 70` |
| | 大于等于 | `>=` | `close >= 50000` |
| | 等于 | `==` | `volume == 0` |
| | 不等于 | `!=` | `buy_volume != 0` |
| **逻辑运算符** | AND | `AND` | `rsi < 30 AND volume > 1000` |
| | OR | `OR` | `rsi > 70 OR close < sma` |
| | NOT | `NOT` 或 `!` | `NOT (close < sma)` 或 `!(rsi > 50)` |
| | 括号分组 | `(...)` | `(a OR b) AND c` |
| **动作** | 买入 | `BUY` | `THEN BUY` |
| | 卖出 | `SELL` | `THEN SELL` |
| | 持有 | `HOLD` | `THEN HOLD` |
| | 元数据 | `BUY(description)` | `BUY(oversold RSI signal)` |
| **注释** | # 注释 | `# this is a comment` | 井号注释 |
| | // 注释 | `// this is also a comment` | 双斜杠注释 |

### 函数参数格式

#### 位置参数 vs 关键字参数

```python
# RSI - 支持以下格式
RSI(14)                    # 位置参数：period
RSI(close, 14)            # 位置参数：field, period
RSI(close@4h, 14)         # 多周期
RSI(period=14)            # 关键字参数
RSI(close, period=14)     # 混合

# SMA/EMA/STDDEV - 类似格式
SMA(20)                   # 默认 close 字段
SMA(close, 20)
SMA(high@1d, 50)
EMA(close, period=12)

# NORMALIZE
NORMALIZE(close, 30)                        # field, length
NORMALIZE(close, 30, method="zscore")       # 指定归一化方法
NORMALIZE(close@4h, length=50, method="l2") # 关键字参数

# SIMILARITY
SIMILARITY("store_name", NORMALIZE(close, 30))                    # 基础用法
SIMILARITY("store", NORMALIZE(close, 30), method="pearson")       # 指定方法
SIMILARITY(VEC_STORE("store"), vector, method="cosine", threshold=0.85)  # 完整参数
```

### 多周期语法示例

```python
# 仅在 MultiHQuant 中可用
# 周期格式：1m, 5m, 15m, 1h, 4h, 1d 等

LET rsi_1h = RSI(14)              # 基础周期（构造时指定）
LET rsi_4h = RSI(close@4h, 14)   # 4小时周期
LET sma_1d = SMA(close@1d, 50)   # 1天周期

# 跨周期条件
IF rsi_1h < 30 AND rsi_4h < 40 AND close > sma_1d THEN BUY

# 多周期突破
IF close > high@4h AND volume > volume@4h THEN BUY(breakout)
```

### 形态识别示例

```python
# 1. 加载向量存储（Rust/Node/Python API）
multi.load_store("patterns", [
    {"label": 1.0, "vector": [0.1, 0.2, 0.5, 0.8]},   # 看涨
    {"label": -1.0, "vector": [0.8, 0.5, 0.2, 0.1]}   # 看跌
])

# 2. DSL 中使用
LET pattern = SIMILARITY(
    "patterns",
    NORMALIZE(close, 30, method="zscore"),
    method="cosine",
    threshold=0.85
)

IF pattern >= 0.9 THEN BUY(bullish pattern detected)
```

### 完整策略示例

详见 [example.rs](./example.rs) - 包含所有语法特性的综合示例。
