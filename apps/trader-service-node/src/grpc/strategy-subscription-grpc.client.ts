import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import { Config, Logger, Provide, Scope, ScopeEnum, httpError } from '@midwayjs/core';
import type { ILogger } from '@midwayjs/core';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import type { GrpcTlsConfig, StrategyEngineConfig } from '../types/index.js';
import { resolveGrpcChannelSecurity } from './grpc-tls.js';

function mapGrpcError(err: grpc.ServiceError): Error {
  const message = err.details || err.message || 'gRPC request failed';
  switch (err.code) {
    case grpc.status.INVALID_ARGUMENT:
      return new httpError.BadRequestError(message);
    case grpc.status.UNAUTHENTICATED:
      return new httpError.UnauthorizedError(message);
    case grpc.status.PERMISSION_DENIED:
      return new httpError.ForbiddenError(message);
    case grpc.status.NOT_FOUND:
      return new httpError.NotFoundError(message);
    case grpc.status.ALREADY_EXISTS:
      return new httpError.ConflictError(message);
    case grpc.status.UNAVAILABLE:
      return new httpError.BadGatewayError(message);
    default:
      return new httpError.BadGatewayError(message);
  }
}

type SubscriptionServiceClient = {
  Subscribe: (req: any, cb: (err: grpc.ServiceError | null, res: any) => void) => void;
  Unsubscribe: (req: any, cb: (err: grpc.ServiceError | null, res: any) => void) => void;
  GetSubscription: (req: any, cb: (err: grpc.ServiceError | null, res: any) => void) => void;
  ListSubscriptions: (req: any, cb: (err: grpc.ServiceError | null, res: any) => void) => void;
  GetInstanceStats: (req: any, cb: (err: grpc.ServiceError | null, res: any) => void) => void;
};

@Provide()
@Scope(ScopeEnum.Singleton)
export class StrategySubscriptionGrpcClient {
  @Config('strategyEngine')
  strategyEngine!: StrategyEngineConfig;

  @Config('grpcTls')
  grpcTls!: GrpcTlsConfig;

  @Logger()
  logger!: ILogger;

  private client?: SubscriptionServiceClient;

  private getClient(): SubscriptionServiceClient {
    if (this.client) return this.client;

    const url = (this.strategyEngine?.grpc ?? '').trim();
    if (!url) {
      throw new httpError.ServiceUnavailableError('STRATEGY_ENGINE_GRPC_URL is required');
    }

    const __filename = fileURLToPath(import.meta.url);
    const __dirname = dirname(__filename);
    const protoPath = join(__dirname, '../../../../packages/contracts/proto/strategy_subscription.proto');

    const packageDefinition = protoLoader.loadSync(protoPath, {
      keepCase: true,
      longs: String,
      enums: String,
      defaults: true,
      oneofs: true,
    });

    const loaded = grpc.loadPackageDefinition(packageDefinition) as any;
    const ServiceCtor = loaded?.strategy_subscription?.v1?.SubscriptionService;
    if (!ServiceCtor) {
      throw new httpError.ServiceUnavailableError('Failed to load strategy_subscription proto');
    }

    const { credentials, options } = resolveGrpcChannelSecurity(this.grpcTls);
    this.client = new ServiceCtor(url, credentials, options) as SubscriptionServiceClient;
    return this.client;
  }

  private async unaryRaw<T>(fn: (cb: (err: grpc.ServiceError | null, res: T) => void) => void): Promise<T> {
    return await new Promise<T>((resolve, reject) => {
      fn((err, res) => {
        if (err) return reject(err);
        resolve(res);
      });
    });
  }

  private async unaryWithRetry<T>(
    fn: (cb: (err: grpc.ServiceError | null, res: T) => void) => void,
    retries = 2
  ): Promise<T> {
    let lastErr: grpc.ServiceError | null = null;
    for (let i = 0; i <= retries; i++) {
      try {
        return await this.unaryRaw<T>(fn);
      } catch (err: any) {
        lastErr = err;
        if (i < retries && err?.code === grpc.status.UNAVAILABLE) {
          this.logger.warn('[StrategyGrpc] UNAVAILABLE, retrying (%d/%d)...', i + 1, retries);
          await new Promise(r => setTimeout(r, 1000 * (i + 1))); // backoff
          this.client = undefined; // reset client for reconnect
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
  }): Promise<any> {
    const client = this.getClient();
    const req = {
      user_id: params.userId,
      subscription_id: params.subscriptionId,
      strategy_id: params.strategyId,
      strategy_name: params.strategyName,
      code: params.code,
      symbol: params.symbol,
      exchange: params.exchange,
      trade_type: params.tradeType,
      period: params.period,
      parameters: params.parameters,
      risk_config: params.riskConfig,
      live: params.live,
    };
    return await this.unaryWithRetry(cb => client.Subscribe(req, cb));
  }

  async unsubscribe(params: {
    subscriptionId: string;
    instanceKey: string;
  }): Promise<void> {
    const client = this.getClient();
    const req = {
      subscription_id: params.subscriptionId,
      instance_key: params.instanceKey,
    };
    await this.unaryWithRetry(cb => client.Unsubscribe(req, cb));
  }

  async listSubscriptions(params?: {
    userId?: string;
  }): Promise<any> {
    const client = this.getClient();
    const req: any = {};
    if (params?.userId) req.user_id = params.userId;
    return await this.unaryWithRetry(cb => client.ListSubscriptions(req, cb));
  }

  async getInstanceStats(): Promise<any> {
    const client = this.getClient();
    return await this.unaryWithRetry(cb => client.GetInstanceStats({}, cb));
  }
}
