import { useEffect, useRef, useCallback } from 'react'
import { wsClient, WS_EVENTS } from '@/utils/ws'

type MessageHandler = (data: unknown) => void

interface UseWebSocketOptions {
  autoConnect?: boolean
  rooms?: string[]
}

export function useWebSocket(
  onMessage?: MessageHandler,
  events: string[] = [],
  options: UseWebSocketOptions = {}
) {
  const { autoConnect = true, rooms = [] } = options
  const handlerRef = useRef(onMessage)

  // 保持 handler 最新
  useEffect(() => {
    handlerRef.current = onMessage
  }, [onMessage])

  // 连接和订阅
  useEffect(() => {
    if (autoConnect && !wsClient.isConnected) {
      wsClient.connect()
    }

    // 订阅事件
    const unsubscribes = events.map((event) =>
      wsClient.subscribe(event, (data) => {
        handlerRef.current?.(data)
      })
    )

    // 加入房间
    rooms.forEach((room) => wsClient.joinRoom(room))

    return () => {
      // 取消订阅
      unsubscribes.forEach((unsubscribe) => unsubscribe())
      // 离开房间
      rooms.forEach((room) => wsClient.leaveRoom(room))
    }
  }, [autoConnect, events.join(','), rooms.join(',')])

  const emit = useCallback((event: string, data?: unknown) => {
    wsClient.emit(event, data)
  }, [])

  const subscribe = useCallback((event: string, handler: MessageHandler) => {
    return wsClient.subscribe(event, handler)
  }, [])

  return {
    isConnected: wsClient.isConnected,
    emit,
    subscribe,
    connect: () => wsClient.connect(),
    disconnect: () => wsClient.disconnect(),
  }
}

// 预定义的 WebSocket hooks
export function useTickerSocket(symbol: string, onTicker: (data: unknown) => void) {
  return useWebSocket(onTicker, [WS_EVENTS.TICKER], {
    rooms: [`ticker:${symbol}`],
  })
}

export function useOrderSocket(onOrderUpdate: (data: unknown) => void) {
  return useWebSocket(onOrderUpdate, [
    WS_EVENTS.ORDER_UPDATE,
    WS_EVENTS.ORDER_FILLED,
    WS_EVENTS.ORDER_CANCELED,
  ])
}

export function usePositionSocket(onPositionUpdate: (data: unknown) => void) {
  return useWebSocket(onPositionUpdate, [WS_EVENTS.POSITION_UPDATE])
}

export function useStrategySocket(onSignal: (data: unknown) => void) {
  return useWebSocket(onSignal, [
    WS_EVENTS.STRATEGY_SIGNAL,
    WS_EVENTS.STRATEGY_STATUS,
  ])
}

export { WS_EVENTS }
