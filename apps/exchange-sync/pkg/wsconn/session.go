package wsconn

import (
	"context"
	"fmt"
	"net/http"
	"net/url"
	"sync"
	"sync/atomic"
	"time"

	"exchange-sync/pkg/logger"

	"github.com/gorilla/websocket"
)

var log = logger.Module("wsconn")

// State 连接状态
type State int32

const (
	StateDisconnected State = iota
	StateConnecting
	StateConnected
	StateClosed
)

// Config WebSocket 会话配置
type Config struct {
	Name              string        // 连接名称 (用于日志)
	Endpoint          string        // WebSocket 地址
	Proxy             string        // 可选代理
	HeartbeatInterval time.Duration // 心跳间隔
	HeartbeatTimeout  time.Duration // 心跳超时 (用于 read deadline)
	ReconnectInterval time.Duration // 重连间隔
	MaxReconnectDelay time.Duration // 最大重连延迟
}

// HeartbeatFunc 心跳函数，返回要发送的消息类型和数据
// 用于 OKX 等需要客户端主动发送心跳的交易所
type HeartbeatFunc func() (messageType int, data []byte)

// SubscribeFunc 订阅函数，在连接建立或重连后调用
type SubscribeFunc func(conn *websocket.Conn) error

// HeartbeatMode 心跳模式
type HeartbeatMode int

const (
	// HeartbeatModePassive 被动模式：响应服务端 Ping (Binance)
	HeartbeatModePassive HeartbeatMode = iota
	// HeartbeatModeActive 主动模式：客户端定时发送心跳 (OKX)
	HeartbeatModeActive
)

// Session WebSocket 会话管理器
type Session struct {
	cfg    Config
	conn   *websocket.Conn
	connMu sync.RWMutex

	ctx    context.Context
	cancel context.CancelFunc
	wg     sync.WaitGroup

	state atomic.Int32

	onMessage func(data []byte)
	onError   func(error)

	heartbeatFunc HeartbeatFunc
	heartbeatMode HeartbeatMode
	subscribeFunc SubscribeFunc
}

// NewSession 创建新的 WebSocket 会话
func NewSession(cfg Config) *Session {
	if cfg.HeartbeatTimeout == 0 {
		cfg.HeartbeatTimeout = cfg.HeartbeatInterval * 3
	}
	if cfg.MaxReconnectDelay == 0 {
		cfg.MaxReconnectDelay = 60 * time.Second
	}

	s := &Session{cfg: cfg}
	s.state.Store(int32(StateDisconnected))
	return s
}

// OnMessage 设置消息处理器
func (s *Session) OnMessage(handler func(data []byte)) {
	s.onMessage = handler
}

// OnError 设置错误处理器
func (s *Session) OnError(handler func(error)) {
	s.onError = handler
}

// SetHeartbeatFunc 设置心跳函数 (主动模式)
// 用于 OKX 等需要客户端主动发送心跳的交易所
func (s *Session) SetHeartbeatFunc(f HeartbeatFunc) {
	s.heartbeatFunc = f
	s.heartbeatMode = HeartbeatModeActive
}

// SetPassiveHeartbeat 设置被动心跳模式 (响应服务端 Ping)
// 用于 Binance 等服务端主动发送 Ping 的交易所
func (s *Session) SetPassiveHeartbeat() {
	s.heartbeatMode = HeartbeatModePassive
}

// SetSubscribeFunc 设置订阅函数 (重连后会被调用)
func (s *Session) SetSubscribeFunc(f SubscribeFunc) {
	s.subscribeFunc = f
}

// Connect 建立连接 (首次连接失败会重试)
func (s *Session) Connect(ctx context.Context) error {
	s.ctx, s.cancel = context.WithCancel(ctx)

	delay := s.cfg.ReconnectInterval
	maxDelay := s.cfg.MaxReconnectDelay

	for attempt := 1; ; attempt++ {
		if err := s.dial(); err != nil {
			log.Error().Err(err).Str("name", s.cfg.Name).Int("attempt", attempt).Msg("Connect failed, retrying...")

			select {
			case <-ctx.Done():
				return ctx.Err()
			case <-time.After(delay):
			}

			delay = delay * 2
			if delay > maxDelay {
				delay = maxDelay
			}
			continue
		}
		break
	}

	s.wg.Add(2)
	go s.readLoop()
	go s.heartbeatLoop()

	return nil
}

// WriteMessage 发送消息
func (s *Session) WriteMessage(messageType int, data []byte) error {
	s.connMu.RLock()
	conn := s.conn
	s.connMu.RUnlock()

	if conn == nil {
		return fmt.Errorf("connection not established")
	}

	return conn.WriteMessage(messageType, data)
}

// Close 关闭连接
func (s *Session) Close() error {
	s.state.Store(int32(StateClosed))

	if s.cancel != nil {
		s.cancel()
	}

	s.connMu.Lock()
	if s.conn != nil {
		s.conn.Close()
		s.conn = nil
	}
	s.connMu.Unlock()

	s.wg.Wait()
	return nil
}

// IsConnected 检查是否已连接
func (s *Session) IsConnected() bool {
	return State(s.state.Load()) == StateConnected
}

func (s *Session) dial() error {
	s.state.Store(int32(StateConnecting))

	dialer := &websocket.Dialer{HandshakeTimeout: 10 * time.Second}
	if s.cfg.Proxy != "" {
		if proxyURL, err := url.Parse(s.cfg.Proxy); err == nil {
			dialer.Proxy = http.ProxyURL(proxyURL)
		}
	}

	conn, _, err := dialer.Dial(s.cfg.Endpoint, nil)
	if err != nil {
		s.state.Store(int32(StateDisconnected))
		return fmt.Errorf("websocket dial %s failed: %w", s.cfg.Endpoint, err)
	}

	// 被动模式：设置 PingHandler 响应服务端 Ping
	if s.heartbeatMode == HeartbeatModePassive {
		conn.SetPingHandler(func(appData string) error {
			return conn.WriteControl(websocket.PongMessage, []byte(appData), time.Now().Add(time.Second))
		})
	}

	s.connMu.Lock()
	s.conn = conn
	s.connMu.Unlock()

	s.state.Store(int32(StateConnected))
	log.Info().Str("name", s.cfg.Name).Str("endpoint", s.cfg.Endpoint).Msg("WebSocket connected")

	return nil
}

func (s *Session) readLoop() {
	defer s.wg.Done()

	for {
		select {
		case <-s.ctx.Done():
			return
		default:
		}

		s.connMu.RLock()
		conn := s.conn
		s.connMu.RUnlock()

		if conn == nil {
			time.Sleep(100 * time.Millisecond)
			continue
		}

		// 设置读超时，确保无响应时能检测到
		if s.cfg.HeartbeatTimeout > 0 {
			conn.SetReadDeadline(time.Now().Add(s.cfg.HeartbeatTimeout))
		}

		_, data, err := conn.ReadMessage()
		if err != nil {
			if State(s.state.Load()) == StateClosed {
				return
			}

			if s.onError != nil {
				s.onError(err)
			}

			s.reconnect()
			return
		}

		if s.onMessage != nil {
			s.onMessage(data)
		}
	}
}

func (s *Session) heartbeatLoop() {
	defer s.wg.Done()

	// 被动模式不需要主动发送心跳
	if s.heartbeatMode == HeartbeatModePassive {
		return
	}

	if s.cfg.HeartbeatInterval <= 0 {
		return
	}

	ticker := time.NewTicker(s.cfg.HeartbeatInterval)
	defer ticker.Stop()

	for {
		select {
		case <-s.ctx.Done():
			return
		case <-ticker.C:
			if State(s.state.Load()) != StateConnected {
				continue
			}

			s.connMu.RLock()
			conn := s.conn
			s.connMu.RUnlock()

			if conn == nil {
				continue
			}

			// 主动模式：发送心跳 (OKX 发送 "ping" 文本)
			msgType, data := websocket.PingMessage, []byte(nil)
			if s.heartbeatFunc != nil {
				msgType, data = s.heartbeatFunc()
			}

			if err := conn.WriteMessage(msgType, data); err != nil {
				log.Warn().Err(err).Str("name", s.cfg.Name).Msg("Heartbeat write failed, triggering reconnect")
				// 心跳写入失败，主动关闭连接触发 readLoop 的重连
				conn.Close()
				return
			}
		}
	}
}

func (s *Session) reconnect() {
	if State(s.state.Load()) == StateClosed {
		return
	}

	s.state.Store(int32(StateDisconnected))

	// 关闭旧连接
	s.connMu.Lock()
	if s.conn != nil {
		s.conn.Close()
		s.conn = nil
	}
	s.connMu.Unlock()

	delay := s.cfg.ReconnectInterval
	maxDelay := s.cfg.MaxReconnectDelay

	for attempt := 1; ; attempt++ {
		select {
		case <-s.ctx.Done():
			return
		case <-time.After(delay):
		}

		log.Info().Str("name", s.cfg.Name).Int("attempt", attempt).Msg("Reconnecting...")

		if err := s.dial(); err != nil {
			log.Error().Err(err).Str("name", s.cfg.Name).Int("attempt", attempt).Msg("Reconnect failed")

			// 指数退避
			delay = delay * 2
			if delay > maxDelay {
				delay = maxDelay
			}
			continue
		}

		// 重连成功，重新订阅
		if s.subscribeFunc != nil {
			s.connMu.RLock()
			conn := s.conn
			s.connMu.RUnlock()

			if conn != nil {
				if err := s.subscribeFunc(conn); err != nil {
					log.Error().Err(err).Str("name", s.cfg.Name).Msg("Resubscribe failed")
				}
			}
		}

		// 启动新的 read 和 heartbeat goroutine
		s.wg.Add(2)
		go s.readLoop()
		go s.heartbeatLoop()

		log.Info().Str("name", s.cfg.Name).Msg("Reconnected successfully")
		return
	}
}
