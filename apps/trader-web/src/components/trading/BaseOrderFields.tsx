import React from 'react'
import { Form, useFormApi } from '@douyinfe/semi-ui-19'
import type { OrderSide, PositionSide, OrderType } from '@/types'

type TradeMode = 'futures' | 'spot'

/** 公共基础值：tradeType / side / positionSide / leverage / orderType */
export interface BaseOrderValues {
  tradeType: TradeMode
  side: OrderSide
  positionSide?: PositionSide
  leverage?: number
  orderType: OrderType
}

/** 批量策略单扩展值 */
export interface StrategyOrderValues extends BaseOrderValues {
  amountUSDT: number
  priceOffsetPercent: number
  stopLossPercent: number
  takeProfitPercent: number
}

export interface BaseOrderFieldsProps {
  values: BaseOrderValues
  onChange: (values: Partial<BaseOrderValues>) => void
  onSubmit?: (values: Record<string, unknown>) => void | Promise<void>
  formId?: string
  onFormApi?: (api: any) => void
  tradeTypeLocked?: boolean
  /** 是否隐藏方向 */
  hideSide?: boolean
  /** 是否隐藏持仓方向（usdm-algo 模式下隐藏） */
  hidePositionSide?: boolean
  /** 是否隐藏杠杆 */
  hideLeverage?: boolean
  /** 是否隐藏订单类型 */
  hideOrderType?: boolean
  children?: React.ReactNode
  submitButton?: React.ReactNode
}

const FormApiBridge: React.FC<{ onReady?: (api: any) => void }> = ({ onReady }) => {
  const formApi = useFormApi()

  React.useEffect(() => {
    onReady?.(formApi)
  }, [formApi, onReady])

  return null
}

export const BaseOrderFields: React.FC<BaseOrderFieldsProps> = ({
  values,
  onChange,
  onSubmit,
  formId,
  onFormApi,
  tradeTypeLocked = false,
  hideSide = false,
  hidePositionSide = false,
  hideLeverage = false,
  hideOrderType = false,
  children,
  submitButton,
}) => {
  const { tradeType, side, positionSide = 'long', leverage = 10, orderType = 'limit' } = values
  const isFutures = tradeType === 'futures'

  return (
    <Form
      id={formId}
      onSubmit={onSubmit}
      // wrapperCol={{ span: 19 }}
      // labelCol={{ span: 5 }}
      labelPosition='top'
      // labelAlign='right'
      initValues={{
        tradeType,
        side,
        positionSide,
        leverage,
        orderType,
      }}
    >
      <FormApiBridge onReady={onFormApi} />

      <Form.RadioGroup
        field="tradeType"
        label="交易类型"
        type="button"
        disabled={tradeTypeLocked}
        style={{ width: '100%' }}
        onChange={(e) => {
          if (!tradeTypeLocked) {
            onChange({ tradeType: e.target.value as TradeMode })
          }
        }}
      >
        <Form.Radio value="spot" style={{ flex: 1, textAlign: 'center' }}>现货</Form.Radio>
        <Form.Radio value="futures" style={{ flex: 1, textAlign: 'center' }}>U本位</Form.Radio>
      </Form.RadioGroup>

      {!hideSide && (
        <Form.RadioGroup
          field="side"
          label="方向"
          type="button"
          style={{ width: '100%' }}
          onChange={(e) => onChange({ side: e.target.value as OrderSide })}
        >
          <Form.Radio value="buy" style={{ flex: 1, textAlign: 'center' }}>买入</Form.Radio>
          <Form.Radio value="sell" style={{ flex: 1, textAlign: 'center' }}>卖出</Form.Radio>
        </Form.RadioGroup>
      )}

      {isFutures && !hidePositionSide && (
        <Form.RadioGroup
          field="positionSide"
          label="持仓方向"
          type="button"
          style={{ width: '100%' }}
          initValue={positionSide}
          onChange={(e) => onChange({ positionSide: e.target.value as PositionSide })}
        >
          <Form.Radio value="long" style={{ flex: 1, textAlign: 'center' }}>多头</Form.Radio>
          <Form.Radio value="short" style={{ flex: 1, textAlign: 'center' }}>空头</Form.Radio>
        </Form.RadioGroup>
      )}

      {!hideOrderType && (
        <Form.RadioGroup
          field="orderType"
          label="订单类型"
          type="button"
          initValue={orderType}
          style={{ width: '100%' }}
          onChange={(e) => onChange({ orderType: e.target.value as OrderType })}
        >
          <Form.Radio value="limit">限价单</Form.Radio>
          <Form.Radio value="market">市价单</Form.Radio>
          <Form.Radio value="algo">条件委托</Form.Radio>
        </Form.RadioGroup>
      )}
      {isFutures && !hideLeverage && (
        <Form.InputNumber
          field="leverage"
          label="杠杆倍数"
          initValue={leverage}
          min={1}
          max={125}
          step={1}
          suffix="x"
          style={{ width: '100%' }}
          onChange={(v) => onChange({ leverage: v as number })}
        />
      )}
      {children}
      {submitButton}
    </Form>
  )
}
