import { Repository } from 'typeorm';
import { z } from 'zod';
import type {
  PlaceOrderParams,
  Order as ExchangeOrder,
  Position as ExchangePosition,
  Balance,
  TradeType,
  WsOrderUpdate,
} from '@hquant/exchange-adapter';
import { AppDataSource } from '../database/index.js';
import { Order, type OrderStatus } from '../entities/Order.js';
import { Position } from '../entities/Position.js';
import { getExchangeManager } from './ExchangeManager.js';
import { getRiskService } from './RiskService.js';
import { getTokenService, type AccountConfig } from './TokenService.js';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('OrderService');

// Validation schemas
export const PlaceOrderSchema = z.object({
  symbol: z.string().min(1),
  tradeType: z.enum(['spot', 'futures', 'delivery']),
  side: z.enum(['buy', 'sell']),
  orderType: z.enum(['limit', 'market', 'maker-only']),
  quantity: z.number().positive(),
  price: z.number().positive().optional(),
  positionSide: z.enum(['long', 'short']).optional(),
  leverage: z.number().int().min(1).max(125).optional(),
  clientOrderId: z.string().optional(),
  reduceOnly: z.boolean().optional(),
});

export type PlaceOrderInput = z.infer<typeof PlaceOrderSchema>;

export interface OrderResult {
  success: boolean;
  order?: Order;
  error?: {
    code: string;
    message: string;
  };
}

export interface BatchOrderResult {
  successCount: number;
  failedCount: number;
  results: OrderResult[];
}

export class OrderService {
  private orderRepo: Repository<Order>;
  private positionRepo: Repository<Position>;

  constructor() {
    this.orderRepo = AppDataSource.getRepository(Order);
    this.positionRepo = AppDataSource.getRepository(Position);

    // Subscribe to order updates
    const exchangeManager = getExchangeManager();
    exchangeManager.onOrderUpdate(this.handleOrderUpdate.bind(this));
  }

  /**
   * Place a single order with risk check
   */
  async placeOrder(token: string, input: PlaceOrderInput): Promise<OrderResult> {
    const validated = PlaceOrderSchema.parse(input);

    // Get account config
    const accountConfig = await getTokenService().getAccountConfig(token);
    if (!accountConfig) {
      return { success: false, error: { code: 'INVALID_TOKEN', message: 'Invalid token' } };
    }

    // Get exchange adapter
    const exchangeManager = getExchangeManager();
    const tradeAdapter = await exchangeManager.getTradeAdapter(token);
    if (!tradeAdapter) {
      return { success: false, error: { code: 'ADAPTER_ERROR', message: 'Failed to get adapter' } };
    }

    // Get current price for risk check
    const priceResult = await tradeAdapter.getPrice(validated.symbol, validated.tradeType);
    if (!priceResult.ok) {
      return { success: false, error: { code: priceResult.error.code, message: priceResult.error.message } };
    }
    const currentPrice = parseFloat(priceResult.data);

    // Get positions and balances for risk check
    const [balanceResult, positionsResult] = await Promise.all([
      tradeAdapter.getBalance(validated.tradeType),
      validated.tradeType !== 'spot'
        ? tradeAdapter.getPositions(validated.symbol, validated.tradeType)
        : Promise.resolve({ ok: true as const, data: [] }),
    ]);

    if (!balanceResult.ok) {
      return { success: false, error: { code: balanceResult.error.code, message: balanceResult.error.message } };
    }

    const positions = positionsResult.ok ? positionsResult.data : [];

    // Risk check
    const riskService = getRiskService();
    const riskCheck = await riskService.checkOrder(
      token,
      validated as PlaceOrderParams,
      positions as ExchangePosition[],
      balanceResult.data,
      currentPrice,
      accountConfig.riskConfig as any
    );

    if (!riskCheck.allowed) {
      logger.warn({ token, reason: riskCheck.reason }, 'Order blocked by risk control');
      return {
        success: false,
        error: { code: 'RISK_BLOCKED', message: riskCheck.reason || 'Blocked by risk control' },
      };
    }

    // Create order record
    const orderRecord = this.orderRepo.create({
      accountId: accountConfig.id,
      symbol: validated.symbol,
      tradeType: validated.tradeType,
      side: validated.side,
      orderType: validated.orderType,
      quantity: validated.quantity.toString(),
      price: validated.price?.toString(),
      positionSide: validated.positionSide,
      leverage: validated.leverage,
      clientOrderId: validated.clientOrderId,
      reduceOnly: validated.reduceOnly ?? false,
      status: 'pending',
    });
    await this.orderRepo.save(orderRecord);

    // Execute order
    const orderResult = await tradeAdapter.placeOrder(validated as PlaceOrderParams<number, number>);

    if (!orderResult.ok) {
      // Update order record with error
      orderRecord.status = 'rejected';
      orderRecord.errorCode = orderResult.error.code;
      orderRecord.errorMessage = orderResult.error.message;
      await this.orderRepo.save(orderRecord);

      logger.error({ token, error: orderResult.error }, 'Order failed');
      return {
        success: false,
        order: orderRecord,
        error: { code: orderResult.error.code, message: orderResult.error.message },
      };
    }

    // Update order record with exchange data
    const exchangeOrder = orderResult.data;
    orderRecord.exchangeOrderId = exchangeOrder.orderId;
    orderRecord.clientOrderId = exchangeOrder.clientOrderId;
    orderRecord.status = this.mapOrderStatus(exchangeOrder.status);
    orderRecord.filledQty = exchangeOrder.filledQty;
    orderRecord.avgPrice = exchangeOrder.avgPrice;
    orderRecord.rawResponse = exchangeOrder.raw as Record<string, unknown>;
    if (exchangeOrder.status === 'filled') {
      orderRecord.filledAt = new Date();
    }
    await this.orderRepo.save(orderRecord);

    logger.info({ token, orderId: exchangeOrder.orderId, symbol: validated.symbol }, 'Order placed successfully');

    // Subscribe to WebSocket if not already subscribed
    await exchangeManager.subscribeUserData(token, validated.tradeType);

    return { success: true, order: orderRecord };
  }

  /**
   * Place multiple orders
   */
  async placeOrders(token: string, inputs: PlaceOrderInput[]): Promise<BatchOrderResult> {
    const results: OrderResult[] = [];
    let successCount = 0;
    let failedCount = 0;

    for (const input of inputs) {
      const result = await this.placeOrder(token, input);
      results.push(result);
      if (result.success) {
        successCount++;
      } else {
        failedCount++;
      }
    }

    return { successCount, failedCount, results };
  }

  /**
   * Cancel an order
   */
  async cancelOrder(token: string, orderId: string): Promise<OrderResult> {
    // Get order record
    const orderRecord = await this.orderRepo.findOne({
      where: [{ id: orderId }, { exchangeOrderId: orderId }],
    });

    if (!orderRecord) {
      return { success: false, error: { code: 'NOT_FOUND', message: 'Order not found' } };
    }

    // Get exchange adapter
    const exchangeManager = getExchangeManager();
    const tradeAdapter = await exchangeManager.getTradeAdapter(token);
    if (!tradeAdapter) {
      return { success: false, error: { code: 'ADAPTER_ERROR', message: 'Failed to get adapter' } };
    }

    // Cancel order on exchange
    const cancelResult = await tradeAdapter.cancelOrder(
      orderRecord.symbol,
      orderRecord.exchangeOrderId!,
      orderRecord.tradeType as TradeType
    );

    if (!cancelResult.ok) {
      return { success: false, error: { code: cancelResult.error.code, message: cancelResult.error.message } };
    }

    // Update order record
    orderRecord.status = 'canceled';
    await this.orderRepo.save(orderRecord);

    logger.info({ token, orderId }, 'Order canceled');
    return { success: true, order: orderRecord };
  }

  /**
   * Get order by ID
   */
  async getOrder(orderId: string): Promise<Order | null> {
    return this.orderRepo.findOne({
      where: [{ id: orderId }, { exchangeOrderId: orderId }],
    });
  }

  /**
   * Get orders for an account
   */
  async getOrders(
    accountId: string,
    options?: {
      symbol?: string;
      status?: OrderStatus;
      limit?: number;
      offset?: number;
    }
  ): Promise<Order[]> {
    const query = this.orderRepo.createQueryBuilder('order').where('order.accountId = :accountId', { accountId });

    if (options?.symbol) {
      query.andWhere('order.symbol = :symbol', { symbol: options.symbol });
    }

    if (options?.status) {
      query.andWhere('order.status = :status', { status: options.status });
    }

    query.orderBy('order.createdAt', 'DESC');

    if (options?.limit) {
      query.limit(options.limit);
    }

    if (options?.offset) {
      query.offset(options.offset);
    }

    return query.getMany();
  }

  /**
   * Get open orders
   */
  async getOpenOrders(accountId: string, symbol?: string): Promise<Order[]> {
    return this.getOrders(accountId, {
      symbol,
      status: 'open',
    });
  }

  /**
   * Sync positions from exchange
   */
  async syncPositions(token: string): Promise<Position[]> {
    const accountConfig = await getTokenService().getAccountConfig(token);
    if (!accountConfig) {
      throw new Error('Invalid token');
    }

    const exchangeManager = getExchangeManager();
    const tradeAdapter = await exchangeManager.getTradeAdapter(token);
    if (!tradeAdapter) {
      throw new Error('Failed to get adapter');
    }

    // Fetch positions for all trade types
    const tradeTypes: TradeType[] = ['futures', 'delivery'];
    const allPositions: Position[] = [];

    for (const tradeType of tradeTypes) {
      const result = await tradeAdapter.getPositions(undefined, tradeType);
      if (!result.ok) {
        logger.warn({ token, tradeType, error: result.error }, 'Failed to fetch positions');
        continue;
      }

      for (const pos of result.data) {
        // Skip empty positions
        if (parseFloat(pos.positionAmt) === 0) {
          continue;
        }

        // Find or create position record
        let positionRecord = await this.positionRepo.findOne({
          where: {
            accountId: accountConfig.id,
            symbol: pos.symbol,
            tradeType,
            positionSide: pos.positionSide,
          },
        });

        if (!positionRecord) {
          positionRecord = this.positionRepo.create({
            accountId: accountConfig.id,
            symbol: pos.symbol,
            tradeType,
            positionSide: pos.positionSide,
          });
        }

        // Update position data
        positionRecord.positionAmt = pos.positionAmt;
        positionRecord.entryPrice = pos.entryPrice;
        positionRecord.unrealizedPnl = pos.unrealizedPnl;
        positionRecord.leverage = pos.leverage;
        positionRecord.marginMode = pos.marginMode;
        positionRecord.liquidationPrice = pos.liquidationPrice;
        positionRecord.lastSyncAt = new Date();

        await this.positionRepo.save(positionRecord);
        allPositions.push(positionRecord);
      }
    }

    logger.info({ token, count: allPositions.length }, 'Positions synced');
    return allPositions;
  }

  /**
   * Get positions for an account
   */
  async getPositions(accountId: string, symbol?: string): Promise<Position[]> {
    const query: Record<string, unknown> = { accountId };
    if (symbol) {
      query.symbol = symbol;
    }
    return this.positionRepo.find({ where: query });
  }

  /**
   * Get account balance
   */
  async getBalance(token: string, tradeType: TradeType): Promise<Balance[] | null> {
    const exchangeManager = getExchangeManager();
    const tradeAdapter = await exchangeManager.getTradeAdapter(token);
    if (!tradeAdapter) {
      return null;
    }

    const result = await tradeAdapter.getBalance(tradeType);
    if (!result.ok) {
      logger.error({ token, error: result.error }, 'Failed to get balance');
      return null;
    }

    return result.data;
  }

  /**
   * Handle order update from WebSocket
   */
  private async handleOrderUpdate(token: string, event: WsOrderUpdate): Promise<void> {
    try {
      const accountConfig = await getTokenService().getAccountConfig(token);
      if (!accountConfig) {
        return;
      }

      // Find order by exchange order ID or client order ID
      let orderRecord = await this.orderRepo.findOne({
        where: [
          { exchangeOrderId: event.orderId },
          { clientOrderId: event.clientOrderId, accountId: accountConfig.id },
        ],
      });

      if (!orderRecord) {
        // Create new order record for orders placed externally
        orderRecord = this.orderRepo.create({
          accountId: accountConfig.id,
          exchangeOrderId: event.orderId,
          clientOrderId: event.clientOrderId,
          symbol: event.symbol,
          tradeType: event.tradeType,
          side: event.side,
          positionSide: event.positionSide,
          orderType: event.orderType,
          quantity: event.quantity,
          price: event.price,
          status: this.mapOrderStatus(event.status),
          filledQty: event.filledQuantity,
          avgPrice: event.avgPrice,
          fee: event.fee,
          feeAsset: event.feeAsset,
          reduceOnly: event.reduceOnly ?? false,
        });
      } else {
        // Update existing record
        orderRecord.status = this.mapOrderStatus(event.status);
        orderRecord.filledQty = event.filledQuantity;
        orderRecord.avgPrice = event.avgPrice;
        orderRecord.fee = event.fee;
        orderRecord.feeAsset = event.feeAsset;
        if (event.status === 'filled') {
          orderRecord.filledAt = new Date();
        }
      }

      await this.orderRepo.save(orderRecord);
      logger.debug({ orderId: event.orderId, status: event.status }, 'Order updated from WebSocket');
    } catch (error) {
      logger.error({ error, event }, 'Failed to handle order update');
    }
  }

  /**
   * Map exchange order status to local status
   */
  private mapOrderStatus(status: string): OrderStatus {
    const statusMap: Record<string, OrderStatus> = {
      pending: 'pending',
      open: 'open',
      partial: 'partial',
      filled: 'filled',
      canceled: 'canceled',
      rejected: 'rejected',
      expired: 'expired',
    };
    return statusMap[status] ?? 'pending';
  }
}

// Singleton instance
let orderService: OrderService | null = null;

export function getOrderService(): OrderService {
  if (!orderService) {
    orderService = new OrderService();
  }
  return orderService;
}
