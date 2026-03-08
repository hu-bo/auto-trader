import React, { useEffect } from 'react'
import { Card, Row, Col, Typography, Tag, Spin, Empty } from '@douyinfe/semi-ui-19'
import {
  IconArrowUp,
  IconArrowDown,
  IconPulse,
  IconHistogram,
  IconGridStroked,
} from '@douyinfe/semi-icons'
import { useQuery } from '@tanstack/react-query'
import { statsApi, strategyOrderApi, positionApi, exchangeApi } from '@/api'
import { useAppStore } from '@/stores/appStore'
import { useNavigateKeepParams } from '@/hooks'
import { formatCurrency, formatPercent, getPnlColor } from '@/utils/format'
import { PnLChart } from '@/components/charts/PnLChart'

const { Title, Text } = Typography

interface StatCardProps {
  title: string
  value: string | number
  icon: React.ReactNode
  trend?: number
  color?: string
}

const StatCard: React.FC<StatCardProps> = ({ title, value, icon, trend, color }) => (
  <Card
    style={{
      background: 'var(--bg-1)',
      border: '1px solid var(--border-color)',
    }}
    bodyStyle={{ padding: 20 }}
  >
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
      <div>
        <Text type="tertiary" style={{ fontSize: 13 }}>
          {title}
        </Text>
        <div
          style={{
            fontSize: 28,
            fontWeight: 600,
            marginTop: 8,
            color: color || 'var(--text-0)',
            fontFamily: 'var(--font-family-mono)',
          }}
        >
          {value}
        </div>
        {trend !== undefined && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              marginTop: 8,
              color: getPnlColor(trend),
            }}
          >
            {trend >= 0 ? <IconArrowUp size="small" /> : <IconArrowDown size="small" />}
            <span style={{ fontSize: 13 }}>{formatPercent(Math.abs(trend))}</span>
            <Text type="quaternary" style={{ fontSize: 12 }}>
              较昨日
            </Text>
          </div>
        )}
      </div>
      <div
        style={{
          width: 48,
          height: 48,
          borderRadius: 12,
          background: 'var(--bg-2)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {icon}
      </div>
    </div>
  </Card>
)

const Dashboard: React.FC = () => {
  const { selectedExchange } = useAppStore()
  const navigate = useNavigateKeepParams()

  // Check if user has exchanges, redirect to onboarding if empty
  const { data: exchanges, isLoading: loadingExchanges } = useQuery({
    queryKey: ['exchanges'],
    queryFn: exchangeApi.list,
  })

  useEffect(() => {
    if (!loadingExchanges && exchanges && exchanges.length === 0) {
      navigate('/onboarding')
    }
  }, [loadingExchanges, exchanges, navigate])

  const { data: stats, isLoading: loadingStats } = useQuery({
    queryKey: ['stats'],
    queryFn: statsApi.getOverview,
  })

  const { data: strategyOrders } = useQuery({
    queryKey: ['strategy-orders', 1, 50],
    queryFn: () => strategyOrderApi.list({ page: 1, pageSize: 50 }),
    refetchInterval: 5000,
  })

  const { data: positions } = useQuery({
    queryKey: ['positions', selectedExchange?.id],
    queryFn: () =>
      selectedExchange
        ? positionApi.list({ exchangeId: selectedExchange.id })
        : Promise.resolve({ positions: [], total: 0 }),
    enabled: !!selectedExchange,
    refetchInterval: 10000,
  })

  const runningStrategies = strategyOrders?.data?.filter((s) => s.isRunning) || []
  const totalPositions = positions?.positions?.length || 0

  if (loadingStats) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}>
        <Spin size="large" />
      </div>
    )
  }

  return (
    <div>
      <Title heading={4} style={{ marginBottom: 24 }}>
        仪表盘
      </Title>

      {/* 统计卡片 */}
      <Row gutter={[16, 16]}>
        <Col span={6}>
          <StatCard
            title="总收益"
            value={formatCurrency(stats?.totalPnl || 0)}
            icon={<IconHistogram size="large" style={{ color: 'var(--semi-color-primary)' }} />}
            color={getPnlColor(stats?.totalPnl)}
          />
        </Col>
        <Col span={6}>
          <StatCard
            title="今日收益"
            value={formatCurrency(stats?.todayPnl || 0)}
            icon={<IconArrowUp size="large" style={{ color: 'var(--semi-color-success)' }} />}
            color={getPnlColor(stats?.todayPnl)}
            trend={stats?.todayPnl ? stats.todayPnl / 100 : undefined}
          />
        </Col>
        <Col span={6}>
          <StatCard
            title="运行策略"
            value={runningStrategies.length}
            icon={<IconGridStroked size="large" style={{ color: 'var(--semi-color-warning)' }} />}
          />
        </Col>
        <Col span={6}>
          <StatCard
            title="当前持仓"
            value={totalPositions}
            icon={<IconPulse size="large" style={{ color: 'var(--semi-color-tertiary)' }} />}
          />
        </Col>
      </Row>

      {/* 收益曲线 */}
      <Card
        title="收益曲线"
        style={{ marginTop: 16 }}
        bodyStyle={{ padding: 0 }}
      >
        <div style={{ height: 300, padding: 16 }}>
          <PnLChart />
        </div>
      </Card>

      {/* 运行中的策略 */}
      <Row gutter={16} style={{ marginTop: 16 }}>
        <Col span={12}>
          <Card title="运行中的策略">
            {runningStrategies.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {runningStrategies.map((order) => (
                  <div
                    key={order.id}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: 12,
                      background: 'var(--bg-2)',
                      borderRadius: 8,
                    }}
                  >
                    <div>
                      <Text strong>{order.strategyName || order.strategyId}</Text>
                      <div style={{ marginTop: 4 }}>
                        {order.symbols?.map((symbol) => (
                          <Tag key={symbol} size="small" style={{ marginRight: 4 }}>
                            {symbol}
                          </Tag>
                        ))}
                      </div>
                    </div>
                    <Tag color="green">运行中</Tag>
                  </div>
                ))}
              </div>
            ) : (
              <Empty description="暂无运行中的策略" />
            )}
          </Card>
        </Col>
        <Col span={12}>
          <Card title="当前持仓">
            {positions?.positions && positions.positions.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {positions.positions.slice(0, 5).map((position) => (
                  <div
                    key={position.id}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: 12,
                      background: 'var(--bg-2)',
                      borderRadius: 8,
                    }}
                  >
                    <div>
                      <Text strong>{position.symbol}</Text>
                      <div style={{ marginTop: 4 }}>
                        <Tag
                          size="small"
                          color={position.positionSide === 'long' ? 'green' : 'red'}
                        >
                          {position.positionSide === 'long' ? '多' : '空'}
                        </Tag>
                        <Text type="tertiary" style={{ marginLeft: 8 }}>
                          {position.quantity}
                        </Text>
                      </div>
                    </div>
                    <Text style={{ color: getPnlColor(position.unrealizedPnl) }}>
                      {formatCurrency(position.unrealizedPnl)}
                    </Text>
                  </div>
                ))}
              </div>
            ) : (
              <Empty description="暂无持仓" />
            )}
          </Card>
        </Col>
      </Row>
    </div>
  )
}

export default Dashboard
