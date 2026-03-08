import React, { useState, useCallback, useRef, useEffect } from 'react'
import {
  Card,
  Table,
  Button,
  Select,
  InputNumber,
  Tag,
  Typography,
  Toast,
  Descriptions,
  Space,
  ButtonGroup,
} from '@douyinfe/semi-ui-19'
import {
  IconPlay,
  IconChevronLeft,
  IconChevronRight,
  IconStop,
} from '@douyinfe/semi-icons'
import { marketApi, debugApi } from '@/api'
import { useAppStore } from '@/stores/appStore'
import { useMarketStore, getMarketSymbolsKey } from '@/stores/marketStore'
import { StrategyEditor } from '@/components/editor/StrategyEditor'
import { formatDateTime, formatPrice } from '@/utils/format'
import type { DebugStep, DebugResponse, DebugBar } from '@/api/debug'
import type { CandleData } from '@/api/market'

const { Title, Text } = Typography

const PERIODS = [
  { value: '1m', label: '1m' },
  { value: '5m', label: '5m' },
  { value: '15m', label: '15m' },
  { value: '30m', label: '30m' },
  { value: '1h', label: '1h' },
  { value: '4h', label: '4h' },
  { value: '1d', label: '1d' },
]

const DEFAULT_CODE = `LET rsi = RSI(14)
LET ma_fast = EMA(close, 12)
LET ma_slow = SMA(close, 26)
IF rsi < 30 AND ma_fast > ma_slow THEN BUY("oversold reversal")
IF rsi > 70 AND ma_fast < ma_slow THEN SELL("overbought reversal")`

const StrategyDebugger: React.FC = () => {
  const { selectedExchange } = useAppStore()
  const exchange = selectedExchange?.exchangeType?.toLowerCase() || 'binance'

  // Editor state
  const [code, setCode] = useState(DEFAULT_CODE)

  // Data source selector
  const [tradeType] = useState('spot')
  const [symbol, setSymbol] = useState('ETH-USDT')
  const [period, setPeriod] = useState('15m')
  const [limit, setLimit] = useState(200)

  // Debug state
  const [debugResult, setDebugResult] = useState<DebugResponse | null>(null)
  const [currentStep, setCurrentStep] = useState(0)
  const [loading, setLoading] = useState(false)
  const [autoPlaying, setAutoPlaying] = useState(false)
  const autoPlayRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Load symbols (from store)
  const symbolsKey = getMarketSymbolsKey(exchange, tradeType)
  const symbols = useMarketStore((state) => state.symbolsByKey[symbolsKey] || [])
  const fetchSymbols = useMarketStore((state) => state.fetchSymbols)

  useEffect(() => {
    fetchSymbols(exchange, tradeType)
  }, [exchange, tradeType, fetchSymbols])

  const symbolOptions = symbols.map((s: { symbol: string }) => ({
    value: s.symbol,
    label: s.symbol,
  }))

  // Auto-play logic
  useEffect(() => {
    if (autoPlaying && debugResult) {
      autoPlayRef.current = setInterval(() => {
        setCurrentStep((prev) => {
          if (prev >= debugResult.steps.length - 1) {
            setAutoPlaying(false)
            return prev
          }
          return prev + 1
        })
      }, 300)
    }
    return () => {
      if (autoPlayRef.current) {
        clearInterval(autoPlayRef.current)
        autoPlayRef.current = null
      }
    }
  }, [autoPlaying, debugResult])

  // Load data and evaluate
  const handleLoadAndEvaluate = useCallback(async () => {
    if (!code.trim()) {
      Toast.warning('请输入 DSL 策略代码')
      return
    }

    setLoading(true)
    setAutoPlaying(false)
    try {
      // 1. Load candles
      const candles: CandleData[] = await marketApi.getCandles({
        exchange,
        symbol,
        trade_type: tradeType,
        period,
        limit,
      })

      if (!candles || candles.length === 0) {
        Toast.warning('未获取到 K 线数据')
        return
      }

      // 2. Convert to debug bars
      const bars: DebugBar[] = candles.map((c) => ({
        timestamp: c.timestamp,
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
        volume: c.volume,
        buy_volume: c.buy_volume ?? 0,
      }))

      // 3. Call debug evaluate
      const result = await debugApi.evaluate({ code, bars })
      setDebugResult(result)
      setCurrentStep(0)
      Toast.success(`已加载 ${result.steps.length} 根 K 线`)
    } catch (error: any) {
      Toast.error(error.message || '加载失败')
    } finally {
      setLoading(false)
    }
  }, [code, exchange, symbol, tradeType, period, limit])

  const step: DebugStep | null = debugResult?.steps[currentStep] ?? null
  const totalSteps = debugResult?.steps.length ?? 0

  // Variable table columns
  const varColumns = [
    {
      title: '变量名',
      dataIndex: 'name',
      width: 120,
      render: (name: string) => <Text strong code>{name}</Text>,
    },
    {
      title: '值',
      dataIndex: 'value',
      render: (value: number | null) =>
        value === null || value === undefined
          ? <Text type="quaternary">NaN</Text>
          : <Text>{typeof value === 'number' ? value.toFixed(6) : String(value)}</Text>,
    },
  ]

  const varData = step
    ? Object.entries(step.variables).map(([name, value]) => ({
        key: name,
        name,
        value,
      }))
    : []

  return (
    <div style={{ padding: 0 }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 16,
        }}
      >
        <Title heading={4}>策略调试器</Title>
      </div>

      <div style={{ display: 'flex', gap: 16 }}>
        {/* Left Panel: Editor + Controls */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <Card title="DSL 代码" style={{ marginBottom: 16 }}>
            <StrategyEditor
              value={code}
              onChange={setCode}
              height={280}
              showMaximize
            />
          </Card>

          <Card title="数据源" style={{ marginBottom: 16 }} bodyStyle={{ padding: '12px 16px' }}>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
              <Tag size="large" color="blue">{exchange.toUpperCase()}</Tag>
              <Select
                value={symbol}
                onChange={(v) => setSymbol(v as string)}
                optionList={symbolOptions}
                filter
                style={{ width: 180 }}
                prefix="交易对"
              />
              <Select
                value={period}
                onChange={(v) => setPeriod(v as string)}
                optionList={PERIODS}
                style={{ width: 120 }}
                prefix="周期"
              />
              <InputNumber
                value={limit}
                onChange={(v) => setLimit(v as number)}
                min={10}
                max={1000}
                style={{ width: 100 }}
                prefix="数量"
              />
              <Button
                type="primary"
                loading={loading}
                onClick={handleLoadAndEvaluate}
              >
                加载并执行
              </Button>
            </div>
          </Card>

          {/* Step Controls */}
          {debugResult && (
            <Card bodyStyle={{ padding: '8px 16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Space>
                  <ButtonGroup>
                    <Button
                      icon={<IconChevronLeft />}
                      disabled={currentStep <= 0}
                      onClick={() => setCurrentStep(0)}
                      size="small"
                    >
                      |&lt;
                    </Button>
                    <Button
                      icon={<IconChevronLeft />}
                      disabled={currentStep <= 0}
                      onClick={() => setCurrentStep((s) => Math.max(0, s - 1))}
                      size="small"
                    />
                    <Button
                      icon={<IconChevronRight />}
                      disabled={currentStep >= totalSteps - 1}
                      onClick={() => setCurrentStep((s) => Math.min(totalSteps - 1, s + 1))}
                      size="small"
                    />
                    <Button
                      disabled={currentStep >= totalSteps - 1}
                      onClick={() => setCurrentStep(totalSteps - 1)}
                      size="small"
                    >
                      &gt;|
                    </Button>
                  </ButtonGroup>

                  <Button
                    icon={autoPlaying ? <IconStop /> : <IconPlay />}
                    onClick={() => setAutoPlaying(!autoPlaying)}
                    size="small"
                    type={autoPlaying ? 'danger' : 'primary'}
                  >
                    {autoPlaying ? '停止' : '自动播放'}
                  </Button>
                </Space>

                <Text>
                  Step <Text strong>{currentStep + 1}</Text> / {totalSteps}
                </Text>
              </div>
            </Card>
          )}
        </div>

        {/* Right Panel: Variables + Bar Info + Signal */}
        <div style={{ width: 380, flexShrink: 0 }}>
          <Card title="变量监视" style={{ marginBottom: 16 }}>
            {step ? (
              <Table
                columns={varColumns}
                dataSource={varData}
                pagination={false}
                size="small"
                rowKey="key"
              />
            ) : (
              <Text type="quaternary">点击「加载并执行」开始调试</Text>
            )}
          </Card>

          <Card title="当前 K 线" style={{ marginBottom: 16 }}>
            {step ? (
              <Descriptions
                data={[
                  { key: '时间', value: formatDateTime(step.timestamp) },
                  { key: 'Open', value: formatPrice(step.bar.open) },
                  { key: 'High', value: formatPrice(step.bar.high) },
                  { key: 'Low', value: formatPrice(step.bar.low) },
                  { key: 'Close', value: formatPrice(step.bar.close) },
                  { key: 'Volume', value: step.bar.volume.toFixed(2) },
                ]}
                size="small"
              />
            ) : (
              <Text type="quaternary">--</Text>
            )}
          </Card>

          <Card title="信号">
            {step ? (
              step.signal ? (
                <div>
                  <Tag
                    color={step.signal === 'BUY' ? 'green' : step.signal === 'SELL' ? 'red' : 'blue'}
                    size="large"
                    style={{ fontSize: 16, padding: '4px 16px' }}
                  >
                    {step.signal}
                  </Tag>
                  {step.meta && (
                    <Text style={{ marginLeft: 8 }} type="secondary">
                      {step.meta}
                    </Text>
                  )}
                </div>
              ) : (
                <Text type="quaternary">无信号</Text>
              )
            ) : (
              <Text type="quaternary">--</Text>
            )}
          </Card>
        </div>
      </div>
    </div>
  )
}

export default StrategyDebugger
