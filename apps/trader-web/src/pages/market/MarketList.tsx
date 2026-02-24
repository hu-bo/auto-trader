import React, { useState } from 'react'
import {
  Card,
  Typography,
  Input,
  Select,
  Empty,
  Modal,
  Spin,
} from '@douyinfe/semi-ui-19'
import { IconSearch } from '@douyinfe/semi-icons'
import { useQuery } from '@tanstack/react-query'
import { SymbolCard } from '@/components/market/SymbolCard'
import { StrategyOrderForm } from '@/components/trading/StrategyOrderForm'
import { marketApi } from '@/api'
import type { TickerData } from '@/api/market'

const { Title } = Typography

type SortType = 'default' | 'volume_desc' | 'volume_asc' | 'change_desc' | 'change_asc'

const MarketList: React.FC = () => {
  const [exchange, setExchange] = useState('binance')
  const [tradeType, setTradeType] = useState('spot')
  const [searchText, setSearchText] = useState('')
  const [sortType, setSortType] = useState<SortType>('volume_desc')
  const [orderModalVisible, setOrderModalVisible] = useState(false)
  const [selectedSymbol, setSelectedSymbol] = useState<TickerData | null>(null)

  const { data: symbolsData, isLoading } = useQuery({
    queryKey: ['market-symbols', exchange, tradeType],
    queryFn: () => marketApi.getTickers({ exchange, trade_type: tradeType }),
    refetchInterval: 10000, // 每10秒刷新一次
  })

  const symbols = symbolsData?.tickers || []

  const filteredSymbols = React.useMemo(() => {
    const filtered = symbols.filter((s) =>
      s.symbol.toLowerCase().includes(searchText.toLowerCase())
    )
    
    if (sortType === 'default') {
      return filtered
    }
    
    return [...filtered].sort((a, b) => {
      switch (sortType) {
        case 'volume_desc':
          return (b.quoteVolume24h || 0) - (a.quoteVolume24h || 0)
        case 'volume_asc':
          return (a.quoteVolume24h || 0) - (b.quoteVolume24h || 0)
        case 'change_desc':
          return (b.priceChangePct || 0) - (a.priceChangePct || 0)
        case 'change_asc':
          return (a.priceChangePct || 0) - (b.priceChangePct || 0)
        default:
          return 0
      }
    })
  }, [symbols, searchText, sortType])

  const handleSymbolClick = (symbol: string) => {
    const symbolData = symbols.find((s: TickerData) => s.symbol === symbol)
    if (symbolData) {
      setSelectedSymbol(symbolData)
      setOrderModalVisible(true)
    }
  }

  return (
    <div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 24,
        }}
      >
        <Title heading={4}>行情列表</Title>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <Select
            value={exchange}
            onChange={(value) => setExchange(value as string)}
            style={{ width: 120 }}
          >
            <Select.Option value="binance">Binance</Select.Option>
            <Select.Option value="okx">OKX</Select.Option>
          </Select>
          <Select
            value={tradeType}
            onChange={(value) => setTradeType(value as string)}
            style={{ width: 120 }}
          >
            <Select.Option value="spot">现货</Select.Option>
            <Select.Option value="futures">合约</Select.Option>
          </Select>
          <Select
            value={sortType}
            onChange={(value) => setSortType(value as SortType)}
            style={{ width: 150 }}
            placeholder="排序方式"
          >
            <Select.Option value="volume_desc">交易量 ↓</Select.Option>
            <Select.Option value="volume_asc">交易量 ↑</Select.Option>
            <Select.Option value="change_desc">涨幅 ↓</Select.Option>
            <Select.Option value="change_asc">涨幅 ↑</Select.Option>
          </Select>
          <Input
            prefix={<IconSearch />}
            placeholder="搜索交易对"
            value={searchText}
            onChange={setSearchText}
            style={{ width: 200 }}
          />
        </div>
      </div>

      <Card>
        {isLoading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}>
            <Spin size="large" />
          </div>
        ) : filteredSymbols && filteredSymbols.length > 0 ? (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
              gap: 16,
            }}
          >
            {filteredSymbols.map((symbol: TickerData) => (
              <SymbolCard
                key={`${exchange}-${symbol.symbol}`}
                data={symbol}
                onClick={handleSymbolClick}
              />
            ))}
          </div>
        ) : (
          <Empty description="暂无数据" />
        )}
      </Card>

      <Modal
        title={`创建策略订单 - ${selectedSymbol?.symbol}`}
        visible={orderModalVisible}
        onCancel={() => {
          setOrderModalVisible(false)
          setSelectedSymbol(null)
        }}
        footer={null}
        width={600}
      >
        {selectedSymbol && (
          <StrategyOrderForm
            defaultSymbol={selectedSymbol.symbol}
            defaultExchange={exchange}
            onSuccess={() => {
              setOrderModalVisible(false)
              setSelectedSymbol(null)
            }}
          />
        )}
      </Modal>
    </div>
  )
}

export default MarketList
