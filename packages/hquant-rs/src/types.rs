use core::fmt;

#[derive(Clone, Copy, Debug, Default, PartialEq)]
pub struct Bar {
    pub timestamp: i64,
    pub open: f64,
    pub high: f64,
    pub low: f64,
    pub close: f64,
    pub volume: f64,
    pub buy_volume: f64,
}

#[derive(Clone, Copy, Debug, Eq, Hash, PartialEq)]
pub enum Field {
    Open,
    High,
    Low,
    Close,
    Volume,
    BuyVolume,
}

impl Field {
    pub fn as_str(self) -> &'static str {
        match self {
            Field::Open => "open",
            Field::High => "high",
            Field::Low => "low",
            Field::Close => "close",
            Field::Volume => "volume",
            Field::BuyVolume => "buy_volume",
        }
    }

    pub fn parse(s: &str) -> Option<Self> {
        match s {
            "open" => Some(Field::Open),
            "high" => Some(Field::High),
            "low" => Some(Field::Low),
            "close" => Some(Field::Close),
            "volume" => Some(Field::Volume),
            "buy_volume" | "buyVolume" => Some(Field::BuyVolume),
            _ => None,
        }
    }
}

#[derive(Clone, Copy, Debug, Eq, Hash, PartialEq)]
pub enum Action {
    Buy,
    Sell,
    Hold,
}

impl Action {
    pub fn as_str(self) -> &'static str {
        match self {
            Action::Buy => "BUY",
            Action::Sell => "SELL",
            Action::Hold => "HOLD",
        }
    }

    pub fn parse(s: &str) -> Option<Self> {
        match s.trim().to_ascii_uppercase().as_str() {
            "BUY" => Some(Action::Buy),
            "SELL" => Some(Action::Sell),
            "HOLD" => Some(Action::Hold),
            _ => None,
        }
    }
}

impl fmt::Display for Action {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str(self.as_str())
    }
}

#[derive(Clone, Debug, PartialEq)]
pub struct Signal {
    pub strategy_id: u32,
    pub action: Action,
    pub timestamp: i64,
    pub meta: Option<String>,
}
