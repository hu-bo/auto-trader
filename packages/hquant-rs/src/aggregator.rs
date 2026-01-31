use std::collections::VecDeque;

use crate::period::Period;
use crate::types::Bar;

#[derive(Clone, Copy, Debug, Default, PartialEq)]
pub struct AggregateCandle {
    pub open_time: i64,
    pub open: f64,
    pub high: f64,
    pub low: f64,
    pub close: f64,
    pub volume: f64,
    pub buy_volume: f64,
}

impl From<AggregateCandle> for Bar {
    fn from(c: AggregateCandle) -> Self {
        Bar {
            timestamp: c.open_time,
            open: c.open,
            high: c.high,
            low: c.low,
            close: c.close,
            volume: c.volume,
            buy_volume: c.buy_volume,
        }
    }
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum AggregatorEventKind {
    KlineClosed,
}

#[derive(Clone, Debug, PartialEq)]
pub struct AggregatorEvent {
    pub kind: AggregatorEventKind,
    pub period: Period,
    pub candle: AggregateCandle,
}

#[derive(Clone, Debug)]
struct BucketState {
    period: Period,
    open_time: i64,
    candle: AggregateCandle,
    parts: Vec<Bar>,
}

#[derive(Clone, Debug)]
pub struct Aggregator {
    base: Period,
    targets: Vec<Period>,
    states: Vec<Option<BucketState>>,
    events: VecDeque<AggregatorEvent>,
}

impl Aggregator {
    pub fn new(periods: Vec<Period>) -> Self {
        assert!(!periods.is_empty(), "periods must be non-empty");
        let base = periods[0];
        let targets = periods[1..].to_vec();
        let states = vec![None; targets.len()];
        Self {
            base,
            targets,
            states,
            events: VecDeque::new(),
        }
    }

    pub fn base_period(&self) -> Period {
        self.base
    }

    pub fn target_periods(&self) -> &[Period] {
        &self.targets
    }

    pub fn push(&mut self, bar: &Bar) -> bool {
        let mut closed_any = false;
        for (idx, period) in self.targets.iter().copied().enumerate() {
            let bucket_open_time = floor_time(bar.timestamp, period);
            match self.states[idx].as_mut() {
                None => {
                    self.states[idx] = Some(new_bucket(period, bucket_open_time, *bar));
                }
                Some(state) if state.open_time != bucket_open_time => {
                    // Close previous bucket.
                    self.events.push_back(AggregatorEvent {
                        kind: AggregatorEventKind::KlineClosed,
                        period,
                        candle: state.candle,
                    });
                    closed_any = true;
                    // Start new bucket.
                    *state = new_bucket(period, bucket_open_time, *bar);
                }
                Some(state) => {
                    state.parts.push(*bar);
                    state.candle = aggregate_from_parts(state.open_time, &state.parts);
                }
            }
        }
        closed_any
    }

    pub fn update_last(&mut self, new_bar: &Bar) {
        for idx in 0..self.targets.len() {
            let Some(state) = self.states[idx].as_mut() else {
                continue;
            };
            if state.parts.is_empty() {
                continue;
            }
            // Best-effort: keep bucket open_time stable; recompute candle from parts.
            *state.parts.last_mut().unwrap() = *new_bar;
            state.candle = aggregate_from_parts(state.open_time, &state.parts);
        }
    }

    pub fn flush(&mut self) {
        for (idx, period) in self.targets.iter().copied().enumerate() {
            let Some(state) = self.states[idx].take() else {
                continue;
            };
            self.events.push_back(AggregatorEvent {
                kind: AggregatorEventKind::KlineClosed,
                period,
                candle: state.candle,
            });
        }
    }

    pub fn poll_events(&mut self) -> Vec<AggregatorEvent> {
        self.events.drain(..).collect()
    }

    pub fn reset(&mut self) {
        self.states.fill_with(|| None);
        self.events.clear();
    }
}

fn floor_time(ts: i64, period: Period) -> i64 {
    let ms = period.as_ms();
    if ms <= 0 {
        return ts;
    }
    (ts / ms) * ms
}

fn new_bucket(period: Period, open_time: i64, first: Bar) -> BucketState {
    let candle = AggregateCandle {
        open_time,
        open: first.open,
        high: first.high,
        low: first.low,
        close: first.close,
        volume: first.volume,
        buy_volume: first.buy_volume,
    };
    BucketState {
        period,
        open_time,
        candle,
        parts: vec![first],
    }
}

fn aggregate_from_parts(open_time: i64, parts: &[Bar]) -> AggregateCandle {
    let first = parts[0];
    let mut high = first.high;
    let mut low = first.low;
    let mut volume = 0.0;
    let mut buy_volume = 0.0;
    for p in parts {
        if p.high > high {
            high = p.high;
        }
        if p.low < low {
            low = p.low;
        }
        volume += p.volume;
        buy_volume += p.buy_volume;
    }
    let last = *parts.last().unwrap();
    AggregateCandle {
        open_time,
        open: first.open,
        high,
        low,
        close: last.close,
        volume,
        buy_volume,
    }
}

