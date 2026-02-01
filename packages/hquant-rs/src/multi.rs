use std::collections::{HashMap, VecDeque};

use crate::aggregator::Aggregator;
use crate::dsl::{compile_multi_strategy, CompiledStrategy, EvalContext, MultiIndicatorResolver, StrategyError};
use crate::hquant::HQuant;
use crate::indicators::{IndicatorId, IndicatorSpec};
use crate::period::Period;
use crate::types::{Bar, Signal};
use crate::vector_store::LabeledVector;

#[derive(Clone, Debug)]
pub struct MultiHQuant {
    periods: Vec<Period>,
    period_to_idx: HashMap<i64, u32>,
    engines: HashMap<i64, HQuant>,
    aggregator: Aggregator,
    signals: VecDeque<Signal>,
    multi_strategies: Vec<CompiledStrategy>,
    next_multi_strategy_id: u32,
}

impl MultiHQuant {
    pub fn new(capacity: usize, periods: Vec<Period>) -> Self {
        assert!(!periods.is_empty(), "periods must be non-empty");

        let mut period_to_idx = HashMap::new();
        let mut engines = HashMap::new();
        for (i, p) in periods.iter().copied().enumerate() {
            period_to_idx.insert(p.as_ms(), (i as u32) + 1);
            engines.insert(p.as_ms(), HQuant::new(capacity));
        }
        Self {
            aggregator: Aggregator::new(periods.clone()),
            periods,
            period_to_idx,
            engines,
            signals: VecDeque::new(),
            multi_strategies: Vec::new(),
            next_multi_strategy_id: 1,
        }
    }

    pub fn feed_bar(&mut self, bar: Bar) {
        let base_ms = self.periods[0].as_ms();
        self.route_bar(base_ms, bar);

        self.aggregator.push(&bar);
        for ev in self.aggregator.poll_events() {
            let p_ms = ev.period.as_ms();
            self.route_bar(p_ms, ev.candle.into());
        }

        self.eval_multi_strategies();
    }

    /// Load historical bars in batch. This is more efficient than calling `feed_bar` repeatedly
    /// because it skips strategy evaluation during loading.
    pub fn load_history(&mut self, bars: &[Bar]) {
        let base_ms = self.periods[0].as_ms();
        for &bar in bars {
            // Route to base period engine (use load_history_bar for efficiency)
            if let Some(engine) = self.engines.get_mut(&base_ms) {
                engine.load_history_bar(bar);
            }

            // Push to aggregator and route aggregated bars to higher period engines
            self.aggregator.push(&bar);
            for ev in self.aggregator.poll_events() {
                let p_ms = ev.period.as_ms();
                if let Some(engine) = self.engines.get_mut(&p_ms) {
                    engine.load_history_bar(ev.candle.into());
                }
            }
        }
    }

    pub fn add_indicator(&mut self, spec: IndicatorSpec) -> HashMap<i64, IndicatorId> {
        let mut out = HashMap::new();
        for (p_ms, engine) in self.engines.iter_mut() {
            let id = engine.add_indicator(spec.clone());
            out.insert(*p_ms, id);
        }
        out
    }

    pub fn add_strategy(&mut self, name: &str, dsl: &str) -> Result<u32, StrategyError> {
        let base_ms = self.periods[0].as_ms();
        let Some(engine) = self.engines.get_mut(&base_ms) else {
            return Err(StrategyError::InvalidArgs("missing base engine".to_string()));
        };
        let local_id = engine.add_strategy(name, dsl)?;
        let idx = self.period_to_idx.get(&base_ms).copied().unwrap_or(0);
        Ok(encode_strategy_id(idx, local_id))
    }

    pub fn add_multi_strategy(&mut self, name: &str, dsl: &str) -> Result<u32, StrategyError> {
        let id = self.next_multi_strategy_id;
        self.next_multi_strategy_id = self.next_multi_strategy_id.saturating_add(1);

        let base_period = self.periods[0];
        let mut resolver = EnginesResolver {
            engines: &mut self.engines,
        };
        let compiled = compile_multi_strategy(id, name, dsl, base_period, &mut resolver)?;
        self.multi_strategies.push(compiled);
        Ok(encode_strategy_id(0, id))
    }

    pub fn load_store(&mut self, name: &str, vectors: Vec<LabeledVector>) -> Result<(), StrategyError> {
        let base_ms = self.periods[0].as_ms();
        let Some(engine) = self.engines.get_mut(&base_ms) else {
            return Err(StrategyError::InvalidArgs("missing base engine".to_string()));
        };
        engine.load_store(name, vectors);
        Ok(())
    }

    pub fn set_similarity_threshold(&mut self, threshold: f64) -> Result<(), StrategyError> {
        let base_ms = self.periods[0].as_ms();
        let Some(engine) = self.engines.get_mut(&base_ms) else {
            return Err(StrategyError::InvalidArgs("missing base engine".to_string()));
        };
        engine.set_similarity_threshold(threshold);
        Ok(())
    }

    pub fn update_last(&mut self, bar: Bar) {
        let base_ms = self.periods[0].as_ms();
        self.route_update_last(base_ms, bar);
        self.aggregator.update_last(&bar);
        self.eval_multi_strategies();
    }

    pub fn flush(&mut self) {
        self.aggregator.flush();
        for ev in self.aggregator.poll_events() {
            let p_ms = ev.period.as_ms();
            self.route_bar(p_ms, ev.candle.into());
        }
        self.eval_multi_strategies();
    }

    pub fn poll_signals(&mut self) -> Vec<Signal> {
        self.signals.drain(..).collect()
    }

    fn route_bar(&mut self, period_ms: i64, bar: Bar) {
        let Some(engine) = self.engines.get_mut(&period_ms) else {
            return;
        };
        engine.push_kline(bar);
        let idx = self.period_to_idx.get(&period_ms).copied().unwrap_or(0);
        for mut sig in engine.poll_signals() {
            sig.strategy_id = encode_strategy_id(idx, sig.strategy_id);
            self.signals.push_back(sig);
        }
    }

    fn route_update_last(&mut self, period_ms: i64, bar: Bar) {
        let Some(engine) = self.engines.get_mut(&period_ms) else {
            return;
        };
        engine.update_last(bar);
        let idx = self.period_to_idx.get(&period_ms).copied().unwrap_or(0);
        for mut sig in engine.poll_signals() {
            sig.strategy_id = encode_strategy_id(idx, sig.strategy_id);
            self.signals.push_back(sig);
        }
    }

    fn eval_multi_strategies(&mut self) {
        if self.multi_strategies.is_empty() {
            return;
        }
        let base = self.periods[0];
        let ctx = MultiEvalContext {
            base,
            engines: &self.engines,
        };
        let store = self
            .engines
            .get(&base.as_ms())
            .map(|e| e.store());
        for s in &self.multi_strategies {
            if let Some(sig) = s.evaluate_with_ctx(&ctx, store) {
                self.signals.push_back(sig);
            }
        }
    }
}

fn encode_strategy_id(idx: u32, local_id: u32) -> u32 {
    (idx << 24) | (local_id & 0x00FF_FFFF)
}

struct EnginesResolver<'a> {
    engines: &'a mut HashMap<i64, HQuant>,
}

impl MultiIndicatorResolver for EnginesResolver<'_> {
    fn has_period(&self, period: Period) -> bool {
        self.engines.contains_key(&period.as_ms())
    }

    fn add_indicator(&mut self, period: Period, spec: IndicatorSpec) -> IndicatorId {
        self.engines
            .get_mut(&period.as_ms())
            .expect("period engine missing")
            .add_indicator(spec)
    }
}

struct MultiEvalContext<'a> {
    base: Period,
    engines: &'a HashMap<i64, HQuant>,
}

impl EvalContext for MultiEvalContext<'_> {
    fn bars(&self, period: Option<Period>) -> Option<&crate::kline_buffer::KlineBuffer> {
        let p = period.unwrap_or(self.base);
        self.engines.get(&p.as_ms()).map(|e| e.bars())
    }

    fn indicator_last(&self, period: Option<Period>, id: IndicatorId) -> Option<crate::indicators::IndicatorValue> {
        let p = period.unwrap_or(self.base);
        self.engines.get(&p.as_ms())?.indicator_last(id)
    }
}
