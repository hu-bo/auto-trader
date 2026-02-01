package api

import (
	"context"
	"fmt"
	"net/http"

	"exchange-sync/internal/config"
	"exchange-sync/internal/service"
	"exchange-sync/internal/storage"
	"exchange-sync/pkg/logger"

	"github.com/labstack/echo/v4"
	"github.com/labstack/echo/v4/middleware"
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
func NewServer(cfg *config.Config, wsSyncService *service.WsSyncService, historySyncService *service.HistorySyncService, repo storage.Repository) (*Server, error) {
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

	// 创建验证服务
	var verifyService *service.VerifyService
	if repo != nil {
		verifyService = service.NewVerifyService(cfg, repo)
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
	// 启动 HTTP 服务器
	httpAddr := fmt.Sprintf(":%d", s.cfg.Server.HTTPPort)
	s.httpServer = &http.Server{
		Addr:    httpAddr,
		Handler: s.echo,
	}

	go func() {
		logServer.Info().Str("addr", httpAddr).Msg("HTTP server starting")
		if err := s.httpServer.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			logServer.Error().Err(err).Msg("HTTP server error")
		}
	}()

	return nil
}

// Stop 停止服务器
func (s *Server) Stop(ctx context.Context) error {
	// 关闭 HTTP 服务器
	if s.httpServer != nil {
		if err := s.httpServer.Shutdown(ctx); err != nil {
			logServer.Error().Err(err).Msg("HTTP server shutdown error")
		}
	}

	return nil
}
