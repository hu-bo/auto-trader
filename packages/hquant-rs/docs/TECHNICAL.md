# hquant-rs 技术文档（面向 LLM Agent）

## 1. 项目定位与边界

`hquant` 是一个高性能量化计算内核（Rust），核心关注：

- K线/行情序列的**列式（SoA）+ 固定容量环形缓冲区**存储
- 指标库（MA/RSI/MACD/ATR/BOLL/VRI + 部分动态指标）与**依赖去重**计算（DAG）
- 策略系统：Rust trait 策略 + DSL（pest 解析 + 解释执行）
- 回测：现货/合约（含简化爆仓逻辑）
- 聚合器：多周期 K线聚合（例如 `M15 -> H4 -> D1`）
- FFI：Node（napi-rs）/ Python（pyo3）

## Package
- crate: `hquant-rs`
- lib name: `hquant_rs`
- features:
  - `ffi-node`: N-API addon (napi-rs)
  - `ffi-python`: PyO3 extension module (+ numpy)
- deps (core): `pest`, `pest_derive`
- optional deps:
  - node: `napi`, `napi-derive`, `napi-sys`, build: `napi-build`
  - python: `pyo3` (`extension-module`), `numpy`
- entry: `packages/hquant-rs/src/lib.rs`


## 2. 目录与模块速览

入口与对外导出：

- `packages/hquant-rs/src/lib.rs`：crate root；对外 `pub use ...`；核心 `QuantEngine`

Module Map:

- `packages/hquant-rs/src/types.rs`: `Bar`, `Field`, `Action`, `Signal`
- `packages/hquant-rs/src/commom/mod.rs`: common
- `packages/hquant-rs/src/commom/circular.rs`: `CircularColumn<T>` fixed-cap ring
- `packages/hquant-rs/src/kline_buffer.rs`: `KlineBuffer` SoA ring of bars
- `packages/hquant-rs/src/indicators/*`：`IndicatorGraph` boll,ema，等指标实现、构建器、图执行与去重
- `packages/hquant-rs/src/strategy/mod.ts`: strategy compile
- `packages/hquant-rs/src/strategy/vector_store.ts`: strategy vector_store
- `packages/hquant-rs/src/dsl/*`：DSL AST / parser / eval
- `packages/hquant-rs/src/hquant.rs`: `HQuant` runtime
- `packages/hquant-rs/src/multi-hquant.rs`: `MultiHQuant` runtime
- `packages/hquant-rs/src/period.rs`: `Period`
- `packages/hquant-rs/src/aggregator.rs`：`Aggregator` multi-period candle aggregation
- `packages/hquant-rs/src/backtest.rs`：`FuturesBacktest` USDM futures backtest
- `packages/hquant-rs/src/ffi/node.rs`: Node addon (feature `ffi-node`)
- `packages/hquant-rs/src/ffi/python.rs`: Python module (feature `ffi-python`)

## 3. Core Types：RingBuffer / KlineSeries

### 3.1 `CircularBuffer<T>`：固定容量环形缓冲区

### `CircularBuffer<T>` (`packages/hquant-rs/src/circular.rs`)
- generic: `T: Copy + Default`
- ring metadata:
  - `capacity: usize` (fixed; `>0`)
  - `len: usize` (`<= capacity`)
  - `head: usize` (next write index into backing storage)
- methods:
  - `new(capacity) -> Self`
  - `capacity()`, `len()`, `is_empty()`, `is_full()`
  - `push(v)` (overwrites oldest when full)
  - `update_last(v)` (no-op if empty)
  - `get(i)` (index from oldest, `0..len`)
  - `get_from_end(i)` (index from newest)
  - `raw_parts() -> (*const T, capacity, len, head)` (order may wrap)
  - `to_vec_ordered() -> Vec<T>` (copy, chronological oldest->newest)
- Iterator trait
注意：

- 由于覆盖语义，超过 `capacity` 的历史不可恢复；任何“全量回放”需要外部保存源数据
- `update_last` 在 `len==0` 时无效（不会插入）

### 3.2 `F64RingBuffer`：带缓存统计量的浮点缓冲区

实现同在 `packages/hquant-rs/src/common/ring_buffer.rs`。

- 在 `push/update_last` 时维护 `sum/sum_sq`，以 O(1) 计算 `mean/variance/std_dev`
- 覆盖最旧元素时会先从缓存中扣除旧值（通过 `inner.get(0)` 获取逻辑最旧值）

### 3.3 `Bar` 与 `KlineSeries`：列式（SoA）时间序列

实现见 `packages/hquant-rs/src/kline.rs`。

`Bar`（输入/输出结构）：

- 字段：`timestamp/open/high/low/close/volume/buy_volume`
- 典型/中位/平均价格：`typical_price/median_price/average_price`

`KlineSeries`（SoA 存储）：

- 每个字段是一条 `RingBuffer` 列：`timestamp/open/high/low/close/volume/buy_volume`
- `append(&Bar)`：逐列 `push`
- `update_last(&Bar)`：逐列 `update_last`
- `get(index)`：按列组装回 `Bar`
- `get_from_end(n)`：从尾部取第 n 个（`n=1` 最新）

设计意图：

- 与 TODO 中“基础数据不可变（append-only）”一致：常规推进用 `append`，实时修正用 `update_last`

## 4. 指标系统：`Indicator` / `IndicatorGraph` / `IndicatorSpec`

### 4.1 `Indicator` trait 与 `IndicatorValue`

定义见 `packages/hquant-rs/src/indicators/mod.rs`。

`Indicator` 的关键约定：

- 状态型对象：内部保存历史（通常用 `F64RingBuffer` 或 `RingBuffer`）
- 两套更新 API：
  - `push(&Bar)`：追加新 bar，对应 `KlineSeries.append`
  - `update_last(&Bar)`：更新最后一个 bar，对应 `KlineSeries.update_last`
- 读取：
  - `value() -> Option<f64>`：当前值
  - `result() -> Option<IndicatorValue>`：可携带 `extra`（例如 BOLL 上下轨、MACD 的 signal/hist）
  - `get/get_from_end/len`：历史访问（供策略/DSL 用）
- 就绪判断：
  - `min_periods()`：最小样本数
  - `is_ready()`：是否可以稳定输出

`IndicatorValue`：

- `value/timestamp/extra`
- `extra: Option<Vec<f64>>` 用于组合指标的附加序列

### 4.2 `PriceType`：指标输入字段选择

定义见 `packages/hquant-rs/src/indicators/mod.rs`：

- `Open/High/Low/Close/Volume/Typical/Median/Average`
- `extract(&Bar) -> f64`：从 bar 取对应输入

### 4.3 两种“注册指标”的方式：Builder vs Spec

#### Builder（不去重）

在 `packages/hquant-rs/src/indicators/builder.rs` 中提供 `MABuilder/RSIBuilder/...`，并在 `lib.rs` 里 re-export 了便捷函数（例如 `ma().period(20).sma()`）。

特点：

- API 友好，构建 `Box<dyn Indicator>`
- 进入 `IndicatorGraph.add_boxed(...)` 时属于 “opaque node”，**不会去重**

#### `IndicatorSpec`（会去重 + 支持组合指标共享依赖）

定义见 `packages/hquant-rs/src/indicators/spec.rs`，并由 `IndicatorGraph.add(...)` 使用：

- `IndicatorSpec` 是可 Hash/Eq 的“指标参数描述”
- `dependencies()` 定义组合指标依赖：  
  - `Macd` 依赖 `Ema(fast)` 与 `Ema(slow)`  
  - `Boll` 依赖 `Sma(period)` 与 `StdDev(period)`
- `F64Key` 用 bit-level hash 解决 `f64` 作为参数的可哈希问题（用于 BOLL 的 std_dev_factor）

### 4.4 `IndicatorGraph`：DAG 去重与拓扑执行

实现见 `packages/hquant-rs/src/indicators/graph.rs`。

核心职责：

- **去重**：`spec_map: HashMap<IndicatorSpec, IndicatorId>`，同 spec 复用同一 node
- **依赖建图**：添加组合 spec 时先递归添加依赖 spec，得到 `deps: Vec<IndicatorId>`
- **拓扑执行**：使用 Kahn 算法计算 `execution_order`

push/update_last 的执行模型（重要）：

- 每次 `push(&Bar)` / `update_last(&Bar)`：
  - 确保拓扑序已计算
  - 按拓扑序遍历 node
  - 对于有依赖的 node：先从 `values[dep]` 收集依赖输出，再调用
    - `indicator.push_with_deps(bar, dep_values)` 或 `update_last_with_deps`
  - 将当前 node 的 `indicator.value()` 缓存到 `values[id]` 供后续依赖使用

组合指标的两种运行模式：

- Graph mode（有 deps）：例如 `MACD::new_graph_mode(...)`、`BOLL::new_graph_mode(...)`
- Standalone mode（无 deps）：例如 `MACD::with_price_type(...)`，内部自己持有子指标

命名访问（alias）：

- `add_with_name(name, spec)` / `add_boxed(name, ...)` 会记录 `aliases[name] = id`
- 策略侧通过 `IndicatorSnapshot.value("name")` / `value_from_end("name", n)` 读取

## 5. 引擎编排：`QuantEngine`

实现见 `packages/hquant-rs/src/lib.rs`。

`QuantEngine` 的核心字段：

- `klines: KlineSeries`
- `graph: IndicatorGraph`
- `strategies: Vec<Box<dyn Strategy>>`（Rust 策略）
- `aggregator: Option<MultiTimeFrameAggregator>`
- `backtest: Option<BacktestEngine>`

关键流程：`append_bar(&Bar) -> Vec<Signal>`

1. `klines.append(bar)`
2. `graph.push(bar)`：指标 DAG 更新
3. `aggregator.push(bar)`（可选）
4. `evaluate_strategies(bar)`：遍历 Rust `Strategy::evaluate(...)`
5. `backtest.process_signal(signal, bar)`（可选）

实时更新：`update_last_bar(&Bar)`

- `klines.update_last(bar)`
- `graph.update_last(bar)`
- `aggregator.update_last(bar)`（可选）

数据读取：

- `indicator_value(name)` / `indicator_result(name)` / `indicator_ready(name)`
- `graph_summary()`：辅助调试去重效果（node 数、composite 数等）

## 6. 策略系统（Rust trait）

实现见 `packages/hquant-rs/src/strategy.rs`。

核心类型：

- `Signal { side, strength, reason, timestamp }`（strength 会 clamp 到 `[0,1]`）
- `StrategyContext { bar, indicators: IndicatorSnapshot }`
- `Strategy` trait：
  - `fn evaluate(&mut self, ctx: &StrategyContext) -> Option<Signal>`
  - 可持有内部状态（例如 MA crossover 需要记忆上一根的快慢线）

内置策略示例（可复用或参考实现）：

- `RSIStrategy`
- `MACrossStrategy`
- `MACDStrategy`
- `BollStrategy`
- `FnStrategy`：用闭包快速拼策略

## 7. Strategy DSL（pest + 解释执行）

模块位置：`packages/hquant-rs/src/dsl/*`

### 7.1 语法（`strategy.pest`）

语法定义见 `packages/hquant-rs/src/dsl/strategy.pest`，支持：

- 赋值：`x = expr`
- 条件动作：`IF expr THEN BUY(...) | SELL(...) | HOLD`
- 逻辑：`AND/OR/NOT`（也支持 `!`）
- 比较：`< <= > >= == !=`
- 四则：`+ - * /`
- 字段访问：`hit.label`、`hit.score`
- 多周期后缀：`close@4h`（仅语法与上下文接口；实际多周期喂入尚未贯通）

### 7.2 AST 与执行模型

- AST：`packages/hquant-rs/src/dsl/ast.rs`
- 解析：`packages/hquant-rs/src/dsl/parser.rs`（pest）
- 执行：`packages/hquant-rs/src/dsl/eval.rs`

执行上下文 `DslContext`（重要）：

- `bar: &Bar`
- `indicators: &IndicatorGraph`
- `period_bars: HashMap<String, &Bar>`
- `period_indicators: HashMap<String, &IndicatorGraph>`

解释器 `DslEngine`：

- 运行时变量：`variables: HashMap<String, Value>`
- 向量库：`vector_store: VectorStore`
- 输出信号缓冲：`signals: Vec<Signal>`
- 每次 `evaluate(ctx)` 会清空变量与 signals，逐条执行 statements

### 7.3 内置函数（当前实现）

在 `packages/hquant-rs/src/dsl/eval.rs::eval_function` 中：

指标类（返回当前值，依赖 `IndicatorGraph` 中的 alias 命名）：

- `EMA/SMA/WMA/MA`：默认尝试读取 `"{name_lower}_{period}"`（例如 `ema_20`）
- `RSI(period?)`：尝试 `rsi_{period}` 或 `rsi`
- `MACD()`：读取 `macd`
- `ATR(period?)`：尝试 `atr_{period}` 或 `atr`
- `BOLL()`：读取 `boll`

向量类：

- `NORMALIZE(x, length=30)`
  - 若参数是 `Variable(name)`：会尝试 `ctx.get_indicator_history(name, ..., length)` 并做 `min_max_normalize`
  - 若参数是 `Series(close/open/...)`：当前实现为 stub（返回全 0 向量），因为 `DslContext` 目前只拿到 `&Bar`，没有拿到 `&KlineSeries`
- `VEC_STORE("name")`：要求 store 已存在，否则报错
- `SIMILARITY(store, vector)`：余弦相似度，阈值由 `VectorStore.threshold` 控制（默认 0.9）

动作：

- `BUY(meta?)` / `SELL(meta?)` / `HOLD`
- `meta` 目前只读取 `reason="..."` 作为 `Signal.reason`；强度固定为 `0.8`

### 7.4 向量库 `VectorStore`

实现见 `packages/hquant-rs/src/dsl/vector_store.rs`：

- `VectorStore::load(name, Vec<LabeledVector>)`
- `find_similar(name, query) -> Option<SimilarityResult>`
- 相似度：`cosine_similarity`
- 归一化：`min_max_normalize/normalize_vector/z_score_normalize`

与 TODO 的关系：

- TODO 规划将外部向量作为“一等时间序列输入”，并与回测/实盘共用事件流；当前实现仅在 DSL 内提供 store + similarity 的最小闭环

## 8. 聚合器（多周期 K 线）

实现见 `packages/hquant-rs/src/aggregator.rs`。

### 8.1 `TimeFrame`

- 枚举：`M1/M5/M15/M30/H1/H4/D1/W1`
- `millis()`：时间跨度（ms）
- `from_str("15m"/"H4"/...)`
- `align_timestamp(ts)`：对齐到周期起点
- `is_multiple_of` 与 `ratio`

### 8.2 `Aggregator`：单对周期聚合

- 构造：`Aggregator::new(source_tf, target_tf, capacity)`
- `push(&Bar) -> bool`：喂入源周期 bar；当检测到新周期开始时，会把上一周期聚合结果 append 到 output，并返回 `true`
- `flush()`：强制把当前未完结周期写入 output（回测结束时使用）
- 合并规则与 TODO 一致：`open=first, high=max, low=min, close=last, volume+=, buy_volume+=`

### 8.3 `MultiTimeFrameAggregator`

- 管理多个 `Aggregator`，允许一次维护多条目标周期序列
- 当前 `QuantEngine` 仅负责 push/update_last；多周期结果通过 `aggregator.output(tf)`（实现见文件后半部分）读取

## 9. 回测引擎

实现见 `packages/hquant-rs/src/backtest.rs`。

### 9.1 `BacktestEngine`（现货/简化合约）

核心要素：

- `BacktestConfig { market_type, initial_capital, leverage, maker_fee, taker_fee, slippage, position_size_pct }`
- `Position`：包含 `liquidation_price`（合约才有，leverage>1）
- `process_signal(signal, bar)`：
  - 先检查爆仓（用 `bar.low` 或 `bar.high`）
  - 再根据 BUY/SELL 做开平仓与权益曲线更新
- `BacktestStats`：交易次数、PnL、最大回撤、Sharpe（简化）等

### 9.2 `FuturesBacktest`（独立合约回测器）

同文件后半部分提供 `FuturesBacktestConfig/FuturesBacktest/FuturesBacktestResult`，并在 FFI 中有独立包装（Python/Node）。

## 10. FFI（Python / Node）

Feature gate（见 `packages/hquant-rs/Cargo.toml`）：

- `ffi-python`：`pyo3/extension-module`
- `ffi-node`：`napi` + `napi-derive`
- 两者不可同时启用（`lib.rs` 有 compile_error）

### 10.1 Python：`HQuant` / `PyBacktest` / `PyAggregator` / `PyDslStrategy`

实现见 `packages/hquant-rs/src/ffi/python.rs`。

`HQuant`：

- 内部用 `Mutex<HQuantInner>` 串行保护状态
- 支持：
  - `add_indicator(name, dict_config)`：按 `type` 选择 builder/indicator（MA/EMA/WMA/RSI/MACD/ATR/BOLL/VRI/VWAP/OBV）
  - `push_kline(dict) -> List[dict]`：调用 `QuantEngine.append_bar` 并返回 Rust 策略信号（注意：DSL 策略信号走另一套 queue）
  - `update_last(dict)`
  - `get_indicator/is_ready/get_indicator_result/reset`
  - DSL：`add_strategy(name, dsl) -> id`、`push_bar(dict)`、`poll_signals()`

注意：

- `push_kline` 返回的是“Rust Strategy 系统”的即时 signals
- `push_bar` + `poll_signals` 是“DSL strategy 系统”的累积队列 signals

### 10.2 Node：napi-rs exports

实现见 `packages/hquant-rs/src/ffi/node.rs`。

与 Python 基本一致：

- `HQuant` 包装 `QuantEngine` + DSL strategy queue（Mutex）
- `add_indicator` 接收 `IndicatorConfigInput`
- `push_kline/update_last/get_indicator/...`
- DSL：`add_strategy/push_bar/poll_signals`
- 回测与聚合器也有对应导出类型（见文件后续定义）

## 11. 扩展指南（给 Agent 的改造入口）

### 11.1 新增一个指标（可被去重与依赖共享）

最短路径（推荐）：

1. 新建实现文件：`packages/hquant-rs/src/indicators/<your_indicator>.rs`，实现 `Indicator` trait
2. 在 `packages/hquant-rs/src/indicators/mod.rs` 中 `pub mod ...` 并 `pub use ...`
3. 在 `packages/hquant-rs/src/indicators/spec.rs`：
   - 增加 `IndicatorSpec::<Your>` variant（含参数）
   - 若是组合指标，实现 `dependencies()`
4. 在 `packages/hquant-rs/src/indicators/graph.rs::build_indicator` 增加 `match` 分支
5. 若要 Graph mode 共享子指标：
   - 指标实现里覆写 `deps()` 返回与 `IndicatorSpec::dependencies()` 一致的 spec 顺序
   - 实现 `push_with_deps/update_last_with_deps` 使用依赖值而不是自建子指标

### 11.2 新增 DSL 内置函数

修改 `packages/hquant-rs/src/dsl/eval.rs::eval_function`：

- 解析 args/kwargs
- 从 `DslContext` 取 `bar/indicators/period_*` 数据
- 返回 `Value::{Number/Bool/String/Vector/SimilarityHit/Null}`

如果需要访问历史 K 线（让 `NORMALIZE(close, ...)` 成为真实实现）：

- 需要扩展 `DslContext` 持有 `&KlineSeries` 或为 eval 提供历史访问回调
- 同时在 FFI/引擎侧构造 `DslContext` 时注入该引用

### 11.3 将多周期贯通到 DSL

当前状态：

- 语法支持 `series@period`（例如 `close@4h`）
- `DslContext` 支持 `with_period_bar/with_period_indicators`

要完成闭环，需要：

- 引擎/FFI 在聚合器“周期闭合”时生成对应周期的 bar + 该周期的指标图
- 在调用 `DslEngine.evaluate(&ctx)` 前，把对应 `period_bars/period_indicators` 填进去

## 12. TODO.md 中的规划要点（与现状对照）

摘取 `packages/hquant-rs/TODO.md` 的关键方向（此处仅做对齐，不承诺已实现）：

- SoA + RingBuffer 的核心存储模型（已实现）
- 指标可增量计算、组合指标共享依赖（已实现：`IndicatorGraph + IndicatorSpec`）
- Strategy DSL（已实现：parser + eval；但部分功能仍是 stub）
- 聚合器（已实现：`Aggregator/MultiTimeFrameAggregator`）
- 回测（已实现：`BacktestEngine` + `FuturesBacktest`）
- FFI（已实现：Python/Node 包装；零拷贝与多周期“生产级事件流”仍待补齐）

