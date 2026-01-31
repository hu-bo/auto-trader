use std::collections::VecDeque;

use crate::dsl::{compile_strategy, CompiledStrategy, StrategyError};
use crate::indicators::{IndicatorGraph, IndicatorId, IndicatorSpec, IndicatorValue};
use crate::kline_buffer::KlineBuffer;
use crate::types::{Bar, Signal};
use crate::vector_store::{LabeledVector, SimilarityMethod, SimilarityResult, VectorStore};

#[derive(Clone, Debug)]
pub struct HQuant {
    bars: KlineBuffer,
    indicators: IndicatorGraph,
    strategies: Vec<CompiledStrategy>,
    signals: VecDeque<Signal>,
    next_strategy_id: u32,
    store: VectorStore,
}

impl HQuant {
    pub fn new(capacity: usize) -> Self {
        Self {
            bars: KlineBuffer::new(capacity),
            indicators: IndicatorGraph::new(capacity),
            strategies: Vec::new(),
            signals: VecDeque::new(),
            next_strategy_id: 1,
            store: VectorStore::new(),
        }
    }

    pub fn capacity(&self) -> usize {
        self.bars.capacity()
    }

    pub fn len(&self) -> usize {
        self.bars.len()
    }

    pub fn bars(&self) -> &KlineBuffer {
        &self.bars
    }

    pub fn store(&self) -> &VectorStore {
        &self.store
    }

    pub fn add_indicator(&mut self, spec: IndicatorSpec) -> IndicatorId {
        self.indicators.add_indicator(spec)
    }

    pub fn indicator_last(&self, id: IndicatorId) -> Option<IndicatorValue> {
        self.indicators.indicator_last(id)
    }

    pub fn load_store(&mut self, name: &str, vectors: Vec<LabeledVector>) {
        self.store.load(name, vectors);
    }

    pub fn set_similarity_threshold(&mut self, threshold: f64) {
        self.store.threshold = threshold;
    }

    pub fn find_similar(
        &self,
        name: &str,
        query: &[f64],
        method: SimilarityMethod,
        threshold: Option<f64>,
    ) -> Option<SimilarityResult> {
        match threshold {
            Some(t) => self.store.find_similar_by_threshold(name, query, method, t),
            None => self.store.find_similar_by(name, query, method),
        }
    }

    pub fn add_strategy(&mut self, name: &str, dsl: &str) -> Result<u32, StrategyError> {
        let id = self.next_strategy_id;
        self.next_strategy_id = self.next_strategy_id.saturating_add(1);
        let compiled = compile_strategy(id, name, dsl, &mut self.indicators)?;
        self.strategies.push(compiled);
        Ok(id)
    }

    pub fn push_kline(&mut self, bar: Bar) {
        self.bars.push(bar);
        self.indicators.on_push(&self.bars);
        self.eval_strategies();
    }

    pub fn update_last(&mut self, bar: Bar) {
        let Some(old) = self.bars.update_last(bar) else {
            return;
        };
        self.indicators.on_update_last(old, bar, &self.bars);
        self.eval_strategies();
    }

    pub fn poll_signals(&mut self) -> Vec<Signal> {
        self.signals.drain(..).collect()
    }

    pub fn reset(&mut self) {
        self.bars.clear();
        self.indicators.reset();
        self.strategies.clear();
        self.signals.clear();
        self.next_strategy_id = 1;
        self.store.clear();
    }

    fn eval_strategies(&mut self) {
        for s in &self.strategies {
            if let Some(sig) = s.evaluate(&self.bars, &self.indicators, Some(&self.store)) {
                self.signals.push_back(sig);
            }
        }
    }
}
