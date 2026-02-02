import React from 'react'
import { Card, Row, Col, Typography, Spin, Descriptions, Empty } from '@douyinfe/semi-ui-19'
import { useQuery } from '@tanstack/react-query'
import { statsApi } from '@/api'
import { PnLChart } from '@/components/charts/PnLChart'
import { formatCurrency, formatPercent, getPnlColor } from '@/utils/format'

const { Title, Text } = Typography

const Overview: React.FC = () => {
  const { data: stats, isLoading } = useQuery({
    queryKey: ['user-stats'],
    queryFn: statsApi.getOverview,
    refetchInterval: 60000,
  })

  if (isLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}>
        <Spin size="large" />
      </div>
    )
  }

  return (
    <div>
      <Title heading={4} style={{ marginBottom: 24 }}>
        收益统计
      </Title>

      {/* 统计卡片 */}
      <Row gutter={[16, 16]}>
        <Col span={6}>
          <Card bodyStyle={{ padding: 20 }}>
            <Text type="tertiary" style={{ fontSize: 13 }}>
              总收益
            </Text>
            <div
              style={{
                fontSize: 28,
                fontWeight: 600,
                marginTop: 8,
                color: getPnlColor(stats?.totalPnl),
              }}
            >
              {formatCurrency(stats?.totalPnl || 0)}
            </div>
          </Card>
        </Col>
        <Col span={6}>
          <Card bodyStyle={{ padding: 20 }}>
            <Text type="tertiary" style={{ fontSize: 13 }}>
              今日收益
            </Text>
            <div
              style={{
                fontSize: 28,
                fontWeight: 600,
                marginTop: 8,
                color: getPnlColor(stats?.todayPnl),
              }}
            >
              {formatCurrency(stats?.todayPnl || 0)}
            </div>
          </Card>
        </Col>
        <Col span={6}>
          <Card bodyStyle={{ padding: 20 }}>
            <Text type="tertiary" style={{ fontSize: 13 }}>
              运行策略
            </Text>
            <div style={{ fontSize: 28, fontWeight: 600, marginTop: 8 }}>
              {stats?.activeStrategies || 0}
            </div>
          </Card>
        </Col>
        <Col span={6}>
          <Card bodyStyle={{ padding: 20 }}>
            <Text type="tertiary" style={{ fontSize: 13 }}>
              总交易次数
            </Text>
            <div style={{ fontSize: 28, fontWeight: 600, marginTop: 8 }}>
              {stats?.totalTrades || 0}
            </div>
          </Card>
        </Col>
      </Row>

      {/* 收益曲线 */}
      <Card title="收益曲线" style={{ marginTop: 16 }}>
        <PnLChart height={350} />
      </Card>

      {/* 详细统计 */}
      <Row gutter={16} style={{ marginTop: 16 }}>
        <Col span={12}>
          <Card title="本周统计">
            {stats ? (
              <Descriptions row>
                <Descriptions.Item itemKey="收益">
                  <span style={{ color: getPnlColor(stats.weekPnl) }}>
                    {formatCurrency(stats.weekPnl)}
                  </span>
                </Descriptions.Item>
                <Descriptions.Item itemKey="胜率">
                  {formatPercent(stats.weekWinRate)}
                </Descriptions.Item>
                <Descriptions.Item itemKey="交易次数">
                  {stats.weekTrades}
                </Descriptions.Item>
              </Descriptions>
            ) : (
              <Empty description="暂无数据" />
            )}
          </Card>
        </Col>
        <Col span={12}>
          <Card title="本月统计">
            {stats ? (
              <Descriptions row>
                <Descriptions.Item itemKey="收益">
                  <span style={{ color: getPnlColor(stats.monthPnl) }}>
                    {formatCurrency(stats.monthPnl)}
                  </span>
                </Descriptions.Item>
                <Descriptions.Item itemKey="胜率">
                  {formatPercent(stats.monthWinRate)}
                </Descriptions.Item>
                <Descriptions.Item itemKey="交易次数">
                  {stats.monthTrades}
                </Descriptions.Item>
              </Descriptions>
            ) : (
              <Empty description="暂无数据" />
            )}
          </Card>
        </Col>
      </Row>

      {/* 风险指标 */}
      <Card title="风险指标" style={{ marginTop: 16 }}>
        <Row gutter={24}>
          <Col span={6}>
            <div style={{ textAlign: 'center', padding: 16 }}>
              <Text type="tertiary">总胜率</Text>
              <div style={{ fontSize: 24, fontWeight: 600, marginTop: 8 }}>
                {formatPercent(stats?.totalWinRate || 0)}
              </div>
            </div>
          </Col>
          <Col span={6}>
            <div style={{ textAlign: 'center', padding: 16 }}>
              <Text type="tertiary">最大回撤</Text>
              <div
                style={{
                  fontSize: 24,
                  fontWeight: 600,
                  marginTop: 8,
                  color: 'var(--semi-color-danger)',
                }}
              >
                {formatPercent(stats?.maxDrawdown || 0)}
              </div>
            </div>
          </Col>
          <Col span={6}>
            <div style={{ textAlign: 'center', padding: 16 }}>
              <Text type="tertiary">本周胜率</Text>
              <div style={{ fontSize: 24, fontWeight: 600, marginTop: 8 }}>
                {formatPercent(stats?.weekWinRate || 0)}
              </div>
            </div>
          </Col>
          <Col span={6}>
            <div style={{ textAlign: 'center', padding: 16 }}>
              <Text type="tertiary">本月胜率</Text>
              <div style={{ fontSize: 24, fontWeight: 600, marginTop: 8 }}>
                {formatPercent(stats?.monthWinRate || 0)}
              </div>
            </div>
          </Col>
        </Row>
      </Card>
    </div>
  )
}

export default Overview
