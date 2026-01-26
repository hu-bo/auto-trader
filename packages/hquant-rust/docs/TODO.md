

## 数据结构
pub struct Bar {
    pub timestamp: i64,
    pub open: f64,
    pub high: f64,
    pub low: f64,
    pub close: f64,
    pub volume: f64,
    pub buy_volume: f64,
}

- 正确性与一致性（最重要）
      - 为每个指标建立“权威参考”对照：与 TA-Lib/TradingView/Pandas 实现做逐点比对（尤其是初始化窗口、边界
        值、NaN/0 除、精度误差容忍）。
      - 明确并文档化每个指标的约定：输入是 close 还是 hlc3，输出 timestamp 取当前 bar 还是对齐窗口末端，
        min_periods 的严格定义。
      - 增强“回放可复现”：同一输入序列、同一参数、跨语言绑定（Node/Py/Go）输出必须一致。
  - 数据质量与市场细节
      - 缺失/乱序/重复 timestamp 的处理策略（忽略、覆盖、报错、插值）要统一；指标层至少要定义“假设输入已清
        洗”还是“自带防御”。
      - 多周期聚合与指标计算的对齐规则：例如聚合未完成 bar 是否参与指标、实时 update_last 下指标回滚/重算
        的语义。
  - API 形态借鉴（更像专业指标引擎）
      - 同一指标提供两种模式：流式 push/update_last（你已有）与批量 compute(series)（便于离线研究、参数扫
        描、回归测试）。
      - 统一的输出结构：标量/多输出（如 MACD 三线、BOLL 三线）建议用固定结构而不是 Vec<f64>，减少歧义与跨
        语言解包成本。
  - 性能工程（你已有好基础）
      - 借鉴 vectorbt/NumPy 的思路做“批量参数扫描”友好：一次性算多组 period、或同一指标多配置共享中间结果
        （比如 EMA 族）。
      - 基准测试体系（criterion）：把常用指标在不同窗口、不同频率、不同容量下的吞吐/延迟固化，避免后续优化
        回退。
  - 指标覆盖面与生态兼容
      - 借鉴 TA-Lib、TradingView、Tulip Indicators：把“常用集合”补齐（ADX/DMI、Stoch、Ichimoku、
        SuperTrend、KDJ、SAR、Donchian、Keltner、CMF 等），并与社区命名保持一致，降低迁移成本。