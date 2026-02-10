import React, { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card, Input, Spin, Empty } from '@douyinfe/semi-ui-19'
import { IconSearch } from '@douyinfe/semi-icons'
import { useQuery } from '@tanstack/react-query'
import { marketApi } from '@/api/market'
import { useAppStore } from '@/stores/appStore'
import { SymbolCard } from '@/components/market/SymbolCard'

const Market: React.FC = () => {
  const navigate = useNavigate()
  const { selectedExchange } = useAppStore()
  const [search, setSearch] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['market-symbols', selectedExchange?.exchangeType],
    queryFn: () =>
      marketApi.getSymbols({
        exchange: selectedExchange?.exchangeType || 'BINANCE',
        trade_type: 'futures',
      }),
    refetchInterval: 5000,
  })

  const symbols = data?.symbols || []

  const filtered = useMemo(() => {
    if (!search) return symbols
    const q = search.toUpperCase()
    return symbols.filter(
      (s) =>
        s.symbol.toUpperCase().includes(q) ||
        s.baseCurrency.toUpperCase().includes(q)
    )
  }, [symbols, search])

  return (
    <div>
      <Card
        title="行情总览"
        headerExtraContent={
          <Input
            prefix={<IconSearch />}
            placeholder="搜索交易对..."
            value={search}
            onChange={setSearch}
            style={{ width: 240 }}
            showClear
          />
        }
      >
        {isLoading ? (
          <div style={{ textAlign: 'center', padding: 60 }}>
            <Spin size="large" />
          </div>
        ) : filtered.length === 0 ? (
          <Empty description="暂无数据" />
        ) : (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
              gap: 16,
            }}
          >
            {filtered.map((s) => (
              <SymbolCard
                key={s.symbol}
                data={s}
                onClick={(symbol) => navigate(`/trading/${symbol}`)}
              />
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}

export default Market
