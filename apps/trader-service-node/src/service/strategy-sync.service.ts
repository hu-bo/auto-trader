import { Autoload, Init, Inject, Provide, Scope, ScopeEnum } from '@midwayjs/core';
import { InjectEntityModel } from '@midwayjs/typeorm';
import type { Repository } from 'typeorm';
import { StrategyOrder } from '../entity/strategy-order.entity.js';
import { StrategySubscriptionGrpcClient } from '../grpc/strategy-subscription-grpc.client.js';
import { SignalNatsService } from './signal-nats.service.js';
import { StrategyOrderService } from './strategy-order.service.js';
import { createScopedLogger } from '../common/logger.js';

@Autoload()
@Provide()
@Scope(ScopeEnum.Singleton)
export class StrategySyncService {
  @Inject()
  signalNatsService!: SignalNatsService;

  @Inject()
  strategyGrpcClient!: StrategySubscriptionGrpcClient;

  // @Inject()
  // strategyOrderService!: StrategyOrderService;

  @InjectEntityModel(StrategyOrder)
  orderRepo!: Repository<StrategyOrder>;

  private readonly logger = createScopedLogger('StrategySyncService');

  @Init()
  async init() {
    // Subscribe to strategy-engine startup notification via signal NATS
    this.signalNatsService.subscribe('strategy.engine.started', async (data) => {
      this.logger.info('[StrategySync] Received strategy.engine.started: %j', data);
      await this.syncRunningStrategies();
    });
    this.logger.info('[StrategySync] Listening for strategy.engine.started on signal NATS');
  }

  async syncRunningStrategies() {
    const orders = await this.orderRepo.find({
      where: { isRunning: true },
      relations: ['strategy', 'exchange', 'riskConfig'],
    });

    this.logger.info('[StrategySync] Found %d running orders to sync', orders.length);

    if (orders.length === 0) {
      this.logger.info('[StrategySync] No running orders, sync complete');
      return;
    }

    let successCount = 0;
    let failCount = 0;

    for (const order of orders) {
      const period = (order.strategy?.params as any)?.period ?? '15m';
      // const riskConfigDict = this.strategyOrderService.riskConfigToDict(order.riskConfig);

      for (const symbol of order.symbols) {
        try {
          console.log({
            userId: String(order.userid),
            subscriptionId: `${order.id}:${symbol}`,
            strategyId: String(order.strategyId),
            strategyName: order.strategy?.name ?? '',
            code: order.strategy?.code ?? '',
            symbol,
            exchange: (order.exchange?.exchangeType ?? '').toLowerCase(),
            tradeType: order.tradeType ?? 'spot',
            period,
            parameters: JSON.stringify(order.strategy?.params ?? {}),
            riskConfig: JSON.stringify(order.riskConfig),
            live: order.live,
          })
          const result = await this.strategyGrpcClient.subscribe({
            userId: String(order.userid),
            subscriptionId: `${order.id}:${symbol}`,
            strategyId: String(order.strategyId),
            strategyName: order.strategy?.name ?? '',
            code: order.strategy?.code ?? '',
            symbol,
            exchange: (order.exchange?.exchangeType ?? '').toLowerCase(),
            tradeType: order.tradeType ?? 'spot',
            period,
            parameters: JSON.stringify(order.strategy?.params ?? {}),
            riskConfig: JSON.stringify(order.riskConfig),
            live: order.live,
          });
          successCount++;
          this.logger.info(
            '[StrategySync] Re-subscribed order=%d symbol=%s instance_key=%s',
            order.id, symbol, result?.instance_key ?? 'N/A'
          );
        } catch (err: any) {
          if (err?.status === 409) {
            successCount++;
            this.logger.info(
              '[StrategySync] Subscription already exists order=%d symbol=%s, skipping',
              order.id, symbol
            );
          } else {
            failCount++;
            this.logger.error(
              '[StrategySync] Failed to re-subscribe order=%d symbol=%s: %s',
              order.id, symbol, err
            );
          }
        }
      }
    }

    this.logger.info(
      '[StrategySync] Sync complete: success=%d failed=%d total=%d',
      successCount, failCount, successCount + failCount
    );
  }
}
