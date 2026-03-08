import React, { useState } from 'react'
import { Card, Table, Tag, Button, Select, Toast, Empty, Typography } from '@douyinfe/semi-ui-19'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { orderApi } from '@/api'
import { useAppStore } from '@/stores/appStore'
import {
  formatPrice,
  formatQuantity,
  formatDateTime,
  formatOrderStatus,
  formatOrderSide,
  formatOrderType,
} from '@/utils/format'
import type { Order, OrderStatus } from '@/types'

const { Title } = Typography

const statusOptions = [
  { value: '', label: '全部状态' },
  { value: 'new', label: '待成交' },
  { value: 'partially_filled', label: '部分成交' },
  { value: 'filled', label: '已成交' },
  { value: 'canceled', label: '已取消' },
]

const Orders: React.FC = () => {
  const queryClient = useQueryClient()
  const { selectedExchange } = useAppStore()
  const [status, setStatus] = useState<OrderStatus | ''>('')

  const { data, isLoading } = useQuery({
    queryKey: ['orders', selectedExchange?.id, status],
    queryFn: () =>
      selectedExchange
        ? orderApi.list({
            exchangeId: selectedExchange.id,
            status: status || undefined,
            limit: 100,
          })
        : Promise.resolve({ orders: [], total: 0 }),
    enabled: !!selectedExchange,
    refetchInterval: 10000,
  })

  const cancelMutation = useMutation({
    mutationFn: ({ orderid }: { orderid: string }) =>
      orderApi.cancel(orderid),
    onSuccess: () => {
      Toast.success('订单已取消')
      queryClient.invalidateQueries({ queryKey: ['orders'] })
    },
    onError: (error: Error) => {
      console.error('cancel', error.message)
    },
  })

  const columns = [
    {
      title: '交易对',
      dataIndex: 'symbol',
      width: 150,
      render: (symbol: string, record: Order) => (
        <span>
          {symbol}
          <Tag size="small" color={record.tradeType === 'spot' ? 'blue' : 'purple'} style={{ marginLeft: 4 }}>
            {record.tradeType === 'spot' ? '现货' : '合约'}
          </Tag>
        </span>
      ),
    },
    {
      title: '方向',
      dataIndex: 'side',
      width: 80,
      render: (side: string, record: Order) => (
        <Tag size="small" color={side === 'buy' ? 'green' : 'red'}>
          {formatOrderSide(side, record.positionSide)}
        </Tag>
      ),
    },
    {
      title: '订单类型',
      dataIndex: 'orderType',
      width: 100,
      render: (type: string) => formatOrderType(type),
    },
    {
      title: '价格',
      dataIndex: 'price',
      width: 120,
      render: (price: number | null) => (price ? formatPrice(price) : '市价'),
    },
    {
      title: '成交均价',
      dataIndex: 'avgPrice',
      width: 120,
      render: (price: number | null) => (price ? formatPrice(price) : '-'),
    },
    {
      title: '成交/数量',
      dataIndex: 'quantity',
      width: 140,
      render: (qty: number, record: Order) =>
        `${formatQuantity(record.executedQty)}/${formatQuantity(qty)}`,
    },
 
    {
      title: '状态',
      dataIndex: 'status',
      width: 100,
      render: (status: string) => {
        const colorMap: Record<string, string> = {
          new: 'blue',
          partially_filled: 'orange',
          filled: 'green',
          canceled: 'grey',
          rejected: 'red',
          expired: 'grey',
        }
        return (
          <Tag size="small" color={colorMap[status] || 'grey' as any}>
            {formatOrderStatus(status)}
          </Tag>
        )
      },
    },
    {
      title: '时间',
      dataIndex: 'createdAt',
      width: 120,
      render: (time: string) => formatDateTime(time),
    },
    {
      title: '操作',
      fixed: 'right' as const,
      width: 100,
      render: (_: unknown, record: Order) => {
        if (record.status !== 'new' && record.status !== 'partially_filled') {
          return null
        }
        return (
          <Button
            size="small"
            type="danger"
            theme="light"
            loading={cancelMutation.isPending}
            onClick={() =>
              cancelMutation.mutate(record)
            }
          >
            取消
          </Button>
        )
      },
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
        <Title heading={4}>订单管理</Title>
        <Select
          value={status}
          onChange={(value) => setStatus(value as OrderStatus | '')}
          optionList={statusOptions}
          style={{ width: 150 }}
        />
      </div>

      <Card>
        <Table
          columns={columns}
          dataSource={data?.orders || []}
          loading={isLoading}
          rowKey="id"
          pagination={{
            pageSize: 20,
            total: data?.total || 0,
          }}
          empty={<Empty description="暂无订单" />}
        />
      </Card>
    </div>
  )
}

export default Orders
