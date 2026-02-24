import { Provide, httpError } from '@midwayjs/core';
import { InjectEntityModel } from '@midwayjs/typeorm';
import type { Repository } from 'typeorm';
import { StrategyOrder } from '../entity/strategy-order.entity.js';

type StrategyOrderCreateParams = {
  userid: number;
  strategyId: number;
  exchangeId: number;
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
    await repo.remove(order);
  }

  async start(userid: number, orderId: number): Promise<StrategyOrder> {
    const repo = this.requireRepo();
    const order = await this.get(userid, orderId);
    order.isRunning = true;
    order.startedAt = new Date();
    order.stoppedAt = null;
    return await repo.save(order);
  }

  async stop(userid: number, orderId: number): Promise<StrategyOrder> {
    const repo = this.requireRepo();
    const order = await this.get(userid, orderId);
    order.isRunning = false;
    order.stoppedAt = new Date();
    return await repo.save(order);
  }
}
