import { BinaryReader, BinaryWriter } from "@bufbuild/protobuf/wire";
import type { CallContext, CallOptions } from "nice-grpc-common";
import { Empty } from "./google/protobuf/empty.js";
export declare const protobufPackage = "strategy_subscription.v1";
/** 订阅状态枚举 */
export declare enum SubscriptionStatus {
    SUBSCRIPTION_STATUS_UNSPECIFIED = 0,
    SUBSCRIPTION_STATUS_RUNNING = 1,
    SUBSCRIPTION_STATUS_STOPPED = 2,
    SUBSCRIPTION_STATUS_ERROR = 3,
    UNRECOGNIZED = -1
}
export declare function subscriptionStatusFromJSON(object: any): SubscriptionStatus;
export declare function subscriptionStatusToJSON(object: SubscriptionStatus): string;
/** 订阅请求 */
export interface SubscribeRequest {
    /** 用户ID */
    userId: string;
    /** 订阅ID（strategy_order.id，多 symbol 时为 "orderId:symbol"） */
    subscriptionId: string;
    /** 策略ID */
    strategyId: string;
    /** 策略名称 */
    strategyName: string;
    /** 策略代码（hquant DSL） */
    code: string;
    /** 交易对（如 BTC-USDT） */
    symbol: string;
    /** 交易所（binance, okx） */
    exchange: string;
    /** 交易类型（spot, futures, delivery） */
    tradeType: string;
    /** K线周期（15m, 1h, 1d） */
    period: string;
    /** 策略参数（JSON 字符串） */
    parameters: string;
    /** 风控配置（JSON 字符串） */
    riskConfig: string;
    /** 是否实盘 */
    live: boolean;
}
/** 订阅响应 */
export interface SubscriptionResponse {
    /** 订阅ID */
    subscriptionId: string;
    /** 用户ID */
    userId: string;
    /** 实例Key（用于取消订阅） */
    instanceKey: string;
    /** 订阅状态 */
    status: SubscriptionStatus;
    /** 实例引用计数 */
    refCount: number;
    /** NATS 主题 */
    natsSubject: string;
    startedAt: Date | undefined;
    stoppedAt: Date | undefined;
}
/** 取消订阅请求 */
export interface UnsubscribeRequest {
    /** 订阅ID */
    subscriptionId: string;
    /** 实例Key */
    instanceKey: string;
}
/** 获取订阅请求 */
export interface GetSubscriptionRequest {
    /** 订阅ID */
    subscriptionId: string;
}
/** 列出订阅请求 */
export interface ListSubscriptionsRequest {
    /** 用户ID（可选，为空则返回所有） */
    userId: string;
    /** 分页大小 */
    pageSize: number;
    /** 分页令牌 */
    pageToken: string;
}
/** 列出订阅响应 */
export interface ListSubscriptionsResponse {
    subscriptions: SubscriptionResponse[];
    nextPageToken: string;
    totalCount: number;
}
/** 实例统计响应 */
export interface InstanceStatsResponse {
    /** 总实例数 */
    totalInstances: number;
    /** 运行中实例数 */
    runningInstances: number;
    /** 已停止实例数 */
    stoppedInstances: number;
    /** 错误实例数 */
    errorInstances: number;
    /** 总订阅数 */
    totalSubscriptions: number;
    /** 按交易所分组 */
    instancesByExchange: {
        [key: string]: number;
    };
    /** 按策略分组 */
    instancesByStrategy: {
        [key: string]: number;
    };
}
export interface InstanceStatsResponse_InstancesByExchangeEntry {
    key: string;
    value: number;
}
export interface InstanceStatsResponse_InstancesByStrategyEntry {
    key: string;
    value: number;
}
export declare const SubscribeRequest: MessageFns<SubscribeRequest>;
export declare const SubscriptionResponse: MessageFns<SubscriptionResponse>;
export declare const UnsubscribeRequest: MessageFns<UnsubscribeRequest>;
export declare const GetSubscriptionRequest: MessageFns<GetSubscriptionRequest>;
export declare const ListSubscriptionsRequest: MessageFns<ListSubscriptionsRequest>;
export declare const ListSubscriptionsResponse: MessageFns<ListSubscriptionsResponse>;
export declare const InstanceStatsResponse: MessageFns<InstanceStatsResponse>;
export declare const InstanceStatsResponse_InstancesByExchangeEntry: MessageFns<InstanceStatsResponse_InstancesByExchangeEntry>;
export declare const InstanceStatsResponse_InstancesByStrategyEntry: MessageFns<InstanceStatsResponse_InstancesByStrategyEntry>;
/** 策略订阅服务 */
export type SubscriptionServiceDefinition = typeof SubscriptionServiceDefinition;
export declare const SubscriptionServiceDefinition: {
    readonly name: "SubscriptionService";
    readonly fullName: "strategy_subscription.v1.SubscriptionService";
    readonly methods: {
        /** 订阅策略（启动实时运行） */
        readonly subscribe: {
            readonly name: "Subscribe";
            readonly requestType: MessageFns<SubscribeRequest>;
            readonly requestStream: false;
            readonly responseType: MessageFns<SubscriptionResponse>;
            readonly responseStream: false;
            readonly options: {};
        };
        /** 取消订阅 */
        readonly unsubscribe: {
            readonly name: "Unsubscribe";
            readonly requestType: MessageFns<UnsubscribeRequest>;
            readonly requestStream: false;
            readonly responseType: import("./google/protobuf/empty.js").MessageFns<Empty>;
            readonly responseStream: false;
            readonly options: {};
        };
        /** 获取订阅状态 */
        readonly getSubscription: {
            readonly name: "GetSubscription";
            readonly requestType: MessageFns<GetSubscriptionRequest>;
            readonly requestStream: false;
            readonly responseType: MessageFns<SubscriptionResponse>;
            readonly responseStream: false;
            readonly options: {};
        };
        /** 列出用户订阅 */
        readonly listSubscriptions: {
            readonly name: "ListSubscriptions";
            readonly requestType: MessageFns<ListSubscriptionsRequest>;
            readonly requestStream: false;
            readonly responseType: MessageFns<ListSubscriptionsResponse>;
            readonly responseStream: false;
            readonly options: {};
        };
        /** 获取实例统计信息（用于监控） */
        readonly getInstanceStats: {
            readonly name: "GetInstanceStats";
            readonly requestType: import("./google/protobuf/empty.js").MessageFns<Empty>;
            readonly requestStream: false;
            readonly responseType: MessageFns<InstanceStatsResponse>;
            readonly responseStream: false;
            readonly options: {};
        };
    };
};
export interface SubscriptionServiceImplementation<CallContextExt = {}> {
    /** 订阅策略（启动实时运行） */
    subscribe(request: SubscribeRequest, context: CallContext & CallContextExt): Promise<DeepPartial<SubscriptionResponse>>;
    /** 取消订阅 */
    unsubscribe(request: UnsubscribeRequest, context: CallContext & CallContextExt): Promise<DeepPartial<Empty>>;
    /** 获取订阅状态 */
    getSubscription(request: GetSubscriptionRequest, context: CallContext & CallContextExt): Promise<DeepPartial<SubscriptionResponse>>;
    /** 列出用户订阅 */
    listSubscriptions(request: ListSubscriptionsRequest, context: CallContext & CallContextExt): Promise<DeepPartial<ListSubscriptionsResponse>>;
    /** 获取实例统计信息（用于监控） */
    getInstanceStats(request: Empty, context: CallContext & CallContextExt): Promise<DeepPartial<InstanceStatsResponse>>;
}
export interface SubscriptionServiceClient<CallOptionsExt = {}> {
    /** 订阅策略（启动实时运行） */
    subscribe(request: DeepPartial<SubscribeRequest>, options?: CallOptions & CallOptionsExt): Promise<SubscriptionResponse>;
    /** 取消订阅 */
    unsubscribe(request: DeepPartial<UnsubscribeRequest>, options?: CallOptions & CallOptionsExt): Promise<Empty>;
    /** 获取订阅状态 */
    getSubscription(request: DeepPartial<GetSubscriptionRequest>, options?: CallOptions & CallOptionsExt): Promise<SubscriptionResponse>;
    /** 列出用户订阅 */
    listSubscriptions(request: DeepPartial<ListSubscriptionsRequest>, options?: CallOptions & CallOptionsExt): Promise<ListSubscriptionsResponse>;
    /** 获取实例统计信息（用于监控） */
    getInstanceStats(request: DeepPartial<Empty>, options?: CallOptions & CallOptionsExt): Promise<InstanceStatsResponse>;
}
type Builtin = Date | Function | Uint8Array | string | number | boolean | undefined;
export type DeepPartial<T> = T extends Builtin ? T : T extends globalThis.Array<infer U> ? globalThis.Array<DeepPartial<U>> : T extends ReadonlyArray<infer U> ? ReadonlyArray<DeepPartial<U>> : T extends {} ? {
    [K in keyof T]?: DeepPartial<T[K]>;
} : Partial<T>;
export interface MessageFns<T> {
    encode(message: T, writer?: BinaryWriter): BinaryWriter;
    decode(input: BinaryReader | Uint8Array, length?: number): T;
    fromJSON(object: any): T;
    toJSON(message: T): unknown;
    create(base?: DeepPartial<T>): T;
    fromPartial(object: DeepPartial<T>): T;
}
export {};
