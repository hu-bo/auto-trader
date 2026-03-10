import React from 'react'
import { Card, Table, Tag, Button, Toast, Empty, Popconfirm, Typography } from '@douyinfe/semi-ui-19'
import { IconRefresh } from '@douyinfe/semi-icons'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { positionApi } from '@/api'
import { useAppStore } from '@/stores/appStore'
import { formatPrice, formatQuantity, formatCurrency, getPnlColor } from '@/utils/format'
import type { Position } from '@/types'

const { Title } = Typography

const Positions: React.FC = () => {
  const queryClient = useQueryClient()
  const { selectedExchange } = useAppStore()

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['positions', selectedExchange?.id],
    queryFn: () =>
      selectedExchange
        ? positionApi.list({ exchangeId: selectedExchange.id })
        : Promise.resolve({ positions: [], total: 0 }),
    enabled: !!selectedExchange,
    refetchInterval: 10000,
  })

  const syncMutation = useMutation({
    mutationFn: () => positionApi.sync(selectedExchange!.id),
    onSuccess: () => {
      Toast.success('持仓同步成功')
      queryClient.invalidateQueries({ queryKey: ['positions'] })
    },
    onError: (error: Error) => {
      Toast.error(error.message || '同步失败')
    },
  })

  const closeMutation = useMutation({
    mutationFn: ({ positionId }: { positionId: string }) =>
      positionApi.close(positionId, { exchangeId: selectedExchange!.id }),
    onSuccess: () => {
      Toast.success('平仓成功')
      queryClient.invalidateQueries({ queryKey: ['positions'] })
    },
    onError: (error: Error) => {
      Toast.error(error.message || '平仓失败')
    },
  })

  const columns = [
    {
      title: '交易对',
      dataIndex: 'symbol',
      width: 120,
    },
    {
      title: '类型',
      dataIndex: 'tradeType',
      width: 80,
      render: (type: string) => (
        <Tag size="small" color={type === 'spot' ? 'blue' : 'purple'}>
          {type === 'spot' ? '现货' : '合约'}
        </Tag>
      ),
    },
    {
      title: '方向',
      dataIndex: 'positionSide',
      width: 80,
      render: (side: string) => (
        <Tag size="small" color={side === 'long' ? 'green' : 'red'}>
          {side === 'long' ? '多' : '空'}
        </Tag>
      ),
    },
    {
      title: '杠杆',
      dataIndex: 'leverage',
      width: 80,
      render: (leverage: number) => `${leverage}x`,
    },
    {
      title: '数量',
      dataIndex: 'quantity',
      width: 120,
      render: (qty: number) => formatQuantity(qty),
    },
    {
      title: '开仓均价',
      dataIndex: 'entryPrice',
      width: 120,
      render: (price: number) => formatPrice(price),
    },
    {
      title: '标记价格',
      dataIndex: 'markPrice',
      width: 120,
      render: (price: number) => formatPrice(price),
    },
    {
      title: '强平价格',
      dataIndex: 'liquidationPrice',
      width: 120,
      render: (price: number | null) => (price ? formatPrice(price) : '-'),
    },
    {
      title: '未实现盈亏',
      dataIndex: 'unrealizedPnl',
      width: 140,
      render: (pnl: number) => (
        <span style={{ color: getPnlColor(pnl), fontWeight: 600 }}>
          {formatCurrency(pnl)}
        </span>
      ),
    },
    {
      title: '操作',
      width: 100,
      render: (_: unknown, record: Position) => (
        <Popconfirm
          position="leftBottom"
          title="确定要市价平仓吗？"
          onConfirm={() =>
            closeMutation.mutate({
              positionId: record.id,
            })
          }
        >
          <span>
            <Button size="small" type="danger" theme="light">
            平仓
            </Button>
          </span>
        </Popconfirm>
      ),
    },
  ]

  if (!selectedExchange) {
    return (
      <Card>
        <Empty description="请先在顶部选择交易所" />
      </Card>
    )
  }

  return (
    <div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 24,
        }}
      >
        <Title heading={4}>持仓管理</Title>
        <Button
          icon={<IconRefresh />}
          onClick={() => syncMutation.mutate()}
          loading={syncMutation.isPending}
        >
          同步持仓
        </Button>
      </div>

      <Card>
        <Table
          columns={columns}
          dataSource={data?.positions || []}
          loading={isLoading}
          rowKey="id"
          pagination={false}
          empty={<Empty description="暂无持仓" />}
        />
      </Card>
    </div>
  )
}

export default Positions
