import datetime

from google.protobuf import timestamp_pb2 as _timestamp_pb2
from google.protobuf import empty_pb2 as _empty_pb2
from google.protobuf.internal import containers as _containers
from google.protobuf.internal import enum_type_wrapper as _enum_type_wrapper
from google.protobuf import descriptor as _descriptor
from google.protobuf import message as _message
from collections.abc import Iterable as _Iterable, Mapping as _Mapping
from typing import ClassVar as _ClassVar, Optional as _Optional, Union as _Union

DESCRIPTOR: _descriptor.FileDescriptor

class SubscriptionStatus(int, metaclass=_enum_type_wrapper.EnumTypeWrapper):
    __slots__ = ()
    SUBSCRIPTION_STATUS_UNSPECIFIED: _ClassVar[SubscriptionStatus]
    SUBSCRIPTION_STATUS_RUNNING: _ClassVar[SubscriptionStatus]
    SUBSCRIPTION_STATUS_STOPPED: _ClassVar[SubscriptionStatus]
    SUBSCRIPTION_STATUS_ERROR: _ClassVar[SubscriptionStatus]
SUBSCRIPTION_STATUS_UNSPECIFIED: SubscriptionStatus
SUBSCRIPTION_STATUS_RUNNING: SubscriptionStatus
SUBSCRIPTION_STATUS_STOPPED: SubscriptionStatus
SUBSCRIPTION_STATUS_ERROR: SubscriptionStatus

class SubscribeRequest(_message.Message):
    __slots__ = ("user_id", "subscription_id", "strategy_id", "strategy_name", "code", "symbol", "exchange", "trade_type", "period", "parameters", "risk_config", "live")
    USER_ID_FIELD_NUMBER: _ClassVar[int]
    SUBSCRIPTION_ID_FIELD_NUMBER: _ClassVar[int]
    STRATEGY_ID_FIELD_NUMBER: _ClassVar[int]
    STRATEGY_NAME_FIELD_NUMBER: _ClassVar[int]
    CODE_FIELD_NUMBER: _ClassVar[int]
    SYMBOL_FIELD_NUMBER: _ClassVar[int]
    EXCHANGE_FIELD_NUMBER: _ClassVar[int]
    TRADE_TYPE_FIELD_NUMBER: _ClassVar[int]
    PERIOD_FIELD_NUMBER: _ClassVar[int]
    PARAMETERS_FIELD_NUMBER: _ClassVar[int]
    RISK_CONFIG_FIELD_NUMBER: _ClassVar[int]
    LIVE_FIELD_NUMBER: _ClassVar[int]
    user_id: str
    subscription_id: str
    strategy_id: str
    strategy_name: str
    code: str
    symbol: str
    exchange: str
    trade_type: str
    period: str
    parameters: str
    risk_config: str
    live: bool
    def __init__(self, user_id: _Optional[str] = ..., subscription_id: _Optional[str] = ..., strategy_id: _Optional[str] = ..., strategy_name: _Optional[str] = ..., code: _Optional[str] = ..., symbol: _Optional[str] = ..., exchange: _Optional[str] = ..., trade_type: _Optional[str] = ..., period: _Optional[str] = ..., parameters: _Optional[str] = ..., risk_config: _Optional[str] = ..., live: bool = ...) -> None: ...

class SubscriptionResponse(_message.Message):
    __slots__ = ("subscription_id", "user_id", "instance_key", "status", "ref_count", "nats_subject", "started_at", "stopped_at")
    SUBSCRIPTION_ID_FIELD_NUMBER: _ClassVar[int]
    USER_ID_FIELD_NUMBER: _ClassVar[int]
    INSTANCE_KEY_FIELD_NUMBER: _ClassVar[int]
    STATUS_FIELD_NUMBER: _ClassVar[int]
    REF_COUNT_FIELD_NUMBER: _ClassVar[int]
    NATS_SUBJECT_FIELD_NUMBER: _ClassVar[int]
    STARTED_AT_FIELD_NUMBER: _ClassVar[int]
    STOPPED_AT_FIELD_NUMBER: _ClassVar[int]
    subscription_id: str
    user_id: str
    instance_key: str
    status: SubscriptionStatus
    ref_count: int
    nats_subject: str
    started_at: _timestamp_pb2.Timestamp
    stopped_at: _timestamp_pb2.Timestamp
    def __init__(self, subscription_id: _Optional[str] = ..., user_id: _Optional[str] = ..., instance_key: _Optional[str] = ..., status: _Optional[_Union[SubscriptionStatus, str]] = ..., ref_count: _Optional[int] = ..., nats_subject: _Optional[str] = ..., started_at: _Optional[_Union[datetime.datetime, _timestamp_pb2.Timestamp, _Mapping]] = ..., stopped_at: _Optional[_Union[datetime.datetime, _timestamp_pb2.Timestamp, _Mapping]] = ...) -> None: ...

class UnsubscribeRequest(_message.Message):
    __slots__ = ("subscription_id", "instance_key")
    SUBSCRIPTION_ID_FIELD_NUMBER: _ClassVar[int]
    INSTANCE_KEY_FIELD_NUMBER: _ClassVar[int]
    subscription_id: str
    instance_key: str
    def __init__(self, subscription_id: _Optional[str] = ..., instance_key: _Optional[str] = ...) -> None: ...

class GetSubscriptionRequest(_message.Message):
    __slots__ = ("subscription_id",)
    SUBSCRIPTION_ID_FIELD_NUMBER: _ClassVar[int]
    subscription_id: str
    def __init__(self, subscription_id: _Optional[str] = ...) -> None: ...

class ListSubscriptionsRequest(_message.Message):
    __slots__ = ("user_id", "page_size", "page_token")
    USER_ID_FIELD_NUMBER: _ClassVar[int]
    PAGE_SIZE_FIELD_NUMBER: _ClassVar[int]
    PAGE_TOKEN_FIELD_NUMBER: _ClassVar[int]
    user_id: str
    page_size: int
    page_token: str
    def __init__(self, user_id: _Optional[str] = ..., page_size: _Optional[int] = ..., page_token: _Optional[str] = ...) -> None: ...

class ListSubscriptionsResponse(_message.Message):
    __slots__ = ("subscriptions", "next_page_token", "total_count")
    SUBSCRIPTIONS_FIELD_NUMBER: _ClassVar[int]
    NEXT_PAGE_TOKEN_FIELD_NUMBER: _ClassVar[int]
    TOTAL_COUNT_FIELD_NUMBER: _ClassVar[int]
    subscriptions: _containers.RepeatedCompositeFieldContainer[SubscriptionResponse]
    next_page_token: str
    total_count: int
    def __init__(self, subscriptions: _Optional[_Iterable[_Union[SubscriptionResponse, _Mapping]]] = ..., next_page_token: _Optional[str] = ..., total_count: _Optional[int] = ...) -> None: ...

class InstanceStatsResponse(_message.Message):
    __slots__ = ("total_instances", "running_instances", "stopped_instances", "error_instances", "total_subscriptions", "instances_by_exchange", "instances_by_strategy")
    class InstancesByExchangeEntry(_message.Message):
        __slots__ = ("key", "value")
        KEY_FIELD_NUMBER: _ClassVar[int]
        VALUE_FIELD_NUMBER: _ClassVar[int]
        key: str
        value: int
        def __init__(self, key: _Optional[str] = ..., value: _Optional[int] = ...) -> None: ...
    class InstancesByStrategyEntry(_message.Message):
        __slots__ = ("key", "value")
        KEY_FIELD_NUMBER: _ClassVar[int]
        VALUE_FIELD_NUMBER: _ClassVar[int]
        key: str
        value: int
        def __init__(self, key: _Optional[str] = ..., value: _Optional[int] = ...) -> None: ...
    TOTAL_INSTANCES_FIELD_NUMBER: _ClassVar[int]
    RUNNING_INSTANCES_FIELD_NUMBER: _ClassVar[int]
    STOPPED_INSTANCES_FIELD_NUMBER: _ClassVar[int]
    ERROR_INSTANCES_FIELD_NUMBER: _ClassVar[int]
    TOTAL_SUBSCRIPTIONS_FIELD_NUMBER: _ClassVar[int]
    INSTANCES_BY_EXCHANGE_FIELD_NUMBER: _ClassVar[int]
    INSTANCES_BY_STRATEGY_FIELD_NUMBER: _ClassVar[int]
    total_instances: int
    running_instances: int
    stopped_instances: int
    error_instances: int
    total_subscriptions: int
    instances_by_exchange: _containers.ScalarMap[str, int]
    instances_by_strategy: _containers.ScalarMap[str, int]
    def __init__(self, total_instances: _Optional[int] = ..., running_instances: _Optional[int] = ..., stopped_instances: _Optional[int] = ..., error_instances: _Optional[int] = ..., total_subscriptions: _Optional[int] = ..., instances_by_exchange: _Optional[_Mapping[str, int]] = ..., instances_by_strategy: _Optional[_Mapping[str, int]] = ...) -> None: ...
