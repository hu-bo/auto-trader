use std::collections::HashMap;

use pest::Parser;
use pest_derive::Parser;

use crate::indicators::{IndicatorGraph, IndicatorId, IndicatorSpec, IndicatorValue};
use crate::kline_buffer::KlineBuffer;
use crate::period::Period;
use crate::types::{Action, Field, Signal};
use crate::vector_store::{min_max_normalize, normalize_vector, z_score_normalize, SimilarityMethod, VectorStore};

#[derive(Parser)]
#[grammar = "dsl/grammar.pest"]
struct DslParser;

#[derive(Clone, Debug)]
pub enum StrategyError {
    ParseError { line: usize, msg: String },
    UnknownField(String),
    UnknownFunction(String),
    InvalidArgs(String),
    MultiPeriodNotSupported(String),
}

impl core::fmt::Display for StrategyError {
    fn fmt(&self, f: &mut core::fmt::Formatter<'_>) -> core::fmt::Result {
        match self {
            StrategyError::ParseError { line, msg } => write!(f, "dsl parse error at line {line}: {msg}"),
            StrategyError::UnknownField(s) => write!(f, "unknown identifier: {s}"),
            StrategyError::UnknownFunction(s) => write!(f, "unknown function: {s}"),
            StrategyError::InvalidArgs(s) => write!(f, "invalid args: {s}"),
            StrategyError::MultiPeriodNotSupported(s) => write!(f, "multi-period not supported: {s}"),
        }
    }
}

impl std::error::Error for StrategyError {}

#[derive(Clone, Debug)]
pub struct CompiledStrategy {
    pub id: u32,
    pub name: String,
    rules: Vec<CompiledRule>,
}

#[derive(Clone, Debug)]
struct CompiledRule {
    cond: Cond,
    action: Action,
    meta: Option<String>,
}

#[derive(Clone, Debug)]
enum Cond {
    Or(Box<Cond>, Box<Cond>),
    And(Box<Cond>, Box<Cond>),
    Not(Box<Cond>),
    Compare { op: CmpOp, left: ValueExpr, right: ValueExpr },
    // For DSL extensions where value itself is boolean.
    BoolValue(ValueExpr),
}

#[derive(Clone, Copy, Debug)]
enum CmpOp {
    Lt,
    Le,
    Gt,
    Ge,
    Eq,
    Ne,
}

#[derive(Clone, Debug)]
enum ValueExpr {
    Number(f64),
    String(String),
    Series(SeriesRef),
    Indicator(IndicatorRef),
    VecSource(VecExpr),
    Store(String),
    Similarity(SimilarityExpr),
}

#[derive(Clone, Copy, Debug)]
struct IndicatorRef {
    id: IndicatorId,
    period: Option<Period>,
}

#[derive(Clone, Debug)]
struct SeriesRef {
    field: Field,
    period: Option<Period>,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
enum NormalizeMethod {
    None,
    MinMax,
    ZScore,
    L2,
}

impl NormalizeMethod {
    fn parse(s: &str) -> Option<Self> {
        match s.trim().to_ascii_lowercase().as_str() {
            "none" | "raw" => Some(NormalizeMethod::None),
            "minmax" | "min_max" | "min-max" => Some(NormalizeMethod::MinMax),
            "zscore" | "z_score" | "z-score" => Some(NormalizeMethod::ZScore),
            "l2" | "unit" | "unit_norm" | "unit-norm" => Some(NormalizeMethod::L2),
            _ => None,
        }
    }
}

#[derive(Clone, Debug)]
struct VecExpr {
    series: SeriesRef,
    length: usize,
    normalize: NormalizeMethod,
}

#[derive(Clone, Debug)]
struct SimilarityExpr {
    store: String,
    query: VecExpr,
    method: SimilarityMethod,
    threshold: Option<f64>,
}

pub fn validate_dsl(source: &str) -> Result<(), StrategyError> {
    let mut graph = IndicatorGraph::new(16);
    let _ = compile_strategy(1, "validate", source, &mut graph)?;
    Ok(())
}

pub trait MultiIndicatorResolver {
    fn has_period(&self, period: Period) -> bool;
    fn add_indicator(&mut self, period: Period, spec: IndicatorSpec) -> IndicatorId;
}

enum CompileMode<'a> {
    Single(&'a mut IndicatorGraph),
    Multi {
        base_period: Period,
        resolver: &'a mut dyn MultiIndicatorResolver,
    },
}

struct CompileCtx<'a> {
    mode: CompileMode<'a>,
    vars: HashMap<String, ValueExpr>,
}

impl<'a> CompileCtx<'a> {
    fn single(graph: &'a mut IndicatorGraph) -> Self {
        Self {
            mode: CompileMode::Single(graph),
            vars: HashMap::new(),
        }
    }

    fn multi(base_period: Period, resolver: &'a mut dyn MultiIndicatorResolver) -> Self {
        Self {
            mode: CompileMode::Multi { base_period, resolver },
            vars: HashMap::new(),
        }
    }

    fn normalize_series_period(&mut self, series: &mut SeriesRef) -> Result<(), StrategyError> {
        match &mut self.mode {
            CompileMode::Single(_) => {
                if let Some(p) = series.period {
                    return Err(StrategyError::MultiPeriodNotSupported(format!(
                        "{}@{}",
                        series.field.as_str(),
                        p
                    )));
                }
                Ok(())
            }
            CompileMode::Multi {
                base_period,
                resolver,
            } => {
                let p = series.period.unwrap_or(*base_period);
                if !resolver.has_period(p) {
                    return Err(StrategyError::InvalidArgs(format!("unknown period: {p}")));
                }
                series.period = Some(p);
                Ok(())
            }
        }
    }

    fn add_indicator(&mut self, period: Option<Period>, spec: IndicatorSpec) -> Result<IndicatorRef, StrategyError> {
        match &mut self.mode {
            CompileMode::Single(graph) => {
                if period.is_some() {
                    return Err(StrategyError::MultiPeriodNotSupported(
                        "multi-period indicator".to_string(),
                    ));
                }
                let id = graph.add_indicator(spec);
                Ok(IndicatorRef { id, period: None })
            }
            CompileMode::Multi {
                base_period,
                resolver,
            } => {
                let p = period.unwrap_or(*base_period);
                if !resolver.has_period(p) {
                    return Err(StrategyError::InvalidArgs(format!("unknown period: {p}")));
                }
                let id = resolver.add_indicator(p, spec);
                Ok(IndicatorRef {
                    id,
                    period: Some(p),
                })
            }
        }
    }
}

pub fn compile_strategy(
    id: u32,
    name: &str,
    source: &str,
    graph: &mut IndicatorGraph,
) -> Result<CompiledStrategy, StrategyError> {
    let mut ctx = CompileCtx::single(graph);
    let rules = compile_rules(source, &mut ctx)?;

    Ok(CompiledStrategy {
        id,
        name: name.to_string(),
        rules,
    })
}

pub fn compile_multi_strategy(
    id: u32,
    name: &str,
    source: &str,
    base_period: Period,
    resolver: &mut dyn MultiIndicatorResolver,
) -> Result<CompiledStrategy, StrategyError> {
    let mut ctx = CompileCtx::multi(base_period, resolver);
    let rules = compile_rules(source, &mut ctx)?;
    Ok(CompiledStrategy {
        id,
        name: name.to_string(),
        rules,
    })
}

fn compile_rules(source: &str, ctx: &mut CompileCtx<'_>) -> Result<Vec<CompiledRule>, StrategyError> {
    let mut rules = Vec::new();
    for (line_idx, raw) in source.lines().enumerate() {
        let line_no = line_idx + 1;
        let line = raw.trim();
        if line.is_empty() || line.starts_with('#') || line.starts_with("//") {
            continue;
        }
        let mut pairs = DslParser::parse(Rule::line, line)
            .map_err(|e| StrategyError::ParseError {
                line: line_no,
                msg: e.to_string(),
            })?;
        let pair = pairs.next().ok_or_else(|| StrategyError::ParseError {
            line: line_no,
            msg: "empty parse".to_string(),
        })?;
        debug_assert_eq!(pair.as_rule(), Rule::line);
        let mut inner = pair.into_inner();
        let stmt = inner.next().ok_or_else(|| StrategyError::ParseError {
            line: line_no,
            msg: "empty statement".to_string(),
        })?;
        match stmt.as_rule() {
            Rule::var_line => {
                let mut it = stmt.into_inner();
                let name = it
                    .next()
                    .ok_or_else(|| StrategyError::ParseError {
                        line: line_no,
                        msg: "missing var name".to_string(),
                    })?
                    .as_str();
                let value_pair = it
                    .next()
                    .ok_or_else(|| StrategyError::ParseError {
                        line: line_no,
                        msg: "missing var value".to_string(),
                    })?;

                let reserved_field = Field::parse(name).is_some();
                if reserved_field {
                    return Err(StrategyError::InvalidArgs(format!(
                        "cannot assign to reserved name: {name}"
                    )));
                }
                if ctx.vars.contains_key(name) {
                    return Err(StrategyError::InvalidArgs(format!(
                        "duplicate variable: {name}"
                    )));
                }

                let v = compile_value(value_pair, ctx, line_no)?;
                ctx.vars.insert(name.to_string(), v);
                continue;
            }
            Rule::rule_line => {
                let mut it = stmt.into_inner();
                let expr_pair = it
                    .next()
                    .ok_or_else(|| StrategyError::ParseError {
                        line: line_no,
                        msg: "missing expression".to_string(),
                    })?;
                let action_pair = it
                    .next()
                    .ok_or_else(|| StrategyError::ParseError {
                        line: line_no,
                        msg: "missing action".to_string(),
                    })?;

                let cond = compile_expr(expr_pair, ctx, line_no)?;
                let (action, meta) = parse_action(action_pair)?;
                rules.push(CompiledRule { cond, action, meta });
            }
            other => {
                return Err(StrategyError::ParseError {
                    line: line_no,
                    msg: format!("unexpected statement: {other:?}"),
                })
            }
        }
    }
    Ok(rules)
}

impl CompiledStrategy {
    pub fn evaluate_with_ctx(&self, ctx: &impl EvalContext, store: Option<&VectorStore>) -> Option<Signal> {
        let ts = ctx.bars(None).and_then(|b| b.last()).map(|b| b.timestamp)?;
        for rule in &self.rules {
            if eval_cond(&rule.cond, ctx, store) {
                return Some(Signal {
                    strategy_id: self.id,
                    action: rule.action,
                    timestamp: ts,
                    meta: rule.meta.clone(),
                });
            }
        }
        None
    }

    pub fn evaluate(
        &self,
        bars: &KlineBuffer,
        graph: &IndicatorGraph,
        store: Option<&VectorStore>,
    ) -> Option<Signal> {
        let ctx = SingleEvalContext { bars, graph };
        self.evaluate_with_ctx(&ctx, store)
    }
}

pub trait EvalContext {
    fn bars(&self, period: Option<Period>) -> Option<&KlineBuffer>;
    fn indicator_last(&self, period: Option<Period>, id: IndicatorId) -> Option<IndicatorValue>;
}

struct SingleEvalContext<'a> {
    bars: &'a KlineBuffer,
    graph: &'a IndicatorGraph,
}

impl EvalContext for SingleEvalContext<'_> {
    fn bars(&self, period: Option<Period>) -> Option<&KlineBuffer> {
        if period.is_some() {
            return None;
        }
        Some(self.bars)
    }

    fn indicator_last(&self, period: Option<Period>, id: IndicatorId) -> Option<IndicatorValue> {
        if period.is_some() {
            return None;
        }
        self.graph.indicator_last(id)
    }
}

fn parse_action(pair: pest::iterators::Pair<'_, Rule>) -> Result<(Action, Option<String>), StrategyError> {
    debug_assert_eq!(pair.as_rule(), Rule::action);
    let mut inner = pair.into_inner();
    let name = inner
        .next()
        .ok_or_else(|| StrategyError::InvalidArgs("missing action".to_string()))?
        .as_str();
    let action = Action::parse(name)
        .ok_or_else(|| StrategyError::InvalidArgs(format!("unknown action: {name}")))?;
    let meta = inner.next().map(|p| {
        // action_meta -> "(" meta_inner ")"
        p.into_inner()
            .next()
            .map(|x| x.as_str().trim().to_string())
            .unwrap_or_default()
    });
    let meta = meta.and_then(|s| if s.is_empty() { None } else { Some(s) });
    Ok((action, meta))
}

fn compile_expr(pair: pest::iterators::Pair<'_, Rule>, ctx: &mut CompileCtx<'_>, line: usize) -> Result<Cond, StrategyError> {
    match pair.as_rule() {
        Rule::expr | Rule::or_expr | Rule::and_expr => {
            let mut inner = pair.into_inner();
            let first = inner
                .next()
                .ok_or_else(|| StrategyError::ParseError {
                    line,
                    msg: "empty expression".to_string(),
                })?;
            let mut left = compile_expr(first, ctx, line)?;
            while let Some(op) = inner.next() {
                let rhs_pair = inner.next().ok_or_else(|| StrategyError::ParseError {
                    line,
                    msg: "missing rhs".to_string(),
                })?;
                let right = compile_expr(rhs_pair, ctx, line)?;
                left = match op.as_rule() {
                    Rule::or_kw => Cond::Or(Box::new(left), Box::new(right)),
                    Rule::and_kw => Cond::And(Box::new(left), Box::new(right)),
                    _ => left,
                };
            }
            Ok(left)
        }
        Rule::not_expr => {
            let mut inner = pair.clone().into_inner();
            let first = inner.next().ok_or_else(|| StrategyError::ParseError {
                line,
                msg: "empty not_expr".to_string(),
            })?;
            if first.as_rule() == Rule::not_kw {
                let next = inner.next().ok_or_else(|| StrategyError::ParseError {
                    line,
                    msg: "NOT missing rhs".to_string(),
                })?;
                Ok(Cond::Not(Box::new(compile_expr(next, ctx, line)?)))
            } else {
                compile_expr(first, ctx, line)
            }
        }
        Rule::cmp_expr => {
            let mut inner = pair.into_inner();
            let left_v = compile_value(
                inner.next().ok_or_else(|| StrategyError::ParseError {
                    line,
                    msg: "missing lhs".to_string(),
                })?,
                ctx,
                line,
            )?;
            let op_pair = inner.next();
            let Some(op_pair) = op_pair else {
                return Ok(Cond::BoolValue(left_v));
            };
            let right_v = compile_value(
                inner.next().ok_or_else(|| StrategyError::ParseError {
                    line,
                    msg: "missing rhs".to_string(),
                })?,
                ctx,
                line,
            )?;
            let op = match op_pair.as_str() {
                "<" => CmpOp::Lt,
                "<=" => CmpOp::Le,
                ">" => CmpOp::Gt,
                ">=" => CmpOp::Ge,
                "==" => CmpOp::Eq,
                "!=" => CmpOp::Ne,
                other => {
                    return Err(StrategyError::ParseError {
                        line,
                        msg: format!("unknown op: {other}"),
                    })
                }
            };
            Ok(Cond::Compare {
                op,
                left: left_v,
                right: right_v,
            })
        }
        Rule::value => {
            // Parenthesized expr produces a Rule::expr, otherwise number/call/series_ref.
            let mut inner = pair.into_inner();
            let only = inner.next().ok_or_else(|| StrategyError::ParseError {
                line,
                msg: "empty value".to_string(),
            })?;
            match only.as_rule() {
                Rule::expr | Rule::or_expr | Rule::and_expr | Rule::not_expr | Rule::cmp_expr => {
                    compile_expr(only, ctx, line)
                }
                _ => Ok(Cond::BoolValue(compile_value(only, ctx, line)?)),
            }
        }
        Rule::call | Rule::series_ref | Rule::number => Ok(Cond::BoolValue(compile_value(pair, ctx, line)?)),
        other => Err(StrategyError::ParseError {
            line,
            msg: format!("unexpected rule: {other:?}"),
        }),
    }
}

fn compile_value(pair: pest::iterators::Pair<'_, Rule>, ctx: &mut CompileCtx<'_>, line: usize) -> Result<ValueExpr, StrategyError> {
    match pair.as_rule() {
        Rule::number => {
            let v: f64 = pair
                .as_str()
                .parse()
                .map_err(|_| StrategyError::ParseError {
                    line,
                    msg: format!("invalid number: {}", pair.as_str()),
                })?;
            Ok(ValueExpr::Number(v))
        }
        Rule::string => Ok(ValueExpr::String(parse_string(pair.as_str()))),
        Rule::series_ref => {
            // `series_ref` isn't atomic in the pest grammar, so when `@<period>` is omitted
            // the implicit WHITESPACE skipping may get included in the captured span
            // (e.g. `rsi_1h < 30` can yield `"rsi_1h "`). Trim to make variable/field lookup stable.
            let s = pair.as_str().trim();
            let (name, period_opt) = if let Some((a, b)) = s.split_once('@') {
                (a.trim(), Some(b.trim()))
            } else {
                (s, None)
            };
            let parsed_period = match period_opt {
                None => None,
                Some(p) => Some(Period::parse(p).map_err(|e| StrategyError::MultiPeriodNotSupported(e.to_string()))?),
            };
            if let Some(field) = Field::parse(name) {
                let period = match &mut ctx.mode {
                    CompileMode::Single(_) => {
                        if let Some(p) = parsed_period {
                            return Err(StrategyError::MultiPeriodNotSupported(format!("{name}@{p}")));
                        }
                        None
                    }
                    CompileMode::Multi {
                        base_period,
                        resolver,
                    } => {
                        let p = parsed_period.unwrap_or(*base_period);
                        if !resolver.has_period(p) {
                            return Err(StrategyError::InvalidArgs(format!("unknown period: {p}")));
                        }
                        Some(p)
                    }
                };
                return Ok(ValueExpr::Series(SeriesRef { field, period }));
            }

            if parsed_period.is_some() {
                return Err(StrategyError::InvalidArgs(format!(
                    "variable cannot use @<period> suffix: {name}"
                )));
            }
            if let Some(v) = ctx.vars.get(name) {
                return Ok(v.clone());
            }
            Err(StrategyError::UnknownField(name.to_string()))
        }
        Rule::call => compile_call(pair, ctx, line),
        Rule::value => {
            let mut inner = pair.into_inner();
            let v = inner.next().ok_or_else(|| StrategyError::ParseError {
                line,
                msg: "empty value".to_string(),
            })?;
            compile_value(v, ctx, line)
        }
        other => Err(StrategyError::ParseError {
            line,
            msg: format!("unexpected value rule: {other:?}"),
        }),
    }
}

fn compile_call(pair: pest::iterators::Pair<'_, Rule>, ctx: &mut CompileCtx<'_>, line: usize) -> Result<ValueExpr, StrategyError> {
    let mut inner = pair.into_inner();
    let name = inner
        .next()
        .ok_or_else(|| StrategyError::ParseError {
            line,
            msg: "missing call name".to_string(),
        })?
        .as_str()
        .to_ascii_uppercase();

    let args_pair = inner.next();
    let (pos, kw) = match args_pair {
        None => (Vec::new(), HashMap::<String, ValueExpr>::new()),
        Some(p) => parse_arg_list(p, ctx, line)?,
    };

    match name.as_str() {
        "VEC_STORE" => {
            let Some(first) = pos.first() else {
                return Err(StrategyError::InvalidArgs("VEC_STORE(name) missing name".to_string()));
            };
            let Some(store_name) = as_string(first) else {
                return Err(StrategyError::InvalidArgs(
                    "VEC_STORE(name) expects string literal".to_string(),
                ));
            };
            return Ok(ValueExpr::Store(store_name.to_string()));
        }
        "NORMALIZE" => {
            let (mut series, length) = parse_series_and_length(Field::Close, &pos, &kw, line)?;
            ctx.normalize_series_period(&mut series)?;
            if length == 0 {
                return Err(StrategyError::InvalidArgs("NORMALIZE length must be > 0".to_string()));
            }
            let normalize = parse_normalize_method(&kw).unwrap_or(NormalizeMethod::MinMax);
            return Ok(ValueExpr::VecSource(VecExpr {
                series,
                length,
                normalize,
            }));
        }
        "SIMILARITY" => {
            if pos.len() < 2 {
                return Err(StrategyError::InvalidArgs(
                    "SIMILARITY(store, vector, ...) requires 2 args".to_string(),
                ));
            }
            let store_name = match &pos[0] {
                ValueExpr::Store(s) => s.clone(),
                ValueExpr::String(s) => s.clone(),
                other => {
                    return Err(StrategyError::InvalidArgs(format!(
                        "SIMILARITY(store, ...) expects store as VEC_STORE(\"name\") or \"name\", got {other:?}"
                    )))
                }
            };
            let vec_expr = match &pos[1] {
                ValueExpr::VecSource(v) => v.clone(),
                other => {
                    return Err(StrategyError::InvalidArgs(format!(
                        "SIMILARITY(..., vector) expects NORMALIZE(...), got {other:?}"
                    )))
                }
            };

            let method = parse_similarity_method(&kw).unwrap_or(SimilarityMethod::Cosine);
            let threshold = parse_threshold(&pos, &kw);
            return Ok(ValueExpr::Similarity(SimilarityExpr {
                store: store_name,
                query: vec_expr,
                method,
                threshold,
            }));
        }
        _ => {}
    }

    // Indicators: RSI/SMA/EMA/STDDEV.
    let (spec, target_period) = match name.as_str() {
        "RSI" => {
            let period = parse_period(&pos, &kw, line)?;
            // Optional series selects period; field must be close.
            let target_period = if let Some(series) = pos.first().and_then(|v| as_series_ref(v)) {
                if series.field != Field::Close {
                    return Err(StrategyError::InvalidArgs("RSI only supports close series".to_string()));
                }
                series.period
            } else {
                None
            };
            (IndicatorSpec::Rsi { period }, target_period)
        }
        "SMA" => {
            let (mut series, period) = parse_series_and_period(Field::Close, &pos, &kw, line)?;
            ctx.normalize_series_period(&mut series)?;
            (
                IndicatorSpec::Sma {
                    field: series.field,
                    period,
                },
                series.period,
            )
        }
        "EMA" => {
            let (mut series, period) = parse_series_and_period(Field::Close, &pos, &kw, line)?;
            ctx.normalize_series_period(&mut series)?;
            (
                IndicatorSpec::Ema {
                    field: series.field,
                    period,
                },
                series.period,
            )
        }
        "STDDEV" => {
            let (mut series, period) = parse_series_and_period(Field::Close, &pos, &kw, line)?;
            ctx.normalize_series_period(&mut series)?;
            (
                IndicatorSpec::StdDev {
                    field: series.field,
                    period,
                },
                series.period,
            )
        }
        _ => return Err(StrategyError::UnknownFunction(name)),
    };

    let indicator = ctx.add_indicator(target_period, spec)?;
    Ok(ValueExpr::Indicator(indicator))
}

fn parse_arg_list(
    pair: pest::iterators::Pair<'_, Rule>,
    ctx: &mut CompileCtx<'_>,
    line: usize,
) -> Result<(Vec<ValueExpr>, HashMap<String, ValueExpr>), StrategyError> {
    debug_assert_eq!(pair.as_rule(), Rule::arg_list);
    let mut pos = Vec::new();
    let mut kw = HashMap::new();
    for arg in pair.into_inner() {
        match arg.as_rule() {
            Rule::kw_arg => {
                let mut inner = arg.into_inner();
                let key = inner.next().unwrap().as_str().to_ascii_lowercase();
                let value_pair = inner.next().unwrap();
                let v = compile_value(value_pair, ctx, line)?;
                kw.insert(key, v);
            }
            Rule::value | Rule::number | Rule::string | Rule::series_ref | Rule::call => {
                pos.push(compile_value(arg, ctx, line)?);
            }
            other => {
                return Err(StrategyError::ParseError {
                    line,
                    msg: format!("unexpected arg: {other:?}"),
                })
            }
        }
    }
    Ok((pos, kw))
}

fn parse_period(pos: &[ValueExpr], kw: &HashMap<String, ValueExpr>, line: usize) -> Result<usize, StrategyError> {
    if let Some(v) = kw.get("period") {
        return as_usize(v).ok_or_else(|| StrategyError::InvalidArgs("period must be number".to_string()));
    }
    // Accept single positional like RSI(14), or second positional like RSI(close, 14)
    let candidate = if pos.len() == 1 {
        &pos[0]
    } else if pos.len() >= 2 {
        &pos[1]
    } else {
        return Err(StrategyError::InvalidArgs(format!(
            "period missing at line {line}"
        )));
    };
    as_usize(candidate).ok_or_else(|| StrategyError::InvalidArgs("period must be number".to_string()))
}

fn parse_series_and_length(
    default_field: Field,
    pos: &[ValueExpr],
    kw: &HashMap<String, ValueExpr>,
    line: usize,
) -> Result<(SeriesRef, usize), StrategyError> {
    let length = if let Some(v) = kw.get("length").or_else(|| kw.get("len")) {
        as_usize(v).ok_or_else(|| StrategyError::InvalidArgs("length must be number".to_string()))?
    } else {
        // Accept NORMALIZE(close, 30) or NORMALIZE(30)
        if pos.len() >= 2 {
            as_usize(&pos[1]).ok_or_else(|| StrategyError::InvalidArgs("length must be number".to_string()))?
        } else if pos.len() == 1 {
            as_usize(&pos[0]).ok_or_else(|| StrategyError::InvalidArgs(format!("length missing at line {line}")))?
        } else {
            return Err(StrategyError::InvalidArgs(format!("length missing at line {line}")));
        }
    };

    let series = if pos.is_empty() {
        SeriesRef {
            field: default_field,
            period: None,
        }
    } else if let Some(series) = as_series_ref(&pos[0]) {
        series.clone()
    } else if pos.len() == 1 && as_usize(&pos[0]).is_some() {
        // NORMALIZE(30)
        SeriesRef {
            field: default_field,
            period: None,
        }
    } else {
        return Err(StrategyError::InvalidArgs("invalid series arg".to_string()));
    };

    Ok((series, length))
}

fn parse_series_and_period(
    default_field: Field,
    pos: &[ValueExpr],
    kw: &HashMap<String, ValueExpr>,
    line: usize,
) -> Result<(SeriesRef, usize), StrategyError> {
    let period = parse_period(pos, kw, line)?;

    // Series rules:
    // - SMA(20) defaults to close
    // - SMA(close, 20)
    // - SMA(close, period=20)
    // - SMA(close@4h, period=20) (handled by caller)
    let series = if pos.is_empty() {
        SeriesRef {
            field: default_field,
            period: None,
        }
    } else if let Some(series) = as_series_ref(&pos[0]) {
        series.clone()
    } else if pos.len() == 1 {
        // SMA(20)
        SeriesRef {
            field: default_field,
            period: None,
        }
    } else {
        return Err(StrategyError::InvalidArgs("invalid series arg".to_string()));
    };

    Ok((series, period))
}

fn as_usize(v: &ValueExpr) -> Option<usize> {
    match v {
        ValueExpr::Number(n) if n.is_finite() && *n >= 0.0 => Some(*n as usize),
        _ => None,
    }
}

fn as_f64(v: &ValueExpr) -> Option<f64> {
    match v {
        ValueExpr::Number(n) if n.is_finite() => Some(*n),
        _ => None,
    }
}

fn as_string(v: &ValueExpr) -> Option<&str> {
    match v {
        ValueExpr::String(s) => Some(s.as_str()),
        _ => None,
    }
}

fn as_series_ref(v: &ValueExpr) -> Option<&SeriesRef> {
    match v {
        ValueExpr::Series(s) => Some(s),
        _ => None,
    }
}

fn eval_cond(cond: &Cond, ctx: &impl EvalContext, store: Option<&VectorStore>) -> bool {
    match cond {
        Cond::Or(a, b) => eval_cond(a, ctx, store) || eval_cond(b, ctx, store),
        Cond::And(a, b) => eval_cond(a, ctx, store) && eval_cond(b, ctx, store),
        Cond::Not(x) => !eval_cond(x, ctx, store),
        Cond::Compare { op, left, right } => {
            let l = eval_value(left, ctx, store);
            let r = eval_value(right, ctx, store);
            if l.is_nan() || r.is_nan() {
                return false;
            }
            match op {
                CmpOp::Lt => l < r,
                CmpOp::Le => l <= r,
                CmpOp::Gt => l > r,
                CmpOp::Ge => l >= r,
                CmpOp::Eq => l == r,
                CmpOp::Ne => l != r,
            }
        }
        Cond::BoolValue(v) => {
            let n = eval_value(v, ctx, store);
            n.is_finite() && n != 0.0
        }
    }
}

fn eval_value(expr: &ValueExpr, ctx: &impl EvalContext, store: Option<&VectorStore>) -> f64 {
    match expr {
        ValueExpr::Number(n) => *n,
        ValueExpr::String(_) => f64::NAN,
        ValueExpr::Series(s) => ctx
            .bars(s.period)
            .and_then(|b| b.last_f64(s.field))
            .unwrap_or(f64::NAN),
        ValueExpr::Indicator(ind) => match ctx.indicator_last(ind.period, ind.id) {
            Some(IndicatorValue::F64(v)) => v,
            _ => f64::NAN,
        },
        ValueExpr::VecSource(_) => f64::NAN,
        ValueExpr::Store(_) => f64::NAN,
        ValueExpr::Similarity(expr) => eval_similarity(expr, ctx, store),
    }
}

fn eval_similarity(expr: &SimilarityExpr, ctx: &impl EvalContext, store: Option<&VectorStore>) -> f64 {
    let Some(store) = store else {
        return f64::NAN;
    };
    let Some(query) = eval_vec_expr(&expr.query, ctx) else {
        return f64::NAN;
    };
    let Some(best) = store.find_best_by(&expr.store, &query, expr.method) else {
        return f64::NAN;
    };
    let threshold = expr.threshold.unwrap_or(store.threshold);
    if best.score >= threshold {
        best.score
    } else {
        f64::NAN
    }
}

fn eval_vec_expr(expr: &VecExpr, ctx: &impl EvalContext) -> Option<Vec<f64>> {
    if expr.length == 0 {
        return None;
    }
    let bars = ctx.bars(expr.series.period)?;
    let len = bars.len();
    if len < expr.length {
        return None;
    }
    let start = len - expr.length;
    let mut v = Vec::with_capacity(expr.length);
    for i in 0..expr.length {
        let x = bars.get_f64(expr.series.field, start + i)?;
        if !x.is_finite() {
            return None;
        }
        v.push(x);
    }
    Some(match expr.normalize {
        NormalizeMethod::None => v,
        NormalizeMethod::MinMax => min_max_normalize(&v),
        NormalizeMethod::ZScore => z_score_normalize(&v),
        NormalizeMethod::L2 => normalize_vector(&v),
    })
}

fn parse_normalize_method(kw: &HashMap<String, ValueExpr>) -> Option<NormalizeMethod> {
    let s = kw
        .get("method")
        .or_else(|| kw.get("norm"))
        .or_else(|| kw.get("normalize"))
        .and_then(as_string)?;
    NormalizeMethod::parse(s)
}

fn parse_similarity_method(kw: &HashMap<String, ValueExpr>) -> Option<SimilarityMethod> {
    let s = kw.get("method").or_else(|| kw.get("metric")).and_then(as_string)?;
    SimilarityMethod::parse(s)
}

fn parse_threshold(pos: &[ValueExpr], kw: &HashMap<String, ValueExpr>) -> Option<f64> {
    if let Some(v) = kw.get("threshold").or_else(|| kw.get("thresh")) {
        return as_f64(v);
    }
    if pos.len() >= 3 {
        return as_f64(&pos[2]);
    }
    None
}

fn parse_string(s: &str) -> String {
    let s = s.trim();
    if s.len() >= 2 && s.starts_with('"') && s.ends_with('"') {
        return s[1..s.len() - 1].to_string();
    }
    s.to_string()
}
