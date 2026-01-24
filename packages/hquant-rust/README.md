# HQuant（Rust 版）

高性能量化交易核心库，面向策略研发与回测需求。

- 固定容量环形缓冲区与列式（SoA）内存模型存储，减少分配，缓存友好
- 技术指标：MA/RSI/MACD/ATR/BOLL/VRI，以及预置 VWAP/OBV/MFI/Williams %R/CCI/ROC
- 多周期聚合器：从细粒度到粗粒度的 K 线合成
- 策略系统：支持闭包式策略（`FnStrategy`）与内置策略
- 回测引擎：现货/合约（手续费、滑点、爆仓模拟与基础统计）

## 目录结构

- `src/lib.rs`：框架入口与 `QuantEngine`
- `src/kline.rs`：K 线结构与序列管理
- `src/common/`：环形缓冲区实现
- `src/indicators/`：指标实现与动态指标支持
- `src/aggregator/`：多周期聚合器
- `src/strategy/`：策略接口与内置策略
- `src/backtest/`：回测引擎与统计

## 快速开始（Rust）

在自己的 `Cargo.toml` 中引用本地路径：

```toml
hquant = { path = "packages/hquant-rust" }
```

推荐用法：使用 Builder 添加指标（避免调用已标记 `deprecated` 的 `add_ma`/`add_rsi`/…）。

```rust
use hquant::{
    QuantEngine, Bar, TimeFrame, BacktestConfig, Signal,
    strategy::FnStrategy,
    ma,
};

fn main() {
    // 初始化
    let mut engine = QuantEngine::new(1_000);

    // 指标（Builder 模式）
    engine.add_indicator("ma_fast", ma().period(5).sma());
    engine.add_indicator("ma_slow", ma().period(20).sma());

    // 多周期聚合与回测
    engine.setup_aggregator(TimeFrame::M15, &[TimeFrame::H1, TimeFrame::H4], 200);
    engine.setup_backtest(BacktestConfig::spot(10_000.0));

    // 策略（示例：MA 交叉 + 强度计算）
    engine.add_strategy(Box::new(FnStrategy::new("ma_cross", |ctx| {
        let fast = ctx.indicators.value("ma_fast")?;
        let slow = ctx.indicators.value("ma_slow")?;
        if fast > slow * 1.01 {
            Some(Signal::buy(0.8, "ma_cross_up", ctx.bar.timestamp))
        } else if fast < slow * 0.99 {
            Some(Signal::sell(0.8, "ma_cross_down", ctx.bar.timestamp))
        } else {
            None
        }
    })));

    // 追加 K 线数据（示例数据）
    let bars: Vec<Bar> = (0..200)
        .map(|i| {
            Bar::new(
                i * 15 * 60_000,
                100.0 + i as f64,
                102.0 + i as f64,
                98.0 + i as f64,
                101.0 + i as f64,
                1_000.0 + i as f64 * 10.0,
            )
        })
        .collect();
    engine.load_history(&bars);

    // 获取结果
    println!("MA fast: {:?}", engine.indicator_value("ma_fast"));
    if let Some(agg) = engine.aggregator() {
        println!("H1 bars: {}", agg.output(TimeFrame::H1).unwrap().len());
    }
    if let Some(stats) = engine.backtest_result() {
        println!("Total trades: {}", stats.total_trades);
        println!("Return: {:.2}%", stats.return_pct);
        println!("Max drawdown: {:.2}%", stats.max_drawdown_pct);
    }
}
```

## 迁移提示（废弃方法）

`QuantEngine` 中 `add_ma`/`add_rsi`/`add_macd`/`add_atr`/`add_boll`/`add_vri` 已标记为 `deprecated`。

请替换为 Builder：

```rust
use hquant::{QuantEngine, ma, rsi, macd, atr, boll, vri};

let mut engine = QuantEngine::new(1000);
engine.add_indicator("ma", ma().period(20).ema());
engine.add_indicator("rsi", rsi().period(14));
engine.add_indicator("macd", macd().fast(12).slow(26).signal(9));
engine.add_indicator("atr", atr().period(14));
engine.add_indicator("boll", boll().period(20).std_dev(2.0));
engine.add_indicator("vri", vri().period(14));
```

## 构建与测试

```bash
cargo build
cargo test

# 构建多语言封装库
scripts/build-ffi.sh node
scripts/build-ffi.sh python
scripts/build-ffi.sh go
scripts/build-ffi.sh all
```

## 多语言绑定

### Node.js（napi-rs）

- 构建：`scripts/build-ffi.sh node` → `target/release/hquant.node`
- 使用：

```js
const { Engine, Indicators } = require('./target/release/hquant.node');

const eng = new Engine(1000);
const ind = new Indicators();

eng.add_ma_indicator('ma_fast', ind.ma().period(5).sma());
eng.add_ma_indicator('ma_slow', ind.ma().period(20).sma());

eng.append_bar({
  timestamp: Date.now(),
  open: 1,
  high: 1.1,
  low: 0.9,
  close: 1.05,
  volume: 1000,
});

console.log('MA ready?', eng.indicator_ready('ma_fast'));
console.log('MA value', eng.indicator_value('ma_fast'));
```

### Python（PyO3）

- 构建：`scripts/build-ffi.sh python`
  - 若已安装 `maturin`：会直接安装到当前 Python 环境
  - 否则会生成 `target/release/hquant_py.so`（macOS/Linux），然后将该目录加入 `PYTHONPATH`

```bash
export PYTHONPATH=$(pwd)/target/release:$PYTHONPATH
```

- 使用：

```python
from hquant_py import PyEngine, PyBar, PyMAIndicator

eng = PyEngine(1000)
eng.add_ma_indicator("ma_fast", PyMAIndicator().period(5).sma())

eng.append_bar(PyBar(1, 1.0, 1.1, 0.9, 1.05, 1000.0))
print("MA ready?", eng.indicator_ready("ma_fast"))
print("MA value", eng.indicator_value("ma_fast"))
```

### Go（cgo / C ABI）

- 构建：`scripts/build-ffi.sh go` → `target/release/libhquant.(dylib|so)`
- 说明：Go 绑定当前提供的是精简 C ABI（创建/释放引擎、推送 K 线、读取指标值等）。

```go
/*
#cgo LDFLAGS: -L${SRCDIR}/target/release -lhquant
#include <stdint.h>

typedef struct {
  int64_t timestamp;
  double open, high, low, close, volume;
} FfiBar;

extern void* hquant_engine_new(uintptr_t capacity);
extern void hquant_engine_free(void* ptr);
extern void hquant_engine_append_bar(void* ptr, FfiBar bar);
*/
import "C"

func main() {
  eng := C.hquant_engine_new(1000)
  defer C.hquant_engine_free(eng)

  bar := C.FfiBar{timestamp: 1, open: 1, high: 1.1, low: 0.9, close: 1.05, volume: 1000}
  C.hquant_engine_append_bar(eng, bar)
}
```

macOS 运行时若找不到动态库，可临时设置：

```bash
export DYLD_LIBRARY_PATH=$(pwd)/target/release:$DYLD_LIBRARY_PATH
```

## 开发提示

- `QuantEngine::append_bar` 用于流式追加新 K 线；`update_last_bar` 便于实时行情校正。
- 多周期聚合器只接受基础周期 K 线输入，并自动维护目标周期输出。
- 回测支持现货与合约；通过 `BacktestConfig` 配置资金、杠杆与费率。

## 扩展新指标

1) 在 `src/indicators/` 下实现 `Indicator` trait（参考 `ma.rs`/`rsi.rs`）。
2) 在 `src/indicators/mod.rs` 中注册并导出。
3) 在 Rust 中通过 `add_indicator_boxed(name, Box<dyn Indicator>)` 或实现一个 Builder（推荐）再用 `add_indicator(name, builder)`。

如果逻辑很简单、只依赖完整 K 线序列，可使用 `add_dynamic_indicator`：

```rust
engine.add_dynamic_indicator("custom", 1, |klines| {
    // ...
    Some(1.0)
});
```