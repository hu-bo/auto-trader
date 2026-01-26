# HQuant Rust 技术文档（无代码版）

本文档描述 `hquant`（`packages/hquant-rust`）的设计目标、模块划分、核心数据结构、公共 API 语义、错误模型、FFI 绑定约束与已知限制。文档刻意不包含代码片段；但会以标识符形式描述类型/结构体/函数语义。

## 1. 目标与非目标

### 1.1 目标
- **性能优先的数据通道**：固定容量环形缓冲区，避免热路径频繁分配；K 线序列采用 SoA（列式）存储以提升缓存命中。
- **可组合的指标与策略**：指标以 `Indicator` trait 抽象，策略以 `Strategy` trait 抽象，并提供 Builder 风格的指标创建方式。
- **面向回测与流式更新**：同一套 `QuantEngine` 支持历史批量加载与实时 `update_last_bar` 修正。
- **多语言可用**：通过 feature 选择性构建 Node.js / Python / Go 的 FFI。

### 1.2 非目标（当前版本不保证）
- 交易所级撮合、订单簿、逐笔成交回放。
- 全面准确的保证金/资金占用模型（回测目前偏简化）。
- 多线程并行指标计算（目前是单线程顺序推进）。

## 2. 构建与特性开关

### 2.1 Crate 产物
- crate-type 同时提供 `rlib` 与 `cdylib`，便于 Rust 内部使用与 FFI 动态库输出。

### 2.2 Cargo features（互斥）
- `ffi-node`：启用 Node.js（napi-rs）导出。
- `ffi-python`：启用 Python（PyO3）导出。
- `ffi-go`：启用 C ABI（供 Go cgo）导出。
- 互斥规则：同一构建中只能启用一个 FFI feature（否则编译期报错）。

### 2.3 build.rs 行为
- `ffi-node`：配置 N-API 相关链接参数。
- `ffi-python`：配置 PyO3 extension module 的链接参数（尤其是 macOS 动态链接）。

## 3. 错误模型（核心变更）

### 3.1 类型
- `HQuantResult<T>`：统一的结果类型别名。
- `HQuantError`：统一错误枚举。

### 3.2 设计原则
- **替代 panic/assert**：对外构造/校验路径尽量返回 `HQuantResult`，避免 FFI 场景直接崩溃进程。
- **参数校验就地发生**：例如容量 `capacity`、周期 `period`、聚合周期倍数关系等，尽量在构造函数中校验。

### 3.3 典型错误场景
- `InvalidCapacity`：容量为 0（例如 ring buffer / kline series / engine / typed buffers）。
- `InvalidArgument`：参数不满足语义约束（例如 MACD fast/slow 不合法、BOLL 标准差倍数不合法、timeframe 聚合非法等）。

## 4. 模块总览

### 4.1 `error`
- 提供 `HQuantError` 与 `HQuantResult`，作为跨模块统一错误语义。

### 4.2 `common`
**目的**：提供固定容量环形缓冲区及数值优化版本，作为指标与 K 线存储的底层容器。

核心类型：
- `RingBuffer<T>`：泛型环形缓冲区（固定容量、覆盖最旧元素）。
  - 语义：逻辑索引 0 表示最旧；`len-1` 表示最新。
  - 关键方法语义：`push` 覆盖写入；`update_last` 修改最新元素；`as_slices` 以两段 slice 暴露内部环形切片；`to_vec` 返回逻辑顺序的连续数组。
  - 构造：`new(capacity)` 返回 `HQuantResult`，capacity 必须 > 0。
- `F64RingBuffer`：面向 `f64` 的专用缓冲区，维护 `sum/sum_sq`，提供 `mean/variance/std_dev` 的 O(1) 计算。
  - 构造：`new(capacity)` 返回 `HQuantResult`。
- `Float64RingBuffer` / `Int32RingBuffer`：TypedArray 风格的环形缓冲区（更贴近 JS/FFI 直觉）。
  - 构造：`new(capacity)` 返回 `HQuantResult`。
  - 语义：队列满时覆盖最旧数据；提供 `shift/pop/update/update_last/get/get_from_end/iter/to_vec`。

### 4.3 `kline`
**目的**：K 线结构与 K 线序列（SoA）存储。

核心类型：
- `Bar`：单根 K 线输入/输出结构。
  - 字段语义：`timestamp`（毫秒时间戳）、`open/high/low/close`、`volume`。
  - `merge(other)`：用于周期聚合，将 high/low/close/volume 合并；timestamp 与 open 保持为聚合周期首值。
- `KlineSeries`：SoA 存储的 K 线序列（每列一个 `RingBuffer`）。
  - 构造：`new(capacity)` 返回 `HQuantResult`。
  - 关键方法语义：`append` 追加；`update_last` 修正最新；`get(index)` 读取逻辑顺序的 `Bar`；`last` 获取最新；`get_from_end(n)` 获取倒数第 n 根；`iter` 迭代所有 bar。
  - 约束：容量固定；超过容量会覆盖最旧数据。

### 4.4 `indicators`
**目的**：技术指标 trait、指标结果结构、内置指标实现、动态指标与 Builder 创建方式。

公共抽象：
- `Indicator`（trait）
  - 生命周期：指标以 `push(bar)` 推进、`update_last(bar)` 修正最新点。
  - 输出：`value()` 返回当前主值；`result()` 返回 `IndicatorValue`（可包含 extra）。
  - 状态：`min_periods()` 表示最小需求数据点；`is_ready()` 表示输出可用；`reset()` 清空状态。
  - 历史：`get(index)`、`get_from_end(n)`、`len()` 用于读取内部历史输出序列。
- `IndicatorValue`
  - 字段语义：`value`（主值）、`timestamp`、`extra`（可选额外序列，如 BOLL 上下轨、MACD 信号线/柱等）。
- `PriceType`
  - 用途：定义指标输入来源（Open/High/Low/Close/Volume/Typical/Median/Average）。

内置指标（构造均返回 `HQuantResult`，并对参数做基本校验）：
- `MA` / `MAType`
  - 支持 SMA/EMA/WMA；可指定 `PriceType`。
  - 关键参数：`period` 必须 > 0。
- `RSI`
  - Wilder 平滑法；`period` 必须 > 0。
- `MACD`
  - 关键参数：`fast_period/slow_period/signal_period` 必须 > 0，且 fast 必须小于 slow。
- `ATR`
  - 关键参数：`period` 必须 > 0。
- `BOLL`
  - 关键参数：`period` 必须 > 0；`std_dev_factor` 必须有限且 > 0。
- `VRI`
  - 关键参数：`period` 必须 > 0。

动态指标：
- `DynamicIndicator`
  - 用途：允许用函数 `Fn(&KlineSeries)->Option<f64>` 在运行时定义指标计算。
  - 构造：`new(name, min_periods, capacity, calc_fn)` 返回 `HQuantResult`，内部维护一份 `KlineSeries` 缓存以及输出 `F64RingBuffer`。
- 动态指标工厂函数（全部返回 `HQuantResult<DynamicIndicator>`）
  - `vwap`、`obv`、`mfi`、`williams_r`、`cci`、`roc`。

Builder 模式：
- `IndicatorBuilder`（trait）
  - 目的：提供 fluent 创建方式并在 `build()` 阶段统一参数校验。
  - `build()` / `build_named()` 都返回 `HQuantResult`。
- `MABuilder/RSIBuilder/MACDBuilder/ATRBuilder/BOLLBuilder/VRIBuilder`
  - 通过链式配置参数，再 build 成 `Box<dyn Indicator>`。
- 便捷工厂函数：`ma/sma/ema/rsi/macd/atr/boll/vri`。

### 4.5 `aggregator`
**目的**：将细粒度 K 线聚合为粗粒度 K 线，支持单目标与多目标周期。

核心类型：
- `TimeFrame`
  - 枚举：M1/M5/M15/M30/H1/H4/D1/W1。
  - 关键方法语义：`millis()` 返回周期毫秒；`align_timestamp(ts)` 对齐到周期起始；`is_multiple_of(other)` 校验倍数关系；`ratio(source)` 计算倍数。
- `Aggregator`
  - 语义：从 `source_tf` 聚合到 `target_tf`，内部维护一个正在聚合的 `current_bar` 与输出 `KlineSeries`。
  - 构造：`new(source_tf, target_tf, capacity)` 返回 `HQuantResult`；要求 `target_tf` 必须是 `source_tf` 的整数倍。
  - 关键方法语义：`push(bar)` 返回是否产生一根新的已完成目标周期 bar；`update_last(bar)` 修正当前聚合 bar；`flush()` 强制把当前聚合 bar 写入输出；`output()` 返回已完成序列；`current()` 返回未完成 bar。
- `MultiTimeFrameAggregator`
  - 语义：以 `base_tf` 为输入，同时维护多个 `target_tf` 聚合器。
  - 构造：`new(base_tf, target_tfs, capacity)` 返回 `HQuantResult`；要求每个 target 必须是 base 的整数倍且不能等于 base。
  - 关键方法语义：`push(bar)` 返回本次产生完成 bar 的目标周期列表；`current(tf)`/`output(tf)` 查询对应周期输出；`flush_all()` 强制完成全部；`reset()` 清空。

### 4.6 `strategy`
**目的**：策略抽象与内置策略样例（偏示范性质），由 `QuantEngine` 驱动产生 `Signal`。

核心类型：
- `Side`：Buy/Sell/Hold。
- `Signal`
  - 字段语义：`side`、`strength`（0..1 会被 clamp）、`reason`、`timestamp`。
- `IndicatorSnapshot`
  - 用途：给策略提供只读的指标访问视图（按名称查询 `value/result/is_ready`）。
- `StrategyContext`
  - 字段语义：`bar`（当前输入 K 线）、`indicators`（快照）。
- `Strategy`（trait）
  - 当前语义：`evaluate(&mut self, ctx)` 返回 `Option<Signal>`，允许策略维护状态。
  - 重要约束：策略必须是 `Send + Sync`（便于未来扩展并发或跨线程持有）。

内置策略：
- `FnStrategy`
  - 用途：用闭包定义策略逻辑（便于上层快速拼装）。
- `MACrossStrategy`
  - 逻辑：基于快慢均线的交叉产生信号；内部维护 `prev_fast/prev_slow`，每次 evaluate 后都会更新（已修复“不会产生信号”的问题）。
- `RSIStrategy`
  - 逻辑：基于 RSI 超买超卖阈值给出买卖信号。
- `BOLLStrategy`
  - 逻辑：触及上轨/下轨产生信号，强度与偏离程度相关。

### 4.7 `backtest`
**目的**：简化的现货/合约回测引擎，提供费用、滑点、爆仓与基础统计。

核心类型：
- `MarketType`：Spot / Futures。
- `PositionSide`：Long / Short。
- `Position`
  - 字段语义：`side/size/entry_price/leverage/liquidation_price/unrealized_pnl/timestamp`。
  - 行为：`update_pnl(price)` 更新未实现盈亏；`is_liquidated(price)` 判断是否爆仓。
  - 注意：爆仓价计算为简化模型（固定维持保证金率假设），与真实交易所可能不同。
- `Trade`
  - 字段语义：`timestamp/side/price/size/fee/pnl`（pnl 为已实现盈亏）。
- `BacktestConfig`
  - 字段语义：`market_type/initial_capital/leverage/maker_fee/taker_fee/slippage/position_size_pct`。
  - 构造辅助：`spot(initial_capital)`、`futures(initial_capital, leverage)`。
- `BacktestStats`
  - 字段语义：交易次数/胜率/盈亏/最大回撤/夏普/最终权益/收益率/爆仓次数等。
  - 计算：`calculate(initial_capital, equity_curve)` 在需要时派生统计。
- `BacktestEngine`
  - 行为：`process_signal(signal, bar)` 推进回测；内部维护 `equity_curve`、持仓、交易记录等。
  - 关键修复：爆仓检查价格对多空分离（多仓用 bar.low，空仓用 bar.high），避免空仓无法爆仓的错误。

### 4.8 `ffi`
**目的**：为 Node.js / Python / Go 提供桥接层；通过 feature 选择性编译。

共通原则：
- FFI 层不应 panic：构造与主要方法应把 `HQuantError` 映射为目标语言异常或错误码/空指针。
- 线程安全：Node/Python 包装器内部使用 `Mutex<T>`；若 lock poisoned，会返回错误（而不是 unwrap 崩溃）。

#### 4.8.1 Node.js（`ffi-node`）
导出对象（概览）：
- `Engine`：包装 `QuantEngine`。
  - 构造：对容量做校验，失败抛 JS 异常。
  - 添加指标：通过 `MAIndicator/RSIIndicator/...` builder 添加，失败抛 JS 异常。
- `Indicators`：指标 builder 工厂。
- `KlineAggregator` / `MultiTimeFrameKlineAggregator`：聚合器包装（构造时校验 timeframe 合法性）。
- `Backtest`：回测引擎包装。
- `Float64Buffer` / `Int32Buffer`：typed ring buffer 包装（构造校验容量）。

兼容性提示：
- 部分方法返回类型已改为会抛错的 `Result` 语义（例如 `Backtest.result()` / `Buffer.len()` 等），以便在 lock poisoned 等异常情形可向 JS 抛错而不是静默返回默认值。

#### 4.8.2 Python（`ffi-python`）
导出对象（概览）：
- `PyEngine`：包装 `QuantEngine`，构造返回 `PyResult`，失败抛 Python 异常。
- `PyBar`、`PySignal`：数据载体类型。
- `PyMAIndicator/PyRSIIndicator/...`：指标 builder 类型。

#### 4.8.3 Go（`ffi-go`）
- 提供最小化 C ABI：创建/释放引擎、推送 K 线、读取指标值、重置等。
- `hquant_engine_new`：若构造失败返回 NULL，调用方需判空。

## 5. 顶层入口：`QuantEngine`

### 5.1 核心职责
- 维护输入 K 线序列 `KlineSeries`。
- 维护指标集合（名称到 `Box<dyn Indicator>`）。
- 维护策略集合（`Box<dyn Strategy>`，允许有状态策略）。
- 可选地维护多周期聚合器与回测引擎。

### 5.2 关键方法语义（概要）
- `new(capacity)`：返回 `HQuantResult<Self>`；capacity > 0。
- `add_indicator(name, builder)`：返回 `HQuantResult<()>`；在 build 阶段校验指标参数。
- `add_indicator_boxed(name, indicator)`：直接插入已构建指标（不返回 Result，不做校验）。
- `add_dynamic_indicator(name, min_periods, calc_fn)`：返回 `HQuantResult<()>`。
- `add_vwap/add_obv/add_mfi/add_williams_r/add_cci/add_roc`：返回 `HQuantResult<()>`。
- `setup_aggregator(base_tf, target_tfs, capacity)`：返回 `HQuantResult<()>`；校验倍数关系与容量。
- `setup_backtest(config)`：启用回测。
- `append_bar(bar)`：推进全链路（K 线 → 指标 → 聚合器 → 策略 → 回测），返回本 bar 触发的信号列表。
- `update_last_bar(bar)`：修正最新 bar，同步修正指标与聚合器当前状态（回测不自动回滚，属于调用方需要谨慎使用的操作）。
- `load_history(bars)`：批量 `append_bar`；返回所有信号。
- 查询方法：`indicator_value/result/ready`、`klines/last_bar/aggregator/backtest_result/backtest_trades/backtest_equity_curve`。
- `reset()`：清空引擎状态（K 线、指标、聚合器、回测）。

## 6. 性能与内存模型说明

- 环形缓冲区采用固定容量 `Vec<T>` 预分配并覆盖写入，避免热路径分配。
- `KlineSeries` 采用 SoA：便于指标只读取所需列（close/high/low/volume）并提升 cache locality。
- 指标输出一般存入 `F64RingBuffer`（带缓存统计量），在均值/方差等计算上减少重复遍历。

## 7. 线程安全与可重入性

- Rust core 类型多数为普通结构体，默认不做内部同步；由调用方在多线程中自行包裹或通过 FFI 层提供的 `Mutex` 使用。
- FFI 层（Node/Python）采用 `Mutex` 保护内部引擎对象；锁中执行会阻塞调用线程。
- lock poisoned 时：
  - Node：多数方法返回 JS 异常（`napi::Result`）。
  - Python：抛 `PyRuntimeError` 或返回 `None/false`（少数查询方法采取降级策略）。

## 8. 已知限制与设计折中

- 回测资金模型简化：现货/合约均以简化账户方式推进，未覆盖真实交易所全部费用项与保证金规则。
- `update_last_bar` 不回滚回测：用于“实时行情修正”的指标/聚合器更新是合理的，但回测回滚涉及交易与权益曲线回滚，当前未实现。
- 指标命名冲突：指标以字符串 key 存储，重复添加会覆盖旧指标（调用方需自行管理命名空间）。

## 9. 迁移提示（破坏性变更）

- 旧的 `QuantEngine::add_ma/add_rsi/add_macd/add_atr/add_boll/add_vri` 已移除；请统一使用 builder：`add_indicator(name, builder)`。
- 多个构造函数与工厂函数已从返回具体类型改为返回 `HQuantResult<T>`（例如 `QuantEngine::new`、`Aggregator::new`、`BOLL::standard` 等）。
- Node.js 绑定中部分方法改为可抛错的返回语义（主要用于锁异常与参数校验失败场景）。

## 10. TODO / Roadmap（建议优先级）

### P0（正确性/安全）
- 回测中 `update_last_bar` 的一致性：定义并实现“回测回滚/修正”策略（或明确禁止与回测同时启用）。
- 对 `add_indicator_boxed` 补充可选校验或在文档中强调“调用方保证合法”。
- Go C ABI：增加错误获取机制（例如 thread-local last error 或返回错误码 + message），提升可诊断性。

### P1（可用性）
- 指标注册与命名：提供 `add_indicator_auto_name(builder)` 之类的辅助方法，减少重复命名与冲突。
- 输出访问：为 `KlineSeries`/指标输出提供更丰富的只读视图（例如切片/迭代器优化接口）。
- Node/Python：对返回 `Result` 的方法补充文档说明与示例（当前示例偏旧）。

### P2（性能/扩展）
- 批量推进优化：为历史回放提供批处理路径（减少 trait object 调用开销）。
- 指标计算向量化：针对常用指标提供更 SIMD 友好的计算路径（在保证可读性的前提下）。
- 并行策略评估：在策略无状态或可分片的情况下探索并行（需要更细的线程安全约束）。

