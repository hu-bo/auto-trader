import React, { useState } from 'react'
import {
  Form,
  Button,
  RadioGroup,
  Radio,
  InputNumber,
  Select,
  Toast,
  Slider,
} from '@douyinfe/semi-ui-19'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { orderApi } from '@/api'
import { useAppStore } from '@/stores/appStore'
import type { OrderSide, OrderType, TradeType, PositionSide } from '@/types'

interface OrderFormProps {
  symbol: string
}

export const OrderForm: React.FC<OrderFormProps> = ({ symbol }) => {
  const [side, setSide] = useState<OrderSide>('buy')
  const [orderType, setOrderType] = useState<OrderType>('limit')
  const [tradeType, setTradeType] = useState<TradeType>('spot')
  const [positionSide, setPositionSide] = useState<PositionSide>('long')
  const queryClient = useQueryClient()
  const { selectedExchange } = useAppStore()

  const placeMutation = useMutation({
    mutationFn: orderApi.place,
    onSuccess: () => {
      Toast.success('下单成功')
      queryClient.invalidateQueries({ queryKey: ['orders'] })
      queryClient.invalidateQueries({ queryKey: ['positions'] })
    },
    onError: (error: Error) => {
      Toast.error(error.message || '下单失败')
    },
  })

  const handleSubmit = (values: Record<string, unknown>) => {
    if (!selectedExchange) {
      Toast.error('请先选择交易所')
      return
    }

    placeMutation.mutate({
      exchangeId: selectedExchange.id,
      symbol,
      tradeType,
      side,
      orderType,
      quantity: values.quantity as number,
      price: orderType === 'limit' ? (values.price as number) : undefined,
      positionSide: tradeType === 'futures' ? positionSide : undefined,
      leverage: tradeType === 'futures' ? (values.leverage as number) : undefined,
    })
  }

  return (
    <div>
      {/* 交易类型选择 */}
      <RadioGroup
        type="button"
        value={tradeType}
        onChange={(e) => setTradeType(e.target.value as TradeType)}
        style={{ marginBottom: 16, width: '100%' }}
      >
        <Radio value="spot" style={{ flex: 1, textAlign: 'center' }}>
          现货
        </Radio>
        <Radio value="futures" style={{ flex: 1, textAlign: 'center' }}>
          合约
        </Radio>
      </RadioGroup>

      {/* 买卖方向 */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <Button
          block
          theme={side === 'buy' ? 'solid' : 'light'}
          type={side === 'buy' ? 'primary' : 'tertiary'}
          onClick={() => setSide('buy')}
          style={{
            background: side === 'buy' ? '#10b981' : undefined,
            borderColor: side === 'buy' ? '#10b981' : undefined,
          }}
        >
          买入
        </Button>
        <Button
          block
          theme={side === 'sell' ? 'solid' : 'light'}
          type={side === 'sell' ? 'danger' : 'tertiary'}
          onClick={() => setSide('sell')}
        >
          卖出
        </Button>
      </div>

      {/* 合约持仓方向 */}
      {tradeType === 'futures' && (
        <RadioGroup
          type="button"
          value={positionSide}
          onChange={(e) => setPositionSide(e.target.value as PositionSide)}
          style={{ marginBottom: 16, width: '100%' }}
        >
          <Radio value="long" style={{ flex: 1, textAlign: 'center' }}>
            开多
          </Radio>
          <Radio value="short" style={{ flex: 1, textAlign: 'center' }}>
            开空
          </Radio>
        </RadioGroup>
      )}

      <Form onSubmit={handleSubmit} labelPosition="top">
        {/* 订单类型 */}
        <Form.Select
          field="orderType"
          label="订单类型"
          initValue={orderType}
          onChange={(value) => setOrderType(value as OrderType)}
          style={{ width: '100%' }}
        >
          <Select.Option value="limit">限价单</Select.Option>
          <Select.Option value="market">市价单</Select.Option>
        </Form.Select>

        {/* 价格 */}
        {orderType === 'limit' && (
          <Form.InputNumber
            field="price"
            label="价格"
            placeholder="输入价格"
            rules={[{ required: true, message: '请输入价格' }]}
            style={{ width: '100%' }}
          />
        )}

        {/* 数量 */}
        <Form.InputNumber
          field="quantity"
          label="数量"
          placeholder="输入数量"
          rules={[{ required: true, message: '请输入数量' }]}
          style={{ width: '100%' }}
        />

        {/* 杠杆 */}
        {tradeType === 'futures' && (
          <Form.Slot label="杠杆">
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <Slider
                style={{ flex: 1 }}
                min={1}
                max={125}
                defaultValue={10}
                marks={{ 1: '1x', 25: '25x', 50: '50x', 75: '75x', 100: '100x', 125: '125x' }}
              />
              <InputNumber
                style={{ width: 80 }}
                min={1}
                max={125}
                defaultValue={10}
                suffix="x"
              />
            </div>
          </Form.Slot>
        )}

        {/* 快捷比例按钮 */}
        <Form.Slot label="快捷比例">
          <div style={{ display: 'flex', gap: 8 }}>
            {[25, 50, 75, 100].map((percent) => (
              <Button key={percent} size="small" theme="light">
                {percent}%
              </Button>
            ))}
          </div>
        </Form.Slot>

        {/* 提交按钮 */}
        <Button
          htmlType="submit"
          theme="solid"
          block
          loading={placeMutation.isPending}
          style={{
            marginTop: 16,
            height: 44,
            background: side === 'buy' ? '#10b981' : '#ef4444',
            borderColor: side === 'buy' ? '#10b981' : '#ef4444',
          }}
        >
          {side === 'buy' ? '买入' : '卖出'} {symbol}
        </Button>
      </Form>
    </div>
  )
}
