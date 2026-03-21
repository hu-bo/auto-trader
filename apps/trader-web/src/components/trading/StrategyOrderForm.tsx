import React from 'react'
import {
  Form,
  Button,
  Toast,
  Select,
  Descriptions,
} from '@douyinfe/semi-ui-19'
import { IconLink } from '@douyinfe/semi-icons'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { strategyApi, strategyOrderApi, exchangeApi, riskConfigApi } from '@/api'
import { useNavigateKeepParams, useTradingFormState } from '@/hooks'
import { useMarketStore } from '@/stores/marketStore'
import { BaseOrderFields } from './BaseOrderFields'
import type { RiskConfig, RiskConfigPreset, OrderSide, PositionSide, OrderType, StrategyOrder } from '@/types'

interface StrategyOrderFormJson {
  strategyId?: string
  exchangeId?: number | string
  riskConfigId?: string
  riskConfig?: Record<string, any>
  tradeType: 'spot' | 'futures'
  leverage: number
  orderType: OrderType
  symbols: string[]
  price?: number
  amountBuy: number
  amountSell: number
  amountBuyLong: number
  amountSellLong: number
  amountBuyShort: number
  amountSellShort: number
  buyPriceOffsetPercent: number
  sellPriceOffsetPercent: number
  stopLossPercent: number
  takeProfitPercent: number
  live: boolean
}

interface StrategyOrderFormProps {
  /** 编辑模式：传入详情数据 */
  detail?: StrategyOrder
  /** exchangeId 由外部传入，作为默认值 */
  exchangeId?: number | string
  tradeType: 'spot' | 'futures'
  onTradeTypeChange?: (tradeType: 'spot' | 'futures') => void
  defaultSymbol?: string | string[]
  defaultExchange?: string
  onSuccess?: () => void
  onCancel?: () => void
}

export const StrategyOrderForm: React.FC<StrategyOrderFormProps> = ({
  detail,
  exchangeId: propExchangeId,
  tradeType,
  onTradeTypeChange,
  defaultSymbol,
  defaultExchange,
  onSuccess,
  onCancel,
}) => {
  const isEditMode = !!detail

  const normalizedDefaultSymbols = React.useMemo(() => {
    if (detail?.symbols) return detail.symbols
    if (!defaultSymbol) return []
    return Array.isArray(defaultSymbol) ? defaultSymbol : [defaultSymbol]
  }, [defaultSymbol, detail])

  const initialValues = React.useMemo<StrategyOrderFormJson>(() => {
    if (detail) {
      return detail as StrategyOrderFormJson
    }
    return {
      strategyId: undefined,
      exchangeId: propExchangeId,
      riskConfigId: undefined,
      tradeType,
      side: 'buy',
      positionSide: 'long',
      leverage: 10,
      orderType: 'limit',
      symbols: normalizedDefaultSymbols,
      quantity: 0,
      price: undefined,
      amountBuy: 100,
      amountSell: 100,
      amountBuyLong: 100,
      amountSellLong: 100,
      amountBuyShort: 100,
      amountSellShort: 100,
      buyPriceOffsetPercent: -0.5,
      sellPriceOffsetPercent: 0.5,
      stopLossPercent: 2,
      takeProfitPercent: 5,
      live: true,
    }
  }, [detail, propExchangeId, tradeType, normalizedDefaultSymbols])

  const {
    values,
    onChange,
    setField,
    reset,
    setFormApi,
  } = useTradingFormState<StrategyOrderFormJson>(initialValues)

  React.useEffect(() => {
    if (!onTradeTypeChange) return
    if (values.tradeType !== tradeType) {
      setField('tradeType', tradeType)
    }
  }, [tradeType, values.tradeType, setField, onTradeTypeChange])

  const queryClient = useQueryClient()
  const navigate = useNavigateKeepParams()

  const { data: strategies } = useQuery({
    queryKey: ['available-strategies'],
    queryFn: strategyApi.listAvailable,
  })

  const { data: exchanges } = useQuery({
    queryKey: ['exchanges'],
    queryFn: exchangeApi.list,
  })

  const { data: riskConfigs = [] } = useQuery({
    queryKey: ['risk-configs'],
    queryFn: riskConfigApi.list,
  })

  // 选中的风控配置预览
  const selectedRiskConfig = React.useMemo(() => {
    if (!values.riskConfigId) return null
    return riskConfigs.find((c: RiskConfigPreset) => c.id === values.riskConfigId)
  }, [values.riskConfigId, riskConfigs])

  const resolvedExchangeId = React.useMemo(() => {
    if (detail?.exchangeId) return detail.exchangeId
    if (propExchangeId) return propExchangeId
    if (!defaultExchange || !exchanges) return undefined
    const ex = exchanges.find((e) => e.exchangeType.toLowerCase() === defaultExchange.toLowerCase())
    return ex?.id
  }, [detail, propExchangeId, defaultExchange, exchanges])

  const symbolsInitialized = React.useRef(false)
  React.useEffect(() => {
    if (!symbolsInitialized.current && normalizedDefaultSymbols.length > 0) {
      symbolsInitialized.current = true
      setField('symbols', normalizedDefaultSymbols)
    }
  }, [normalizedDefaultSymbols, setField])

  const exchangeInitialized = React.useRef(false)
  React.useEffect(() => {
    if (!exchangeInitialized.current && resolvedExchangeId && !values.exchangeId) {
      exchangeInitialized.current = true
      setField('exchangeId', resolvedExchangeId)
    }
  }, [resolvedExchangeId, values.exchangeId, setField])

  const [allSymbols, setAllSymbols] = React.useState<Array<{
    ticker: string
    name: string
    exchange: string
    market: string
  }>>([])
  const [symbolsLoading, setSymbolsLoading] = React.useState(false)

  const selectedExchangeType = React.useMemo(() => {
    if (!values.exchangeId || !exchanges) return undefined
    const selected = exchanges.find((e) => String(e.id) === String(values.exchangeId))
    return selected?.exchangeType
  }, [values.exchangeId, exchanges])

  React.useEffect(() => {
    let cancelled = false

    const loadSymbols = async () => {
      if (!selectedExchangeType) {
        setAllSymbols([])
        return
      }

      setSymbolsLoading(true)
      setAllSymbols([])
      try {
        const store = useMarketStore.getState()
        await store.fetchSymbols(selectedExchangeType, values.tradeType)
        const syncEnabled = store.getSyncEnabledSymbols(selectedExchangeType, values.tradeType)
        const symbols = syncEnabled.map((s: any) => ({
          ticker: s.symbol,
          name: `${s.baseCurrency}/${s.quoteCurrency}[${selectedExchangeType}][${s.tradeType}]`,
          exchange: s.exchange,
          market: s.tradeType,
        }))
        console.log(symbols)
        if (!cancelled) {
          setAllSymbols(symbols)
        }
      } catch {
        if (!cancelled) {
          setAllSymbols([])
        }
      } finally {
        if (!cancelled) {
          setSymbolsLoading(false)
        }
      }
    }

    loadSymbols()
    return () => {
      cancelled = true
    }
  }, [selectedExchangeType, values.tradeType])
  console.log(allSymbols)
  const symbolOptions = React.useMemo(() => {
    const options = allSymbols.map((s) => ({ value: s.ticker, label: s.name }))
    const optionMap = new Map(options.map((o) => [o.value, o]))
    values.symbols.forEach((symbol) => {
      if (!optionMap.has(symbol)) {
        optionMap.set(symbol, { value: symbol, label: symbol })
      }
    })
    return Array.from(optionMap.values())
  }, [allSymbols, values.symbols])

  const createMutation = useMutation({
    mutationFn: strategyOrderApi.create,
    onSuccess: () => {
      Toast.success('策略订单创建成功')
      queryClient.invalidateQueries({ queryKey: ['strategy-orders'] })
      reset()
      onSuccess?.()
    },
    onError: (error: Error) => Toast.error(error.message || '创建失败'),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => strategyOrderApi.update(id, data),
    onSuccess: () => {
      Toast.success('策略订单更新成功')
      queryClient.invalidateQueries({ queryKey: ['strategy-orders'] })
      queryClient.invalidateQueries({ queryKey: ['strategy-order', detail?.id] })
      onSuccess?.()
    },
    onError: (error: Error) => Toast.error(error.message || '更新失败'),
  })

  const handleSubmit = (submitValues: Record<string, unknown>) => {
    const selectedRiskConfigId = (submitValues.riskConfigId ?? values.riskConfigId) as string | undefined
    const riskConfigPreset = riskConfigs.find((c: RiskConfigPreset) => c.id === selectedRiskConfigId)

    if (!riskConfigPreset) {
      Toast.error('请选择风控配置')
      return
    }
    if (submitValues.orderType === 'algo') {
      Toast.error('订单类型不支持[条件委托]')
      return
    }

    const riskConfig: RiskConfig = riskConfigPreset.riskConfig

    const payload = {
      strategyId: submitValues.strategyId as string,
      exchangeId: String(submitValues.exchangeId),
      tradeType: values.tradeType,
      symbols: values.symbols,
      riskConfig,
      amountBuy: values.amountBuy,
      amountSell: values.amountSell,
      amountBuyLong: values.amountBuyLong,
      amountSellLong: values.amountSellLong,
      amountBuyShort: values.amountBuyShort,
      amountSellShort: values.amountSellShort,
      leverage: Number(submitValues.leverage ?? values.leverage),
      orderType: (submitValues.orderType ?? values.orderType) as OrderType,
      buyPriceOffsetPercent: Number(
        submitValues.buyPriceOffsetPercent ?? values.buyPriceOffsetPercent,
      ),
      sellPriceOffsetPercent: Number(
        submitValues.sellPriceOffsetPercent ?? values.sellPriceOffsetPercent,
      ),
      stopLossPercent: Number(
        submitValues.stopLossPercent ?? riskConfigPreset.riskConfig.stopLossPercent ?? values.stopLossPercent,
      ),
      takeProfitPercent: Number(
        submitValues.takeProfitPercent ?? riskConfigPreset.riskConfig.takeProfitPercent ?? values.takeProfitPercent,
      ),
      live: submitValues.live as boolean,
    }

    if (isEditMode && detail) {
      updateMutation.mutate({ id: detail.id, data: payload })
    } else {
      createMutation.mutate(payload)
    }
  }

  const hasExchanges = !!(exchanges && exchanges.length > 0)
  const hasRiskConfigs = riskConfigs.length > 0
  const isPending = createMutation.isPending || updateMutation.isPending

  return (
    <BaseOrderFields
      onSubmit={handleSubmit}
      onFormApi={setFormApi}
      values={{
        tradeType: values.tradeType,
        leverage: values.leverage,
        orderType: values.orderType,
      }}
      onChange={(changed) => {
        onChange(changed)
        if (changed.tradeType) {
          onTradeTypeChange?.(changed.tradeType)
        }
        console.log(changed)
      }}
      hideSide
      hidePositionSide
      submitButton={
        <div style={{ display: 'flex', gap: 12, marginTop: 16 }}>
          {onCancel && (
            <Button onClick={onCancel} style={{ flex: 1 }}>
              取消
            </Button>
          )}
          <Button type="primary" htmlType="submit" loading={isPending} style={{ flex: 1 }}>
            {isEditMode ? '保存修改' : '创建策略订单'}
          </Button>
        </div>
      }
    >
      <Form.Slot label="交易所">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%' }}>
          <Select
            value={values.exchangeId}
            onChange={(v) => setField('exchangeId', v as number | string)}
            style={{ flex: 1 }}
            optionList={exchanges?.map((e) => ({ value: e.id, label: `${e.name} (${e.exchangeType})` }))}
            placeholder="请选择交易所"
            disabled={isEditMode}
          />
          {!hasExchanges && (
            <Button
              size="small"
              icon={<IconLink />}
              theme="light"
              onClick={() => navigate('/exchanges')}
            >
              添加交易所
            </Button>
          )}
        </div>
        <input type="hidden" />
      </Form.Slot>

      <Form.Select
        field="strategyId"
        label="选择策略"
        rules={[{ required: true, message: '请选择策略' }]}
        optionList={strategies?.map((s) => ({ value: s.id, label: s.name }))}
        style={{ width: '100%' }}
        initValue={detail?.strategyId}
      />

      {/* 金额配置 - spot 2种，futures 4种 */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        {values.tradeType === 'spot' ? (
          <>
            <Form.InputNumber
              field="amountBuy"
              label="买入金额"
              min={0}
              style={{ width: '100%' }}
              suffix="USDT"
            />
            <Form.InputNumber
              field="amountSell"
              label="卖出金额"
              min={0}
              style={{ width: '100%' }}
              suffix="USDT"
            />
          </>
        ) : (
          <>
            <Form.InputNumber
              field="amountBuyLong"
              label="开多金额"
              min={0}
              style={{ width: '100%' }}
              suffix="USDT"
            />
            <Form.InputNumber
              field="amountSellLong"
              label="平多金额"
              min={0}
              style={{ width: '100%' }}
              suffix="USDT"
            />
            <Form.InputNumber
              field="amountBuyShort"
              label="开空金额"
              min={0}
              style={{ width: '100%' }}
              suffix="USDT"
            />
            <Form.InputNumber
              field="amountSellShort"
              label="平空金额"
              min={0}
              style={{ width: '100%' }}
              suffix="USDT"
            />
          </>
        )}
      </div>

      <Form.Select
        field='symbols'
        multiple
        filter
        optionList={symbolOptions}
        label="交易对"
        placeholder={values.exchangeId ? '请选择交易对（可多选）' : '请先选择交易所'}
        rules={[{ required: true, message: '请选择交易对' }]}
        disabled={!values.exchangeId}
        loading={symbolsLoading}
        onChange={(v) => {
          setField('symbols', Array.isArray(v) ? (v as string[]) : [])
        }}
        style={{ width: '100%' }}
      />

      {values.orderType === 'limit' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Form.InputNumber
            field="buyPriceOffsetPercent"
            label="买入价格偏移"
            min={-50}
            max={50}
            step={0.5}
            suffix="%"
            style={{ width: '100%' }}
          />
          <Form.InputNumber
            field="sellPriceOffsetPercent"
            label="卖出价格偏移"
            min={-50}
            max={50}
            step={0.5}
            suffix="%"
            style={{ width: '100%' }}
          />
        </div>
      )}

      <Form.Slot label="" >
        <div style={{float: 'right', position: 'relative', top: 36}}>
           <Button  theme="light" onClick={() => navigate('/risk-config')}>
          {hasRiskConfigs ? '管理' : '创建风控配置'}
        </Button>
        </div>
        <Form.Select
          field="riskConfigId"
          label="风控配置"
          placeholder={hasRiskConfigs ? '请选择风控配置' : '暂无风控配置，请先创建'}
          rules={[{ required: true, message: '请选择风控配置' }]}
          style={{ width: '90%' }}
          onChange={(v) => setField('riskConfigId', v as string)}
          optionList={riskConfigs.map((c: RiskConfigPreset) => ({ value: c.id, label: c.name }))}
        />

        {/* 风控参数预览 */}
        {selectedRiskConfig && (
          <Descriptions
            data={[
              { key: '最大持仓', value: selectedRiskConfig.riskConfig.maxPositionSize ? `${selectedRiskConfig.riskConfig.maxPositionSize} USDT` : '-' },
              { key: '日最大亏损', value: selectedRiskConfig.riskConfig.maxDailyLoss ? `${selectedRiskConfig.riskConfig.maxDailyLoss} USDT` : '-' },
              { key: '最大回撤', value: selectedRiskConfig.riskConfig.maxDrawdown ? `${selectedRiskConfig.riskConfig.maxDrawdown}%` : '-' },
              { key: '止损', value: selectedRiskConfig.riskConfig.stopLossPercent ? `${selectedRiskConfig.riskConfig.stopLossPercent}%` : '-' },
              { key: '止盈', value: selectedRiskConfig.riskConfig.takeProfitPercent ? `${selectedRiskConfig.riskConfig.takeProfitPercent}%` : '-' },
              { key: '最大杠杆', value: selectedRiskConfig.riskConfig.maxLeverage ? `${selectedRiskConfig.riskConfig.maxLeverage}x` : '-' },
            ]}
            row
            size="small"
            style={{ marginTop: 12, background: 'var(--semi-color-fill-0)', padding: 12, borderRadius: 4 }}
          />
        )}
      </Form.Slot>

      <Form.Switch
        field="live"
        label="实盘交易"
        initValue={detail?.live ?? true}
        checkedText="开"
        uncheckedText="关"
      />
    </BaseOrderFields>
  )
}
