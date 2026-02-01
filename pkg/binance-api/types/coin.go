package types

// FundingRate represents funding rate.
type FundingRate struct {
	Symbol                   string `json:"symbol"`
	AdjustedFundingRateCap   string `json:"adjustedFundingRateCap"`
	AdjustedFundingRateFloor string `json:"adjustedFundingRateFloor"`
	FundingIntervalHours     int    `json:"fundingIntervalHours"`
}

// CoinMAccountBalance represents COIN-M account balance.
type CoinMAccountBalance struct {
	AccountAlias       string `json:"accountAlias"`
	Asset              string `json:"asset"`
	Balance            string `json:"balance"`
	WithdrawAvailable  string `json:"withdrawAvailable"`
	CrossWalletBalance string `json:"crossWalletBalance"`
	CrossUnPnl         string `json:"crossUnPnl"`
	AvailableBalance   string `json:"availableBalance"`
	UpdateTime         int64  `json:"updateTime"`
}

// CoinMAccountPosition represents COIN-M account position.
type CoinMAccountPosition struct {
	Symbol                 string       `json:"symbol"`
	PositionAmt            string       `json:"positionAmt"`
	InitialMargin          string       `json:"initialMargin"`
	MaintMargin            string       `json:"maintMargin"`
	UnrealizedProfit       string       `json:"unrealizedProfit"`
	PositionInitialMargin  string       `json:"positionInitialMargin"`
	OpenOrderInitialMargin string       `json:"openOrderInitialMargin"`
	Leverage               string       `json:"leverage"`
	Isolated               bool         `json:"isolated"`
	PositionSide           PositionSide `json:"positionSide"`
	EntryPrice             string       `json:"entryPrice"`
	MaxQty                 string       `json:"maxQty"`
	UpdateTime             int64        `json:"updateTime"`
}

// CoinMAccountInformation represents COIN-M account information.
type CoinMAccountInformation struct {
	Assets      []CoinMAccountAsset    `json:"assets"`
	Positions   []CoinMAccountPosition `json:"positions"`
	CanTrade    bool                   `json:"canTrade"`
	CanDeposit  bool                   `json:"canDeposit"`
	CanWithdraw bool                   `json:"canWithdraw"`
	FeeTier     int                    `json:"feeTier"`
	UpdateTime  int64                  `json:"updateTime"`
}

// CoinMAccountAsset represents COIN-M account asset.
type CoinMAccountAsset struct {
	Asset                  string `json:"asset"`
	WalletBalance          string `json:"walletBalance"`
	UnrealizedProfit       string `json:"unrealizedProfit"`
	MarginBalance          string `json:"marginBalance"`
	MaintMargin            string `json:"maintMargin"`
	InitialMargin          string `json:"initialMargin"`
	PositionInitialMargin  string `json:"positionInitialMargin"`
	OpenOrderInitialMargin string `json:"openOrderInitialMargin"`
	MaxWithdrawAmount      string `json:"maxWithdrawAmount"`
	CrossWalletBalance     string `json:"crossWalletBalance"`
	CrossUnPnl             string `json:"crossUnPnl"`
	AvailableBalance       string `json:"availableBalance"`
	UpdateTime             int64  `json:"updateTime"`
}
