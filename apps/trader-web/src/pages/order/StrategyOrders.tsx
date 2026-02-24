import React, { useState } from 'react'
import {
  Card,
  Table,
  Tag,
  Button,
  Toast,
  Empty,
  Popconfirm,
  Typography,
  Space,
  Modal,
} from '@douyinfe/semi-ui-19'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { strategyOrderApi } from '@/api'
import { formatDateTime } from '@/utils/format'
import type { StrategyOrder } from '@/types'

const { Title } = Typography

const StrategyOrders: React.FC = () => {
  const queryClient = useQueryClient()
  const [selectedOrder, setSelectedOrder] = useState<StrategyOrder | null>(null)
  const [detailVisible, setDetailVisible] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)

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
    onError: (error: Error) => {
      Toast.error(error.message || '启动失败')
    },
  })

  const stopMutation = useMutation({
    mutationFn: (id: string) => strategyOrderApi.stop(id),
    onSuccess: () => {
      Toast.success('策略已停止')
      queryClient.invalidateQueries({ queryKey: ['strategy-orders'] })
    },
    onError: (error: Error) => {
      Toast.error(error.message || '停止失败')
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => strategyOrderApi.delete(id),
    onSuccess: () => {
      Toast.success('策略订单已删除')
      queryClient.invalidateQueries({ queryKey: ['strategy-orders'] })
    },
    onError: (error: Error) => {
      Toast.error(error.message || '删除失败')
    },
  })

  const handleViewDetail = (order: StrategyOrder) => {
    setSelectedOrder(order)
    setDetailVisible(true)
  }

  const handlePageChange = (page: number) => {
    setCurrentPage(page)
  }

  const handlePageSizeChange = (size: number) => {
    setPageSize(size)
    setCurrentPage(1)
  }

  const columns = [
    {
      title: 'ID',
      dataIndex: 'id',
      width: 80,
    },
    {
      title: '策略名称',
      dataIndex: 'strategy_name',
      width: 150,
    },
    {
      title: '交易所',
      dataIndex: 'exchange_name',
      width: 150,
      render: (name: string, record: StrategyOrder) => (
        <div>
          <div>{name}</div>
          <div style={{ fontSize: 12, color: '#999' }}>
            {record.exchange_type} / {record.trade_type}
          </div>
        </div>
      ),
    },
    {
      title: '交易对',
      dataIndex: 'symbols',
      width: 200,
      render: (symbols: string[]) => (
        <Space wrap>
          {symbols.map((symbol) => (
            <Tag key={symbol} size="small">
              {symbol}
            </Tag>
          ))}
        </Space>
      ),
    },
    {
      title: '模式',
      dataIndex: 'live',
      width: 80,
      render: (live: boolean) => (
        <Tag color={live ? 'red' : 'blue'}>{live ? '实盘' : '模拟'}</Tag>
      ),
    },
    {
      title: '运行状态',
      dataIndex: 'is_running',
      width: 100,
      render: (isRunning: boolean) => (
        <Tag color={isRunning ? 'green' : 'grey'}>
          {isRunning ? '运行中' : '已停止'}
        </Tag>
      ),
    },
    {
      title: '启动时间',
      dataIndex: 'started_at',
      width: 160,
      render: (time: string | null) => (time ? formatDateTime(time) : '-'),
    },
    {
      title: '停止时间',
      dataIndex: 'stopped_at',
      width: 160,
      render: (time: string | null) => (time ? formatDateTime(time) : '-'),
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      width: 160,
      render: (time: string) => formatDateTime(time),
    },
    {
      title: '操作',
      width: 200,
      fixed: 'right' as const,
      render: (_: unknown, record: StrategyOrder) => (
        <Space>
          <Button
            size="small"
            type="tertiary"
            onClick={() => handleViewDetail(record)}
          >
            详情
          </Button>
          {record.is_running ? (
            <Popconfirm
              title="确定要停止此策略吗？"
              onConfirm={() => stopMutation.mutate(record.id)}
            >
              <Button size="small" type="warning" theme="light">
                停止
              </Button>
            </Popconfirm>
          ) : (
            <Button
              size="small"
              type="primary"
              theme="light"
              onClick={() => startMutation.mutate(record.id)}
            >
              启动
            </Button>
          )}
          {!record.is_running && (
            <Popconfirm
              title="确定要删除此策略订单吗？"
              onConfirm={() => deleteMutation.mutate(record.id)}
            >
              <Button size="small" type="danger" theme="light">
                删除
              </Button>
            </Popconfirm>
          )}
        </Space>
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
        <Title heading={4}>策略运行管理</Title>
      </div>

      <Card>
        <Table
          columns={columns}
          dataSource={data?.data || []}
          loading={isLoading}
          rowKey="id"
          pagination={{
            currentPage,
            pageSize,
            total: data?.total || 0,
            onPageChange: handlePageChange,
            onPageSizeChange: handlePageSizeChange,
            showSizeChanger: true,
            pageSizeOpts: [10, 20, 50, 100],
          }}
          scroll={{ x: 1400 }}
          empty={<Empty description="暂无运行中的策略" />}
        />
      </Card>

      <Modal
        title="策略订单详情"
        visible={detailVisible}
        onCancel={() => setDetailVisible(false)}
        footer={null}
        width={800}
      >
        {selectedOrder && (
          <div style={{ padding: '16px 0' }}>
            <div style={{ marginBottom: 16 }}>
              <strong>基本信息</strong>
              <div style={{ marginTop: 8, lineHeight: '28px' }}>
                <div>订单ID: {selectedOrder.id}</div>
                <div>策略: {selectedOrder.strategy_name}</div>
                <div>
                  交易所: {selectedOrder.exchange_name} ({selectedOrder.exchange_type})
                </div>
                <div>交易类型: {selectedOrder.trade_type}</div>
                <div>
                  模式:{' '}
                  <Tag color={selectedOrder.live ? 'red' : 'blue'}>
                    {selectedOrder.live ? '实盘' : '模拟'}
                  </Tag>
                </div>
                <div>
                  运行状态:{' '}
                  <Tag color={selectedOrder.is_running ? 'green' : 'grey'}>
                    {selectedOrder.is_running ? '运行中' : '已停止'}
                  </Tag>
                </div>
              </div>
            </div>

            <div style={{ marginBottom: 16 }}>
              <strong>交易对</strong>
              <div style={{ marginTop: 8 }}>
                <Space wrap>
                  {selectedOrder.symbols.map((symbol) => (
                    <Tag key={symbol}>{symbol}</Tag>
                  ))}
                </Space>
              </div>
            </div>

            <div style={{ marginBottom: 16 }}>
              <strong>策略参数</strong>
              <pre
                style={{
                  marginTop: 8,
                  padding: 12,
                  background: '#f5f5f5',
                  borderRadius: 4,
                  overflow: 'auto',
                }}
              >
                {JSON.stringify(selectedOrder.parameters, null, 2)}
              </pre>
            </div>

            <div style={{ marginBottom: 16 }}>
              <strong>风控配置</strong>
              <pre
                style={{
                  marginTop: 8,
                  padding: 12,
                  background: '#f5f5f5',
                  borderRadius: 4,
                  overflow: 'auto',
                }}
              >
                {JSON.stringify(selectedOrder.risk_config, null, 2)}
              </pre>
            </div>

            <div>
              <strong>时间信息</strong>
              <div style={{ marginTop: 8, lineHeight: '28px' }}>
                <div>
                  创建时间: {formatDateTime(selectedOrder.created_at)}
                </div>
                <div>
                  启动时间:{' '}
                  {selectedOrder.started_at
                    ? formatDateTime(selectedOrder.started_at)
                    : '-'}
                </div>
                <div>
                  停止时间:{' '}
                  {selectedOrder.stopped_at
                    ? formatDateTime(selectedOrder.stopped_at)
                    : '-'}
                </div>
                <div>
                  更新时间: {formatDateTime(selectedOrder.updated_at)}
                </div>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}

export default StrategyOrders
