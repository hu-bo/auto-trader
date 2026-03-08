import React from 'react'
import {
  Card,
  Button,
  Space,
  Spin,
  Empty,
  Toast,
} from '@douyinfe/semi-ui-19'
import { useParams, useSearchParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { strategyOrderApi } from '@/api'
import { StrategyOrderForm } from '@/components/trading/StrategyOrderForm'

const StrategyOrderDetail: React.FC = () => {
  const { id } = useParams()
  const [searchParams, setSearchParams] = useSearchParams()
  const queryClient = useQueryClient()

  const orderId = id ?? ''
  const isEditMode = searchParams.get('mode') === 'edit'

  const { data: order, isLoading } = useQuery({
    queryKey: ['strategy-order', orderId],
    queryFn: () => strategyOrderApi.get(orderId),
    enabled: !!orderId,
  })

  const setEditMode = (enabled: boolean) => {
    const next = new URLSearchParams(searchParams)
    if (enabled) next.set('mode', 'edit')
    else next.delete('mode')
    setSearchParams(next, { replace: true })
  }

  const startMutation = useMutation({
    mutationFn: (orderIdValue: string) => strategyOrderApi.start(orderIdValue),
    onSuccess: () => {
      Toast.success('策略已启动')
      queryClient.invalidateQueries({ queryKey: ['strategy-orders'] })
      queryClient.invalidateQueries({ queryKey: ['strategy-order', orderId] })
    },
    onError: (error: Error) => Toast.error(error.message || '启动失败'),
  })

  const stopMutation = useMutation({
    mutationFn: (orderIdValue: string) => strategyOrderApi.stop(orderIdValue),
    onSuccess: () => {
      Toast.success('策略已停止')
      queryClient.invalidateQueries({ queryKey: ['strategy-orders'] })
      queryClient.invalidateQueries({ queryKey: ['strategy-order', orderId] })
    },
    onError: (error: Error) => Toast.error(error.message || '停止失败'),
  })

  if (!orderId) {
    return (
      <Card>
        <Empty description="无效的策略订单 ID" />
      </Card>
    )
  }

  if (isLoading) {
    return (
      <Card>
        <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
          <Spin size="large" />
        </div>
      </Card>
    )
  }

  if (!order) {
    return (
      <Card>
        <Empty description="策略订单不存在" />
      </Card>
    )
  }

  return (
    <div>
      <Card
        title="策略订单详情"
        headerExtraContent={
          <Space>
            {order.isRunning ? (
              <Button
                type="warning"
                theme="light"
                loading={stopMutation.isPending}
                onClick={() => stopMutation.mutate(order.id)}
              >
                停止
              </Button>
            ) : (
              <Button
                type="primary"
                theme="light"
                loading={startMutation.isPending}
                onClick={() => startMutation.mutate(order.id)}
              >
                启动
              </Button>
            )}
            {isEditMode ? (
              <Button theme="light" onClick={() => setEditMode(false)}>
                取消编辑
              </Button>
            ) : (
              <Button theme="light" onClick={() => setEditMode(true)}>
                编辑
              </Button>
            )}
          </Space>
        }
      >
        <StrategyOrderForm
          key={`${order.id}-${isEditMode}`}
          detail={order}
          tradeType={(order.tradeType as 'spot' | 'futures') || 'spot'}
          onSuccess={() => setEditMode(false)}
          onCancel={isEditMode ? () => setEditMode(false) : undefined}
        />
      </Card>
    </div>
  )
}

export default StrategyOrderDetail
