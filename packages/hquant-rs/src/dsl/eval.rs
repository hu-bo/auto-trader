//! Evaluator for the Strategy DSL

use std::collections::HashMap;

use super::ast::{Action, BinaryOperator, Expr, Statement, UnaryOperator};
use super::vector_store::{min_max_normalize, SimilarityResult, VectorStore};
use crate::error::QuantError;
use crate::indicators::IndicatorGraph;
use crate::kline::Bar;
use crate::strategy::Signal;

/// Runtime value type
#[derive(Debug, Clone)]
pub enum Value {
    Number(f64),
    Bool(bool),
    String(String),
    Vector(Vec<f64>),
    SimilarityHit(SimilarityResult),
    Null,
}

impl Value {
    pub fn as_number(&self) -> Option<f64> {
        match self {
            Value::Number(n) => Some(*n),
            _ => None,
        }
    }

    pub fn as_vector(&self) -> Option<&Vec<f64>> {
        match self {
            Value::Vector(v) => Some(v),
            _ => None,
        }
    }

    pub fn is_truthy(&self) -> bool {
        match self {
            Value::Bool(b) => *b,
            Value::Number(n) => *n != 0.0,
            Value::Null => false,
            Value::String(s) => !s.is_empty(),
            Value::Vector(v) => !v.is_empty(),
            Value::SimilarityHit(_) => true,
        }
    }
}

/// Execution context for DSL
pub struct DslContext<'a> {
    /// Current bar data
    pub bar: &'a Bar,
    /// Multi-period bars (period -> bar)
    pub period_bars: HashMap<String, &'a Bar>,
    /// Named indicators (backed by IndicatorGraph)
    pub indicators: &'a IndicatorGraph,
    /// Multi-period indicators (period -> graph)
    pub period_indicators: HashMap<String, &'a IndicatorGraph>,
}

impl<'a> DslContext<'a> {
    pub fn new(bar: &'a Bar, indicators: &'a IndicatorGraph) -> Self {
        Self {
            bar,
            period_bars: HashMap::new(),
            indicators,
            period_indicators: HashMap::new(),
        }
    }

    /// Add a period-specific bar
    pub fn with_period_bar(mut self, period: &str, bar: &'a Bar) -> Self {
        self.period_bars.insert(period.to_string(), bar);
        self
    }

    /// Add period-specific indicators
    pub fn with_period_indicators(mut self, period: &str, indicators: &'a IndicatorGraph) -> Self {
        self.period_indicators
            .insert(period.to_string(), indicators);
        self
    }

    /// Get series value (open, high, low, close, volume, buy_volume)
    pub fn get_series(&self, name: &str, period: Option<&str>) -> Option<f64> {
        let bar = if let Some(p) = period {
            self.period_bars.get(p).copied()?
        } else {
            self.bar
        };

        match name.to_lowercase().as_str() {
            "open" => Some(bar.open),
            "high" => Some(bar.high),
            "low" => Some(bar.low),
            "close" => Some(bar.close),
            "volume" => Some(bar.volume),
            "buy_volume" => Some(bar.buy_volume),
            _ => None,
        }
    }

    /// Get indicator value
    pub fn get_indicator(&self, name: &str, period: Option<&str>) -> Option<f64> {
        let graph = if let Some(p) = period {
            *self.period_indicators.get(p)?
        } else {
            self.indicators
        };

        graph.value_by_name(name)
    }

    /// Get indicator history (last n values)
    pub fn get_indicator_history(
        &self,
        name: &str,
        period: Option<&str>,
        length: usize,
    ) -> Option<Vec<f64>> {
        let graph = if let Some(p) = period {
            *self.period_indicators.get(p)?
        } else {
            self.indicators
        };

        let indicator = graph.indicator_by_name(name)?;
        let mut values = Vec::with_capacity(length);
        for i in 0..length {
            if let Some(v) = indicator.get_from_end(length - 1 - i) {
                values.push(v);
            } else {
                return None;
            }
        }
        Some(values)
    }
}

/// DSL execution engine
pub struct DslEngine {
    /// Compiled statements
    statements: Vec<Statement>,
    /// Variable bindings
    variables: HashMap<String, Value>,
    /// Vector store
    vector_store: VectorStore,
    /// Generated signals
    signals: Vec<Signal>,
}

impl DslEngine {
    /// Create a new DSL engine from source code
    pub fn new(source: &str) -> Result<Self, QuantError> {
        let statements = super::compile(source)?;
        Ok(Self {
            statements,
            variables: HashMap::new(),
            vector_store: VectorStore::new(),
            signals: Vec::new(),
        })
    }

    /// Create from pre-compiled statements
    pub fn from_statements(statements: Vec<Statement>) -> Self {
        Self {
            statements,
            variables: HashMap::new(),
            vector_store: VectorStore::new(),
            signals: Vec::new(),
        }
    }

    /// Get mutable access to vector store
    pub fn vector_store_mut(&mut self) -> &mut VectorStore {
        &mut self.vector_store
    }

    /// Get vector store
    pub fn vector_store(&self) -> &VectorStore {
        &self.vector_store
    }

    /// Set similarity threshold
    pub fn set_threshold(&mut self, threshold: f64) {
        self.vector_store.set_threshold(threshold);
    }

    /// Evaluate all statements and return signals
    pub fn evaluate(&mut self, ctx: &DslContext) -> Result<Vec<Signal>, QuantError> {
        self.signals.clear();
        self.variables.clear();

        for i in 0..self.statements.len() {
            // Clone the statement to avoid borrow conflict
            let stmt = self.statements[i].clone();
            self.eval_statement_ref(&stmt, ctx)?;
        }

        Ok(std::mem::take(&mut self.signals))
    }

    fn eval_statement_ref(&mut self, stmt: &Statement, ctx: &DslContext) -> Result<(), QuantError> {
        match stmt {
            Statement::Assignment { name, value } => {
                let val = self.eval_expr(value, ctx)?;
                self.variables.insert(name.clone(), val);
            }
            Statement::IfThen { condition, action } => {
                let cond = self.eval_expr(condition, ctx)?;
                if cond.is_truthy() {
                    self.execute_action(action, ctx)?;
                }
            }
        }
        Ok(())
    }

    fn eval_expr(&self, expr: &Expr, ctx: &DslContext) -> Result<Value, QuantError> {
        match expr {
            Expr::Number(n) => Ok(Value::Number(*n)),
            Expr::String(s) => Ok(Value::String(s.clone())),
            Expr::Bool(b) => Ok(Value::Bool(*b)),

            Expr::Variable(name) => self
                .variables
                .get(name)
                .cloned()
                .ok_or_else(|| QuantError::DslEval(format!("Undefined variable: {}", name))),

            Expr::Series { name, period } => ctx
                .get_series(name, period.as_deref())
                .map(Value::Number)
                .ok_or_else(|| QuantError::DslEval(format!("Unknown series: {}", name))),

            Expr::FunctionCall { name, args, kwargs } => {
                self.eval_function(name, args, kwargs, ctx)
            }

            Expr::FieldAccess { object, field } => {
                let obj = self.eval_expr(object, ctx)?;
                match obj {
                    Value::SimilarityHit(hit) => match field.as_str() {
                        "label" => Ok(Value::Number(hit.label as f64)),
                        "score" => Ok(Value::Number(hit.score)),
                        _ => Err(QuantError::DslEval(format!("Unknown field: {}", field))),
                    },
                    _ => Err(QuantError::DslEval(format!(
                        "Cannot access field {} on non-object",
                        field
                    ))),
                }
            }

            Expr::BinaryOp { left, op, right } => {
                let l = self.eval_expr(left, ctx)?;
                let r = self.eval_expr(right, ctx)?;
                self.eval_binary_op(*op, l, r)
            }

            Expr::UnaryOp { op, operand } => {
                let val = self.eval_expr(operand, ctx)?;
                self.eval_unary_op(*op, val)
            }
        }
    }

    fn eval_function(
        &self,
        name: &str,
        args: &[Expr],
        kwargs: &HashMap<String, Expr>,
        ctx: &DslContext,
    ) -> Result<Value, QuantError> {
        match name.to_uppercase().as_str() {
            // Indicator functions - return current value
            "EMA" | "SMA" | "WMA" | "MA" => {
                // EMA(close, period=20) or EMA(20)
                let period = if let Some(p) = kwargs.get("period") {
                    self.eval_expr(p, ctx)?.as_number().unwrap_or(20.0) as usize
                } else if args.len() >= 2 {
                    self.eval_expr(&args[1], ctx)?.as_number().unwrap_or(20.0) as usize
                } else if args.len() == 1 {
                    // Just period provided
                    self.eval_expr(&args[0], ctx)?.as_number().unwrap_or(20.0) as usize
                } else {
                    20
                };

                // Try to get from indicators
                let indicator_name = format!("{}_{}", name.to_lowercase(), period);
                if let Some(v) = ctx.get_indicator(&indicator_name, None) {
                    return Ok(Value::Number(v));
                }
                // Fallback: just return close
                Ok(Value::Number(ctx.bar.close))
            }

            "RSI" => {
                let period = if let Some(p) = kwargs.get("period") {
                    self.eval_expr(p, ctx)?.as_number().unwrap_or(14.0) as usize
                } else if !args.is_empty() {
                    self.eval_expr(&args[0], ctx)?.as_number().unwrap_or(14.0) as usize
                } else {
                    14
                };

                let indicator_name = format!("rsi_{}", period);
                if let Some(v) = ctx.get_indicator(&indicator_name, None) {
                    return Ok(Value::Number(v));
                }
                // Try without suffix
                if let Some(v) = ctx.get_indicator("rsi", None) {
                    return Ok(Value::Number(v));
                }
                Ok(Value::Null)
            }

            "MACD" => {
                if let Some(v) = ctx.get_indicator("macd", None) {
                    Ok(Value::Number(v))
                } else {
                    Ok(Value::Null)
                }
            }

            "ATR" => {
                let period = if let Some(p) = kwargs.get("period") {
                    self.eval_expr(p, ctx)?.as_number().unwrap_or(14.0) as usize
                } else if !args.is_empty() {
                    self.eval_expr(&args[0], ctx)?.as_number().unwrap_or(14.0) as usize
                } else {
                    14
                };

                let indicator_name = format!("atr_{}", period);
                if let Some(v) = ctx.get_indicator(&indicator_name, None) {
                    return Ok(Value::Number(v));
                }
                if let Some(v) = ctx.get_indicator("atr", None) {
                    return Ok(Value::Number(v));
                }
                Ok(Value::Null)
            }

            "BOLL" => {
                if let Some(v) = ctx.get_indicator("boll", None) {
                    Ok(Value::Number(v))
                } else {
                    Ok(Value::Null)
                }
            }

            // Vector functions
            "NORMALIZE" => {
                // NORMALIZE(series, length=30)
                let length = kwargs
                    .get("length")
                    .map(|e| self.eval_expr(e, ctx).ok())
                    .flatten()
                    .and_then(|v| v.as_number())
                    .unwrap_or(30.0) as usize;

                // Get series or indicator name from first arg
                if let Some(arg) = args.first() {
                    match arg {
                        Expr::Series { name: _, period: _ } => {
                            // Get history from series
                            // For now, just return empty vector
                            // In real implementation, would need KlineSeries access
                            Ok(Value::Vector(vec![0.0; length]))
                        }
                        Expr::Variable(name) => {
                            // Try to get indicator history
                            if let Some(history) = ctx.get_indicator_history(name, None, length) {
                                Ok(Value::Vector(min_max_normalize(&history)))
                            } else {
                                Ok(Value::Vector(vec![0.0; length]))
                            }
                        }
                        _ => {
                            let val = self.eval_expr(arg, ctx)?;
                            if let Some(v) = val.as_vector() {
                                Ok(Value::Vector(min_max_normalize(v)))
                            } else {
                                Ok(Value::Vector(vec![0.0; length]))
                            }
                        }
                    }
                } else {
                    Err(QuantError::DslEval(
                        "NORMALIZE requires an argument".to_string(),
                    ))
                }
            }

            "VEC_STORE" => {
                // VEC_STORE("store_name") - returns reference to store
                if let Some(Expr::String(name)) = args.first() {
                    if self.vector_store.has_store(name) {
                        // Return a marker value
                        Ok(Value::String(format!("__store:{}", name)))
                    } else {
                        Err(QuantError::DslEval(format!(
                            "Vector store not found: {}",
                            name
                        )))
                    }
                } else {
                    Err(QuantError::DslEval(
                        "VEC_STORE requires store name".to_string(),
                    ))
                }
            }

            "SIMILARITY" => {
                // SIMILARITY(store, vector) or SIMILARITY(store, vector, method="cosine")
                if args.len() < 2 {
                    return Err(QuantError::DslEval(
                        "SIMILARITY requires store and vector".to_string(),
                    ));
                }

                let store_val = self.eval_expr(&args[0], ctx)?;
                let vector_val = self.eval_expr(&args[1], ctx)?;

                let store_name = match &store_val {
                    Value::String(s) if s.starts_with("__store:") => {
                        s.strip_prefix("__store:").unwrap().to_string()
                    }
                    _ => {
                        return Err(QuantError::DslEval(
                            "First argument must be VEC_STORE".to_string(),
                        ))
                    }
                };

                let query = match &vector_val {
                    Value::Vector(v) => v.clone(),
                    _ => {
                        return Err(QuantError::DslEval(
                            "Second argument must be vector".to_string(),
                        ))
                    }
                };

                if let Some(result) = self.vector_store.find_similar(&store_name, &query) {
                    Ok(Value::SimilarityHit(result))
                } else {
                    Ok(Value::Null)
                }
            }

            _ => Err(QuantError::DslEval(format!("Unknown function: {}", name))),
        }
    }

    fn eval_binary_op(
        &self,
        op: BinaryOperator,
        left: Value,
        right: Value,
    ) -> Result<Value, QuantError> {
        match op {
            BinaryOperator::Add => {
                let l = left.as_number().unwrap_or(0.0);
                let r = right.as_number().unwrap_or(0.0);
                Ok(Value::Number(l + r))
            }
            BinaryOperator::Sub => {
                let l = left.as_number().unwrap_or(0.0);
                let r = right.as_number().unwrap_or(0.0);
                Ok(Value::Number(l - r))
            }
            BinaryOperator::Mul => {
                let l = left.as_number().unwrap_or(0.0);
                let r = right.as_number().unwrap_or(0.0);
                Ok(Value::Number(l * r))
            }
            BinaryOperator::Div => {
                let l = left.as_number().unwrap_or(0.0);
                let r = right.as_number().unwrap_or(1.0);
                Ok(Value::Number(l / r))
            }
            BinaryOperator::Lt => {
                let l = left.as_number().unwrap_or(0.0);
                let r = right.as_number().unwrap_or(0.0);
                Ok(Value::Bool(l < r))
            }
            BinaryOperator::Gt => {
                let l = left.as_number().unwrap_or(0.0);
                let r = right.as_number().unwrap_or(0.0);
                Ok(Value::Bool(l > r))
            }
            BinaryOperator::Le => {
                let l = left.as_number().unwrap_or(0.0);
                let r = right.as_number().unwrap_or(0.0);
                Ok(Value::Bool(l <= r))
            }
            BinaryOperator::Ge => {
                let l = left.as_number().unwrap_or(0.0);
                let r = right.as_number().unwrap_or(0.0);
                Ok(Value::Bool(l >= r))
            }
            BinaryOperator::Eq => match (&left, &right) {
                (Value::Number(l), Value::Number(r)) => Ok(Value::Bool((l - r).abs() < 1e-10)),
                (Value::Bool(l), Value::Bool(r)) => Ok(Value::Bool(l == r)),
                (Value::String(l), Value::String(r)) => Ok(Value::Bool(l == r)),
                _ => Ok(Value::Bool(false)),
            },
            BinaryOperator::Ne => match (&left, &right) {
                (Value::Number(l), Value::Number(r)) => Ok(Value::Bool((l - r).abs() >= 1e-10)),
                (Value::Bool(l), Value::Bool(r)) => Ok(Value::Bool(l != r)),
                (Value::String(l), Value::String(r)) => Ok(Value::Bool(l != r)),
                _ => Ok(Value::Bool(true)),
            },
            BinaryOperator::And => Ok(Value::Bool(left.is_truthy() && right.is_truthy())),
            BinaryOperator::Or => Ok(Value::Bool(left.is_truthy() || right.is_truthy())),
        }
    }

    fn eval_unary_op(&self, op: UnaryOperator, val: Value) -> Result<Value, QuantError> {
        match op {
            UnaryOperator::Not => Ok(Value::Bool(!val.is_truthy())),
            UnaryOperator::Neg => {
                let n = val.as_number().unwrap_or(0.0);
                Ok(Value::Number(-n))
            }
        }
    }

    fn execute_action(&mut self, action: &Action, ctx: &DslContext) -> Result<(), QuantError> {
        let signal = match action {
            Action::Buy(meta) => {
                let reason = meta
                    .as_ref()
                    .and_then(|m| m.get("reason"))
                    .and_then(|e| {
                        if let Expr::String(s) = e {
                            Some(s.clone())
                        } else {
                            None
                        }
                    })
                    .unwrap_or_else(|| "DSL buy signal".to_string());
                Signal::buy(0.8, reason, ctx.bar.timestamp)
            }
            Action::Sell(meta) => {
                let reason = meta
                    .as_ref()
                    .and_then(|m| m.get("reason"))
                    .and_then(|e| {
                        if let Expr::String(s) = e {
                            Some(s.clone())
                        } else {
                            None
                        }
                    })
                    .unwrap_or_else(|| "DSL sell signal".to_string());
                Signal::sell(0.8, reason, ctx.bar.timestamp)
            }
            Action::Hold => Signal::hold(ctx.bar.timestamp),
        };

        self.signals.push(signal);
        Ok(())
    }

    /// Reset engine state
    pub fn reset(&mut self) {
        self.variables.clear();
        self.signals.clear();
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::Side;

    fn make_bar(close: f64) -> Bar {
        Bar::new(1000, 100.0, 110.0, 90.0, close, 1000.0)
    }

    #[test]
    fn test_simple_condition() {
        let source = "IF close > 100 THEN BUY";
        let mut engine = DslEngine::new(source).unwrap();
        let bar = make_bar(105.0);
        let indicators = IndicatorGraph::new();
        let ctx = DslContext::new(&bar, &indicators);

        let signals = engine.evaluate(&ctx).unwrap();
        assert_eq!(signals.len(), 1);
        assert_eq!(signals[0].side, Side::Buy);
    }

    #[test]
    fn test_no_signal() {
        let source = "IF close > 100 THEN BUY";
        let mut engine = DslEngine::new(source).unwrap();
        let bar = make_bar(95.0);
        let indicators = IndicatorGraph::new();
        let ctx = DslContext::new(&bar, &indicators);

        let signals = engine.evaluate(&ctx).unwrap();
        assert!(signals.is_empty());
    }

    #[test]
    fn test_assignment_and_condition() {
        let source = r#"
            threshold = 100
            IF close > threshold THEN BUY
        "#;
        let mut engine = DslEngine::new(source).unwrap();
        let bar = make_bar(105.0);
        let indicators = IndicatorGraph::new();
        let ctx = DslContext::new(&bar, &indicators);

        let signals = engine.evaluate(&ctx).unwrap();
        assert_eq!(signals.len(), 1);
    }

    #[test]
    fn test_multiple_conditions() {
        let source = r#"
            IF close < 95 THEN BUY
            IF close > 105 THEN SELL
        "#;
        let mut engine = DslEngine::new(source).unwrap();

        // Test buy
        let bar = make_bar(90.0);
        let indicators = IndicatorGraph::new();
        let ctx = DslContext::new(&bar, &indicators);
        let signals = engine.evaluate(&ctx).unwrap();
        assert_eq!(signals.len(), 1);
        assert_eq!(signals[0].side, Side::Buy);

        // Test sell
        let bar = make_bar(110.0);
        let ctx = DslContext::new(&bar, &indicators);
        let signals = engine.evaluate(&ctx).unwrap();
        assert_eq!(signals.len(), 1);
        assert_eq!(signals[0].side, Side::Sell);
    }

    #[test]
    fn test_logical_and() {
        let source = "IF close > 100 AND volume > 500 THEN BUY";
        let mut engine = DslEngine::new(source).unwrap();
        let bar = make_bar(105.0);
        let indicators = IndicatorGraph::new();
        let ctx = DslContext::new(&bar, &indicators);

        let signals = engine.evaluate(&ctx).unwrap();
        assert_eq!(signals.len(), 1);
    }
}
