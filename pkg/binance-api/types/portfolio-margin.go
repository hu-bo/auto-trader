package types

// PortfolioMarginAccountInfo represents portfolio margin account info.
type PortfolioMarginAccountInfo struct {
	UniMMR                   string `json:"uniMMR"`
	AccountEquity            string `json:"accountEquity"`
	ActualEquity             string `json:"actualEquity"`
	AccountInitialMargin     string `json:"accountInitialMargin"`
	AccountMaintMargin       string `json:"accountMaintMargin"`
	AccountStatus            string `json:"accountStatus"`
	VirtualMaxWithdrawAmount string `json:"virtualMaxWithdrawAmount"`
	TotalAvailableBalance    string `json:"totalAvailableBalance"`
	TotalMarginOpenLoss      string `json:"totalMarginOpenLoss"`
	UpdateTime               int64  `json:"updateTime"`
}

// PortfolioMarginBalance represents portfolio margin balance.
type PortfolioMarginBalance struct {
	Asset               string `json:"asset"`
	TotalWalletBalance  string `json:"totalWalletBalance"`
	CrossMarginAsset    string `json:"crossMarginAsset"`
	CrossMarginBorrowed string `json:"crossMarginBorrowed"`
	CrossMarginFree     string `json:"crossMarginFree"`
	CrossMarginInterest string `json:"crossMarginInterest"`
	CrossMarginLocked   string `json:"crossMarginLocked"`
	UmWalletBalance     string `json:"umWalletBalance"`
	UmUnrealizedPNL     string `json:"umUnrealizedPNL"`
	CmWalletBalance     string `json:"cmWalletBalance"`
	CmUnrealizedPNL     string `json:"cmUnrealizedPNL"`
	UpdateTime          int64  `json:"updateTime"`
	NegativeBalance     string `json:"negativeBalance"`
}

// PortfolioMarginPosition represents portfolio margin position.
type PortfolioMarginPosition struct {
	Symbol           string       `json:"symbol"`
	PositionAmt      string       `json:"positionAmt"`
	EntryPrice       string       `json:"entryPrice"`
	MarkPrice        string       `json:"markPrice"`
	UnRealizedProfit string       `json:"unRealizedProfit"`
	LiquidationPrice string       `json:"liquidationPrice"`
	Leverage         string       `json:"leverage"`
	MaxNotionalValue string       `json:"maxNotionalValue"`
	MarginType       MarginType   `json:"marginType"`
	IsolatedMargin   string       `json:"isolatedMargin"`
	IsAutoAddMargin  string       `json:"isAutoAddMargin"`
	PositionSide     PositionSide `json:"positionSide"`
	Notional         string       `json:"notional"`
	IsolatedWallet   string       `json:"isolatedWallet"`
	UpdateTime       int64        `json:"updateTime"`
	BreakEvenPrice   string       `json:"breakEvenPrice"`
}
