use hquant::vector_store::LabeledVector;
/// # MultiHQuant 完整语法示例
///
/// 本文件展示了 MultiHQuant DSL 的所有支持语法特性，包括：
/// - 多周期指标引用 (@period)
/// - 所有内置指标 (RSI/SMA/EMA/STDDEV)
/// - 形态识别 (NORMALIZE + SIMILARITY)
/// - 逻辑运算 (AND/OR/NOT)
/// - 变量定义 (LET)
/// - 元数据传递
///
/// 运行方式：
/// ```bash
/// cd packages/hquant-rs
/// cargo run --example comprehensive_strategy
/// ```
use hquant::{Bar, MultiHQuant, Period};

fn main() -> Result<(), Box<dyn std::error::Error>> {
    println!("=== MultiHQuant 完整语法示例 ===\n");

    // ============================================
    // 1. 创建 MultiHQuant，支持多个周期
    // ============================================
    let periods = vec![
        Period::parse("1h")?, // 1小时（基础周期）
        Period::parse("4h")?, // 4小时
        Period::parse("1d")?, // 1天
    ];
    let mut multi = MultiHQuant::new(500, periods);
    println!("✓ 创建 MultiHQuant，支持周期: 1h, 4h, 1d\n");

    // ============================================
    // 2. 加载向量存储（用于形态识别）
    // ============================================
    let patterns = vec![
        LabeledVector {
            label: 1, // 看涨形态
            vector: vec![0.1, 0.2, 0.3, 0.5, 0.8],
            ts: None,
        },
        LabeledVector {
            label: -1, // 看跌形态
            vector: vec![0.9, 0.7, 0.5, 0.3, 0.1],
            ts: None,
        },
    ];
    multi.load_store("bull_bear_patterns", patterns)?;
    multi.set_similarity_threshold(0.85)?;
    println!("✓ 加载向量存储：2 个形态模式\n");

    // ============================================
    // 3. 定义包含所有语法特性的策略 DSL
    // ============================================
    // 注意：DSL 不支持行内注释，所有注释必须独占一行
    let strategy_dsl = r#"
# ============================================
# MultiHQuant DSL 完整语法示例
# ============================================
# 本策略展示所有支持的 DSL 语法特性

# -------------------- 变量定义 --------------------
# LET 关键字定义可复用的中间变量

# 基础周期指标（1小时）
# 1小时 RSI
LET rsi_1h = RSI(14)
# 20周期 SMA（默认 close）
LET sma_20 = SMA(20)
# 12周期 EMA
LET ema_12 = EMA(close, 12)
# 20周期标准差
LET volatility = STDDEV(close, 20)

# 多周期指标（需显式指定 @period）
# 4小时 RSI
LET rsi_4h = RSI(close@4h, 14)
# 1天 RSI（关键字参数）
LET rsi_1d = RSI(close@1d, period=14)
# 4小时 50周期 SMA
LET sma_50_4h = SMA(close@4h, 50)
# 4小时 26周期 EMA
LET ema_26_4h = EMA(close@4h, period=26)

# 字段引用（所有支持的字段）
# 收盘价
LET current_close = close
# 最高价
LET current_high = high
# 最低价
LET current_low = low
# 开盘价
LET current_open = open
# 成交量
LET current_volume = volume
# 主动买入量
LET current_buy_volume = buy_volume

# 多周期字段引用
# 4小时最高价
LET high_4h = high@4h
# 1天最低价
LET low_1d = low@1d
# 4小时成交量
LET volume_4h = volume@4h

# -------------------- 形态识别（NORMALIZE + SIMILARITY）--------------------

# NORMALIZE：提取并归一化价格序列
# MinMax 归一化 [0,1]
LET price_vector_minmax = NORMALIZE(close, 30, method="minmax")
# ZScore 归一化 μ=0,σ=1
LET price_vector_zscore = NORMALIZE(close, 30, method="zscore")
# L2 单位向量归一化
LET price_vector_l2 = NORMALIZE(close, 30, method="l2")

# SIMILARITY：计算与存储向量的相似度
LET pattern_cosine = SIMILARITY("bull_bear_patterns", NORMALIZE(close, 30), method="cosine", threshold=0.8)

LET pattern_pearson = SIMILARITY(VEC_STORE("bull_bear_patterns"), NORMALIZE(close@4h, 50, method="zscore"), method="pearson")

# -------------------- 规则 1：多周期 RSI 超买超卖 --------------------
# 语法：IF <条件> THEN <动作>
# 比较运算符：< <= > >= == !=
# 逻辑运算符：AND OR NOT !

IF rsi_1h < 30 AND rsi_4h < 40 AND rsi_1d < 50 THEN BUY(multi-period oversold)

IF rsi_1h > 70 AND rsi_4h > 60 THEN SELL(multi-period overbought)

# -------------------- 规则 2：均线交叉策略 --------------------
# 金叉：短期均线上穿长期均线
IF ema_12 > sma_20 AND close > sma_50_4h THEN BUY(golden cross with trend)

# 死叉：短期均线下穿长期均线
IF ema_12 < sma_20 THEN SELL(death cross)

# -------------------- 规则 3：价格突破策略 --------------------
# 突破 4小时高点且有成交量配合
IF close > high_4h AND current_volume > 1000000 THEN BUY(breakout with volume)

# 跌破 1天低点
IF close < low_1d THEN SELL(breakdown below daily low)

# -------------------- 规则 4：波动率过滤 --------------------
# 低波动环境下的超卖买入
IF volatility < 10.5 AND rsi_1h < 35 THEN BUY(low volatility oversold entry)

# 高波动环境下止损
IF volatility > 50.0 THEN SELL(high volatility exit)

# -------------------- 规则 5：复杂逻辑组合 --------------------
# 使用括号分组 NOT 运算符
IF (rsi_1h < 30 OR rsi_4h < 35) AND NOT (volatility > 30) THEN BUY(oversold with acceptable volatility)

# ! 也可以表示 NOT
IF !(close < sma_20) AND ema_12 > ema_26_4h THEN BUY(above support with bullish trend)

# -------------------- 规则 6：数值比较 --------------------
# 直接与字面量数值比较
IF close >= 50000.0 AND close <= 55000.0 THEN HOLD(price in target range)

IF volume == 0 THEN HOLD(no trading volume)

IF buy_volume != 0 THEN BUY(active buying detected)

# -------------------- 规则 7：形态识别策略 --------------------
# 检测到看涨形态时买入
IF pattern_cosine >= 0.9 THEN BUY(bullish pattern detected)

# 检测到看跌形态时卖出
IF pattern_pearson >= 0.85 THEN SELL(bearish pattern detected)

# -------------------- 规则 8：多条件综合决策 --------------------
# 多个条件同时满足才触发
IF rsi_1h < 30 AND close > sma_20 AND ema_12 > sma_20 AND volatility < 15 AND pattern_cosine > 0.8 AND current_volume > 500000 THEN BUY(comprehensive bullish signal)

# -------------------- 规则 9：OR逻辑任一条件触发 --------------------
# 满足任一卖出条件即平仓
IF rsi_1h > 80 OR rsi_4h > 75 OR close < sma_50_4h OR volatility > 60 THEN SELL(any bearish condition triggered)

# -------------------- 规则 10：动作元数据 --------------------
# 可以为信号附加描述信息
IF rsi_1h < 20 THEN BUY(extreme oversold)

IF rsi_1h > 85 THEN SELL(extreme overbought)

# -------------------- 规则 11：成交量分析 --------------------
IF current_volume > volume_4h AND rsi_1h < 40 THEN BUY(volume spike on dip)

IF current_buy_volume > current_volume AND rsi_1h > 60 THEN SELL(selling pressure increase)

# -------------------- 规则 12：跨周期趋势确认 --------------------
# 多周期趋势一致性
IF close > sma_20 AND close@4h > sma_50_4h AND low > low_1d THEN BUY(multi-timeframe bullish)

# 多周期背离
IF rsi_1h > 70 AND rsi_4h < 50 THEN SELL(divergence detected)
"#;

    println!("✓ 定义策略 DSL（包含所有语法特性）\n");

    // ============================================
    // 4. 添加策略到引擎
    // ============================================
    let strategy_id = multi.add_multi_strategy("comprehensive_demo_strategy", strategy_dsl)?;
    println!("✓ 策略已添加，ID: {}\n", strategy_id);

    // ============================================
    // 5. 准备并加载历史数据
    // ============================================
    println!("=== 加载历史数据 ===");
    let mut historical_bars = Vec::new();
    let base_timestamp = 1700000000000i64; // 起始时间戳
    let one_hour_ms = 3600_000i64;

    // 生成 100 根历史 bar
    for i in 0..100 {
        let bar = Bar {
            timestamp: base_timestamp + (i * one_hour_ms),
            open: 50000.0 + (i as f64 * 10.0),
            high: 50000.0 + (i as f64 * 10.0) + 100.0,
            low: 50000.0 + (i as f64 * 10.0) - 100.0,
            close: 50000.0 + (i as f64 * 10.0) + 50.0,
            volume: 1000000.0 + (i as f64 * 10000.0),
            buy_volume: 500000.0 + (i as f64 * 5000.0),
        };
        historical_bars.push(bar);
    }

    multi.load_history(&historical_bars);
    println!("✓ 已加载 {} 根历史 bar\n", historical_bars.len());

    // ============================================
    // 6. 模拟实时数据流
    // ============================================
    println!("=== 模拟实时数据流 ===");

    // 创建一些会触发信号的 bar
    let test_bars = vec![
        Bar {
            timestamp: base_timestamp + (100 * one_hour_ms),
            open: 51000.0,
            high: 51500.0,
            low: 50800.0,
            close: 51200.0,    // 价格上涨
            volume: 2500000.0, // 大成交量
            buy_volume: 1500000.0,
        },
        Bar {
            timestamp: base_timestamp + (101 * one_hour_ms),
            open: 51200.0,
            high: 51800.0,
            low: 51000.0,
            close: 51600.0,
            volume: 3000000.0,
            buy_volume: 1800000.0,
        },
        Bar {
            timestamp: base_timestamp + (102 * one_hour_ms),
            open: 51600.0,
            high: 52000.0,
            low: 51400.0,
            close: 51800.0,
            volume: 2200000.0,
            buy_volume: 1300000.0,
        },
    ];

    for (i, bar) in test_bars.iter().enumerate() {
        println!(
            "喂入 Bar #{}: close={}, volume={}",
            i + 1,
            bar.close,
            bar.volume
        );
        multi.feed_bar(*bar);

        // 检查信号
        let signals = multi.poll_signals();
        if !signals.is_empty() {
            println!("  ⚡ 产生了 {} 个信号:", signals.len());
            for signal in signals {
                println!(
                    "    - 策略ID: {}, 动作: {:?}, 时间: {}, 元数据: {:?}",
                    signal.strategy_id, signal.action, signal.timestamp, signal.meta
                );
            }
        } else {
            println!("  ℹ 未产生信号");
        }
        println!();
    }

    // ============================================
    // 7. 总结
    // ============================================
    println!("=== 示例完成 ===");
    println!("\n本示例展示了以下 DSL 特性：");
    println!("✓ 变量定义 (LET)");
    println!("✓ 多周期引用 (@1h, @4h, @1d)");
    println!("✓ 所有字段类型 (open, high, low, close, volume, buy_volume)");
    println!("✓ 指标函数 (RSI, SMA, EMA, STDDEV)");
    println!("✓ 形态识别 (NORMALIZE + SIMILARITY)");
    println!("✓ 归一化方法 (minmax, zscore, l2)");
    println!("✓ 相似度方法 (cosine, pearson)");
    println!("✓ 比较运算符 (<, <=, >, >=, ==, !=)");
    println!("✓ 逻辑运算符 (AND, OR, NOT/!)");
    println!("✓ 动作类型 (BUY, SELL, HOLD)");
    println!("✓ 元数据传递 (action metadata)");
    println!("✓ 注释 (#, //)");
    println!("\n完整语法参考见：packages/hquant-rs/SKILL.md");

    Ok(())
}
