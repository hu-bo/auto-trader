//! Strategy DSL - Domain Specific Language for trading strategies
//!
//! Uses pest for parsing - grammar defined in `strategy.pest`
//!
//! Syntax:
//! ```text
//! # Variable assignment
//! ema20 = EMA(close, period=20)
//!
//! # Normalization
//! vector = NORMALIZE(ema20, length=30)
//!
//! # Similarity matching
//! hit = SIMILARITY(VEC_STORE("4h_BTC"), vector)
//!
//! # Conditional signals
//! IF RSI(14) < 30 THEN BUY
//! IF RSI(14) > 70 THEN SELL
//!
//! # Multi-period access
//! close_4h = close@4h
//! ```

mod ast;
mod eval;
mod parser;
mod vector_store;

pub use ast::*;
pub use eval::{DslContext, DslEngine};
pub use parser::parse;
pub use vector_store::{LabeledVector, VectorStore};

use crate::error::QuantError;

/// Parse and compile a DSL strategy
pub fn compile(source: &str) -> Result<Vec<Statement>, QuantError> {
    parser::parse(source)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_compile_simple() {
        let source = r#"
            ema20 = EMA(close, period=20)
            IF RSI(14) < 30 THEN BUY
            IF RSI(14) > 70 THEN SELL
        "#;
        let stmts = compile(source).unwrap();
        assert_eq!(stmts.len(), 3);
    }

    #[test]
    fn test_compile_similarity() {
        let source = r#"
            vector = NORMALIZE(close, length=30)
            hit = SIMILARITY(VEC_STORE("4h_BTC"), vector)
            IF hit.label == 1 THEN BUY
        "#;
        let stmts = compile(source).unwrap();
        assert_eq!(stmts.len(), 3);
    }

    #[test]
    fn test_compile_multi_period() {
        let source = r#"
            close_4h = close@4h
            ema_4h = EMA(close@4h, period=20)
        "#;
        let stmts = compile(source).unwrap();
        assert_eq!(stmts.len(), 2);
    }
}
