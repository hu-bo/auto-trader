import type * as grpc from '@grpc/grpc-js';
import type { TradeType } from '@hquant/exchange-adapter';
import { getTokenService, type InitAccountInput } from '../../services/TokenService.js';
import { getOrderService, type PlaceOrderInput } from '../../services/OrderService.js';
import { getExchangeManager } from '../../services/ExchangeManager.js';
import { createLogger } from '../../utils/logger.js';

const logger = createLogger('grpc-handlers');

// Type mappings
const EXCHANGE_MAP: Record<string, 'okx' | 'binance'> = {
  EXCHANGE_OKX: 'okx',
  EXCHANGE_BINANCE: 'binance',
  '1': 'okx',
  '2': 'binance',
};

const EXCHANGE_REVERSE_MAP: Record<string, string> = {
  okx: 'EXCHANGE_OKX',
  binance: 'EXCHANGE_BINANCE',
};

const TRADE_TYPE_MAP: Record<string, TradeType> = {
  TRADE_TYPE_SPOT: 'spot',
  TRADE_TYPE_FUTURES: 'futures',
  TRADE_TYPE_DELIVERY: 'delivery',
  '1': 'spot',
  '2': 'futures',
  '3': 'delivery',
};

const ORDER_SIDE_MAP: Record<string, 'buy' | 'sell'> = {
  ORDER_SIDE_BUY: 'buy',
  ORDER_SIDE_SELL: 'sell',
  '1': 'buy',
  '2': 'sell',
};

const POSITION_SIDE_MAP: Record<string, 'long' | 'short'> = {
  POSITION_SIDE_LONG: 'long',
  POSITION_SIDE_SHORT: 'short',
  '1': 'long',
  '2': 'short',
};

const ORDER_TYPE_MAP: Record<string, 'limit' | 'market' | 'maker-only'> = {
  ORDER_TYPE_LIMIT: 'limit',
  ORDER_TYPE_MARKET: 'market',
  ORDER_TYPE_MAKER_ONLY: 'maker-only',
  '1': 'limit',
  '2': 'market',
  '3': 'maker-only',
};

const ORDER_STATUS_MAP: Record<string, string> = {
  pending: 'ORDER_STATUS_PENDING',
  open: 'ORDER_STATUS_OPEN',
  partial: 'ORDER_STATUS_PARTIAL',
  filled: 'ORDER_STATUS_FILLED',
  canceled: 'ORDER_STATUS_CANCELED',
  rejected: 'ORDER_STATUS_REJECTED',
  expired: 'ORDER_STATUS_EXPIRED',
};

const POSITION_SIDE_REVERSE_MAP: Record<string, string> = {
  long: 'POSITION_SIDE_LONG',
  short: 'POSITION_SIDE_SHORT',
};

export function createHandlers() {
  const tokenService = getTokenService();
  const orderService = getOrderService();
  const exchangeManager = getExchangeManager();

  return {
    // Account Management
    async initAccount(
      call: grpc.ServerUnaryCall<any, any>,
      callback: grpc.sendUnaryData<any>
    ) {
      try {
        const req = call.request;
        const input: InitAccountInput = {
          exchange: EXCHANGE_MAP[req.exchange] || EXCHANGE_MAP[String(req.exchange)],
          apiKey: req.apiKey,
          apiSecret: req.apiSecret,
          passphrase: req.passphrase || undefined,
          demonet: req.demonet ?? true,
          name: req.name || undefined,
        };

        const token = await tokenService.initAccount(input);
        callback(null, { success: true, token });
      } catch (error: any) {
        logger.error({ error }, 'InitAccount failed');
        callback(null, {
          success: false,
          error: { code: 'INIT_ERROR', message: error.message },
        });
      }
    },

    async validateToken(
      call: grpc.ServerUnaryCall<any, any>,
      callback: grpc.sendUnaryData<any>
    ) {
      try {
        const { token } = call.request;
        const config = await tokenService.getAccountConfig(token);
        if (config) {
          callback(null, {
            valid: true,
            exchange: EXCHANGE_REVERSE_MAP[config.exchange],
          });
        } else {
          callback(null, { valid: false });
        }
      } catch (error: any) {
        logger.error({ error }, 'ValidateToken failed');
        callback(null, { valid: false });
      }
    },

    async invalidateToken(
      call: grpc.ServerUnaryCall<any, any>,
      callback: grpc.sendUnaryData<any>
    ) {
      try {
        const { token } = call.request;
        await tokenService.invalidateToken(token);
        await exchangeManager.removeInstance(token);
        callback(null, { success: true });
      } catch (error: any) {
        logger.error({ error }, 'InvalidateToken failed');
        callback(null, { success: false });
      }
    },

    // Order Management
    async placeOrder(
      call: grpc.ServerUnaryCall<any, any>,
      callback: grpc.sendUnaryData<any>
    ) {
      try {
        const req = call.request;
        const input: PlaceOrderInput = {
          symbol: req.symbol,
          tradeType: TRADE_TYPE_MAP[req.tradeType] || TRADE_TYPE_MAP[String(req.tradeType)],
          side: ORDER_SIDE_MAP[req.side] || ORDER_SIDE_MAP[String(req.side)],
          orderType: ORDER_TYPE_MAP[req.orderType] || ORDER_TYPE_MAP[String(req.orderType)],
          quantity: req.quantity,
          price: req.price || undefined,
          positionSide: req.positionSide
            ? POSITION_SIDE_MAP[req.positionSide] || POSITION_SIDE_MAP[String(req.positionSide)]
            : undefined,
          leverage: req.leverage || undefined,
          clientOrderId: req.clientOrderId || undefined,
          reduceOnly: req.reduceOnly ?? false,
        };

        const result = await orderService.placeOrder(req.token, input);

        if (result.success && result.order) {
          callback(null, {
            success: true,
            order: formatOrder(result.order),
          });
        } else {
          callback(null, {
            success: false,
            error: result.error,
          });
        }
      } catch (error: any) {
        logger.error({ error }, 'PlaceOrder failed');
        callback(null, {
          success: false,
          error: { code: 'PLACE_ORDER_ERROR', message: error.message },
        });
      }
    },

    async placeOrders(
      call: grpc.ServerUnaryCall<any, any>,
      callback: grpc.sendUnaryData<any>
    ) {
      try {
        const req = call.request;
        const inputs: PlaceOrderInput[] = req.orders.map((order: any) => ({
          symbol: order.symbol,
          tradeType: TRADE_TYPE_MAP[order.tradeType] || TRADE_TYPE_MAP[String(order.tradeType)],
          side: ORDER_SIDE_MAP[order.side] || ORDER_SIDE_MAP[String(order.side)],
          orderType: ORDER_TYPE_MAP[order.orderType] || ORDER_TYPE_MAP[String(order.orderType)],
          quantity: order.quantity,
          price: order.price || undefined,
          positionSide: order.positionSide
            ? POSITION_SIDE_MAP[order.positionSide] || POSITION_SIDE_MAP[String(order.positionSide)]
            : undefined,
          leverage: order.leverage || undefined,
          clientOrderId: order.clientOrderId || undefined,
          reduceOnly: order.reduceOnly ?? false,
        }));

        const result = await orderService.placeOrders(req.token, inputs);

        callback(null, {
          successCount: result.successCount,
          failedCount: result.failedCount,
          results: result.results.map((r) => ({
            success: r.success,
            order: r.order ? formatOrder(r.order) : undefined,
            error: r.error,
          })),
        });
      } catch (error: any) {
        logger.error({ error }, 'PlaceOrders failed');
        callback(null, {
          successCount: 0,
          failedCount: 0,
          results: [],
        });
      }
    },

    async cancelOrder(
      call: grpc.ServerUnaryCall<any, any>,
      callback: grpc.sendUnaryData<any>
    ) {
      try {
        const { token, orderId } = call.request;
        const result = await orderService.cancelOrder(token, orderId);

        callback(null, {
          success: result.success,
          order: result.order ? formatOrder(result.order) : undefined,
          error: result.error,
        });
      } catch (error: any) {
        logger.error({ error }, 'CancelOrder failed');
        callback(null, {
          success: false,
          error: { code: 'CANCEL_ORDER_ERROR', message: error.message },
        });
      }
    },

    async getOrder(
      call: grpc.ServerUnaryCall<any, any>,
      callback: grpc.sendUnaryData<any>
    ) {
      try {
        const { orderId } = call.request;
        const order = await orderService.getOrder(orderId);

        if (order) {
          callback(null, { order: formatOrder(order) });
        } else {
          callback(null, {
            error: { code: 'NOT_FOUND', message: 'Order not found' },
          });
        }
      } catch (error: any) {
        logger.error({ error }, 'GetOrder failed');
        callback(null, {
          error: { code: 'GET_ORDER_ERROR', message: error.message },
        });
      }
    },

    async getOrders(
      call: grpc.ServerUnaryCall<any, any>,
      callback: grpc.sendUnaryData<any>
    ) {
      try {
        const req = call.request;
        const config = await tokenService.getAccountConfig(req.token);
        if (!config) {
          callback(null, {
            orders: [],
            total: 0,
          });
          return;
        }

        const orders = await orderService.getOrders(config.id, {
          symbol: req.symbol || undefined,
          limit: req.limit || 100,
          offset: req.offset || 0,
        });

        callback(null, {
          orders: orders.map(formatOrder),
          total: orders.length,
        });
      } catch (error: any) {
        logger.error({ error }, 'GetOrders failed');
        callback(null, { orders: [], total: 0 });
      }
    },

    // Position Management
    async getPositions(
      call: grpc.ServerUnaryCall<any, any>,
      callback: grpc.sendUnaryData<any>
    ) {
      try {
        const req = call.request;
        const config = await tokenService.getAccountConfig(req.token);
        if (!config) {
          callback(null, { positions: [] });
          return;
        }

        const positions = await orderService.getPositions(config.id, req.symbol || undefined);
        callback(null, {
          positions: positions.map(formatPosition),
        });
      } catch (error: any) {
        logger.error({ error }, 'GetPositions failed');
        callback(null, { positions: [] });
      }
    },

    async syncPositions(
      call: grpc.ServerUnaryCall<any, any>,
      callback: grpc.sendUnaryData<any>
    ) {
      try {
        const { token } = call.request;
        const positions = await orderService.syncPositions(token);

        callback(null, {
          success: true,
          positions: positions.map(formatPosition),
        });
      } catch (error: any) {
        logger.error({ error }, 'SyncPositions failed');
        callback(null, {
          success: false,
          error: { code: 'SYNC_POSITIONS_ERROR', message: error.message },
        });
      }
    },

    // Balance
    async getBalance(
      call: grpc.ServerUnaryCall<any, any>,
      callback: grpc.sendUnaryData<any>
    ) {
      try {
        const req = call.request;
        const tradeType = TRADE_TYPE_MAP[req.tradeType] || TRADE_TYPE_MAP[String(req.tradeType)];
        const balances = await orderService.getBalance(req.token, tradeType);

        if (balances) {
          callback(null, {
            balances: balances.map((b) => ({
              asset: b.asset,
              free: b.free,
              locked: b.locked,
              total: b.total,
              unrealizedPnl: (b as any).unrealizedPnl || '0',
              marginBalance: (b as any).marginBalance || '0',
            })),
          });
        } else {
          callback(null, {
            error: { code: 'GET_BALANCE_ERROR', message: 'Failed to get balance' },
          });
        }
      } catch (error: any) {
        logger.error({ error }, 'GetBalance failed');
        callback(null, {
          error: { code: 'GET_BALANCE_ERROR', message: error.message },
        });
      }
    },

    // Market Data
    async getPrice(
      call: grpc.ServerUnaryCall<any, any>,
      callback: grpc.sendUnaryData<any>
    ) {
      try {
        const req = call.request;
        const tradeAdapter = await exchangeManager.getTradeAdapter(req.token);
        if (!tradeAdapter) {
          callback(null, {
            error: { code: 'ADAPTER_ERROR', message: 'Failed to get adapter' },
          });
          return;
        }

        const tradeType = TRADE_TYPE_MAP[req.tradeType] || TRADE_TYPE_MAP[String(req.tradeType)];
        const result = await tradeAdapter.getPrice(req.symbol, tradeType);

        if (result.ok) {
          callback(null, { price: result.data });
        } else {
          callback(null, {
            error: { code: result.error.code, message: result.error.message },
          });
        }
      } catch (error: any) {
        logger.error({ error }, 'GetPrice failed');
        callback(null, {
          error: { code: 'GET_PRICE_ERROR', message: error.message },
        });
      }
    },

    // Leverage
    async setLeverage(
      call: grpc.ServerUnaryCall<any, any>,
      callback: grpc.sendUnaryData<any>
    ) {
      try {
        const req = call.request;
        const tradeAdapter = await exchangeManager.getTradeAdapter(req.token);
        if (!tradeAdapter) {
          callback(null, {
            success: false,
            error: { code: 'ADAPTER_ERROR', message: 'Failed to get adapter' },
          });
          return;
        }

        const tradeType = TRADE_TYPE_MAP[req.tradeType] || TRADE_TYPE_MAP[String(req.tradeType)];
        const positionSide = req.positionSide
          ? POSITION_SIDE_MAP[req.positionSide] || POSITION_SIDE_MAP[String(req.positionSide)]
          : undefined;

        const result = await tradeAdapter.setLeverage(req.symbol, req.leverage, tradeType, positionSide);

        if (result.ok) {
          callback(null, { success: true });
        } else {
          callback(null, {
            success: false,
            error: { code: result.error.code, message: result.error.message },
          });
        }
      } catch (error: any) {
        logger.error({ error }, 'SetLeverage failed');
        callback(null, {
          success: false,
          error: { code: 'SET_LEVERAGE_ERROR', message: error.message },
        });
      }
    },

    // Streaming
    subscribeOrders(call: grpc.ServerWritableStream<any, any>) {
      const req = call.request;
      const { token } = req;
      const tradeType = TRADE_TYPE_MAP[req.tradeType] || TRADE_TYPE_MAP[String(req.tradeType)];

      logger.info({ token, tradeType }, 'Client subscribed to orders');

      // Subscribe to order updates
      const unsubscribe = exchangeManager.onOrderUpdate((t, event) => {
        if (t === token && event.tradeType === tradeType) {
          call.write({
            orderId: event.orderId,
            clientOrderId: event.clientOrderId,
            symbol: event.symbol,
            tradeType: `TRADE_TYPE_${event.tradeType.toUpperCase()}`,
            side: `ORDER_SIDE_${event.side.toUpperCase()}`,
            positionSide: event.positionSide
              ? `POSITION_SIDE_${event.positionSide.toUpperCase()}`
              : 'POSITION_SIDE_UNSPECIFIED',
            orderType: `ORDER_TYPE_${event.orderType.toUpperCase().replace('-', '_')}`,
            status: ORDER_STATUS_MAP[event.status] || 'ORDER_STATUS_UNSPECIFIED',
            price: event.price,
            quantity: event.quantity,
            filledQuantity: event.filledQuantity,
            avgPrice: event.avgPrice || '0',
            fee: event.fee || '0',
            feeAsset: event.feeAsset || '',
            updateTime: event.updateTime,
          });
        }
      });

      // Subscribe to WebSocket user data
      exchangeManager.subscribeUserData(token, tradeType).catch((error) => {
        logger.error({ error }, 'Failed to subscribe to user data');
      });

      call.on('cancelled', () => {
        logger.info({ token }, 'Client unsubscribed from orders');
        unsubscribe();
      });

      call.on('error', (error) => {
        logger.error({ error }, 'Stream error');
        unsubscribe();
      });
    },
  };
}

function formatOrder(order: any) {
  return {
    id: order.id,
    exchangeOrderId: order.exchangeOrderId || '',
    clientOrderId: order.clientOrderId || '',
    symbol: order.symbol,
    tradeType: `TRADE_TYPE_${order.tradeType.toUpperCase()}`,
    side: `ORDER_SIDE_${order.side.toUpperCase()}`,
    positionSide: order.positionSide
      ? POSITION_SIDE_REVERSE_MAP[order.positionSide]
      : 'POSITION_SIDE_UNSPECIFIED',
    orderType: `ORDER_TYPE_${order.orderType.toUpperCase().replace('-', '_')}`,
    status: ORDER_STATUS_MAP[order.status] || 'ORDER_STATUS_UNSPECIFIED',
    quantity: order.quantity,
    price: order.price || '0',
    filledQty: order.filledQty || '0',
    avgPrice: order.avgPrice || '0',
    fee: order.fee || '0',
    feeAsset: order.feeAsset || '',
    leverage: order.leverage || 0,
    reduceOnly: order.reduceOnly || false,
    createdAt: order.createdAt ? new Date(order.createdAt).getTime() : 0,
    updatedAt: order.updatedAt ? new Date(order.updatedAt).getTime() : 0,
    filledAt: order.filledAt ? new Date(order.filledAt).getTime() : 0,
  };
}

function formatPosition(position: any) {
  return {
    id: position.id,
    symbol: position.symbol,
    tradeType: `TRADE_TYPE_${position.tradeType.toUpperCase()}`,
    positionSide: POSITION_SIDE_REVERSE_MAP[position.positionSide] || 'POSITION_SIDE_UNSPECIFIED',
    positionAmt: position.positionAmt,
    entryPrice: position.entryPrice,
    markPrice: position.markPrice,
    unrealizedPnl: position.unrealizedPnl,
    realizedPnl: position.realizedPnl || '0',
    leverage: position.leverage,
    marginMode: position.marginMode,
    liquidationPrice: position.liquidationPrice || '0',
    margin: position.margin || '0',
    lastSyncAt: position.lastSyncAt ? new Date(position.lastSyncAt).getTime() : 0,
  };
}
