import React, { useState, useMemo } from 'react'
import {
  RadioGroup,
  Radio,
  InputNumber,
  Button,
  Card,
  Typography,
} from '@douyinfe/semi-ui-19'
import type { PlaceBatchStrategyParams } from '@/api/batch-order'

type TradeMode = 'futures' | 'spot'
type OrderSide = 'buy' | 'sell'
type PositionSideType = 'long' | 'short'

export interface BatchStrategyOrderFormProps {
  /** 初始交易类型 */
  initialTradeMode?: TradeMode
  /** 是否在紧凑模式下 */
  compact?: boolean
  /** 提交时的回调，需传入 exchangeId 和 symbols */
  onSubmit?: (params: PlaceBatchStrategyParams) => Promise<void>
  /** 是否处于提交状态 */
  loading?: boolean
}

export const BatchStrategyOrderForm: React.FC<BatchStrategyOrderFormProps> = ({
  initialTradeMode = 'futures',
  compact = false,
  onSubmit,
  loading = false,
}) => {
  // Trade mode selection (futures / spot)
  const [tradeMode, setTradeMode] = useState<TradeMode>(initialTradeMode)

  // Derive strategy trade type from trade mode
  const strategyTradeType = useMemo(() => {
    if (tradeMode === 'futures') return 'usdm-algo'
    return 'spot'
  }, [tradeMode])

  // Direction selection
  const [side, setSide] = useState<OrderSide>('buy')
  const [positionSide, setPositionSide] = useState<PositionSideType>('long')

  // Amount and parameters
  const [amountUSDT, setAmountUSDT] = useState<number>(100)
  const [priceOffsetPercent, setPriceOffsetPercent] = useState<number>(1)
  const [stopLossPercent, setStopLossPercent] = useState<number>(5)
  const [takeProfitPercent, setTakeProfitPercent] = useState<number>(10)
  const [leverage, setLeverage] = useState<number>(10)

  const handleTradeModeChange = (mode: TradeMode) => {
    setTradeMode(mode)
    setPositionSide('long')
  }

  const handleSubmit = async () => {
    if (!onSubmit) {
      return
    }

    if (amountUSDT <= 0) {
      return
    }

    const payload: any = {
      side,
      amountUSDT,
      priceOffsetPercent,
      stopLossPercent,
      takeProfitPercent,
    }

    if (tradeMode === 'futures') {
      payload.leverage = leverage
      if (strategyTradeType !== 'usdm-algo') {
        payload.positionSide = positionSide
      }
    }

    await onSubmit({
      exchangeId: 0, // will be set by caller
      tradeType: strategyTradeType,
      symbols: [], // will be set by caller
      ...payload,
    })
  }

  const labelStyle: React.CSSProperties = {
    fontSize: 13,
    color: 'var(--semi-color-text-2)',
    marginBottom: 4,
    fontWeight: 500,
  }

  const fieldStyle: React.CSSProperties = {
    marginBottom: 16,
  }

  const isBuy = side === 'buy'

  return (
    <Card
      title="下单配置"
      headerStyle={{ padding: '12px 16px' }}
      bodyStyle={{ padding: 16 }}
      className="batch-strategy-order-form"
    >
      {/* 交易类型选择 */}
      <div style={fieldStyle}>
        <div style={labelStyle}>交易类型</div>
        <RadioGroup
          value={tradeMode}
          onChange={(e) => handleTradeModeChange(e.target.value as TradeMode)}
          type="button"
          style={{ width: '100%' }}
        >
          <Radio value="spot" style={{ flex: 1, textAlign: 'center' }}>
            现货
          </Radio>
          <Radio value="futures" style={{ flex: 1, textAlign: 'center' }}>
            期货
          </Radio>
        </RadioGroup>
      </div>

      {/* 方向选择 */}
      <div style={fieldStyle}>
        <div style={labelStyle}>方向</div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Button
            block
            theme="light"
            onClick={() => setSide('buy')}
            style={{
              background: isBuy ? 'rgba(16, 185, 129, 0.1)' : undefined,
              borderColor: isBuy ? '#10b981' : undefined,
              color: isBuy ? '#10b981' : undefined,
              fontWeight: 500,
            }}
          >
            买入
          </Button>
          <Button
            block
            theme="light"
            onClick={() => setSide('sell')}
            style={{
              background: !isBuy ? 'rgba(239, 68, 68, 0.1)' : undefined,
              borderColor: !isBuy ? '#ef4444' : undefined,
              color: !isBuy ? '#ef4444' : undefined,
              fontWeight: 500,
            }}
          >
            卖出
          </Button>
        </div>
      </div>

      {/* 持仓方向（仅期货） */}
      {tradeMode === 'futures' && strategyTradeType !== 'usdm-algo' && (
        <div style={fieldStyle}>
          <div style={labelStyle}>持仓方向</div>
          <RadioGroup
            value={positionSide}
            onChange={(e) => setPositionSide(e.target.value as PositionSideType)}
            type="button"
            style={{ width: '100%' }}
          >
            <Radio value="long" style={{ flex: 1, textAlign: 'center' }}>
              多头
            </Radio>
            <Radio value="short" style={{ flex: 1, textAlign: 'center' }}>
              空头
            </Radio>
          </RadioGroup>
        </div>
      )}

      {/* 杠杆（仅期货） */}
      {tradeMode === 'futures' && (
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

      {/* 金额 */}
      <div style={fieldStyle}>
        <div style={labelStyle}>金额 (USDT)</div>
        <InputNumber
          value={amountUSDT}
          onChange={(v) => setAmountUSDT(v as number)}
          min={1}
          style={{ width: '100%' }}
        />
      </div>

      {/* 价格偏移 */}
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

      {/* 止损、止盈 */}
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

      {/* 提交按钮 */}
      <Button
        theme="solid"
        type={isBuy ? 'primary' : 'danger'}
        loading={loading}
        onClick={handleSubmit}
        block
        style={{
          marginTop: 8,
          height: 44,
          background: isBuy ? '#10b981' : '#ef4444',
          borderColor: isBuy ? '#10b981' : '#ef4444',
        }}
      >
        确认下单
      </Button>
    </Card>
  )
}
