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
