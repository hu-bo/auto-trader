//! Error handling for HQuant

use std::fmt;

/// HQuant error type
#[derive(Debug, Clone)]
pub struct HQuantError {
    pub kind: ErrorKind,
    pub message: String,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ErrorKind {
    InvalidCapacity,
    InvalidArgument,
    InvalidTimeframe,
    IndicatorNotReady,
    InsufficientData,
    DslParse,
    DslEval,
}

impl HQuantError {
    pub fn new(kind: ErrorKind, message: impl Into<String>) -> Self {
        Self {
            kind,
            message: message.into(),
        }
    }

    pub fn invalid_capacity(capacity: usize, component: &str) -> Self {
        Self::new(
            ErrorKind::InvalidCapacity,
            format!("Invalid capacity {} for {}", capacity, component),
        )
    }

    pub fn invalid_argument(message: impl Into<String>) -> Self {
        Self::new(ErrorKind::InvalidArgument, message)
    }

    pub fn invalid_timeframe(message: impl Into<String>) -> Self {
        Self::new(ErrorKind::InvalidTimeframe, message)
    }

    pub fn insufficient_data(required: usize, actual: usize) -> Self {
        Self::new(
            ErrorKind::InsufficientData,
            format!("Insufficient data: required {}, got {}", required, actual),
        )
    }

    pub fn dsl_parse(message: impl Into<String>) -> Self {
        Self::new(ErrorKind::DslParse, message)
    }

    pub fn dsl_eval(message: impl Into<String>) -> Self {
        Self::new(ErrorKind::DslEval, message)
    }
}

/// Convenience enum for DSL errors (used in dsl module)
#[derive(Debug, Clone)]
pub enum QuantError {
    DslParse(String),
    DslEval(String),
    Other(String),
}

impl fmt::Display for QuantError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            QuantError::DslParse(msg) => write!(f, "DSL parse error: {}", msg),
            QuantError::DslEval(msg) => write!(f, "DSL eval error: {}", msg),
            QuantError::Other(msg) => write!(f, "Error: {}", msg),
        }
    }
}

impl std::error::Error for QuantError {}

impl From<QuantError> for HQuantError {
    fn from(e: QuantError) -> Self {
        match e {
            QuantError::DslParse(msg) => HQuantError::dsl_parse(msg),
            QuantError::DslEval(msg) => HQuantError::dsl_eval(msg),
            QuantError::Other(msg) => HQuantError::invalid_argument(msg),
        }
    }
}

impl fmt::Display for HQuantError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{:?}: {}", self.kind, self.message)
    }
}

impl std::error::Error for HQuantError {}

/// Result type alias for HQuant
pub type HQuantResult<T> = Result<T, HQuantError>;
