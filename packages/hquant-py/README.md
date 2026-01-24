# hquant

High-performance quantitative trading engine for Python, powered by Rust.

## Features

- **Technical Indicators**: MA, EMA, RSI, MACD, ATR, Bollinger Bands, VWAP, OBV, MFI, Williams %R, CCI, ROC
- **Multi-TimeFrame Aggregation**: Convert M1 data to M5, M15, H1, H4, D1, W1
- **Backtesting Engine**: Spot and futures support with leverage, fees, slippage, and liquidation simulation
- **High Performance**: Rust-powered with zero-copy ring buffers

## Installation

```bash
# From source (requires Rust toolchain)
cd packages/hquant-py
pip install maturin
maturin develop

# Or build wheel
maturin build --release
pip install target/wheels/hquant-*.whl
```

## Quick Start

### Basic Indicator Usage

```python
from hquant import QuantEngine, Bar, MABuilder, RSIBuilder, MACDBuilder, BOLLBuilder

# Create engine with 1000-bar capacity
engine = QuantEngine(1000)

# Add indicators using unified add_indicator API
engine.add_indicator("sma20", MABuilder().period(20).sma())
engine.add_indicator("ema50", MABuilder().period(50).ema())
engine.add_indicator("rsi14", RSIBuilder().period(14))
engine.add_indicator("macd", MACDBuilder().fast(12).slow(26).signal(9))
engine.add_indicator("boll20", BOLLBuilder().period(20).std_dev(2.0))

# Add dynamic indicators
engine.add_vwap("vwap")
engine.add_obv("obv")
engine.add_mfi("mfi14", 14)

# Process bars
bar = Bar(
    timestamp=1704067200000,  # milliseconds
    open=100.0,
    high=101.5,
    low=99.5,
    close=101.0,
    volume=1000.0
)
signals = engine.append_bar(bar)

# Get indicator values
if engine.indicator_ready("rsi14"):
    rsi_value = engine.indicator_value("rsi14")
    print(f"RSI: {rsi_value}")

# Get Bollinger Bands (value + extra data)
boll_result = engine.indicator_result("boll20")
if boll_result:
    middle = boll_result.value
    upper, lower = boll_result.extra[0], boll_result.extra[1]
    print(f"BOLL: {lower:.2f} - {middle:.2f} - {upper:.2f}")
```

### Using Indicators Factory

```python
from hquant import QuantEngine, Indicators

engine = QuantEngine(1000)
indicators = Indicators()

# Create indicators via factory
engine.add_indicator("sma20", indicators.ma().period(20).sma())
engine.add_indicator("rsi14", indicators.rsi().period(14))
engine.add_indicator("macd", indicators.macd().fast(12).slow(26).signal(9))
engine.add_indicator("atr14", indicators.atr().period(14))
engine.add_indicator("boll20", indicators.boll().period(20).std_dev(2.0))
```

### Backtesting

```python
from hquant import QuantEngine, Bar, BacktestConfig, MABuilder

# Create engine
engine = QuantEngine(1000)
engine.add_indicator("sma20", MABuilder().period(20).sma())
engine.add_indicator("sma50", MABuilder().period(50).sma())

# Setup backtest
config = BacktestConfig.spot(initial_capital=10000.0)
# Or for futures: BacktestConfig.futures(10000.0, leverage=10.0)
engine.setup_backtest(config)

# Load historical data
bars = [
    Bar(ts, o, h, l, c, v)
    for ts, o, h, l, c, v in historical_data
]
signals = engine.load_history(bars)

# Get results
stats = engine.backtest_result()
print(f"Total trades: {stats.total_trades}")
print(f"Win rate: {stats.win_rate * 100:.1f}%")
print(f"Total PnL: ${stats.total_pnl:.2f}")
print(f"Sharpe ratio: {stats.sharpe_ratio:.2f}")
print(f"Max drawdown: {stats.max_drawdown_pct * 100:.1f}%")

# Get trades and equity curve
trades = engine.backtest_trades()
equity_curve = engine.backtest_equity_curve()
```

### Multi-TimeFrame Aggregation

```python
from hquant import MultiTimeFrameAggregator, TimeFrame, Bar

# Create aggregator: M1 -> H1, H4
agg = MultiTimeFrameAggregator(
    base_tf=TimeFrame.M1,
    target_tfs=[TimeFrame.H1, TimeFrame.H4],
    capacity=100
)

# Push M1 bars
for bar in m1_bars:
    completed = agg.push(bar)
    if "H1" in completed:
        h1_bars = agg.output(TimeFrame.H1)
        print(f"New H1 bar: {h1_bars[-1]}")
```

### Custom Backtest with Standalone Engine

```python
from hquant import BacktestEngine, BacktestConfig, Bar

config = BacktestConfig(
    initial_capital=10000.0,
    market_type="futures",
    leverage=10.0,
    maker_fee=0.0002,
    taker_fee=0.0004,
    slippage=0.0005,
    position_size_pct=0.2
)

bt = BacktestEngine(config)

for bar in bars:
    # Your custom strategy logic
    if should_buy(bar):
        bt.process_signal("BUY", strength=0.8, bar=bar)
    elif should_sell(bar):
        bt.process_signal("SELL", strength=0.8, bar=bar)

    # Check position
    pos = bt.position()
    if pos:
        print(f"Position: {pos.side} {pos.size} @ {pos.entry_price}")
        print(f"Unrealized PnL: {pos.unrealized_pnl}")

print(bt.result())
```

## API Reference

### Indicator Builders

All indicators use the builder pattern with `add_indicator`:

```python
engine.add_indicator("name", Builder().option1(value).option2(value))
```

| Indicator | Builder | Methods |
|-----------|---------|---------|
| MA | `MABuilder()` | `.period(n)`, `.sma()`, `.ema()`, `.wma()` |
| RSI | `RSIBuilder()` | `.period(n)` |
| MACD | `MACDBuilder()` | `.fast(n)`, `.slow(n)`, `.signal(n)` |
| ATR | `ATRBuilder()` | `.period(n)` |
| BOLL | `BOLLBuilder()` | `.period(n)`, `.std_dev(f)` |
| VRI | `VRIBuilder()` | `.period(n)` |

### Dynamic Indicators

| Method | Description |
|--------|-------------|
| `add_vwap(name)` | Volume-Weighted Average Price |
| `add_obv(name)` | On-Balance Volume |
| `add_mfi(name, period)` | Money Flow Index |
| `add_williams_r(name, period)` | Williams %R |
| `add_cci(name, period)` | Commodity Channel Index |
| `add_roc(name, period)` | Rate of Change |

### TimeFrames

- `M1`, `M5`, `M15`, `M30` - Minutes
- `H1`, `H4` - Hours
- `D1`, `W1` - Day, Week

## Performance

The library uses optimized Rust implementations:

- Ring buffers for O(1) append operations
- Struct-of-Arrays (SoA) layout for cache efficiency
- Zero-copy data access where possible
- Thread-safe with minimal locking

## License

MIT
