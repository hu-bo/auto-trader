use crate::types::Action;

#[repr(C)]
#[derive(Clone, Copy, Debug)]
pub struct BacktestParams {
    pub initial_margin: f64,
    pub leverage: f64,
    pub contract_size: f64,
    pub maker_fee_rate: f64,
    pub taker_fee_rate: f64,
    pub maintenance_margin_rate: f64,
}

impl BacktestParams {
    pub fn is_valid(&self) -> bool {
        fn finite(x: f64) -> bool {
            x.is_finite()
        }
        finite(self.initial_margin)
            && self.initial_margin > 0.0
            && finite(self.leverage)
            && self.leverage >= 1.0
            && finite(self.contract_size)
            && self.contract_size > 0.0
            && finite(self.maker_fee_rate)
            && self.maker_fee_rate >= 0.0
            && finite(self.taker_fee_rate)
            && self.taker_fee_rate >= 0.0
            && finite(self.maintenance_margin_rate)
            && self.maintenance_margin_rate >= 0.0
    }
}

#[repr(C)]
#[derive(Clone, Copy, Debug, Default)]
pub struct BacktestResult {
    pub equity: f64,
    pub profit: f64,
    pub profit_rate: f64,
    pub max_drawdown_rate: f64,
    pub liquidated: bool,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum PositionSide {
    Long,
    Short,
}

impl Default for PositionSide {
    fn default() -> Self {
        PositionSide::Long
    }
}

#[derive(Clone, Copy, Debug)]
pub struct FuturesPosition {
    pub position_side: PositionSide,
    pub entry_price: f64,
    pub mark_price: f64,
    pub position_amt: f64,
    pub margin: f64,
    pub unrealized_pnl: f64,
}

#[derive(Clone, Copy, Debug, Default)]
struct Position {
    entry_price: f64,
    qty: f64,
    margin: f64,
}

impl Position {
    fn is_open(&self) -> bool {
        self.qty > 0.0 && self.margin > 0.0
    }
}

#[derive(Clone, Debug)]
pub struct FuturesBacktest {
    params: BacktestParams,
    cash: f64,
    liquidated: bool,
    pos_long: Position,
    pos_short: Position,
    peak_equity: f64,
    max_drawdown_rate: f64,
}

impl FuturesBacktest {
    pub fn new(params: BacktestParams) -> Self {
        assert!(params.is_valid(), "invalid BacktestParams");
        Self {
            cash: params.initial_margin,
            liquidated: false,
            pos_long: Position::default(),
            pos_short: Position::default(),
            peak_equity: params.initial_margin,
            max_drawdown_rate: 0.0,
            params,
        }
    }

    pub fn try_new(params: BacktestParams) -> Option<Self> {
        if !params.is_valid() {
            return None;
        }
        Some(Self::new(params))
    }

    pub fn cash(&self) -> f64 {
        self.cash
    }

    pub fn params(&self) -> BacktestParams {
        self.params
    }

    pub fn liquidated(&self) -> bool {
        self.liquidated
    }

    pub fn max_open_margin(&self, fee_rate: f64) -> f64 {
        if self.liquidated || self.cash <= 0.0 {
            return 0.0;
        }
        let denom = 1.0 + self.params.leverage * fee_rate;
        if denom <= 0.0 {
            return 0.0;
        }
        (self.cash / denom).max(0.0)
    }

    pub fn locked_margin(&self) -> f64 {
        self.pos_long.margin + self.pos_short.margin
    }

    pub fn total_notional(&self, price: f64) -> f64 {
        if !price.is_finite() || price <= 0.0 {
            return f64::NAN;
        }
        let cs = self.params.contract_size;
        (self.pos_long.qty * price * cs).abs() + (self.pos_short.qty * price * cs).abs()
    }

    pub fn maintenance_margin(&self, price: f64) -> f64 {
        self.total_notional(price) * self.params.maintenance_margin_rate
    }

    pub fn equity(&self, price: f64) -> f64 {
        self.cash + self.locked_margin() + self.unrealized_pnl(price)
    }

    pub fn unrealized_pnl(&self, price: f64) -> f64 {
        if !price.is_finite() {
            return f64::NAN;
        }
        let cs = self.params.contract_size;
        let mut pnl = 0.0;
        if self.pos_long.is_open() {
            pnl += (price - self.pos_long.entry_price) * self.pos_long.qty * cs;
        }
        if self.pos_short.is_open() {
            pnl += (self.pos_short.entry_price - price) * self.pos_short.qty * cs;
        }
        pnl
    }

    pub fn open_long(&mut self, price: f64, margin: f64, fee_rate: f64) {
        self.open_position(PositionSide::Long, price, margin, fee_rate);
    }

    pub fn open_short(&mut self, price: f64, margin: f64, fee_rate: f64) {
        self.open_position(PositionSide::Short, price, margin, fee_rate);
    }

    pub fn close_long(&mut self, price: f64, margin: f64, fee_rate: f64) {
        self.close_position(PositionSide::Long, price, margin, fee_rate);
    }

    pub fn close_short(&mut self, price: f64, margin: f64, fee_rate: f64) {
        self.close_position(PositionSide::Short, price, margin, fee_rate);
    }

    pub fn open_position(&mut self, side: PositionSide, price: f64, margin: f64, fee_rate: f64) {
        if self.liquidated {
            return;
        }
        if !price.is_finite() || price <= 0.0 || !margin.is_finite() || margin <= 0.0 {
            return;
        }
        let open_margin = margin.min(self.max_open_margin(fee_rate));
        if open_margin <= 0.0 {
            return;
        }
        let notional = open_margin * self.params.leverage;
        let fee = notional * fee_rate;
        if self.cash < open_margin + fee {
            return;
        }
        let qty = notional / (price * self.params.contract_size);
        if !qty.is_finite() || qty <= 0.0 {
            return;
        }

        self.cash -= open_margin + fee;
        let pos = match side {
            PositionSide::Long => &mut self.pos_long,
            PositionSide::Short => &mut self.pos_short,
        };
        if pos.is_open() {
            let new_qty = pos.qty + qty;
            let new_entry = (pos.entry_price * pos.qty + price * qty) / new_qty;
            pos.entry_price = new_entry;
            pos.qty = new_qty;
            pos.margin += open_margin;
        } else {
            pos.entry_price = price;
            pos.qty = qty;
            pos.margin = open_margin;
        }
    }

    pub fn close_position(&mut self, side: PositionSide, price: f64, margin: f64, fee_rate: f64) {
        if self.liquidated {
            return;
        }
        if !price.is_finite() || price <= 0.0 || !margin.is_finite() || margin <= 0.0 {
            return;
        }

        let pos = match side {
            PositionSide::Long => &mut self.pos_long,
            PositionSide::Short => &mut self.pos_short,
        };
        if !pos.is_open() {
            return;
        }
        let close_margin = margin.min(pos.margin);
        if close_margin <= 0.0 {
            return;
        }
        let ratio = close_margin / pos.margin;
        let qty_close = pos.qty * ratio;
        let notional_close = qty_close * price * self.params.contract_size;
        let fee = notional_close * fee_rate;
        let pnl = match side {
            PositionSide::Long => (price - pos.entry_price) * qty_close * self.params.contract_size,
            PositionSide::Short => (pos.entry_price - price) * qty_close * self.params.contract_size,
        };

        self.cash += close_margin + pnl - fee;
        pos.margin -= close_margin;
        pos.qty -= qty_close;
        if pos.margin <= 1e-12 || pos.qty <= 1e-12 {
            *pos = Position::default();
        }
    }

    pub fn apply_signal(&mut self, action: Action, price: f64, margin: f64) {
        if self.liquidated {
            return;
        }
        match action {
            Action::Buy => {
                // Close short then open long.
                self.close_short(price, margin, self.params.taker_fee_rate);
                self.open_long(price, margin, self.params.taker_fee_rate);
            }
            Action::Sell => {
                // Close long then open short.
                self.close_long(price, margin, self.params.taker_fee_rate);
                self.open_short(price, margin, self.params.taker_fee_rate);
            }
            Action::Hold => {}
        }
        self.on_price(price);
    }

    pub fn on_price(&mut self, price: f64) {
        if self.liquidated {
            return;
        }
        let eq = self.equity(price);
        let mm = self.maintenance_margin(price);
        if eq.is_finite() && mm.is_finite() && eq <= mm {
            self.liquidated = true;
            self.cash = 0.0;
            self.pos_long = Position::default();
            self.pos_short = Position::default();
            self.peak_equity = self.peak_equity.max(eq);
            self.max_drawdown_rate = self.max_drawdown_rate.min(-1.0);
            return;
        }

        if eq.is_finite() {
            if eq > self.peak_equity {
                self.peak_equity = eq;
            }
            if self.peak_equity > 0.0 {
                let dd = (eq / self.peak_equity) - 1.0;
                if dd < self.max_drawdown_rate {
                    self.max_drawdown_rate = dd;
                }
            }
        }
    }

    pub fn result(&self, price: f64) -> BacktestResult {
        let equity = self.equity(price);
        let profit = equity - self.params.initial_margin;
        let profit_rate = profit / self.params.initial_margin;
        BacktestResult {
            equity,
            profit,
            profit_rate,
            max_drawdown_rate: self.max_drawdown_rate,
            liquidated: self.liquidated,
        }
    }

    pub fn get_positions(&self, price: f64) -> Vec<FuturesPosition> {
        let mut out = Vec::new();
        if self.pos_long.is_open() {
            out.push(FuturesPosition {
                position_side: PositionSide::Long,
                entry_price: self.pos_long.entry_price,
                mark_price: price,
                position_amt: self.pos_long.qty,
                margin: self.pos_long.margin,
                unrealized_pnl: (price - self.pos_long.entry_price) * self.pos_long.qty * self.params.contract_size,
            });
        }
        if self.pos_short.is_open() {
            out.push(FuturesPosition {
                position_side: PositionSide::Short,
                entry_price: self.pos_short.entry_price,
                mark_price: price,
                position_amt: self.pos_short.qty,
                margin: self.pos_short.margin,
                unrealized_pnl: (self.pos_short.entry_price - price) * self.pos_short.qty * self.params.contract_size,
            });
        }
        out
    }
}
