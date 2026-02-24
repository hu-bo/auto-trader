import { Inject, Logger, Provide, httpError } from '@midwayjs/core';
import type { ILogger } from '@midwayjs/core';
import { InjectEntityModel } from '@midwayjs/typeorm';
import type { Repository } from 'typeorm';
import { StrategyOrder } from '../entity/strategy-order.entity.js';
import { StrategySubscriptionGrpcClient } from '../grpc/strategy-subscription-grpc.client.js';

type StrategyOrderCreateParams = {
  userid: number;
  strategyId: number;
  exchangeId: number;
  tradeType?: string;
  symbols: string[];
  parameters?: Record<string, unknown>;
  riskConfig?: Record<string, unknown>;
  live?: boolean;
};

type StrategyOrderUpdateParams = {
  symbols?: string[] | null;
  parameters?: Record<string, unknown> | null;
  riskConfig?: Record<string, unknown> | null;
  live?: boolean | null;
};

@Provide()
export class StrategyOrderService {
  @InjectEntityModel(StrategyOrder)
  orderRepo?: Repository<StrategyOrder>;

  @Inject()
  strategyGrpcClient!: StrategySubscriptionGrpcClient;

  @Logger()
  logger!: ILogger;

  private requireRepo(): Repository<StrategyOrder> {
    if (!this.orderRepo) {
      throw new httpError.ServiceUnavailableError('Database not configured');
    }
    return this.orderRepo;
  }

  async listForUser(userid: number, page = 1, pageSize = 20): Promise<{ data: StrategyOrder[]; total: number }> {
    const repo = this.requireRepo();
    const [data, total] = await repo.findAndCount({
      where: { userid },
      relations: ['strategy', 'exchange'],
      order: { createdAt: 'DESC' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    });
    return { data, total };
  }

  async create(params: StrategyOrderCreateParams): Promise<StrategyOrder> {
    const repo = this.requireRepo();
    const order = repo.create({
      userid: params.userid,
      strategyId: params.strategyId,
      exchangeId: params.exchangeId,
      tradeType: params.tradeType ?? 'spot',
      symbols: params.symbols,
      parameters: params.parameters ?? {},
      riskConfig: params.riskConfig ?? {},
      live: params.live ?? false,
      isRunning: false,
      startedAt: null,
      stoppedAt: null,
    });
    return await repo.save(order);
  }

  async get(userid: number, orderId: number): Promise<StrategyOrder> {
    const repo = this.requireRepo();
    const order = await repo.findOne({
      where: { id: orderId },
      relations: ['strategy', 'exchange']
    });
    if (!order || order.userid !== userid) {
      throw new httpError.NotFoundError('Strategy order not found');
    }
    return order;
  }

  async update(userid: number, orderId: number, patch: StrategyOrderUpdateParams): Promise<StrategyOrder> {
    const repo = this.requireRepo();
    const order = await this.get(userid, orderId);

    if (patch.symbols !== undefined && patch.symbols !== null) order.symbols = patch.symbols;
    if (patch.parameters !== undefined && patch.parameters !== null) order.parameters = patch.parameters;
    if (patch.riskConfig !== undefined && patch.riskConfig !== null) order.riskConfig = patch.riskConfig;
    if (patch.live !== undefined && patch.live !== null) order.live = patch.live;

    return await repo.save(order);
  }

  async delete(userid: number, orderId: number): Promise<void> {
    const repo = this.requireRepo();
    const order = await this.get(userid, orderId);

    // If running, unsubscribe from strategy-engine first
    if (order.isRunning) {
      const period = (order.parameters as any)?.period ?? '15m';
      for (const symbol of order.symbols) {
        const instanceKey = `${order.strategyId}:${(order.exchange?.exchangeType ?? '').toLowerCase()}:${order.tradeType}:${symbol}:${period}`;
        try {
          await this.strategyGrpcClient.unsubscribe({
            subscriptionId: `${order.id}:${symbol}`,
            instanceKey,
          });
        } catch (err) {
          this.logger.warn('[StrategyOrder] Failed to unsubscribe order %d symbol %s on delete: %s', order.id, symbol, err);
        }
      }
    }

    await repo.remove(order);
  }

  async start(userid: number, orderId: number): Promise<StrategyOrder> {
    const repo = this.requireRepo();
    const order = await this.get(userid, orderId);

    order.isRunning = true;
    order.startedAt = new Date();
    order.stoppedAt = null;
    const saved = await repo.save(order);

    // Call strategy-engine gRPC for each symbol
    try {
      const period = (order.parameters as any)?.period ?? '15m';
      for (const symbol of order.symbols) {
        await this.strategyGrpcClient.subscribe({
          userId: String(order.userid),
          subscriptionId: `${order.id}:${symbol}`,
          strategyId: String(order.strategyId),
          strategyName: order.strategy?.name ?? '',
          code: order.strategy?.code ?? '',
          symbol,
          exchange: (order.exchange?.exchangeType ?? '').toLowerCase(),
          tradeType: order.tradeType,
          period,
          parameters: JSON.stringify(order.parameters ?? {}),
          riskConfig: JSON.stringify(order.riskConfig ?? {}),
          live: order.live,
        });
      }
    } catch (err) {
      // Rollback DB state on gRPC failure
      order.isRunning = false;
      order.startedAt = null;
      await repo.save(order);
      throw err;
    }

    return saved;
  }

  async stop(userid: number, orderId: number): Promise<StrategyOrder> {
    const repo = this.requireRepo();
    const order = await this.get(userid, orderId);

    // Call strategy-engine gRPC unsubscribe for each symbol
    const period = (order.parameters as any)?.period ?? '15m';
    for (const symbol of order.symbols) {
      const instanceKey = `${order.strategyId}:${(order.exchange?.exchangeType ?? '').toLowerCase()}:${order.tradeType}:${symbol}:${period}`;
      try {
        await this.strategyGrpcClient.unsubscribe({
          subscriptionId: `${order.id}:${symbol}`,
          instanceKey,
        });
      } catch (err) {
        this.logger.warn('[StrategyOrder] Failed to unsubscribe order %d symbol %s on stop: %s', order.id, symbol, err);
      }
    }

    order.isRunning = false;
    order.stoppedAt = new Date();
    return await repo.save(order);
  }
}
