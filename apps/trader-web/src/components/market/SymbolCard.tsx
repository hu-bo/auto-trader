import React from 'react'
import { Typography, Tag } from '@douyinfe/semi-ui-19'
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
}

export const SymbolCard: React.FC<SymbolCardProps> = ({ data, onClick }) => {
  const isUp = Number(data.priceChangePct) >= 0
  const color = isUp ? 'var(--semi-color-success)' : 'var(--semi-color-danger)'
  const bgColor = isUp
    ? 'rgba(var(--semi-green-5), 0.08)'
    : 'rgba(var(--semi-red-5), 0.08)'

  const hasStrategies = (data.runningStrategies ?? 0) > 0
  const hasConditionals = (data.runningConditionals ?? 0) > 0

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

      {/* 价格 */}
      <div style={{ marginBottom: 4 }}>
        <Text style={{ fontSize: 20, fontWeight: 700, color }}>
          {data.lastPrice.toFixed(data.lastPrice >= 1 ? 2 : 6)}
        </Text>
      </div>

      {/* 成交量 */}
      <div>
        <Text type="tertiary" style={{ fontSize: 12 }}>
          Vol {formatVolume(data.volume24h)}
        </Text>
        <Text type="tertiary" style={{ marginRight: 12 }}>
          <span style={{width: '10px'}}></span>
        </Text>
        <Text type="tertiary" style={{ fontSize: 12 }}>
          Vol(USDT) {formatVolume(data.quoteVolume24h)}
        </Text>
      </div>
    </div>
  )
}
