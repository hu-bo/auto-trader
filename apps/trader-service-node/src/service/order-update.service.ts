import { Config, Inject, Logger, Provide, Scope, ScopeEnum } from '@midwayjs/core';
import type { ILogger } from '@midwayjs/core';
import { InjectEntityModel } from '@midwayjs/typeorm';
import type { Repository } from 'typeorm';
import { NatsService } from './nats.service.js';
import type { NatsConfig } from './nats.service.js';
import { Order, OrderStatus } from '../entity/order.entity.js';

interface OrderUpdateData {
  orderId: string;
  clientOrderId?: string;
  symbol: string;
  tradeType: string;
  side: string;
  positionSide?: string;
  orderType: string;
  status: string;
  price?: string;
  quantity: string;
  filledQuantity: string;
  avgPrice?: string;
  fee?: string;
  feeAsset?: string;
  reduceOnly: boolean;
  updateTime: number;
}

interface StrategyOrderUpdateData {
  algoId: string;
  clientAlgoId?: string;
  symbol: string;
  tradeType: string;
  side: string;
  positionSide?: string;
  strategyType: string;
  status: string;
  triggerPrice?: string;
  orderPrice?: string;
  quantity: string;
  triggerTime?: number;
  updateTime: number;
}

function mapCoreStatusToOrderStatus(status: string): OrderStatus | null {
  switch (status) {
    case 'new':
    case 'open':
      return OrderStatus.NEW;
    case 'partially_filled':
      return OrderStatus.PARTIALLY_FILLED;
    case 'filled':
      return OrderStatus.FILLED;
    case 'canceled':
    case 'cancelled':
      return OrderStatus.CANCELED;
    case 'rejected':
      return OrderStatus.REJECTED;
    case 'expired':
      return OrderStatus.EXPIRED;
    default:
      return null;
  }
}

function mapStrategyStatusToOrderStatus(status: string): OrderStatus | null {
  switch (status) {
    case 'live':
      return OrderStatus.NEW;
    case 'effective':
    case 'partially_effective':
      return OrderStatus.FILLED;
    case 'canceled':
    case 'cancelled':
      return OrderStatus.CANCELED;
    case 'failed':
      return OrderStatus.REJECTED;
    default:
      return null;
  }
}

@Provide()
@Scope(ScopeEnum.Singleton)
export class OrderUpdateService {
  @InjectEntityModel(Order)
  orderRepo?: Repository<Order>;

  @Inject()
  natsService!: NatsService;

  @Config('nats')
  natsConfig!: NatsConfig;

  @Logger()
  logger!: ILogger;

  private subscribedSubjects = new Set<string>();
  private exchangeSubjects = new Map<number, { orderSubject: string; strategySubject: string }>();

  isSubscribed(exchangeId: number): boolean {
    return this.exchangeSubjects.has(exchangeId);
  }

  subscribeForToken(exchangeId: number, exchangeType: string, token: string): void {
    const ex = (exchangeType ?? '').trim().toLowerCase();
    if (!token || !ex) {
      this.logger.warn('[OrderUpdate] Missing token or exchangeType, skip subscribe');
      return;
    }

    const prefix = this.natsConfig?.subjectPrefix ?? 'exchange';

    const orderSubject = `${prefix}.order_update.${ex}.${token}`;
    const strategySubject = `${prefix}.strategy_order_update.${ex}.${token}`;

    const existing = this.exchangeSubjects.get(exchangeId);
    if (existing?.orderSubject === orderSubject && existing?.strategySubject === strategySubject) {
      return;
    }
    if (existing) {
      this.natsService.unsubscribe(existing.orderSubject);
      this.natsService.unsubscribe(existing.strategySubject);
      this.subscribedSubjects.delete(existing.orderSubject);
      this.subscribedSubjects.delete(existing.strategySubject);
    }

    if (!this.subscribedSubjects.has(orderSubject)) {
      this.natsService.subscribe(orderSubject, (data) => {
        this.handleOrderUpdate(exchangeId, data as OrderUpdateData);
      });
      this.subscribedSubjects.add(orderSubject);
    }

    if (!this.subscribedSubjects.has(strategySubject)) {
      this.natsService.subscribe(strategySubject, (data) => {
        this.handleStrategyOrderUpdate(exchangeId, data as StrategyOrderUpdateData);
      });
      this.subscribedSubjects.add(strategySubject);
    }

    this.exchangeSubjects.set(exchangeId, { orderSubject, strategySubject });
    this.logger.info('[OrderUpdate] Subscribed for exchangeId=%s exchangeType=%s', exchangeId, ex);
  }

  private async handleOrderUpdate(exchangeId: number, data: OrderUpdateData): Promise<void> {
    if (!this.orderRepo) return;
    try {
      const status = mapCoreStatusToOrderStatus(data.status);
      if (!status) return;

      const updates: Record<string, unknown> = { status };
      if (data.filledQuantity) updates.filledQty = data.filledQuantity;
      if (data.avgPrice) updates.avgPrice = data.avgPrice;
      if (data.fee) updates.fee = data.fee;
      if (data.feeAsset) updates.feeAsset = data.feeAsset;
      if (status === OrderStatus.FILLED) updates.filledAt = new Date(data.updateTime);

      await this.orderRepo.update(
        { exchangeOrderId: data.orderId, exchangeId },
        updates as any
      );
    } catch (err) {
      this.logger.error('[OrderUpdate] Failed to handle order update: %s', err);
    }
  }

  private async handleStrategyOrderUpdate(exchangeId: number, data: StrategyOrderUpdateData): Promise<void> {
    if (!this.orderRepo) return;
    try {
      const status = mapStrategyStatusToOrderStatus(data.status);
      if (!status) return;

      const updates: Record<string, unknown> = { status };
      if (status === OrderStatus.FILLED && data.triggerTime) {
        updates.filledAt = new Date(data.triggerTime);
      }

      await this.orderRepo.update(
        { exchangeOrderId: data.algoId, exchangeId },
        updates as any
      );
    } catch (err) {
      this.logger.error('[OrderUpdate] Failed to handle strategy order update: %s', err);
    }
  }
}
