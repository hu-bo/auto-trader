import React from 'react'
import { Table, Tag, Button, Toast, Empty } from '@douyinfe/semi-ui-19'
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
import type { Order } from '@/types'

interface OrderTableProps {
  symbol?: string
  showActions?: boolean
}

export const OrderTable: React.FC<OrderTableProps> = ({
  symbol,
  showActions = true,
}) => {
  const queryClient = useQueryClient()
  const { selectedExchange } = useAppStore()

  const { data, isLoading } = useQuery({
    queryKey: ['orders', selectedExchange?.id, symbol],
    queryFn: () =>
      selectedExchange
        ? orderApi.list({ exchangeId: selectedExchange.id, symbol })
        : Promise.resolve({ orders: [], total: 0 }),
    enabled: !!selectedExchange,
    refetchInterval: 5000,
  })

  const cancelMutation = useMutation({
    mutationFn: ({ orderId, exchangeId }: { orderId: string; exchangeId: string }) =>
      orderApi.cancel(orderId, { exchangeId }),
    onSuccess: () => {
      Toast.success('订单已取消')
      queryClient.invalidateQueries({ queryKey: ['orders'] })
    },
    onError: (error: Error) => {
      Toast.error(error.message || '取消失败')
    },
  })

  const columns = [
    {
      title: '时间',
      dataIndex: 'createdAt',
      width: 160,
      render: (time: string) => formatDateTime(time),
    },
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
          <Tag size="small" color={colorMap[status] || 'grey'}>
            {formatOrderStatus(status)}
          </Tag>
        )
      },
    },
    ...(showActions
      ? [
          {
            title: '操作',
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
                    cancelMutation.mutate({
                      orderId: record.orderid,
                      exchangeId: record.exchangeId,
                    })
                  }
                >
                  取消
                </Button>
              )
            },
          },
        ]
      : []),
  ]

  if (!selectedExchange) {
    return <Empty description="请先选择交易所" />
  }

  return (
    <Table
      columns={columns}
      dataSource={data?.orders || []}
      loading={isLoading}
      rowKey="orderid"
      pagination={false}
      size="small"
      empty={<Empty description="暂无订单" />}
    />
  )
}
