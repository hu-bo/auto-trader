//! Parser for the Strategy DSL using pest

use pest::Parser as PestParser;
use pest_derive::Parser;
use std::collections::HashMap;

use super::ast::{Action, BinaryOperator, Expr, Statement, UnaryOperator};
use crate::error::QuantError;

#[derive(Parser)]
#[grammar = "dsl/strategy.pest"]
struct StrategyParser;

/// Parse DSL source code into AST
pub fn parse(source: &str) -> Result<Vec<Statement>, QuantError> {
    let pairs = StrategyParser::parse(Rule::program, source)
        .map_err(|e| QuantError::DslParse(e.to_string()))?;

    let mut statements = Vec::new();

    for pair in pairs {
        if pair.as_rule() == Rule::program {
            for inner in pair.into_inner() {
                if inner.as_rule() == Rule::statement {
                    statements.push(parse_statement(inner)?);
                }
            }
        }
    }

    Ok(statements)
}

fn parse_statement(pair: pest::iterators::Pair<Rule>) -> Result<Statement, QuantError> {
    let inner = pair.into_inner().next().unwrap();
    match inner.as_rule() {
        Rule::assignment => parse_assignment(inner),
        Rule::if_then => parse_if_then(inner),
        _ => Err(QuantError::DslParse(format!(
            "Unexpected rule: {:?}",
            inner.as_rule()
        ))),
    }
}

fn parse_assignment(pair: pest::iterators::Pair<Rule>) -> Result<Statement, QuantError> {
    let mut inner = pair.into_inner();
    let name = inner.next().unwrap().as_str().to_string();
    let value = parse_expr(inner.next().unwrap())?;
    Ok(Statement::Assignment { name, value })
}

fn parse_if_then(pair: pest::iterators::Pair<Rule>) -> Result<Statement, QuantError> {
    let mut inner = pair.into_inner();
    let condition = parse_expr(inner.next().unwrap())?;
    let action = parse_action(inner.next().unwrap())?;
    Ok(Statement::IfThen { condition, action })
}

fn parse_action(pair: pest::iterators::Pair<Rule>) -> Result<Action, QuantError> {
    let mut inner = pair.into_inner();
    let action_type = inner.next().unwrap();
    let meta = inner.next().map(|p| parse_meta_args(p)).transpose()?;

    match action_type.as_rule() {
        Rule::buy => Ok(Action::Buy(meta)),
        Rule::sell => Ok(Action::Sell(meta)),
        Rule::hold => Ok(Action::Hold),
        _ => Err(QuantError::DslParse("Invalid action".to_string())),
    }
}

fn parse_meta_args(pair: pest::iterators::Pair<Rule>) -> Result<HashMap<String, Expr>, QuantError> {
    let mut meta = HashMap::new();
    for inner in pair.into_inner() {
        if inner.as_rule() == Rule::kwargs {
            for kwarg in inner.into_inner() {
                let (k, v) = parse_kwarg(kwarg)?;
                meta.insert(k, v);
            }
        }
    }
    Ok(meta)
}

fn parse_expr(pair: pest::iterators::Pair<Rule>) -> Result<Expr, QuantError> {
    match pair.as_rule() {
        Rule::expr => parse_expr(pair.into_inner().next().unwrap()),
        Rule::or_expr => parse_binary_expr(pair, |r| r == Rule::or_op, |_| BinaryOperator::Or),
        Rule::and_expr => parse_binary_expr(pair, |r| r == Rule::and_op, |_| BinaryOperator::And),
        Rule::not_expr => parse_not_expr(pair),
        Rule::comparison => parse_comparison(pair),
        Rule::additive => parse_binary_expr(
            pair,
            |r| r == Rule::add_op,
            |s| {
                if s == "+" {
                    BinaryOperator::Add
                } else {
                    BinaryOperator::Sub
                }
            },
        ),
        Rule::multiplicative => parse_binary_expr(
            pair,
            |r| r == Rule::mul_op,
            |s| {
                if s == "*" {
                    BinaryOperator::Mul
                } else {
                    BinaryOperator::Div
                }
            },
        ),
        Rule::unary => parse_unary(pair),
        Rule::postfix => parse_postfix(pair),
        Rule::primary => parse_primary(pair),
        Rule::number => Ok(Expr::Number(pair.as_str().parse().unwrap_or(0.0))),
        Rule::string => {
            let s = pair.as_str();
            // Remove quotes
            let inner = &s[1..s.len() - 1];
            // Handle escape sequences
            let unescaped = inner
                .replace("\\n", "\n")
                .replace("\\t", "\t")
                .replace("\\r", "\r")
                .replace("\\\"", "\"")
                .replace("\\'", "'")
                .replace("\\\\", "\\");
            Ok(Expr::String(unescaped))
        }
        Rule::boolean => {
            let val = pair.as_str().to_uppercase() == "TRUE";
            Ok(Expr::Bool(val))
        }
        Rule::identifier => {
            let name = pair.as_str().to_string();
            let series_names = ["open", "high", "low", "close", "volume", "buy_volume"];
            if series_names.contains(&name.to_lowercase().as_str()) {
                Ok(Expr::Series { name, period: None })
            } else {
                Ok(Expr::Variable(name))
            }
        }
        Rule::function_call => parse_function_call(pair),
        _ => Err(QuantError::DslParse(format!(
            "Unexpected expression rule: {:?}",
            pair.as_rule()
        ))),
    }
}

fn parse_binary_expr<F, G>(
    pair: pest::iterators::Pair<Rule>,
    is_op: F,
    get_op: G,
) -> Result<Expr, QuantError>
where
    F: Fn(Rule) -> bool,
    G: Fn(&str) -> BinaryOperator,
{
    let mut inner = pair.into_inner().peekable();
    let mut left = parse_expr(inner.next().unwrap())?;

    while let Some(next) = inner.peek() {
        if is_op(next.as_rule()) {
            let op_pair = inner.next().unwrap();
            let op = get_op(op_pair.as_str());
            let right = parse_expr(inner.next().unwrap())?;
            left = Expr::BinaryOp {
                left: Box::new(left),
                op,
                right: Box::new(right),
            };
        } else {
            break;
        }
    }

    Ok(left)
}

fn parse_not_expr(pair: pest::iterators::Pair<Rule>) -> Result<Expr, QuantError> {
    let mut inner = pair.into_inner();
    let first = inner.next().unwrap();

    if first.as_rule() == Rule::not_op {
        let operand = parse_expr(inner.next().unwrap())?;
        Ok(Expr::UnaryOp {
            op: UnaryOperator::Not,
            operand: Box::new(operand),
        })
    } else {
        parse_expr(first)
    }
}

fn parse_comparison(pair: pest::iterators::Pair<Rule>) -> Result<Expr, QuantError> {
    parse_binary_expr(
        pair,
        |r| r == Rule::comp_op,
        |s| match s {
            "<" => BinaryOperator::Lt,
            ">" => BinaryOperator::Gt,
            "<=" => BinaryOperator::Le,
            ">=" => BinaryOperator::Ge,
            "==" => BinaryOperator::Eq,
            "!=" => BinaryOperator::Ne,
            _ => BinaryOperator::Eq,
        },
    )
}

fn parse_unary(pair: pest::iterators::Pair<Rule>) -> Result<Expr, QuantError> {
    let mut inner = pair.into_inner();
    let first = inner.next().unwrap();

    if first.as_rule() == Rule::neg_op {
        let operand = parse_expr(inner.next().unwrap())?;
        Ok(Expr::UnaryOp {
            op: UnaryOperator::Neg,
            operand: Box::new(operand),
        })
    } else {
        parse_expr(first)
    }
}

fn parse_postfix(pair: pest::iterators::Pair<Rule>) -> Result<Expr, QuantError> {
    let mut inner = pair.into_inner();
    let mut expr = parse_expr(inner.next().unwrap())?;

    for access in inner {
        match access.as_rule() {
            Rule::field_access => {
                let field = access.into_inner().next().unwrap().as_str().to_string();
                expr = Expr::FieldAccess {
                    object: Box::new(expr),
                    field,
                };
            }
            Rule::period_access => {
                let period = access.into_inner().next().unwrap().as_str().to_string();
                if let Expr::Variable(name) | Expr::Series { name, .. } = expr {
                    expr = Expr::Series {
                        name,
                        period: Some(period),
                    };
                }
            }
            _ => {}
        }
    }

    Ok(expr)
}

fn parse_primary(pair: pest::iterators::Pair<Rule>) -> Result<Expr, QuantError> {
    let inner = pair.into_inner().next().unwrap();
    parse_expr(inner)
}

fn parse_function_call(pair: pest::iterators::Pair<Rule>) -> Result<Expr, QuantError> {
    let mut inner = pair.into_inner();
    let name = inner.next().unwrap().as_str().to_string();

    let mut args = Vec::new();
    let mut kwargs = HashMap::new();

    if let Some(args_pair) = inner.next() {
        for arg_pair in args_pair.into_inner() {
            match arg_pair.as_rule() {
                Rule::kwarg => {
                    let (k, v) = parse_kwarg(arg_pair)?;
                    kwargs.insert(k, v);
                }
                Rule::arg => {
                    let expr = parse_expr(arg_pair.into_inner().next().unwrap())?;
                    args.push(expr);
                }
                _ => {}
            }
        }
    }

    Ok(Expr::FunctionCall { name, args, kwargs })
}

fn parse_kwarg(pair: pest::iterators::Pair<Rule>) -> Result<(String, Expr), QuantError> {
    let mut inner = pair.into_inner();
    let name = inner.next().unwrap().as_str().to_string();
    let value = parse_expr(inner.next().unwrap())?;
    Ok((name, value))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_assignment() {
        let stmts = parse("ema20 = EMA(close, period=20)").unwrap();
        assert_eq!(stmts.len(), 1);
        match &stmts[0] {
            Statement::Assignment { name, value } => {
                assert_eq!(name, "ema20");
                match value {
                    Expr::FunctionCall { name, args, kwargs } => {
                        assert_eq!(name, "EMA");
                        assert_eq!(args.len(), 1);
                        assert!(kwargs.contains_key("period"));
                    }
                    _ => panic!("Expected function call"),
                }
            }
            _ => panic!("Expected assignment"),
        }
    }

    #[test]
    fn test_parse_if_then() {
        let stmts = parse("IF RSI(14) < 30 THEN BUY").unwrap();
        assert_eq!(stmts.len(), 1);
        match &stmts[0] {
            Statement::IfThen { condition, action } => {
                match condition {
                    Expr::BinaryOp { op, right, .. } => {
                        assert_eq!(*op, BinaryOperator::Lt);
                        match right.as_ref() {
                            Expr::Number(n) => assert_eq!(*n, 30.0),
                            _ => panic!("Expected number"),
                        }
                    }
                    _ => panic!("Expected binary op"),
                }
                match action {
                    Action::Buy(None) => {}
                    _ => panic!("Expected Buy action"),
                }
            }
            _ => panic!("Expected if-then statement"),
        }
    }

    #[test]
    fn test_parse_field_access() {
        let stmts = parse("IF hit.label == 1 THEN BUY").unwrap();
        assert_eq!(stmts.len(), 1);
        match &stmts[0] {
            Statement::IfThen { condition, .. } => match condition {
                Expr::BinaryOp { left, .. } => match left.as_ref() {
                    Expr::FieldAccess { object, field } => {
                        assert_eq!(field, "label");
                        match object.as_ref() {
                            Expr::Variable(name) => assert_eq!(name, "hit"),
                            _ => panic!("Expected variable"),
                        }
                    }
                    _ => panic!("Expected field access"),
                },
                _ => panic!("Expected binary op"),
            },
            _ => panic!("Expected if-then"),
        }
    }

    #[test]
    fn test_parse_multi_period() {
        let stmts = parse("close_4h = close@4h").unwrap();
        assert_eq!(stmts.len(), 1);
        match &stmts[0] {
            Statement::Assignment { name, value } => {
                assert_eq!(name, "close_4h");
                match value {
                    Expr::Series { name, period } => {
                        assert_eq!(name, "close");
                        assert_eq!(period.as_ref().unwrap(), "4h");
                    }
                    _ => panic!("Expected series"),
                }
            }
            _ => panic!("Expected assignment"),
        }
    }

    #[test]
    fn test_parse_logical_ops() {
        let stmts = parse("IF RSI(14) < 30 AND EMA(20) > 100 THEN BUY").unwrap();
        assert_eq!(stmts.len(), 1);
        match &stmts[0] {
            Statement::IfThen { condition, .. } => match condition {
                Expr::BinaryOp { op, .. } => {
                    assert_eq!(*op, BinaryOperator::And);
                }
                _ => panic!("Expected binary op"),
            },
            _ => panic!("Expected if-then"),
        }
    }

    #[test]
    fn test_parse_string() {
        let stmts = parse(r#"name = VEC_STORE("4h_BTC")"#).unwrap();
        assert_eq!(stmts.len(), 1);
    }

    #[test]
    fn test_parse_multiline() {
        let source = r#"
            ema20 = EMA(close, period=20)
            IF RSI(14) < 30 THEN BUY
            IF RSI(14) > 70 THEN SELL
        "#;
        let stmts = parse(source).unwrap();
        assert_eq!(stmts.len(), 3);
    }
}
