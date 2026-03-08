import React from 'react'
import {
  Form,
  Button,
  Toast,
  Row,
  Col,
  RadioGroup,
  Radio,
} from '@douyinfe/semi-ui-19'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { orderApi } from '@/api'
import { useAppStore } from '@/stores/appStore'
import { useTradingFormState } from '@/hooks'
import { BaseOrderFields, BaseOrderValues } from './BaseOrderFields'
import type { TradeType, OrderSide, OrderType, PositionSide } from '@/types'
import { getTradeActionPair, type FuturesActionMode, type FuturesPositionSide } from './tradeAction'

type OrderFormJson = BaseOrderValues & {
  quantity: number
  price?: number
}

interface OrderFormProps {
  symbol: string
  tradeType: 'spot' | 'futures'
  onTradeTypeChange?: (tradeType: 'spot' | 'futures') => void
}

export const OrderForm: React.FC<OrderFormProps> = ({ symbol, tradeType, onTradeTypeChange }) => {
  const [futuresActionMode, setFuturesActionMode] = React.useState<FuturesActionMode>('open')
  const [submittingAction, setSubmittingAction] = React.useState<string | null>(null)

  const {
    values,
    onChange,
    setField,
    reset,
    setFormApi,
    formApiRef,
  } = useTradingFormState<OrderFormJson>({
    tradeType,
    side: 'buy',
    positionSide: 'long',
    leverage: 10,
    orderType: 'limit',
    quantity: 0,
    price: undefined,
  })
  const queryClient = useQueryClient()
  const { selectedExchange } = useAppStore()

  React.useEffect(() => {
    if (values.tradeType !== tradeType) {
      onChange({ tradeType })
    }
  }, [tradeType, values.tradeType, onChange])

  const placeMutation = useMutation({
    mutationFn: orderApi.place,
    onSuccess: () => {
      Toast.success('下单成功')
      queryClient.invalidateQueries({ queryKey: ['orders'] })
      queryClient.invalidateQueries({ queryKey: ['positions'] })
      reset()
    },
    onError: (error: Error) => {
      Toast.error(error.message || '下单失败')
    },
  })

  const submitByAction = async (actionKey: string, side: OrderSide, positionSide?: FuturesPositionSide) => {
    const { tradeType, orderType, leverage } = values

    if (!selectedExchange) {
      Toast.error('请先选择交易所')
      return
    }

    const formApi = formApiRef.current
    let submitValues: Record<string, unknown> = {}

    try {
      if (formApi?.validate) {
        submitValues = (await formApi.validate()) as Record<string, unknown>
      }
    } catch {
      return
    }

    setField('side', side)
    if (positionSide) setField('positionSide', positionSide as PositionSide)

    setSubmittingAction(actionKey)
    placeMutation.mutate(
      {
        exchangeId: String(selectedExchange.id),
        symbol,
        tradeType: tradeType as TradeType,
        side,
        orderType: orderType as OrderType,
        quantity: submitValues.quantity as number,
        price: orderType === 'limit' ? (submitValues.price as number) : undefined,
        positionSide: tradeType === 'futures' ? (positionSide as PositionSide | undefined) : undefined,
        leverage: tradeType === 'futures' ? (leverage as number | undefined) : undefined,
      },
      {
        onSettled: () => setSubmittingAction(null),
      },
    )
  }

  const isSubmitting = placeMutation.isPending || !!submittingAction
  const { left: leftAction, right: rightAction } = getTradeActionPair(values.tradeType as TradeType, futuresActionMode)

  return (
    <BaseOrderFields
      formId="order-form"
      onFormApi={setFormApi}
      values={values}
      onChange={(changed) => {
        onChange(changed)
        if (changed.tradeType) {
          onTradeTypeChange?.(changed.tradeType)
        }
      }}
      hideSide
      hidePositionSide={values.tradeType === 'futures'}
      submitButton={
        <Row gutter={8} style={{ marginTop: 16 }}>
          <Col span={12}>
            <Button
              theme="solid"
              type="primary"
              block
              loading={placeMutation.isPending && submittingAction === leftAction.key}
              disabled={isSubmitting && submittingAction !== leftAction.key}
              style={{  background: '#10b981', borderColor: '#10b981' }}
              onClick={() => submitByAction(leftAction.key, leftAction.side, leftAction.positionSide)}
            >
              {leftAction.label} 
            </Button>
          </Col>
          <Col span={12}>
            <Button
              theme="solid"
              type="danger"
              block
              loading={placeMutation.isPending && submittingAction === rightAction.key}
              disabled={isSubmitting && submittingAction !== rightAction.key}
              style={{ background: '#ef4444', borderColor: '#ef4444' }}
              onClick={() => submitByAction(rightAction.key, rightAction.side, rightAction.positionSide)}
            >
              {rightAction.label}
            </Button>
          </Col>
        </Row>
      }
    >
      {values.tradeType === 'futures' && (
        <Form.Slot label="方向">
          <RadioGroup
            value={futuresActionMode}
            type="button"
            style={{ width: '100%' }}
            onChange={(e) => setFuturesActionMode(e.target.value as FuturesActionMode)}
          >
            <Radio value="open" style={{ flex: 1, textAlign: 'center' }}>开仓</Radio>
            <Radio value="close" style={{ flex: 1, textAlign: 'center' }}>平仓</Radio>
          </RadioGroup>
        </Form.Slot>
      )}
      <Form.InputNumber
        field="amountUSDT"
        label="金额"
        min={1}
        style={{ width: '100%' }}
        rules={[{ required: true, message: '请输入金额' }]}
        addonAfter="USDT"
      />
      {/* OrderForm 特有字段：订单类型、价格、数量 */}
      {values.orderType === 'limit' && (
        <Form.InputNumber
          field="price"
          label="价格"
          placeholder="输入价格"
          rules={[{ required: true, message: '请输入价格' }]}
          style={{ width: '100%' }}
        />
      )}
      {
        values.orderType === 'algo' &&
        <Form.InputNumber
          field="priceOffsetPercent"
          label="价格偏移"
          min={-50}
          max={50}
          step={1}
          suffix="%"
          style={{ width: '100%' }}
          rules={[{ required: true, message: '请输入价格偏移' }]}
          helpText="0为实时价格，正数是高于价格，负数是低于价格"
        />

      }
      {
        values.orderType === 'algo' &&
        <Row>
          <Col span={12} offset={0}>
            <Form.InputNumber
              field="takeProfitPercent"
              label="止盈 %"
              min={0.1}
              max={1000}
              step={0.5}
              suffix="%"
              style={{ width: '100%' }}
              rules={[{ required: true, message: '请输入止盈比例' }]}
            />
          </Col>
          <Col span={12} >
            <Form.InputNumber
              field="stopLossPercent"
              label="止损 %"
              min={0.1}
              max={100}
              step={0.5}
              suffix="%"
              style={{ width: '100%' }}
              rules={[{ required: true, message: '请输入止损比例' }]}
            />
          </Col>
        </Row>
      }

      {/* 快捷比例按钮 */}
      {/* <Form.Slot label="快捷比例">
        <div style={{ display: 'flex', gap: 8 }}>
          {[25, 50, 75, 100].map((percent) => (
            <Button key={percent} size="small" theme="light">
              {percent}%
            </Button>
          ))}
        </div>
      </Form.Slot> */}
    </BaseOrderFields>
  )
}
