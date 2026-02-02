import { io, Socket } from 'socket.io-client'
import { getStorage, STORAGE_KEYS } from './storage'

type EventHandler = (data: unknown) => void
type ConnectionHandler = () => void

interface SocketOptions {
  url?: string
  autoConnect?: boolean
}

class WebSocketClient {
  private socket: Socket | null = null
  private eventHandlers: Map<string, Set<EventHandler>> = new Map()
  private connectHandlers: Set<ConnectionHandler> = new Set()
  private disconnectHandlers: Set<ConnectionHandler> = new Set()
  private reconnectAttempts = 0
  private maxReconnectAttempts = 5

  connect(options: SocketOptions = {}): void {
    if (this.socket?.connected) return

    const url = options.url || import.meta.env.VITE_WS_URL || ''
    const token = getStorage<string>(STORAGE_KEYS.TOKEN)

    this.socket = io(url, {
      autoConnect: options.autoConnect ?? true,
      auth: {
        token,
      },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: this.maxReconnectAttempts,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    })

    this.setupEventListeners()
  }

  private setupEventListeners(): void {
    if (!this.socket) return

    this.socket.on('connect', () => {
      console.log('[WS] Connected')
      this.reconnectAttempts = 0
      this.connectHandlers.forEach((handler) => handler())
    })

    this.socket.on('disconnect', (reason) => {
      console.log('[WS] Disconnected:', reason)
      this.disconnectHandlers.forEach((handler) => handler())
    })

    this.socket.on('connect_error', (error) => {
      console.error('[WS] Connection error:', error)
      this.reconnectAttempts++
    })

    // 监听所有自定义事件
    this.socket.onAny((event: string, data: unknown) => {
      const handlers = this.eventHandlers.get(event)
      if (handlers) {
        handlers.forEach((handler) => handler(data))
      }
    })
  }

  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect()
      this.socket = null
    }
  }

  // 订阅事件
  subscribe(event: string, handler: EventHandler): () => void {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, new Set())
    }
    this.eventHandlers.get(event)!.add(handler)

    // 返回取消订阅函数
    return () => {
      const handlers = this.eventHandlers.get(event)
      if (handlers) {
        handlers.delete(handler)
        if (handlers.size === 0) {
          this.eventHandlers.delete(event)
        }
      }
    }
  }

  // 发送消息
  emit(event: string, data?: unknown): void {
    if (this.socket?.connected) {
      this.socket.emit(event, data)
    } else {
      console.warn('[WS] Socket not connected, message not sent')
    }
  }

  // 监听连接事件
  onConnect(handler: ConnectionHandler): () => void {
    this.connectHandlers.add(handler)
    return () => this.connectHandlers.delete(handler)
  }

  // 监听断开事件
  onDisconnect(handler: ConnectionHandler): () => void {
    this.disconnectHandlers.add(handler)
    return () => this.disconnectHandlers.delete(handler)
  }

  // 获取连接状态
  get isConnected(): boolean {
    return this.socket?.connected ?? false
  }

  // 加入房间
  joinRoom(room: string): void {
    this.emit('join', { room })
  }

  // 离开房间
  leaveRoom(room: string): void {
    this.emit('leave', { room })
  }
}

// 单例导出
export const wsClient = new WebSocketClient()

// WebSocket 事件类型
export const WS_EVENTS = {
  // 行情
  TICKER: 'ticker',
  KLINE: 'kline',
  ORDERBOOK: 'orderbook',
  TRADE: 'trade',

  // 订单
  ORDER_UPDATE: 'order_update',
  ORDER_FILLED: 'order_filled',
  ORDER_CANCELED: 'order_canceled',

  // 持仓
  POSITION_UPDATE: 'position_update',

  // 策略
  STRATEGY_SIGNAL: 'strategy_signal',
  STRATEGY_STATUS: 'strategy_status',

  // 系统
  NOTIFICATION: 'notification',
  ERROR: 'error',
} as const
