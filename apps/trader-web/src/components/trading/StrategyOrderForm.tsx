import React from 'react'
import {
  Form,
  Button,
  Card,
  Toast,
  TagInput,
  Select,
} from '@douyinfe/semi-ui-19'
import { IconLink } from '@douyinfe/semi-icons'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { strategyApi, strategyOrderApi, exchangeApi, riskConfigApi } from '@/api'
import { useNavigateKeepParams, useTradingFormState } from '@/hooks'
import { BaseOrderFields } from './BaseOrderFields'
import type { RiskConfig, RiskConfigPreset, OrderSide, PositionSide, OrderType } from '@/types'

interface StrategyOrderFormJson {
  strategyId?: string
  exchangeId?: number | string
  riskConfigId?: string
  tradeType: 'spot' | 'futures'
  side: OrderSide
  positionSide: PositionSide
  leverage: number
  orderType: OrderType
  symbols: string[]
  quantity: number
  price?: number
  amountUSDT: number
  priceOffsetPercent: number
  stopLossPercent: number
  takeProfitPercent: number
}

interface StrategyOrderFormProps {
  /** exchangeId 由外部传入，作为默认值 */
  exchangeId?: number | string
  tradeType: 'spot' | 'futures'
  onTradeTypeChange?: (tradeType: 'spot' | 'futures') => void
  defaultSymbol?: string | string[]
  defaultExchange?: string
  onSuccess?: () => void
}

export const StrategyOrderForm: React.FC<StrategyOrderFormProps> = ({
  exchangeId: propExchangeId,
  tradeType,
  onTradeTypeChange,
  defaultSymbol,
  defaultExchange,
  onSuccess,
}) => {
  const normalizedDefaultSymbols = React.useMemo(() => {
    if (!defaultSymbol) return []
    return Array.isArray(defaultSymbol) ? defaultSymbol : [defaultSymbol]
  }, [defaultSymbol])

  const {
    values,
    onChange,
    setField,
    reset,
    setFormApi,
  } = useTradingFormState<StrategyOrderFormJson>({
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
    amountUSDT: 100,
    priceOffsetPercent: 1,
    stopLossPercent: 2,
    takeProfitPercent: 5,
  })

  React.useEffect(() => {
    if (values.tradeType !== tradeType) {
      setField('tradeType', tradeType)
    }
  }, [tradeType, values.tradeType, setField])

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

  const resolvedExchangeId = React.useMemo(() => {
    if (propExchangeId) return propExchangeId
    if (!defaultExchange || !exchanges) return undefined
    const ex = exchanges.find((e) => e.exchangeType.toLowerCase() === defaultExchange.toLowerCase())
    return ex?.id
  }, [propExchangeId, defaultExchange, exchanges])

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

  const handleSubmit = (submitValues: Record<string, unknown>) => {
    const selectedRiskConfigId = (submitValues.riskConfigId ?? values.riskConfigId) as string | undefined
    const selectedRiskConfig = riskConfigs.find((c: RiskConfigPreset) => c.id === selectedRiskConfigId)
    if (!selectedRiskConfig) {
      Toast.error('请选择风控配置')
      return
    }
    if (submitValues.orderType === 'algo') {
      Toast.error('订单类型不支持[条件委托]')
      return
    }
    const riskConfig: RiskConfig = {
      maxPositionSize: selectedRiskConfig.riskConfig.maxPositionSize,
      maxDailyLoss: selectedRiskConfig.riskConfig.maxDailyLoss,
      maxDrawdown: selectedRiskConfig.riskConfig.maxDrawdown,
      stopLossPercent: selectedRiskConfig.riskConfig.stopLossPercent,
      takeProfitPercent: selectedRiskConfig.riskConfig.takeProfitPercent,
      maxLeverage: selectedRiskConfig.riskConfig.maxLeverage,
    }

    createMutation.mutate({
      strategyId: submitValues.strategyId as string,
      exchangeId: String(submitValues.exchangeId),
      tradeType: values.tradeType,
      symbols: values.symbols,
      riskConfig,
      live: submitValues.live as boolean,
    })
  }

  const hasExchanges = !!(exchanges && exchanges.length > 0)
  const hasRiskConfigs = riskConfigs.length > 0

  return (
    <BaseOrderFields
      onSubmit={handleSubmit}
      onFormApi={setFormApi}
      values={{
        tradeType: values.tradeType,
        side: values.side,
        positionSide: values.positionSide,
        leverage: values.leverage,
        orderType: values.orderType,
      }}
      onChange={(changed) => {
        onChange(changed)
        if (changed.tradeType) {
          onTradeTypeChange?.(changed.tradeType)
        }
      }}
      hideSide
      hidePositionSide
      submitButton={
        <Button type="primary" htmlType="submit" loading={createMutation.isPending} block style={{ marginTop: 16 }}>
          创建策略订单
        </Button>
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
      />
      <Form.InputNumber
        field="amountUSDT"
        label="金额"
        min={1}
        style={{ width: '100%' }}
        rules={[{ required: true, message: '请输入金额' }]}
        addonAfter="USDT"
      />
      <Form.Slot label="交易对">
        <TagInput
          placeholder="输入交易对后按回车，如 BTC-USDT"
          style={{ width: '100%' }}
          value={values.symbols}
          onChange={(next) => setField('symbols', next)}
        />
      </Form.Slot>

      <Card
        title={
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
            <span>风控配置</span>
            <Button size="small" theme="light" onClick={() => navigate('/risk-config')}>
              {hasRiskConfigs ? '管理' : '创建风控配置'}
            </Button>
          </div>
        }
        style={{ marginBottom: 16 }}
      >
        <Form.Select
          field="riskConfigId"
          label="选择风控配置"
          placeholder={hasRiskConfigs ? '请选择风控配置' : '暂无风控配置，请先创建'}
          rules={[{ required: true, message: '请选择风控配置' }]}
          style={{ width: '100%' }}
          optionList={riskConfigs.map((c: RiskConfigPreset) => ({ value: c.id, label: c.name }))}
          onChange={(v) => setField('riskConfigId', v as string)}
        />
      </Card>

      <Form.Switch field="live" label="实盘交易" initValue={true} checkedText="开" uncheckedText="关" />
    </BaseOrderFields>
  )
}
