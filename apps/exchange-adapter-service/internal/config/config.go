package config

import (
	"strings"
	"time"

	"github.com/spf13/viper"
)

type Config struct {
	Server   ServerConfig   `mapstructure:"server"`
	Session  SessionConfig  `mapstructure:"session"`
	Market   MarketConfig   `mapstructure:"market"`
	Database DatabaseConfig `mapstructure:"database"`
	NATS     NATSConfig     `mapstructure:"nats"`
	Log      LogConfig      `mapstructure:"log"`
	Proxy    ProxyConfig    `mapstructure:"proxy"`
	Security SecurityConfig `mapstructure:"security"`
}

type ServerConfig struct {
	GRPCPort     int    `mapstructure:"grpc_port"`
	HTTPPort     int    `mapstructure:"http_port"`
	APIKey       string `mapstructure:"api_key"`        // HTTP API auth key (optional)
	RateLimitRPS int    `mapstructure:"rate_limit_rps"` // HTTP API rate limit (0 = disabled)
}

type SessionConfig struct {
	TokenTTLHours          int `mapstructure:"token_ttl_hours"`
	CleanupIntervalMinutes int `mapstructure:"cleanup_interval_minutes"`
}

func (s SessionConfig) TokenTTL() time.Duration {
	if s.TokenTTLHours <= 0 {
		return 24 * time.Hour
	}
	return time.Duration(s.TokenTTLHours) * time.Hour
}

func (s SessionConfig) CleanupInterval() time.Duration {
	if s.CleanupIntervalMinutes <= 0 {
		return 60 * time.Minute
	}
	return time.Duration(s.CleanupIntervalMinutes) * time.Minute
}

// MarketConfig controls embedded market-data sync (ported from apps/exchange-sync).
type MarketConfig struct {
	Enabled bool `mapstructure:"enabled"`
}

type NATSConfig struct {
	Enabled       bool   `mapstructure:"enabled"`
	URL           string `mapstructure:"url"`
	Username      string `mapstructure:"username"`
	Password      string `mapstructure:"password"`
	SubjectPrefix string `mapstructure:"subject_prefix"`
}

func (n NATSConfig) IsEnabled() bool {
	return n.Enabled && n.URL != ""
}

type DatabaseConfig struct {
	Host     string `mapstructure:"host"`
	Port     int    `mapstructure:"port"`
	User     string `mapstructure:"user"`
	Password string `mapstructure:"password"`
	Database string `mapstructure:"database"`
	SSLMode  string `mapstructure:"ssl_mode"`
}

func (d DatabaseConfig) IsEnabled() bool {
	return d.Host != ""
}

type ProxyConfig struct {
	HTTP   string `mapstructure:"http"`
	Socks5 string `mapstructure:"socks5"`
}

type LogConfig struct {
	Level  string `mapstructure:"level"`
	Format string `mapstructure:"format"` // json|console
	Output string `mapstructure:"output"` // stdout|file
	File   string `mapstructure:"file"`   // base file path when output=file (daily rotation is handled in code)
}

type SecurityConfig struct {
	TLSEnabled bool   `mapstructure:"tls_enabled"`
	CertFile   string `mapstructure:"cert_file"`
	KeyFile    string `mapstructure:"key_file"`
	CAFile     string `mapstructure:"ca_file"`
}

func Load(configPaths ...string) (*Config, error) {
	v := viper.New()
	setDefaults(v)

	v.SetConfigName("config")
	v.SetConfigType("yaml")
	v.AddConfigPath(".")
	for _, p := range configPaths {
		v.AddConfigPath(p)
	}

	v.SetEnvPrefix("EXCHANGE_ADAPTER")
	v.SetEnvKeyReplacer(strings.NewReplacer(".", "_"))
	v.AutomaticEnv()

	if err := v.ReadInConfig(); err != nil {
		if _, ok := err.(viper.ConfigFileNotFoundError); !ok {
			return nil, err
		}
	}

	v.SetConfigName("config.local")
	_ = v.MergeInConfig()

	var cfg Config
	if err := v.Unmarshal(&cfg); err != nil {
		return nil, err
	}
	return &cfg, nil
}

func setDefaults(v *viper.Viper) {
	v.SetDefault("server.grpc_port", 9001)
	v.SetDefault("server.http_port", 9002)
	v.SetDefault("server.api_key", "")
	v.SetDefault("server.rate_limit_rps", 100)

	v.SetDefault("session.token_ttl_hours", 24)
	v.SetDefault("session.cleanup_interval_minutes", 60)

	v.SetDefault("market.enabled", false)

	v.SetDefault("nats.enabled", false)
	v.SetDefault("nats.url", "nats://localhost:4222")
	v.SetDefault("nats.subject_prefix", "exchange")

	v.SetDefault("database.port", 5432)
	v.SetDefault("database.ssl_mode", "disable")

	v.SetDefault("log.level", "info")
	v.SetDefault("log.format", "json")
	v.SetDefault("log.output", "stdout")
	v.SetDefault("log.file", "./logs/exchange-adapter-service.log")

	v.SetDefault("proxy.http", "")
	v.SetDefault("proxy.socks5", "")

	v.SetDefault("security.tls_enabled", false)
	v.SetDefault("security.cert_file", "")
	v.SetDefault("security.key_file", "")
	v.SetDefault("security.ca_file", "")
}
