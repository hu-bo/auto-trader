package exampleutil

import (
	"bufio"
	"fmt"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"github.com/pkg/exchange-adapter/core"
)

type Env struct {
	BinanceAPIKey    string
	BinanceAPISecret string
	OKXAPIKey        string
	OKXAPISecret     string
	OKXPassphrase    string

	Simulated bool
	Demonet   bool
	Timeout   time.Duration

	HTTPSProxy string
	SOCKSProxy string
}

func LoadDotEnvFiles(filenames ...string) error {
	for _, name := range filenames {
		path := filepath.Clean(name)
		if _, err := os.Stat(path); err != nil {
			continue
		}
		if err := loadDotEnvFile(path); err != nil {
			return err
		}
	}
	return nil
}

func loadDotEnvFile(path string) error {
	f, err := os.Open(path)
	if err != nil {
		return err
	}
	defer f.Close()

	scanner := bufio.NewScanner(f)
	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}
		if strings.HasPrefix(line, "export ") {
			line = strings.TrimSpace(strings.TrimPrefix(line, "export "))
		}
		key, val, ok := strings.Cut(line, "=")
		if !ok {
			continue
		}
		key = strings.TrimSpace(key)
		val = strings.TrimSpace(val)
		val = strings.Trim(val, `"'`)
		if key == "" {
			continue
		}
		_ = os.Setenv(key, val)
	}
	return scanner.Err()
}

func LoadEnv() Env {
	timeout := 15 * time.Second
	if v, ok := parseNumber(os.Getenv("TIMEOUT")); ok && v > 0 {
		timeout = time.Duration(v) * time.Millisecond
	}

	simulated := true
	if v, ok := parseBool(os.Getenv("SIMULATED")); ok {
		simulated = v
	}

	demonet := true
	if v, ok := parseBool(os.Getenv("DEMONET")); ok {
		demonet = v
	}

	return Env{
		BinanceAPIKey:    os.Getenv("BINANCE_API_KEY"),
		BinanceAPISecret: os.Getenv("BINANCE_API_SECRET"),
		OKXAPIKey:        os.Getenv("OKX_API_KEY"),
		OKXAPISecret:     os.Getenv("OKX_API_SECRET"),
		OKXPassphrase:    os.Getenv("OKX_PASSPHRASE"),

		Simulated: simulated,
		Demonet:   demonet,
		Timeout:   timeout,

		HTTPSProxy: os.Getenv("PROXY"),
		SOCKSProxy: os.Getenv("SOCKS_PROXY"),
	}
}

func AdapterOptionsFromEnv(env Env) *core.AdapterOptions {
	demonet := env.Demonet
	return &core.AdapterOptions{
		HTTPSProxy: env.HTTPSProxy,
		SOCKSProxy: env.SOCKSProxy,
		Demonet:    &demonet,
	}
}

func parseBool(value string) (bool, bool) {
	if value == "" {
		return false, false
	}
	switch strings.ToLower(strings.TrimSpace(value)) {
	case "true", "1", "yes", "on":
		return true, true
	case "false", "0", "no", "off":
		return false, true
	default:
		return false, false
	}
}

func parseNumber(value string) (int64, bool) {
	if value == "" {
		return 0, false
	}
	n, err := strconv.ParseInt(strings.TrimSpace(value), 10, 64)
	if err != nil {
		return 0, false
	}
	return n, true
}

func RequireCredsForExchanges(env Env, exchanges []core.Exchange) error {
	for _, exchange := range exchanges {
		switch exchange {
		case core.ExchangeBinance:
			if env.BinanceAPIKey == "" || env.BinanceAPISecret == "" {
				return fmt.Errorf("missing Binance credentials (BINANCE_API_KEY / BINANCE_API_SECRET)")
			}
		case core.ExchangeOKX:
			if env.OKXAPIKey == "" || env.OKXAPISecret == "" || env.OKXPassphrase == "" {
				return fmt.Errorf("missing OKX credentials (OKX_API_KEY / OKX_API_SECRET / OKX_PASSPHRASE)")
			}
		}
	}
	return nil
}
