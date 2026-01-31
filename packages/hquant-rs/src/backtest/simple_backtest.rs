use crate::backtest::futures_backtest::PositionSide;

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum MarketType {
    Spot,
    Futures,
}

#[derive(Clone, Debug)]
pub struct BacktestConfig {
    pub market_type: MarketType,
    pub initial_capital: f64,
    pub leverage: f64,
    pub maker_fee_rate: f64,
    pub taker_fee_rate: f64,
}

#[derive(Clone, Copy, Debug, Default)]
pub struct Trade {
    pub timestamp: i64,
    pub side: PositionSide,
    pub price: f64,
    pub size: f64,
    pub fee: f64,
    pub pnl: f64,
}

#[derive(Clone, Copy, Debug, Default)]
pub struct BacktestStats {
    pub total_trades: u32,
    pub winning_trades: u32,
    pub losing_trades: u32,
    pub total_pnl: f64,
    pub max_drawdown: f64,
    pub max_drawdown_pct: f64,
    pub sharpe_ratio: f64,
    pub win_rate: f64,
    pub final_equity: f64,
    pub return_pct: f64,
    pub liquidations: u32,
}

#[derive(Clone, Copy, Debug, Default)]
struct Position {
    side: PositionSide,
    entry_price: f64,
    size: f64,
    is_open: bool,
}

#[derive(Clone, Debug)]
pub struct Backtest {
    config: BacktestConfig,
    equity: f64,
    position: Position,
    trades: Vec<Trade>,
    equity_curve: Vec<f64>,
    peak_equity: f64,
    max_drawdown: f64,
}

impl Backtest {
    pub fn new(config: BacktestConfig) -> Self {
        Self {
            equity: config.initial_capital,
            peak_equity: config.initial_capital,
            max_drawdown: 0.0,
            config,
            position: Position::default(),
            trades: Vec::new(),
            equity_curve: Vec::new(),
        }
    }

    pub fn open_position(&mut self, price: f64, size: f64, position_side: PositionSide) {
        if self.position.is_open || !price.is_finite() || price <= 0.0 || !size.is_finite() || size <= 0.0 {
            return;
        }
        let fee = price * size * self.config.taker_fee_rate;
        self.equity -= fee;
        self.position = Position {
            side: position_side,
            entry_price: price,
            size,
            is_open: true,
        };
        self.push_equity_point();
    }

    pub fn close_position(&mut self, price: f64, position_side: PositionSide) {
        if !self.position.is_open || self.position.side != position_side || !price.is_finite() || price <= 0.0 {
            return;
        }
        let fee = price * self.position.size * self.config.taker_fee_rate;
        let pnl = match position_side {
            PositionSide::Long => (price - self.position.entry_price) * self.position.size,
            PositionSide::Short => (self.position.entry_price - price) * self.position.size,
        };
        self.equity += pnl - fee;
        self.trades.push(Trade {
            timestamp: 0,
            side: position_side,
            price,
            size: self.position.size,
            fee,
            pnl,
        });
        self.position = Position::default();
        self.push_equity_point();
    }

    pub fn equity(&self) -> f64 {
        self.equity
    }

    pub fn trades(&self) -> &[Trade] {
        &self.trades
    }

    pub fn equity_curve(&self) -> &[f64] {
        &self.equity_curve
    }

    pub fn result(&self) -> BacktestStats {
        let total_trades = self.trades.len() as u32;
        let mut winning_trades = 0u32;
        let mut losing_trades = 0u32;
        for t in &self.trades {
            if t.pnl > 0.0 {
                winning_trades += 1;
            } else if t.pnl < 0.0 {
                losing_trades += 1;
            }
        }
        let total_pnl = self.equity - self.config.initial_capital;
        let win_rate = if total_trades == 0 {
            0.0
        } else {
            winning_trades as f64 / total_trades as f64
        };
        let return_pct = total_pnl / self.config.initial_capital;
        BacktestStats {
            total_trades,
            winning_trades,
            losing_trades,
            total_pnl,
            max_drawdown: self.max_drawdown,
            max_drawdown_pct: if self.peak_equity > 0.0 {
                self.max_drawdown / self.peak_equity
            } else {
                0.0
            },
            sharpe_ratio: 0.0,
            win_rate,
            final_equity: self.equity,
            return_pct,
            liquidations: 0,
        }
    }

    pub fn reset(&mut self) {
        self.equity = self.config.initial_capital;
        self.position = Position::default();
        self.trades.clear();
        self.equity_curve.clear();
        self.peak_equity = self.config.initial_capital;
        self.max_drawdown = 0.0;
    }

    fn push_equity_point(&mut self) {
        self.equity_curve.push(self.equity);
        if self.equity > self.peak_equity {
            self.peak_equity = self.equity;
        }
        let dd = (self.peak_equity - self.equity).max(0.0);
        if dd > self.max_drawdown {
            self.max_drawdown = dd;
        }
    }
}

