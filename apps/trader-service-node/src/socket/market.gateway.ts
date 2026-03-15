import { Provide, Scope, ScopeEnum, Init, Inject, App } from '@midwayjs/core';
import type { Application } from '@midwayjs/koa';
import { Server as SocketIOServer, Socket } from 'socket.io';
import { createServer } from 'http';
import { NatsService } from '../service/nats.service.js';
import { createScopedLogger } from '../common/logger.js';

interface SubscriptionKey {
  exchange: string;
  tradeType: string;
  symbol: string;
  period: string;
}

function toRoom(key: SubscriptionKey): string {
  return `kline:${key.exchange}:${key.tradeType}:${key.symbol}:${key.period}`;
}

@Provide()
@Scope(ScopeEnum.Singleton)
export class MarketGateway {
  @Inject()
  natsService!: NatsService;

  private readonly logger = createScopedLogger('MarketGateway');

  @App('koa')
  app!: Application;

  private io!: SocketIOServer;
  // 跟踪每个 NATS subject 有多少客户端在订阅
  private roomRefCount: Map<string, number> = new Map();

  @Init()
  async init() {
    // 复用 Koa 的 HTTP server 来挂载 Socket.IO
    const httpServer = createServer(this.app.callback());

    this.io = new SocketIOServer(httpServer, {
      cors: {
        origin: '*',
        methods: ['GET', 'POST'],
      },
      path: '/ws',
      transports: ['websocket', 'polling'],
    });

    this.io.on('connection', (socket: Socket) => {
      this.logger.info('[WS] Client connected: %s', socket.id);
      this.handleConnection(socket);
    });

    // 用独立端口启动 WebSocket 服务，避免和 Koa 端口冲突
    const wsPort = Number(process.env.WS_PORT) || 9004;
    httpServer.listen(wsPort, () => {
      this.logger.info('[WS] Socket.IO server listening on port %d', wsPort);
    });
  }

  private handleConnection(socket: Socket) {
    // 客户端订阅 K 线
    socket.on('subscribe:kline', (params: SubscriptionKey) => {
      const { exchange, tradeType, symbol, period } = params;
      if (!exchange || !symbol || !period) return;

      const room = toRoom({ exchange, tradeType: tradeType || 'spot', symbol, period });
      socket.join(room);
      this.logger.info('[WS] %s joined room %s', socket.id, room);

      // 如果是第一个订阅者，启动 NATS 订阅
      this.addNatsSubscription({ exchange, tradeType: tradeType || 'spot', symbol, period });
    });

    // 客户端取消订阅
    socket.on('unsubscribe:kline', (params: SubscriptionKey) => {
      const { exchange, tradeType, symbol, period } = params;
      if (!exchange || !symbol || !period) return;

      const room = toRoom({ exchange, tradeType: tradeType || 'spot', symbol, period });
      socket.leave(room);
      this.logger.info('[WS] %s left room %s', socket.id, room);

      // 延迟检查是否需要取消 NATS 订阅
      setTimeout(() => this.checkAndRemoveNatsSubscription(room, { exchange, tradeType: tradeType || 'spot', symbol, period }), 1000);
    });

    socket.on('disconnect', () => {
      this.logger.info('[WS] Client disconnected: %s', socket.id);
    });
  }

  private addNatsSubscription(key: SubscriptionKey) {
    const room = toRoom(key);
    const count = this.roomRefCount.get(room) ?? 0;
    this.roomRefCount.set(room, count + 1);

    if (count > 0) return; // 已有 NATS 订阅

    const natsSubject = this.natsService.buildCandleSubject(
      key.exchange, key.tradeType, key.symbol, key.period
    );

    this.natsService.subscribe(natsSubject, (data, _subject) => {
      // 转发给 Socket.IO room 中的所有客户端
      this.io.to(room).emit('kline', data);
    });

    this.logger.info('[WS] Started NATS subscription for room %s -> %s', room, natsSubject);
  }

  private checkAndRemoveNatsSubscription(room: string, key: SubscriptionKey) {
    const clients = this.io.sockets.adapter.rooms.get(room);
    if (clients && clients.size > 0) return;

    // 没有客户端了，取消 NATS 订阅
    this.roomRefCount.delete(room);
    const natsSubject = this.natsService.buildCandleSubject(
      key.exchange, key.tradeType, key.symbol, key.period
    );
    this.natsService.unsubscribe(natsSubject);
    this.logger.info('[WS] Removed NATS subscription for room %s', room);
  }
}
