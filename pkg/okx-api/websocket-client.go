package okxapi

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"net"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"sync"
	"sync/atomic"
	"time"

	"github.com/gorilla/websocket"
	okxtypes "github.com/pkg/okx-api/types"
	okxws "github.com/pkg/okx-api/types/websockets"
	"golang.org/x/net/proxy"
)

type WsEventMessage struct {
	Event string `json:"event"`
	Code  string `json:"code,omitempty"`
	Msg   string `json:"msg,omitempty"`
}

type WsEvent struct {
	Message WsEventMessage
	Raw     []byte
}

type WsRawMessage struct {
	Raw []byte
}

type WsDataEventMessage struct {
	Arg  json.RawMessage `json:"arg"`
	Data json.RawMessage `json:"data"`
}

type WsDataEvent struct {
	Message WsDataEventMessage
	Raw     []byte
}

type WebsocketClient struct {
	cfg okxws.WSClientConfig

	mu       sync.RWMutex
	handlers map[string][]func(any)

	errMu    sync.RWMutex
	errHooks []func(error)

	closed atomic.Bool

	connMu sync.Mutex
	conns  map[wsEndpoint]*wsConn
}

type wsEndpoint string

const (
	wsPublic   wsEndpoint = "public"
	wsBusiness wsEndpoint = "business"
	wsPrivate  wsEndpoint = "private"
)

type wsConn struct {
	endpoint wsEndpoint
	cfg      okxws.WSClientConfig

	mu   sync.Mutex
	conn *websocket.Conn

	authMu sync.Mutex
	authed bool

	subsMu sync.Mutex
	subs   map[string]map[string]any // key -> arg map

	stopCh chan struct{}
}

func NewWebsocketClient(cfg okxws.WSClientConfig) *WebsocketClient {
	if cfg.ReconnectTimeout <= 0 {
		cfg.ReconnectTimeout = 5 * time.Second
	}
	return &WebsocketClient{
		cfg:      cfg,
		handlers: make(map[string][]func(any)),
		conns:    make(map[wsEndpoint]*wsConn),
	}
}

func (c *WebsocketClient) On(event string, handler func(any)) {
	if handler == nil || strings.TrimSpace(event) == "" {
		return
	}
	c.mu.Lock()
	defer c.mu.Unlock()
	c.handlers[event] = append(c.handlers[event], handler)
}

func (c *WebsocketClient) OnError(handler func(error)) {
	if handler == nil {
		return
	}
	c.errMu.Lock()
	defer c.errMu.Unlock()
	c.errHooks = append(c.errHooks, handler)
}

func (c *WebsocketClient) emit(event string, payload any) {
	c.mu.RLock()
	hs := c.handlers[event]
	c.mu.RUnlock()
	for _, h := range hs {
		go h(payload)
	}
}

func (c *WebsocketClient) emitError(err error) {
	if err == nil {
		return
	}
	c.errMu.RLock()
	hs := c.errHooks
	c.errMu.RUnlock()
	for _, h := range hs {
		go h(err)
	}
}

func (c *WebsocketClient) CloseAll() {
	c.closed.Store(true)
	c.connMu.Lock()
	conns := c.conns
	c.conns = make(map[wsEndpoint]*wsConn)
	c.connMu.Unlock()

	for _, wc := range conns {
		if wc == nil {
			continue
		}
		close(wc.stopCh)
		wc.mu.Lock()
		if wc.conn != nil {
			_ = wc.conn.Close()
			wc.conn = nil
		}
		wc.mu.Unlock()
	}
}

func (c *WebsocketClient) Subscribe(ctx context.Context, args []map[string]any, _ any) error {
	grouped := groupOKXArgs(args)
	for ep, list := range grouped {
		if len(list) == 0 {
			continue
		}
		wc, err := c.ensureConn(ctx, ep)
		if err != nil {
			return err
		}
		if err := wc.addSubs(list); err != nil {
			return err
		}
		if ep == wsPrivate {
			if err := wc.ensureLogin(ctx); err != nil {
				return err
			}
		}
		if err := wc.sendOp(ctx, "subscribe", list); err != nil {
			return err
		}
	}
	return nil
}

func (c *WebsocketClient) Unsubscribe(ctx context.Context, args []map[string]any, _ any) error {
	grouped := groupOKXArgs(args)
	for ep, list := range grouped {
		if len(list) == 0 {
			continue
		}
		wc, err := c.ensureConn(ctx, ep)
		if err != nil {
			return err
		}
		wc.removeSubs(list)
		if err := wc.sendOp(ctx, "unsubscribe", list); err != nil {
			return err
		}
	}
	return nil
}

func groupOKXArgs(args []map[string]any) map[wsEndpoint][]map[string]any {
	out := map[wsEndpoint][]map[string]any{
		wsPublic:   {},
		wsBusiness: {},
		wsPrivate:  {},
	}

	for _, a := range args {
		ch, _ := a["channel"].(string)
		switch {
		case strings.HasPrefix(ch, "candle"):
			out[wsBusiness] = append(out[wsBusiness], a)
		case strings.Contains(ch, "order") || ch == "positions" || ch == "account":
			out[wsPrivate] = append(out[wsPrivate], a)
		default:
			out[wsPublic] = append(out[wsPublic], a)
		}
	}
	return out
}

func (c *WebsocketClient) ensureConn(ctx context.Context, ep wsEndpoint) (*wsConn, error) {
	c.connMu.Lock()
	defer c.connMu.Unlock()

	if existing := c.conns[ep]; existing != nil && existing.isConnected() {
		return existing, nil
	}

	wc := &wsConn{
		endpoint: ep,
		cfg:      c.cfg,
		subs:     make(map[string]map[string]any),
		stopCh:   make(chan struct{}),
	}
	c.conns[ep] = wc

	if err := wc.connect(ctx); err != nil {
		return nil, err
	}

	go wc.readLoop(c)
	go wc.pingLoop()
	return wc, nil
}

func (w *wsConn) isConnected() bool {
	w.mu.Lock()
	defer w.mu.Unlock()
	return w.conn != nil
}

func (w *wsConn) endpointURL() (string, error) {
	if w.cfg.Market != "" && w.cfg.Market != okxtypes.APIMarketGLOBAL {
		return "", fmt.Errorf("unsupported market: %s", w.cfg.Market)
	}
	switch w.endpoint {
	case wsPublic:
		return "wss://ws.okx.com:8443/ws/v5/public", nil
	case wsBusiness:
		return "wss://ws.okx.com:8443/ws/v5/business", nil
	case wsPrivate:
		return "wss://ws.okx.com:8443/ws/v5/private", nil
	default:
		return "", fmt.Errorf("unknown endpoint: %s", w.endpoint)
	}
}

func (w *wsConn) dialer() (*websocket.Dialer, http.Header, error) {
	d := websocket.DefaultDialer
	d.HandshakeTimeout = 15 * time.Second

	// Note: websocket.Dialer is a struct; copy it to avoid races.
	d2 := *d

	if strings.TrimSpace(w.cfg.Proxy) != "" {
		u, err := url.Parse(strings.TrimSpace(w.cfg.Proxy))
		if err != nil {
			return nil, nil, fmt.Errorf("invalid proxy url: %w", err)
		}
		d2.Proxy = http.ProxyURL(u)
	}

	if strings.TrimSpace(w.cfg.SocksProxy) != "" {
		addr := strings.TrimSpace(w.cfg.SocksProxy)
		if u, err := url.Parse(addr); err == nil && u.Host != "" {
			addr = u.Host
		}
		socksDialer, err := proxy.SOCKS5("tcp", addr, nil, proxy.Direct)
		if err != nil {
			return nil, nil, fmt.Errorf("create socks5 dialer: %w", err)
		}
		d2.NetDialContext = func(ctx context.Context, network, address string) (net.Conn, error) {
			return socksDialer.Dial(network, address)
		}
	}

	h := http.Header{}
	if w.cfg.DemoTrading {
		h.Set("x-simulated-trading", "1")
	}
	return &d2, h, nil
}

func (w *wsConn) connect(ctx context.Context) error {
	wsURL, err := w.endpointURL()
	if err != nil {
		return err
	}
	d, hdr, err := w.dialer()
	if err != nil {
		return err
	}

	conn, _, err := d.DialContext(ctx, wsURL, hdr)
	if err != nil {
		return err
	}

	w.mu.Lock()
	if w.conn != nil {
		_ = w.conn.Close()
	}
	w.conn = conn
	w.mu.Unlock()

	w.authMu.Lock()
	w.authed = false
	w.authMu.Unlock()

	return nil
}

func (w *wsConn) pingLoop() {
	ticker := time.NewTicker(25 * time.Second)
	defer ticker.Stop()
	for {
		select {
		case <-w.stopCh:
			return
		case <-ticker.C:
			w.mu.Lock()
			conn := w.conn
			w.mu.Unlock()
			if conn == nil {
				continue
			}
			_ = conn.WriteMessage(websocket.TextMessage, []byte("ping"))
		}
	}
}

func (w *wsConn) readLoop(client *WebsocketClient) {
	for {
		w.mu.Lock()
		conn := w.conn
		w.mu.Unlock()
		if conn == nil {
			return
		}

		_, msg, err := conn.ReadMessage()
		if err != nil {
			client.emit("close", WsRawMessage{Raw: []byte(err.Error())})
			client.emitError(err)
			if client.closed.Load() {
				return
			}

			select {
			case <-w.stopCh:
				return
			case <-time.After(client.cfg.ReconnectTimeout):
			}

			_ = w.connect(context.Background())
			_ = w.resubscribe(context.Background())
			continue
		}

		w.handleMessage(client, msg)
	}
}

func (w *wsConn) handleMessage(client *WebsocketClient, msg []byte) {
	if string(msg) == "pong" {
		return
	}

	// Fast path: detect `event` vs `arg/data`.
	var probe struct {
		Event string          `json:"event"`
		Code  string          `json:"code"`
		Msg   string          `json:"msg"`
		Arg   json.RawMessage `json:"arg"`
		Data  json.RawMessage `json:"data"`
	}
	if err := json.Unmarshal(msg, &probe); err != nil {
		client.emit("exception", WsRawMessage{Raw: msg})
		return
	}

	if probe.Event != "" {
		ev := WsEvent{Message: WsEventMessage{Event: probe.Event, Code: probe.Code, Msg: probe.Msg}, Raw: msg}
		switch probe.Event {
		case "login":
			if probe.Code == "0" {
				w.authMu.Lock()
				w.authed = true
				w.authMu.Unlock()
				client.emit("authenticated", ev)
				return
			}
			client.emit("exception", ev)
			return
		case "error":
			client.emit("exception", ev)
			return
		default:
			// ignore subscribe/unsubscribe/etc
			return
		}
	}

	if len(probe.Arg) > 0 && len(probe.Data) > 0 {
		client.emit("update", WsDataEvent{
			Message: WsDataEventMessage{Arg: probe.Arg, Data: probe.Data},
			Raw:     msg,
		})
		return
	}
}

func (w *wsConn) addSubs(args []map[string]any) error {
	w.subsMu.Lock()
	defer w.subsMu.Unlock()
	for _, a := range args {
		key := canonicalJSONKey(a)
		w.subs[key] = a
	}
	return nil
}

func (w *wsConn) removeSubs(args []map[string]any) {
	w.subsMu.Lock()
	defer w.subsMu.Unlock()
	for _, a := range args {
		key := canonicalJSONKey(a)
		delete(w.subs, key)
	}
}

func (w *wsConn) resubscribe(ctx context.Context) error {
	w.subsMu.Lock()
	args := make([]map[string]any, 0, len(w.subs))
	for _, a := range w.subs {
		args = append(args, a)
	}
	w.subsMu.Unlock()

	if len(args) == 0 {
		return nil
	}
	if w.endpoint == wsPrivate {
		if err := w.ensureLogin(ctx); err != nil {
			return err
		}
	}
	return w.sendOp(ctx, "subscribe", args)
}

func canonicalJSONKey(v any) string {
	b, err := json.Marshal(v)
	if err != nil {
		return fmt.Sprintf("%v", v)
	}
	return string(b)
}

func (w *wsConn) sendOp(ctx context.Context, op string, args []map[string]any) error {
	w.mu.Lock()
	conn := w.conn
	w.mu.Unlock()
	if conn == nil {
		return fmt.Errorf("okx ws not connected (%s)", w.endpoint)
	}
	payload := map[string]any{
		"op":   op,
		"args": args,
	}
	b, err := json.Marshal(payload)
	if err != nil {
		return err
	}
	_ = ctx
	return conn.WriteMessage(websocket.TextMessage, b)
}

func (w *wsConn) ensureLogin(ctx context.Context) error {
	if w.endpoint != wsPrivate {
		return nil
	}

	w.authMu.Lock()
	authed := w.authed
	w.authMu.Unlock()
	if authed {
		return nil
	}

	creds := firstCred(w.cfg.Accounts)
	if creds.APIKey == "" || creds.APISecret == "" || creds.APIPass == "" {
		return fmt.Errorf("missing okx ws credentials")
	}

	ts := strconv.FormatInt(time.Now().Unix(), 10)
	prehash := ts + "GET" + "/users/self/verify"
	sign := signOKXWS(creds.APISecret, prehash)

	login := map[string]any{
		"op": "login",
		"args": []map[string]string{{
			"apiKey":     creds.APIKey,
			"passphrase": creds.APIPass,
			"timestamp":  ts,
			"sign":       sign,
		}},
	}
	b, err := json.Marshal(login)
	if err != nil {
		return err
	}

	w.mu.Lock()
	conn := w.conn
	w.mu.Unlock()
	if conn == nil {
		return fmt.Errorf("okx ws not connected")
	}
	if err := conn.WriteMessage(websocket.TextMessage, b); err != nil {
		return err
	}

	// Wait briefly for authenticated event to arrive.
	deadline := time.NewTimer(5 * time.Second)
	defer deadline.Stop()
	tick := time.NewTicker(50 * time.Millisecond)
	defer tick.Stop()

	for {
		select {
		case <-ctx.Done():
			return ctx.Err()
		case <-deadline.C:
			return fmt.Errorf("okx ws login timeout")
		case <-w.stopCh:
			return fmt.Errorf("okx ws closed")
		case <-tick.C:
			w.authMu.Lock()
			ok := w.authed
			w.authMu.Unlock()
			if ok {
				return nil
			}
		}
	}
}

func firstCred(list []okxtypes.APICredentials) okxtypes.APICredentials {
	if len(list) > 0 {
		return list[0]
	}
	return okxtypes.APICredentials{}
}

func signOKXWS(secret string, prehash string) string {
	mac := hmac.New(sha256.New, []byte(secret))
	_, _ = mac.Write([]byte(prehash))
	return base64.StdEncoding.EncodeToString(mac.Sum(nil))
}
