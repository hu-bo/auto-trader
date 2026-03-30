import { Config, Provide, Scope, ScopeEnum, httpError } from '@midwayjs/core';
import { createChannel, createClient, ClientError, Status } from 'nice-grpc';
import {
  SubscriptionServiceDefinition,
  type SubscriptionServiceClient,
  type SubscribeRequest,
  type UnsubscribeRequest,
  type ListSubscriptionsRequest,
  type InstanceStatsResponse,
  type SubscriptionResponse,
  type ListSubscriptionsResponse,
} from '@hquant/contracts/strategy_subscription';
import type { GrpcTlsConfig, StrategyEngineConfig } from '../types/index.js';
import { resolveGrpcChannelSecurity } from './grpc-tls.js';
import { createScopedLogger } from '../common/logger.js';

function mapGrpcError(err: ClientError): Error {
  const message = err.details || err.message || 'gRPC request failed';
  switch (err.code) {
    case Status.INVALID_ARGUMENT:
      return new httpError.BadRequestError(message);
    case Status.UNAUTHENTICATED:
      return new httpError.UnauthorizedError(message);
    case Status.PERMISSION_DENIED:
      return new httpError.ForbiddenError(message);
    case Status.NOT_FOUND:
      return new httpError.NotFoundError(message);
    case Status.ALREADY_EXISTS:
      return new httpError.ConflictError(message);
    case Status.UNAVAILABLE:
      return new httpError.BadGatewayError(message);
    default:
      return new httpError.BadGatewayError(message);
  }
}

@Provide()
@Scope(ScopeEnum.Singleton)
export class StrategySubscriptionGrpcClient {
  @Config('strategyEngine')
  strategyEngine!: StrategyEngineConfig;

  @Config('grpcTls')
  grpcTls!: GrpcTlsConfig;

  private readonly logger = createScopedLogger('StrategySubscriptionGrpcClient');

  private client?: SubscriptionServiceClient;

  private getClient(): SubscriptionServiceClient {
    if (this.client) return this.client;

    const url = (this.strategyEngine?.grpc ?? '').trim();
    if (!url) {
      throw new httpError.ServiceUnavailableError('STRATEGY_ENGINE_GRPC_URL is required');
    }

    const { credentials, options } = resolveGrpcChannelSecurity(this.grpcTls);
    const channel = createChannel(url, credentials, options);
    this.client = createClient(SubscriptionServiceDefinition, channel);
    return this.client;
  }

  private async callWithRetry<T>(fn: () => Promise<T>, retries = 2): Promise<T> {
    let lastErr: ClientError | null = null;
    for (let i = 0; i <= retries; i++) {
      try {
        return await fn();
      } catch (err: any) {
        lastErr = err;
        if (i < retries && err?.code === Status.UNAVAILABLE) {
          this.logger.warn('[StrategyGrpc] UNAVAILABLE, retrying (%d/%d)...', i + 1, retries);
          await new Promise(r => setTimeout(r, 1000 * (i + 1)));
          this.client = undefined;
          continue;
        }
        throw mapGrpcError(err);
      }
    }
    throw lastErr ? mapGrpcError(lastErr) : new Error('gRPC request failed');
  }

  async subscribe(params: {
    userId: string;
    subscriptionId: string;
    strategyId: string;
    strategyName: string;
    code: string;
    symbol: string;
    exchange: string;
    tradeType: string;
    period: string;
    parameters: string;
    riskConfig: string;
    live: boolean;
  }): Promise<SubscriptionResponse> {
    const req: SubscribeRequest = {
      userId: params.userId,
      subscriptionId: params.subscriptionId,
      strategyId: params.strategyId,
      strategyName: params.strategyName,
      code: params.code,
      symbol: params.symbol,
      exchange: params.exchange,
      tradeType: params.tradeType,
      period: params.period,
      parameters: params.parameters,
      riskConfig: params.riskConfig,
      live: params.live,
    };
    return this.callWithRetry(() => this.getClient().subscribe(req));
  }

  async unsubscribe(params: {
    subscriptionId: string;
    instanceKey: string;
  }): Promise<void> {
    const req: UnsubscribeRequest = {
      subscriptionId: params.subscriptionId,
      instanceKey: params.instanceKey,
    };
    await this.callWithRetry(() => this.getClient().unsubscribe(req));
  }

  async listSubscriptions(params?: { userId?: string }): Promise<ListSubscriptionsResponse> {
    const req: ListSubscriptionsRequest = { userId: params?.userId ?? '', pageSize: 0, pageToken: '' };
    return this.callWithRetry(() => this.getClient().listSubscriptions(req));
  }

  async getInstanceStats(): Promise<InstanceStatsResponse> {
    return this.callWithRetry(() => this.getClient().getInstanceStats({}));
  }
}
