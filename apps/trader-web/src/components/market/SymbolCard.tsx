import React from 'react'
import { Typography, Tag, Button } from '@douyinfe/semi-ui-19'
import type { TickerData } from '@/api/market'

const { Text } = Typography

const formatVolume = (v: number | string) => {
  const num = typeof v === 'string' ? parseFloat(v) : v
  if (isNaN(num) || num === 0) return '0.00'
  if (num >= 1e9) return `${(num / 1e9).toFixed(2)}B`
  if (num >= 1e6) return `${(num / 1e6).toFixed(2)}M`
  if (num >= 1e3) return `${(num / 1e3).toFixed(2)}K`
  return num.toFixed(2)
}

interface SymbolCardProps {
  data: TickerData
  onClick?: (symbol: string) => void
  onCreateStrategy?: (data: TickerData) => void
  onViewStrategy?: (strategyOrderId: number | string) => void
  syncEnabled?: boolean
}

export const SymbolCard: React.FC<SymbolCardProps> = ({
  data,
  onClick,
  onCreateStrategy,
  onViewStrategy,
  syncEnabled = false,
}) => {
  const isUp = Number(data.priceChangePct) >= 0
  const color = isUp ? 'var(--semi-color-success)' : 'var(--semi-color-danger)'
  const bgColor = isUp
    ? 'rgba(var(--semi-green-5), 0.08)'
    : 'rgba(var(--semi-red-5), 0.08)'

  const hasStrategies = (data.runningStrategies ?? 0) > 0
  const hasConditionals = (data.runningConditionals ?? 0) > 0
  const runningStrategyId = data.runningStrategyId
  const canCreateStrategy = syncEnabled && !runningStrategyId

  return (
    <div
      onClick={() => onClick?.(data.symbol)}
      style={{
        padding: 12,
        borderRadius: 8,
        border: '1px solid var(--semi-color-border)',
        background: 'var(--semi-color-bg-1)',
        cursor: 'pointer',
        transition: 'all 0.2s',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = color
        e.currentTarget.style.transform = 'translateY(-2px)'
        e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = 'var(--semi-color-border)'
        e.currentTarget.style.transform = 'none'
        e.currentTarget.style.boxShadow = 'none'
      }}
    >
      {/* 顶部：symbol + tags */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Text strong style={{ fontSize: 16 }}>{data.symbol}</Text>
          {hasStrategies && (
            <Tag size="small" color="blue" style={{ fontSize: 10 }}>
              策略 {data.runningStrategies}
            </Tag>
          )}
          {hasConditionals && (
            <Tag size="small" color="orange" style={{ fontSize: 10 }}>
              条件 {data.runningConditionals}
            </Tag>
          )}
        </div>
        <div
          style={{
            padding: '2px 8px',
            borderRadius: 4,
            background: bgColor,
            color,
            fontSize: 13,
            fontWeight: 600,
          }}
        >
          {isUp ? '+' : ''}{data.priceChangePct.toFixed(2)}%
        </div>
      </div>

      {/* 价格 + 成交量 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
        <Text style={{ fontSize: 20, fontWeight: 700, color }}>
          {data.lastPrice.toFixed(data.lastPrice >= 1 ? 2 : 6)}
        </Text>
        <Text type="tertiary" style={{ fontSize: 12 }}>
          Vol {formatVolume(data.quoteVolume24h)}
        </Text>
      </div>

      {/*  操作区域 */}
      <div style={{ marginTop: 8, height: 24, display: 'flex', justifyContent: 'flex-end', alignItems: 'center' }}>
        {runningStrategyId ? (
          <Button
            size="small"
            theme="light"
            onClick={(e) => {
              e.stopPropagation()
              onViewStrategy?.(runningStrategyId)
            }}
          >
            策略运行中
          </Button>
        ) : canCreateStrategy ? (
          <Button
            size="small"
            type="primary"
            theme="solid"
            onClick={(e) => {
              e.stopPropagation()
              onCreateStrategy?.(data)
            }}
          >
            创建策略
          </Button>
        ) : null}
      </div>
    </div>
  )
}
