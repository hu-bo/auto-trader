use core::fmt;

#[derive(Clone, Copy, Debug, Eq, Hash, PartialEq)]
pub struct Period {
    ms: i64,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub enum PeriodParseError {
    Empty,
    InvalidNumber,
    MissingUnit,
    UnsupportedUnit,
    NonPositive,
    Overflow,
}

impl fmt::Display for PeriodParseError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        let msg = match self {
            PeriodParseError::Empty => "empty period",
            PeriodParseError::InvalidNumber => "invalid period number",
            PeriodParseError::MissingUnit => "missing period unit",
            PeriodParseError::UnsupportedUnit => "unsupported period unit",
            PeriodParseError::NonPositive => "period must be > 0",
            PeriodParseError::Overflow => "period overflow",
        };
        f.write_str(msg)
    }
}

impl std::error::Error for PeriodParseError {}

impl Period {
    pub fn parse(s: &str) -> Result<Self, PeriodParseError> {
        let s = s.trim();
        if s.is_empty() {
            return Err(PeriodParseError::Empty);
        }

        let (num_part, unit_part) = split_num_unit(s)?;
        let n: i64 = num_part.parse().map_err(|_| PeriodParseError::InvalidNumber)?;
        if n <= 0 {
            return Err(PeriodParseError::NonPositive);
        }

        let unit_ms: i64 = match unit_part {
            "ms" => 1,
            "s" => 1_000,
            "m" => 60_000,
            "h" => 3_600_000,
            "d" => 86_400_000,
            _ => return Err(PeriodParseError::UnsupportedUnit),
        };

        let ms = n.checked_mul(unit_ms).ok_or(PeriodParseError::Overflow)?;
        Ok(Self { ms })
    }

    pub fn as_ms(self) -> i64 {
        self.ms
    }
}

impl fmt::Display for Period {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        // Canonical formatting.
        let ms = self.ms;
        if ms % 86_400_000 == 0 {
            return write!(f, "{}d", ms / 86_400_000);
        }
        if ms % 3_600_000 == 0 {
            return write!(f, "{}h", ms / 3_600_000);
        }
        if ms % 60_000 == 0 {
            return write!(f, "{}m", ms / 60_000);
        }
        if ms % 1_000 == 0 {
            return write!(f, "{}s", ms / 1_000);
        }
        write!(f, "{}ms", ms)
    }
}

fn split_num_unit(s: &str) -> Result<(&str, &str), PeriodParseError> {
    let mut idx = 0usize;
    for (i, ch) in s.char_indices() {
        if ch.is_ascii_digit() {
            idx = i + ch.len_utf8();
            continue;
        }
        idx = i;
        break;
    }
    if idx == 0 {
        return Err(PeriodParseError::InvalidNumber);
    }
    if idx >= s.len() {
        return Err(PeriodParseError::MissingUnit);
    }
    Ok((&s[..idx], &s[idx..]))
}

