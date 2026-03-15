import { Inject, Provide, httpError } from '@midwayjs/core';
import { InjectEntityModel } from '@midwayjs/typeorm';
import type { Repository } from 'typeorm';
import { StrategyOrder } from '../entity/strategy-order.entity.js';
import { RiskConfig } from '../entity/risk-config.entity.js';
import { StrategySubscriptionGrpcClient } from '../grpc/strategy-subscription-grpc.client.js';
import { createScopedLogger } from '../common/logger.js';

type StrategyOrderCreateParams = {
  userid: number;
  strategyId: number;
  exchangeId: number;
  tradeType?: string;
  orderType?: string;
  leverage?: number;
  symbols: string[];
  riskConfig?: Record<string, unknown>;
  buyPriceOffsetPercent?: number;
  sellPriceOffsetPercent?: number;
  stopLossPercent?: number;
  takeProfitPercent?: number;
  // spot 金额
  amountBuy?: number;
  amountSell?: number;
  // futures 金额
  amountBuyLong?: number;
  amountSellLong?: number;
  amountBuyShort?: number;
  amountSellShort?: number;
  live?: boolean;
};

type StrategyOrderUpdateParams = {
  strategyId?: number | null;
  symbols?: string[] | null;
  riskConfig?: Record<string, unknown> | null;
  orderType?: string | null;
  leverage?: number | null;
  buyPriceOffsetPercent?: number | null;
  sellPriceOffsetPercent?: number | null;
  stopLossPercent?: number | null;
  takeProfitPercent?: number | null;
  // spot 金额
  amountBuy?: number | null;
  amountSell?: number | null;
  // futures 金额
  amountBuyLong?: number | null;
  amountSellLong?: number | null;
  amountBuyShort?: number | null;
  amountSellShort?: number | null;
  live?: boolean | null;
};

@Provide()
export class StrategyOrderService {
  @InjectEntityModel(StrategyOrder)
  orderRepo?: Repository<StrategyOrder>;

  @InjectEntityModel(RiskConfig)
  riskConfigRepo?: Repository<RiskConfig>;

  @Inject()
  strategyGrpcClient!: StrategySubscriptionGrpcClient;

  private readonly logger = createScopedLogger('StrategyOrderService');

  private requireRepo(): Repository<StrategyOrder> {
    if (!this.orderRepo) {
      throw new httpError.ServiceUnavailableError('Database not configured');
    }
    return this.orderRepo;
  }

  private requireRiskConfigRepo(): Repository<RiskConfig> {
    if (!this.riskConfigRepo) {
      throw new httpError.ServiceUnavailableError('Database not configured');
    }
    return this.riskConfigRepo;
  }

  /** Convert a flat riskConfig dict into RiskConfig entity fields */
  private toRiskConfigFields(data: Record<string, unknown>): Partial<RiskConfig> {
    const { maxPositionSize, maxDailyLoss, maxDrawdown, stopLossPercent, takeProfitPercent, maxLeverage, ...rest } = data;
    return {
      maxPositionSize: maxPositionSize != null ? String(maxPositionSize) : null,
      maxDailyLoss: maxDailyLoss != null ? String(maxDailyLoss) : null,
      maxDrawdown: maxDrawdown != null ? String(maxDrawdown) : null,
      stopLossPercent: stopLossPercent != null ? String(stopLossPercent) : null,
      takeProfitPercent: takeProfitPercent != null ? String(takeProfitPercent) : null,
      maxLeverage: maxLeverage != null ? Number(maxLeverage) : null,
      extra: Object.keys(rest).length > 0 ? rest : {},
    };
  }

  /** Convert RiskConfig entity back to a plain dict for API responses / gRPC */
  riskConfigToDict(rc: RiskConfig | null | undefined): Record<string, unknown> {
    if (!rc) return {};
    const result: Record<string, unknown> = {};
    if (rc.maxPositionSize != null) result.maxPositionSize = Number(rc.maxPositionSize);
    if (rc.maxDailyLoss != null) result.maxDailyLoss = Number(rc.maxDailyLoss);
    if (rc.maxDrawdown != null) result.maxDrawdown = Number(rc.maxDrawdown);
    if (rc.stopLossPercent != null) result.stopLossPercent = Number(rc.stopLossPercent);
    if (rc.takeProfitPercent != null) result.takeProfitPercent = Number(rc.takeProfitPercent);
    if (rc.maxLeverage != null) result.maxLeverage = rc.maxLeverage;
    if (rc.extra && Object.keys(rc.extra).length > 0) Object.assign(result, rc.extra);
    return result;
  }

  /** Convert StrategyOrder entity to JSON response (camelCase) */
  toJson(order: StrategyOrder) {
    return {
      id: order.id,
      userid: order.userid,
      strategyId: order.strategyId,
      strategyName: order.strategy?.name || '',
      strategyParams: order.strategy?.params ?? {},
      exchangeId: order.exchangeId,
      exchangeName: order.exchange?.name || '',
      exchangeType: order.exchange?.exchangeType || '',
      tradeType: order.tradeType,
      orderType: order.orderType,
      leverage: order.leverage,
      symbols: order.symbols ?? [],
      riskConfigId: order.riskConfig?.id ?? null,
      riskConfig: this.riskConfigToDict(order.riskConfig),
      buyPriceOffsetPercent: order.buyPriceOffsetPercent ?? 1,
      sellPriceOffsetPercent: order.sellPriceOffsetPercent ?? 1,
      stopLossPercent: order.stopLossPercent ?? 2,
      takeProfitPercent: order.takeProfitPercent ?? 5,
      amountBuy: order.amountBuy ?? 0,
      amountSell: order.amountSell ?? 0,
      amountBuyLong: order.amountBuyLong ?? 0,
      amountSellLong: order.amountSellLong ?? 0,
      amountBuyShort: order.amountBuyShort ?? 0,
      amountSellShort: order.amountSellShort ?? 0,
      live: order.live,
      isRunning: order.isRunning,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
    };
  }

  async listForUser(userid: number, page = 1, pageSize = 20): Promise<{ data: StrategyOrder[]; total: number }> {
    const repo = this.requireRepo();
    const [data, total] = await repo.findAndCount({
      where: { userid },
      relations: ['strategy', 'exchange', 'riskConfig'],
      order: { createdAt: 'DESC' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    });
    return { data, total };
  }

  async create(params: StrategyOrderCreateParams): Promise<StrategyOrder> {
    const repo = this.requireRepo();
    const rcRepo = this.requireRiskConfigRepo();

    const order = repo.create({
      userid: params.userid,
      strategyId: params.strategyId,
      exchangeId: params.exchangeId,
      tradeType: params.tradeType ?? 'spot',
      orderType: params.orderType ?? 'limit',
      leverage: params.leverage ?? 10,
      symbols: params.symbols,
      buyPriceOffsetPercent: params.buyPriceOffsetPercent ?? 1,
      sellPriceOffsetPercent: params.sellPriceOffsetPercent ?? 1,
      stopLossPercent: params.stopLossPercent ?? 2,
      takeProfitPercent: params.takeProfitPercent ?? 5,
      amountBuy: params.amountBuy ?? 0,
      amountSell: params.amountSell ?? 0,
      amountBuyLong: params.amountBuyLong ?? 0,
      amountSellLong: params.amountSellLong ?? 0,
      amountBuyShort: params.amountBuyShort ?? 0,
      amountSellShort: params.amountSellShort ?? 0,
      live: params.live ?? false,
      isRunning: false,
    });
    const savedOrder = await repo.save(order);

    // Reload with relations
    const fullOrder = await repo.findOne({
      where: { id: savedOrder.id },
      relations: ['strategy', 'exchange'],
    });
    if (!fullOrder) throw new httpError.InternalServerErrorError('Failed to reload order');

    // Create associated risk config
    const rcData = params.riskConfig ?? {};
    const rc = rcRepo.create({
      userid: params.userid,
      name: null,
      strategyOrderId: fullOrder.id,
      ...this.toRiskConfigFields(rcData),
    });
    fullOrder.riskConfig = await rcRepo.save(rc);

    return fullOrder;
  }

  async get(userid: number, orderId: number): Promise<StrategyOrder> {
    const repo = this.requireRepo();
    const order = await repo.findOne({
      where: { id: orderId },
      relations: ['strategy', 'exchange', 'riskConfig']
    });
    if (!order || order.userid !== userid) {
      throw new httpError.NotFoundError('Strategy order not found');
    }
    return order;
  }

  async update(userid: number, orderId: number, patch: StrategyOrderUpdateParams): Promise<StrategyOrder> {
    const repo = this.requireRepo();
    const rcRepo = this.requireRiskConfigRepo();
    const order = await this.get(userid, orderId);

    if (patch.strategyId !== undefined && patch.strategyId !== null) order.strategyId = patch.strategyId;
    if (patch.symbols !== undefined && patch.symbols !== null) order.symbols = patch.symbols;
    if (patch.live !== undefined && patch.live !== null) order.live = patch.live;
    if (patch.orderType !== undefined && patch.orderType !== null) order.orderType = patch.orderType;
    if (patch.leverage !== undefined && patch.leverage !== null) order.leverage = patch.leverage;
    if (patch.buyPriceOffsetPercent !== undefined && patch.buyPriceOffsetPercent !== null) {
      order.buyPriceOffsetPercent = patch.buyPriceOffsetPercent;
    }
    if (patch.sellPriceOffsetPercent !== undefined && patch.sellPriceOffsetPercent !== null) {
      order.sellPriceOffsetPercent = patch.sellPriceOffsetPercent;
    }
    if (patch.stopLossPercent !== undefined && patch.stopLossPercent !== null) {
      order.stopLossPercent = patch.stopLossPercent;
    }
    if (patch.takeProfitPercent !== undefined && patch.takeProfitPercent !== null) {
      order.takeProfitPercent = patch.takeProfitPercent;
    }
    // 金额字段
    if (patch.amountBuy !== undefined && patch.amountBuy !== null) order.amountBuy = patch.amountBuy;
    if (patch.amountSell !== undefined && patch.amountSell !== null) order.amountSell = patch.amountSell;
    if (patch.amountBuyLong !== undefined && patch.amountBuyLong !== null) order.amountBuyLong = patch.amountBuyLong;
    if (patch.amountSellLong !== undefined && patch.amountSellLong !== null) order.amountSellLong = patch.amountSellLong;
    if (patch.amountBuyShort !== undefined && patch.amountBuyShort !== null) order.amountBuyShort = patch.amountBuyShort;
    if (patch.amountSellShort !== undefined && patch.amountSellShort !== null) order.amountSellShort = patch.amountSellShort;

    // Update risk config in the related table
    if (patch.riskConfig !== undefined && patch.riskConfig !== null) {
      const fields = this.toRiskConfigFields(patch.riskConfig);
      if (order.riskConfig) {
        Object.assign(order.riskConfig, fields);
        order.riskConfig = await rcRepo.save(order.riskConfig);
      } else {
        const rc = rcRepo.create({ userid: order.userid, name: null, strategyOrderId: order.id, ...fields });
        order.riskConfig = await rcRepo.save(rc);
      }
    }

    return await repo.save(order);
  }

  async delete(userid: number, orderId: number): Promise<void> {
    const repo = this.requireRepo();
    const order = await this.get(userid, orderId);

    // If running, unsubscribe from strategy-engine first
    if (order.isRunning) {
      const period = (order.strategy?.params as any)?.period ?? '15m';
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
    const saved = await repo.save(order);

    // Call strategy-engine gRPC for each symbol
    try {
      const period = (order.strategy?.params as any)?.period ?? '15m';
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
          parameters: JSON.stringify(order.strategy?.params ?? {}),
          riskConfig: JSON.stringify(this.riskConfigToDict(order.riskConfig)),
          live: order.live,
        });
      }
    } catch (err) {
      // Rollback DB state on gRPC failure
      order.isRunning = false;
      await repo.save(order);
      throw err;
    }

    return saved;
  }

  async stop(userid: number, orderId: number): Promise<StrategyOrder> {
    const repo = this.requireRepo();
    const order = await this.get(userid, orderId);

    // Call strategy-engine gRPC unsubscribe for each symbol
    const period = (order.strategy?.params as any)?.period ?? '15m';
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
    return await repo.save(order);
  }
}
