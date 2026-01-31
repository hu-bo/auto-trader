use std::collections::{HashMap, VecDeque};

use crate::commom::circular::CircularColumn;
use crate::kline_buffer::KlineBuffer;
use crate::types::{Bar, Field};

pub type IndicatorId = usize;

#[derive(Clone, Copy, Debug, Default, PartialEq)]
pub struct BollValue {
    pub mid: f64,
    pub upper: f64,
    pub lower: f64,
}

#[derive(Clone, Copy, Debug, Default, PartialEq)]
pub struct MacdValue {
    pub macd: f64,
    pub signal: f64,
    pub hist: f64,
}

#[derive(Clone, Copy, Debug, PartialEq)]
pub enum IndicatorValue {
    F64(f64),
    Boll(BollValue),
    Macd(MacdValue),
}

#[derive(Clone, Debug, Eq, Hash, PartialEq)]
pub enum IndicatorSpec {
    Sma { field: Field, period: usize },
    Ema { field: Field, period: usize },
    StdDev { field: Field, period: usize },
    Rsi { period: usize },
    Boll { period: usize, k_bits: u64 },
    Macd { fast: usize, slow: usize, signal: usize },
}

#[derive(Clone, Debug)]
pub struct IndicatorGraph {
    capacity: usize,
    nodes: Vec<IndicatorNode>,
    spec_map: HashMap<IndicatorSpec, IndicatorId>,
    topo: Vec<IndicatorId>,
}

impl IndicatorGraph {
    pub fn new(capacity: usize) -> Self {
        Self {
            capacity,
            nodes: Vec::new(),
            spec_map: HashMap::new(),
            topo: Vec::new(),
        }
    }

    pub fn capacity(&self) -> usize {
        self.capacity
    }

    pub fn len(&self) -> usize {
        self.nodes.len()
    }

    pub fn clear(&mut self) {
        self.nodes.clear();
        self.spec_map.clear();
        self.topo.clear();
    }

    pub fn reset(&mut self) {
        for node in &mut self.nodes {
            node.reset();
        }
    }

    pub fn add_indicator(&mut self, spec: IndicatorSpec) -> IndicatorId {
        if let Some(&id) = self.spec_map.get(&spec) {
            return id;
        }

        let deps = self.resolve_deps(&spec);
        let id = self.nodes.len();
        let node = IndicatorNode::new(self.capacity, spec.clone(), deps);
        self.nodes.push(node);
        self.spec_map.insert(spec, id);
        self.topo = topo_sort(&self.nodes);
        id
    }

    pub fn indicator_last(&self, id: IndicatorId) -> Option<IndicatorValue> {
        self.nodes.get(id)?.last_value()
    }

    pub fn on_push(&mut self, bars: &KlineBuffer) {
        for id in self.topo.clone() {
            // Avoid borrow issues by computing deps values first.
            let deps = self.nodes[id].deps.clone();
            let dep_vals: Vec<IndicatorValue> = deps
                .iter()
                .filter_map(|&d| self.nodes.get(d).and_then(|n| n.last_value()))
                .collect();
            self.nodes[id].on_push(bars, &dep_vals);
        }
    }

    pub fn on_update_last(&mut self, old_bar: Bar, new_bar: Bar, bars: &KlineBuffer) {
        for id in self.topo.clone() {
            let deps = self.nodes[id].deps.clone();
            let dep_vals: Vec<IndicatorValue> = deps
                .iter()
                .filter_map(|&d| self.nodes.get(d).and_then(|n| n.last_value()))
                .collect();
            self.nodes[id].on_update_last(old_bar, new_bar, bars, &dep_vals);
        }
    }

    fn resolve_deps(&mut self, spec: &IndicatorSpec) -> Vec<IndicatorId> {
        match spec {
            IndicatorSpec::Boll { period, .. } => vec![
                self.add_indicator(IndicatorSpec::Sma {
                    field: Field::Close,
                    period: *period,
                }),
                self.add_indicator(IndicatorSpec::StdDev {
                    field: Field::Close,
                    period: *period,
                }),
            ],
            IndicatorSpec::Macd { fast, slow, .. } => vec![
                self.add_indicator(IndicatorSpec::Ema {
                    field: Field::Close,
                    period: *fast,
                }),
                self.add_indicator(IndicatorSpec::Ema {
                    field: Field::Close,
                    period: *slow,
                }),
            ],
            _ => vec![],
        }
    }
}

#[derive(Clone, Debug)]
struct IndicatorNode {
    spec: IndicatorSpec,
    deps: Vec<IndicatorId>,
    output: IndicatorOutput,
    state: IndicatorState,
}

impl IndicatorNode {
    fn new(capacity: usize, spec: IndicatorSpec, deps: Vec<IndicatorId>) -> Self {
        let (output, state) = match &spec {
            IndicatorSpec::Sma { field, period } => (
                IndicatorOutput::F64(CircularColumn::new(capacity)),
                IndicatorState::Sma(SmaState::new(*field, *period)),
            ),
            IndicatorSpec::Ema { field, period } => (
                IndicatorOutput::F64(CircularColumn::new(capacity)),
                IndicatorState::Ema(EmaState::new(*field, *period)),
            ),
            IndicatorSpec::StdDev { field, period } => (
                IndicatorOutput::F64(CircularColumn::new(capacity)),
                IndicatorState::StdDev(StdDevState::new(*field, *period)),
            ),
            IndicatorSpec::Rsi { period } => (
                IndicatorOutput::F64(CircularColumn::new(capacity)),
                IndicatorState::Rsi(RsiState::new(*period)),
            ),
            IndicatorSpec::Boll { period, k_bits } => (
                IndicatorOutput::Boll(CircularColumn::new(capacity)),
                IndicatorState::Boll(BollState::new(*period, *k_bits)),
            ),
            IndicatorSpec::Macd { fast, slow, signal } => (
                IndicatorOutput::Macd(CircularColumn::new(capacity)),
                IndicatorState::Macd(MacdState::new(*fast, *slow, *signal)),
            ),
        };

        Self {
            spec,
            deps,
            output,
            state,
        }
    }

    fn reset(&mut self) {
        self.output.clear();
        self.state.reset();
    }

    fn last_value(&self) -> Option<IndicatorValue> {
        match &self.output {
            IndicatorOutput::F64(col) => Some(IndicatorValue::F64(col.last()?)),
            IndicatorOutput::Boll(col) => Some(IndicatorValue::Boll(col.last()?)),
            IndicatorOutput::Macd(col) => Some(IndicatorValue::Macd(col.last()?)),
        }
    }

    fn on_push(&mut self, bars: &KlineBuffer, dep_vals: &[IndicatorValue]) {
        match (&mut self.output, &mut self.state) {
            (IndicatorOutput::F64(out), IndicatorState::Sma(state)) => {
                out.push(state.on_push(bars));
            }
            (IndicatorOutput::F64(out), IndicatorState::Ema(state)) => {
                out.push(state.on_push(bars));
            }
            (IndicatorOutput::F64(out), IndicatorState::StdDev(state)) => {
                out.push(state.on_push(bars));
            }
            (IndicatorOutput::F64(out), IndicatorState::Rsi(state)) => {
                out.push(state.on_push(bars));
            }
            (IndicatorOutput::Boll(out), IndicatorState::Boll(state)) => {
                out.push(state.on_push(dep_vals));
            }
            (IndicatorOutput::Macd(out), IndicatorState::Macd(state)) => {
                out.push(state.on_push(dep_vals));
            }
            _ => {}
        }
    }

    fn on_update_last(
        &mut self,
        old_bar: Bar,
        new_bar: Bar,
        bars: &KlineBuffer,
        dep_vals: &[IndicatorValue],
    ) {
        match (&mut self.output, &mut self.state) {
            (IndicatorOutput::F64(out), IndicatorState::Sma(state)) => {
                out.update_last(state.on_update_last(old_bar, new_bar));
            }
            (IndicatorOutput::F64(out), IndicatorState::Ema(state)) => {
                out.update_last(state.on_update_last(old_bar, new_bar));
            }
            (IndicatorOutput::F64(out), IndicatorState::StdDev(state)) => {
                out.update_last(state.on_update_last(old_bar, new_bar));
            }
            (IndicatorOutput::F64(out), IndicatorState::Rsi(state)) => {
                out.update_last(state.on_update_last(bars));
            }
            (IndicatorOutput::Boll(out), IndicatorState::Boll(state)) => {
                out.update_last(state.on_push(dep_vals));
            }
            (IndicatorOutput::Macd(out), IndicatorState::Macd(state)) => {
                out.update_last(state.on_update_last(dep_vals));
            }
            _ => {}
        }
    }
}

#[derive(Clone, Debug)]
enum IndicatorOutput {
    F64(CircularColumn<f64>),
    Boll(CircularColumn<BollValue>),
    Macd(CircularColumn<MacdValue>),
}

impl IndicatorOutput {
    fn clear(&mut self) {
        match self {
            IndicatorOutput::F64(col) => col.clear(),
            IndicatorOutput::Boll(col) => col.clear(),
            IndicatorOutput::Macd(col) => col.clear(),
        }
    }
}

#[derive(Clone, Debug)]
enum IndicatorState {
    Sma(SmaState),
    Ema(EmaState),
    StdDev(StdDevState),
    Rsi(RsiState),
    Boll(BollState),
    Macd(MacdState),
}

impl IndicatorState {
    fn reset(&mut self) {
        match self {
            IndicatorState::Sma(s) => s.reset(),
            IndicatorState::Ema(s) => s.reset(),
            IndicatorState::StdDev(s) => s.reset(),
            IndicatorState::Rsi(s) => s.reset(),
            IndicatorState::Boll(s) => s.reset(),
            IndicatorState::Macd(s) => s.reset(),
        }
    }
}

#[derive(Clone, Debug)]
struct SmaState {
    field: Field,
    period: usize,
    window: VecDeque<f64>,
    sum: f64,
}

impl SmaState {
    fn new(field: Field, period: usize) -> Self {
        Self {
            field,
            period,
            window: VecDeque::with_capacity(period.min(1024)),
            sum: 0.0,
        }
    }

    fn reset(&mut self) {
        self.window.clear();
        self.sum = 0.0;
    }

    fn on_push(&mut self, bars: &KlineBuffer) -> f64 {
        let v = bars.last_f64(self.field).unwrap_or(f64::NAN);
        if self.window.len() == self.period {
            if let Some(old) = self.window.pop_front() {
                self.sum -= old;
            }
        }
        self.window.push_back(v);
        self.sum += v;
        if self.window.len() < self.period {
            f64::NAN
        } else {
            self.sum / (self.period as f64)
        }
    }

    fn on_update_last(&mut self, old_bar: Bar, new_bar: Bar) -> f64 {
        if let Some(last) = self.window.back_mut() {
            let old = field_value(old_bar, self.field);
            let new = field_value(new_bar, self.field);
            *last = new;
            self.sum += new - old;
        }
        if self.window.len() < self.period {
            f64::NAN
        } else {
            self.sum / (self.period as f64)
        }
    }
}

#[derive(Clone, Debug)]
struct EmaState {
    field: Field,
    period: usize,
    alpha: f64,
    count: usize,
    seed_sum: f64,
    ema: f64,
    ema_before_last: f64,
}

impl EmaState {
    fn new(field: Field, period: usize) -> Self {
        let alpha = 2.0 / (period as f64 + 1.0);
        Self {
            field,
            period,
            alpha,
            count: 0,
            seed_sum: 0.0,
            ema: f64::NAN,
            ema_before_last: f64::NAN,
        }
    }

    fn reset(&mut self) {
        self.count = 0;
        self.seed_sum = 0.0;
        self.ema = f64::NAN;
        self.ema_before_last = f64::NAN;
    }

    fn on_push(&mut self, bars: &KlineBuffer) -> f64 {
        let v = bars.last_f64(self.field).unwrap_or(f64::NAN);
        self.ema_before_last = self.ema;
        self.count = self.count.saturating_add(1);
        if self.count < self.period {
            self.seed_sum += v;
            self.ema = f64::NAN;
            return f64::NAN;
        }
        if self.count == self.period {
            self.seed_sum += v;
            self.ema = self.seed_sum / (self.period as f64);
            return self.ema;
        }
        self.ema = self.alpha * v + (1.0 - self.alpha) * self.ema;
        self.ema
    }

    fn on_update_last(&mut self, old_bar: Bar, new_bar: Bar) -> f64 {
        if self.count == 0 {
            return f64::NAN;
        }
        let old = field_value(old_bar, self.field);
        let new = field_value(new_bar, self.field);
        if self.count < self.period {
            self.seed_sum += new - old;
            self.ema = f64::NAN;
            return f64::NAN;
        }
        if self.count == self.period {
            self.seed_sum += new - old;
            self.ema = self.seed_sum / (self.period as f64);
            return self.ema;
        }
        self.ema = self.alpha * new + (1.0 - self.alpha) * self.ema_before_last;
        self.ema
    }
}

#[derive(Clone, Debug)]
struct StdDevState {
    field: Field,
    period: usize,
    window: VecDeque<f64>,
    sum: f64,
    sumsq: f64,
}

impl StdDevState {
    fn new(field: Field, period: usize) -> Self {
        Self {
            field,
            period,
            window: VecDeque::with_capacity(period.min(1024)),
            sum: 0.0,
            sumsq: 0.0,
        }
    }

    fn reset(&mut self) {
        self.window.clear();
        self.sum = 0.0;
        self.sumsq = 0.0;
    }

    fn on_push(&mut self, bars: &KlineBuffer) -> f64 {
        let v = bars.last_f64(self.field).unwrap_or(f64::NAN);
        if self.window.len() == self.period {
            if let Some(old) = self.window.pop_front() {
                self.sum -= old;
                self.sumsq -= old * old;
            }
        }
        self.window.push_back(v);
        self.sum += v;
        self.sumsq += v * v;
        if self.window.len() < self.period {
            return f64::NAN;
        }
        let n = self.period as f64;
        let mean = self.sum / n;
        let var = (self.sumsq / n) - mean * mean;
        var.max(0.0).sqrt()
    }

    fn on_update_last(&mut self, old_bar: Bar, new_bar: Bar) -> f64 {
        if let Some(last) = self.window.back_mut() {
            let old = field_value(old_bar, self.field);
            let new = field_value(new_bar, self.field);
            *last = new;
            self.sum += new - old;
            self.sumsq += new * new - old * old;
        }
        if self.window.len() < self.period {
            return f64::NAN;
        }
        let n = self.period as f64;
        let mean = self.sum / n;
        let var = (self.sumsq / n) - mean * mean;
        var.max(0.0).sqrt()
    }
}

#[derive(Clone, Debug)]
struct RsiState {
    period: usize,
    count_diffs: usize,
    prev_close: Option<f64>,
    sum_gain: f64,
    sum_loss: f64,
    avg_gain: f64,
    avg_loss: f64,
    pre_sum_gain: f64,
    pre_sum_loss: f64,
    pre_avg_gain: f64,
    pre_avg_loss: f64,
}

impl RsiState {
    fn new(period: usize) -> Self {
        Self {
            period,
            count_diffs: 0,
            prev_close: None,
            sum_gain: 0.0,
            sum_loss: 0.0,
            avg_gain: 0.0,
            avg_loss: 0.0,
            pre_sum_gain: 0.0,
            pre_sum_loss: 0.0,
            pre_avg_gain: 0.0,
            pre_avg_loss: 0.0,
        }
    }

    fn reset(&mut self) {
        *self = Self::new(self.period);
    }

    fn on_push(&mut self, bars: &KlineBuffer) -> f64 {
        let close = bars.last_f64(Field::Close).unwrap_or(f64::NAN);
        let Some(prev) = self.prev_close else {
            self.prev_close = Some(close);
            return f64::NAN;
        };
        let diff = close - prev;
        self.prev_close = Some(close);
        let gain = diff.max(0.0);
        let loss = (-diff).max(0.0);

        self.count_diffs = self.count_diffs.saturating_add(1);

        if self.count_diffs < self.period {
            self.pre_sum_gain = self.sum_gain;
            self.pre_sum_loss = self.sum_loss;
            self.sum_gain += gain;
            self.sum_loss += loss;
            return f64::NAN;
        }

        if self.count_diffs == self.period {
            self.pre_sum_gain = self.sum_gain;
            self.pre_sum_loss = self.sum_loss;
            self.sum_gain += gain;
            self.sum_loss += loss;
            self.avg_gain = self.sum_gain / (self.period as f64);
            self.avg_loss = self.sum_loss / (self.period as f64);
            return rsi_from_avgs(self.avg_gain, self.avg_loss);
        }

        self.pre_avg_gain = self.avg_gain;
        self.pre_avg_loss = self.avg_loss;
        self.avg_gain = (self.avg_gain * (self.period as f64 - 1.0) + gain) / (self.period as f64);
        self.avg_loss = (self.avg_loss * (self.period as f64 - 1.0) + loss) / (self.period as f64);
        rsi_from_avgs(self.avg_gain, self.avg_loss)
    }

    fn on_update_last(&mut self, bars: &KlineBuffer) -> f64 {
        let close = bars.last_f64(Field::Close).unwrap_or(f64::NAN);
        if self.prev_close.is_none() {
            self.prev_close = Some(close);
            return f64::NAN;
        }

        // Need at least 2 bars to have a diff.
        let Some(prev_close) = bars.close().get_from_end(1) else {
            self.prev_close = Some(close);
            return f64::NAN;
        };

        let diff = close - prev_close;
        self.prev_close = Some(close);
        let gain = diff.max(0.0);
        let loss = (-diff).max(0.0);

        if self.count_diffs == 0 {
            return f64::NAN;
        }

        if self.count_diffs < self.period {
            self.sum_gain = self.pre_sum_gain + gain;
            self.sum_loss = self.pre_sum_loss + loss;
            return f64::NAN;
        }

        if self.count_diffs == self.period {
            self.sum_gain = self.pre_sum_gain + gain;
            self.sum_loss = self.pre_sum_loss + loss;
            self.avg_gain = self.sum_gain / (self.period as f64);
            self.avg_loss = self.sum_loss / (self.period as f64);
            return rsi_from_avgs(self.avg_gain, self.avg_loss);
        }

        self.avg_gain = (self.pre_avg_gain * (self.period as f64 - 1.0) + gain) / (self.period as f64);
        self.avg_loss = (self.pre_avg_loss * (self.period as f64 - 1.0) + loss) / (self.period as f64);
        rsi_from_avgs(self.avg_gain, self.avg_loss)
    }
}

#[derive(Clone, Debug)]
struct BollState {
    period: usize,
    k_bits: u64,
}

impl BollState {
    fn new(period: usize, k_bits: u64) -> Self {
        Self { period, k_bits }
    }

    fn reset(&mut self) {}

    fn on_push(&self, dep_vals: &[IndicatorValue]) -> BollValue {
        let (sma, std) = match dep_vals {
            [IndicatorValue::F64(sma), IndicatorValue::F64(std), ..] => (*sma, *std),
            _ => (f64::NAN, f64::NAN),
        };
        if !sma.is_finite() || !std.is_finite() {
            return BollValue {
                mid: f64::NAN,
                upper: f64::NAN,
                lower: f64::NAN,
            };
        }
        let k = f64::from_bits(self.k_bits);
        BollValue {
            mid: sma,
            upper: sma + k * std,
            lower: sma - k * std,
        }
    }
}

#[derive(Clone, Debug)]
struct MacdState {
    fast: usize,
    slow: usize,
    signal_period: usize,
    alpha: f64,
    macd_count: usize,
    seed_sum: f64,
    signal_ema: f64,
    pre_seed_sum: f64,
    pre_signal_ema: f64,
}

impl MacdState {
    fn new(fast: usize, slow: usize, signal_period: usize) -> Self {
        let alpha = 2.0 / (signal_period as f64 + 1.0);
        Self {
            fast,
            slow,
            signal_period,
            alpha,
            macd_count: 0,
            seed_sum: 0.0,
            signal_ema: f64::NAN,
            pre_seed_sum: 0.0,
            pre_signal_ema: f64::NAN,
        }
    }

    fn reset(&mut self) {
        *self = Self::new(self.fast, self.slow, self.signal_period);
    }

    fn on_push(&mut self, dep_vals: &[IndicatorValue]) -> MacdValue {
        let (ema_fast, ema_slow) = match dep_vals {
            [IndicatorValue::F64(f), IndicatorValue::F64(s), ..] => (*f, *s),
            _ => (f64::NAN, f64::NAN),
        };
        if !ema_fast.is_finite() || !ema_slow.is_finite() {
            return MacdValue {
                macd: f64::NAN,
                signal: f64::NAN,
                hist: f64::NAN,
            };
        }
        let macd = ema_fast - ema_slow;
        self.pre_signal_ema = self.signal_ema;

        self.macd_count = self.macd_count.saturating_add(1);

        if self.macd_count <= self.signal_period {
            self.pre_seed_sum = self.seed_sum;
            self.seed_sum += macd;
            if self.macd_count < self.signal_period {
                self.signal_ema = f64::NAN;
            } else {
                self.signal_ema = self.seed_sum / (self.signal_period as f64);
            }
        } else {
            self.signal_ema = self.alpha * macd + (1.0 - self.alpha) * self.signal_ema;
        }

        let hist = macd - self.signal_ema;
        MacdValue {
            macd,
            signal: self.signal_ema,
            hist,
        }
    }

    fn on_update_last(&mut self, dep_vals: &[IndicatorValue]) -> MacdValue {
        let (ema_fast, ema_slow) = match dep_vals {
            [IndicatorValue::F64(f), IndicatorValue::F64(s), ..] => (*f, *s),
            _ => (f64::NAN, f64::NAN),
        };
        if !ema_fast.is_finite() || !ema_slow.is_finite() {
            return MacdValue {
                macd: f64::NAN,
                signal: f64::NAN,
                hist: f64::NAN,
            };
        }
        let macd = ema_fast - ema_slow;

        if self.macd_count == 0 {
            return MacdValue {
                macd: f64::NAN,
                signal: f64::NAN,
                hist: f64::NAN,
            };
        }

        if self.macd_count < self.signal_period {
            self.seed_sum = self.pre_seed_sum + macd;
            self.signal_ema = f64::NAN;
        } else if self.macd_count == self.signal_period {
            self.seed_sum = self.pre_seed_sum + macd;
            self.signal_ema = self.seed_sum / (self.signal_period as f64);
        } else {
            self.signal_ema = self.alpha * macd + (1.0 - self.alpha) * self.pre_signal_ema;
        }

        let hist = macd - self.signal_ema;
        MacdValue {
            macd,
            signal: self.signal_ema,
            hist,
        }
    }
}

fn rsi_from_avgs(avg_gain: f64, avg_loss: f64) -> f64 {
    if avg_loss == 0.0 && avg_gain == 0.0 {
        return 50.0;
    }
    if avg_loss == 0.0 {
        return 100.0;
    }
    if avg_gain == 0.0 {
        return 0.0;
    }
    let rs = avg_gain / avg_loss;
    100.0 - (100.0 / (1.0 + rs))
}

fn field_value(bar: Bar, field: Field) -> f64 {
    match field {
        Field::Open => bar.open,
        Field::High => bar.high,
        Field::Low => bar.low,
        Field::Close => bar.close,
        Field::Volume => bar.volume,
        Field::BuyVolume => bar.buy_volume,
    }
}

fn topo_sort(nodes: &[IndicatorNode]) -> Vec<IndicatorId> {
    let n = nodes.len();
    let mut indeg = vec![0usize; n];
    let mut out = vec![Vec::<usize>::new(); n];
    for (id, node) in nodes.iter().enumerate() {
        indeg[id] = node.deps.len();
        for &dep in &node.deps {
            if dep < n {
                out[dep].push(id);
            }
        }
    }

    let mut q: VecDeque<usize> = indeg
        .iter()
        .enumerate()
        .filter_map(|(i, &d)| if d == 0 { Some(i) } else { None })
        .collect();

    let mut order = Vec::with_capacity(n);
    while let Some(u) = q.pop_front() {
        order.push(u);
        for &v in &out[u] {
            indeg[v] = indeg[v].saturating_sub(1);
            if indeg[v] == 0 {
                q.push_back(v);
            }
        }
    }

    if order.len() != n {
        // Should not happen; fall back to insertion order.
        return (0..n).collect();
    }
    order
}
