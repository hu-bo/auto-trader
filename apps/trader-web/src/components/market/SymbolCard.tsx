import React from 'react'
import { Typography } from '@douyinfe/semi-ui-19'
import type { SymbolData } from '@/api/market'

const { Text } = Typography

const formatVolume = (v: number) => {
  if (v >= 1e9) return `${(v / 1e9).toFixed(2)}B`
  if (v >= 1e6) return `${(v / 1e6).toFixed(2)}M`
  if (v >= 1e3) return `${(v / 1e3).toFixed(2)}K`
  return v.toFixed(2)
}

interface SymbolCardProps {
  data: SymbolData
  onClick?: (symbol: string) => void
}

export const SymbolCard: React.FC<SymbolCardProps> = ({ data, onClick }) => {
  const isUp = data.priceChangePct24h >= 0
  const color = isUp ? 'var(--semi-color-success)' : 'var(--semi-color-danger)'
  const bgColor = isUp
    ? 'rgba(var(--semi-green-5), 0.08)'
    : 'rgba(var(--semi-red-5), 0.08)'

  return (
    <div
      onClick={() => onClick?.(data.symbol)}
      style={{
        padding: 16,
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
      {/* 顶部：symbol */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div>
          <Text strong style={{ fontSize: 16 }}>{data.baseCurrency}</Text>
          <Text type="tertiary" style={{ fontSize: 12 }}> / {data.quoteCurrency}</Text>
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
          {isUp ? '+' : ''}{data.priceChangePct24h.toFixed(2)}%
        </div>
      </div>

      {/* 价格 */}
      <div style={{ marginBottom: 8 }}>
        <Text style={{ fontSize: 20, fontWeight: 700, color }}>
          {data.lastPrice.toFixed(data.pricePrecision)}
        </Text>
      </div>

      {/* 成交额 */}
      <div>
        <Text type="tertiary" style={{ fontSize: 12 }}>
          Vol {formatVolume(data.quoteVolume24h)}
        </Text>
      </div>
    </div>
  )
}
