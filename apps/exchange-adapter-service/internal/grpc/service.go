package grpcserver

import (
	"context"
	"time"

	exchangepb "exchange-adapter-service/gen/exchange"
	"exchange-adapter-service/internal/config"
	"exchange-adapter-service/internal/contract"
	"exchange-adapter-service/internal/session"
	"exchange-adapter-service/internal/trading"

	"github.com/pkg/exchange-adapter/core"
	"github.com/pkg/logger"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
)

var svcLog = logger.Module("grpc.exchange_service")

const (
	// Config has been simplified; these behaviors are now hardcoded.
	defaultPrewarmOnInit        = false
	defaultAutoSubscribeOnOrder = true
)

type ExchangeService struct {
	exchangepb.UnimplementedExchangeServiceServer

	cfg   *config.Config
	store *session.Store

	manager  *trading.Manager
	orderIdx *trading.OrderIndex
	hub      *trading.OrderUpdateHub
}

func NewExchangeService(cfg *config.Config, store *session.Store, manager *trading.Manager, orderIdx *trading.OrderIndex, hub *trading.OrderUpdateHub) *ExchangeService {
	return &ExchangeService{
		cfg:      cfg,
		store:    store,
		manager:  manager,
		orderIdx: orderIdx,
		hub:      hub,
	}
}

func (s *ExchangeService) InitAccount(ctx context.Context, req *exchangepb.InitAccountRequest) (*exchangepb.InitAccountResponse, error) {
	if req == nil {
		return &exchangepb.InitAccountResponse{Success: false, Error: contract.Error(core.ErrorInvalidParams, "request is nil")}, nil
	}

	ex, err := contract.ProtoExchangeToCore(req.Exchange)
	if err != nil {
		return &exchangepb.InitAccountResponse{Success: false, Error: contract.Error(core.ErrorInvalidParams, err.Error())}, nil
	}
	if req.ApiKey == "" || req.ApiSecret == "" {
		return &exchangepb.InitAccountResponse{Success: false, Error: contract.Error(core.ErrorInvalidParams, "api_key and api_secret are required")}, nil
	}

	passphrase := ""
	if req.Passphrase != nil {
		passphrase = req.GetPassphrase()
	}
	if ex == core.ExchangeOKX && passphrase == "" {
		return &exchangepb.InitAccountResponse{Success: false, Error: contract.Error(core.ErrorInvalidParams, "passphrase is required for OKX")}, nil
	}

	name := ""
	if req.Name != nil {
		name = req.GetName()
	}

	accountID := ""
	if req.AccountId != nil {
		accountID = req.GetAccountId()
	}

	cfg := session.AccountConfig{
		Exchange:    ex,
		APIKey:      req.ApiKey,
		APISecret:   req.ApiSecret,
		Passphrase:  passphrase,
		Demonet:     req.Demonet,
		Name:        name,
		HTTPProxy:   "",
		Socks5Proxy: "",
		AccountID:   accountID,
	}
	if s.cfg != nil {
		cfg.HTTPProxy = s.cfg.Proxy.HTTP
		cfg.Socks5Proxy = s.cfg.Proxy.Socks5
	}

	token, err := s.store.Create(cfg)
	if err != nil {
		return &exchangepb.InitAccountResponse{Success: false, Error: contract.Error("TOKEN_CREATE_ERROR", err.Error())}, nil
	}

	// Optional prewarm: create adapter early so subsequent trading RPCs do not pay cold-start cost.
	if defaultPrewarmOnInit {
		if _, err := s.manager.TradeAdapter(ctx, token, cfg); err != nil {
			_ = s.store.Delete(token)
			return &exchangepb.InitAccountResponse{Success: false, Error: contract.Error("ADAPTER_INIT_ERROR", err.Error())}, nil
		}
	}

	svcLog.Info().
		Str("exchange", string(ex)).
		Str("name", name).
		Str("account_id", accountID).
		Bool("demonet", req.Demonet).
		Msg("account initialized")

	// Auto-subscribe WS user data stream when accountID is provided,
	// so NATS order updates start flowing immediately.
	if accountID != "" {
		go func() {
			_ = s.manager.EnsureWsSubscribed(context.Background(), token, cfg, core.TradeTypeFutures)
		}()
	}

	return &exchangepb.InitAccountResponse{Success: true, Token: token}, nil
}

func (s *ExchangeService) ValidateToken(ctx context.Context, req *exchangepb.ValidateTokenRequest) (*exchangepb.ValidateTokenResponse, error) {
	if req == nil || req.Token == "" {
		return nil, status.Error(codes.InvalidArgument, "token is required")
	}
	cfg, ok := s.store.Validate(req.Token)
	if !ok {
		return &exchangepb.ValidateTokenResponse{Valid: false, Exchange: exchangepb.Exchange_EXCHANGE_UNSPECIFIED}, nil
	}

	// Verify the API key is actually usable by calling a lightweight authenticated endpoint.
	adapter, err := s.manager.TradeAdapter(ctx, req.Token, cfg)
	if err != nil {
		svcLog.Warn().Err(err).Str("token", req.Token).Msg("ValidateToken: failed to create adapter")
		return &exchangepb.ValidateTokenResponse{
			Valid:    false,
			Exchange: contract.CoreExchangeToProto(cfg.Exchange),
			Error:    contract.Error("ADAPTER_ERROR", err.Error()),
		}, nil
	}
	res := adapter.GetBalance(ctx, core.TradeTypeFutures)
	if !res.Ok {
		svcLog.Warn().
			Str("token", req.Token).
			Str("error_code", res.Error.Code).
			Str("error_msg", res.Error.Message).
			Msg("ValidateToken: API key verification failed")
		return &exchangepb.ValidateTokenResponse{
			Valid:    false,
			Exchange: contract.CoreExchangeToProto(cfg.Exchange),
			Error:    contract.Error(res.Error.Code, res.Error.Message),
		}, nil
	}

	return &exchangepb.ValidateTokenResponse{Valid: true, Exchange: contract.CoreExchangeToProto(cfg.Exchange)}, nil
}

func (s *ExchangeService) InvalidateToken(ctx context.Context, req *exchangepb.InvalidateTokenRequest) (*exchangepb.InvalidateTokenResponse, error) {
	if req == nil || req.Token == "" {
		return nil, status.Error(codes.InvalidArgument, "token is required")
	}
	// Idempotent.
	_ = s.store.Delete(req.Token)
	return &exchangepb.InvalidateTokenResponse{Success: true}, nil
}

func (s *ExchangeService) PlaceOrder(ctx context.Context, req *exchangepb.PlaceOrderRequest) (*exchangepb.PlaceOrderResponse, error) {
	if req == nil {
		return &exchangepb.PlaceOrderResponse{Success: false, Error: contract.Error(core.ErrorInvalidParams, "request is nil")}, nil
	}

	cfg, err := s.store.Get(req.Token)
	if err != nil {
		return &exchangepb.PlaceOrderResponse{Success: false, Error: contract.Error(sessionErrorCode(err), err.Error())}, nil
	}

	tradeType, err := contract.ProtoTradeTypeToCoreRequired(req.TradeType)
	if err != nil {
		return &exchangepb.PlaceOrderResponse{Success: false, Error: contract.Error(core.ErrorInvalidParams, err.Error())}, nil
	}
	side, err := contract.ProtoOrderSideToCoreRequired(req.Side)
	if err != nil {
		return &exchangepb.PlaceOrderResponse{Success: false, Error: contract.Error(core.ErrorInvalidParams, err.Error())}, nil
	}
	orderType, err := contract.ProtoOrderTypeToCoreRequired(req.OrderType)
	if err != nil {
		return &exchangepb.PlaceOrderResponse{Success: false, Error: contract.Error(core.ErrorInvalidParams, err.Error())}, nil
	}
	if req.Symbol == "" {
		return &exchangepb.PlaceOrderResponse{Success: false, Error: contract.Error(core.ErrorInvalidParams, "symbol is required")}, nil
	}
	if !(req.Quantity > 0) {
		return &exchangepb.PlaceOrderResponse{Success: false, Error: contract.Error(core.ErrorInvalidParams, "quantity must be > 0")}, nil
	}

	var price *float64
	if req.Price != nil {
		p := req.GetPrice()
		price = &p
	}

	var leverageFloat *float64
	leverageInt := int32(0)
	if req.Leverage != nil {
		leverageInt = req.GetLeverage()
		lv := float64(leverageInt)
		leverageFloat = &lv
	}

	clientOrderID := ""
	if req.ClientOrderId != nil {
		clientOrderID = req.GetClientOrderId()
	}

	reduceOnly := false
	if req.ReduceOnly != nil {
		reduceOnly = req.GetReduceOnly()
	}

	var posSide *core.PositionSide
	if req.PositionSide != nil {
		ps, err := contract.ProtoPositionSideToCore(req.GetPositionSide())
		if err != nil {
			return &exchangepb.PlaceOrderResponse{Success: false, Error: contract.Error(core.ErrorInvalidParams, err.Error())}, nil
		}
		posSide = ps
	}

	adapter, err := s.manager.TradeAdapter(ctx, req.Token, cfg)
	if err != nil {
		return &exchangepb.PlaceOrderResponse{Success: false, Error: contract.Error("ADAPTER_ERROR", err.Error())}, nil
	}

	res := adapter.PlaceOrder(ctx, core.PlaceOrderParams{
		Symbol:        req.Symbol,
		TradeType:     tradeType,
		Side:          side,
		OrderType:     orderType,
		Quantity:      req.Quantity,
		Price:         price,
		PositionSide:  posSide,
		Leverage:      leverageFloat,
		ClientOrderID: clientOrderID,
		ReduceOnly:    reduceOnly,
	})
	if !res.Ok {
		return &exchangepb.PlaceOrderResponse{Success: false, Error: contract.Error(res.Error.Code, res.Error.Message)}, nil
	}

	o := res.Data
	if s.orderIdx != nil {
		s.orderIdx.Upsert(req.Token, o.Symbol, o.TradeType, o.OrderID, o.ClientOrderID)
	}

	if defaultAutoSubscribeOnOrder {
		_ = s.manager.EnsureWsSubscribed(ctx, req.Token, cfg, o.TradeType)
	}

	return &exchangepb.PlaceOrderResponse{Success: true, Order: contract.CoreOrderToProto(o, leverageInt)}, nil
}

func (s *ExchangeService) PlaceOrders(ctx context.Context, req *exchangepb.PlaceOrdersRequest) (*exchangepb.PlaceOrdersResponse, error) {
	if req == nil || req.Token == "" {
		return nil, status.Error(codes.InvalidArgument, "token is required")
	}
	if len(req.Orders) == 0 {
		return nil, status.Error(codes.InvalidArgument, "orders is required")
	}

	cfg, err := s.store.Get(req.Token)
	if err != nil {
		return nil, status.Error(codes.Unauthenticated, "invalid token")
	}

	adapter, err := s.manager.TradeAdapter(ctx, req.Token, cfg)
	if err != nil {
		return nil, status.Error(codes.Internal, err.Error())
	}

	paramsList := make([]core.PlaceOrderParams, 0, len(req.Orders))
	leverageIntByIndex := make([]int32, len(req.Orders))
	for i, oreq := range req.Orders {
		if oreq == nil {
			paramsList = append(paramsList, core.PlaceOrderParams{})
			continue
		}

		tt := contract.ProtoTradeTypeToCoreOptional(oreq.TradeType)
		side := core.OrderSide("")
		if oreq.Side == exchangepb.OrderSide_ORDER_SIDE_BUY {
			side = core.OrderSideBuy
		} else if oreq.Side == exchangepb.OrderSide_ORDER_SIDE_SELL {
			side = core.OrderSideSell
		}
		ot := core.OrderType("")
		if oreq.OrderType == exchangepb.OrderType_ORDER_TYPE_LIMIT {
			ot = core.OrderTypeLimit
		} else if oreq.OrderType == exchangepb.OrderType_ORDER_TYPE_MARKET {
			ot = core.OrderTypeMarket
		} else if oreq.OrderType == exchangepb.OrderType_ORDER_TYPE_MAKER_ONLY {
			ot = core.OrderTypeMakerOnly
		}

		var price *float64
		if oreq.Price != nil {
			p := oreq.GetPrice()
			price = &p
		}

		var leverageFloat *float64
		if oreq.Leverage != nil {
			leverageIntByIndex[i] = oreq.GetLeverage()
			lv := float64(oreq.GetLeverage())
			leverageFloat = &lv
		}

		clientOrderID := ""
		if oreq.ClientOrderId != nil {
			clientOrderID = oreq.GetClientOrderId()
		}

		reduceOnly := false
		if oreq.ReduceOnly != nil {
			reduceOnly = oreq.GetReduceOnly()
		}

		var posSide *core.PositionSide
		if oreq.PositionSide != nil {
			ps, err := contract.ProtoPositionSideToCore(oreq.GetPositionSide())
			if err == nil {
				posSide = ps
			}
		}

		paramsList = append(paramsList, core.PlaceOrderParams{
			Symbol:        oreq.Symbol,
			TradeType:     tt,
			Side:          side,
			OrderType:     ot,
			Quantity:      oreq.Quantity,
			Price:         price,
			PositionSide:  posSide,
			Leverage:      leverageFloat,
			ClientOrderID: clientOrderID,
			ReduceOnly:    reduceOnly,
		})
	}

	batch := adapter.PlaceOrders(ctx, paramsList)
	results := make([]*exchangepb.PlaceOrderResponse, 0, len(batch.Results))

	for i, r := range batch.Results {
		if r.Ok {
			o := r.Data
			if s.orderIdx != nil {
				s.orderIdx.Upsert(req.Token, o.Symbol, o.TradeType, o.OrderID, o.ClientOrderID)
			}
			if defaultAutoSubscribeOnOrder {
				_ = s.manager.EnsureWsSubscribed(ctx, req.Token, cfg, o.TradeType)
			}
			results = append(results, &exchangepb.PlaceOrderResponse{
				Success: true,
				Order:   contract.CoreOrderToProto(o, leverageIntByIndex[i]),
			})
			continue
		}
		code := core.ErrorPlaceOrder
		msg := "unknown error"
		if r.Error != nil {
			code = r.Error.Code
			msg = r.Error.Message
		}
		results = append(results, &exchangepb.PlaceOrderResponse{
			Success: false,
			Error:   contract.Error(code, msg),
		})
	}

	return &exchangepb.PlaceOrdersResponse{
		SuccessCount: int32(batch.SuccessCount),
		FailedCount:  int32(batch.FailedCount),
		Results:      results,
	}, nil
}

func (s *ExchangeService) CancelOrder(ctx context.Context, req *exchangepb.CancelOrderRequest) (*exchangepb.CancelOrderResponse, error) {
	if req == nil {
		return &exchangepb.CancelOrderResponse{Success: false, Error: contract.Error(core.ErrorInvalidParams, "request is nil")}, nil
	}
	if req.Token == "" || req.OrderId == "" {
		return &exchangepb.CancelOrderResponse{Success: false, Error: contract.Error(core.ErrorInvalidParams, "token and order_id are required")}, nil
	}

	cfg, err := s.store.Get(req.Token)
	if err != nil {
		return &exchangepb.CancelOrderResponse{Success: false, Error: contract.Error(sessionErrorCode(err), err.Error())}, nil
	}

	adapter, err := s.manager.TradeAdapter(ctx, req.Token, cfg)
	if err != nil {
		return &exchangepb.CancelOrderResponse{Success: false, Error: contract.Error("ADAPTER_ERROR", err.Error())}, nil
	}

	var (
		ref trading.OrderRef
		ok  bool
	)
	if s.orderIdx != nil {
		ref, ok = s.orderIdx.Resolve(req.Token, req.OrderId)
	}
	if !ok {
		// Fallback: scan open orders (best-effort).
		ordersRes := adapter.GetOpenOrders(ctx, nil, nil)
		if !ordersRes.Ok {
			return &exchangepb.CancelOrderResponse{Success: false, Error: contract.Error(ordersRes.Error.Code, ordersRes.Error.Message)}, nil
		}
		found, ok := findOrderByAnyID(ordersRes.Data, req.OrderId)
		if !ok {
			return &exchangepb.CancelOrderResponse{Success: false, Error: contract.Error(core.ErrorOrderNotFound, "order not found")}, nil
		}
		ref = trading.OrderRef{Symbol: found.Symbol, TradeType: found.TradeType, ExchangeOrderID: found.OrderID}
		if s.orderIdx != nil {
			s.orderIdx.Upsert(req.Token, found.Symbol, found.TradeType, found.OrderID, found.ClientOrderID)
		}
	}
	if ref.ExchangeOrderID == "" {
		return &exchangepb.CancelOrderResponse{Success: false, Error: contract.Error(core.ErrorOrderNotFound, "order cannot be resolved")}, nil
	}

	cancelRes := adapter.CancelOrder(ctx, ref.Symbol, ref.ExchangeOrderID, ref.TradeType)
	if !cancelRes.Ok {
		return &exchangepb.CancelOrderResponse{Success: false, Error: contract.Error(cancelRes.Error.Code, cancelRes.Error.Message)}, nil
	}

	return &exchangepb.CancelOrderResponse{
		Success: true,
		Order:   contract.CoreOrderToProto(cancelRes.Data, 0),
	}, nil
}

func (s *ExchangeService) GetOrder(ctx context.Context, req *exchangepb.GetOrderRequest) (*exchangepb.GetOrderResponse, error) {
	if req == nil {
		return &exchangepb.GetOrderResponse{Error: contract.Error(core.ErrorInvalidParams, "request is nil")}, nil
	}
	if req.Token == "" || req.OrderId == "" {
		return &exchangepb.GetOrderResponse{Error: contract.Error(core.ErrorInvalidParams, "token and order_id are required")}, nil
	}

	cfg, err := s.store.Get(req.Token)
	if err != nil {
		return &exchangepb.GetOrderResponse{Error: contract.Error(sessionErrorCode(err), err.Error())}, nil
	}

	adapter, err := s.manager.TradeAdapter(ctx, req.Token, cfg)
	if err != nil {
		return &exchangepb.GetOrderResponse{Error: contract.Error("ADAPTER_ERROR", err.Error())}, nil
	}

	if s.orderIdx != nil {
		if ref, ok := s.orderIdx.Resolve(req.Token, req.OrderId); ok && ref.ExchangeOrderID != "" {
			res := adapter.GetOrder(ctx, ref.Symbol, ref.ExchangeOrderID, ref.TradeType)
			if res.Ok {
				return &exchangepb.GetOrderResponse{Order: contract.CoreOrderToProto(res.Data, 0)}, nil
			}
			return &exchangepb.GetOrderResponse{Error: contract.Error(res.Error.Code, res.Error.Message)}, nil
		}
	}

	ordersRes := adapter.GetOpenOrders(ctx, nil, nil)
	if !ordersRes.Ok {
		return &exchangepb.GetOrderResponse{Error: contract.Error(ordersRes.Error.Code, ordersRes.Error.Message)}, nil
	}
	found, ok := findOrderByAnyID(ordersRes.Data, req.OrderId)
	if !ok {
		return &exchangepb.GetOrderResponse{Error: contract.Error(core.ErrorOrderNotFound, "order not found")}, nil
	}
	if s.orderIdx != nil {
		s.orderIdx.Upsert(req.Token, found.Symbol, found.TradeType, found.OrderID, found.ClientOrderID)
	}
	return &exchangepb.GetOrderResponse{Order: contract.CoreOrderToProto(found, 0)}, nil
}

func (s *ExchangeService) GetOrders(ctx context.Context, req *exchangepb.GetOrdersRequest) (*exchangepb.GetOrdersResponse, error) {
	if req == nil || req.Token == "" {
		return nil, status.Error(codes.InvalidArgument, "token is required")
	}

	cfg, err := s.store.Get(req.Token)
	if err != nil {
		return nil, status.Error(codes.Unauthenticated, "invalid token")
	}

	adapter, err := s.manager.TradeAdapter(ctx, req.Token, cfg)
	if err != nil {
		return nil, status.Error(codes.Internal, err.Error())
	}

	var symbolPtr *string
	if req.Symbol != nil && req.GetSymbol() != "" {
		sym := req.GetSymbol()
		symbolPtr = &sym
	}

	res := adapter.GetOpenOrders(ctx, symbolPtr, nil)
	if !res.Ok {
		return nil, status.Error(codes.Internal, res.Error.Message)
	}

	var statusFilter core.OrderStatus
	if req.Status != nil {
		statusFilter = contract.ProtoOrderStatusToCoreOptional(req.GetStatus())
	}

	filtered := make([]core.Order, 0, len(res.Data))
	for _, o := range res.Data {
		if statusFilter != "" && o.Status != statusFilter {
			continue
		}
		filtered = append(filtered, o)
	}

	offset := 0
	if req.Offset != nil {
		if req.GetOffset() < 0 {
			return nil, status.Error(codes.InvalidArgument, "offset must be >= 0")
		}
		offset = int(req.GetOffset())
	}
	limit := 100
	if req.Limit != nil {
		if req.GetLimit() < 0 {
			return nil, status.Error(codes.InvalidArgument, "limit must be >= 0")
		}
		limit = int(req.GetLimit())
	}

	total := len(filtered)
	if offset > total {
		offset = total
	}
	end := total
	if limit > 0 && offset+limit < end {
		end = offset + limit
	}
	page := filtered[offset:end]

	out := make([]*exchangepb.Order, 0, len(page))
	for _, o := range page {
		out = append(out, contract.CoreOrderToProto(o, 0))
	}

	return &exchangepb.GetOrdersResponse{Orders: out, Total: int32(total)}, nil
}

func (s *ExchangeService) GetPositions(ctx context.Context, req *exchangepb.GetPositionsRequest) (*exchangepb.GetPositionsResponse, error) {
	if req == nil || req.Token == "" {
		return nil, status.Error(codes.InvalidArgument, "token is required")
	}
	cfg, err := s.store.Get(req.Token)
	if err != nil {
		return nil, status.Error(codes.Unauthenticated, "invalid token")
	}

	adapter, err := s.manager.TradeAdapter(ctx, req.Token, cfg)
	if err != nil {
		return nil, status.Error(codes.Internal, err.Error())
	}

	var symbolPtr *string
	if req.Symbol != nil && req.GetSymbol() != "" {
		sym := req.GetSymbol()
		symbolPtr = &sym
	}

	ttF := core.TradeTypeFutures
	ttD := core.TradeTypeDelivery

	fRes := adapter.GetPositions(ctx, symbolPtr, &ttF)
	dRes := adapter.GetPositions(ctx, symbolPtr, &ttD)

	if !fRes.Ok && !dRes.Ok {
		msg := "get positions failed"
		if fRes.Error != nil {
			msg = fRes.Error.Message
		}
		return nil, status.Error(codes.Internal, msg)
	}

	out := make([]*exchangepb.Position, 0)
	if fRes.Ok {
		for _, p := range fRes.Data {
			out = append(out, contract.CorePositionToProto(p, ttF))
		}
	}
	if dRes.Ok {
		for _, p := range dRes.Data {
			out = append(out, contract.CorePositionToProto(p, ttD))
		}
	}

	return &exchangepb.GetPositionsResponse{Positions: out}, nil
}

func (s *ExchangeService) SyncPositions(ctx context.Context, req *exchangepb.SyncPositionsRequest) (*exchangepb.SyncPositionsResponse, error) {
	if req == nil || req.Token == "" {
		return &exchangepb.SyncPositionsResponse{Success: false, Error: contract.Error(core.ErrorInvalidParams, "token is required")}, nil
	}

	pos, err := s.GetPositions(ctx, &exchangepb.GetPositionsRequest{Token: req.Token})
	if err != nil {
		return &exchangepb.SyncPositionsResponse{Success: false, Error: contract.Error("SYNC_POSITIONS_ERROR", err.Error())}, nil
	}
	return &exchangepb.SyncPositionsResponse{Success: true, Positions: pos.Positions}, nil
}

func (s *ExchangeService) GetBalance(ctx context.Context, req *exchangepb.GetBalanceRequest) (*exchangepb.GetBalanceResponse, error) {
	if req == nil {
		return &exchangepb.GetBalanceResponse{Error: contract.Error(core.ErrorInvalidParams, "request is nil")}, nil
	}
	if req.Token == "" {
		return &exchangepb.GetBalanceResponse{Error: contract.Error(core.ErrorInvalidParams, "token is required")}, nil
	}

	cfg, err := s.store.Get(req.Token)
	if err != nil {
		return &exchangepb.GetBalanceResponse{Error: contract.Error(sessionErrorCode(err), err.Error())}, nil
	}

	tradeType, err := contract.ProtoTradeTypeToCoreRequired(req.TradeType)
	if err != nil {
		return &exchangepb.GetBalanceResponse{Error: contract.Error(core.ErrorInvalidParams, err.Error())}, nil
	}

	adapter, err := s.manager.TradeAdapter(ctx, req.Token, cfg)
	if err != nil {
		return &exchangepb.GetBalanceResponse{Error: contract.Error("ADAPTER_ERROR", err.Error())}, nil
	}

	res := adapter.GetBalance(ctx, tradeType)
	if !res.Ok {
		return &exchangepb.GetBalanceResponse{Error: contract.Error(res.Error.Code, res.Error.Message)}, nil
	}

	out := make([]*exchangepb.Balance, 0, len(res.Data))
	for _, b := range res.Data {
		out = append(out, contract.CoreBalanceToProto(b))
	}
	return &exchangepb.GetBalanceResponse{Balances: out}, nil
}

func (s *ExchangeService) GetPrice(ctx context.Context, req *exchangepb.GetPriceRequest) (*exchangepb.GetPriceResponse, error) {
	if req == nil {
		return &exchangepb.GetPriceResponse{Error: contract.Error(core.ErrorInvalidParams, "request is nil")}, nil
	}
	if req.Token == "" || req.Symbol == "" {
		return &exchangepb.GetPriceResponse{Error: contract.Error(core.ErrorInvalidParams, "token and symbol are required")}, nil
	}

	cfg, err := s.store.Get(req.Token)
	if err != nil {
		return &exchangepb.GetPriceResponse{Error: contract.Error(sessionErrorCode(err), err.Error())}, nil
	}

	tradeType, err := contract.ProtoTradeTypeToCoreRequired(req.TradeType)
	if err != nil {
		return &exchangepb.GetPriceResponse{Error: contract.Error(core.ErrorInvalidParams, err.Error())}, nil
	}

	adapter, err := s.manager.TradeAdapter(ctx, req.Token, cfg)
	if err != nil {
		return &exchangepb.GetPriceResponse{Error: contract.Error("ADAPTER_ERROR", err.Error())}, nil
	}

	res := adapter.GetPrice(ctx, req.Symbol, tradeType)
	if !res.Ok {
		return &exchangepb.GetPriceResponse{Error: contract.Error(res.Error.Code, res.Error.Message)}, nil
	}
	return &exchangepb.GetPriceResponse{Price: res.Data}, nil
}

func (s *ExchangeService) SetLeverage(ctx context.Context, req *exchangepb.SetLeverageRequest) (*exchangepb.SetLeverageResponse, error) {
	if req == nil {
		return &exchangepb.SetLeverageResponse{Success: false, Error: contract.Error(core.ErrorInvalidParams, "request is nil")}, nil
	}
	if req.Token == "" || req.Symbol == "" {
		return &exchangepb.SetLeverageResponse{Success: false, Error: contract.Error(core.ErrorInvalidParams, "token and symbol are required")}, nil
	}
	if req.Leverage <= 0 {
		return &exchangepb.SetLeverageResponse{Success: false, Error: contract.Error(core.ErrorInvalidParams, "leverage must be > 0")}, nil
	}

	cfg, err := s.store.Get(req.Token)
	if err != nil {
		return &exchangepb.SetLeverageResponse{Success: false, Error: contract.Error(sessionErrorCode(err), err.Error())}, nil
	}

	tradeType, err := contract.ProtoTradeTypeToCoreRequired(req.TradeType)
	if err != nil {
		return &exchangepb.SetLeverageResponse{Success: false, Error: contract.Error(core.ErrorInvalidParams, err.Error())}, nil
	}

	var posSide *core.PositionSide
	if req.PositionSide != nil {
		ps, err := contract.ProtoPositionSideToCore(req.GetPositionSide())
		if err != nil {
			return &exchangepb.SetLeverageResponse{Success: false, Error: contract.Error(core.ErrorInvalidParams, err.Error())}, nil
		}
		posSide = ps
	}

	adapter, err := s.manager.TradeAdapter(ctx, req.Token, cfg)
	if err != nil {
		return &exchangepb.SetLeverageResponse{Success: false, Error: contract.Error("ADAPTER_ERROR", err.Error())}, nil
	}

	res := adapter.SetLeverage(ctx, req.Symbol, float64(req.Leverage), tradeType, posSide)
	if !res.Ok {
		return &exchangepb.SetLeverageResponse{Success: false, Error: contract.Error(res.Error.Code, res.Error.Message)}, nil
	}
	return &exchangepb.SetLeverageResponse{Success: true}, nil
}

func (s *ExchangeService) SubscribeOrders(req *exchangepb.SubscribeOrdersRequest, srv exchangepb.ExchangeService_SubscribeOrdersServer) error {
	if req == nil || req.Token == "" {
		return status.Error(codes.InvalidArgument, "token is required")
	}

	cfg, err := s.store.Get(req.Token)
	if err != nil {
		return status.Error(codes.Unauthenticated, "invalid token")
	}

	tradeType, err := contract.ProtoTradeTypeToCoreRequired(req.TradeType)
	if err != nil {
		return status.Error(codes.InvalidArgument, err.Error())
	}

	if err := s.manager.EnsureWsSubscribed(srv.Context(), req.Token, cfg, tradeType); err != nil {
		return status.Error(codes.Internal, err.Error())
	}

	if s.hub == nil {
		return status.Error(codes.Internal, "stream hub not initialized")
	}
	ch, unsubscribe := s.hub.Subscribe(req.Token, tradeType)
	defer func() {
		_ = unsubscribe()
		ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
		defer cancel()
		s.manager.MaybeUnsubscribe(ctx, req.Token, tradeType)
	}()

	for {
		select {
		case <-srv.Context().Done():
			return nil
		case upd, ok := <-ch:
			if !ok {
				return nil
			}
			if err := srv.Send(contract.OrderUpdateToProto(upd)); err != nil {
				return err
			}
		}
	}
}

// ============================================================================
// Strategy Order Handlers
// ============================================================================

func (s *ExchangeService) PlaceStrategyOrder(ctx context.Context, req *exchangepb.PlaceStrategyOrderRequest) (*exchangepb.PlaceStrategyOrderResponse, error) {
	if req == nil {
		return &exchangepb.PlaceStrategyOrderResponse{Success: false, Error: contract.Error(core.ErrorInvalidParams, "request is nil")}, nil
	}

	cfg, err := s.store.Get(req.Token)
	if err != nil {
		return &exchangepb.PlaceStrategyOrderResponse{Success: false, Error: contract.Error(sessionErrorCode(err), err.Error())}, nil
	}

	tradeType, err := contract.ProtoTradeTypeToCoreRequired(req.TradeType)
	if err != nil {
		return &exchangepb.PlaceStrategyOrderResponse{Success: false, Error: contract.Error(core.ErrorInvalidParams, err.Error())}, nil
	}
	side, err := contract.ProtoOrderSideToCoreRequired(req.Side)
	if err != nil {
		return &exchangepb.PlaceStrategyOrderResponse{Success: false, Error: contract.Error(core.ErrorInvalidParams, err.Error())}, nil
	}
	strategyType, err := contract.ProtoStrategyOrderTypeToCoreRequired(req.StrategyType)
	if err != nil {
		return &exchangepb.PlaceStrategyOrderResponse{Success: false, Error: contract.Error(core.ErrorInvalidParams, err.Error())}, nil
	}
	if req.Symbol == "" {
		return &exchangepb.PlaceStrategyOrderResponse{Success: false, Error: contract.Error(core.ErrorInvalidParams, "symbol is required")}, nil
	}
	if !(req.Quantity > 0) {
		return &exchangepb.PlaceStrategyOrderResponse{Success: false, Error: contract.Error(core.ErrorInvalidParams, "quantity must be > 0")}, nil
	}
	if !(req.TriggerPrice > 0) {
		return &exchangepb.PlaceStrategyOrderResponse{Success: false, Error: contract.Error(core.ErrorInvalidParams, "trigger_price must be > 0")}, nil
	}

	var posSide *core.PositionSide
	if req.PositionSide != nil {
		ps, err := contract.ProtoPositionSideToCore(req.GetPositionSide())
		if err != nil {
			return &exchangepb.PlaceStrategyOrderResponse{Success: false, Error: contract.Error(core.ErrorInvalidParams, err.Error())}, nil
		}
		posSide = ps
	}

	var triggerPriceType *core.StrategyTriggerPriceType
	if req.TriggerPriceType != nil {
		triggerPriceType = contract.ProtoStrategyTriggerPriceTypeToCore(req.GetTriggerPriceType())
	}

	var orderPrice *float64
	if req.OrderPrice != nil {
		op := req.GetOrderPrice()
		orderPrice = &op
	}

	reduceOnly := false
	if req.ReduceOnly != nil {
		reduceOnly = req.GetReduceOnly()
	}

	clientAlgoID := ""
	if req.ClientAlgoId != nil {
		clientAlgoID = req.GetClientAlgoId()
	}

	var callbackRatio *float64
	if req.CallbackRatio != nil {
		cr := req.GetCallbackRatio()
		callbackRatio = &cr
	}

	var activationPrice *float64
	if req.ActivationPrice != nil {
		ap := req.GetActivationPrice()
		activationPrice = &ap
	}

	adapter, err := s.manager.TradeAdapter(ctx, req.Token, cfg)
	if err != nil {
		return &exchangepb.PlaceStrategyOrderResponse{Success: false, Error: contract.Error("ADAPTER_ERROR", err.Error())}, nil
	}

	var attachedOrders []core.StrategyAttachedOrder
	if req.SlTriggerPrice != nil || req.TpTriggerPrice != nil {
		attached := core.StrategyAttachedOrder{}
		if req.SlTriggerPrice != nil {
			slp := req.GetSlTriggerPrice()
			attached.SLTriggerPrice = &slp
		}
		if req.TpTriggerPrice != nil {
			tpp := req.GetTpTriggerPrice()
			attached.TPTriggerPrice = &tpp
		}
		attachedOrders = []core.StrategyAttachedOrder{attached}
	}

	res := adapter.PlaceStrategyOrder(ctx, core.StrategyOrderParams{
		Symbol:           req.Symbol,
		TradeType:        tradeType,
		Side:             side,
		StrategyType:     strategyType,
		Quantity:         req.Quantity,
		PositionSide:     posSide,
		TriggerPrice:     req.TriggerPrice,
		TriggerPriceType: triggerPriceType,
		OrderPrice:       orderPrice,
		ReduceOnly:       reduceOnly,
		ClientAlgoID:     clientAlgoID,
		CallbackRatio:    callbackRatio,
		ActivationPrice:  activationPrice,
		AttachedOrders:   attachedOrders,
	})
	if !res.Ok {
		return &exchangepb.PlaceStrategyOrderResponse{Success: false, Error: contract.Error(res.Error.Code, res.Error.Message)}, nil
	}

	return &exchangepb.PlaceStrategyOrderResponse{Success: true, Order: contract.CoreStrategyOrderToProto(res.Data)}, nil
}

func (s *ExchangeService) PlaceStrategyOrders(ctx context.Context, req *exchangepb.PlaceStrategyOrdersRequest) (*exchangepb.PlaceStrategyOrdersResponse, error) {
	if req == nil || req.Token == "" {
		return nil, status.Error(codes.InvalidArgument, "token is required")
	}
	if len(req.Orders) == 0 {
		return nil, status.Error(codes.InvalidArgument, "orders is required")
	}

	cfg, err := s.store.Get(req.Token)
	if err != nil {
		return nil, status.Error(codes.Unauthenticated, "invalid token")
	}

	adapter, err := s.manager.TradeAdapter(ctx, req.Token, cfg)
	if err != nil {
		return nil, status.Error(codes.Internal, err.Error())
	}

	paramsList := make([]core.StrategyOrderParams, 0, len(req.Orders))
	for _, oreq := range req.Orders {
		if oreq == nil {
			paramsList = append(paramsList, core.StrategyOrderParams{})
			continue
		}

		tt := contract.ProtoTradeTypeToCoreOptional(oreq.TradeType)
		side := core.OrderSide("")
		if oreq.Side == exchangepb.OrderSide_ORDER_SIDE_BUY {
			side = core.OrderSideBuy
		} else if oreq.Side == exchangepb.OrderSide_ORDER_SIDE_SELL {
			side = core.OrderSideSell
		}

		st := core.StrategyOrderType("")
		switch oreq.StrategyType {
		case exchangepb.StrategyOrderType_STRATEGY_ORDER_TYPE_STOP_LOSS:
			st = core.StrategyOrderTypeStopLoss
		case exchangepb.StrategyOrderType_STRATEGY_ORDER_TYPE_TAKE_PROFIT:
			st = core.StrategyOrderTypeTakeProfit
		case exchangepb.StrategyOrderType_STRATEGY_ORDER_TYPE_TRIGGER:
			st = core.StrategyOrderTypeTrigger
		case exchangepb.StrategyOrderType_STRATEGY_ORDER_TYPE_TRAILING_STOP:
			st = core.StrategyOrderTypeTrailingStop
		}

		var posSide *core.PositionSide
		if oreq.PositionSide != nil {
			ps, err := contract.ProtoPositionSideToCore(oreq.GetPositionSide())
			if err == nil {
				posSide = ps
			}
		}

		var triggerPriceType *core.StrategyTriggerPriceType
		if oreq.TriggerPriceType != nil {
			triggerPriceType = contract.ProtoStrategyTriggerPriceTypeToCore(oreq.GetTriggerPriceType())
		}

		var orderPrice *float64
		if oreq.OrderPrice != nil {
			op := oreq.GetOrderPrice()
			orderPrice = &op
		}

		reduceOnly := false
		if oreq.ReduceOnly != nil {
			reduceOnly = oreq.GetReduceOnly()
		}

		clientAlgoID := ""
		if oreq.ClientAlgoId != nil {
			clientAlgoID = oreq.GetClientAlgoId()
		}

		var attached []core.StrategyAttachedOrder
		if oreq.SlTriggerPrice != nil || oreq.TpTriggerPrice != nil {
			ao := core.StrategyAttachedOrder{}
			if oreq.SlTriggerPrice != nil {
				slp := oreq.GetSlTriggerPrice()
				ao.SLTriggerPrice = &slp
			}
			if oreq.TpTriggerPrice != nil {
				tpp := oreq.GetTpTriggerPrice()
				ao.TPTriggerPrice = &tpp
			}
			attached = []core.StrategyAttachedOrder{ao}
		}

		paramsList = append(paramsList, core.StrategyOrderParams{
			Symbol:           oreq.Symbol,
			TradeType:        tt,
			Side:             side,
			StrategyType:     st,
			Quantity:         oreq.Quantity,
			PositionSide:     posSide,
			TriggerPrice:     oreq.TriggerPrice,
			TriggerPriceType: triggerPriceType,
			OrderPrice:       orderPrice,
			ReduceOnly:       reduceOnly,
			ClientAlgoID:     clientAlgoID,
			AttachedOrders:   attached,
		})
	}

	batch := adapter.PlaceStrategyOrders(ctx, paramsList)
	results := make([]*exchangepb.PlaceStrategyOrderResponse, 0, len(batch))

	successCount := 0
	failedCount := 0
	for _, r := range batch {
		if r.Ok {
			successCount++
			results = append(results, &exchangepb.PlaceStrategyOrderResponse{
				Success: true,
				Order:   contract.CoreStrategyOrderToProto(r.Data),
			})
		} else {
			failedCount++
			code := core.ErrorPlaceOrder
			msg := "unknown error"
			if r.Error != nil {
				code = r.Error.Code
				msg = r.Error.Message
			}
			results = append(results, &exchangepb.PlaceStrategyOrderResponse{
				Success: false,
				Error:   contract.Error(code, msg),
			})
		}
	}

	return &exchangepb.PlaceStrategyOrdersResponse{
		SuccessCount: int32(successCount),
		FailedCount:  int32(failedCount),
		Results:      results,
	}, nil
}

func (s *ExchangeService) CancelStrategyOrder(ctx context.Context, req *exchangepb.CancelStrategyOrderRequest) (*exchangepb.CancelStrategyOrderResponse, error) {
	if req == nil {
		return &exchangepb.CancelStrategyOrderResponse{Success: false, Error: contract.Error(core.ErrorInvalidParams, "request is nil")}, nil
	}
	if req.Token == "" || req.AlgoId == "" || req.Symbol == "" {
		return &exchangepb.CancelStrategyOrderResponse{Success: false, Error: contract.Error(core.ErrorInvalidParams, "token, symbol, and algo_id are required")}, nil
	}

	cfg, err := s.store.Get(req.Token)
	if err != nil {
		return &exchangepb.CancelStrategyOrderResponse{Success: false, Error: contract.Error(sessionErrorCode(err), err.Error())}, nil
	}

	tradeType, err := contract.ProtoTradeTypeToCoreRequired(req.TradeType)
	if err != nil {
		return &exchangepb.CancelStrategyOrderResponse{Success: false, Error: contract.Error(core.ErrorInvalidParams, err.Error())}, nil
	}

	adapter, err := s.manager.TradeAdapter(ctx, req.Token, cfg)
	if err != nil {
		return &exchangepb.CancelStrategyOrderResponse{Success: false, Error: contract.Error("ADAPTER_ERROR", err.Error())}, nil
	}

	res := adapter.CancelStrategyOrder(ctx, req.Symbol, req.AlgoId, tradeType)
	if !res.Ok {
		// Ignore "not found" errors after cancel: OKX may return empty details for already-cancelled orders.
		// Treat it as a successful cancel with a minimal order stub.
		if res.Error.Code == core.ErrorStrategyOrderNotFound {
			svcLog.Warn().
				Str("algo_id", req.AlgoId).
				Str("symbol", req.Symbol).
				Msg("CancelStrategyOrder: order not found after cancel, treating as success")
			return &exchangepb.CancelStrategyOrderResponse{Success: true}, nil
		}
		return &exchangepb.CancelStrategyOrderResponse{Success: false, Error: contract.Error(res.Error.Code, res.Error.Message)}, nil
	}

	return &exchangepb.CancelStrategyOrderResponse{Success: true, Order: contract.CoreStrategyOrderToProto(res.Data)}, nil
}

func (s *ExchangeService) GetStrategyOrder(ctx context.Context, req *exchangepb.GetStrategyOrderRequest) (*exchangepb.GetStrategyOrderResponse, error) {
	if req == nil {
		return &exchangepb.GetStrategyOrderResponse{Error: contract.Error(core.ErrorInvalidParams, "request is nil")}, nil
	}
	if req.Token == "" || req.AlgoId == "" {
		return &exchangepb.GetStrategyOrderResponse{Error: contract.Error(core.ErrorInvalidParams, "token and algo_id are required")}, nil
	}

	cfg, err := s.store.Get(req.Token)
	if err != nil {
		return &exchangepb.GetStrategyOrderResponse{Error: contract.Error(sessionErrorCode(err), err.Error())}, nil
	}

	tradeType, err := contract.ProtoTradeTypeToCoreRequired(req.TradeType)
	if err != nil {
		return &exchangepb.GetStrategyOrderResponse{Error: contract.Error(core.ErrorInvalidParams, err.Error())}, nil
	}

	adapter, err := s.manager.TradeAdapter(ctx, req.Token, cfg)
	if err != nil {
		return &exchangepb.GetStrategyOrderResponse{Error: contract.Error("ADAPTER_ERROR", err.Error())}, nil
	}

	res := adapter.GetStrategyOrder(ctx, req.AlgoId, tradeType)
	if !res.Ok {
		return &exchangepb.GetStrategyOrderResponse{Error: contract.Error(res.Error.Code, res.Error.Message)}, nil
	}

	return &exchangepb.GetStrategyOrderResponse{Order: contract.CoreStrategyOrderToProto(res.Data)}, nil
}

func (s *ExchangeService) GetOpenStrategyOrders(ctx context.Context, req *exchangepb.GetOpenStrategyOrdersRequest) (*exchangepb.GetOpenStrategyOrdersResponse, error) {
	if req == nil || req.Token == "" {
		return nil, status.Error(codes.InvalidArgument, "token is required")
	}

	cfg, err := s.store.Get(req.Token)
	if err != nil {
		return nil, status.Error(codes.Unauthenticated, "invalid token")
	}

	adapter, err := s.manager.TradeAdapter(ctx, req.Token, cfg)
	if err != nil {
		return nil, status.Error(codes.Internal, err.Error())
	}

	var symbolPtr *string
	if req.Symbol != nil && req.GetSymbol() != "" {
		sym := req.GetSymbol()
		symbolPtr = &sym
	}

	var tradeTypePtr *core.TradeType
	if req.TradeType != nil {
		tt := contract.ProtoTradeTypeToCoreOptional(req.GetTradeType())
		if tt != "" {
			tradeTypePtr = &tt
		}
	}

	res := adapter.GetOpenStrategyOrders(ctx, symbolPtr, tradeTypePtr)
	if !res.Ok {
		return &exchangepb.GetOpenStrategyOrdersResponse{Error: contract.Error(res.Error.Code, res.Error.Message)}, nil
	}

	out := make([]*exchangepb.StrategyOrder, 0, len(res.Data))
	for _, o := range res.Data {
		out = append(out, contract.CoreStrategyOrderToProto(o))
	}

	return &exchangepb.GetOpenStrategyOrdersResponse{Orders: out}, nil
}

func findOrderByAnyID(orders []core.Order, anyID string) (core.Order, bool) {
	for _, o := range orders {
		if o.OrderID == anyID || o.ClientOrderID == anyID {
			return o, true
		}
	}
	return core.Order{}, false
}

func sessionErrorCode(err error) string {
	if session.IsErrorCode(err, session.ErrCodeTokenNotFound) {
		return session.ErrCodeTokenNotFound
	}
	if session.IsErrorCode(err, session.ErrCodeTokenExpired) {
		return session.ErrCodeTokenExpired
	}
	return "SESSION_ERROR"
}
