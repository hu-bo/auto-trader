use std::fmt;

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum HQuantError {
    InvalidCapacity {
        capacity: usize,
        context: &'static str,
    },
    InvalidArgument {
        message: String,
    },
}

pub type HQuantResult<T> = std::result::Result<T, HQuantError>;

impl HQuantError {
    pub fn invalid_capacity(capacity: usize, context: &'static str) -> Self {
        Self::InvalidCapacity { capacity, context }
    }

    pub fn invalid_argument(message: impl Into<String>) -> Self {
        Self::InvalidArgument {
            message: message.into(),
        }
    }
}

impl fmt::Display for HQuantError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            HQuantError::InvalidCapacity { capacity, context } => write!(
                f,
                "invalid capacity {capacity} for {context} (must be > 0)"
            ),
            HQuantError::InvalidArgument { message } => write!(f, "{message}"),
        }
    }
}

impl std::error::Error for HQuantError {}

