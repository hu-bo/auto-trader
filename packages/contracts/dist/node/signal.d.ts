import { BinaryReader, BinaryWriter } from "@bufbuild/protobuf/wire";
export declare const protobufPackage = "signal";
/** 信号类型 */
export declare enum SignalType {
    SIGNAL_TYPE_UNSPECIFIED = 0,
    /** SIGNAL_TYPE_ENTRY_LONG - 开多 */
    SIGNAL_TYPE_ENTRY_LONG = 1,
    /** SIGNAL_TYPE_ENTRY_SHORT - 开空 */
    SIGNAL_TYPE_ENTRY_SHORT = 2,
    /** SIGNAL_TYPE_EXIT_LONG - 平多 */
    SIGNAL_TYPE_EXIT_LONG = 3,
    /** SIGNAL_TYPE_EXIT_SHORT - 平空 */
    SIGNAL_TYPE_EXIT_SHORT = 4,
    /** SIGNAL_TYPE_STOP_LOSS - 止损 */
    SIGNAL_TYPE_STOP_LOSS = 5,
    /** SIGNAL_TYPE_TAKE_PROFIT - 止盈 */
    SIGNAL_TYPE_TAKE_PROFIT = 6,
    /** SIGNAL_TYPE_REBALANCE - 再平衡 */
    SIGNAL_TYPE_REBALANCE = 7,
    UNRECOGNIZED = -1
}
export declare function signalTypeFromJSON(object: any): SignalType;
export declare function signalTypeToJSON(object: SignalType): string;
/** 信号来源 */
export declare enum SignalSource {
    SIGNAL_SOURCE_UNSPECIFIED = 0,
    /** SIGNAL_SOURCE_STRATEGY - 策略引擎 */
    SIGNAL_SOURCE_STRATEGY = 1,
    /** SIGNAL_SOURCE_RISK - 风控引擎 */
    SIGNAL_SOURCE_RISK = 2,
    /** SIGNAL_SOURCE_USER - 用户手动 */
    SIGNAL_SOURCE_USER = 3,
    /** SIGNAL_SOURCE_ADMIN - 管理员 */
    SIGNAL_SOURCE_ADMIN = 4,
    UNRECOGNIZED = -1
}
export declare function signalSourceFromJSON(object: any): SignalSource;
export declare function signalSourceToJSON(object: SignalSource): string;
/** 信号状态 */
export declare enum SignalStatus {
    SIGNAL_STATUS_UNSPECIFIED = 0,
    /** SIGNAL_STATUS_PENDING - 待处理 */
    SIGNAL_STATUS_PENDING = 1,
    /** SIGNAL_STATUS_PROCESSING - 处理中 */
    SIGNAL_STATUS_PROCESSING = 2,
    /** SIGNAL_STATUS_COMPLETED - 已完成 */
    SIGNAL_STATUS_COMPLETED = 3,
    /** SIGNAL_STATUS_REJECTED - 已拒绝 */
    SIGNAL_STATUS_REJECTED = 4,
    /** SIGNAL_STATUS_CANCELLED - 已取消 */
    SIGNAL_STATUS_CANCELLED = 5,
    UNRECOGNIZED = -1
}
export declare function signalStatusFromJSON(object: any): SignalStatus;
export declare function signalStatusToJSON(object: SignalStatus): string;
/** 信号元数据 */
export interface SignalMetadata {
    strategyId: string;
    symbol: string;
    exchange: string;
    tags: {
        [key: string]: string;
    };
    notes: string;
}
export interface SignalMetadata_TagsEntry {
    key: string;
    value: string;
}
/** 信号 */
export interface Signal {
    id: string;
    type: SignalType;
    source: SignalSource;
    status: SignalStatus;
    /** 交易参数 */
    symbol: string;
    exchange: string;
    quantity: number;
    price: number;
    stopLoss: number;
    takeProfit: number;
    /** 时间戳 */
    createdAt: Date | undefined;
    updatedAt: Date | undefined;
    executedAt: Date | undefined;
    /** 元数据 */
    metadata: SignalMetadata | undefined;
    /** 原始数据（JSON字符串） */
    rawData: string;
    /** 错误信息 */
    errorMessage: string;
}
/** 信号列表 */
export interface SignalList {
    signals: Signal[];
    total: number;
    page: number;
    pageSize: number;
}
/** 信号查询请求 */
export interface SignalQueryRequest {
    types: SignalType[];
    sources: SignalSource[];
    statuses: SignalStatus[];
    symbol: string;
    exchange: string;
    startTime: Date | undefined;
    endTime: Date | undefined;
    page: number;
    pageSize: number;
}
/** 信号查询响应 */
export interface SignalQueryResponse {
    signals: SignalList | undefined;
    hasMore: boolean;
}
/** 信号创建请求 */
export interface SignalCreateRequest {
    type: SignalType;
    source: SignalSource;
    symbol: string;
    exchange: string;
    quantity: number;
    price: number;
    stopLoss: number;
    takeProfit: number;
    metadata: SignalMetadata | undefined;
    rawData: string;
}
/** 信号创建响应 */
export interface SignalCreateResponse {
    signal: Signal | undefined;
    success: boolean;
    errorMessage: string;
}
/** 信号更新请求 */
export interface SignalUpdateRequest {
    id: string;
    status: SignalStatus;
    errorMessage: string;
    executedPrice: number;
    executedQuantity: number;
    executedAt: Date | undefined;
}
/** 信号更新响应 */
export interface SignalUpdateResponse {
    signal: Signal | undefined;
    success: boolean;
    errorMessage: string;
}
/** 信号批量处理请求 */
export interface SignalBatchProcessRequest {
    signalIds: string[];
    newStatus: SignalStatus;
    reason: string;
}
/** 信号批量处理响应 */
export interface SignalBatchProcessResponse {
    processedCount: number;
    failedCount: number;
    failedIds: string[];
}
export declare const SignalMetadata: MessageFns<SignalMetadata>;
export declare const SignalMetadata_TagsEntry: MessageFns<SignalMetadata_TagsEntry>;
export declare const Signal: MessageFns<Signal>;
export declare const SignalList: MessageFns<SignalList>;
export declare const SignalQueryRequest: MessageFns<SignalQueryRequest>;
export declare const SignalQueryResponse: MessageFns<SignalQueryResponse>;
export declare const SignalCreateRequest: MessageFns<SignalCreateRequest>;
export declare const SignalCreateResponse: MessageFns<SignalCreateResponse>;
export declare const SignalUpdateRequest: MessageFns<SignalUpdateRequest>;
export declare const SignalUpdateResponse: MessageFns<SignalUpdateResponse>;
export declare const SignalBatchProcessRequest: MessageFns<SignalBatchProcessRequest>;
export declare const SignalBatchProcessResponse: MessageFns<SignalBatchProcessResponse>;
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
