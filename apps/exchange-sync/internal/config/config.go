package config

import (
	"strings"
	"time"

	"exchange-sync/pkg/logger"

	"github.com/spf13/viper"
)

// Config 应用配置
type Config struct {
	Server   ServerConfig   `mapstructure:"server"`
	Database DatabaseConfig `mapstructure:"database"`
	NATS     NATSConfig     `mapstructure:"nats"`
	Proxy    ProxyConfig    `mapstructure:"proxy"`
	Sync     SyncConfig     `mapstructure:"sync"`
	BigOrder BigOrderConfig `mapstructure:"big_order"`
	Log      LogConfig      `mapstructure:"log"`
}

// ProxyConfig 代理配置
type ProxyConfig struct {
	HTTP   string `mapstructure:"http"`   // HTTP 代理，用于 REST API (如 http://127.0.0.1:7890)
	Socks5 string `mapstructure:"socks5"` // SOCKS5 代理，用于 WebSocket (如 socks5://127.0.0.1:7890)
}

// LogConfig 日志配置，复用 logger.Config
type LogConfig = logger.Config

// ServerConfig HTTP 服务器配置
type ServerConfig struct {
	HTTPPort     int    `mapstructure:"http_port"`
	APIKey       string `mapstructure:"api_key"`        // API 认证密钥 (为空则不启用认证)
	RateLimitRPS int    `mapstructure:"rate_limit_rps"` // 每秒请求限制
}

// NATSConfig NATS 配置
type NATSConfig struct {
	URL             string `mapstructure:"url"`               // NATS 服务器地址
	Enabled         bool   `mapstructure:"enabled"`           // 是否启用
	Username        string `mapstructure:"username"`          // NATS 用户名 (可选)
	Password        string `mapstructure:"password"`          // NATS 密码 (可选)
	SubjectPrefix   string `mapstructure:"subject_prefix"`    // 主题前缀
	BatchWindowMs   int    `mapstructure:"batch_window_ms"`   // 批量窗口(ms)
	EnableCompress  bool   `mapstructure:"enable_compress"`   // 是否启用压缩
	ReconnectWaitMs int    `mapstructure:"reconnect_wait_ms"` // 重连等待时间(ms)
	MaxReconnects   int    `mapstructure:"max_reconnects"`    // 最大重连次数 (-1 无限)
}

// IsEnabled 检查 NATS 是否已配置
func (n *NATSConfig) IsEnabled() bool {
	return n.Enabled && n.URL != ""
}

// DatabaseConfig 数据库配置
type DatabaseConfig struct {
	Host            string `mapstructure:"host"`
	Port            int    `mapstructure:"port"`
	User            string `mapstructure:"user"`
	Password        string `mapstructure:"password"`
	Database        string `mapstructure:"database"`
	SSLMode         string `mapstructure:"ssl_mode"`
	MaxConns        int    `mapstructure:"max_conns"`
	MinConns        int    `mapstructure:"min_conns"`
	BatchSize       int    `mapstructure:"batch_size"`
	BatchIntervalMs int    `mapstructure:"batch_interval_ms"`
}

// SyncConfig 同步配置
type SyncConfig struct {
	// 历史数据开始搜索年份
	HistoryStartYear int `mapstructure:"history_start_year"`
	// 每次 REST API 查询的 limit
	QueryLimit int `mapstructure:"query_limit"`
	// 批量订阅大小
	SubscribeBatchSize int `mapstructure:"subscribe_batch_size"`

	// WebSocket 重连间隔(秒)
	ReconnectIntervalSec int `mapstructure:"reconnect_interval_sec"`
	// 心跳间隔(秒)
	HeartbeatIntervalSec int `mapstructure:"heartbeat_interval_sec"`
	// 每日同步 symbols 的 cron 表达式 (默认: "0 0 * * *" 每天凌晨0点)
	SymbolsSyncCron string `mapstructure:"symbols_sync_cron"`
	// 是否启用每日 symbols 同步
	SymbolsSyncEnabled bool `mapstructure:"symbols_sync_enabled"`
	// 同步任务并发数
	SyncConcurrency int `mapstructure:"sync_concurrency"`
}

// BigOrderConfig 大单配置
type BigOrderConfig struct {
	// 大单阈值 (USD)
	ThresholdUSD float64 `mapstructure:"threshold_usd"`
	// 订单簿过期时间 (小时)
	ExpireHours int `mapstructure:"expire_hours"`
}

// BatchInterval 返回批量写入间隔
func (d *DatabaseConfig) BatchInterval() time.Duration {
	if d.BatchIntervalMs <= 0 {
		return time.Second
	}
	return time.Duration(d.BatchIntervalMs) * time.Millisecond
}

// IsEnabled 检查数据库是否已配置
func (d *DatabaseConfig) IsEnabled() bool {
	return d.Host != ""
}

// Load 加载配置
func Load(configPaths ...string) (*Config, error) {
	v := viper.New()

	// 设置默认值
	setDefaults(v)

	// 配置文件名
	v.SetConfigName("config")
	v.SetConfigType("yaml")

	// 添加配置文件搜索路径
	v.AddConfigPath(".")
	for _, path := range configPaths {
		v.AddConfigPath(path)
	}

	// 支持环境变量覆盖
	v.SetEnvPrefix("EXCHANGE_SYNC")
	v.SetEnvKeyReplacer(strings.NewReplacer(".", "_"))
	v.AutomaticEnv()

	// 读取配置文件
	if err := v.ReadInConfig(); err != nil {
		if _, ok := err.(viper.ConfigFileNotFoundError); !ok {
			return nil, err
		}
		// 配置文件不存在时使用默认值
	}

	// 尝试合并本地配置
	v.SetConfigName("config.local")
	_ = v.MergeInConfig()

	var cfg Config
	if err := v.Unmarshal(&cfg); err != nil {
		return nil, err
	}

	return &cfg, nil
}

func setDefaults(v *viper.Viper) {
	// Server
	v.SetDefault("server.http_port", 9003)
	v.SetDefault("server.api_key", "")
	v.SetDefault("server.rate_limit_rps", 100)

	// NATS
	v.SetDefault("nats.url", "nats://localhost:4222")
	v.SetDefault("nats.enabled", false)
	v.SetDefault("nats.subject_prefix", "exchange")
	v.SetDefault("nats.batch_window_ms", 100)
	v.SetDefault("nats.enable_compress", true)
	v.SetDefault("nats.reconnect_wait_ms", 2000)
	v.SetDefault("nats.max_reconnects", -1)

	// Database
	v.SetDefault("database.port", 5432)
	v.SetDefault("database.ssl_mode", "disable")
	v.SetDefault("database.max_conns", 20)
	v.SetDefault("database.min_conns", 5)
	v.SetDefault("database.batch_size", 100)
	v.SetDefault("database.batch_interval_ms", 1000)

	// Sync
	v.SetDefault("sync.history_start_year", 2016)
	v.SetDefault("sync.query_limit", 100)
	v.SetDefault("sync.subscribe_batch_size", 10)
	v.SetDefault("sync.reconnect_interval_sec", 5)
	v.SetDefault("sync.heartbeat_interval_sec", 30)
	v.SetDefault("sync.symbols_sync_cron", "0 0 * * *") // 每天凌晨0点
	v.SetDefault("sync.symbols_sync_enabled", true)
	v.SetDefault("sync.sync_concurrency", 5) // 同步任务并发数

	// BigOrder
	v.SetDefault("big_order.threshold_usd", 5000)
	v.SetDefault("big_order.expire_hours", 48)

	// Log
	v.SetDefault("log.level", "info")
	v.SetDefault("log.format", "console")
	v.SetDefault("log.output", "both")
	v.SetDefault("log.dir", "logs")
	v.SetDefault("log.filename", "exchange-sync")
	v.SetDefault("log.filename_template", "")
	v.SetDefault("log.max_size", 100)
	v.SetDefault("log.max_age", 30)
	v.SetDefault("log.max_backups", 10)
	v.SetDefault("log.compress", true)
}
