import React, { useState } from 'react'
import {
  Form,
  Button,
  Card,
  Toast,
  TagInput,
} from '@douyinfe/semi-ui-19'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { strategyApi, strategyOrderApi, exchangeApi } from '@/api'
import type { RiskConfig } from '@/types'

interface StrategyOrderFormProps {
  defaultSymbol?: string
  defaultExchange?: string
  onSuccess?: () => void
}

export const StrategyOrderForm: React.FC<StrategyOrderFormProps> = ({ 
  defaultSymbol,
  defaultExchange,
  onSuccess 
}) => {
  const [formApi, setFormApi] = useState<any>(null)
  const [symbols, setSymbols] = useState<string[]>(defaultSymbol ? [defaultSymbol] : [])
  const queryClient = useQueryClient()

  const { data: strategies } = useQuery({
    queryKey: ['available-strategies'],
    queryFn: strategyApi.listAvailable,
  })

  const { data: exchanges } = useQuery({
    queryKey: ['exchanges'],
    queryFn: exchangeApi.list,
  })

  // 根据 defaultExchange 查找对应的 exchangeId
  const defaultExchangeId = React.useMemo(() => {
    if (!defaultExchange || !exchanges) return undefined
    const exchange = exchanges.find(
      (e) => e.exchangeType.toLowerCase() === defaultExchange.toLowerCase()
    )
    return exchange?.id
  }, [defaultExchange, exchanges])

  React.useEffect(() => {
    if (defaultSymbol) {
      setSymbols([defaultSymbol])
      formApi?.setValue('symbols', [defaultSymbol])
    }
  }, [defaultSymbol, formApi])

  React.useEffect(() => {
    if (formApi && defaultExchangeId) {
      formApi.setValue('exchangeId', defaultExchangeId)
    }
  }, [formApi, defaultExchangeId])

  const createMutation = useMutation({
    mutationFn: strategyOrderApi.create,
    onSuccess: () => {
      Toast.success('策略订单创建成功')
      queryClient.invalidateQueries({ queryKey: ['strategy-orders'] })
      formApi?.reset()
      setSymbols([])
      onSuccess?.()
    },
    onError: (error: Error) => {
      Toast.error(error.message || '创建失败')
    },
  })

  const handleSubmit = (values: Record<string, unknown>) => {
    const riskConfig: RiskConfig = {
      maxPositionSize: values['riskConfig.maxPositionSize'] as number,
      maxDailyLoss: values['riskConfig.maxDailyLoss'] as number,
      maxDrawdown: values['riskConfig.maxDrawdown'] as number,
      stopLossPercent: values['riskConfig.stopLossPercent'] as number,
      takeProfitPercent: values['riskConfig.takeProfitPercent'] as number,
    }

    createMutation.mutate({
      strategyId: values.strategyId as string,
      exchangeId: values.exchangeId as string,
      tradeType: (values.tradeType as string) || 'spot',
      symbols: values.symbols as string[],
      riskConfig,
      live: values.live as boolean,
    })
  }

  return (
    <Form
      getFormApi={(api) => setFormApi(api)}
      onSubmit={handleSubmit}
      labelPosition="left"
      labelWidth={120}
    >
      <Form.Select
        field="strategyId"
        label="选择策略"
        rules={[{ required: true, message: '请选择策略' }]}
        optionList={strategies?.map((s) => ({
          value: s.id,
          label: s.name,
        }))}
        style={{ width: '100%' }}
      />

      <Form.Select
        field="exchangeId"
        label="交易所"
        rules={[{ required: true, message: '请选择交易所' }]}
        optionList={exchanges?.map((e) => ({
          value: e.id,
          label: `${e.name} (${e.exchangeType})`,
        }))}
        style={{ width: '100%' }}
      />

      <Form.Select
        field="tradeType"
        label="交易类型"
        initValue="spot"
        rules={[{ required: true, message: '请选择交易类型' }]}
        optionList={[
          { value: 'spot', label: '现货' },
          { value: 'futures', label: '合约' },
          { value: 'swap', label: '永续' },
        ]}
        style={{ width: '100%' }}
      />

      <Form.Slot label="交易对">
        <TagInput
          placeholder="输入交易对后按回车，如 BTC-USDT"
          style={{ width: '100%' }}
          value={symbols}
          onChange={(values) => {
            setSymbols(values)
            formApi?.setValue('symbols', values)
          }}
        />
      </Form.Slot>

      <Card title="风控配置" style={{ marginBottom: 16 }}>
        <Form.InputNumber
          field="riskConfig.maxPositionSize"
          label="最大持仓"
          initValue={10000}
          suffix="USDT"
          style={{ width: '100%' }}
        />
        <Form.InputNumber
          field="riskConfig.maxDailyLoss"
          label="日最大亏损"
          initValue={500}
          suffix="USDT"
          style={{ width: '100%' }}
        />
        <Form.InputNumber
          field="riskConfig.maxDrawdown"
          label="最大回撤"
          initValue={10}
          suffix="%"
          style={{ width: '100%' }}
        />
        <Form.InputNumber
          field="riskConfig.stopLossPercent"
          label="止损"
          initValue={2}
          suffix="%"
          style={{ width: '100%' }}
        />
        <Form.InputNumber
          field="riskConfig.takeProfitPercent"
          label="止盈"
          initValue={5}
          suffix="%"
          style={{ width: '100%' }}
        />
      </Card>

      <Form.Switch
        field="live"
        label="实盘交易"
        initValue={false}
        checkedText="开"
        uncheckedText="关"
      />

      <Button
        type="primary"
        htmlType="submit"
        loading={createMutation.isPending}
        block
        style={{ marginTop: 16 }}
      >
        创建策略订单
      </Button>
    </Form>
  )
}
