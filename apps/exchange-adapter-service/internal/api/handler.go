package api

import (
	"net/http"
	"sort"
	"strconv"
	"time"

	"exchange-adapter-service/internal/service"
	"exchange-adapter-service/internal/storage"
	"exchange-adapter-service/internal/utils"

	"github.com/labstack/echo/v4"
	"github.com/pkg/exchange-adapter/aggregator"
	exchange "github.com/pkg/exchange-adapter/marketdata"
	"github.com/pkg/logger"
)

var logAPI = logger.Module("api")

// ErrorItem 表单验证错误项
type ErrorItem struct {
	Field   string `json:"field"`
	Message string `json:"message"`
}

// SuccessResponse 成功响应
type SuccessResponse[T any] struct {
	Code    int    `json:"code"`
	Status  string `json:"status"`
	Message string `json:"message"`
	Data    T      `json:"data,omitempty"`
}

// ErrorResponse 错误响应
type ErrorResponse struct {
	Code    int         `json:"code"`
	Status  string      `json:"status"`
	Message string      `json:"message"`
	Errors  []ErrorItem `json:"errors,omitempty"`
}

// Success 返回成功响应
func Success[T any](c echo.Context, data T) error {
	return c.JSON(http.StatusOK, SuccessResponse[T]{
		Code:    0,
		Status:  "ok",
		Message: "success",
		Data:    data,
	})
}

// SuccessWithMessage 返回带自定义消息的成功响应
func SuccessWithMessage[T any](c echo.Context, message string, data T) error {
	return c.JSON(http.StatusOK, SuccessResponse[T]{
		Code:    0,
		Status:  "ok",
		Message: message,
		Data:    data,
	})
}

// Error 返回错误响应
func Error(c echo.Context, httpStatus int, code int, message string) error {
	return c.JSON(httpStatus, ErrorResponse{
		Code:    code,
		Status:  "error",
		Message: message,
	})
}

// ErrorWithDetails 返回带详细错误列表的错误响应
func ErrorWithDetails(c echo.Context, httpStatus int, code int, message string, errors []ErrorItem) error {
	return c.JSON(httpStatus, ErrorResponse{
		Code:    code,
		Status:  "error",
		Message: message,
		Errors:  errors,
	})
}

// 预定义错误码
const (
	ErrCodeBadRequest         = 400
	ErrCodeNotFound           = 404
	ErrCodeInternal           = 500
	ErrCodeServiceUnavailable = 503
)

// Handler API 处理器
type Handler struct {
	wsSyncService      *service.WsSyncService
	historySyncService *service.HistorySyncService
	verifyService      *service.VerifyService
	tickerSyncService  *service.TickerSyncService
	repo               storage.Repository
}

// NewHandler 创建 API 处理器
func NewHandler(wsSyncService *service.WsSyncService, historySyncService *service.HistorySyncService, verifyService *service.VerifyService, tickerSyncService *service.TickerSyncService, repo storage.Repository) *Handler {
	return &Handler{
		wsSyncService:      wsSyncService,
		historySyncService: historySyncService,
		verifyService:      verifyService,
		tickerSyncService:  tickerSyncService,
		repo:               repo,
	}
}

// HealthCheckData 健康检查响应数据
type HealthCheckData struct {
	Time string `json:"time"`
}

// HealthCheck 健康检查
func (h *Handler) HealthCheck(c echo.Context) error {
	return Success(c, HealthCheckData{
		Time: time.Now().Format(time.RFC3339),
	})
}

// GetOrderBook 获取订单簿
// GET /api/orderbook?exchange=binance&symbol=BTC-USDT&trade_type=spot&range=0.1
func (h *Handler) GetOrderBook(c echo.Context) error {
	exchangeStr := c.QueryParam("exchange")
	symbol := c.QueryParam("symbol")
	tradeTypeStr := c.QueryParam("trade_type")
	rangeStr := c.QueryParam("range")

	if exchangeStr == "" || symbol == "" {
		return Error(c, http.StatusBadRequest, ErrCodeBadRequest, "exchange and symbol are required")
	}

	if tradeTypeStr == "" {
		tradeTypeStr = "spot"
	}

	priceRange := 0.1 // 默认 10%
	if rangeStr != "" {
		if r, err := strconv.ParseFloat(rangeStr, 64); err == nil {
			priceRange = r
		}
	}

	exchangeName := exchange.ExchangeName(exchangeStr)
	tradeType := exchange.TradeType(tradeTypeStr)
	orderBook := h.wsSyncService.GetFilteredOrderBook(exchangeName, tradeType, symbol, priceRange)

	if orderBook == nil {
		return Error(c, http.StatusNotFound, ErrCodeNotFound, "orderbook not found")
	}

	return Success(c, orderBook)
}

// GetTracePrice 获取追踪价格
// GET /api/trace-price?exchange=binance&symbol=BTC-USDT&trade_type=spot&distance=0.1
func (h *Handler) GetTracePrice(c echo.Context) error {
	exchangeStr := c.QueryParam("exchange")
	symbol := c.QueryParam("symbol")
	tradeTypeStr := c.QueryParam("trade_type")
	distanceStr := c.QueryParam("distance")

	if exchangeStr == "" || symbol == "" {
		return Error(c, http.StatusBadRequest, ErrCodeBadRequest, "exchange and symbol are required")
	}

	if tradeTypeStr == "" {
		tradeTypeStr = "spot"
	}

	distance := 0.1 // 默认 10%
	if distanceStr != "" {
		if d, err := strconv.ParseFloat(distanceStr, 64); err == nil {
			distance = d
		}
	}

	exchangeName := exchange.ExchangeName(exchangeStr)
	tradeType := exchange.TradeType(tradeTypeStr)
	result := h.wsSyncService.GetTracePrice(exchangeName, tradeType, symbol, distance)

	if result == nil {
		return Error(c, http.StatusNotFound, ErrCodeNotFound, "trace price not found")
	}

	return Success(c, result)
}

// GetCandles 获取历史K线
// GET /api/candles?exchange=binance&symbol=BTC-USDT&period=15m&limit=100&start_time=xxx&end_time=xxx
func (h *Handler) GetCandles(c echo.Context) error {
	exchangeStr := c.QueryParam("exchange")
	symbol := c.QueryParam("symbol")
	period := c.QueryParam("period")
	limitStr := c.QueryParam("limit")
	startTimeStr := c.QueryParam("start_time")
	endTimeStr := c.QueryParam("end_time")

	if exchangeStr == "" || symbol == "" {
		return Error(c, http.StatusBadRequest, ErrCodeBadRequest, "exchange and symbol are required")
	}

	if period == "" {
		period = "15m"
	}

	limit := 100
	if limitStr != "" {
		if l, err := strconv.Atoi(limitStr); err == nil {
			limit = l
		}
	}

	// 默认查询最近24小时
	startTime, endTime := utils.Period1d.Interval(1)

	if startTimeStr != "" {
		if t, err := strconv.ParseInt(startTimeStr, 10, 64); err == nil {
			startTime = t
		}
	}
	if endTimeStr != "" {
		if t, err := strconv.ParseInt(endTimeStr, 10, 64); err == nil {
			endTime = t
		}
	}

	if h.repo == nil {
		return Error(c, http.StatusServiceUnavailable, ErrCodeServiceUnavailable, "database not configured")
	}

	var (
		candles []exchange.NormalizedCandle
		err     error
	)

	requestedPeriod := exchange.Period(period)
	if requestedPeriod == exchange.Period4h {
		sourcePeriod := exchange.Period15m
		ratio := int(requestedPeriod.IntervalMs() / sourcePeriod.IntervalMs())
		sourceLimit := 0
		if limit > 0 {
			sourceLimit = limit*ratio + ratio
		}
		sourceStart := requestedPeriod.RoundToInterval(startTime)
		sourceEnd := requestedPeriod.NextInterval(endTime) - sourcePeriod.IntervalMs()

		if sourceEnd < sourceStart {
			sourceEnd = endTime
		}

		sourceCandles, fetchErr := h.repo.GetCandles(c.Request().Context(), exchangeStr, symbol, string(sourcePeriod), sourceStart, sourceEnd, sourceLimit)
		if fetchErr != nil {
			return Error(c, http.StatusInternalServerError, ErrCodeInternal, fetchErr.Error())
		}

		aggregated, aggErr := aggregator.AggregateCandlesByPeriod(sourceCandles, sourcePeriod, requestedPeriod)
		if aggErr != nil {
			return Error(c, http.StatusInternalServerError, ErrCodeInternal, aggErr.Error())
		}

		candles = filterCandlesByRangeAndLimit(aggregated, startTime, endTime, limit)
	} else {
		candles, err = h.repo.GetCandles(c.Request().Context(), exchangeStr, symbol, period, startTime, endTime, limit)
		if err != nil {
			return Error(c, http.StatusInternalServerError, ErrCodeInternal, err.Error())
		}
	}

	// 列式存储格式 (Column-Oriented)
	if c.QueryParam("column") == "true" {
		return Success(c, utils.CandlesToColumnFormat(candles))
	}

	// 紧凑格式 (Row-Oriented)
	if c.QueryParam("compact") == "true" {
		return Success(c, utils.CompactCandles(candles))
	}

	return Success(c, candles)
}

func filterCandlesByRangeAndLimit(candles []exchange.NormalizedCandle, startTime, endTime int64, limit int) []exchange.NormalizedCandle {
	filtered := make([]exchange.NormalizedCandle, 0, len(candles))
	for _, candle := range candles {
		if candle.Timestamp >= startTime && candle.Timestamp <= endTime {
			filtered = append(filtered, candle)
		}
	}

	sort.Slice(filtered, func(i, j int) bool {
		return filtered[i].Timestamp > filtered[j].Timestamp
	})

	if limit > 0 && len(filtered) > limit {
		filtered = filtered[:limit]
	}

	return filtered
}

// GetCurrentCandle 获取当前K线
// GET /api/candle/current?exchange=binance&symbol=BTC-USDT&trade_type=spot&period=15m
func (h *Handler) GetCurrentCandle(c echo.Context) error {
	exchangeStr := c.QueryParam("exchange")
	symbol := c.QueryParam("symbol")
	tradeTypeStr := c.QueryParam("trade_type")
	period := c.QueryParam("period")

	if exchangeStr == "" || symbol == "" {
		return Error(c, http.StatusBadRequest, ErrCodeBadRequest, "exchange and symbol are required")
	}

	if tradeTypeStr == "" {
		tradeTypeStr = "spot"
	}
	if period == "" {
		period = "15m"
	}

	exchangeName := exchange.ExchangeName(exchangeStr)
	tradeType := exchange.TradeType(tradeTypeStr)
	candle := h.wsSyncService.GetCurrentCandle(exchangeName, tradeType, symbol, exchange.Period(period))

	if candle == nil {
		return Error(c, http.StatusNotFound, ErrCodeNotFound, "candle not found")
	}

	return Success(c, candle)
}

// FillMissingData 填充缺失数据
// GET /api/candle/fill-miss?exchange=binance&symbol=BTC-USDT&period=15m&start_time=xxx&end_time=xxx
func (h *Handler) FillMissingData(c echo.Context) error {
	exchangeStr := c.QueryParam("exchange")
	symbol := c.QueryParam("symbol")
	tradeType := c.QueryParam("trade_type")
	startTimeStr := c.QueryParam("start_time")
	endTimeStr := c.QueryParam("end_time")

	if exchangeStr == "" || symbol == "" {
		return Error(c, http.StatusBadRequest, ErrCodeBadRequest, "exchange and symbol are required")
	}

	if tradeType == "" {
		tradeType = "spot"
	}

	// 默认填充最近2天
	startTime, endTime := utils.Period1d.Interval(2)

	if startTimeStr != "" {
		if t, err := strconv.ParseInt(startTimeStr, 10, 64); err == nil {
			startTime = t
		}
	}
	if endTimeStr != "" {
		if t, err := strconv.ParseInt(endTimeStr, 10, 64); err == nil {
			endTime = t
		}
	}

	if h.historySyncService == nil {
		return Error(c, http.StatusServiceUnavailable, ErrCodeServiceUnavailable, "history sync service not available")
	}

	exchangeName := exchange.ExchangeName(exchangeStr)
	err := h.historySyncService.FillMissingData(c.Request().Context(), exchangeName, symbol, tradeType, startTime, endTime)
	if err != nil {
		return Error(c, http.StatusInternalServerError, ErrCodeInternal, err.Error())
	}

	return SuccessWithMessage[any](c, "fill missing data completed", nil)
}

// SubscribeRequest 订阅请求体
type SubscribeRequest struct {
	Exchange string                      `json:"exchange"`
	Symbols  []exchange.SubscribeRequest `json:"symbols"`
}

// Subscribe 动态订阅
// POST /api/subscribe
func (h *Handler) Subscribe(c echo.Context) error {
	var req SubscribeRequest
	if err := c.Bind(&req); err != nil {
		return Error(c, http.StatusBadRequest, ErrCodeBadRequest, "invalid request body")
	}

	if req.Exchange == "" || len(req.Symbols) == 0 {
		return Error(c, http.StatusBadRequest, ErrCodeBadRequest, "exchange and symbols are required")
	}

	exchangeName := exchange.ExchangeName(req.Exchange)
	if err := h.wsSyncService.Subscribe(exchangeName, req.Symbols); err != nil {
		return Error(c, http.StatusInternalServerError, ErrCodeInternal, err.Error())
	}

	return SuccessWithMessage[any](c, "subscribed", nil)
}

// UnsubscribeRequest 取消订阅请求体
type UnsubscribeRequest struct {
	Exchange string   `json:"exchange"`
	Symbols  []string `json:"symbols"`
}

// Unsubscribe 取消订阅
// POST /api/unsubscribe
func (h *Handler) Unsubscribe(c echo.Context) error {
	var req UnsubscribeRequest
	if err := c.Bind(&req); err != nil {
		return Error(c, http.StatusBadRequest, ErrCodeBadRequest, "invalid request body")
	}

	if req.Exchange == "" || len(req.Symbols) == 0 {
		return Error(c, http.StatusBadRequest, ErrCodeBadRequest, "exchange and symbols are required")
	}

	exchangeName := exchange.ExchangeName(req.Exchange)
	if err := h.wsSyncService.Unsubscribe(exchangeName, req.Symbols); err != nil {
		return Error(c, http.StatusInternalServerError, ErrCodeInternal, err.Error())
	}

	return SuccessWithMessage[any](c, "unsubscribed", nil)
}

// DeleteSymbolRequest 删除交易对请求体
type DeleteSymbolRequest struct {
	Exchange  string `json:"exchange"`
	Symbol    string `json:"symbol"`
	TradeType string `json:"trade_type"`
}

// DeleteSymbolData 删除交易对响应数据
type DeleteSymbolData struct {
	Symbol string `json:"symbol"`
}

// DeleteSymbol 删除交易对 (同时取消WS订阅)
// DELETE /api/symbols
func (h *Handler) DeleteSymbol(c echo.Context) error {
	var req DeleteSymbolRequest
	if err := c.Bind(&req); err != nil {
		return Error(c, http.StatusBadRequest, ErrCodeBadRequest, "invalid request body")
	}

	if req.Exchange == "" || req.Symbol == "" {
		return Error(c, http.StatusBadRequest, ErrCodeBadRequest, "exchange and symbol are required")
	}

	if req.TradeType == "" {
		req.TradeType = "spot"
	}

	if h.repo == nil {
		return Error(c, http.StatusServiceUnavailable, ErrCodeServiceUnavailable, "database not configured")
	}

	// 1. 先取消WS订阅
	exchangeName := exchange.ExchangeName(req.Exchange)
	if err := h.wsSyncService.Unsubscribe(exchangeName, []string{req.Symbol}); err != nil {
		// 记录错误但继续删除
		c.Logger().Warnf("Failed to unsubscribe %s: %v", req.Symbol, err)
	}

	// 2. 从数据库删除
	if err := h.repo.DeleteSymbolInfo(c.Request().Context(), req.Exchange, req.Symbol, req.TradeType); err != nil {
		return Error(c, http.StatusInternalServerError, ErrCodeInternal, err.Error())
	}

	return SuccessWithMessage(c, "symbol deleted and unsubscribed from WS", DeleteSymbolData{
		Symbol: req.Symbol,
	})
}

// DeleteSymbolsBatchRequest 批量删除交易对请求体
type DeleteSymbolsBatchRequest struct {
	Exchange  string   `json:"exchange"`
	Symbols   []string `json:"symbols"`
	TradeType string   `json:"trade_type"`
}

// DeleteSymbolsBatchData 批量删除交易对响应数据
type DeleteSymbolsBatchData struct {
	DeletedCount int `json:"deleted_count"`
	Total        int `json:"total"`
}

// DeleteSymbolsBatch 批量删除交易对 (同时取消WS订阅)
// DELETE /api/symbols/batch
func (h *Handler) DeleteSymbolsBatch(c echo.Context) error {
	var req DeleteSymbolsBatchRequest
	if err := c.Bind(&req); err != nil {
		return Error(c, http.StatusBadRequest, ErrCodeBadRequest, "invalid request body")
	}

	if req.Exchange == "" || len(req.Symbols) == 0 {
		return Error(c, http.StatusBadRequest, ErrCodeBadRequest, "exchange and symbols are required")
	}

	if req.TradeType == "" {
		req.TradeType = "spot"
	}

	if h.repo == nil {
		return Error(c, http.StatusServiceUnavailable, ErrCodeServiceUnavailable, "database not configured")
	}

	// 1. 先取消WS订阅
	exchangeName := exchange.ExchangeName(req.Exchange)
	if err := h.wsSyncService.Unsubscribe(exchangeName, req.Symbols); err != nil {
		c.Logger().Warnf("Failed to unsubscribe symbols: %v", err)
	}

	// 2. 从数据库删除
	deletedCount := 0
	for _, symbol := range req.Symbols {
		if err := h.repo.DeleteSymbolInfo(c.Request().Context(), req.Exchange, symbol, req.TradeType); err != nil {
			c.Logger().Warnf("Failed to delete symbol %s: %v", symbol, err)
		} else {
			deletedCount++
		}
	}

	return SuccessWithMessage(c, "symbols deleted and unsubscribed from WS", DeleteSymbolsBatchData{
		DeletedCount: deletedCount,
		Total:        len(req.Symbols),
	})
}

// GetSymbolsData 获取交易对响应数据
type GetSymbolsData struct {
	Exchange string                `json:"exchange"`
	Count    int                   `json:"count"`
	Symbols  []exchange.SymbolInfo `json:"symbols"`
}

// GetSymbols 获取所有交易对
// GET /api/symbols?exchange=binance&trade_type=spot
func (h *Handler) GetSymbols(c echo.Context) error {
	exchangeStr := c.QueryParam("exchange")
	tradeType := c.QueryParam("trade_type")
	orderBy := c.QueryParam("orderBy")
	order := c.QueryParam("order")
	symbolFilter := c.QueryParam("symbol")

	if exchangeStr == "" {
		return Error(c, http.StatusBadRequest, ErrCodeBadRequest, "exchange is required")
	}

	if h.repo == nil {
		return Error(c, http.StatusServiceUnavailable, ErrCodeServiceUnavailable, "database not configured")
	}

	symbols, err := h.repo.GetSymbolInfos(c.Request().Context(), exchangeStr)
	if err != nil {
		return Error(c, http.StatusInternalServerError, ErrCodeInternal, err.Error())
	}
	// Debug log: 验证是否带上了 ticker join 数据
	withTicker := 0
	for _, s := range symbols {
		if s.LastPrice != nil || s.QuoteVolume24h != nil || s.TickerEventTimeMs != nil {
			withTicker++
		}
	}

	logAPI.Debug().
		Str("exchange", exchangeStr).
		Int("total", len(symbols)).
		Int("withTicker", withTicker).
		Str("orderBy", orderBy).
		Str("order", order).
		Msg("GetSymbolInfos join check")

	// 如果指定了 trade_type，进行过滤
	if tradeType != "" {
		filtered := make([]exchange.SymbolInfo, 0)
		for _, s := range symbols {
			if s.TradeType == tradeType {
				filtered = append(filtered, s)
			}
		}
		symbols = filtered
	}

	// 过滤指定的 symbol（精确匹配）
	if symbolFilter != "" {
		filtered := make([]exchange.SymbolInfo, 0)
		for _, s := range symbols {
			if s.Symbol == symbolFilter {
				filtered = append(filtered, s)
			}
		}
		symbols = filtered
	}

	// 排序: orderBy=amount|quoteVolume24h 或 orderBy=change24h
	sortSymbolsInPlace(symbols, orderBy, order)

	return Success(c, GetSymbolsData{
		Exchange: exchangeStr,
		Count:    len(symbols),
		Symbols:  symbols,
	})
}

// UpdateSymbolRequest 更新交易对请求体
type UpdateSymbolRequest struct {
	Exchange    string `json:"exchange"`
	Symbol      string `json:"symbol"`
	TradeType   string `json:"trade_type"`
	SyncEnabled *bool  `json:"sync_enabled"`
}

// UpdateSymbolData 更新交易对响应数据
type UpdateSymbolData struct {
	Symbol *exchange.SymbolInfo `json:"symbol"`
}

// UpdateSymbol 更新单个交易对
// PUT /api/symbols
func (h *Handler) UpdateSymbol(c echo.Context) error {
	var req UpdateSymbolRequest
	if err := c.Bind(&req); err != nil {
		return Error(c, http.StatusBadRequest, ErrCodeBadRequest, "invalid request body")
	}

	if req.Exchange == "" || req.Symbol == "" {
		return Error(c, http.StatusBadRequest, ErrCodeBadRequest, "exchange and symbol are required")
	}

	if req.TradeType == "" {
		req.TradeType = "spot"
	}

	if h.repo == nil {
		return Error(c, http.StatusServiceUnavailable, ErrCodeServiceUnavailable, "database not configured")
	}

	// 检查交易对是否存在
	info, err := h.repo.GetSymbolInfo(c.Request().Context(), req.Exchange, req.Symbol, req.TradeType)
	if err != nil {
		return Error(c, http.StatusInternalServerError, ErrCodeInternal, err.Error())
	}
	if info == nil {
		return Error(c, http.StatusNotFound, ErrCodeNotFound, "symbol not found")
	}

	// 更新 sync_enabled
	if req.SyncEnabled != nil {
		if err := h.repo.UpdateSymbolSyncEnabled(c.Request().Context(), req.Exchange, req.Symbol, req.TradeType, *req.SyncEnabled); err != nil {
			return Error(c, http.StatusInternalServerError, ErrCodeInternal, err.Error())
		}

		exchangeName := exchange.ExchangeName(req.Exchange)

		// 根据开关状态处理
		if *req.SyncEnabled {
			// 开启同步：添加同步任务 (任务完成后会自动触发 WS 订阅)
			if h.historySyncService != nil {
				if err := h.historySyncService.AddSyncTask(exchangeName, *info); err != nil {
					c.Logger().Warnf("Failed to add sync task for %s: %v", req.Symbol, err)
				}
			}
		} else {
			// 关闭同步：取消同步任务 + 取消订阅 WS
			if h.historySyncService != nil {
				h.historySyncService.CancelSyncTask(exchangeName, req.Symbol, exchange.TradeType(req.TradeType))
			}
			if err := h.wsSyncService.Unsubscribe(exchangeName, []string{req.Symbol}); err != nil {
				c.Logger().Warnf("Failed to unsubscribe %s: %v", req.Symbol, err)
			}
		}

		info.SyncEnabled = *req.SyncEnabled
	}

	return SuccessWithMessage(c, "updated", UpdateSymbolData{
		Symbol: info,
	})
}

// GetSyncTasksData 同步任务状态响应
type GetSyncTasksData struct {
	Stats map[utils.TaskStatus]int `json:"stats"`
	Tasks []*utils.SyncTask        `json:"tasks,omitempty"`
}

// GetSyncTasks 获取同步任务状态
// GET /api/sync/tasks?status=running
func (h *Handler) GetSyncTasks(c echo.Context) error {
	if h.historySyncService == nil {
		return Error(c, http.StatusServiceUnavailable, ErrCodeServiceUnavailable, "history sync service not available")
	}

	taskManager := h.historySyncService.GetTaskManager()
	if taskManager == nil {
		return Error(c, http.StatusServiceUnavailable, ErrCodeServiceUnavailable, "task manager not initialized")
	}

	status := c.QueryParam("status")
	var tasks []*utils.SyncTask

	if status != "" {
		tasks = taskManager.GetTasksByStatus(utils.TaskStatus(status))
	} else {
		tasks = taskManager.GetAllTasks()
	}

	return Success(c, GetSyncTasksData{
		Stats: taskManager.GetStats(),
		Tasks: tasks,
	})
}

// VerifyCandles 验证K线数据
// GET /api/candle/verify?exchange=binance&symbol=BTC-USDT&trade_type=spot&period=15m&limit=100
func (h *Handler) VerifyCandles(c echo.Context) error {
	if h.verifyService == nil {
		return Error(c, http.StatusServiceUnavailable, ErrCodeServiceUnavailable, "verify service not available")
	}

	exchangeStr := c.QueryParam("exchange")
	symbol := c.QueryParam("symbol")
	tradeTypeStr := c.QueryParam("trade_type")
	period := c.QueryParam("period")
	limitStr := c.QueryParam("limit")

	if exchangeStr == "" || symbol == "" {
		return Error(c, http.StatusBadRequest, ErrCodeBadRequest, "exchange and symbol are required")
	}

	// 默认参数
	if tradeTypeStr == "" {
		tradeTypeStr = "spot"
	}
	if period == "" {
		period = "15m"
	}

	limit := 100
	if limitStr != "" {
		if l, err := strconv.Atoi(limitStr); err == nil && l > 0 {
			limit = l
		}
	}

	exchangeName := exchange.ExchangeName(exchangeStr)
	tradeType := exchange.TradeType(tradeTypeStr)

	result, err := h.verifyService.VerifyCandles(c.Request().Context(), exchangeName, symbol, tradeType, exchange.Period(period), limit)
	if err != nil {
		return Error(c, http.StatusInternalServerError, ErrCodeInternal, err.Error())
	}

	return Success(c, result)
}

// GetTicker 获取单个交易对的 ticker
// GET /api/ticker?exchange=binance&symbol=BTC-USDT&trade_type=spot
func (h *Handler) GetTicker(c echo.Context) error {
	if h.tickerSyncService == nil {
		return Error(c, http.StatusServiceUnavailable, ErrCodeServiceUnavailable, "ticker service not available")
	}

	exchangeStr := c.QueryParam("exchange")
	symbol := c.QueryParam("symbol")
	tradeType := c.QueryParam("trade_type")

	if exchangeStr == "" || symbol == "" {
		return Error(c, http.StatusBadRequest, ErrCodeBadRequest, "exchange and symbol are required")
	}

	if tradeType == "" {
		tradeType = "spot"
	}

	ticker, err := h.tickerSyncService.GetTicker(c.Request().Context(), exchangeStr, symbol, tradeType)
	if err != nil {
		return Error(c, http.StatusNotFound, ErrCodeNotFound, "ticker not found")
	}

	return Success(c, ticker)
}

// GetTickerPriceMap 返回 symbol -> lastPrice 的干净映射
// GET /api/tickers/price-map?exchange=binance&trade_type=futures
func (h *Handler) GetTickerPriceMap(c echo.Context) error {
	if h.tickerSyncService == nil {
		return Error(c, http.StatusServiceUnavailable, ErrCodeServiceUnavailable, "ticker service not available")
	}

	exchangeStr := c.QueryParam("exchange")
	tradeType := c.QueryParam("trade_type")

	if exchangeStr == "" {
		return Error(c, http.StatusBadRequest, ErrCodeBadRequest, "exchange is required")
	}
	if tradeType == "" {
		tradeType = "spot"
	}

	priceMap := h.tickerSyncService.GetTickerPriceMap(exchangeStr, tradeType)
	return Success(c, priceMap)
}

// GetTickers 获取交易所所有交易对的 tickers
// GET /api/tickers?exchange=binance&trade_type=spot
func (h *Handler) GetTickers(c echo.Context) error {
	logAPI.Debug().Msg("GetTickers endpoint called")

	if h.tickerSyncService == nil {
		logAPI.Warn().Msg("ticker service not available")
		return Error(c, http.StatusServiceUnavailable, ErrCodeServiceUnavailable, "ticker service not available")
	}

	exchangeStr := c.QueryParam("exchange")
	tradeType := c.QueryParam("trade_type")

	logAPI.Debug().
		Str("exchange", exchangeStr).
		Str("trade_type", tradeType).
		Msg("GetTickers params")

	if exchangeStr == "" {
		return Error(c, http.StatusBadRequest, ErrCodeBadRequest, "exchange is required")
	}

	if tradeType == "" {
		tradeType = "spot"
	}

	tickers, err := h.tickerSyncService.GetTickers(c.Request().Context(), exchangeStr, tradeType)
	if err != nil {
		logAPI.Error().
			Err(err).
			Str("exchange", exchangeStr).
			Str("trade_type", tradeType).
			Msg("Failed to get tickers")
		return Error(c, http.StatusInternalServerError, ErrCodeInternal, err.Error())
	}

	logAPI.Debug().
		Str("exchange", exchangeStr).
		Str("trade_type", tradeType).
		Int("count", len(tickers)).
		Msg("GetTickers success")

	return Success(c, map[string]interface{}{
		"exchange":  exchangeStr,
		"tradeType": tradeType,
		"count":     len(tickers),
		"tickers":   tickers,
	})
}

// GetSymbolSyncStatus 获取交易对同步状态
// GET /api/sync/status?exchange=binance&symbol=BTC-USDT&trade_type=spot
func (h *Handler) GetSymbolSyncStatus(c echo.Context) error {
	exchangeStr := c.QueryParam("exchange")
	symbol := c.QueryParam("symbol")
	tradeType := c.QueryParam("trade_type")

	if exchangeStr == "" || symbol == "" {
		return Error(c, http.StatusBadRequest, ErrCodeBadRequest, "exchange and symbol are required")
	}

	if tradeType == "" {
		tradeType = "spot"
	}

	if h.repo == nil {
		return Error(c, http.StatusServiceUnavailable, ErrCodeServiceUnavailable, "database not configured")
	}

	status, err := h.repo.GetSymbolSyncStatus(c.Request().Context(), exchangeStr, symbol, tradeType)
	if err != nil {
		return Error(c, http.StatusInternalServerError, ErrCodeInternal, err.Error())
	}

	if status == nil {
		return Error(c, http.StatusNotFound, ErrCodeNotFound, "sync status not found")
	}

	return Success(c, status)
}

// GetAllSymbolsSyncStatus 获取所有交易对的同步状态
// GET /api/sync/status/all?exchange=binance&trade_type=spot
func (h *Handler) GetAllSymbolsSyncStatus(c echo.Context) error {
	exchangeStr := c.QueryParam("exchange")
	tradeType := c.QueryParam("trade_type")

	if exchangeStr == "" {
		return Error(c, http.StatusBadRequest, ErrCodeBadRequest, "exchange is required")
	}

	if h.repo == nil {
		return Error(c, http.StatusServiceUnavailable, ErrCodeServiceUnavailable, "database not configured")
	}

	statuses, err := h.repo.GetAllSymbolsSyncStatus(c.Request().Context(), exchangeStr, tradeType)
	if err != nil {
		return Error(c, http.StatusInternalServerError, ErrCodeInternal, err.Error())
	}

	return Success(c, map[string]interface{}{
		"exchange": exchangeStr,
		"count":    len(statuses),
		"statuses": statuses,
	})
}
