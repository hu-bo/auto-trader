# hquant-rs 

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

- `packages/hquant-rs/src/lib.rs`：crate root；对外 `pub use ...`；核心类型导出
  - 运行时核心：`HQuant`（单周期）/ `MultiHQuant`（多周期路由）

Module Map:

- `packages/hquant-rs/src/types.rs`: `Bar`, `Field`, `Action`, `Signal`
- `packages/hquant-rs/src/commom/mod.rs`: common
- `packages/hquant-rs/src/circular.rs`: re-export `CircularColumn<T>`
- `packages/hquant-rs/src/commom/circular.rs`: `CircularColumn<T>` fixed-cap ring
- `packages/hquant-rs/src/kline_buffer.rs`: `KlineBuffer` SoA ring of bars
- `packages/hquant-rs/src/indicators/mod.rs`：`IndicatorGraph` 指标实现、构建器、图执行与去重
- `packages/hquant-rs/src/vector_store.rs`: `VectorStore` + normalize + similarity
- `packages/hquant-rs/src/dsl/mod.rs`：DSL AST / parser / eval
- `packages/hquant-rs/src/hquant.rs`: `HQuant` runtime
- `packages/hquant-rs/src/multi.rs`: `MultiHQuant` runtime
- `packages/hquant-rs/src/period.rs`: `Period`
- `packages/hquant-rs/src/aggregator.rs`：`Aggregator` multi-period candle aggregation
- `packages/hquant-rs/src/backtest/futures_backtest.rs`：`FuturesBacktest` USDM futures backtest
- `packages/hquant-rs/src/ffi/node.rs`: Node addon (feature `ffi-node`)
- `packages/hquant-rs/src/ffi/python.rs`: Python module (feature `ffi-python`)

## 3. Core Types：RingBuffer / KlineSeries

### 3.1 `CircularColumn<T>`：固定容量环形缓冲区

### `CircularColumn<T>` (`packages/hquant-rs/src/commom/circular.rs`, re-export: `packages/hquant-rs/src/circular.rs`)
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
  - MA (SMA/EMA) - 移动平均线
  - STDDEV - 标准差（波动率）
  - RSI - 相对强弱指标
  - MACD - 指数平滑异同移动平均线
  - BOLL - 布林带
  - (planned) ATR / VWAP / OBV 等

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
- statements:
  - `LET <name> = <value>`（表达式别名；不可变变量）
- actions:
  - `BUY(meta?)|SELL(meta?)|HOLD()` (also accepts `BUY(hit)` etc) hit = {"symbol": "BTC-USDT", "label": 1, ts: 17000000090}
- evaluation:
  - rules evaluated top-down per bar; first match emits `Signal`
  - if indicator value is `NaN`, comparisons are `false`
- compile API:
  - `compile_strategy(id, name, dsl, graph: &mut IndicatorGraph) -> Result<CompiledStrategy, StrategyError>`
- multi-period：
  - 单周期策略（`HQuant::add_strategy` / `compile_strategy`）只支持当前周期，不允许 `@<period>` 后缀
  - 多周期策略：使用 `compile_multi_strategy(...)` 或 `MultiHQuant::add_multi_strategy(...)`
    - 允许 `close@4h` / `SMA(close@4h, period=20)` / `NORMALIZE(close@4h, ...)`
    - 未带 `@` 时默认 base period（`periods[0]`）
  - 注意：DSL 变量使用 `LET name = value`（不可变别名）；不支持无关键字的赋值写法（例如 `name = ...`）

- 向量类：
  - `VEC_STORE("name")`：引用向量库；运行时 store 不存在/为空时返回 `NaN`（条件判定为 false）
  - `NORMALIZE(series?, length=..., method="minmax|zscore|l2|none")`：从 KlineBuffer 取最近 `length` 个值构造向量并归一化
    - `series` 省略时默认 `close`，也支持 `NORMALIZE(30)` 这种写法
  - `SIMILARITY(store, NORMALIZE(...), method="cosine|pearson|l2|l1|linf", threshold=...)`
    - `method` 默认 `cosine`
    - `threshold` 省略时使用 `VectorStore.threshold`（默认 0.9）
    - 返回：若 best_score >= threshold 返回 score，否则返回 `NaN`（用于规则短路）

### Condition grammar
- boolean ops: `AND`, `OR`, `NOT` (also `!`)
- precedence: `NOT` > `AND` > `OR`
- parentheses supported
- comparison: `< <= > >= == !=`
- indicator call: `IDENT("(" arg_list? ")")` 

### Supported indicator calls in conditions
- `RSI(<period>)` or `RSI(close, period=<n>)`
  - series field restriction: close only
- `SMA(<series>, <period>)` or kwargs `SMA(close, period=20)` (also supports `SMA(20)` -> default close)
- `EMA(<series>, <period>)`
- `STDDEV(<series>, <period>)`
- series field names: `open|high|low|close|volume|buy_volume`

### 向量库 `VectorStore`
- `VectorStore::load(name, Vec<LabeledVector>)`
- `find_similar(name, query) -> Option<SimilarityResult>` (default: cosine)
- `find_similar_by(name, query, method) -> Option<SimilarityResult>`
- `find_similar_by_threshold(name, query, method, threshold) -> Option<SimilarityResult>`
- 相似度方法 `SimilarityMethod`：
  - `Cosine` (`"cosine"`)
  - `Pearson` (`"pearson"|"corr"|"correlation"`)
  - `Euclidean` (`"euclidean"|"l2"`)：`similarity = 1/(1+d)`
  - `Manhattan` (`"manhattan"|"l1"`)：`similarity = 1/(1+d)`
  - `Chebyshev` (`"chebyshev"|"linf"|"l_inf"`)：`similarity = 1/(1+d)`
- 归一化：
  - `min_max_normalize`
  - `z_score_normalize`
  - `normalize_vector` (L2 unit norm)


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
- 注意：每个目标周期只维护**当前桶**的 `parts`；桶关闭后状态会被覆盖为新桶


## 引擎编排：`HQuant` / `MultiHQuant`

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
  - `update_last(bar: Bar)`:
    - replace last bar if exists
    - `indicators.on_update_last(old_bar, new_bar, &bars)`
    - eval strategies
  - `poll_signals() -> Vec<Signal>` (drain all)

### `MultiHQuant` (`packages/hquant-rs/src/multi.rs`)
- constructor: `MultiHQuant::new(capacity, periods: Vec<Period>)`
  - creates `HQuant` per period (keyed by `period_ms`)
- ingestion:
  - `add_strategy(name: &str, dsl: &str) -> Result<u32, StrategyError>`
    - 当前版本：策略只添加到 `periods[0]`（base period）对应的引擎
  - `add_multi_strategy(name: &str, dsl: &str) -> Result<u32, StrategyError>`
    - 支持 `@<period>` 后缀的跨周期引用（period 必须存在于 `periods`）
    - multi-strategy id 使用 `idx=0`（即 `strategy_id == local_id`）
  - `load_store(name: &str, vectors: Vec<LabeledVector>)`
  - `set_similarity_threshold(threshold: f64)`
  - `feed_bar(bar)`:
    - `Aggregator::push(bar)` => events
    - routes events into each period engine:
    - collects per-period signals and encodes ids (`idx<<24 | local_id`)
  - `flush()` => closes all buckets then routes
- output:
  - `poll_signals() -> Vec<Signal>` drains multi queue

## Backtest (futures)

 `packages/hquant-rs/src/backtest/futures_backtest.rs`。

- params: `BacktestParams` (`#[repr(C)]`)
  - `initial_margin: f64` (`>0`)
  - `leverage: f64` (`>=1`)
  - `contract_size: f64` (`>0`)
  - `maker_fee_rate: f64` (`>=0`)
  - `taker_fee_rate: f64` (`>=0`)
  - `maintenance_margin_rate: f64` (`>=0`)
  - `is_valid() -> bool` (finite + range checks)
- result: `BacktestResult` (`#[repr(C)]`)
  - `equity`, `profit`, `profit_rate`, `max_drawdown_rate` (negative), `liquidated`
- behavior:
  - positions: separate `pos_long` and `pos_short` (can both exist)
  - `apply_signal(action, price, margin)`:
    - `BUY`: close short then open/merge long
    - `SELL`: close long then open/merge short
    - `HOLD`: no-op
    - then `on_price(price)` (updates drawdown + liquidation)
  - liquidation: if `equity(price) <= maintenance_margin(price)` => `liquidated=true`, clear positions, cash=0
- APIs:
  - `new(params)`, `try_new(params) -> Option<Self>`
  - `cash()`, `liquidated()`
  - `max_open_margin(fee_rate)`
  - `open_long/open_short/close_long/close_short`
  - `equity(price)`, `locked_margin()`, `total_notional(price)`, `maintenance_margin(price)`
  - `result(price) -> BacktestResult`


## 10. FFI（Python / Node）

### Exported Python APIs (`packages/hquant-rs/src/ffi/python.rs`)
### Exported JS APIs (`packages/hquant-rs/src/ffi/node.rs`)

- class `HQuant`:
  - `new(capacity: number)`
  - `add_strategy(name: string, dsl: string) -> number`
  - `loadStore(name: string, vectors: Array<{label:number, vector:number[]}>)`
  - `setThreshold(threshold: number)` ([-1,1])
  - `push_bar(bar: {timestamp,open,high,low,close,volume,buy_volume?})`
  - `update_last_bar(bar: ...)`
  - `poll_signals() -> Array<{strategy_id, action: "BUY"|"SELL"|"HOLD", timestamp}>`
- class `MultiHQuant`:
  - `new(capacity: number, periods: string[])` where `Period::parse` accepts `ms|s|m|h|d`
  - `feed_bar(bar)`
  - `flush()`
  - `add_strategy(name: string, dsl: string) -> number`
  - `poll_signals() -> Signal[]` (strategy_id encoded)
- class `FuturesBacktest`:
  - `new(params: {initial_margin, leverage, maker_fee_rate, taker_fee_rate})`
  - `apply_signal(action: "BUY"|"SELL"|"HOLD", price: number, volume: number)`
  - `result(price: number) -> {equity, profit, profit_rate, max_drawdown_rate, liquidated}`

## Build / Test Commands
- core tests: `cargo test` (from `packages/hquant-rs`)
- build core: `cargo build --release`
- build node: `cargo build --release --features ffi-node`
- build python: `cargo build --release --features ffi-python`
