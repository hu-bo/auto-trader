from google.protobuf.internal import containers as _containers
from google.protobuf.internal import enum_type_wrapper as _enum_type_wrapper
from google.protobuf import descriptor as _descriptor
from google.protobuf import message as _message
from collections.abc import Iterable as _Iterable, Mapping as _Mapping
from typing import ClassVar as _ClassVar, Optional as _Optional, Union as _Union

DESCRIPTOR: _descriptor.FileDescriptor

class Exchange(int, metaclass=_enum_type_wrapper.EnumTypeWrapper):
    __slots__ = ()
    EXCHANGE_UNSPECIFIED: _ClassVar[Exchange]
    EXCHANGE_OKX: _ClassVar[Exchange]
    EXCHANGE_BINANCE: _ClassVar[Exchange]

class TradeType(int, metaclass=_enum_type_wrapper.EnumTypeWrapper):
    __slots__ = ()
    TRADE_TYPE_UNSPECIFIED: _ClassVar[TradeType]
    TRADE_TYPE_SPOT: _ClassVar[TradeType]
    TRADE_TYPE_FUTURES: _ClassVar[TradeType]
    TRADE_TYPE_DELIVERY: _ClassVar[TradeType]

class OrderSide(int, metaclass=_enum_type_wrapper.EnumTypeWrapper):
    __slots__ = ()
    ORDER_SIDE_UNSPECIFIED: _ClassVar[OrderSide]
    ORDER_SIDE_BUY: _ClassVar[OrderSide]
    ORDER_SIDE_SELL: _ClassVar[OrderSide]

class PositionSide(int, metaclass=_enum_type_wrapper.EnumTypeWrapper):
    __slots__ = ()
    POSITION_SIDE_UNSPECIFIED: _ClassVar[PositionSide]
    POSITION_SIDE_LONG: _ClassVar[PositionSide]
    POSITION_SIDE_SHORT: _ClassVar[PositionSide]

class OrderType(int, metaclass=_enum_type_wrapper.EnumTypeWrapper):
    __slots__ = ()
    ORDER_TYPE_UNSPECIFIED: _ClassVar[OrderType]
    ORDER_TYPE_LIMIT: _ClassVar[OrderType]
    ORDER_TYPE_MARKET: _ClassVar[OrderType]
    ORDER_TYPE_MAKER_ONLY: _ClassVar[OrderType]

class OrderStatus(int, metaclass=_enum_type_wrapper.EnumTypeWrapper):
    __slots__ = ()
    ORDER_STATUS_UNSPECIFIED: _ClassVar[OrderStatus]
    ORDER_STATUS_PENDING: _ClassVar[OrderStatus]
    ORDER_STATUS_OPEN: _ClassVar[OrderStatus]
    ORDER_STATUS_PARTIAL: _ClassVar[OrderStatus]
    ORDER_STATUS_FILLED: _ClassVar[OrderStatus]
    ORDER_STATUS_CANCELED: _ClassVar[OrderStatus]
    ORDER_STATUS_REJECTED: _ClassVar[OrderStatus]
    ORDER_STATUS_EXPIRED: _ClassVar[OrderStatus]
EXCHANGE_UNSPECIFIED: Exchange
EXCHANGE_OKX: Exchange
EXCHANGE_BINANCE: Exchange
TRADE_TYPE_UNSPECIFIED: TradeType
TRADE_TYPE_SPOT: TradeType
TRADE_TYPE_FUTURES: TradeType
TRADE_TYPE_DELIVERY: TradeType
ORDER_SIDE_UNSPECIFIED: OrderSide
ORDER_SIDE_BUY: OrderSide
ORDER_SIDE_SELL: OrderSide
POSITION_SIDE_UNSPECIFIED: PositionSide
POSITION_SIDE_LONG: PositionSide
POSITION_SIDE_SHORT: PositionSide
ORDER_TYPE_UNSPECIFIED: OrderType
ORDER_TYPE_LIMIT: OrderType
ORDER_TYPE_MARKET: OrderType
ORDER_TYPE_MAKER_ONLY: OrderType
ORDER_STATUS_UNSPECIFIED: OrderStatus
ORDER_STATUS_PENDING: OrderStatus
ORDER_STATUS_OPEN: OrderStatus
ORDER_STATUS_PARTIAL: OrderStatus
ORDER_STATUS_FILLED: OrderStatus
ORDER_STATUS_CANCELED: OrderStatus
ORDER_STATUS_REJECTED: OrderStatus
ORDER_STATUS_EXPIRED: OrderStatus

class Error(_message.Message):
    __slots__ = ("code", "message")
    CODE_FIELD_NUMBER: _ClassVar[int]
    MESSAGE_FIELD_NUMBER: _ClassVar[int]
    code: str
    message: str
    def __init__(self, code: _Optional[str] = ..., message: _Optional[str] = ...) -> None: ...

class InitAccountRequest(_message.Message):
    __slots__ = ("exchange", "api_key", "api_secret", "passphrase", "demonet", "name")
    EXCHANGE_FIELD_NUMBER: _ClassVar[int]
    API_KEY_FIELD_NUMBER: _ClassVar[int]
    API_SECRET_FIELD_NUMBER: _ClassVar[int]
    PASSPHRASE_FIELD_NUMBER: _ClassVar[int]
    DEMONET_FIELD_NUMBER: _ClassVar[int]
    NAME_FIELD_NUMBER: _ClassVar[int]
    exchange: Exchange
    api_key: str
    api_secret: str
    passphrase: str
    demonet: bool
    name: str
    def __init__(self, exchange: _Optional[_Union[Exchange, str]] = ..., api_key: _Optional[str] = ..., api_secret: _Optional[str] = ..., passphrase: _Optional[str] = ..., demonet: bool = ..., name: _Optional[str] = ...) -> None: ...

class InitAccountResponse(_message.Message):
    __slots__ = ("success", "token", "error")
    SUCCESS_FIELD_NUMBER: _ClassVar[int]
    TOKEN_FIELD_NUMBER: _ClassVar[int]
    ERROR_FIELD_NUMBER: _ClassVar[int]
    success: bool
    token: str
    error: Error
    def __init__(self, success: bool = ..., token: _Optional[str] = ..., error: _Optional[_Union[Error, _Mapping]] = ...) -> None: ...

class ValidateTokenRequest(_message.Message):
    __slots__ = ("token",)
    TOKEN_FIELD_NUMBER: _ClassVar[int]
    token: str
    def __init__(self, token: _Optional[str] = ...) -> None: ...

class ValidateTokenResponse(_message.Message):
    __slots__ = ("valid", "exchange")
    VALID_FIELD_NUMBER: _ClassVar[int]
    EXCHANGE_FIELD_NUMBER: _ClassVar[int]
    valid: bool
    exchange: Exchange
    def __init__(self, valid: bool = ..., exchange: _Optional[_Union[Exchange, str]] = ...) -> None: ...

class InvalidateTokenRequest(_message.Message):
    __slots__ = ("token",)
    TOKEN_FIELD_NUMBER: _ClassVar[int]
    token: str
    def __init__(self, token: _Optional[str] = ...) -> None: ...

class InvalidateTokenResponse(_message.Message):
    __slots__ = ("success",)
    SUCCESS_FIELD_NUMBER: _ClassVar[int]
    success: bool
    def __init__(self, success: bool = ...) -> None: ...

class PlaceOrderRequest(_message.Message):
    __slots__ = ("token", "symbol", "trade_type", "side", "order_type", "quantity", "price", "position_side", "leverage", "client_order_id", "reduce_only")
    TOKEN_FIELD_NUMBER: _ClassVar[int]
    SYMBOL_FIELD_NUMBER: _ClassVar[int]
    TRADE_TYPE_FIELD_NUMBER: _ClassVar[int]
    SIDE_FIELD_NUMBER: _ClassVar[int]
    ORDER_TYPE_FIELD_NUMBER: _ClassVar[int]
    QUANTITY_FIELD_NUMBER: _ClassVar[int]
    PRICE_FIELD_NUMBER: _ClassVar[int]
    POSITION_SIDE_FIELD_NUMBER: _ClassVar[int]
    LEVERAGE_FIELD_NUMBER: _ClassVar[int]
    CLIENT_ORDER_ID_FIELD_NUMBER: _ClassVar[int]
    REDUCE_ONLY_FIELD_NUMBER: _ClassVar[int]
    token: str
    symbol: str
    trade_type: TradeType
    side: OrderSide
    order_type: OrderType
    quantity: float
    price: float
    position_side: PositionSide
    leverage: int
    client_order_id: str
    reduce_only: bool
    def __init__(self, token: _Optional[str] = ..., symbol: _Optional[str] = ..., trade_type: _Optional[_Union[TradeType, str]] = ..., side: _Optional[_Union[OrderSide, str]] = ..., order_type: _Optional[_Union[OrderType, str]] = ..., quantity: _Optional[float] = ..., price: _Optional[float] = ..., position_side: _Optional[_Union[PositionSide, str]] = ..., leverage: _Optional[int] = ..., client_order_id: _Optional[str] = ..., reduce_only: bool = ...) -> None: ...

class PlaceOrderResponse(_message.Message):
    __slots__ = ("success", "order", "error")
    SUCCESS_FIELD_NUMBER: _ClassVar[int]
    ORDER_FIELD_NUMBER: _ClassVar[int]
    ERROR_FIELD_NUMBER: _ClassVar[int]
    success: bool
    order: Order
    error: Error
    def __init__(self, success: bool = ..., order: _Optional[_Union[Order, _Mapping]] = ..., error: _Optional[_Union[Error, _Mapping]] = ...) -> None: ...

class PlaceOrdersRequest(_message.Message):
    __slots__ = ("token", "orders")
    TOKEN_FIELD_NUMBER: _ClassVar[int]
    ORDERS_FIELD_NUMBER: _ClassVar[int]
    token: str
    orders: _containers.RepeatedCompositeFieldContainer[PlaceOrderRequest]
    def __init__(self, token: _Optional[str] = ..., orders: _Optional[_Iterable[_Union[PlaceOrderRequest, _Mapping]]] = ...) -> None: ...

class PlaceOrdersResponse(_message.Message):
    __slots__ = ("success_count", "failed_count", "results")
    SUCCESS_COUNT_FIELD_NUMBER: _ClassVar[int]
    FAILED_COUNT_FIELD_NUMBER: _ClassVar[int]
    RESULTS_FIELD_NUMBER: _ClassVar[int]
    success_count: int
    failed_count: int
    results: _containers.RepeatedCompositeFieldContainer[PlaceOrderResponse]
    def __init__(self, success_count: _Optional[int] = ..., failed_count: _Optional[int] = ..., results: _Optional[_Iterable[_Union[PlaceOrderResponse, _Mapping]]] = ...) -> None: ...

class CancelOrderRequest(_message.Message):
    __slots__ = ("token", "order_id")
    TOKEN_FIELD_NUMBER: _ClassVar[int]
    ORDER_ID_FIELD_NUMBER: _ClassVar[int]
    token: str
    order_id: str
    def __init__(self, token: _Optional[str] = ..., order_id: _Optional[str] = ...) -> None: ...

class CancelOrderResponse(_message.Message):
    __slots__ = ("success", "order", "error")
    SUCCESS_FIELD_NUMBER: _ClassVar[int]
    ORDER_FIELD_NUMBER: _ClassVar[int]
    ERROR_FIELD_NUMBER: _ClassVar[int]
    success: bool
    order: Order
    error: Error
    def __init__(self, success: bool = ..., order: _Optional[_Union[Order, _Mapping]] = ..., error: _Optional[_Union[Error, _Mapping]] = ...) -> None: ...

class GetOrderRequest(_message.Message):
    __slots__ = ("token", "order_id")
    TOKEN_FIELD_NUMBER: _ClassVar[int]
    ORDER_ID_FIELD_NUMBER: _ClassVar[int]
    token: str
    order_id: str
    def __init__(self, token: _Optional[str] = ..., order_id: _Optional[str] = ...) -> None: ...

class GetOrderResponse(_message.Message):
    __slots__ = ("order", "error")
    ORDER_FIELD_NUMBER: _ClassVar[int]
    ERROR_FIELD_NUMBER: _ClassVar[int]
    order: Order
    error: Error
    def __init__(self, order: _Optional[_Union[Order, _Mapping]] = ..., error: _Optional[_Union[Error, _Mapping]] = ...) -> None: ...

class GetOrdersRequest(_message.Message):
    __slots__ = ("token", "symbol", "status", "limit", "offset")
    TOKEN_FIELD_NUMBER: _ClassVar[int]
    SYMBOL_FIELD_NUMBER: _ClassVar[int]
    STATUS_FIELD_NUMBER: _ClassVar[int]
    LIMIT_FIELD_NUMBER: _ClassVar[int]
    OFFSET_FIELD_NUMBER: _ClassVar[int]
    token: str
    symbol: str
    status: OrderStatus
    limit: int
    offset: int
    def __init__(self, token: _Optional[str] = ..., symbol: _Optional[str] = ..., status: _Optional[_Union[OrderStatus, str]] = ..., limit: _Optional[int] = ..., offset: _Optional[int] = ...) -> None: ...

class GetOrdersResponse(_message.Message):
    __slots__ = ("orders", "total")
    ORDERS_FIELD_NUMBER: _ClassVar[int]
    TOTAL_FIELD_NUMBER: _ClassVar[int]
    orders: _containers.RepeatedCompositeFieldContainer[Order]
    total: int
    def __init__(self, orders: _Optional[_Iterable[_Union[Order, _Mapping]]] = ..., total: _Optional[int] = ...) -> None: ...

class Order(_message.Message):
    __slots__ = ("id", "exchange_order_id", "client_order_id", "symbol", "trade_type", "side", "position_side", "order_type", "status", "quantity", "price", "filled_qty", "avg_price", "fee", "fee_asset", "leverage", "reduce_only", "created_at", "updated_at", "filled_at")
    ID_FIELD_NUMBER: _ClassVar[int]
    EXCHANGE_ORDER_ID_FIELD_NUMBER: _ClassVar[int]
    CLIENT_ORDER_ID_FIELD_NUMBER: _ClassVar[int]
    SYMBOL_FIELD_NUMBER: _ClassVar[int]
    TRADE_TYPE_FIELD_NUMBER: _ClassVar[int]
    SIDE_FIELD_NUMBER: _ClassVar[int]
    POSITION_SIDE_FIELD_NUMBER: _ClassVar[int]
    ORDER_TYPE_FIELD_NUMBER: _ClassVar[int]
    STATUS_FIELD_NUMBER: _ClassVar[int]
    QUANTITY_FIELD_NUMBER: _ClassVar[int]
    PRICE_FIELD_NUMBER: _ClassVar[int]
    FILLED_QTY_FIELD_NUMBER: _ClassVar[int]
    AVG_PRICE_FIELD_NUMBER: _ClassVar[int]
    FEE_FIELD_NUMBER: _ClassVar[int]
    FEE_ASSET_FIELD_NUMBER: _ClassVar[int]
    LEVERAGE_FIELD_NUMBER: _ClassVar[int]
    REDUCE_ONLY_FIELD_NUMBER: _ClassVar[int]
    CREATED_AT_FIELD_NUMBER: _ClassVar[int]
    UPDATED_AT_FIELD_NUMBER: _ClassVar[int]
    FILLED_AT_FIELD_NUMBER: _ClassVar[int]
    id: str
    exchange_order_id: str
    client_order_id: str
    symbol: str
    trade_type: TradeType
    side: OrderSide
    position_side: PositionSide
    order_type: OrderType
    status: OrderStatus
    quantity: str
    price: str
    filled_qty: str
    avg_price: str
    fee: str
    fee_asset: str
    leverage: int
    reduce_only: bool
    created_at: int
    updated_at: int
    filled_at: int
    def __init__(self, id: _Optional[str] = ..., exchange_order_id: _Optional[str] = ..., client_order_id: _Optional[str] = ..., symbol: _Optional[str] = ..., trade_type: _Optional[_Union[TradeType, str]] = ..., side: _Optional[_Union[OrderSide, str]] = ..., position_side: _Optional[_Union[PositionSide, str]] = ..., order_type: _Optional[_Union[OrderType, str]] = ..., status: _Optional[_Union[OrderStatus, str]] = ..., quantity: _Optional[str] = ..., price: _Optional[str] = ..., filled_qty: _Optional[str] = ..., avg_price: _Optional[str] = ..., fee: _Optional[str] = ..., fee_asset: _Optional[str] = ..., leverage: _Optional[int] = ..., reduce_only: bool = ..., created_at: _Optional[int] = ..., updated_at: _Optional[int] = ..., filled_at: _Optional[int] = ...) -> None: ...

class GetPositionsRequest(_message.Message):
    __slots__ = ("token", "symbol")
    TOKEN_FIELD_NUMBER: _ClassVar[int]
    SYMBOL_FIELD_NUMBER: _ClassVar[int]
    token: str
    symbol: str
    def __init__(self, token: _Optional[str] = ..., symbol: _Optional[str] = ...) -> None: ...

class GetPositionsResponse(_message.Message):
    __slots__ = ("positions",)
    POSITIONS_FIELD_NUMBER: _ClassVar[int]
    positions: _containers.RepeatedCompositeFieldContainer[Position]
    def __init__(self, positions: _Optional[_Iterable[_Union[Position, _Mapping]]] = ...) -> None: ...

class SyncPositionsRequest(_message.Message):
    __slots__ = ("token",)
    TOKEN_FIELD_NUMBER: _ClassVar[int]
    token: str
    def __init__(self, token: _Optional[str] = ...) -> None: ...

class SyncPositionsResponse(_message.Message):
    __slots__ = ("success", "positions", "error")
    SUCCESS_FIELD_NUMBER: _ClassVar[int]
    POSITIONS_FIELD_NUMBER: _ClassVar[int]
    ERROR_FIELD_NUMBER: _ClassVar[int]
    success: bool
    positions: _containers.RepeatedCompositeFieldContainer[Position]
    error: Error
    def __init__(self, success: bool = ..., positions: _Optional[_Iterable[_Union[Position, _Mapping]]] = ..., error: _Optional[_Union[Error, _Mapping]] = ...) -> None: ...

class Position(_message.Message):
    __slots__ = ("id", "symbol", "trade_type", "position_side", "position_amt", "entry_price", "mark_price", "unrealized_pnl", "realized_pnl", "leverage", "margin_mode", "liquidation_price", "margin", "last_sync_at")
    ID_FIELD_NUMBER: _ClassVar[int]
    SYMBOL_FIELD_NUMBER: _ClassVar[int]
    TRADE_TYPE_FIELD_NUMBER: _ClassVar[int]
    POSITION_SIDE_FIELD_NUMBER: _ClassVar[int]
    POSITION_AMT_FIELD_NUMBER: _ClassVar[int]
    ENTRY_PRICE_FIELD_NUMBER: _ClassVar[int]
    MARK_PRICE_FIELD_NUMBER: _ClassVar[int]
    UNREALIZED_PNL_FIELD_NUMBER: _ClassVar[int]
    REALIZED_PNL_FIELD_NUMBER: _ClassVar[int]
    LEVERAGE_FIELD_NUMBER: _ClassVar[int]
    MARGIN_MODE_FIELD_NUMBER: _ClassVar[int]
    LIQUIDATION_PRICE_FIELD_NUMBER: _ClassVar[int]
    MARGIN_FIELD_NUMBER: _ClassVar[int]
    LAST_SYNC_AT_FIELD_NUMBER: _ClassVar[int]
    id: str
    symbol: str
    trade_type: TradeType
    position_side: PositionSide
    position_amt: str
    entry_price: str
    mark_price: str
    unrealized_pnl: str
    realized_pnl: str
    leverage: int
    margin_mode: str
    liquidation_price: str
    margin: str
    last_sync_at: int
    def __init__(self, id: _Optional[str] = ..., symbol: _Optional[str] = ..., trade_type: _Optional[_Union[TradeType, str]] = ..., position_side: _Optional[_Union[PositionSide, str]] = ..., position_amt: _Optional[str] = ..., entry_price: _Optional[str] = ..., mark_price: _Optional[str] = ..., unrealized_pnl: _Optional[str] = ..., realized_pnl: _Optional[str] = ..., leverage: _Optional[int] = ..., margin_mode: _Optional[str] = ..., liquidation_price: _Optional[str] = ..., margin: _Optional[str] = ..., last_sync_at: _Optional[int] = ...) -> None: ...

class GetBalanceRequest(_message.Message):
    __slots__ = ("token", "trade_type")
    TOKEN_FIELD_NUMBER: _ClassVar[int]
    TRADE_TYPE_FIELD_NUMBER: _ClassVar[int]
    token: str
    trade_type: TradeType
    def __init__(self, token: _Optional[str] = ..., trade_type: _Optional[_Union[TradeType, str]] = ...) -> None: ...

class GetBalanceResponse(_message.Message):
    __slots__ = ("balances", "error")
    BALANCES_FIELD_NUMBER: _ClassVar[int]
    ERROR_FIELD_NUMBER: _ClassVar[int]
    balances: _containers.RepeatedCompositeFieldContainer[Balance]
    error: Error
    def __init__(self, balances: _Optional[_Iterable[_Union[Balance, _Mapping]]] = ..., error: _Optional[_Union[Error, _Mapping]] = ...) -> None: ...

class Balance(_message.Message):
    __slots__ = ("asset", "free", "locked", "total", "unrealized_pnl", "margin_balance")
    ASSET_FIELD_NUMBER: _ClassVar[int]
    FREE_FIELD_NUMBER: _ClassVar[int]
    LOCKED_FIELD_NUMBER: _ClassVar[int]
    TOTAL_FIELD_NUMBER: _ClassVar[int]
    UNREALIZED_PNL_FIELD_NUMBER: _ClassVar[int]
    MARGIN_BALANCE_FIELD_NUMBER: _ClassVar[int]
    asset: str
    free: str
    locked: str
    total: str
    unrealized_pnl: str
    margin_balance: str
    def __init__(self, asset: _Optional[str] = ..., free: _Optional[str] = ..., locked: _Optional[str] = ..., total: _Optional[str] = ..., unrealized_pnl: _Optional[str] = ..., margin_balance: _Optional[str] = ...) -> None: ...

class GetPriceRequest(_message.Message):
    __slots__ = ("token", "symbol", "trade_type")
    TOKEN_FIELD_NUMBER: _ClassVar[int]
    SYMBOL_FIELD_NUMBER: _ClassVar[int]
    TRADE_TYPE_FIELD_NUMBER: _ClassVar[int]
    token: str
    symbol: str
    trade_type: TradeType
    def __init__(self, token: _Optional[str] = ..., symbol: _Optional[str] = ..., trade_type: _Optional[_Union[TradeType, str]] = ...) -> None: ...

class GetPriceResponse(_message.Message):
    __slots__ = ("price", "error")
    PRICE_FIELD_NUMBER: _ClassVar[int]
    ERROR_FIELD_NUMBER: _ClassVar[int]
    price: str
    error: Error
    def __init__(self, price: _Optional[str] = ..., error: _Optional[_Union[Error, _Mapping]] = ...) -> None: ...

class SetLeverageRequest(_message.Message):
    __slots__ = ("token", "symbol", "leverage", "trade_type", "position_side")
    TOKEN_FIELD_NUMBER: _ClassVar[int]
    SYMBOL_FIELD_NUMBER: _ClassVar[int]
    LEVERAGE_FIELD_NUMBER: _ClassVar[int]
    TRADE_TYPE_FIELD_NUMBER: _ClassVar[int]
    POSITION_SIDE_FIELD_NUMBER: _ClassVar[int]
    token: str
    symbol: str
    leverage: int
    trade_type: TradeType
    position_side: PositionSide
    def __init__(self, token: _Optional[str] = ..., symbol: _Optional[str] = ..., leverage: _Optional[int] = ..., trade_type: _Optional[_Union[TradeType, str]] = ..., position_side: _Optional[_Union[PositionSide, str]] = ...) -> None: ...

class SetLeverageResponse(_message.Message):
    __slots__ = ("success", "error")
    SUCCESS_FIELD_NUMBER: _ClassVar[int]
    ERROR_FIELD_NUMBER: _ClassVar[int]
    success: bool
    error: Error
    def __init__(self, success: bool = ..., error: _Optional[_Union[Error, _Mapping]] = ...) -> None: ...

class SubscribeOrdersRequest(_message.Message):
    __slots__ = ("token", "trade_type")
    TOKEN_FIELD_NUMBER: _ClassVar[int]
    TRADE_TYPE_FIELD_NUMBER: _ClassVar[int]
    token: str
    trade_type: TradeType
    def __init__(self, token: _Optional[str] = ..., trade_type: _Optional[_Union[TradeType, str]] = ...) -> None: ...

class OrderUpdate(_message.Message):
    __slots__ = ("order_id", "client_order_id", "symbol", "trade_type", "side", "position_side", "order_type", "status", "price", "quantity", "filled_quantity", "avg_price", "fee", "fee_asset", "update_time")
    ORDER_ID_FIELD_NUMBER: _ClassVar[int]
    CLIENT_ORDER_ID_FIELD_NUMBER: _ClassVar[int]
    SYMBOL_FIELD_NUMBER: _ClassVar[int]
    TRADE_TYPE_FIELD_NUMBER: _ClassVar[int]
    SIDE_FIELD_NUMBER: _ClassVar[int]
    POSITION_SIDE_FIELD_NUMBER: _ClassVar[int]
    ORDER_TYPE_FIELD_NUMBER: _ClassVar[int]
    STATUS_FIELD_NUMBER: _ClassVar[int]
    PRICE_FIELD_NUMBER: _ClassVar[int]
    QUANTITY_FIELD_NUMBER: _ClassVar[int]
    FILLED_QUANTITY_FIELD_NUMBER: _ClassVar[int]
    AVG_PRICE_FIELD_NUMBER: _ClassVar[int]
    FEE_FIELD_NUMBER: _ClassVar[int]
    FEE_ASSET_FIELD_NUMBER: _ClassVar[int]
    UPDATE_TIME_FIELD_NUMBER: _ClassVar[int]
    order_id: str
    client_order_id: str
    symbol: str
    trade_type: TradeType
    side: OrderSide
    position_side: PositionSide
    order_type: OrderType
    status: OrderStatus
    price: str
    quantity: str
    filled_quantity: str
    avg_price: str
    fee: str
    fee_asset: str
    update_time: int
    def __init__(self, order_id: _Optional[str] = ..., client_order_id: _Optional[str] = ..., symbol: _Optional[str] = ..., trade_type: _Optional[_Union[TradeType, str]] = ..., side: _Optional[_Union[OrderSide, str]] = ..., position_side: _Optional[_Union[PositionSide, str]] = ..., order_type: _Optional[_Union[OrderType, str]] = ..., status: _Optional[_Union[OrderStatus, str]] = ..., price: _Optional[str] = ..., quantity: _Optional[str] = ..., filled_quantity: _Optional[str] = ..., avg_price: _Optional[str] = ..., fee: _Optional[str] = ..., fee_asset: _Optional[str] = ..., update_time: _Optional[int] = ...) -> None: ...
