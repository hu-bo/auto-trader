import datetime

from google.protobuf import timestamp_pb2 as _timestamp_pb2
from google.protobuf.internal import containers as _containers
from google.protobuf.internal import enum_type_wrapper as _enum_type_wrapper
from google.protobuf import descriptor as _descriptor
from google.protobuf import message as _message
from collections.abc import Iterable as _Iterable, Mapping as _Mapping
from typing import ClassVar as _ClassVar, Optional as _Optional, Union as _Union

DESCRIPTOR: _descriptor.FileDescriptor

class SignalType(int, metaclass=_enum_type_wrapper.EnumTypeWrapper):
    __slots__ = ()
    SIGNAL_TYPE_UNSPECIFIED: _ClassVar[SignalType]
    SIGNAL_TYPE_ENTRY_LONG: _ClassVar[SignalType]
    SIGNAL_TYPE_ENTRY_SHORT: _ClassVar[SignalType]
    SIGNAL_TYPE_EXIT_LONG: _ClassVar[SignalType]
    SIGNAL_TYPE_EXIT_SHORT: _ClassVar[SignalType]
    SIGNAL_TYPE_STOP_LOSS: _ClassVar[SignalType]
    SIGNAL_TYPE_TAKE_PROFIT: _ClassVar[SignalType]
    SIGNAL_TYPE_REBALANCE: _ClassVar[SignalType]

class SignalSource(int, metaclass=_enum_type_wrapper.EnumTypeWrapper):
    __slots__ = ()
    SIGNAL_SOURCE_UNSPECIFIED: _ClassVar[SignalSource]
    SIGNAL_SOURCE_STRATEGY: _ClassVar[SignalSource]
    SIGNAL_SOURCE_RISK: _ClassVar[SignalSource]
    SIGNAL_SOURCE_USER: _ClassVar[SignalSource]
    SIGNAL_SOURCE_ADMIN: _ClassVar[SignalSource]

class SignalStatus(int, metaclass=_enum_type_wrapper.EnumTypeWrapper):
    __slots__ = ()
    SIGNAL_STATUS_UNSPECIFIED: _ClassVar[SignalStatus]
    SIGNAL_STATUS_PENDING: _ClassVar[SignalStatus]
    SIGNAL_STATUS_PROCESSING: _ClassVar[SignalStatus]
    SIGNAL_STATUS_COMPLETED: _ClassVar[SignalStatus]
    SIGNAL_STATUS_REJECTED: _ClassVar[SignalStatus]
    SIGNAL_STATUS_CANCELLED: _ClassVar[SignalStatus]
SIGNAL_TYPE_UNSPECIFIED: SignalType
SIGNAL_TYPE_ENTRY_LONG: SignalType
SIGNAL_TYPE_ENTRY_SHORT: SignalType
SIGNAL_TYPE_EXIT_LONG: SignalType
SIGNAL_TYPE_EXIT_SHORT: SignalType
SIGNAL_TYPE_STOP_LOSS: SignalType
SIGNAL_TYPE_TAKE_PROFIT: SignalType
SIGNAL_TYPE_REBALANCE: SignalType
SIGNAL_SOURCE_UNSPECIFIED: SignalSource
SIGNAL_SOURCE_STRATEGY: SignalSource
SIGNAL_SOURCE_RISK: SignalSource
SIGNAL_SOURCE_USER: SignalSource
SIGNAL_SOURCE_ADMIN: SignalSource
SIGNAL_STATUS_UNSPECIFIED: SignalStatus
SIGNAL_STATUS_PENDING: SignalStatus
SIGNAL_STATUS_PROCESSING: SignalStatus
SIGNAL_STATUS_COMPLETED: SignalStatus
SIGNAL_STATUS_REJECTED: SignalStatus
SIGNAL_STATUS_CANCELLED: SignalStatus

class SignalMetadata(_message.Message):
    __slots__ = ("strategy_id", "symbol", "exchange", "tags", "notes")
    class TagsEntry(_message.Message):
        __slots__ = ("key", "value")
        KEY_FIELD_NUMBER: _ClassVar[int]
        VALUE_FIELD_NUMBER: _ClassVar[int]
        key: str
        value: str
        def __init__(self, key: _Optional[str] = ..., value: _Optional[str] = ...) -> None: ...
    STRATEGY_ID_FIELD_NUMBER: _ClassVar[int]
    SYMBOL_FIELD_NUMBER: _ClassVar[int]
    EXCHANGE_FIELD_NUMBER: _ClassVar[int]
    TAGS_FIELD_NUMBER: _ClassVar[int]
    NOTES_FIELD_NUMBER: _ClassVar[int]
    strategy_id: str
    symbol: str
    exchange: str
    tags: _containers.ScalarMap[str, str]
    notes: str
    def __init__(self, strategy_id: _Optional[str] = ..., symbol: _Optional[str] = ..., exchange: _Optional[str] = ..., tags: _Optional[_Mapping[str, str]] = ..., notes: _Optional[str] = ...) -> None: ...

class Signal(_message.Message):
    __slots__ = ("id", "type", "source", "status", "symbol", "exchange", "quantity", "price", "stop_loss", "take_profit", "created_at", "updated_at", "executed_at", "metadata", "raw_data", "error_message")
    ID_FIELD_NUMBER: _ClassVar[int]
    TYPE_FIELD_NUMBER: _ClassVar[int]
    SOURCE_FIELD_NUMBER: _ClassVar[int]
    STATUS_FIELD_NUMBER: _ClassVar[int]
    SYMBOL_FIELD_NUMBER: _ClassVar[int]
    EXCHANGE_FIELD_NUMBER: _ClassVar[int]
    QUANTITY_FIELD_NUMBER: _ClassVar[int]
    PRICE_FIELD_NUMBER: _ClassVar[int]
    STOP_LOSS_FIELD_NUMBER: _ClassVar[int]
    TAKE_PROFIT_FIELD_NUMBER: _ClassVar[int]
    CREATED_AT_FIELD_NUMBER: _ClassVar[int]
    UPDATED_AT_FIELD_NUMBER: _ClassVar[int]
    EXECUTED_AT_FIELD_NUMBER: _ClassVar[int]
    METADATA_FIELD_NUMBER: _ClassVar[int]
    RAW_DATA_FIELD_NUMBER: _ClassVar[int]
    ERROR_MESSAGE_FIELD_NUMBER: _ClassVar[int]
    id: str
    type: SignalType
    source: SignalSource
    status: SignalStatus
    symbol: str
    exchange: str
    quantity: float
    price: float
    stop_loss: float
    take_profit: float
    created_at: _timestamp_pb2.Timestamp
    updated_at: _timestamp_pb2.Timestamp
    executed_at: _timestamp_pb2.Timestamp
    metadata: SignalMetadata
    raw_data: str
    error_message: str
    def __init__(self, id: _Optional[str] = ..., type: _Optional[_Union[SignalType, str]] = ..., source: _Optional[_Union[SignalSource, str]] = ..., status: _Optional[_Union[SignalStatus, str]] = ..., symbol: _Optional[str] = ..., exchange: _Optional[str] = ..., quantity: _Optional[float] = ..., price: _Optional[float] = ..., stop_loss: _Optional[float] = ..., take_profit: _Optional[float] = ..., created_at: _Optional[_Union[datetime.datetime, _timestamp_pb2.Timestamp, _Mapping]] = ..., updated_at: _Optional[_Union[datetime.datetime, _timestamp_pb2.Timestamp, _Mapping]] = ..., executed_at: _Optional[_Union[datetime.datetime, _timestamp_pb2.Timestamp, _Mapping]] = ..., metadata: _Optional[_Union[SignalMetadata, _Mapping]] = ..., raw_data: _Optional[str] = ..., error_message: _Optional[str] = ...) -> None: ...

class SignalList(_message.Message):
    __slots__ = ("signals", "total", "page", "page_size")
    SIGNALS_FIELD_NUMBER: _ClassVar[int]
    TOTAL_FIELD_NUMBER: _ClassVar[int]
    PAGE_FIELD_NUMBER: _ClassVar[int]
    PAGE_SIZE_FIELD_NUMBER: _ClassVar[int]
    signals: _containers.RepeatedCompositeFieldContainer[Signal]
    total: int
    page: int
    page_size: int
    def __init__(self, signals: _Optional[_Iterable[_Union[Signal, _Mapping]]] = ..., total: _Optional[int] = ..., page: _Optional[int] = ..., page_size: _Optional[int] = ...) -> None: ...

class SignalQueryRequest(_message.Message):
    __slots__ = ("types", "sources", "statuses", "symbol", "exchange", "start_time", "end_time", "page", "page_size")
    TYPES_FIELD_NUMBER: _ClassVar[int]
    SOURCES_FIELD_NUMBER: _ClassVar[int]
    STATUSES_FIELD_NUMBER: _ClassVar[int]
    SYMBOL_FIELD_NUMBER: _ClassVar[int]
    EXCHANGE_FIELD_NUMBER: _ClassVar[int]
    START_TIME_FIELD_NUMBER: _ClassVar[int]
    END_TIME_FIELD_NUMBER: _ClassVar[int]
    PAGE_FIELD_NUMBER: _ClassVar[int]
    PAGE_SIZE_FIELD_NUMBER: _ClassVar[int]
    types: _containers.RepeatedScalarFieldContainer[SignalType]
    sources: _containers.RepeatedScalarFieldContainer[SignalSource]
    statuses: _containers.RepeatedScalarFieldContainer[SignalStatus]
    symbol: str
    exchange: str
    start_time: _timestamp_pb2.Timestamp
    end_time: _timestamp_pb2.Timestamp
    page: int
    page_size: int
    def __init__(self, types: _Optional[_Iterable[_Union[SignalType, str]]] = ..., sources: _Optional[_Iterable[_Union[SignalSource, str]]] = ..., statuses: _Optional[_Iterable[_Union[SignalStatus, str]]] = ..., symbol: _Optional[str] = ..., exchange: _Optional[str] = ..., start_time: _Optional[_Union[datetime.datetime, _timestamp_pb2.Timestamp, _Mapping]] = ..., end_time: _Optional[_Union[datetime.datetime, _timestamp_pb2.Timestamp, _Mapping]] = ..., page: _Optional[int] = ..., page_size: _Optional[int] = ...) -> None: ...

class SignalQueryResponse(_message.Message):
    __slots__ = ("signals", "has_more")
    SIGNALS_FIELD_NUMBER: _ClassVar[int]
    HAS_MORE_FIELD_NUMBER: _ClassVar[int]
    signals: SignalList
    has_more: bool
    def __init__(self, signals: _Optional[_Union[SignalList, _Mapping]] = ..., has_more: bool = ...) -> None: ...

class SignalCreateRequest(_message.Message):
    __slots__ = ("type", "source", "symbol", "exchange", "quantity", "price", "stop_loss", "take_profit", "metadata", "raw_data")
    TYPE_FIELD_NUMBER: _ClassVar[int]
    SOURCE_FIELD_NUMBER: _ClassVar[int]
    SYMBOL_FIELD_NUMBER: _ClassVar[int]
    EXCHANGE_FIELD_NUMBER: _ClassVar[int]
    QUANTITY_FIELD_NUMBER: _ClassVar[int]
    PRICE_FIELD_NUMBER: _ClassVar[int]
    STOP_LOSS_FIELD_NUMBER: _ClassVar[int]
    TAKE_PROFIT_FIELD_NUMBER: _ClassVar[int]
    METADATA_FIELD_NUMBER: _ClassVar[int]
    RAW_DATA_FIELD_NUMBER: _ClassVar[int]
    type: SignalType
    source: SignalSource
    symbol: str
    exchange: str
    quantity: float
    price: float
    stop_loss: float
    take_profit: float
    metadata: SignalMetadata
    raw_data: str
    def __init__(self, type: _Optional[_Union[SignalType, str]] = ..., source: _Optional[_Union[SignalSource, str]] = ..., symbol: _Optional[str] = ..., exchange: _Optional[str] = ..., quantity: _Optional[float] = ..., price: _Optional[float] = ..., stop_loss: _Optional[float] = ..., take_profit: _Optional[float] = ..., metadata: _Optional[_Union[SignalMetadata, _Mapping]] = ..., raw_data: _Optional[str] = ...) -> None: ...

class SignalCreateResponse(_message.Message):
    __slots__ = ("signal", "success", "error_message")
    SIGNAL_FIELD_NUMBER: _ClassVar[int]
    SUCCESS_FIELD_NUMBER: _ClassVar[int]
    ERROR_MESSAGE_FIELD_NUMBER: _ClassVar[int]
    signal: Signal
    success: bool
    error_message: str
    def __init__(self, signal: _Optional[_Union[Signal, _Mapping]] = ..., success: bool = ..., error_message: _Optional[str] = ...) -> None: ...

class SignalUpdateRequest(_message.Message):
    __slots__ = ("id", "status", "error_message", "executed_price", "executed_quantity", "executed_at")
    ID_FIELD_NUMBER: _ClassVar[int]
    STATUS_FIELD_NUMBER: _ClassVar[int]
    ERROR_MESSAGE_FIELD_NUMBER: _ClassVar[int]
    EXECUTED_PRICE_FIELD_NUMBER: _ClassVar[int]
    EXECUTED_QUANTITY_FIELD_NUMBER: _ClassVar[int]
    EXECUTED_AT_FIELD_NUMBER: _ClassVar[int]
    id: str
    status: SignalStatus
    error_message: str
    executed_price: float
    executed_quantity: float
    executed_at: _timestamp_pb2.Timestamp
    def __init__(self, id: _Optional[str] = ..., status: _Optional[_Union[SignalStatus, str]] = ..., error_message: _Optional[str] = ..., executed_price: _Optional[float] = ..., executed_quantity: _Optional[float] = ..., executed_at: _Optional[_Union[datetime.datetime, _timestamp_pb2.Timestamp, _Mapping]] = ...) -> None: ...

class SignalUpdateResponse(_message.Message):
    __slots__ = ("signal", "success", "error_message")
    SIGNAL_FIELD_NUMBER: _ClassVar[int]
    SUCCESS_FIELD_NUMBER: _ClassVar[int]
    ERROR_MESSAGE_FIELD_NUMBER: _ClassVar[int]
    signal: Signal
    success: bool
    error_message: str
    def __init__(self, signal: _Optional[_Union[Signal, _Mapping]] = ..., success: bool = ..., error_message: _Optional[str] = ...) -> None: ...

class SignalBatchProcessRequest(_message.Message):
    __slots__ = ("signal_ids", "new_status", "reason")
    SIGNAL_IDS_FIELD_NUMBER: _ClassVar[int]
    NEW_STATUS_FIELD_NUMBER: _ClassVar[int]
    REASON_FIELD_NUMBER: _ClassVar[int]
    signal_ids: _containers.RepeatedScalarFieldContainer[str]
    new_status: SignalStatus
    reason: str
    def __init__(self, signal_ids: _Optional[_Iterable[str]] = ..., new_status: _Optional[_Union[SignalStatus, str]] = ..., reason: _Optional[str] = ...) -> None: ...

class SignalBatchProcessResponse(_message.Message):
    __slots__ = ("processed_count", "failed_count", "failed_ids")
    PROCESSED_COUNT_FIELD_NUMBER: _ClassVar[int]
    FAILED_COUNT_FIELD_NUMBER: _ClassVar[int]
    FAILED_IDS_FIELD_NUMBER: _ClassVar[int]
    processed_count: int
    failed_count: int
    failed_ids: _containers.RepeatedScalarFieldContainer[str]
    def __init__(self, processed_count: _Optional[int] = ..., failed_count: _Optional[int] = ..., failed_ids: _Optional[_Iterable[str]] = ...) -> None: ...
