import { Inject, Logger, Provide, httpError } from '@midwayjs/core';
import type { ILogger } from '@midwayjs/core';
import { InjectEntityModel } from '@midwayjs/typeorm';
import type { Repository } from 'typeorm';
import { Order, OrderStatus } from '../entity/order.entity.js';

type OrderListParams = {
  userid: number;
  exchangeId: number;
  symbol?: string;
  limit?: number;
  offset?: number;
};

@Provide()
export class OrderService {
  @InjectEntityModel(Order)
  orderRepo?: Repository<Order>;

  @Logger()
  logger!: ILogger;

  private requireRepo(): Repository<Order> {
    if (!this.orderRepo) {
      throw new httpError.ServiceUnavailableError('Database not configured');
    }
    return this.orderRepo;
  }

  async listPending(params: OrderListParams): Promise<{ orders: Order[]; total: number }> {
    const repo = this.requireRepo();
    const where: Record<string, unknown> = {
      userid: params.userid,
      exchangeId: params.exchangeId,
      status: OrderStatus.NEW,
    };
    if (params.symbol) {
      where.symbol = params.symbol;
    }
    const [orders, total] = await repo.findAndCount({
      where,
      order: { createdAt: 'DESC' },
      skip: params.offset ?? 0,
      take: params.limit ?? 50,
    });
    return { orders, total };
  }

  async get(userid: number, orderId: string): Promise<Order> {
    const repo = this.requireRepo();
    const order = await repo.findOne({
      where: { orderid: orderId },
      relations: ['exchange'],
    });
    if (!order || order.userid !== userid) {
      throw new httpError.NotFoundError('Order not found');
    }
    return order;
  }

  async createBatch(orders: Partial<Order>[]): Promise<Order[]> {
    const repo = this.requireRepo();
    const entities = orders.map(o => repo.create(o));
    return await repo.save(entities);
  }

  async updateByExchangeOrderId(
    exchangeOrderId: string,
    exchangeId: number,
    updates: Partial<Pick<Order, 'status' | 'filledQty' | 'avgPrice' | 'fee' | 'feeAsset' | 'filledAt'>>
  ): Promise<void> {
    const repo = this.requireRepo();
    await repo.update(
      { exchangeOrderId, exchangeId },
      updates as any
    );
  }
}
