import React from 'react'
import { Button, Form, Row, Col, RadioGroup, Radio } from '@douyinfe/semi-ui-19'
import { BaseOrderFields } from './BaseOrderFields'
import type { PlaceBatchStrategyParams } from '@/api/batch-order'
import { useTradingFormState } from '@/hooks'
import type { OrderSide, PositionSide, OrderType, TradeType } from '@/types'
import { getTradeActionPair, type FuturesActionMode, type FuturesPositionSide } from './tradeAction'

type TradeMode = 'futures' | 'spot'

interface BatchTradingFormJson {
  tradeType: TradeMode
  side: OrderSide
  orderType: OrderType
  positionSide: PositionSide
  leverage: number
  amountUSDT: number
  priceOffsetPercent: number
  stopLossPercent: number
  takeProfitPercent: number
  quantity: number
  price?: number
  symbols: string[]
}

export interface BatchAlgoOrderFormProps {
  /** 交易类型，由外部传入，不可变 */
  tradeType: TradeMode
  onSubmit?: (params: PlaceBatchStrategyParams) => Promise<void>
  loading?: boolean
}

export const BatchAlgoOrderForm: React.FC<BatchAlgoOrderFormProps> = ({
  tradeType,
  onSubmit,
  loading = false,
}) => {
  const [futuresActionMode, setFuturesActionMode] = React.useState<FuturesActionMode>('open')
  const [submittingAction, setSubmittingAction] = React.useState<string | null>(null)

  const { values, onChange, setField, setFormApi, formApiRef } = useTradingFormState<BatchTradingFormJson>({
    tradeType,
    side: 'buy',
    orderType: 'algo',
    positionSide: 'long',
    leverage: 10,
    amountUSDT: 100,
    priceOffsetPercent: 1,
    stopLossPercent: 5,
    takeProfitPercent: 10,
    quantity: 0,
    price: undefined,
    symbols: [],
  })

  const submitBySide = async (
    actionKey: string,
    side: OrderSide,
    positionSide?: FuturesPositionSide,
  ) => {
    if (!onSubmit) return

    const formApi = formApiRef.current
    let submitValues: Record<string, unknown> = {}

    try {
      if (formApi?.validate) {
        submitValues = (await formApi.validate()) as Record<string, unknown>
      }
    } catch {
      return
    }

    const amountUSDT = Number(submitValues.amountUSDT ?? values.amountUSDT)
    if (!Number.isFinite(amountUSDT) || amountUSDT <= 0) return

    const payload: PlaceBatchStrategyParams = {
      exchangeId: 0,
      tradeType,
      symbols: [],
      side,
      orderType: 'algo',
      amountUSDT,
      priceOffsetPercent: Number(submitValues.priceOffsetPercent ?? values.priceOffsetPercent),
      stopLossPercent: Number(submitValues.stopLossPercent ?? values.stopLossPercent),
      takeProfitPercent: Number(submitValues.takeProfitPercent ?? values.takeProfitPercent),
    }

    if (tradeType === 'futures' && positionSide) {
      payload.positionSide = positionSide
      payload.leverage = Number(values.leverage)
    }

    setField('side', side)
    if (positionSide) setField('positionSide', positionSide)

    setSubmittingAction(actionKey)
    try {
      await onSubmit(payload)
    } finally {
      setSubmittingAction(null)
    }
  }

  const isSubmitting = loading || !!submittingAction

  const renderSubmitButtons = () => {
    const { left: leftAction, right: rightAction } = getTradeActionPair(
      tradeType as TradeType,
      futuresActionMode,
    )

    return (
      <Row gutter={8} style={{ marginTop: 12 }}>
        <Col span={12}>
          <Button
            theme="solid"
            type="primary"
            block
            loading={loading || submittingAction === leftAction.key}
            disabled={isSubmitting && submittingAction !== leftAction.key}
            style={{ background: '#10b981', borderColor: '#10b981' }}
            onClick={() => submitBySide(leftAction.key, leftAction.side, leftAction.positionSide)}
          >
            {leftAction.label}
          </Button>
        </Col>
        <Col span={12}>
          <Button
            theme="solid"
            type="danger"
            block
            loading={loading || submittingAction === rightAction.key}
            disabled={isSubmitting && submittingAction !== rightAction.key}
            style={{ background: '#ef4444', borderColor: '#ef4444' }}
            onClick={() => submitBySide(rightAction.key, rightAction.side, rightAction.positionSide)}
          >
            {rightAction.label}
          </Button>
        </Col>
      </Row>
    )
  }

  return (
    <BaseOrderFields
      onFormApi={setFormApi}
      values={{
        tradeType: values.tradeType,
        side: values.side,
        positionSide: values.positionSide,
        leverage: values.leverage,
        orderType: 'algo',
      }}
      onChange={(changed) => onChange(changed)}
      tradeTypeLocked
      hideSide
      hidePositionSide
      hideOrderType
      submitButton={
        renderSubmitButtons()
      }
    >
      {tradeType === 'futures' && (
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
      {
        (values.orderType === 'algo' || values.orderType === 'limit') &&
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
    </BaseOrderFields>
  )
}
