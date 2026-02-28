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

  private subscribedIds = new Set<string>();

  subscribeForExchange(exchangeId: number): void {
    const id = exchangeId.toString();
    if (this.subscribedIds.has(id)) return;

    const prefix = this.natsConfig?.subjectPrefix ?? 'exchange';

    this.natsService.subscribe(`${prefix}.order_update.${id}`, (data) => {
      this.handleOrderUpdate(exchangeId, data as OrderUpdateData);
    });

    this.natsService.subscribe(`${prefix}.strategy_order_update.${id}`, (data) => {
      this.handleStrategyOrderUpdate(exchangeId, data as StrategyOrderUpdateData);
    });

    this.subscribedIds.add(id);
    this.logger.info('[OrderUpdate] Subscribed for exchangeId=%s', id);
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
