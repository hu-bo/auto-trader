import React, { useState, useMemo } from 'react'
import {
  Table,
  InputNumber,
  Radio,
  RadioGroup,
  Button,
  Modal,
  Toast,
  Card,
  Typography,
  Empty,
  Tag,
} from '@douyinfe/semi-ui-19'
import type { ColumnProps } from '@douyinfe/semi-ui-19/lib/es/table/interface'
import { useQuery } from '@tanstack/react-query'
import { marketApi, TickerData } from '@/api/market'
import { batchOrderApi } from '@/api/batch-order'
import { useAppStore } from '@/stores/appStore'
import { useNavigateKeepParams } from '@/hooks'
import { formatPrice, formatNumber, getPnlColor } from '@/utils/format'

type FilterMode = 'gainers' | 'losers'

const BatchTrading: React.FC = () => {
  const navigate = useNavigateKeepParams()
  const { selectedExchange } = useAppStore()
  const exchange = selectedExchange?.exchangeType?.toLowerCase() || 'binance'
  const marketTradeType = 'futures'
  const strategyTradeType = 'usdm-algo'
  const [filterMode, setFilterMode] = useState<FilterMode>('gainers')
  const [topN, setTopN] = useState(20)
  const [selectedRowKeys, setSelectedRowKeys] = useState<(string | number)[]>([])
  const [direction, setDirection] = useState<'buy_long' | 'sell_short'>('buy_long')
  const [amountUSDT, setAmountUSDT] = useState<number>(100)
  const [priceOffsetPercent, setPriceOffsetPercent] = useState<number>(1)
  const [stopLossPercent, setStopLossPercent] = useState<number>(5)
  const [takeProfitPercent, setTakeProfitPercent] = useState<number>(10)
  const [leverage, setLeverage] = useState<number>(10)
  const [submitting, setSubmitting] = useState(false)

  const { data: tickerData, isLoading } = useQuery({
    queryKey: ['batch-tickers', exchange, marketTradeType],
    queryFn: () => marketApi.getTickers({ exchange, trade_type: marketTradeType }),
    refetchInterval: 10000,
  })
  const tickers = tickerData?.tickers || []

  const filteredTickers = useMemo(() => {
    if (!tickers.length) return []
    const sorted = [...tickers].sort(
      (a, b) => (b.priceChangePct || 0) - (a.priceChangePct || 0)
    )
    if (filterMode === 'gainers') {
      return sorted.slice(0, topN)
    }
    return sorted.slice(-topN).reverse()
  }, [tickers, filterMode, topN])

  const columns: ColumnProps<TickerData>[] = [
    {
      title: '交易对',
      dataIndex: 'symbol',
      width: 130,
    },
    {
      title: '最新价',
      dataIndex: 'lastPrice',
      width: 120,
      render: (_text, record) => formatPrice(record?.lastPrice),
    },
    {
      title: '涨跌幅',
      dataIndex: 'priceChangePct',
      width: 100,
      render: (_text, record) => (
        <span style={{ color: getPnlColor(record?.priceChangePct) }}>
          {record?.priceChangePct}%
        </span>
      ),
      sorter: (a, b) =>
        ((a as TickerData)?.priceChangePct || 0) - ((b as TickerData)?.priceChangePct || 0),
    },
    {
      title: '24h成交额',
      dataIndex: 'quoteVolume24h',
      width: 120,
      render: (_text, record) => formatNumber(record?.quoteVolume24h, 0),
      sorter: (a, b) =>
        ((a as TickerData)?.quoteVolume24h || 0) - ((b as TickerData)?.quoteVolume24h || 0),
    },
  ]

  const rowSelection = {
    selectedRowKeys,
    onChange: (keys?: (string | number)[]) => {
      setSelectedRowKeys(keys || [])
    },
  }

  const handleSubmit = async () => {
    if (selectedRowKeys.length === 0) {
      Toast.warning({ content: '请至少选择一个交易对' })
      return
    }
    if (amountUSDT <= 0) {
      Toast.warning({ content: '金额必须大于0' })
      return
    }

    setSubmitting(true)

    try {
      if (!selectedExchange?.id) {
        Toast.error({ content: '请先选择交易所' })
        setSubmitting(false)
        return
      }

      const exchangeId = parseInt(selectedExchange.id)
      const symbols = selectedRowKeys.map(String)

      const duplicateResult = await batchOrderApi.checkDuplicates({
        exchangeId,
        tradeType: strategyTradeType,
      })

      const openSymbols = new Set(
        (duplicateResult.openOrders || []).map((o) => o.symbol)
      )
      const duplicateSymbols = symbols.filter((s) => openSymbols.has(s))

      const placeOrders = async () => {
        const result = await batchOrderApi.placeBatchStrategy({
          exchangeId,
          tradeType: strategyTradeType,
          symbols,
          direction,
          amountUSDT,
          priceOffsetPercent,
          stopLossPercent,
          takeProfitPercent,
          ...(marketTradeType === 'futures' ? { leverage } : {}),
        })

        Modal.info({
          title: '批量下单结果',
          content: `成功: ${result.success_count}, 失败: ${result.failed_count}`,
          afterClose: () => {
            if (result.success_count > 0) {
              navigate('/orders')
            }
          },
        })
      }

      if (duplicateSymbols.length > 0) {
        Modal.confirm({
          title: '重复订单提醒',
          content: `以下交易对已有策略委托: ${duplicateSymbols.join(', ')}，是否继续下单？`,
          onOk: async () => {
            await placeOrders()
          },
        })
      } else {
        await placeOrders()
      }
    } catch (err: any) {
      // Toast.error({ content: err.message || '下单失败' })
    } finally {
      setSubmitting(false)
    }
  }

  const labelStyle: React.CSSProperties = {
    fontSize: 13,
    color: 'var(--semi-color-text-2)',
    marginBottom: 4,
  }

  const fieldStyle: React.CSSProperties = {
    marginBottom: 16,
  }

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{ marginBottom: 12 }}>
        <Typography.Title heading={4} style={{ margin: 0 }}>批量交易</Typography.Title>
      </div>

      <div
        style={{
          flex: 1,
          display: 'flex',
          gap: 16,
          minHeight: 0,
        }}
        className="batch-trading-layout"
      > 
       <style>{`
        @media (max-width: 768px) {
          .batch-trading-layout {
            flex-direction: column !important;
          }
          .batch-trading-right {
            width: 100% !important;
          }
        }
      `}</style>
        {/* Left: Ticker selection */}
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
          <Card
            style={{ flex: 1, display: 'flex', flexDirection: 'column' }}
            bodyStyle={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
          >
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center', marginBottom: 12 }}>
              <Tag size="large" color="blue">{exchange.toUpperCase()}</Tag>
              <Tag size="large" color="cyan">USDM-ALGO</Tag>
              <RadioGroup
                value={filterMode}
                onChange={(e) => {
                  setFilterMode(e.target.value)
                  setSelectedRowKeys([])
                }}
                type="button"
              >
                <Radio value="gainers">涨幅前</Radio>
                <Radio value="losers">跌幅前</Radio>
              </RadioGroup>
              <InputNumber
                value={topN}
                onChange={(v) => setTopN(v as number)}
                min={1}
                max={200}
                style={{ width: 70 }}
                size="small"
              />
              <Typography.Text type="tertiary" size="small">
                已选 {selectedRowKeys.length} 个
              </Typography.Text>
            </div>
            <div style={{ flex: 1, overflow: 'auto' }}>
              <Table
                columns={columns}
                dataSource={filteredTickers}
                rowKey="symbol"
                rowSelection={rowSelection}
                pagination={false}
                loading={isLoading}
                size="small"
                empty={<Empty description="暂无数据" />}
              />
            </div>
          </Card>
        </div>

        {/* Right: Order config */}
        <div style={{ width: 320, flexShrink: 0 }} className="batch-trading-right">
          <Card
            title="下单配置"
            headerStyle={{ padding: '12px 16px' }}
            bodyStyle={{ padding: 16 }}
          >
            <div style={fieldStyle}>
              <div style={labelStyle}>方向</div>
              <RadioGroup
                value={direction}
                onChange={(e) => setDirection(e.target.value)}
                type="button"
                style={{ width: '100%' }}
              >
                <Radio value="buy_long" style={{ flex: 1, textAlign: 'center' }}>
                  做多
                </Radio>
                <Radio value="sell_short" style={{ flex: 1, textAlign: 'center' }}>
                  做空
                </Radio>
              </RadioGroup>
            </div>

            {marketTradeType === 'futures' && (
              <div style={fieldStyle}>
                <div style={labelStyle}>杠杆倍数</div>
                <InputNumber
                  value={leverage}
                  onChange={(v) => setLeverage(v as number)}
                  min={1}
                  max={125}
                  step={1}
                  style={{ width: '100%' }}
                  suffix="x"
                />
              </div>
            )}

            <div style={fieldStyle}>
              <div style={labelStyle}>金额 (USDT)</div>
              <InputNumber
                value={amountUSDT}
                onChange={(v) => setAmountUSDT(v as number)}
                min={1}
                style={{ width: '100%' }}
              />
            </div>

            <div style={fieldStyle}>
              <div style={labelStyle}>
                价格偏移 %
                <Typography.Text type="tertiary" size="small" style={{ marginLeft: 4 }}>
                  (入场价 = 现价 x (1+N%))
                </Typography.Text>
              </div>
              <InputNumber
                value={priceOffsetPercent}
                onChange={(v) => setPriceOffsetPercent(v as number)}
                min={-50}
                max={50}
                step={0.1}
                style={{ width: '100%' }}
                suffix="%"
              />
            </div>

            <div style={{ display: 'flex', gap: 12, ...fieldStyle }}>
              <div style={{ flex: 1 }}>
                <div style={labelStyle}>止损 %</div>
                <InputNumber
                  value={stopLossPercent}
                  onChange={(v) => setStopLossPercent(v as number)}
                  min={0.1}
                  max={100}
                  step={0.5}
                  style={{ width: '100%' }}
                  suffix="%"
                />
              </div>
              <div style={{ flex: 1 }}>
                <div style={labelStyle}>止盈 %</div>
                <InputNumber
                  value={takeProfitPercent}
                  onChange={(v) => setTakeProfitPercent(v as number)}
                  min={0.1}
                  max={1000}
                  step={0.5}
                  style={{ width: '100%' }}
                  suffix="%"
                />
              </div>
            </div>

            <Button
              type="primary"
              theme="solid"
              loading={submitting}
              onClick={handleSubmit}
              disabled={selectedRowKeys.length === 0}
              block
              style={{ marginTop: 8 }}
            >
              批量下单 ({selectedRowKeys.length} 个条件单)
            </Button>
          </Card>
        </div>
      </div>


    </div>
  )
}

export default BatchTrading
