import React, { useState } from 'react'
import {
  Card,
  Table,
  Tag,
  Button,
  Modal,
  Toast,
  Empty,
  Popconfirm,
  Typography,
  Space,
} from '@douyinfe/semi-ui-19'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { strategyOrderApi } from '@/api'
import { formatDateTime } from '@/utils/format'
import { useNavigateKeepParams } from '@/hooks'
import { StrategyOrderForm } from '@/components/trading/StrategyOrderForm'
import type { StrategyOrder } from '@/types'

const { Title } = Typography

const StrategyOrders: React.FC = () => {
  const queryClient = useQueryClient()
  const navigate = useNavigateKeepParams()
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [createVisible, setCreateVisible] = useState(false)
  const [createTradeType, setCreateTradeType] = useState<'spot' | 'futures'>('spot')

  const { data, isLoading } = useQuery({
    queryKey: ['strategy-orders', currentPage, pageSize],
    queryFn: () => strategyOrderApi.list({ page: currentPage, pageSize }),
    refetchInterval: 5000,
  })

  const startMutation = useMutation({
    mutationFn: (id: string) => strategyOrderApi.start(id),
    onSuccess: () => {
      Toast.success('策略已启动')
      queryClient.invalidateQueries({ queryKey: ['strategy-orders'] })
    },
    onError: (error: Error) => Toast.error(error.message || '启动失败'),
  })

  const stopMutation = useMutation({
    mutationFn: (id: string) => strategyOrderApi.stop(id),
    onSuccess: () => {
      Toast.success('策略已停止')
      queryClient.invalidateQueries({ queryKey: ['strategy-orders'] })
    },
    onError: (error: Error) => Toast.error(error.message || '停止失败'),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => strategyOrderApi.delete(id),
    onSuccess: () => {
      Toast.success('策略订单已删除')
      queryClient.invalidateQueries({ queryKey: ['strategy-orders'] })
    },
    onError: (error: Error) => Toast.error(error.message || '删除失败'),
  })

  const handlePageChange = (page: number) => setCurrentPage(page)
  const handlePageSizeChange = (size: number) => { setPageSize(size); setCurrentPage(1) }

  const columns = [
    { title: 'ID', dataIndex: 'id', width: 80 },
    { title: '策略名称', dataIndex: 'strategyName', width: 150 },
    {
      title: '交易所',
      dataIndex: 'exchangeName',
      width: 150,
      render: (name: string, record: StrategyOrder) => (
        <div>
          <div>{name}</div>
          <div style={{ fontSize: 12, color: '#999' }}>{record.exchangeType} / {record.tradeType}</div>
        </div>
      ),
    },
    {
      title: '交易对',
      dataIndex: 'symbols',
      width: 200,
      render: (symbols: string[]) => (
        <Space wrap>
          {symbols.map((symbol) => <Tag key={symbol} size="small">{symbol}</Tag>)}
        </Space>
      ),
    },
    {
      title: '模式',
      dataIndex: 'live',
      width: 80,
      render: (live: boolean) => <Tag color={live ? 'red' : 'blue'}>{live ? '实盘' : '模拟'}</Tag>,
    },
    {
      title: '运行状态',
      dataIndex: 'isRunning',
      width: 100,
      render: (isRunning: boolean) => <Tag color={isRunning ? 'green' : 'grey'}>{isRunning ? '运行中' : '已停止'}</Tag>,
    },
    { title: '启动时间', dataIndex: 'startedAt', width: 160, render: (time: string | null) => time ? formatDateTime(time) : '-' },
    { title: '创建时间', dataIndex: 'createdAt', width: 160, render: (time: string) => formatDateTime(time) },
    {
      title: '操作',
      width: 240,
      fixed: 'right' as const,
      render: (_: unknown, record: StrategyOrder) => (
        <Space>
          <Button size="small" type="tertiary" onClick={() => navigate(`/strategy-orders/${record.id}`)}>详情</Button>
          <Button size="small" theme="light" onClick={() => navigate(`/strategy-orders/${record.id}?mode=edit`)}>编辑</Button>
          {record.isRunning ? (
            <Button size="small" type="warning" theme="light" onClick={() => stopMutation.mutate(record.id)}>停止</Button>
          ) : (
            <Button size="small" type="primary" theme="light" onClick={() => startMutation.mutate(record.id)}>启动</Button>
          )}
          {!record.isRunning && (
            <Popconfirm position="leftBottom" title="确定要删除此策略订单吗？" onConfirm={() => deleteMutation.mutate(record.id)}>
              <span><Button size="small" type="danger" theme="light">删除</Button></span>
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ]

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <Title heading={4}>策略运行管理</Title>
        <Button
          type="primary"
          onClick={() => {
            setCreateTradeType('spot')
            setCreateVisible(true)
          }}
        >
          创建策略订单
        </Button>
      </div>

      <Card>
        <Table
          columns={columns}
          dataSource={data?.data || []}
          loading={isLoading}
          rowKey="id"
          pagination={{
            currentPage, pageSize, total: data?.total || 0,
            onPageChange: handlePageChange, onPageSizeChange: handlePageSizeChange,
            showSizeChanger: true, pageSizeOpts: [10, 20, 50, 100],
          }}
          scroll={{ x: 1400 }}
          empty={<Empty description="暂无运行中的策略" />}
        />
      </Card>

      <Modal
        title="创建策略订单"
        visible={createVisible}
        onCancel={() => setCreateVisible(false)}
        footer={<div style={{ height: '1px' }} />}
        width={640}
      >
        <StrategyOrderForm
          key={createVisible ? 'create-open' : 'create-closed'}
          tradeType={createTradeType}
          onTradeTypeChange={(next) => setCreateTradeType(next)}
          onSuccess={() => setCreateVisible(false)}
          onCancel={() => setCreateVisible(false)}
        />
      </Modal>
    </div>
  )
}

export default StrategyOrders
