package api

import (
	"strconv"
	"strings"

	"exchange-adapter-service/internal/utils"
)

type queryValidation struct {
	errors []ErrorItem
}

func (v *queryValidation) add(field, message string) {
	v.errors = append(v.errors, ErrorItem{Field: field, Message: message})
}

func (v *queryValidation) requiredString(field, value string) string {
	trimmed := strings.TrimSpace(value)
	if trimmed == "" {
		v.add(field, "is required")
	}
	return trimmed
}

func (v *queryValidation) optionalString(value, fallback string) string {
	trimmed := strings.TrimSpace(value)
	if trimmed == "" {
		return fallback
	}
	return trimmed
}

func (v *queryValidation) int64(field, value string) int64 {
	parsed, err := strconv.ParseInt(strings.TrimSpace(value), 10, 64)
	if err != nil {
		v.add(field, "must be a valid int64")
		return 0
	}
	return parsed
}

func (v *queryValidation) int(field, value string) int {
	parsed, err := strconv.Atoi(strings.TrimSpace(value))
	if err != nil {
		v.add(field, "must be a valid integer")
		return 0
	}
	return parsed
}

func (v *queryValidation) float64(field, value string) float64 {
	parsed, err := strconv.ParseFloat(strings.TrimSpace(value), 64)
	if err != nil {
		v.add(field, "must be a valid number")
		return 0
	}
	return parsed
}

func (v *queryValidation) bool(field, value string) bool {
	parsed, err := strconv.ParseBool(strings.TrimSpace(value))
	if err != nil {
		v.add(field, "must be a valid boolean")
		return false
	}
	return parsed
}

func validateSubscribeRequest(req *SubscribeRequest) []ErrorItem {
	var errs []ErrorItem
	req.Exchange = strings.TrimSpace(req.Exchange)
	if req.Exchange == "" {
		errs = append(errs, ErrorItem{Field: "exchange", Message: "is required"})
	}
	if len(req.Symbols) == 0 {
		errs = append(errs, ErrorItem{Field: "symbols", Message: "must not be empty"})
	}
	return errs
}

func validateUnsubscribeRequest(req *UnsubscribeRequest) []ErrorItem {
	var errs []ErrorItem
	req.Exchange = strings.TrimSpace(req.Exchange)
	if req.Exchange == "" {
		errs = append(errs, ErrorItem{Field: "exchange", Message: "is required"})
	}
	if len(req.Symbols) == 0 {
		errs = append(errs, ErrorItem{Field: "symbols", Message: "must not be empty"})
	}
	return errs
}

func validateDeleteSymbolRequest(req *DeleteSymbolRequest) []ErrorItem {
	var errs []ErrorItem
	req.Exchange = strings.TrimSpace(req.Exchange)
	req.Symbol = strings.TrimSpace(req.Symbol)
	req.TradeType = strings.TrimSpace(req.TradeType)
	if req.Exchange == "" {
		errs = append(errs, ErrorItem{Field: "exchange", Message: "is required"})
	}
	if req.Symbol == "" {
		errs = append(errs, ErrorItem{Field: "symbol", Message: "is required"})
	}
	if req.TradeType == "" {
		req.TradeType = "spot"
	}
	return errs
}

func validateDeleteSymbolsBatchRequest(req *DeleteSymbolsBatchRequest) []ErrorItem {
	var errs []ErrorItem
	req.Exchange = strings.TrimSpace(req.Exchange)
	req.TradeType = strings.TrimSpace(req.TradeType)
	if req.Exchange == "" {
		errs = append(errs, ErrorItem{Field: "exchange", Message: "is required"})
	}
	if len(req.Symbols) == 0 {
		errs = append(errs, ErrorItem{Field: "symbols", Message: "must not be empty"})
	}
	if req.TradeType == "" {
		req.TradeType = "spot"
	}
	return errs
}

func validateUpdateSymbolRequest(req *UpdateSymbolRequest) []ErrorItem {
	var errs []ErrorItem
	req.Exchange = strings.TrimSpace(req.Exchange)
	req.Symbol = strings.TrimSpace(req.Symbol)
	req.TradeType = strings.TrimSpace(req.TradeType)
	if req.Exchange == "" {
		errs = append(errs, ErrorItem{Field: "exchange", Message: "is required"})
	}
	if req.Symbol == "" {
		errs = append(errs, ErrorItem{Field: "symbol", Message: "is required"})
	}
	if req.TradeType == "" {
		req.TradeType = "spot"
	}
	return errs
}

type orderBookQuery struct {
	Exchange  string
	Symbol    string
	TradeType string
	Range     float64
}

func parseOrderBookQuery(exchangeStr, symbolStr, tradeTypeStr, rangeStr string) (orderBookQuery, []ErrorItem) {
	v := &queryValidation{}
	req := orderBookQuery{
		Exchange:  v.requiredString("exchange", exchangeStr),
		Symbol:    v.requiredString("symbol", symbolStr),
		TradeType: v.optionalString(tradeTypeStr, "spot"),
		Range:     0.1,
	}
	if strings.TrimSpace(rangeStr) != "" {
		req.Range = v.float64("range", rangeStr)
	}
	return req, v.errors
}

type tracePriceQuery struct {
	Exchange  string
	Symbol    string
	TradeType string
	Distance  float64
}

func parseTracePriceQuery(exchangeStr, symbolStr, tradeTypeStr, distanceStr string) (tracePriceQuery, []ErrorItem) {
	v := &queryValidation{}
	req := tracePriceQuery{
		Exchange:  v.requiredString("exchange", exchangeStr),
		Symbol:    v.requiredString("symbol", symbolStr),
		TradeType: v.optionalString(tradeTypeStr, "spot"),
		Distance:  0.1,
	}
	if strings.TrimSpace(distanceStr) != "" {
		req.Distance = v.float64("distance", distanceStr)
	}
	return req, v.errors
}

type candlesQuery struct {
	Exchange  string
	Symbol    string
	Period    string
	Limit     int
	StartTime int64
	EndTime   int64
	Column    bool
	Compact   bool
}

func parseCandlesQuery(exchangeStr, symbolStr, periodStr, limitStr, startTimeStr, endTimeStr, columnStr, compactStr string) (candlesQuery, []ErrorItem) {
	v := &queryValidation{}
	defaultStart, defaultEnd := utils.Period1d.Interval(1)
	req := candlesQuery{
		Exchange:  v.requiredString("exchange", exchangeStr),
		Symbol:    v.requiredString("symbol", symbolStr),
		Period:    v.optionalString(periodStr, "15m"),
		Limit:     300,
		StartTime: defaultStart,
		EndTime:   defaultEnd,
	}

	limitProvided := strings.TrimSpace(limitStr) != ""
	startProvided := strings.TrimSpace(startTimeStr) != ""
	endProvided := strings.TrimSpace(endTimeStr) != ""

	if limitProvided {
		req.Limit = v.int("limit", limitStr)
		if req.Limit < 0 {
			v.add("limit", "must be greater than or equal to 0")
		}
	}

	if startProvided {
		req.StartTime = v.int64("start_time", startTimeStr)
	}
	if endProvided {
		req.EndTime = v.int64("end_time", endTimeStr)
	}

	if !limitProvided {
		if startProvided != endProvided {
			v.add("start_time", "must be provided together with end_time when limit is not set")
			v.add("end_time", "must be provided together with start_time when limit is not set")
		}
		if startProvided && endProvided {
			req.Limit = 0
		} else {
			req.Limit = 300
		}
	}

	if req.StartTime > req.EndTime {
		v.add("start_time", "must be less than or equal to end_time")
	}

	if strings.TrimSpace(columnStr) != "" {
		req.Column = v.bool("column", columnStr)
	}
	if strings.TrimSpace(compactStr) != "" {
		req.Compact = v.bool("compact", compactStr)
	}

	return req, v.errors
}

type currentCandleQuery struct {
	Exchange  string
	Symbol    string
	TradeType string
	Period    string
}

func parseCurrentCandleQuery(exchangeStr, symbolStr, tradeTypeStr, periodStr string) (currentCandleQuery, []ErrorItem) {
	v := &queryValidation{}
	req := currentCandleQuery{
		Exchange:  v.requiredString("exchange", exchangeStr),
		Symbol:    v.requiredString("symbol", symbolStr),
		TradeType: v.optionalString(tradeTypeStr, "spot"),
		Period:    v.optionalString(periodStr, "15m"),
	}
	return req, v.errors
}

type fillMissingDataQuery struct {
	Exchange  string
	Symbol    string
	TradeType string
	StartTime int64
	EndTime   int64
}

func parseFillMissingDataQuery(exchangeStr, symbolStr, tradeTypeStr, startTimeStr, endTimeStr string) (fillMissingDataQuery, []ErrorItem) {
	v := &queryValidation{}
	defaultStart, defaultEnd := utils.Period1d.Interval(2)
	req := fillMissingDataQuery{
		Exchange:  v.requiredString("exchange", exchangeStr),
		Symbol:    v.requiredString("symbol", symbolStr),
		TradeType: v.optionalString(tradeTypeStr, "spot"),
		StartTime: defaultStart,
		EndTime:   defaultEnd,
	}
	if strings.TrimSpace(startTimeStr) != "" {
		req.StartTime = v.int64("start_time", startTimeStr)
	}
	if strings.TrimSpace(endTimeStr) != "" {
		req.EndTime = v.int64("end_time", endTimeStr)
	}
	if req.StartTime > req.EndTime {
		v.add("start_time", "must be less than or equal to end_time")
	}
	return req, v.errors
}

type symbolsQuery struct {
	Exchange   string
	TradeType  string
	OrderBy    string
	Order      string
	SymbolLike string
}

func parseSymbolsQuery(exchangeStr, tradeTypeStr, orderByStr, orderStr, symbolStr string) (symbolsQuery, []ErrorItem) {
	v := &queryValidation{}
	req := symbolsQuery{
		Exchange:   v.requiredString("exchange", exchangeStr),
		TradeType:  strings.TrimSpace(tradeTypeStr),
		OrderBy:    strings.TrimSpace(orderByStr),
		Order:      strings.TrimSpace(orderStr),
		SymbolLike: strings.TrimSpace(symbolStr),
	}
	return req, v.errors
}

type syncTasksQuery struct {
	Status string
}

func parseSyncTasksQuery(statusStr string) (syncTasksQuery, []ErrorItem) {
	req := syncTasksQuery{Status: strings.TrimSpace(statusStr)}
	return req, nil
}

type verifyCandlesQuery struct {
	Exchange  string
	Symbol    string
	TradeType string
	Period    string
	Limit     int
}

func parseVerifyCandlesQuery(exchangeStr, symbolStr, tradeTypeStr, periodStr, limitStr string) (verifyCandlesQuery, []ErrorItem) {
	v := &queryValidation{}
	req := verifyCandlesQuery{
		Exchange:  v.requiredString("exchange", exchangeStr),
		Symbol:    v.requiredString("symbol", symbolStr),
		TradeType: v.optionalString(tradeTypeStr, "spot"),
		Period:    v.optionalString(periodStr, "15m"),
		Limit:     100,
	}
	if strings.TrimSpace(limitStr) != "" {
		req.Limit = v.int("limit", limitStr)
		if req.Limit <= 0 {
			v.add("limit", "must be greater than 0")
		}
	}
	return req, v.errors
}

type tickerQuery struct {
	Exchange  string
	Symbol    string
	TradeType string
}

func parseTickerQuery(exchangeStr, symbolStr, tradeTypeStr string) (tickerQuery, []ErrorItem) {
	v := &queryValidation{}
	req := tickerQuery{
		Exchange:  v.requiredString("exchange", exchangeStr),
		Symbol:    v.requiredString("symbol", symbolStr),
		TradeType: v.optionalString(tradeTypeStr, "spot"),
	}
	return req, v.errors
}

type tickersQuery struct {
	Exchange  string
	TradeType string
}

func parseTickersQuery(exchangeStr, tradeTypeStr string) (tickersQuery, []ErrorItem) {
	v := &queryValidation{}
	req := tickersQuery{
		Exchange:  v.requiredString("exchange", exchangeStr),
		TradeType: v.optionalString(tradeTypeStr, "spot"),
	}
	return req, v.errors
}

type symbolSyncStatusQuery struct {
	Exchange  string
	Symbol    string
	TradeType string
}

func parseSymbolSyncStatusQuery(exchangeStr, symbolStr, tradeTypeStr string) (symbolSyncStatusQuery, []ErrorItem) {
	v := &queryValidation{}
	req := symbolSyncStatusQuery{
		Exchange:  v.requiredString("exchange", exchangeStr),
		Symbol:    v.requiredString("symbol", symbolStr),
		TradeType: v.optionalString(tradeTypeStr, "spot"),
	}
	return req, v.errors
}

type allSymbolsSyncStatusQuery struct {
	Exchange  string
	TradeType string
}

func parseAllSymbolsSyncStatusQuery(exchangeStr, tradeTypeStr string) (allSymbolsSyncStatusQuery, []ErrorItem) {
	v := &queryValidation{}
	req := allSymbolsSyncStatusQuery{
		Exchange:  v.requiredString("exchange", exchangeStr),
		TradeType: strings.TrimSpace(tradeTypeStr),
	}
	return req, v.errors
}
