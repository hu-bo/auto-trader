import React, { useState, useMemo, useEffect } from 'react'
import {
  Card,
  Typography,
  Input,
  Select,
  Empty,
  Modal,
  Spin,
  Tag,
  Button,
  InputNumber,
  RadioGroup,
  Radio,
  Toast,
  Checkbox,
} from '@douyinfe/semi-ui-19'
import { IconSearch, IconFilter, IconTick } from '@douyinfe/semi-icons'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useSearchParams } from 'react-router-dom'
import { SymbolCard } from '@/components/market/SymbolCard'
import { StrategyOrderForm } from '@/components/trading/StrategyOrderForm'
import { BatchAlgoOrderForm } from '@/components/trading/BatchAlgoOrderForm'
import { marketApi } from '@/api'
import { batchOrderApi } from '@/api/batch-order'
import { useAppStore } from '@/stores/appStore'
import { useMarketStore, getMarketSymbolsKey } from '@/stores/marketStore'
import { useNavigateKeepParams } from '@/hooks'
import { storage, STORAGE_KEYS } from '@/utils/storage'
import type { TickerData } from '@/api/market'

const { Title, Text } = Typography

type SortType = 'default' | 'volume_desc' | 'volume_asc' | 'change_desc' | 'change_asc'
type FilterType = 'none' | 'gainers' | 'losers'

const DEFAULT_FILTER = { filterType: 'none', topN: 20 } as const

const MarketList: React.FC = () => {
  const { selectedExchange, tradingTradeType, setTradingTradeType } = useAppStore()
  const [searchParams] = useSearchParams()
  const navigate = useNavigateKeepParams()
  const queryClient = useQueryClient()
  const exchange = selectedExchange?.exchangeType?.toLowerCase() || 'binance'
  const symbolsKey = getMarketSymbolsKey(exchange, tradingTradeType)
  const syncEnabledByKey = useMarketStore((state) => state.syncEnabledByKey)
  const fetchSymbols = useMarketStore((state) => state.fetchSymbols)
  const exchangeIdFromUrl = useMemo(() => {
    const exchangeId = Number(searchParams.get('exchangeId'))
    return Number.isFinite(exchangeId) && exchangeId > 0 ? exchangeId : undefined
  }, [searchParams])
  const [searchText, setSearchText] = useState('')
  const [sortType, setSortType] = useState<SortType>('volume_desc')

  // Selection state
  const [selectedSymbols, setSelectedSymbols] = useState<Set<string>>(new Set())

  // Filter state (cached)
  const cachedFilter =
    storage.get<{ filterType: FilterType; topN: number }>(STORAGE_KEYS.MARKET_FILTER, DEFAULT_FILTER) || DEFAULT_FILTER
  const [filterType, setFilterType] = useState<FilterType>(cachedFilter.filterType)
  const [topN, setTopN] = useState(cachedFilter.topN)
  const [filterModalVisible, setFilterModalVisible] = useState(false)
  const [tempFilterType, setTempFilterType] = useState<FilterType>(filterType)
  const [tempTopN, setTempTopN] = useState(topN)

  // Order modals
  const [strategyModalVisible, setStrategyModalVisible] = useState(false)
  const [batchOrderModalVisible, setBatchOrderModalVisible] = useState(false)
  const [batchFormKey, setBatchFormKey] = useState(0)
  const [selectedSymbol, setSelectedSymbol] = useState<TickerData | null>(null)

  const { data: symbolsData, isLoading } = useQuery({
    queryKey: ['market-symbols', exchange, tradingTradeType],
    queryFn: () => marketApi.getTickers({ exchange, trade_type: tradingTradeType }),
    refetchInterval: 10000,
  })

  const symbols = symbolsData?.tickers || []
  const syncEnabledSymbols = syncEnabledByKey[symbolsKey] || []
  const hasSyncEnabledLoaded = Object.prototype.hasOwnProperty.call(syncEnabledByKey, symbolsKey)
  const syncEnabledSet = useMemo(
    () => new Set(syncEnabledSymbols.map((s) => s.symbol)),
    [syncEnabledSymbols]
  )

  useEffect(() => {
    fetchSymbols(exchange, tradingTradeType)
  }, [exchange, tradingTradeType, fetchSymbols])

  // Apply filter + search + sort
  const filteredSymbols = useMemo(() => {
    let result = [...symbols]

    result.forEach((s) => {
      if (syncEnabledSet.has(s.symbol)) {
        s.syncEnabled = true
      }
    })

    // Apply filter (front-end based)
    if (filterType !== 'none') {
      result.sort((a, b) => (b.priceChangePct || 0) - (a.priceChangePct || 0))
      if (filterType === 'gainers') {
        result = result.slice(0, topN)
      } else {
        result = result.slice(-topN).reverse()
      }
    }

    // Search
    if (searchText) {
      result = result.filter((s) => s.symbol.toLowerCase().includes(searchText.toLowerCase()))
    }

    // Sort
    if (sortType !== 'default') {
      result = [...result].sort((a, b) => {
        switch (sortType) {
          case 'volume_desc': return (b.quoteVolume24h || 0) - (a.quoteVolume24h || 0)
          case 'volume_asc': return (a.quoteVolume24h || 0) - (b.quoteVolume24h || 0)
          case 'change_desc': return (b.priceChangePct || 0) - (a.priceChangePct || 0)
          case 'change_asc': return (a.priceChangePct || 0) - (b.priceChangePct || 0)
          default: return 0
        }
      })
    }

    return result
  }, [symbols, searchText, sortType, filterType, topN, hasSyncEnabledLoaded, syncEnabledSet])

  const handleSymbolClick = (symbol: string) => {
    setSelectedSymbols((prev) => {
      const next = new Set(prev)
      if (next.has(symbol)) next.delete(symbol)
      else next.add(symbol)
      return next
    })
  }

  const handleSelectAll = () => {
    if (selectedSymbols.size === filteredSymbols.length) {
      setSelectedSymbols(new Set())
    } else {
      setSelectedSymbols(new Set(filteredSymbols.map((s) => s.symbol)))
    }
  }
  const handleTradeTypeChange = (v: any) => {
    setTradingTradeType(v)
    setSelectedSymbols(new Set())
  }
  const handleApplyFilter = () => {
    setFilterType(tempFilterType)
    setTopN(tempTopN)
    storage.set(STORAGE_KEYS.MARKET_FILTER, { filterType: tempFilterType, topN: tempTopN })
    setFilterModalVisible(false)
    setSelectedSymbols(new Set())
  }

  const handleCreateStrategy = (data: TickerData) => {
    setSelectedSymbol(data)
    setStrategyModalVisible(true)
  }

  const handleViewStrategy = (strategyOrderId: number | string) => {
    navigate(`/strategy-orders/${strategyOrderId}`)
  }

  const handleBatchOrder = async (params: any) => {
    if (!selectedExchange?.id) {
      Toast.error('请先选择交易所')
      return
    }
    const exchangeId = parseInt(String(selectedExchange.id))
    const syms = [...selectedSymbols]
    const payload = { ...params, exchangeId, symbols: syms }

    try {
      const result = await batchOrderApi.placeBatchStrategy(payload)
      const successCount = result.successCount ?? (result as any).success_count ?? 0
      const failedCount = result.failedCount ?? (result as any).failed_count ?? 0
      const resultSymbols = (result.symbols && result.symbols.length > 0) ? result.symbols : syms
      const resultList = Array.isArray(result.results) ? result.results : []
      Modal.info({
        title: '批量下单结果',
        content: (
          <div>
            <div style={{ marginBottom: 8 }}>
              成功: {successCount}, 失败: {failedCount}
            </div>
            <div style={{ maxHeight: 260, overflowY: 'auto' }}>
              {resultSymbols.map((symbol, idx) => {
                const item = resultList[idx]
                const success = !!item?.success
                const message = success ? '成功' : (item?.error?.message || '下单失败')
                return (
                  <div key={`${symbol}-${idx}`} style={{ display: 'flex', gap: 8, marginBottom: 6 }}>
                    <Text strong>{symbol}</Text>
                    <Text type={success ? 'success' : 'danger'}>{message}</Text>
                  </div>
                )
              })}
            </div>
          </div>
        ),
        onOk() {
          if (successCount > 0) {
            queryClient.invalidateQueries({ queryKey: ['orders'] })
            navigate('/orders')
          }
        },
        onCancel(e) {

        },
      })
    } catch (err: any) {
      // Toast.error(err.message || '下单失败')
    }
  }

  const selectionCount = selectedSymbols.size
  const isAllSelected = filteredSymbols.length > 0 && selectionCount === filteredSymbols.length

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <Title heading={4}>行情列表</Title>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <Tag size="large" color="blue">{exchange.toUpperCase()}</Tag>
          <Select
            value={tradingTradeType}
            onChange={handleTradeTypeChange}
            style={{ width: 120 }}
          >
            <Select.Option value="spot">现货</Select.Option>
            <Select.Option value="futures">合约</Select.Option>
          </Select>
          <Select value={sortType} onChange={(v) => setSortType(v as SortType)} style={{ width: 150 }} placeholder="排序方式">
            <Select.Option value="volume_desc">交易量 ↓</Select.Option>
            <Select.Option value="volume_asc">交易量 ↑</Select.Option>
            <Select.Option value="change_desc">涨幅 ↓</Select.Option>
            <Select.Option value="change_asc">涨幅 ↑</Select.Option>
          </Select>
          <Button
            icon={<IconFilter />}
            theme={filterType !== 'none' ? 'solid' : 'light'}
            onClick={() => { setTempFilterType(filterType); setTempTopN(topN); setFilterModalVisible(true) }}
          >
            {filterType === 'none' ? '筛选' : filterType === 'gainers' ? `涨幅前${topN}` : `跌幅前${topN}`}
          </Button>
          <Input prefix={<IconSearch />} placeholder="搜索交易对" value={searchText} onChange={setSearchText} style={{ width: 200 }} />
        </div>
      </div>

      {/* Selection toolbar */}
      {filteredSymbols.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          <Checkbox checked={isAllSelected} indeterminate={selectionCount > 0 && !isAllSelected} onChange={handleSelectAll}>
            全选
          </Checkbox>
          {(
            <>
              <Tag color="blue">已选 {selectionCount} 个</Tag>
              <Button theme="light" size="small" onClick={() => setBatchOrderModalVisible(true)} disabled={selectionCount == 0}>
                创建条件委托单
              </Button>
              <Text type="tertiary" size="small">提示：条件单基于交易所官方条件单能力</Text>
            </>
          )}
        </div>
      )}

      <Card>
        {isLoading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}><Spin size="large" /></div>
        ) : filteredSymbols.length > 0 ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
            {filteredSymbols.map((symbol: TickerData) => (
              <div key={`${exchange}-${symbol.symbol}`} style={{ position: 'relative' }}>
                {selectedSymbols.has(symbol.symbol) && (
                  <div style={{
                    position: 'absolute', top: 8, right: 8, zIndex: 1,
                    width: 20, height: 20, borderRadius: '50%',
                    background: 'var(--semi-color-primary)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <IconTick style={{ color: '#fff', fontSize: 12 }} />
                  </div>
                )}
                <div style={{
                  border: selectedSymbols.has(symbol.symbol) ? '2px solid var(--semi-color-primary)' : '2px solid transparent',
                  borderRadius: 10,
                }}>
                  <SymbolCard
                    data={symbol}
                    onClick={handleSymbolClick}
                    onCreateStrategy={handleCreateStrategy}
                    onViewStrategy={handleViewStrategy}
                    syncEnabled={symbol.syncEnabled}
                  />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <Empty description="暂无数据" />
        )}
      </Card>

      {/* Filter Modal */}
      <Modal
        title="筛选条件"
        visible={filterModalVisible}
        onCancel={() => setFilterModalVisible(false)}
        onOk={handleApplyFilter}
        okText="应用"
        width={400}
      >
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 13, color: 'var(--semi-color-text-2)', marginBottom: 8, fontWeight: 500 }}>
            筛选模式（单选）
          </div>
          <RadioGroup
            value={tempFilterType}
            onChange={(e) => setTempFilterType(e.target.value as FilterType)}
            direction="vertical"
          >
            <Radio value="none">不筛选</Radio>
            <Radio value="gainers">涨幅前 N</Radio>
            <Radio value="losers">跌幅前 N</Radio>
          </RadioGroup>
        </div>
        {tempFilterType !== 'none' && (
          <div>
            <div style={{ fontSize: 13, color: 'var(--semi-color-text-2)', marginBottom: 8, fontWeight: 500 }}>
              数量 N
            </div>
            <InputNumber value={tempTopN} onChange={(v) => setTempTopN(v as number)} min={1} max={200} style={{ width: 120 }} />
          </div>
        )}
      </Modal>

      {/* Strategy Order Modal */}
      <Modal
        title={selectedSymbol ? `创建策略订单 - ${selectedSymbol.symbol}` : '创建策略订单'}
        visible={strategyModalVisible}
        onCancel={() => { setStrategyModalVisible(false); setSelectedSymbol(null) }}
        footer={<div style={{ height: '1px' }} />}
        width={600}
      >
        <StrategyOrderForm
          key={strategyModalVisible ? `open-${selectedSymbol?.symbol ?? 'new'}` : 'closed'}
          tradeType={tradingTradeType}
          exchangeId={exchangeIdFromUrl}
          defaultSymbol={selectedSymbol ? [selectedSymbol.symbol] : []}
          defaultExchange={exchange}
          onSuccess={() => { setStrategyModalVisible(false); setSelectedSymbol(null) }}
        />
      </Modal>

      {/* Batch Conditional Order Modal */}
      <Modal
        title={`创建条件单 (${selectionCount} 个交易对)`}
        visible={batchOrderModalVisible}
        onCancel={() => {
          setBatchOrderModalVisible(false)
          setBatchFormKey((prev) => prev + 1)
        }}
        footer={<div style={{ height: '1px' }} />}
        width={600}
      >
        <BatchAlgoOrderForm
          key={`batch-form-${batchFormKey}`}
          tradeType={tradingTradeType}
          onSubmit={handleBatchOrder}
        />
      </Modal>
    </div>
  )
}

export default MarketList
