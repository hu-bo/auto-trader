package aggregator

import (
	"cmp"
	"context"
	"slices"
	"sync"
	"time"

	"exchange-sync/internal/exchange"
	"exchange-sync/pkg/utils"
)

// OrderBookManager 订单簿管理器
// 管理大单过滤和订单簿维护
type OrderBookManager struct {
	thresholdUSD float64 // 大单阈值
	expireHours  int     // 过期时间
	mu           sync.RWMutex

	// symbol -> OrderBookData
	books map[string]*OrderBookData

	// 回调
	onUpdate func(exchange.OrderBook)

	ctx    context.Context
	cancel context.CancelFunc
	wg     sync.WaitGroup
}

// OrderBookData 单个交易对的订单簿数据
type OrderBookData struct {
	Symbol    string
	Bids      map[float64]*BigOrder // price -> *BigOrder (查询时再排序)
	Asks      map[float64]*BigOrder // price -> *BigOrder (查询时再排序)
	LastPrice float64
	mu        sync.RWMutex
}

// BigOrder 大单记录
type BigOrder struct {
	Price     float64
	Quantity  float64
	USDValue  float64
	Timestamp int64
}

// NewOrderBookManager 创建订单簿管理器
func NewOrderBookManager(thresholdUSD float64, expireHours int) *OrderBookManager {
	ctx, cancel := context.WithCancel(context.Background())
	mgr := &OrderBookManager{
		thresholdUSD: thresholdUSD,
		expireHours:  expireHours,
		books:        make(map[string]*OrderBookData),
		ctx:          ctx,
		cancel:       cancel,
	}

	mgr.wg.Add(1)
	go mgr.cleanupLoop()

	return mgr
}

// OnUpdate 设置更新回调
func (m *OrderBookManager) OnUpdate(handler func(exchange.OrderBook)) {
	m.onUpdate = handler
}

// ProcessDepth 处理深度更新
// 只做过滤（≥ thresholdUSD），不排序，查询时再排序
func (m *OrderBookManager) ProcessDepth(depth exchange.DepthUpdate) {
	m.mu.Lock()
	book, ok := m.books[depth.Symbol]
	if !ok {
		book = &OrderBookData{
			Symbol: depth.Symbol,
			Bids:   make(map[float64]*BigOrder),
			Asks:   make(map[float64]*BigOrder),
		}
		m.books[depth.Symbol] = book
	}
	m.mu.Unlock()

	book.mu.Lock()
	defer book.mu.Unlock()

	now := time.Now().UnixMilli()

	// 处理买单
	for _, entry := range depth.Bids {
		usdValue := entry.Price * entry.Quantity
		if entry.Quantity == 0 || usdValue < m.thresholdUSD {
			delete(book.Bids, entry.Price)
		} else {
			book.Bids[entry.Price] = &BigOrder{
				Price:     entry.Price,
				Quantity:  entry.Quantity,
				USDValue:  usdValue,
				Timestamp: now,
			}
		}
	}

	// 处理卖单
	for _, entry := range depth.Asks {
		usdValue := entry.Price * entry.Quantity
		if entry.Quantity == 0 || usdValue < m.thresholdUSD {
			delete(book.Asks, entry.Price)
		} else {
			book.Asks[entry.Price] = &BigOrder{
				Price:     entry.Price,
				Quantity:  entry.Quantity,
				USDValue:  usdValue,
				Timestamp: now,
			}
		}
	}

	// 从 asks[0] 和 bids[0] 计算 LastPrice (取中间价)
	if len(depth.Bids) > 0 && len(depth.Asks) > 0 {
		book.LastPrice = (depth.Bids[0].Price + depth.Asks[0].Price) / 2
	} else if len(depth.Bids) > 0 {
		book.LastPrice = depth.Bids[0].Price
	} else if len(depth.Asks) > 0 {
		book.LastPrice = depth.Asks[0].Price
	}

	// 发送更新回调
	if m.onUpdate != nil {
		m.onUpdate(m.getOrderBookLocked(book))
	}
}

// GetOrderBook 获取订单簿
func (m *OrderBookManager) GetOrderBook(symbol string) *exchange.OrderBook {
	m.mu.RLock()
	book, ok := m.books[symbol]
	m.mu.RUnlock()

	if !ok {
		return nil
	}

	book.mu.RLock()
	defer book.mu.RUnlock()

	result := m.getOrderBookLocked(book)
	return &result
}

// GetFilteredBook 获取指定价格范围内的大单
func (m *OrderBookManager) GetFilteredBook(symbol string, priceRange float64) *exchange.OrderBook {
	m.mu.RLock()
	book, ok := m.books[symbol]
	m.mu.RUnlock()

	if !ok {
		return nil
	}

	book.mu.RLock()
	defer book.mu.RUnlock()

	if book.LastPrice == 0 {
		return nil
	}

	minPrice := book.LastPrice * (1 - priceRange)
	maxPrice := book.LastPrice * (1 + priceRange)

	// 过滤买单并排序 (价格降序)
	bids := make([]exchange.OrderBookEntry, 0, len(book.Bids))
	for price, order := range book.Bids {
		if price >= minPrice && price <= book.LastPrice {
			bids = append(bids, exchange.OrderBookEntry{
				Price:     order.Price,
				Quantity:  order.Quantity,
				USDValue:  order.USDValue,
				Timestamp: order.Timestamp,
			})
		}
	}
	slices.SortFunc(bids, func(a, b exchange.OrderBookEntry) int {
		return cmp.Compare(b.Price, a.Price) // 降序
	})

	// 过滤卖单并排序 (价格升序)
	asks := make([]exchange.OrderBookEntry, 0, len(book.Asks))
	for price, order := range book.Asks {
		if price <= maxPrice && price >= book.LastPrice {
			asks = append(asks, exchange.OrderBookEntry{
				Price:     order.Price,
				Quantity:  order.Quantity,
				USDValue:  order.USDValue,
				Timestamp: order.Timestamp,
			})
		}
	}
	slices.SortFunc(asks, func(a, b exchange.OrderBookEntry) int {
		return cmp.Compare(a.Price, b.Price) // 升序
	})

	return &exchange.OrderBook{
		Symbol: symbol,
		Bids:   bids,
		Asks:   asks,
		Price:  book.LastPrice,
	}
}

// GetTracePrice 获取按距离排序的 Top6 大单价格
func (m *OrderBookManager) GetTracePrice(symbol string, distance float64) *TracePriceResult {
	m.mu.RLock()
	book, ok := m.books[symbol]
	m.mu.RUnlock()

	if !ok {
		return nil
	}

	book.mu.RLock()
	defer book.mu.RUnlock()

	if book.LastPrice == 0 {
		return nil
	}

	// 预分配容量
	all := make([]TracePrice, 0, len(book.Bids)+len(book.Asks))

	// 收集符合条件的买单
	for price, order := range book.Bids {
		dist := (book.LastPrice - price) / book.LastPrice
		if dist <= distance {
			all = append(all, TracePrice{
				Price:    price,
				USDValue: order.USDValue,
				Distance: dist,
				IsBid:    true,
			})
		}
	}

	// 收集符合条件的卖单
	for price, order := range book.Asks {
		dist := (price - book.LastPrice) / book.LastPrice
		if dist <= distance {
			all = append(all, TracePrice{
				Price:    price,
				USDValue: order.USDValue,
				Distance: dist,
				IsBid:    false,
			})
		}
	}

	// 按距离排序
	slices.SortFunc(all, func(a, b TracePrice) int {
		return cmp.Compare(a.Distance, b.Distance)
	})

	// 取 Top 6
	limit := 6
	if len(all) < limit {
		limit = len(all)
	}

	return &TracePriceResult{
		Symbol:       symbol,
		CurrentPrice: book.LastPrice,
		Traces:       all[:limit],
	}
}

// TracePriceResult 追踪价格结果
type TracePriceResult struct {
	Symbol       string       `json:"symbol"`
	CurrentPrice float64      `json:"current_price"`
	Traces       []TracePrice `json:"traces"`
}

// TracePrice 追踪价格
type TracePrice struct {
	Price    float64 `json:"price"`
	USDValue float64 `json:"usd_value"`
	Distance float64 `json:"distance"`
	IsBid    bool    `json:"is_bid"`
}

func (m *OrderBookManager) getOrderBookLocked(book *OrderBookData) exchange.OrderBook {
	// 买单: 价格降序
	bids := make([]exchange.OrderBookEntry, 0, len(book.Bids))
	for _, order := range book.Bids {
		bids = append(bids, exchange.OrderBookEntry{
			Price:     order.Price,
			Quantity:  order.Quantity,
			USDValue:  order.USDValue,
			Timestamp: order.Timestamp,
		})
	}
	slices.SortFunc(bids, func(a, b exchange.OrderBookEntry) int {
		return cmp.Compare(b.Price, a.Price) // 降序
	})

	// 卖单: 价格升序
	asks := make([]exchange.OrderBookEntry, 0, len(book.Asks))
	for _, order := range book.Asks {
		asks = append(asks, exchange.OrderBookEntry{
			Price:     order.Price,
			Quantity:  order.Quantity,
			USDValue:  order.USDValue,
			Timestamp: order.Timestamp,
		})
	}
	slices.SortFunc(asks, func(a, b exchange.OrderBookEntry) int {
		return cmp.Compare(a.Price, b.Price) // 升序
	})

	return exchange.OrderBook{
		Symbol: book.Symbol,
		Bids:   bids,
		Asks:   asks,
		Price:  book.LastPrice,
	}
}

func (m *OrderBookManager) cleanupLoop() {
	defer m.wg.Done()

	ticker := time.NewTicker(time.Hour)
	defer ticker.Stop()

	for {
		select {
		case <-m.ctx.Done():
			return
		case <-ticker.C:
			m.cleanup()
		}
	}
}

func (m *OrderBookManager) cleanup() {
	cutoff := utils.HoursAgo(m.expireHours)

	m.mu.RLock()
	books := make([]*OrderBookData, 0, len(m.books))
	for _, book := range m.books {
		books = append(books, book)
	}
	m.mu.RUnlock()

	for _, book := range books {
		book.mu.Lock()

		// 清理过期的买单
		for price, order := range book.Bids {
			if order.Timestamp < cutoff {
				delete(book.Bids, price)
			}
		}

		// 清理过期的卖单
		for price, order := range book.Asks {
			if order.Timestamp < cutoff {
				delete(book.Asks, price)
			}
		}

		book.mu.Unlock()
	}
}

// Close 关闭管理器
func (m *OrderBookManager) Close() {
	m.cancel()
	m.wg.Wait()
}
