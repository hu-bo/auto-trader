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

### `KlineBuffer` (`packages/hquant-rs/src/kline_buffer.rs`)
- SoA ring for `Bar` columns:
  - `timestamp: CircularColumn<i64>`
  - `open/high/low/close/volume/buy_volume: CircularColumn<f64>`
- methods:
  - `new(capacity) -> Self`
  - `capacity()`, `len()`, `is_empty()`
  - `push(bar)`
  - `update_last(bar) -> Option<Bar>` (returns previous last)
  - `get(i) -> Option<Bar>` (index from oldest)
  - `last() -> Option<Bar>`
  - `get_f64(field, i) -> Option<f64>`
  - `last_f64(field) -> Option<f64>`
  - column accessors: `close()/open()/high()/low()/volume()/buy_volume()/timestamp() -> &CircularColumn<_>`


## 4. 指标系统：`Indicator` / `IndicatorGraph` / `IndicatorSpec`
  - MA (SMA/EMA/WMA) - 移动平均线
  - RSI - 相对强弱指标
  - MACD - 指数平滑异同移动平均线
  - ATR - 平均真实波幅
  - BOLL - 布林带
  - VRI - 成交量比率指标
  - VWAP - 成交量加权平均价格
  - OBV - 能量潮指标

- `IndicatorSpec` (hashable, used for auto-dedup):
  - `Sma { field: Field, period: usize }`
  - `Ema { field: Field, period: usize }`
  - `StdDev { field: Field, period: usize }`
  - `Rsi { period: usize }` (close only)
  - `Boll { period: usize, k_bits: u64 }` (uses `SMA(close,period)` + `StdDev(close,period)`)
  - `Macd { fast: usize, slow: usize, signal: usize }`

### `IndicatorGraph`：DAG 去重与拓扑执行 
- role: indicator DAG + output ring columns; auto-dedup by `IndicatorSpec`
- **去重**：`spec_map: HashMap<IndicatorSpec, IndicatorId>`，同 spec 复用同一 node
- **依赖建图**：添加组合 spec 时先递归添加依赖 spec，得到 `deps: Vec<IndicatorId>`
- **拓扑执行**：使用 Kahn 算法计算

## Strategy DSL
### High-level 
- input: multi-line DSL; each non-empty, non-comment line is a rule:
  - format: `IF <condition> THEN <action>`
- actions:
  - `BUY(meta?)|SELL(meta?)|HOLD()` (also accepts `BUY(hit)` etc) hit = {"symbol": "BTC-USDT", "label": 1, ts: 17000000090}
- evaluation:
  - rules evaluated top-down per bar; first match emits `Signal`
  - if indicator value is `NaN`, comparisons are `false`
- compile API:
  - `compile_strategy(id, name, dsl, graph: &mut IndicatorGraph) -> Result<CompiledStrategy, StrategyError>`
  - multi-period compile (internal): `compile_multi_strategy(id, name, dsl, resolver) -> Result<CompiledStrategyT<MultiIndicatorRef>, StrategyError>`
- multi-period field suffix:
  - series refs may include `@<period>` (e.g. `close@4h` | `close@15m`)

- 向量类：
  - `NORMALIZE(close@4h, length=30)` 4h周期的close数据归一化
  - `VEC_STORE("name")`：要求 store 已存在，否则报错
  - `SIMILARITY(store, vector, 0.9)`：余弦相似度，阈值由 `VectorStore.threshold` 控制（默认 0.9）, 只返回 top, not topk

### Condition grammar
- boolean ops: `AND`, `OR`, `NOT` (also `!`)
- precedence: `NOT` > `AND` > `OR`
- parentheses supported
- comparison: `< <= > >= == !=`
- indicator call: `IDENT("(" arg_list? ")")` 

### Supported indicator calls in conditions
- `RSI(<period>)` or `RSI(close@15m, period=<n>)`
  - series field restriction: close only
- `SMA(<series>, <period>)` or kwargs `SMA(close@4h, period=20)`
- `EMA(<series>, <period>)`
- `STDDEV(<series>, <period>)`
- series field names: `open|high|low|close|volume|buy_volume`

### 向量库 `VectorStore`
- `VectorStore::load(name, Vec<LabeledVector>)`
- `find_similar(name, query) -> Option<SimilarityResult>`
- 相似度：`cosine_similarity`
- 归一化：`min_max_normalize/normalize_vector/z_score_normalize`


## Aggregation (multi-period candles)

## Period
### `Period`
- `Period::parse("15m"|"4h"|"500ms"|...) -> Result<Period>`
  - units supported: `ms|s|m|h|d`
- `as_ms() -> i64`

### `Aggregator`：单对周期聚合
- 支持周期流向： 15m -> 1h -> 4h -> 1d
- 构造：`Aggregator::new(periods: Vec<Period>)` Aggregator::new(vec![Period::parse("15m"), Period::parse("4h")] 多周期，
- `push(&Bar) -> bool`：喂入源周期 bar；当检测到新周期开始时，会把上一周期聚合结果 append 到 output，并返回 `true`
- `flush()` closes all in-progress candles
- `poll_events() -> Vec<AggregatorEvent>` drains queue
- `AggregateCandle` fields:
  - `open_time`, `open/high/low/close`, `volume`, `buy_volume`
- 合并规则：`open=first, high=max, low=min, close=last, volume+=, buy_volume+=`
- 注意：周期结束延迟2个周期删除，避免缓存爆炸


## 引擎编排：`QuantEngine`

`HQuant` 的核心字段：

- state:
  - `bars: KlineBuffer` (SoA ring)
  - `indicators: IndicatorGraph` (dedup + outputs)
  - `strategies: Vec<CompiledStrategy>`
  - `signals: VecDeque<Signal>`

- API:
  - `HQuant::new(capacity: usize) -> Self`
  - `capacity() -> usize`
  - `len() -> usize`
  - `bars() -> &KlineBuffer` (read-only view)
  - `add_indicator(spec: IndicatorSpec) -> IndicatorId`
  - `indicator_last(id: IndicatorId) -> Option<IndicatorValue>`
  - `add_strategy(name: &str, dsl: &str) -> Result<u32, StrategyError>` (allocates monotonically increasing ids)
  - `push_kline(bar: Bar)`:
    - push to `bars`
    - `indicators.on_push(&bars)`
    - eval all strategies (emit 0..N signals)
  - `feed_kline(bar: Bar)`   dep `Aggregation` close bar
  - `update_last(bar: Bar)`:
    - replace last bar if exists
    - `indicators.on_update_last(old_bar, new_bar, &bars)`
    - eval strategies
  - `poll_signals() -> Vec<Signal>` (drain all)

### `MultiHQuant` (`packages/hquant-rs/src/multi.rs`)
- constructor: `MultiHQuant::new(capacity, periods: Vec<Period>)`
  - creates `HQuant` per period (keyed by `period_ms`)
  - period index mapping: `idx=1..` for per-period engines; `idx=0` reserved for multi-strategies
- ingestion:
  - `feed_bar(bar)`:
    - `Aggregator::push(bar)` => events
    - routes events into each period engine:
      - `KlineUpdated`: `update_last` if same `open_time` else `push_kline`
      - `KlineClosed`: ensures final candle written (update_last/push_kline)
    - collects per-period signals and encodes ids
    - evaluates cross-period strategies after routing events
  - `flush()` => closes all buckets then routes
- output:
  - `poll_signals() -> Vec<Signal>` drains multi queue

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


