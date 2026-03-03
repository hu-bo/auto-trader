package api

import (
	"net/http"
	"sort"
	"strconv"
	"strings"
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
	req := struct {
		Exchange  string  `query:"exchange" validate:"required"`
		Symbol    string  `query:"symbol" validate:"required"`
		TradeType string  `query:"trade_type" validate:"required"`
		Range     float64 `query:"range" validate:"gt=0"`
	}{
		Exchange:  strings.TrimSpace(c.QueryParam("exchange")),
		Symbol:    strings.TrimSpace(c.QueryParam("symbol")),
		TradeType: "spot",
		Range:     0.1,
	}
	errs := make([]ErrorItem, 0)
	if t := strings.TrimSpace(c.QueryParam("trade_type")); t != "" {
		req.TradeType = t
	}
	if rangeStr := strings.TrimSpace(c.QueryParam("range")); rangeStr != "" {
		parsed, err := strconv.ParseFloat(rangeStr, 64)
		if err != nil {
			errs = append(errs, ErrorItem{Field: "range", Message: "must be a valid number"})
		} else {
			req.Range = parsed
		}
	}
	errs = append(errs, validateStruct(req)...)
	if len(errs) > 0 {
		return ErrorWithDetails(c, http.StatusBadRequest, ErrCodeBadRequest, "invalid query parameters", errs)
	}

	exchangeName := exchange.ExchangeName(req.Exchange)
	tradeType := exchange.TradeType(req.TradeType)
	orderBook := h.wsSyncService.GetFilteredOrderBook(exchangeName, tradeType, req.Symbol, req.Range)

	if orderBook == nil {
		return Error(c, http.StatusNotFound, ErrCodeNotFound, "orderbook not found")
	}

	return Success(c, orderBook)
}

// GetTracePrice 获取追踪价格
// GET /api/trace-price?exchange=binance&symbol=BTC-USDT&trade_type=spot&distance=0.1
func (h *Handler) GetTracePrice(c echo.Context) error {
	req := struct {
		Exchange  string  `query:"exchange" validate:"required"`
		Symbol    string  `query:"symbol" validate:"required"`
		TradeType string  `query:"trade_type" validate:"required"`
		Distance  float64 `query:"distance" validate:"gt=0"`
	}{
		Exchange:  strings.TrimSpace(c.QueryParam("exchange")),
		Symbol:    strings.TrimSpace(c.QueryParam("symbol")),
		TradeType: "spot",
		Distance:  0.1,
	}
	errs := make([]ErrorItem, 0)
	if t := strings.TrimSpace(c.QueryParam("trade_type")); t != "" {
		req.TradeType = t
	}
	if distanceStr := strings.TrimSpace(c.QueryParam("distance")); distanceStr != "" {
		parsed, err := strconv.ParseFloat(distanceStr, 64)
		if err != nil {
			errs = append(errs, ErrorItem{Field: "distance", Message: "must be a valid number"})
		} else {
			req.Distance = parsed
		}
	}
	errs = append(errs, validateStruct(req)...)
	if len(errs) > 0 {
		return ErrorWithDetails(c, http.StatusBadRequest, ErrCodeBadRequest, "invalid query parameters", errs)
	}

	exchangeName := exchange.ExchangeName(req.Exchange)
	tradeType := exchange.TradeType(req.TradeType)
	result := h.wsSyncService.GetTracePrice(exchangeName, tradeType, req.Symbol, req.Distance)

	if result == nil {
		return Error(c, http.StatusNotFound, ErrCodeNotFound, "trace price not found")
	}

	return Success(c, result)
}

// GetCandles 获取历史K线
// GET /api/candles?exchange=binance&symbol=BTC-USDT&period=15m&limit=100&start_time=xxx&end_time=xxx
func (h *Handler) GetCandles(c echo.Context) error {
	defaultStart, defaultEnd := utils.Period1d.Interval(1)
	req := struct {
		Exchange  string `query:"exchange" validate:"required"`
		Symbol    string `query:"symbol" validate:"required"`
		Period    string `query:"period" validate:"required"`
		Limit     int    `query:"limit" validate:"gte=0"`
		StartTime int64  `query:"start_time"`
		EndTime   int64  `query:"end_time"`
		Column    bool   `query:"column"`
		Compact   bool   `query:"compact"`
	}{
		Exchange:  strings.TrimSpace(c.QueryParam("exchange")),
		Symbol:    strings.TrimSpace(c.QueryParam("symbol")),
		Period:    "15m",
		Limit:     300,
		StartTime: defaultStart,
		EndTime:   defaultEnd,
	}
	errs := make([]ErrorItem, 0)
	if p := strings.TrimSpace(c.QueryParam("period")); p != "" {
		req.Period = p
	}

	limitStr := strings.TrimSpace(c.QueryParam("limit"))
	startTimeStr := strings.TrimSpace(c.QueryParam("start_time"))
	endTimeStr := strings.TrimSpace(c.QueryParam("end_time"))
	limitProvided := limitStr != ""
	startProvided := startTimeStr != ""
	endProvided := endTimeStr != ""

	if limitProvided {
		parsed, err := strconv.Atoi(limitStr)
		if err != nil {
			errs = append(errs, ErrorItem{Field: "limit", Message: "must be a valid integer"})
		} else {
			req.Limit = parsed
		}
	}
	if startProvided {
		parsed, err := strconv.ParseInt(startTimeStr, 10, 64)
		if err != nil {
			errs = append(errs, ErrorItem{Field: "start_time", Message: "must be a valid int64"})
		} else {
			req.StartTime = parsed
		}
	}
	if endProvided {
		parsed, err := strconv.ParseInt(endTimeStr, 10, 64)
		if err != nil {
			errs = append(errs, ErrorItem{Field: "end_time", Message: "must be a valid int64"})
		} else {
			req.EndTime = parsed
		}
	}
	if !limitProvided {
		if startProvided != endProvided {
			errs = append(errs, ErrorItem{Field: "start_time", Message: "must be provided together with end_time when limit is not set"})
			errs = append(errs, ErrorItem{Field: "end_time", Message: "must be provided together with start_time when limit is not set"})
		}
		if startProvided && endProvided {
			req.Limit = 0
		}
	}
	if req.StartTime > req.EndTime {
		errs = append(errs, ErrorItem{Field: "start_time", Message: "must be less than or equal to end_time"})
	}
	if columnStr := strings.TrimSpace(c.QueryParam("column")); columnStr != "" {
		parsed, err := strconv.ParseBool(columnStr)
		if err != nil {
			errs = append(errs, ErrorItem{Field: "column", Message: "must be a valid boolean"})
		} else {
			req.Column = parsed
		}
	}
	if compactStr := strings.TrimSpace(c.QueryParam("compact")); compactStr != "" {
		parsed, err := strconv.ParseBool(compactStr)
		if err != nil {
			errs = append(errs, ErrorItem{Field: "compact", Message: "must be a valid boolean"})
		} else {
			req.Compact = parsed
		}
	}

	errs = append(errs, validateStruct(req)...)
	if len(errs) > 0 {
		return ErrorWithDetails(c, http.StatusBadRequest, ErrCodeBadRequest, "invalid query parameters", errs)
	}

	if h.repo == nil {
		return Error(c, http.StatusServiceUnavailable, ErrCodeServiceUnavailable, "database not configured")
	}

	var (
		candles []exchange.NormalizedCandle
		err     error
	)

	requestedPeriod := exchange.Period(req.Period)
	if requestedPeriod == exchange.Period4h {
		sourcePeriod := exchange.Period15m
		ratio := int(requestedPeriod.IntervalMs() / sourcePeriod.IntervalMs())
		sourceLimit := 0
		if req.Limit > 0 {
			sourceLimit = req.Limit*ratio + ratio
		}
		sourceStart := requestedPeriod.RoundToInterval(req.StartTime)
		sourceEnd := requestedPeriod.NextInterval(req.EndTime) - sourcePeriod.IntervalMs()

		if sourceEnd < sourceStart {
			sourceEnd = req.EndTime
		}

		sourceCandles, fetchErr := h.repo.GetCandles(c.Request().Context(), req.Exchange, req.Symbol, string(sourcePeriod), sourceStart, sourceEnd, sourceLimit)
		if fetchErr != nil {
			return Error(c, http.StatusInternalServerError, ErrCodeInternal, fetchErr.Error())
		}

		aggregated, aggErr := aggregator.AggregateCandlesByPeriod(sourceCandles, sourcePeriod, requestedPeriod)
		if aggErr != nil {
			return Error(c, http.StatusInternalServerError, ErrCodeInternal, aggErr.Error())
		}

		candles = filterCandlesByRangeAndLimit(aggregated, req.StartTime, req.EndTime, req.Limit)
	} else {
		candles, err = h.repo.GetCandles(c.Request().Context(), req.Exchange, req.Symbol, req.Period, req.StartTime, req.EndTime, req.Limit)
		if err != nil {
			return Error(c, http.StatusInternalServerError, ErrCodeInternal, err.Error())
		}
	}

	// 列式存储格式 (Column-Oriented)
	if req.Column {
		return Success(c, utils.CandlesToColumnFormat(candles))
	}

	// 紧凑格式 (Row-Oriented)
	if req.Compact {
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
		return filtered[i].Timestamp < filtered[j].Timestamp
	})

	if limit > 0 && len(filtered) > limit {
		filtered = filtered[:limit]
	}

	return filtered
}

// GetCurrentCandle 获取当前K线
// GET /api/candle/current?exchange=binance&symbol=BTC-USDT&trade_type=spot&period=15m
func (h *Handler) GetCurrentCandle(c echo.Context) error {
	req := struct {
		Exchange  string `query:"exchange" validate:"required"`
		Symbol    string `query:"symbol" validate:"required"`
		TradeType string `query:"trade_type" validate:"required"`
		Period    string `query:"period" validate:"required"`
	}{
		Exchange:  strings.TrimSpace(c.QueryParam("exchange")),
		Symbol:    strings.TrimSpace(c.QueryParam("symbol")),
		TradeType: "spot",
		Period:    "15m",
	}
	if t := strings.TrimSpace(c.QueryParam("trade_type")); t != "" {
		req.TradeType = t
	}
	if p := strings.TrimSpace(c.QueryParam("period")); p != "" {
		req.Period = p
	}
	errs := validateStruct(req)
	if len(errs) > 0 {
		return ErrorWithDetails(c, http.StatusBadRequest, ErrCodeBadRequest, "invalid query parameters", errs)
	}

	exchangeName := exchange.ExchangeName(req.Exchange)
	tradeType := exchange.TradeType(req.TradeType)
	candle := h.wsSyncService.GetCurrentCandle(exchangeName, tradeType, req.Symbol, exchange.Period(req.Period))

	if candle == nil {
		return Error(c, http.StatusNotFound, ErrCodeNotFound, "candle not found")
	}

	return Success(c, candle)
}

// FillMissingData 填充缺失数据
// GET /api/candle/fill-miss?exchange=binance&symbol=BTC-USDT&period=15m&start_time=xxx&end_time=xxx
func (h *Handler) FillMissingData(c echo.Context) error {
	defaultStart, defaultEnd := utils.Period1d.Interval(2)
	req := struct {
		Exchange  string `query:"exchange" validate:"required"`
		Symbol    string `query:"symbol" validate:"required"`
		TradeType string `query:"trade_type" validate:"required"`
		StartTime int64  `query:"start_time"`
		EndTime   int64  `query:"end_time"`
	}{
		Exchange:  strings.TrimSpace(c.QueryParam("exchange")),
		Symbol:    strings.TrimSpace(c.QueryParam("symbol")),
		TradeType: "spot",
		StartTime: defaultStart,
		EndTime:   defaultEnd,
	}
	errs := make([]ErrorItem, 0)
	if t := strings.TrimSpace(c.QueryParam("trade_type")); t != "" {
		req.TradeType = t
	}
	if startTimeStr := strings.TrimSpace(c.QueryParam("start_time")); startTimeStr != "" {
		parsed, err := strconv.ParseInt(startTimeStr, 10, 64)
		if err != nil {
			errs = append(errs, ErrorItem{Field: "start_time", Message: "must be a valid int64"})
		} else {
			req.StartTime = parsed
		}
	}
	if endTimeStr := strings.TrimSpace(c.QueryParam("end_time")); endTimeStr != "" {
		parsed, err := strconv.ParseInt(endTimeStr, 10, 64)
		if err != nil {
			errs = append(errs, ErrorItem{Field: "end_time", Message: "must be a valid int64"})
		} else {
			req.EndTime = parsed
		}
	}
	if req.StartTime > req.EndTime {
		errs = append(errs, ErrorItem{Field: "start_time", Message: "must be less than or equal to end_time"})
	}
	errs = append(errs, validateStruct(req)...)
	if len(errs) > 0 {
		return ErrorWithDetails(c, http.StatusBadRequest, ErrCodeBadRequest, "invalid query parameters", errs)
	}

	if h.historySyncService == nil {
		return Error(c, http.StatusServiceUnavailable, ErrCodeServiceUnavailable, "history sync service not available")
	}

	exchangeName := exchange.ExchangeName(req.Exchange)
	err := h.historySyncService.FillMissingData(c.Request().Context(), exchangeName, req.Symbol, req.TradeType, req.StartTime, req.EndTime)
	if err != nil {
		return Error(c, http.StatusInternalServerError, ErrCodeInternal, err.Error())
	}

	return SuccessWithMessage[any](c, "fill missing data completed", nil)
}

// SubscribeRequest 订阅请求体
type SubscribeRequest struct {
	Exchange string                      `json:"exchange" validate:"required"`
	Symbols  []exchange.SubscribeRequest `json:"symbols" validate:"min=1"`
}

// Subscribe 动态订阅
// POST /api/subscribe
func (h *Handler) Subscribe(c echo.Context) error {
	var req SubscribeRequest
	if err := c.Bind(&req); err != nil {
		return Error(c, http.StatusBadRequest, ErrCodeBadRequest, "invalid request body")
	}

	if errs := validateStruct(req); len(errs) > 0 {
		return ErrorWithDetails(c, http.StatusBadRequest, ErrCodeBadRequest, "invalid request body", errs)
	}

	exchangeName := exchange.ExchangeName(req.Exchange)
	if err := h.wsSyncService.Subscribe(exchangeName, req.Symbols); err != nil {
		return Error(c, http.StatusInternalServerError, ErrCodeInternal, err.Error())
	}

	return SuccessWithMessage[any](c, "subscribed", nil)
}

// UnsubscribeRequest 取消订阅请求体
type UnsubscribeRequest struct {
	Exchange string   `json:"exchange" validate:"required"`
	Symbols  []string `json:"symbols" validate:"min=1"`
}

// Unsubscribe 取消订阅
// POST /api/unsubscribe
func (h *Handler) Unsubscribe(c echo.Context) error {
	var req UnsubscribeRequest
	if err := c.Bind(&req); err != nil {
		return Error(c, http.StatusBadRequest, ErrCodeBadRequest, "invalid request body")
	}

	if errs := validateStruct(req); len(errs) > 0 {
		return ErrorWithDetails(c, http.StatusBadRequest, ErrCodeBadRequest, "invalid request body", errs)
	}

	exchangeName := exchange.ExchangeName(req.Exchange)
	if err := h.wsSyncService.Unsubscribe(exchangeName, req.Symbols); err != nil {
		return Error(c, http.StatusInternalServerError, ErrCodeInternal, err.Error())
	}

	return SuccessWithMessage[any](c, "unsubscribed", nil)
}

// DeleteSymbolRequest 删除交易对请求体
type DeleteSymbolRequest struct {
	Exchange  string `json:"exchange" validate:"required"`
	Symbol    string `json:"symbol" validate:"required"`
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

	if strings.TrimSpace(req.TradeType) == "" {
		req.TradeType = "spot"
	}
	if errs := validateStruct(req); len(errs) > 0 {
		return ErrorWithDetails(c, http.StatusBadRequest, ErrCodeBadRequest, "invalid request body", errs)
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
	Exchange  string   `json:"exchange" validate:"required"`
	Symbols   []string `json:"symbols" validate:"min=1"`
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

	if strings.TrimSpace(req.TradeType) == "" {
		req.TradeType = "spot"
	}
	if errs := validateStruct(req); len(errs) > 0 {
		return ErrorWithDetails(c, http.StatusBadRequest, ErrCodeBadRequest, "invalid request body", errs)
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
	req := struct {
		Exchange   string `query:"exchange" validate:"required"`
		TradeType  string `query:"trade_type"`
		OrderBy    string `query:"orderBy"`
		Order      string `query:"order"`
		SymbolLike string `query:"symbol"`
	}{
		Exchange:   strings.TrimSpace(c.QueryParam("exchange")),
		TradeType:  strings.TrimSpace(c.QueryParam("trade_type")),
		OrderBy:    strings.TrimSpace(c.QueryParam("orderBy")),
		Order:      strings.TrimSpace(c.QueryParam("order")),
		SymbolLike: strings.TrimSpace(c.QueryParam("symbol")),
	}
	errs := validateStruct(req)
	if len(errs) > 0 {
		return ErrorWithDetails(c, http.StatusBadRequest, ErrCodeBadRequest, "invalid query parameters", errs)
	}

	if h.repo == nil {
		return Error(c, http.StatusServiceUnavailable, ErrCodeServiceUnavailable, "database not configured")
	}

	symbols, err := h.repo.GetSymbolInfos(c.Request().Context(), req.Exchange)
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
		Str("exchange", req.Exchange).
		Int("total", len(symbols)).
		Int("withTicker", withTicker).
		Str("orderBy", req.OrderBy).
		Str("order", req.Order).
		Msg("GetSymbolInfos join check")

	// 如果指定了 trade_type，进行过滤
	if req.TradeType != "" {
		filtered := make([]exchange.SymbolInfo, 0)
		for _, s := range symbols {
			if s.TradeType == req.TradeType {
				filtered = append(filtered, s)
			}
		}
		symbols = filtered
	}

	// 过滤指定的 symbol（精确匹配）
	if req.SymbolLike != "" {
		filtered := make([]exchange.SymbolInfo, 0)
		for _, s := range symbols {
			if s.Symbol == req.SymbolLike {
				filtered = append(filtered, s)
			}
		}
		symbols = filtered
	}

	// 排序: orderBy=amount|quoteVolume24h 或 orderBy=change24h
	sortSymbolsInPlace(symbols, req.OrderBy, req.Order)

	return Success(c, GetSymbolsData{
		Exchange: req.Exchange,
		Count:    len(symbols),
		Symbols:  symbols,
	})
}

// UpdateSymbolRequest 更新交易对请求体
type UpdateSymbolRequest struct {
	Exchange    string `json:"exchange" validate:"required"`
	Symbol      string `json:"symbol" validate:"required"`
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

	if strings.TrimSpace(req.TradeType) == "" {
		req.TradeType = "spot"
	}
	if errs := validateStruct(req); len(errs) > 0 {
		return ErrorWithDetails(c, http.StatusBadRequest, ErrCodeBadRequest, "invalid request body", errs)
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

	req := struct {
		Status string `query:"status"`
	}{
		Status: strings.TrimSpace(c.QueryParam("status")),
	}

	var tasks []*utils.SyncTask

	if req.Status != "" {
		tasks = taskManager.GetTasksByStatus(utils.TaskStatus(req.Status))
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

	req := struct {
		Exchange  string `query:"exchange" validate:"required"`
		Symbol    string `query:"symbol" validate:"required"`
		TradeType string `query:"trade_type" validate:"required"`
		Period    string `query:"period" validate:"required"`
		Limit     int    `query:"limit" validate:"gt=0"`
	}{
		Exchange:  strings.TrimSpace(c.QueryParam("exchange")),
		Symbol:    strings.TrimSpace(c.QueryParam("symbol")),
		TradeType: "spot",
		Period:    "15m",
		Limit:     100,
	}
	errs := make([]ErrorItem, 0)
	if t := strings.TrimSpace(c.QueryParam("trade_type")); t != "" {
		req.TradeType = t
	}
	if p := strings.TrimSpace(c.QueryParam("period")); p != "" {
		req.Period = p
	}
	if limitStr := strings.TrimSpace(c.QueryParam("limit")); limitStr != "" {
		parsed, err := strconv.Atoi(limitStr)
		if err != nil {
			errs = append(errs, ErrorItem{Field: "limit", Message: "must be a valid integer"})
		} else {
			req.Limit = parsed
		}
	}
	errs = append(errs, validateStruct(req)...)
	if len(errs) > 0 {
		return ErrorWithDetails(c, http.StatusBadRequest, ErrCodeBadRequest, "invalid query parameters", errs)
	}

	exchangeName := exchange.ExchangeName(req.Exchange)
	tradeType := exchange.TradeType(req.TradeType)

	result, err := h.verifyService.VerifyCandles(c.Request().Context(), exchangeName, req.Symbol, tradeType, exchange.Period(req.Period), req.Limit)
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

	req := struct {
		Exchange  string `query:"exchange" validate:"required"`
		Symbol    string `query:"symbol" validate:"required"`
		TradeType string `query:"trade_type" validate:"required"`
	}{
		Exchange:  strings.TrimSpace(c.QueryParam("exchange")),
		Symbol:    strings.TrimSpace(c.QueryParam("symbol")),
		TradeType: "spot",
	}
	if t := strings.TrimSpace(c.QueryParam("trade_type")); t != "" {
		req.TradeType = t
	}
	errs := validateStruct(req)
	if len(errs) > 0 {
		return ErrorWithDetails(c, http.StatusBadRequest, ErrCodeBadRequest, "invalid query parameters", errs)
	}

	ticker, err := h.tickerSyncService.GetTicker(c.Request().Context(), req.Exchange, req.Symbol, req.TradeType)
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

	req := struct {
		Exchange  string `query:"exchange" validate:"required"`
		TradeType string `query:"trade_type" validate:"required"`
	}{
		Exchange:  strings.TrimSpace(c.QueryParam("exchange")),
		TradeType: "spot",
	}
	if t := strings.TrimSpace(c.QueryParam("trade_type")); t != "" {
		req.TradeType = t
	}
	errs := validateStruct(req)
	if len(errs) > 0 {
		return ErrorWithDetails(c, http.StatusBadRequest, ErrCodeBadRequest, "invalid query parameters", errs)
	}

	priceMap := h.tickerSyncService.GetTickerPriceMap(req.Exchange, req.TradeType)
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

	req := struct {
		Exchange  string `query:"exchange" validate:"required"`
		TradeType string `query:"trade_type" validate:"required"`
	}{
		Exchange:  strings.TrimSpace(c.QueryParam("exchange")),
		TradeType: "spot",
	}
	if t := strings.TrimSpace(c.QueryParam("trade_type")); t != "" {
		req.TradeType = t
	}
	errs := validateStruct(req)
	if len(errs) > 0 {
		return ErrorWithDetails(c, http.StatusBadRequest, ErrCodeBadRequest, "invalid query parameters", errs)
	}

	logAPI.Debug().
		Str("exchange", req.Exchange).
		Str("trade_type", req.TradeType).
		Msg("GetTickers params")

	tickers, err := h.tickerSyncService.GetTickers(c.Request().Context(), req.Exchange, req.TradeType)
	if err != nil {
		logAPI.Error().
			Err(err).
			Str("exchange", req.Exchange).
			Str("trade_type", req.TradeType).
			Msg("Failed to get tickers")
		return Error(c, http.StatusInternalServerError, ErrCodeInternal, err.Error())
	}

	logAPI.Debug().
		Str("exchange", req.Exchange).
		Str("trade_type", req.TradeType).
		Int("count", len(tickers)).
		Msg("GetTickers success")

	return Success(c, map[string]interface{}{
		"exchange":  req.Exchange,
		"tradeType": req.TradeType,
		"count":     len(tickers),
		"tickers":   tickers,
	})
}

// GetSymbolSyncStatus 获取交易对同步状态
// GET /api/sync/status?exchange=binance&symbol=BTC-USDT&trade_type=spot
func (h *Handler) GetSymbolSyncStatus(c echo.Context) error {
	req := struct {
		Exchange  string `query:"exchange" validate:"required"`
		Symbol    string `query:"symbol" validate:"required"`
		TradeType string `query:"trade_type" validate:"required"`
	}{
		Exchange:  strings.TrimSpace(c.QueryParam("exchange")),
		Symbol:    strings.TrimSpace(c.QueryParam("symbol")),
		TradeType: "spot",
	}
	if t := strings.TrimSpace(c.QueryParam("trade_type")); t != "" {
		req.TradeType = t
	}
	errs := validateStruct(req)
	if len(errs) > 0 {
		return ErrorWithDetails(c, http.StatusBadRequest, ErrCodeBadRequest, "invalid query parameters", errs)
	}

	if h.repo == nil {
		return Error(c, http.StatusServiceUnavailable, ErrCodeServiceUnavailable, "database not configured")
	}

	status, err := h.repo.GetSymbolSyncStatus(c.Request().Context(), req.Exchange, req.Symbol, req.TradeType)
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
	req := struct {
		Exchange  string `query:"exchange" validate:"required"`
		TradeType string `query:"trade_type"`
	}{
		Exchange:  strings.TrimSpace(c.QueryParam("exchange")),
		TradeType: strings.TrimSpace(c.QueryParam("trade_type")),
	}
	errs := validateStruct(req)
	if len(errs) > 0 {
		return ErrorWithDetails(c, http.StatusBadRequest, ErrCodeBadRequest, "invalid query parameters", errs)
	}

	if h.repo == nil {
		return Error(c, http.StatusServiceUnavailable, ErrCodeServiceUnavailable, "database not configured")
	}

	statuses, err := h.repo.GetAllSymbolsSyncStatus(c.Request().Context(), req.Exchange, req.TradeType)
	if err != nil {
		return Error(c, http.StatusInternalServerError, ErrCodeInternal, err.Error())
	}

	return Success(c, map[string]interface{}{
		"exchange": req.Exchange,
		"count":    len(statuses),
		"statuses": statuses,
	})
}
