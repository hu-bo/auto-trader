import { Config, Inject, Provide, Scope, ScopeEnum } from '@midwayjs/core';
import { InjectEntityModel } from '@midwayjs/typeorm';
import type { Repository } from 'typeorm';
import { NatsService } from './nats.service.js';
import { ExchangeGrpcClient } from '../grpc/exchange-grpc.client.js';
import { ExchangeService } from './exchange.service.js';
import type { NatsConfig } from './nats.service.js';
import { Order, OrderStatus } from '../entity/order.entity.js';
import { createScopedLogger } from '../common/logger.js';

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
@Scope(ScopeEnum.Singleton, { allowDowngrade: true })
export class OrderUpdateService {
  @InjectEntityModel(Order)
  orderRepo?: Repository<Order>;

  @Inject()
  natsService!: NatsService;

  @Inject()
  exchangeGrpc!: ExchangeGrpcClient;

  @Inject()
  exchangeService!: ExchangeService;

  @Config('nats')
  natsConfig!: NatsConfig;

  private readonly logger = createScopedLogger('OrderUpdateService');

  private subscribedSubjects = new Set<string>();
  private exchangeSubjects = new Map<number, { orderSubject: string; strategySubject: string }>();
  private grpcSubscriptions = new Map<string, { stop: () => void }>();

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

  private normalizeTradeTypeForGrpc(tradeType: string): string {
    return tradeType === 'usdm-algo' ? 'futures' : tradeType;
  }

  ensureGrpcSubscribed(token: string, tradeType: string): void {
    const normalized = this.normalizeTradeTypeForGrpc(tradeType);
    const key = `${token}:${normalized}`;
    if (this.grpcSubscriptions.has(key)) return;
    const sub = this.exchangeGrpc.startSubscribeOrders({ token, tradeType: normalized });
    this.grpcSubscriptions.set(key, sub);
    this.logger.info('[OrderUpdate] Started gRPC SubscribeOrders for tradeType=%s', normalized);
  }

  async bootstrapSubscriptions(): Promise<void> {
    if (!this.orderRepo) return;

    const openStatuses = [OrderStatus.NEW, OrderStatus.PARTIALLY_FILLED];
    const rows = await this.orderRepo
      .createQueryBuilder('order')
      .select('order.userid', 'userid')
      .addSelect('order.exchangeId', 'exchangeId')
      .addSelect('order.tradeType', 'tradeType')
      .where('order.status IN (:...statuses)', { statuses: openStatuses })
      .groupBy('order.userid, order.exchangeId, order.tradeType')
      .getRawMany();

    if (!rows || rows.length === 0) return;

    const tokenCache = new Map<string, { token: string; exchangeType: string }>();

    for (const row of rows) {
      const userid = Number(row.userid);
      const exchangeId = Number(row.exchangeId);
      const tradeType = String(row.tradeType || '').trim();
      if (!userid || !exchangeId || !tradeType) continue;

      const cacheKey = `${userid}:${exchangeId}`;
      let cached = tokenCache.get(cacheKey);
      if (!cached) {
        try {
          const exchange = await this.exchangeService.get(userid, exchangeId);
          const creds = await this.exchangeService.getApiCredentials(userid, exchangeId);
          const initResp = await this.exchangeGrpc.initAccount({
            exchangeType: exchange.exchangeType,
            apiKey: creds.apiKey,
            apiSecret: creds.apiSecret,
            passphrase: creds.passphrase,
            demonet: exchange.isTestnet,
            name: exchange.name,
            accountId: exchangeId.toString(),
          });
          if (!initResp?.success || !initResp?.token) {
            this.logger.warn('[OrderUpdate] InitAccount failed for exchangeId=%s', exchangeId);
            continue;
          }
          cached = { token: initResp.token, exchangeType: exchange.exchangeType };
          tokenCache.set(cacheKey, cached);
        } catch (err) {
          this.logger.warn('[OrderUpdate] InitAccount failed for exchangeId=%s: %s', exchangeId, err);
          continue;
        }
      }

      this.subscribeForToken(exchangeId, cached.exchangeType, cached.token);
      this.ensureGrpcSubscribed(cached.token, tradeType);
    }
  }

  private async handleOrderUpdate(exchangeId: number, data: OrderUpdateData): Promise<void> {
    console.log('handleOrderUpdate', exchangeId, data)
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
    console.log('handleStrategyOrderUpdate', exchangeId)
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
