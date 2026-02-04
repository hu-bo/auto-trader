import { Provide, httpError } from '@midwayjs/core';
import { InjectEntityModel } from '@midwayjs/typeorm';
import type { Repository } from 'typeorm';
import { StrategyOrder } from '../entity/strategy-order.entity.js';

type StrategyOrderCreateParams = {
  userId: string;
  strategyId: string;
  exchangeId: string;
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

  private requireRepo(): Repository<StrategyOrder> {
    if (!this.orderRepo) {
      throw new httpError.ServiceUnavailableError('Database not configured');
    }
    return this.orderRepo;
  }

  async listForUser(userId: string): Promise<StrategyOrder[]> {
    const repo = this.requireRepo();
    return repo.find({ where: { userId }, order: { createdAt: 'DESC' } });
  }

  async create(params: StrategyOrderCreateParams): Promise<StrategyOrder> {
    const repo = this.requireRepo();
    const order = repo.create({
      userId: params.userId,
      strategyId: params.strategyId,
      exchangeId: params.exchangeId,
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

  async get(userId: string, orderId: string): Promise<StrategyOrder> {
    const repo = this.requireRepo();
    const order = await repo.findOne({ where: { id: orderId } });
    if (!order || order.userId !== userId) {
      throw new httpError.NotFoundError('Strategy order not found');
    }
    return order;
  }

  async update(userId: string, orderId: string, patch: StrategyOrderUpdateParams): Promise<StrategyOrder> {
    const repo = this.requireRepo();
    const order = await this.get(userId, orderId);

    if (patch.symbols !== undefined && patch.symbols !== null) order.symbols = patch.symbols;
    if (patch.parameters !== undefined && patch.parameters !== null) order.parameters = patch.parameters;
    if (patch.riskConfig !== undefined && patch.riskConfig !== null) order.riskConfig = patch.riskConfig;
    if (patch.live !== undefined && patch.live !== null) order.live = patch.live;

    return await repo.save(order);
  }

  async delete(userId: string, orderId: string): Promise<void> {
    const repo = this.requireRepo();
    const order = await this.get(userId, orderId);
    await repo.remove(order);
  }

  async start(userId: string, orderId: string): Promise<StrategyOrder> {
    const repo = this.requireRepo();
    const order = await this.get(userId, orderId);
    order.isRunning = true;
    order.startedAt = new Date();
    order.stoppedAt = null;
    return await repo.save(order);
  }

  async stop(userId: string, orderId: string): Promise<StrategyOrder> {
    const repo = this.requireRepo();
    const order = await this.get(userId, orderId);
    order.isRunning = false;
    order.stoppedAt = new Date();
    return await repo.save(order);
  }
}

