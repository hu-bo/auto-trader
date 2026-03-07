import { BinaryReader, BinaryWriter } from "@bufbuild/protobuf/wire";
import type { CallContext, CallOptions } from "nice-grpc-common";
export declare const protobufPackage = "exchange";
export declare enum Exchange {
    EXCHANGE_UNSPECIFIED = 0,
    EXCHANGE_OKX = 1,
    EXCHANGE_BINANCE = 2,
    UNRECOGNIZED = -1
}
export declare function exchangeFromJSON(object: any): Exchange;
export declare function exchangeToJSON(object: Exchange): string;
export declare enum TradeType {
    TRADE_TYPE_UNSPECIFIED = 0,
    TRADE_TYPE_SPOT = 1,
    TRADE_TYPE_FUTURES = 2,
    TRADE_TYPE_DELIVERY = 3,
    UNRECOGNIZED = -1
}
export declare function tradeTypeFromJSON(object: any): TradeType;
export declare function tradeTypeToJSON(object: TradeType): string;
export declare enum OrderSide {
    ORDER_SIDE_UNSPECIFIED = 0,
    ORDER_SIDE_BUY = 1,
    ORDER_SIDE_SELL = 2,
    UNRECOGNIZED = -1
}
export declare function orderSideFromJSON(object: any): OrderSide;
export declare function orderSideToJSON(object: OrderSide): string;
export declare enum PositionSide {
    POSITION_SIDE_UNSPECIFIED = 0,
    POSITION_SIDE_LONG = 1,
    POSITION_SIDE_SHORT = 2,
    UNRECOGNIZED = -1
}
export declare function positionSideFromJSON(object: any): PositionSide;
export declare function positionSideToJSON(object: PositionSide): string;
export declare enum OrderType {
    ORDER_TYPE_UNSPECIFIED = 0,
    ORDER_TYPE_LIMIT = 1,
    ORDER_TYPE_MARKET = 2,
    ORDER_TYPE_MAKER_ONLY = 3,
    UNRECOGNIZED = -1
}
export declare function orderTypeFromJSON(object: any): OrderType;
export declare function orderTypeToJSON(object: OrderType): string;
export declare enum OrderStatus {
    ORDER_STATUS_UNSPECIFIED = 0,
    ORDER_STATUS_PENDING = 1,
    ORDER_STATUS_OPEN = 2,
    ORDER_STATUS_PARTIAL = 3,
    ORDER_STATUS_FILLED = 4,
    ORDER_STATUS_CANCELED = 5,
    ORDER_STATUS_REJECTED = 6,
    ORDER_STATUS_EXPIRED = 7,
    UNRECOGNIZED = -1
}
export declare function orderStatusFromJSON(object: any): OrderStatus;
export declare function orderStatusToJSON(object: OrderStatus): string;
export declare enum StrategyOrderType {
    STRATEGY_ORDER_TYPE_UNSPECIFIED = 0,
    STRATEGY_ORDER_TYPE_STOP_LOSS = 1,
    STRATEGY_ORDER_TYPE_TAKE_PROFIT = 2,
    STRATEGY_ORDER_TYPE_TRIGGER = 3,
    STRATEGY_ORDER_TYPE_TRAILING_STOP = 4,
    UNRECOGNIZED = -1
}
export declare function strategyOrderTypeFromJSON(object: any): StrategyOrderType;
export declare function strategyOrderTypeToJSON(object: StrategyOrderType): string;
export declare enum StrategyTriggerPriceType {
    STRATEGY_TRIGGER_PRICE_TYPE_UNSPECIFIED = 0,
    STRATEGY_TRIGGER_PRICE_TYPE_LAST = 1,
    STRATEGY_TRIGGER_PRICE_TYPE_MARK = 2,
    STRATEGY_TRIGGER_PRICE_TYPE_INDEX = 3,
    UNRECOGNIZED = -1
}
export declare function strategyTriggerPriceTypeFromJSON(object: any): StrategyTriggerPriceType;
export declare function strategyTriggerPriceTypeToJSON(object: StrategyTriggerPriceType): string;
export declare enum StrategyAttachedOrderType {
    STRATEGY_ATTACHED_ORDER_TYPE_UNSPECIFIED = 0,
    STRATEGY_ATTACHED_ORDER_TYPE_TAKE_PROFIT = 1,
    STRATEGY_ATTACHED_ORDER_TYPE_STOP_LOSS = 2,
    UNRECOGNIZED = -1
}
export declare function strategyAttachedOrderTypeFromJSON(object: any): StrategyAttachedOrderType;
export declare function strategyAttachedOrderTypeToJSON(object: StrategyAttachedOrderType): string;
export declare enum StrategyOrderStatus {
    STRATEGY_ORDER_STATUS_UNSPECIFIED = 0,
    STRATEGY_ORDER_STATUS_LIVE = 1,
    STRATEGY_ORDER_STATUS_EFFECTIVE = 2,
    STRATEGY_ORDER_STATUS_CANCELED = 3,
    STRATEGY_ORDER_STATUS_FAILED = 4,
    STRATEGY_ORDER_STATUS_PARTIALLY_EFFECTIVE = 5,
    UNRECOGNIZED = -1
}
export declare function strategyOrderStatusFromJSON(object: any): StrategyOrderStatus;
export declare function strategyOrderStatusToJSON(object: StrategyOrderStatus): string;
export interface Error {
    code: string;
    message: string;
}
export interface InitAccountRequest {
    exchange: Exchange;
    apiKey: string;
    apiSecret: string;
    /** OKX only */
    passphrase?: string | undefined;
    demonet: boolean;
    name?: string | undefined;
    /** DB exchangeId, used as NATS routing key */
    accountId?: string | undefined;
}
export interface InitAccountResponse {
    success: boolean;
    token: string;
    error: Error | undefined;
}
export interface ValidateTokenRequest {
    token: string;
}
export interface ValidateTokenResponse {
    valid: boolean;
    exchange: Exchange;
    error: Error | undefined;
}
export interface InvalidateTokenRequest {
    token: string;
}
export interface InvalidateTokenResponse {
    success: boolean;
}
export interface PlaceOrderRequest {
    token: string;
    symbol: string;
    tradeType: TradeType;
    side: OrderSide;
    orderType: OrderType;
    quantity: number;
    price?: number | undefined;
    positionSide?: PositionSide | undefined;
    leverage?: number | undefined;
    clientOrderId?: string | undefined;
    reduceOnly?: boolean | undefined;
}
export interface PlaceOrderResponse {
    success: boolean;
    order: Order | undefined;
    error: Error | undefined;
}
export interface PlaceOrdersRequest {
    token: string;
    orders: PlaceOrderRequest[];
}
export interface PlaceOrdersResponse {
    successCount: number;
    failedCount: number;
    results: PlaceOrderResponse[];
}
export interface CancelOrderRequest {
    token: string;
    orderId: string;
}
export interface CancelOrderResponse {
    success: boolean;
    order: Order | undefined;
    error: Error | undefined;
}
export interface GetOrderRequest {
    token: string;
    orderId: string;
}
export interface GetOrderResponse {
    order: Order | undefined;
    error: Error | undefined;
}
export interface GetOrdersRequest {
    token: string;
    symbol?: string | undefined;
    status?: OrderStatus | undefined;
    limit?: number | undefined;
    offset?: number | undefined;
}
export interface GetOrdersResponse {
    orders: Order[];
    total: number;
}
export interface Order {
    id: string;
    exchangeOrderId: string;
    clientOrderId: string;
    symbol: string;
    tradeType: TradeType;
    side: OrderSide;
    positionSide: PositionSide;
    orderType: OrderType;
    status: OrderStatus;
    quantity: string;
    price: string;
    filledQty: string;
    avgPrice: string;
    fee: string;
    feeAsset: string;
    leverage: number;
    reduceOnly: boolean;
    createdAt: number;
    updatedAt: number;
    filledAt: number;
}
export interface GetPositionsRequest {
    token: string;
    symbol?: string | undefined;
}
export interface GetPositionsResponse {
    positions: Position[];
}
export interface SyncPositionsRequest {
    token: string;
}
export interface SyncPositionsResponse {
    success: boolean;
    positions: Position[];
    error: Error | undefined;
}
export interface Position {
    id: string;
    symbol: string;
    tradeType: TradeType;
    positionSide: PositionSide;
    positionAmt: string;
    entryPrice: string;
    markPrice: string;
    unrealizedPnl: string;
    realizedPnl: string;
    leverage: number;
    marginMode: string;
    liquidationPrice: string;
    margin: string;
    lastSyncAt: number;
}
export interface GetBalanceRequest {
    token: string;
    tradeType: TradeType;
}
export interface GetBalanceResponse {
    balances: Balance[];
    error: Error | undefined;
}
export interface Balance {
    asset: string;
    free: string;
    locked: string;
    total: string;
    unrealizedPnl: string;
    marginBalance: string;
}
export interface GetPriceRequest {
    token: string;
    symbol: string;
    tradeType: TradeType;
}
export interface GetPriceResponse {
    price: string;
    error: Error | undefined;
}
export interface SetLeverageRequest {
    token: string;
    symbol: string;
    leverage: number;
    tradeType: TradeType;
    positionSide?: PositionSide | undefined;
}
export interface SetLeverageResponse {
    success: boolean;
    error: Error | undefined;
}
export interface StrategyAttachedOrder {
    type: StrategyAttachedOrderType;
    triggerPrice: number;
    orderPrice?: number | undefined;
    triggerPriceType?: StrategyTriggerPriceType | undefined;
}
export interface PlaceStrategyOrderRequest {
    token: string;
    symbol: string;
    tradeType: TradeType;
    side: OrderSide;
    strategyType: StrategyOrderType;
    quantity: number;
    triggerPrice: number;
    positionSide?: PositionSide | undefined;
    triggerPriceType?: StrategyTriggerPriceType | undefined;
    orderPrice?: number | undefined;
    reduceOnly?: boolean | undefined;
    clientAlgoId?: string | undefined;
    callbackRatio?: number | undefined;
    activationPrice?: number | undefined;
    slTriggerPrice?: number | undefined;
    tpTriggerPrice?: number | undefined;
    attachedOrders: StrategyAttachedOrder[];
}
export interface PlaceStrategyOrderResponse {
    success: boolean;
    order: StrategyOrder | undefined;
    error: Error | undefined;
}
export interface PlaceStrategyOrdersRequest {
    token: string;
    orders: PlaceStrategyOrderRequest[];
}
export interface PlaceStrategyOrdersResponse {
    successCount: number;
    failedCount: number;
    results: PlaceStrategyOrderResponse[];
}
export interface CancelStrategyOrderRequest {
    token: string;
    symbol: string;
    algoId: string;
    tradeType: TradeType;
}
export interface CancelStrategyOrderResponse {
    success: boolean;
    order: StrategyOrder | undefined;
    error: Error | undefined;
}
export interface GetStrategyOrderRequest {
    token: string;
    algoId: string;
    tradeType: TradeType;
}
export interface GetStrategyOrderResponse {
    order: StrategyOrder | undefined;
    error: Error | undefined;
}
export interface GetOpenStrategyOrdersRequest {
    token: string;
    symbol?: string | undefined;
    tradeType?: TradeType | undefined;
}
export interface GetOpenStrategyOrdersResponse {
    orders: StrategyOrder[];
    error: Error | undefined;
}
export interface StrategyOrder {
    algoId: string;
    clientAlgoId: string;
    symbol: string;
    tradeType: TradeType;
    side: OrderSide;
    positionSide: PositionSide;
    strategyType: StrategyOrderType;
    status: StrategyOrderStatus;
    triggerPrice: string;
    triggerPriceType: string;
    orderPrice: string;
    quantity: string;
    tpTriggerPrice: string;
    tpOrderPrice: string;
    slTriggerPrice: string;
    slOrderPrice: string;
    createdAt: number;
    updatedAt: number;
    triggeredAt: number;
}
export interface SubscribeOrdersRequest {
    token: string;
    tradeType: TradeType;
}
export interface OrderUpdate {
    orderId: string;
    clientOrderId: string;
    symbol: string;
    tradeType: TradeType;
    side: OrderSide;
    positionSide: PositionSide;
    orderType: OrderType;
    status: OrderStatus;
    price: string;
    quantity: string;
    filledQuantity: string;
    avgPrice: string;
    fee: string;
    feeAsset: string;
    updateTime: number;
}
export declare const Error: MessageFns<Error>;
export declare const InitAccountRequest: MessageFns<InitAccountRequest>;
export declare const InitAccountResponse: MessageFns<InitAccountResponse>;
export declare const ValidateTokenRequest: MessageFns<ValidateTokenRequest>;
export declare const ValidateTokenResponse: MessageFns<ValidateTokenResponse>;
export declare const InvalidateTokenRequest: MessageFns<InvalidateTokenRequest>;
export declare const InvalidateTokenResponse: MessageFns<InvalidateTokenResponse>;
export declare const PlaceOrderRequest: MessageFns<PlaceOrderRequest>;
export declare const PlaceOrderResponse: MessageFns<PlaceOrderResponse>;
export declare const PlaceOrdersRequest: MessageFns<PlaceOrdersRequest>;
export declare const PlaceOrdersResponse: MessageFns<PlaceOrdersResponse>;
export declare const CancelOrderRequest: MessageFns<CancelOrderRequest>;
export declare const CancelOrderResponse: MessageFns<CancelOrderResponse>;
export declare const GetOrderRequest: MessageFns<GetOrderRequest>;
export declare const GetOrderResponse: MessageFns<GetOrderResponse>;
export declare const GetOrdersRequest: MessageFns<GetOrdersRequest>;
export declare const GetOrdersResponse: MessageFns<GetOrdersResponse>;
export declare const Order: MessageFns<Order>;
export declare const GetPositionsRequest: MessageFns<GetPositionsRequest>;
export declare const GetPositionsResponse: MessageFns<GetPositionsResponse>;
export declare const SyncPositionsRequest: MessageFns<SyncPositionsRequest>;
export declare const SyncPositionsResponse: MessageFns<SyncPositionsResponse>;
export declare const Position: MessageFns<Position>;
export declare const GetBalanceRequest: MessageFns<GetBalanceRequest>;
export declare const GetBalanceResponse: MessageFns<GetBalanceResponse>;
export declare const Balance: MessageFns<Balance>;
export declare const GetPriceRequest: MessageFns<GetPriceRequest>;
export declare const GetPriceResponse: MessageFns<GetPriceResponse>;
export declare const SetLeverageRequest: MessageFns<SetLeverageRequest>;
export declare const SetLeverageResponse: MessageFns<SetLeverageResponse>;
export declare const StrategyAttachedOrder: MessageFns<StrategyAttachedOrder>;
export declare const PlaceStrategyOrderRequest: MessageFns<PlaceStrategyOrderRequest>;
export declare const PlaceStrategyOrderResponse: MessageFns<PlaceStrategyOrderResponse>;
export declare const PlaceStrategyOrdersRequest: MessageFns<PlaceStrategyOrdersRequest>;
export declare const PlaceStrategyOrdersResponse: MessageFns<PlaceStrategyOrdersResponse>;
export declare const CancelStrategyOrderRequest: MessageFns<CancelStrategyOrderRequest>;
export declare const CancelStrategyOrderResponse: MessageFns<CancelStrategyOrderResponse>;
export declare const GetStrategyOrderRequest: MessageFns<GetStrategyOrderRequest>;
export declare const GetStrategyOrderResponse: MessageFns<GetStrategyOrderResponse>;
export declare const GetOpenStrategyOrdersRequest: MessageFns<GetOpenStrategyOrdersRequest>;
export declare const GetOpenStrategyOrdersResponse: MessageFns<GetOpenStrategyOrdersResponse>;
export declare const StrategyOrder: MessageFns<StrategyOrder>;
export declare const SubscribeOrdersRequest: MessageFns<SubscribeOrdersRequest>;
export declare const OrderUpdate: MessageFns<OrderUpdate>;
/** Exchange Service - 交易下单服务 */
export type ExchangeServiceDefinition = typeof ExchangeServiceDefinition;
export declare const ExchangeServiceDefinition: {
    readonly name: "ExchangeService";
    readonly fullName: "exchange.ExchangeService";
    readonly methods: {
        /** 初始化账户并返回 Token */
        readonly initAccount: {
            readonly name: "InitAccount";
            readonly requestType: MessageFns<InitAccountRequest>;
            readonly requestStream: false;
            readonly responseType: MessageFns<InitAccountResponse>;
            readonly responseStream: false;
            readonly options: {};
        };
        /** 验证 Token */
        readonly validateToken: {
            readonly name: "ValidateToken";
            readonly requestType: MessageFns<ValidateTokenRequest>;
            readonly requestStream: false;
            readonly responseType: MessageFns<ValidateTokenResponse>;
            readonly responseStream: false;
            readonly options: {};
        };
        /** 注销账户 */
        readonly invalidateToken: {
            readonly name: "InvalidateToken";
            readonly requestType: MessageFns<InvalidateTokenRequest>;
            readonly requestStream: false;
            readonly responseType: MessageFns<InvalidateTokenResponse>;
            readonly responseStream: false;
            readonly options: {};
        };
        /** 下单 */
        readonly placeOrder: {
            readonly name: "PlaceOrder";
            readonly requestType: MessageFns<PlaceOrderRequest>;
            readonly requestStream: false;
            readonly responseType: MessageFns<PlaceOrderResponse>;
            readonly responseStream: false;
            readonly options: {};
        };
        /** 批量下单 */
        readonly placeOrders: {
            readonly name: "PlaceOrders";
            readonly requestType: MessageFns<PlaceOrdersRequest>;
            readonly requestStream: false;
            readonly responseType: MessageFns<PlaceOrdersResponse>;
            readonly responseStream: false;
            readonly options: {};
        };
        /** 撤单 */
        readonly cancelOrder: {
            readonly name: "CancelOrder";
            readonly requestType: MessageFns<CancelOrderRequest>;
            readonly requestStream: false;
            readonly responseType: MessageFns<CancelOrderResponse>;
            readonly responseStream: false;
            readonly options: {};
        };
        /** 查询订单 */
        readonly getOrder: {
            readonly name: "GetOrder";
            readonly requestType: MessageFns<GetOrderRequest>;
            readonly requestStream: false;
            readonly responseType: MessageFns<GetOrderResponse>;
            readonly responseStream: false;
            readonly options: {};
        };
        /** 查询订单列表 */
        readonly getOrders: {
            readonly name: "GetOrders";
            readonly requestType: MessageFns<GetOrdersRequest>;
            readonly requestStream: false;
            readonly responseType: MessageFns<GetOrdersResponse>;
            readonly responseStream: false;
            readonly options: {};
        };
        /** 获取持仓 */
        readonly getPositions: {
            readonly name: "GetPositions";
            readonly requestType: MessageFns<GetPositionsRequest>;
            readonly requestStream: false;
            readonly responseType: MessageFns<GetPositionsResponse>;
            readonly responseStream: false;
            readonly options: {};
        };
        /** 同步持仓 */
        readonly syncPositions: {
            readonly name: "SyncPositions";
            readonly requestType: MessageFns<SyncPositionsRequest>;
            readonly requestStream: false;
            readonly responseType: MessageFns<SyncPositionsResponse>;
            readonly responseStream: false;
            readonly options: {};
        };
        /** 获取余额 */
        readonly getBalance: {
            readonly name: "GetBalance";
            readonly requestType: MessageFns<GetBalanceRequest>;
            readonly requestStream: false;
            readonly responseType: MessageFns<GetBalanceResponse>;
            readonly responseStream: false;
            readonly options: {};
        };
        /** 获取行情 */
        readonly getPrice: {
            readonly name: "GetPrice";
            readonly requestType: MessageFns<GetPriceRequest>;
            readonly requestStream: false;
            readonly responseType: MessageFns<GetPriceResponse>;
            readonly responseStream: false;
            readonly options: {};
        };
        /** 设置杠杆 */
        readonly setLeverage: {
            readonly name: "SetLeverage";
            readonly requestType: MessageFns<SetLeverageRequest>;
            readonly requestStream: false;
            readonly responseType: MessageFns<SetLeverageResponse>;
            readonly responseStream: false;
            readonly options: {};
        };
        /** 订单更新流 */
        readonly subscribeOrders: {
            readonly name: "SubscribeOrders";
            readonly requestType: MessageFns<SubscribeOrdersRequest>;
            readonly requestStream: false;
            readonly responseType: MessageFns<OrderUpdate>;
            readonly responseStream: true;
            readonly options: {};
        };
        /** 策略订单（条件单） */
        readonly placeStrategyOrder: {
            readonly name: "PlaceStrategyOrder";
            readonly requestType: MessageFns<PlaceStrategyOrderRequest>;
            readonly requestStream: false;
            readonly responseType: MessageFns<PlaceStrategyOrderResponse>;
            readonly responseStream: false;
            readonly options: {};
        };
        readonly placeStrategyOrders: {
            readonly name: "PlaceStrategyOrders";
            readonly requestType: MessageFns<PlaceStrategyOrdersRequest>;
            readonly requestStream: false;
            readonly responseType: MessageFns<PlaceStrategyOrdersResponse>;
            readonly responseStream: false;
            readonly options: {};
        };
        readonly cancelStrategyOrder: {
            readonly name: "CancelStrategyOrder";
            readonly requestType: MessageFns<CancelStrategyOrderRequest>;
            readonly requestStream: false;
            readonly responseType: MessageFns<CancelStrategyOrderResponse>;
            readonly responseStream: false;
            readonly options: {};
        };
        readonly getStrategyOrder: {
            readonly name: "GetStrategyOrder";
            readonly requestType: MessageFns<GetStrategyOrderRequest>;
            readonly requestStream: false;
            readonly responseType: MessageFns<GetStrategyOrderResponse>;
            readonly responseStream: false;
            readonly options: {};
        };
        readonly getOpenStrategyOrders: {
            readonly name: "GetOpenStrategyOrders";
            readonly requestType: MessageFns<GetOpenStrategyOrdersRequest>;
            readonly requestStream: false;
            readonly responseType: MessageFns<GetOpenStrategyOrdersResponse>;
            readonly responseStream: false;
            readonly options: {};
        };
    };
};
export interface ExchangeServiceImplementation<CallContextExt = {}> {
    /** 初始化账户并返回 Token */
    initAccount(request: InitAccountRequest, context: CallContext & CallContextExt): Promise<DeepPartial<InitAccountResponse>>;
    /** 验证 Token */
    validateToken(request: ValidateTokenRequest, context: CallContext & CallContextExt): Promise<DeepPartial<ValidateTokenResponse>>;
    /** 注销账户 */
    invalidateToken(request: InvalidateTokenRequest, context: CallContext & CallContextExt): Promise<DeepPartial<InvalidateTokenResponse>>;
    /** 下单 */
    placeOrder(request: PlaceOrderRequest, context: CallContext & CallContextExt): Promise<DeepPartial<PlaceOrderResponse>>;
    /** 批量下单 */
    placeOrders(request: PlaceOrdersRequest, context: CallContext & CallContextExt): Promise<DeepPartial<PlaceOrdersResponse>>;
    /** 撤单 */
    cancelOrder(request: CancelOrderRequest, context: CallContext & CallContextExt): Promise<DeepPartial<CancelOrderResponse>>;
    /** 查询订单 */
    getOrder(request: GetOrderRequest, context: CallContext & CallContextExt): Promise<DeepPartial<GetOrderResponse>>;
    /** 查询订单列表 */
    getOrders(request: GetOrdersRequest, context: CallContext & CallContextExt): Promise<DeepPartial<GetOrdersResponse>>;
    /** 获取持仓 */
    getPositions(request: GetPositionsRequest, context: CallContext & CallContextExt): Promise<DeepPartial<GetPositionsResponse>>;
    /** 同步持仓 */
    syncPositions(request: SyncPositionsRequest, context: CallContext & CallContextExt): Promise<DeepPartial<SyncPositionsResponse>>;
    /** 获取余额 */
    getBalance(request: GetBalanceRequest, context: CallContext & CallContextExt): Promise<DeepPartial<GetBalanceResponse>>;
    /** 获取行情 */
    getPrice(request: GetPriceRequest, context: CallContext & CallContextExt): Promise<DeepPartial<GetPriceResponse>>;
    /** 设置杠杆 */
    setLeverage(request: SetLeverageRequest, context: CallContext & CallContextExt): Promise<DeepPartial<SetLeverageResponse>>;
    /** 订单更新流 */
    subscribeOrders(request: SubscribeOrdersRequest, context: CallContext & CallContextExt): ServerStreamingMethodResult<DeepPartial<OrderUpdate>>;
    /** 策略订单（条件单） */
    placeStrategyOrder(request: PlaceStrategyOrderRequest, context: CallContext & CallContextExt): Promise<DeepPartial<PlaceStrategyOrderResponse>>;
    placeStrategyOrders(request: PlaceStrategyOrdersRequest, context: CallContext & CallContextExt): Promise<DeepPartial<PlaceStrategyOrdersResponse>>;
    cancelStrategyOrder(request: CancelStrategyOrderRequest, context: CallContext & CallContextExt): Promise<DeepPartial<CancelStrategyOrderResponse>>;
    getStrategyOrder(request: GetStrategyOrderRequest, context: CallContext & CallContextExt): Promise<DeepPartial<GetStrategyOrderResponse>>;
    getOpenStrategyOrders(request: GetOpenStrategyOrdersRequest, context: CallContext & CallContextExt): Promise<DeepPartial<GetOpenStrategyOrdersResponse>>;
}
export interface ExchangeServiceClient<CallOptionsExt = {}> {
    /** 初始化账户并返回 Token */
    initAccount(request: DeepPartial<InitAccountRequest>, options?: CallOptions & CallOptionsExt): Promise<InitAccountResponse>;
    /** 验证 Token */
    validateToken(request: DeepPartial<ValidateTokenRequest>, options?: CallOptions & CallOptionsExt): Promise<ValidateTokenResponse>;
    /** 注销账户 */
    invalidateToken(request: DeepPartial<InvalidateTokenRequest>, options?: CallOptions & CallOptionsExt): Promise<InvalidateTokenResponse>;
    /** 下单 */
    placeOrder(request: DeepPartial<PlaceOrderRequest>, options?: CallOptions & CallOptionsExt): Promise<PlaceOrderResponse>;
    /** 批量下单 */
    placeOrders(request: DeepPartial<PlaceOrdersRequest>, options?: CallOptions & CallOptionsExt): Promise<PlaceOrdersResponse>;
    /** 撤单 */
    cancelOrder(request: DeepPartial<CancelOrderRequest>, options?: CallOptions & CallOptionsExt): Promise<CancelOrderResponse>;
    /** 查询订单 */
    getOrder(request: DeepPartial<GetOrderRequest>, options?: CallOptions & CallOptionsExt): Promise<GetOrderResponse>;
    /** 查询订单列表 */
    getOrders(request: DeepPartial<GetOrdersRequest>, options?: CallOptions & CallOptionsExt): Promise<GetOrdersResponse>;
    /** 获取持仓 */
    getPositions(request: DeepPartial<GetPositionsRequest>, options?: CallOptions & CallOptionsExt): Promise<GetPositionsResponse>;
    /** 同步持仓 */
    syncPositions(request: DeepPartial<SyncPositionsRequest>, options?: CallOptions & CallOptionsExt): Promise<SyncPositionsResponse>;
    /** 获取余额 */
    getBalance(request: DeepPartial<GetBalanceRequest>, options?: CallOptions & CallOptionsExt): Promise<GetBalanceResponse>;
    /** 获取行情 */
    getPrice(request: DeepPartial<GetPriceRequest>, options?: CallOptions & CallOptionsExt): Promise<GetPriceResponse>;
    /** 设置杠杆 */
    setLeverage(request: DeepPartial<SetLeverageRequest>, options?: CallOptions & CallOptionsExt): Promise<SetLeverageResponse>;
    /** 订单更新流 */
    subscribeOrders(request: DeepPartial<SubscribeOrdersRequest>, options?: CallOptions & CallOptionsExt): AsyncIterable<OrderUpdate>;
    /** 策略订单（条件单） */
    placeStrategyOrder(request: DeepPartial<PlaceStrategyOrderRequest>, options?: CallOptions & CallOptionsExt): Promise<PlaceStrategyOrderResponse>;
    placeStrategyOrders(request: DeepPartial<PlaceStrategyOrdersRequest>, options?: CallOptions & CallOptionsExt): Promise<PlaceStrategyOrdersResponse>;
    cancelStrategyOrder(request: DeepPartial<CancelStrategyOrderRequest>, options?: CallOptions & CallOptionsExt): Promise<CancelStrategyOrderResponse>;
    getStrategyOrder(request: DeepPartial<GetStrategyOrderRequest>, options?: CallOptions & CallOptionsExt): Promise<GetStrategyOrderResponse>;
    getOpenStrategyOrders(request: DeepPartial<GetOpenStrategyOrdersRequest>, options?: CallOptions & CallOptionsExt): Promise<GetOpenStrategyOrdersResponse>;
}
type Builtin = Date | Function | Uint8Array | string | number | boolean | undefined;
export type DeepPartial<T> = T extends Builtin ? T : T extends globalThis.Array<infer U> ? globalThis.Array<DeepPartial<U>> : T extends ReadonlyArray<infer U> ? ReadonlyArray<DeepPartial<U>> : T extends {} ? {
    [K in keyof T]?: DeepPartial<T[K]>;
} : Partial<T>;
export type ServerStreamingMethodResult<Response> = {
    [Symbol.asyncIterator](): AsyncIterator<Response, void>;
};
export interface MessageFns<T> {
    encode(message: T, writer?: BinaryWriter): BinaryWriter;
    decode(input: BinaryReader | Uint8Array, length?: number): T;
    fromJSON(object: any): T;
    toJSON(message: T): unknown;
    create(base?: DeepPartial<T>): T;
    fromPartial(object: DeepPartial<T>): T;
}
export {};
