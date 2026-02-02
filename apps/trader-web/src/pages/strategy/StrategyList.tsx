import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Card,
  Table,
  Button,
  Tag,
  Typography,
  Modal,
  Toast,
  Empty,
  Popconfirm,
} from '@douyinfe/semi-ui-19'
import { IconPlus, IconPlay, IconStop, IconDelete } from '@douyinfe/semi-icons'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { strategyApi, strategyOrderApi } from '@/api'
import { StrategyOrderForm } from '@/components/trading/StrategyOrderForm'
import { formatDateTime } from '@/utils/format'
import type { Strategy, StrategyOrder } from '@/types'

const { Title } = Typography

const StrategyList: React.FC = () => {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [bindModalVisible, setBindModalVisible] = useState(false)
  const [selectedStrategy, setSelectedStrategy] = useState<Strategy | null>(null)

  const { data: strategies, isLoading: loadingStrategies } = useQuery({
    queryKey: ['strategies'],
    queryFn: strategyApi.list,
  })

  const { data: strategyOrders, isLoading: loadingOrders } = useQuery({
    queryKey: ['strategy-orders'],
    queryFn: strategyOrderApi.list,
  })

  const startMutation = useMutation({
    mutationFn: strategyOrderApi.start,
    onSuccess: () => {
      Toast.success('策略已启动')
      queryClient.invalidateQueries({ queryKey: ['strategy-orders'] })
    },
    onError: (error: Error) => {
      Toast.error(error.message || '启动失败')
    },
  })

  const stopMutation = useMutation({
    mutationFn: strategyOrderApi.stop,
    onSuccess: () => {
      Toast.success('策略已停止')
      queryClient.invalidateQueries({ queryKey: ['strategy-orders'] })
    },
    onError: (error: Error) => {
      Toast.error(error.message || '停止失败')
    },
  })

  const deleteMutation = useMutation({
    mutationFn: strategyOrderApi.delete,
    onSuccess: () => {
      Toast.success('已删除')
      queryClient.invalidateQueries({ queryKey: ['strategy-orders'] })
    },
    onError: (error: Error) => {
      Toast.error(error.message || '删除失败')
    },
  })

  const orderColumns = [
    {
      title: '策略',
      dataIndex: 'strategyId',
      render: (id: string) => {
        const strategy = strategies?.find((s) => s.id === id)
        return strategy?.name || id
      },
    },
    {
      title: '交易对',
      dataIndex: 'symbols',
      render: (symbols: string[]) => (
        <div>
          {symbols.map((s) => (
            <Tag key={s} size="small" style={{ marginRight: 4 }}>
              {s}
            </Tag>
          ))}
        </div>
      ),
    },
    {
      title: '模式',
      dataIndex: 'live',
      render: (live: boolean) => (
        <Tag color={live ? 'red' : 'blue'}>{live ? '实盘' : '模拟'}</Tag>
      ),
    },
    {
      title: '状态',
      dataIndex: 'isRunning',
      render: (isRunning: boolean) => (
        <Tag color={isRunning ? 'green' : 'grey'}>{isRunning ? '运行中' : '已停止'}</Tag>
      ),
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      render: (date: string) => formatDateTime(date),
    },
    {
      title: '操作',
      width: 200,
      render: (_: unknown, record: StrategyOrder) => (
        <div style={{ display: 'flex', gap: 8 }}>
          {record.isRunning ? (
            <Button
              size="small"
              icon={<IconStop />}
              onClick={() => stopMutation.mutate(record.id)}
              loading={stopMutation.isPending}
            >
              停止
            </Button>
          ) : (
            <Button
              size="small"
              type="primary"
              icon={<IconPlay />}
              onClick={() => startMutation.mutate(record.id)}
              loading={startMutation.isPending}
            >
              启动
            </Button>
          )}
          <Popconfirm
            title="确定要删除此策略订单吗？"
            onConfirm={() => deleteMutation.mutate(record.id)}
          >
            <Button
              size="small"
              type="danger"
              icon={<IconDelete />}
              disabled={record.isRunning}
            >
              删除
            </Button>
          </Popconfirm>
        </div>
      ),
    },
  ]

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
        <Title heading={4}>策略管理</Title>
        <Button
          type="primary"
          icon={<IconPlus />}
          onClick={() => setBindModalVisible(true)}
        >
          绑定策略
        </Button>
      </div>

      {/* 可用策略 */}
      <Card title="可用策略" style={{ marginBottom: 16 }}>
        {strategies && strategies.length > 0 ? (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>
            {strategies.map((strategy) => (
              <Card
                key={strategy.id}
                style={{
                  width: 280,
                  cursor: 'pointer',
                  background: 'var(--bg-2)',
                }}
                bodyStyle={{ padding: 16 }}
                onClick={() => navigate(`/strategies/${strategy.id}`)}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 600 }}>{strategy.name}</div>
                    <div
                      style={{
                        color: 'var(--text-3)',
                        fontSize: 13,
                        marginTop: 4,
                      }}
                    >
                      {strategy.description || '暂无描述'}
                    </div>
                  </div>
                  <Tag
                    color={
                      strategy.tag === 'long'
                        ? 'green'
                        : strategy.tag === 'short'
                        ? 'red'
                        : 'blue'
                    }
                  >
                    {strategy.tag === 'long'
                      ? '做多'
                      : strategy.tag === 'short'
                      ? '做空'
                      : '中性'}
                  </Tag>
                </div>
                <div style={{ marginTop: 12 }}>
                  <Tag size="small">{strategy.status}</Tag>
                  <Tag size="small" style={{ marginLeft: 4 }}>
                    {strategy.version}
                  </Tag>
                </div>
              </Card>
            ))}
          </div>
        ) : (
          <Empty description="暂无可用策略" />
        )}
      </Card>

      {/* 我的策略订单 */}
      <Card title="我的策略订单">
        <Table
          columns={orderColumns}
          dataSource={strategyOrders || []}
          loading={loadingOrders}
          rowKey="id"
          pagination={false}
          empty={<Empty description="暂无策略订单" />}
        />
      </Card>

      {/* 绑定策略弹窗 */}
      <Modal
        title="绑定策略"
        visible={bindModalVisible}
        onCancel={() => setBindModalVisible(false)}
        footer={null}
        width={600}
      >
        <StrategyOrderForm onSuccess={() => setBindModalVisible(false)} />
      </Modal>
    </div>
  )
}

export default StrategyList
