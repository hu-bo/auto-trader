//! AST (Abstract Syntax Tree) definitions for the Strategy DSL

use std::collections::HashMap;

/// A complete DSL program
#[derive(Debug, Clone)]
pub struct Program {
    pub statements: Vec<Statement>,
}

/// Statement types
#[derive(Debug, Clone)]
pub enum Statement {
    /// Variable assignment: `ema20 = EMA(close, period=20)`
    Assignment { name: String, value: Expr },
    /// Conditional: `IF condition THEN action`
    IfThen { condition: Expr, action: Action },
}

/// Expression types
#[derive(Debug, Clone)]
pub enum Expr {
    /// Numeric literal: `14`, `30.5`
    Number(f64),
    /// String literal: `"4h_BTC"`
    String(String),
    /// Boolean literal: `true`, `false`
    Bool(bool),
    /// Variable reference: `ema20`
    Variable(String),
    /// Series with optional period: `close`, `close@4h`
    Series {
        name: String,
        period: Option<String>,
    },
    /// Function call: `EMA(close, period=20)`
    FunctionCall {
        name: String,
        args: Vec<Expr>,
        kwargs: HashMap<String, Expr>,
    },
    /// Field access: `hit.label`
    FieldAccess { object: Box<Expr>, field: String },
    /// Binary operation: `RSI(14) < 30`
    BinaryOp {
        left: Box<Expr>,
        op: BinaryOperator,
        right: Box<Expr>,
    },
    /// Unary operation: `NOT condition`
    UnaryOp {
        op: UnaryOperator,
        operand: Box<Expr>,
    },
}

/// Binary operators
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum BinaryOperator {
    // Comparison
    Lt, // <
    Gt, // >
    Le, // <=
    Ge, // >=
    Eq, // ==
    Ne, // !=
    // Logical
    And, // AND
    Or,  // OR
    // Arithmetic
    Add, // +
    Sub, // -
    Mul, // *
    Div, // /
}

impl BinaryOperator {
    pub fn precedence(&self) -> u8 {
        match self {
            BinaryOperator::Or => 1,
            BinaryOperator::And => 2,
            BinaryOperator::Eq | BinaryOperator::Ne => 3,
            BinaryOperator::Lt | BinaryOperator::Gt | BinaryOperator::Le | BinaryOperator::Ge => 4,
            BinaryOperator::Add | BinaryOperator::Sub => 5,
            BinaryOperator::Mul | BinaryOperator::Div => 6,
        }
    }
}

/// Unary operators
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum UnaryOperator {
    Not, // NOT
    Neg, // -
}

/// Actions (signal generation)
#[derive(Debug, Clone)]
pub enum Action {
    /// Buy signal with optional meta
    Buy(Option<HashMap<String, Expr>>),
    /// Sell signal with optional meta
    Sell(Option<HashMap<String, Expr>>),
    /// Hold (no action)
    Hold,
}

impl Expr {
    /// Create a number expression
    pub fn num(n: f64) -> Self {
        Expr::Number(n)
    }

    /// Create a variable expression
    pub fn var(name: impl Into<String>) -> Self {
        Expr::Variable(name.into())
    }

    /// Create a series expression
    pub fn series(name: impl Into<String>, period: Option<String>) -> Self {
        Expr::Series {
            name: name.into(),
            period,
        }
    }

    /// Create a function call expression
    pub fn call(name: impl Into<String>, args: Vec<Expr>, kwargs: HashMap<String, Expr>) -> Self {
        Expr::FunctionCall {
            name: name.into(),
            args,
            kwargs,
        }
    }

    /// Create a binary operation expression
    pub fn binary(left: Expr, op: BinaryOperator, right: Expr) -> Self {
        Expr::BinaryOp {
            left: Box::new(left),
            op,
            right: Box::new(right),
        }
    }

    /// Create a field access expression
    pub fn field(object: Expr, field: impl Into<String>) -> Self {
        Expr::FieldAccess {
            object: Box::new(object),
            field: field.into(),
        }
    }
}
