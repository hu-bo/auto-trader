package types

// APIMarket controls the target OKX market base URL.
type APIMarket string

const (
	APIMarketGLOBAL APIMarket = "GLOBAL"
)

// APICredentials holds OKX API credentials.
type APICredentials struct {
	APIKey    string
	APISecret string
	APIPass   string
}
