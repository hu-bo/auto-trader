import React from 'react'
import { Card, Tag, Button, Empty, Popconfirm, Toast } from '@douyinfe/semi-ui-19'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { positionApi } from '@/api'
import { useAppStore } from '@/stores/appStore'
import { formatPrice, formatQuantity, formatCurrency, getPnlColor } from '@/utils/format'
import type { Position } from '@/types'

interface PositionCardProps {
  symbol?: string
}

export const PositionCard: React.FC<PositionCardProps> = ({ symbol }) => {
  const queryClient = useQueryClient()
  const { selectedExchange } = useAppStore()

  const { data, isLoading } = useQuery({
    queryKey: ['positions', selectedExchange?.id, symbol],
    queryFn: () =>
      selectedExchange
        ? positionApi.list({ exchangeId: selectedExchange.id, symbol })
        : Promise.resolve({ positions: [], total: 0 }),
    enabled: !!selectedExchange,
    refetchInterval: 5000,
  })

  const closeMutation = useMutation({
    mutationFn: ({
      positionId,
      exchangeId,
    }: {
      positionId: string
      exchangeId: string
    }) => positionApi.close(positionId, { exchangeId }),
    onSuccess: () => {
      Toast.success('平仓成功')
      queryClient.invalidateQueries({ queryKey: ['positions'] })
    },
    onError: (error: Error) => {
      Toast.error(error.message || '平仓失败')
    },
  })

  if (!selectedExchange) {
    return <Empty description="请先选择交易所" />
  }

  if (isLoading) {
    return <Card loading />
  }

  const positions = data?.positions || []
  const filteredPositions = symbol
    ? positions.filter((p) => p.symbol === symbol)
    : positions

  if (filteredPositions.length === 0) {
    return <Empty description="暂无持仓" />
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {filteredPositions.map((position: Position) => (
        <Card
          key={position.id}
          bodyStyle={{ padding: 16 }}
          style={{
            background: 'var(--bg-2)',
            border: '1px solid var(--border-color)',
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
            }}
          >
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontWeight: 600 }}>{position.symbol}</span>
                <Tag
                  size="small"
                  color={position.positionSide === 'long' ? 'green' : 'red'}
                >
                  {position.positionSide === 'long' ? '多' : '空'}
                </Tag>
                <Tag size="small">{position.leverage}x</Tag>
              </div>
              <div style={{ marginTop: 12 }}>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(2, 1fr)',
                    gap: '8px 24px',
                    fontSize: 13,
                  }}
                >
                  <div>
                    <span style={{ color: 'var(--text-3)' }}>数量</span>
                    <div style={{ marginTop: 2 }}>{formatQuantity(position.quantity)}</div>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-3)' }}>开仓均价</span>
                    <div style={{ marginTop: 2 }}>{formatPrice(position.entryPrice)}</div>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-3)' }}>标记价格</span>
                    <div style={{ marginTop: 2 }}>{formatPrice(position.markPrice)}</div>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-3)' }}>强平价格</span>
                    <div style={{ marginTop: 2 }}>
                      {position.liquidationPrice
                        ? formatPrice(position.liquidationPrice)
                        : '-'}
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ color: 'var(--text-3)', fontSize: 12 }}>未实现盈亏</div>
              <div
                style={{
                  fontSize: 18,
                  fontWeight: 600,
                  color: getPnlColor(position.unrealizedPnl),
                }}
              >
                {formatCurrency(position.unrealizedPnl)}
              </div>
              <Popconfirm
                position="leftBottom"
                title="确定要平仓吗？"
                onConfirm={() =>
                  closeMutation.mutate({
                    positionId: position.id,
                    exchangeId: position.exchangeId,
                  })
                }
              >
                <Button
                  size="small"
                  type="danger"
                  theme="light"
                  style={{ marginTop: 8 }}
                  loading={closeMutation.isPending}
                >
                  平仓
                </Button>
              </Popconfirm>
            </div>
          </div>
        </Card>
      ))}
    </div>
  )
}
