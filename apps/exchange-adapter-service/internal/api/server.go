package api

import (
	"context"
	"fmt"
	"net/http"

	"exchange-adapter-service/internal/config"
	"exchange-adapter-service/internal/service"
	"exchange-adapter-service/internal/storage"

	"github.com/labstack/echo/v4"
	"github.com/labstack/echo/v4/middleware"
	"github.com/pkg/logger"
	"golang.org/x/time/rate"
)

var logServer = logger.Module("server")

// Server API 服务器
type Server struct {
	cfg        *config.Config
	echo       *echo.Echo
	handler    *Handler
	httpServer *http.Server
}

// NewServer 创建 API 服务器
func NewServer(cfg *config.Config, wsSyncService *service.WsSyncService, historySyncService *service.HistorySyncService, verifyService *service.VerifyService, repo storage.Repository) (*Server, error) {
	e := echo.New()
	e.HideBanner = true
	e.HidePort = true

	// 基础中间件
	e.Use(middleware.Logger())
	e.Use(middleware.Recover())
	e.Use(middleware.CORS())

	// Rate Limiting 中间件
	if cfg.Server.RateLimitRPS > 0 {
		e.Use(middleware.RateLimiter(middleware.NewRateLimiterMemoryStore(
			rate.Limit(cfg.Server.RateLimitRPS),
		)))
		logServer.Info().Int("rps", cfg.Server.RateLimitRPS).Msg("Rate limiting enabled")
	}

	// Create verify service on demand. This keeps API usable even if the caller
	// does not wire a verifier (e.g. repo=nil disables verify endpoint anyway).
	if verifyService == nil && repo != nil {
		var err error
		verifyService, err = service.NewVerifyService(cfg, repo)
		if err != nil {
			return nil, fmt.Errorf("init verify service: %w", err)
		}
	}

	// 创建处理器
	handler := NewHandler(wsSyncService, historySyncService, verifyService, repo)

	server := &Server{
		cfg:     cfg,
		echo:    e,
		handler: handler,
	}

	server.setupRoutes()

	return server, nil
}

// apiKeyAuthMiddleware API Key 认证中间件
func apiKeyAuthMiddleware(apiKey string) echo.MiddlewareFunc {
	return func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(c echo.Context) error {
			// 从 Header 获取 API Key
			key := c.Request().Header.Get("X-API-Key")
			if key == "" {
				// 也支持 Authorization: Bearer <key> 格式
				auth := c.Request().Header.Get("Authorization")
				if len(auth) > 7 && auth[:7] == "Bearer " {
					key = auth[7:]
				}
			}

			if key != apiKey {
				return c.JSON(http.StatusUnauthorized, map[string]interface{}{
					"code":    "UNAUTHORIZED",
					"message": "Invalid or missing API key",
				})
			}
			return next(c)
		}
	}
}

func (s *Server) setupRoutes() {
	// 健康检查 (无需认证)
	s.echo.GET("/health", s.handler.HealthCheck)
	s.echo.GET("/ready", s.handler.Ready)
	s.echo.GET("/version", s.handler.Version)

	// If market module is not wired, only expose health endpoint.
	if s.handler == nil || s.handler.wsSyncService == nil {
		logServer.Warn().Msg("market ws sync not configured; /api routes disabled")
		return
	}

	// API 路由组
	api := s.echo.Group("/api")

	// 如果配置了 API Key，则启用认证
	if s.cfg.Server.APIKey != "" {
		api.Use(apiKeyAuthMiddleware(s.cfg.Server.APIKey))
		logServer.Info().Msg("API key authentication enabled")
	}

	// 订单簿相关
	api.GET("/orderbook", s.handler.GetOrderBook)
	api.GET("/trace-price", s.handler.GetTracePrice)

	// K线相关
	api.GET("/candles", s.handler.GetCandles)
	api.GET("/candle/current", s.handler.GetCurrentCandle)
	api.GET("/candle/fill-miss", s.handler.FillMissingData)
	api.GET("/candle/verify", s.handler.VerifyCandles)

	// 订阅管理
	api.POST("/subscribe", s.handler.Subscribe)
	api.POST("/unsubscribe", s.handler.Unsubscribe)

	// 交易对管理
	api.GET("/symbols", s.handler.GetSymbols)
	api.PUT("/symbols", s.handler.UpdateSymbol)
	api.DELETE("/symbols", s.handler.DeleteSymbol)
	api.DELETE("/symbols/batch", s.handler.DeleteSymbolsBatch)

	// 同步任务管理
	api.GET("/sync/tasks", s.handler.GetSyncTasks)
}

// Start 启动服务器
func (s *Server) Start() error {
	// 启动 HTTP 服务器 (blocking; run it in a goroutine if needed)
	httpAddr := fmt.Sprintf(":%d", s.cfg.Server.HTTPPort)
	s.httpServer = &http.Server{
		Addr:    httpAddr,
		Handler: s.echo,
	}

	logServer.Info().Str("addr", httpAddr).Msg("HTTP server started")
	err := s.httpServer.ListenAndServe()
	if err != nil && err != http.ErrServerClosed {
		return err
	}
	return nil
}

// Stop 停止服务器
func (s *Server) Stop(ctx context.Context) error {
	// 关闭 HTTP 服务器
	if s.httpServer != nil {
		return s.httpServer.Shutdown(ctx)
	}

	return nil
}
