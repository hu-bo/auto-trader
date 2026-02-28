import React, { useState, useRef } from 'react'
import {
  Card,
  Table,
  Button,
  Modal,
  Form,
  Toast,
  Tag,
  Empty,
  Typography,
} from '@douyinfe/semi-ui-19'
import type { FormApi } from '@douyinfe/semi-ui-19/lib/es/form'
import { IconPlus, IconLink, IconDelete } from '@douyinfe/semi-icons'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { exchangeApi } from '@/api'
import { formatDateTime } from '@/utils/format'
import type { Exchange, ExchangeCreate, ExchangeType } from '@/types'

const { Title } = Typography

const EXCHANGE_TYPES: { value: ExchangeType; label: string }[] = [
  { value: 'BINANCE', label: 'Binance' },
  { value: 'OKX', label: 'OKX' },
  { value: 'BYBIT', label: 'Bybit' }
]

const ExchangeConfig: React.FC = () => {
  const queryClient = useQueryClient()
  const [modalVisible, setModalVisible] = useState(false)
  const [editingExchange, setEditingExchange] = useState<Exchange | null>(null)
  const formApiRef = useRef<FormApi<any>>(null)

  const { data: exchanges, isLoading } = useQuery({
    queryKey: ['exchanges'],
    queryFn: exchangeApi.list,
  })

  const createMutation = useMutation({
    mutationFn: exchangeApi.create,
    onSuccess: () => {
      Toast.success('交易所添加成功')
      queryClient.invalidateQueries({ queryKey: ['exchanges'] })
      setModalVisible(false)
      formApiRef.current?.reset()
    },
    onError: (error: Error) => {
      Toast.error(error.message || '添加失败')
    },
  })

  const updateMutation = useMutation({
    mutationFn: exchangeApi.update,
    onSuccess: () => {
      Toast.success('交易所更新成功')
      queryClient.invalidateQueries({ queryKey: ['exchanges'] })
      setModalVisible(false)
      setEditingExchange(null)
    },
    onError: (error: Error) => {
      Toast.error(error.message || '更新失败')
    },
  })

  const deleteMutation = useMutation({
    mutationFn: exchangeApi.delete,
    onSuccess: () => {
      Toast.success('交易所已删除')
      queryClient.invalidateQueries({ queryKey: ['exchanges'] })
    },
    onError: (error: Error) => {
      Toast.error(error.message || '删除失败')
    },
  })

  const testMutation = useMutation({
    mutationFn: exchangeApi.test,
    onSuccess: (data) => {
      if (data.valid) {
        Toast.success('连接测试成功')
      } else {
        Toast.error(data.error ? JSON.stringify(data.error, null, 2) : '连接测试失败')
      }
    },
    onError: (error: Error) => {
      Toast.error(error.message || '连接测试失败')
    },
  })

  const handleSubmit = (values: ExchangeCreate) => {
    if (editingExchange) {
      const { exchangeType, ...rest } = values
      updateMutation.mutate({ id: editingExchange.id, ...rest })
    } else {
      createMutation.mutate(values)
    }
  }

  const columns = [
    {
      title: '名称',
      dataIndex: 'name',
    },
    {
      title: '交易所',
      dataIndex: 'exchangeType',
      render: (type: string) => {
        const exchange = EXCHANGE_TYPES.find((e) => e.value === type)
        return exchange?.label || type
      },
    },
    {
      title: '网络',
      dataIndex: 'isTestnet',
      render: (isTestnet: boolean) => (
        <Tag color={isTestnet ? 'orange' : 'green'}>
          {isTestnet ? '测试网' : '主网'}
        </Tag>
      ),
    },
    {
      title: '状态',
      dataIndex: 'isActive',
      render: (isActive: boolean) => (
        <Tag color={isActive ? 'green' : 'grey'}>
          {isActive ? '启用' : '禁用'}
        </Tag>
      ),
    },
    // {
    //   title: 'API 状态',
    //   dataIndex: 'hasGrpcToken',
    //   render: (has: boolean) => (
    //     <Tag color={has ? 'green' : 'red'}>
    //       {has ? '已连接' : '未连接'}
    //     </Tag>
    //   ),
    // },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      render: (date: string) => formatDateTime(date),
    },
    {
      title: '操作',
      width: 200,
      render: (_: unknown, record: Exchange) => (
        <div style={{ display: 'flex', gap: 8 }}>
          <Button
            size="small"
            icon={<IconLink />}
            onClick={() => testMutation.mutate(record.id)}
            loading={testMutation.isPending}
          >
            测试
          </Button>
          <Button
            size="small"
            onClick={() => {
              setEditingExchange(record)
              setModalVisible(true)
            }}
          >
            编辑
          </Button>
          <Button
            size="small"
            type="danger"
            icon={<IconDelete />}
            onClick={() =>
              Modal.confirm({
                title: '确认删除',
                content: '确定要删除此交易所配置吗？',
                onOk: () => deleteMutation.mutate(record.id),
              })
            }
          >
            删除
          </Button>
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
        <Title heading={4}>交易所配置</Title>
        <Button
          type="primary"
          icon={<IconPlus />}
          onClick={() => {
            setEditingExchange(null)
            setModalVisible(true)
          }}
        >
          添加交易所
        </Button>
      </div>

      <Card>
        <Table
          columns={columns}
          dataSource={exchanges || []}
          loading={isLoading}
          rowKey="id"
          pagination={false}
          empty={<Empty description="暂无交易所配置" />}
        />
      </Card>

      <Modal
        title={editingExchange ? '编辑交易所' : '添加交易所'}
        visible={modalVisible}
        onCancel={() => {
          setModalVisible(false)
          setEditingExchange(null)
          formApiRef.current?.reset()
        }}
        footer={null}
        width={500}
      >
        <Form
          key={editingExchange?.id ?? 'create'}
          getFormApi={(api) => (formApiRef.current = api)}
          onSubmit={handleSubmit}
          labelPosition="left"
          labelWidth={100}
          initValues={
            editingExchange
              ? {
                  name: editingExchange.name,
                  exchangeType: editingExchange.exchangeType,
                  apiKey: editingExchange.apiKey ?? '',
                  apiSecret: editingExchange.apiSecret ?? '',
                  passphrase: editingExchange.passphrase ?? '',
                  isTestnet: editingExchange.isTestnet,
                  isActive: editingExchange.isActive,
                }
              : {
                  isTestnet: false,
                  isActive: true,
                } as ExchangeCreate
          }
        >
          {!editingExchange && (
            <Form.Select
              field="exchangeType"
              label="交易所"
              rules={[{ required: true, message: '请选择交易所' }]}
              optionList={EXCHANGE_TYPES}
              style={{ width: '100%' }}
            />
          )}

          <Form.Input
            field="name"
            label="名称"
            placeholder="给这个配置起个名字"
            rules={[{ required: true, message: '请输入名称' }]}
            style={{ width: '100%' }}
          />

          <Form.Input
            field="apiKey"
            label="API Key"
            placeholder="输入 API Key"
            rules={[{ required: true, message: '请输入 API Key' }]}
            style={{ width: '100%' }}
          />

          <Form.Input
            field="apiSecret"
            label="API Secret"
            placeholder="输入 API Secret"
            mode="password"
            rules={[{ required: true, message: '请输入 API Secret' }]}
            style={{ width: '100%' }}
          />

          <Form.Input
            field="passphrase"
            label="Passphrase"
            placeholder="OKX 等交易所需要填写"
            mode="password"
            style={{ width: '100%' }}
          />

          <Form.Switch
            field="isTestnet"
            label="测试网"
            checkedText="是"
            uncheckedText="否"
          />

          {editingExchange && (
            <Form.Switch
              field="isActive"
              label="启用"
              checkedText="是"
              uncheckedText="否"
            />
          )}

          <div style={{ display: 'flex', gap: 12, marginTop: 24, justifyContent: 'flex-end' }}>
            <Button
              onClick={() => {
                setModalVisible(false)
                setEditingExchange(null)
              }}
            >
              取消
            </Button>
            <Button
              type="primary"
              htmlType="submit"
              loading={createMutation.isPending || updateMutation.isPending}
            >
              {editingExchange ? '保存' : '添加'}
            </Button>
          </div>
        </Form>
      </Modal>
    </div>
  )
}

export default ExchangeConfig
