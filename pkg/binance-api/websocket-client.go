package binanceapi

import (
	"context"
	"fmt"
	"net/url"
	"strings"
	"sync"
	"sync/atomic"
	"time"

	"github.com/bytedance/sonic"
	"github.com/lxzan/gws"
	"github.com/pkg/binance-api/types/websockets"
	"github.com/pkg/binance-api/util"
	wsutil "github.com/pkg/binance-api/util/websockets"
	"golang.org/x/net/proxy"
)

// WebsocketClient represents the Binance WebSocket client.
type WebsocketClient struct {
	options       websockets.WsClientConfig
	logger        *util.Logger
	connections   map[websockets.WsKey]*wsConnection
	connMu        sync.RWMutex
	handlers      map[string][]websockets.WsEventHandler
	handlerMu     sync.RWMutex
	errorHandlers []websockets.WsErrorHandler
	reqIDCounter  int64
}

type wsConnection struct {
	wsKey     websockets.WsKey
	conn      *gws.Conn
	state     websockets.WsConnectionState
	stateMu   sync.RWMutex
	topics    map[string]bool
	topicsMu  sync.RWMutex
	listenKey string
	cancel    context.CancelFunc
	client    *WebsocketClient
}

// NewWebsocketClient creates a new WebsocketClient.
func NewWebsocketClient(opts websockets.WsClientConfig) *WebsocketClient {
	return &WebsocketClient{
		options:     opts,
		logger:      util.DefaultLogger,
		connections: make(map[websockets.WsKey]*wsConnection),
		handlers:    make(map[string][]websockets.WsEventHandler),
	}
}

// SetLogger sets the logger.
func (c *WebsocketClient) SetLogger(logger *util.Logger) {
	c.logger = logger
}

// OnMessage registers an event handler for a specific event type.
func (c *WebsocketClient) OnMessage(eventType string, handler websockets.WsEventHandler) {
	c.handlerMu.Lock()
	defer c.handlerMu.Unlock()
	c.handlers[eventType] = append(c.handlers[eventType], handler)
}

// OnError registers an error handler.
func (c *WebsocketClient) OnError(handler websockets.WsErrorHandler) {
	c.handlerMu.Lock()
	defer c.handlerMu.Unlock()
	c.errorHandlers = append(c.errorHandlers, handler)
}

// Connect connects to a websocket endpoint.
func (c *WebsocketClient) Connect(wsKey websockets.WsKey) error {
	c.connMu.Lock()
	if conn, exists := c.connections[wsKey]; exists && conn.getState() >= websockets.WsStateConnected {
		c.connMu.Unlock()
		return nil
	}
	c.connMu.Unlock()

	return c.connectInternal(wsKey, "")
}

// ConnectWithListenKey connects to a user data stream with a listen key.
func (c *WebsocketClient) ConnectWithListenKey(wsKey websockets.WsKey, listenKey string) error {
	return c.connectInternal(wsKey, listenKey)
}

func (c *WebsocketClient) connectInternal(wsKey websockets.WsKey, listenKey string) error {
	wsURL := wsutil.GetWsURL(wsKey, c.options.Testnet)
	suffix := wsutil.GetWsURLSuffix(wsKey, "market")

	if listenKey != "" {
		suffix = "/ws/" + listenKey
	}

	fullURL := wsURL + suffix

	c.logger.Info("Connecting to WebSocket: %s (key: %s)", fullURL, wsKey)

	ctx, cancel := context.WithCancel(context.Background())

	wsConn := &wsConnection{
		wsKey:     wsKey,
		state:     websockets.WsStateConnecting,
		topics:    make(map[string]bool),
		listenKey: listenKey,
		cancel:    cancel,
		client:    c,
	}

	c.connMu.Lock()
	c.connections[wsKey] = wsConn
	c.connMu.Unlock()

	// Create gws connection
	clientOpt := &gws.ClientOption{
		Addr:                fullURL,
		ParallelEnabled:     true,
		ReadMaxPayloadSize:  1024 * 1024, // 1MB
		WriteMaxPayloadSize: 1024 * 1024,
	}

	if c.options.SocksProxy != "" {
		clientOpt.NewDialer = func() (gws.Dialer, error) {
			addr := strings.TrimSpace(c.options.SocksProxy)
			if u, err := url.Parse(addr); err == nil && u.Host != "" {
				addr = u.Host
			}
			return proxy.SOCKS5("tcp", addr, nil, proxy.Direct)
		}
	}

	socket, _, err := gws.NewClient(wsConn, clientOpt)
	if err != nil {
		wsConn.setState(websockets.WsStateClosed)
		c.emitError(fmt.Errorf("failed to connect to %s: %w", fullURL, err))
		return err
	}

	wsConn.conn = socket
	wsConn.setState(websockets.WsStateConnected)

	// Start reading messages
	go func() {
		socket.ReadLoop()
		// Connection closed
		wsConn.setState(websockets.WsStateClosed)
		c.logger.Info("WebSocket connection closed: %s", wsKey)
	}()

	// Start ping loop if heartbeat not disabled
	if !c.options.DisableHeartbeat {
		go c.pingLoop(ctx, wsConn)
	}

	c.logger.Info("WebSocket connected: %s", wsKey)
	return nil
}

func (c *WebsocketClient) pingLoop(ctx context.Context, wsConn *wsConnection) {
	interval := time.Duration(c.options.PingInterval) * time.Millisecond
	if interval == 0 {
		interval = 30 * time.Second
	}

	ticker := time.NewTicker(interval)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			if wsConn.getState() != websockets.WsStateConnected && wsConn.getState() != websockets.WsStateAuthenticated {
				continue
			}
			if wsConn.conn != nil {
				if err := wsConn.conn.WritePing(nil); err != nil {
					c.logger.Warn("Failed to send ping: %v", err)
				}
			}
		}
	}
}

// Subscribe subscribes to one or more topics.
func (c *WebsocketClient) Subscribe(wsKey websockets.WsKey, topics ...string) error {
	c.connMu.RLock()
	wsConn, exists := c.connections[wsKey]
	c.connMu.RUnlock()

	if !exists || wsConn.getState() < websockets.WsStateConnected {
		return fmt.Errorf("not connected to %s", wsKey)
	}

	// Build subscribe message
	reqID := atomic.AddInt64(&c.reqIDCounter, 1)
	msg := websockets.WsMessage{
		ID:     reqID,
		Method: "SUBSCRIBE",
		Params: topics,
	}

	data, err := sonic.Marshal(msg)
	if err != nil {
		return fmt.Errorf("failed to marshal subscribe message: %w", err)
	}

	if err := wsConn.conn.WriteMessage(gws.OpcodeText, data); err != nil {
		return fmt.Errorf("failed to send subscribe message: %w", err)
	}

	// Track subscribed topics
	wsConn.topicsMu.Lock()
	for _, topic := range topics {
		wsConn.topics[topic] = true
	}
	wsConn.topicsMu.Unlock()

	c.logger.Debug("Subscribed to topics: %v (key: %s)", topics, wsKey)
	return nil
}

// Unsubscribe unsubscribes from one or more topics.
func (c *WebsocketClient) Unsubscribe(wsKey websockets.WsKey, topics ...string) error {
	c.connMu.RLock()
	wsConn, exists := c.connections[wsKey]
	c.connMu.RUnlock()

	if !exists || wsConn.getState() < websockets.WsStateConnected {
		return fmt.Errorf("not connected to %s", wsKey)
	}

	reqID := atomic.AddInt64(&c.reqIDCounter, 1)
	msg := websockets.WsMessage{
		ID:     reqID,
		Method: "UNSUBSCRIBE",
		Params: topics,
	}

	data, err := sonic.Marshal(msg)
	if err != nil {
		return fmt.Errorf("failed to marshal unsubscribe message: %w", err)
	}

	if err := wsConn.conn.WriteMessage(gws.OpcodeText, data); err != nil {
		return fmt.Errorf("failed to send unsubscribe message: %w", err)
	}

	// Remove tracked topics
	wsConn.topicsMu.Lock()
	for _, topic := range topics {
		delete(wsConn.topics, topic)
	}
	wsConn.topicsMu.Unlock()

	c.logger.Debug("Unsubscribed from topics: %v (key: %s)", topics, wsKey)
	return nil
}

// Close closes a websocket connection.
func (c *WebsocketClient) Close(wsKey websockets.WsKey) error {
	c.connMu.Lock()
	wsConn, exists := c.connections[wsKey]
	if !exists {
		c.connMu.Unlock()
		return nil
	}
	delete(c.connections, wsKey)
	c.connMu.Unlock()

	wsConn.setState(websockets.WsStateClosing)
	if wsConn.cancel != nil {
		wsConn.cancel()
	}
	if wsConn.conn != nil {
		wsConn.conn.WriteClose(1000, nil)
	}

	c.logger.Info("WebSocket connection closed: %s", wsKey)
	return nil
}

// CloseAll closes all websocket connections.
func (c *WebsocketClient) CloseAll() {
	c.connMu.RLock()
	keys := make([]websockets.WsKey, 0, len(c.connections))
	for k := range c.connections {
		keys = append(keys, k)
	}
	c.connMu.RUnlock()

	for _, key := range keys {
		c.Close(key)
	}
}

func (c *WebsocketClient) emitEvent(eventType string, data interface{}) {
	c.handlerMu.RLock()
	handlers := c.handlers[eventType]
	allHandlers := c.handlers["*"]
	c.handlerMu.RUnlock()

	for _, h := range handlers {
		go h(data)
	}
	for _, h := range allHandlers {
		go h(data)
	}
}

func (c *WebsocketClient) emitError(err error) {
	c.handlerMu.RLock()
	handlers := c.errorHandlers
	c.handlerMu.RUnlock()

	for _, h := range handlers {
		go h(err)
	}
}

// wsConnection implements gws.Event interface

func (conn *wsConnection) getState() websockets.WsConnectionState {
	conn.stateMu.RLock()
	defer conn.stateMu.RUnlock()
	return conn.state
}

func (conn *wsConnection) setState(state websockets.WsConnectionState) {
	conn.stateMu.Lock()
	defer conn.stateMu.Unlock()
	conn.state = state
}

func (conn *wsConnection) OnOpen(socket *gws.Conn) {
	conn.client.logger.Debug("WebSocket opened: %s", conn.wsKey)
}

func (conn *wsConnection) OnClose(socket *gws.Conn, err error) {
	conn.setState(websockets.WsStateClosed)
	if err != nil {
		conn.client.logger.Warn("WebSocket closed with error: %v (key: %s)", err, conn.wsKey)
		conn.client.emitError(err)
	}
}

func (conn *wsConnection) OnPing(socket *gws.Conn, payload []byte) {
	socket.WritePong(payload)
}

func (conn *wsConnection) OnPong(socket *gws.Conn, payload []byte) {
	// Pong received, connection is alive
}

func (conn *wsConnection) OnMessage(socket *gws.Conn, message *gws.Message) {
	defer message.Close()

	data := message.Bytes()
	conn.client.logger.Trace("Received message: %s (key: %s)", string(data), conn.wsKey)

	// Try to parse as stream message
	var streamMsg websockets.WsStreamMessage
	if err := sonic.Unmarshal(data, &streamMsg); err == nil && streamMsg.Stream != "" {
		conn.client.handleStreamMessage(conn.wsKey, streamMsg)
		return
	}

	// Try to parse generic message
	var genericMsg map[string]interface{}
	if err := sonic.Unmarshal(data, &genericMsg); err != nil {
		conn.client.logger.Warn("Failed to parse message: %v", err)
		return
	}

	// Check for event type
	if eventType, ok := genericMsg["e"].(string); ok {
		conn.client.emitEvent(eventType, genericMsg)
		return
	}

	// Handle response messages (subscribe/unsubscribe confirmations)
	if _, hasID := genericMsg["id"]; hasID {
		conn.client.emitEvent("response", genericMsg)
		return
	}

	// Default: emit as message
	conn.client.emitEvent("message", genericMsg)
}

func (c *WebsocketClient) handleStreamMessage(wsKey websockets.WsKey, msg websockets.WsStreamMessage) {
	// Prefer event type from payload `e` to match Binance's event model.
	// Combined streams include a stream name suffix like "kline_15m", but callers typically
	// expect the event type ("kline", "depthUpdate", "24hrMiniTicker", ...).
	switch v := msg.Data.(type) {
	case map[string]interface{}:
		if et, ok := v["e"].(string); ok && et != "" {
			c.emitEvent(et, v)
			return
		}
	case []interface{}:
		// e.g. "!miniTicker@arr" where payload is an array of events.
		if len(v) > 0 {
			if first, ok := v[0].(map[string]interface{}); ok {
				if et, ok := first["e"].(string); ok && et != "" {
					c.emitEvent(et, v)
					return
				}
			}
		}
	}

	// Fallback: derive from stream suffix.
	parts := strings.Split(msg.Stream, "@")
	if len(parts) < 2 {
		c.emitEvent("message", msg.Data)
		return
	}
	c.emitEvent(parts[len(parts)-1], msg.Data)
}

// Convenience methods for common subscriptions

// SubscribeAggregateTrades subscribes to aggregate trade stream.
func (c *WebsocketClient) SubscribeAggregateTrades(wsKey websockets.WsKey, symbol string) error {
	topic := strings.ToLower(symbol) + "@aggTrade"
	return c.Subscribe(wsKey, topic)
}

// SubscribeTrades subscribes to trade stream.
func (c *WebsocketClient) SubscribeTrades(wsKey websockets.WsKey, symbol string) error {
	topic := strings.ToLower(symbol) + "@trade"
	return c.Subscribe(wsKey, topic)
}

// SubscribeKlines subscribes to kline stream.
func (c *WebsocketClient) SubscribeKlines(wsKey websockets.WsKey, symbol string, interval string) error {
	topic := strings.ToLower(symbol) + "@kline_" + interval
	return c.Subscribe(wsKey, topic)
}

// SubscribeMiniTicker subscribes to 24hr mini ticker stream.
func (c *WebsocketClient) SubscribeMiniTicker(wsKey websockets.WsKey, symbol string) error {
	topic := strings.ToLower(symbol) + "@miniTicker"
	return c.Subscribe(wsKey, topic)
}

// SubscribeAllMiniTickers subscribes to all 24hr mini ticker stream.
func (c *WebsocketClient) SubscribeAllMiniTickers(wsKey websockets.WsKey) error {
	return c.Subscribe(wsKey, "!miniTicker@arr")
}

// SubscribeTicker subscribes to 24hr ticker stream.
func (c *WebsocketClient) SubscribeTicker(wsKey websockets.WsKey, symbol string) error {
	topic := strings.ToLower(symbol) + "@ticker"
	return c.Subscribe(wsKey, topic)
}

// SubscribeAllTickers subscribes to all 24hr ticker stream.
func (c *WebsocketClient) SubscribeAllTickers(wsKey websockets.WsKey) error {
	return c.Subscribe(wsKey, "!ticker@arr")
}

// SubscribeBookTicker subscribes to book ticker stream.
func (c *WebsocketClient) SubscribeBookTicker(wsKey websockets.WsKey, symbol string) error {
	topic := strings.ToLower(symbol) + "@bookTicker"
	return c.Subscribe(wsKey, topic)
}

// SubscribeDepth subscribes to depth stream.
func (c *WebsocketClient) SubscribeDepth(wsKey websockets.WsKey, symbol string, levels int, updateSpeed string) error {
	topic := fmt.Sprintf("%s@depth%d", strings.ToLower(symbol), levels)
	if updateSpeed != "" {
		topic += "@" + updateSpeed
	}
	return c.Subscribe(wsKey, topic)
}

// SubscribeDiffDepth subscribes to diff depth stream.
func (c *WebsocketClient) SubscribeDiffDepth(wsKey websockets.WsKey, symbol string, updateSpeed string) error {
	topic := strings.ToLower(symbol) + "@depth"
	if updateSpeed != "" {
		topic += "@" + updateSpeed
	}
	return c.Subscribe(wsKey, topic)
}

// SubscribeMarkPrice subscribes to mark price stream (futures).
func (c *WebsocketClient) SubscribeMarkPrice(wsKey websockets.WsKey, symbol string, updateSpeed string) error {
	topic := strings.ToLower(symbol) + "@markPrice"
	if updateSpeed != "" {
		topic += "@" + updateSpeed
	}
	return c.Subscribe(wsKey, topic)
}

// SubscribeAllMarkPrices subscribes to all mark price stream (futures).
func (c *WebsocketClient) SubscribeAllMarkPrices(wsKey websockets.WsKey, updateSpeed string) error {
	topic := "!markPrice@arr"
	if updateSpeed != "" {
		topic += "@" + updateSpeed
	}
	return c.Subscribe(wsKey, topic)
}

// SubscribeLiquidationOrders subscribes to liquidation orders stream (futures).
func (c *WebsocketClient) SubscribeLiquidationOrders(wsKey websockets.WsKey, symbol string) error {
	topic := strings.ToLower(symbol) + "@forceOrder"
	return c.Subscribe(wsKey, topic)
}

// SubscribeAllLiquidationOrders subscribes to all liquidation orders stream (futures).
func (c *WebsocketClient) SubscribeAllLiquidationOrders(wsKey websockets.WsKey) error {
	return c.Subscribe(wsKey, "!forceOrder@arr")
}

// User Data Stream methods

// SubscribeSpotUserDataStream subscribes to spot user data stream.
func (c *WebsocketClient) SubscribeSpotUserDataStream(client *MainClient) error {
	ctx := context.Background()
	resp, err := client.GetSpotUserDataListenKey(ctx)
	if err != nil {
		return fmt.Errorf("failed to get listen key: %w", err)
	}

	wsKey := websockets.WsKeyMain
	if c.options.Testnet {
		wsKey = websockets.WsKeyMainTestnet
	}

	return c.ConnectWithListenKey(wsKey, resp.ListenKey)
}

// SubscribeUSDMUserDataStream subscribes to USDM user data stream.
func (c *WebsocketClient) SubscribeUSDMUserDataStream(client *USDMClient) error {
	ctx := context.Background()
	resp, err := client.GetFuturesUserDataListenKey(ctx)
	if err != nil {
		return fmt.Errorf("failed to get listen key: %w", err)
	}

	wsKey := websockets.WsKeyUSDM
	if c.options.Testnet {
		wsKey = websockets.WsKeyUSDMTestnet
	}

	return c.ConnectWithListenKey(wsKey, resp.ListenKey)
}

// SubscribeCOINMUserDataStream subscribes to COINM user data stream.
func (c *WebsocketClient) SubscribeCOINMUserDataStream(client *COINMClient) error {
	ctx := context.Background()
	resp, err := client.GetFuturesUserDataListenKey(ctx)
	if err != nil {
		return fmt.Errorf("failed to get listen key: %w", err)
	}

	wsKey := websockets.WsKeyCOINM
	if c.options.Testnet {
		wsKey = websockets.WsKeyCOINMTestnet
	}

	return c.ConnectWithListenKey(wsKey, resp.ListenKey)
}

// IsConnected checks if connected to a websocket.
func (c *WebsocketClient) IsConnected(wsKey websockets.WsKey) bool {
	c.connMu.RLock()
	defer c.connMu.RUnlock()
	if conn, exists := c.connections[wsKey]; exists {
		state := conn.getState()
		return state == websockets.WsStateConnected || state == websockets.WsStateAuthenticated
	}
	return false
}
