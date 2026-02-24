import React, { useState } from 'react'
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
  Form,
  Select,
} from '@douyinfe/semi-ui-19'
import { IconPlus, IconEdit, IconDelete } from '@douyinfe/semi-icons'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { strategyApi } from '@/api'
import { StrategyEditor } from '@/components/editor/StrategyEditor'
import { formatDateTime } from '@/utils/format'
import type { Strategy, StrategyTag, StrategyStatus } from '@/types'

const { Title } = Typography

const StrategyLibrary: React.FC = () => {
  const queryClient = useQueryClient()
  const [modalVisible, setModalVisible] = useState(false)
  const [editingStrategy, setEditingStrategy] = useState<Strategy | null>(null)
  const [formApi, setFormApi] = useState<any>(null)
  const [code, setCode] = useState('')

  const { data: strategies, isLoading } = useQuery({
    queryKey: ['strategies', 'available'],
    queryFn: strategyApi.listAvailable,
  })

  const createMutation = useMutation({
    mutationFn: strategyApi.create,
    onSuccess: () => {
      Toast.success('策略创建成功')
      queryClient.invalidateQueries({ queryKey: ['strategies'] })
      setModalVisible(false)
      formApi?.reset()
    },
    onError: (error: Error) => {
      Toast.error(error.message || '创建失败')
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Parameters<typeof strategyApi.update>[1] }) =>
      strategyApi.update(id, data),
    onSuccess: () => {
      Toast.success('策略更新成功')
      queryClient.invalidateQueries({ queryKey: ['strategies'] })
      setModalVisible(false)
      setEditingStrategy(null)
      formApi?.reset()
    },
    onError: (error: Error) => {
      Toast.error(error.message || '更新失败')
    },
  })

  const deleteMutation = useMutation({
    mutationFn: strategyApi.delete,
    onSuccess: () => {
      Toast.success('已删除')
      queryClient.invalidateQueries({ queryKey: ['strategies'] })
    },
    onError: (error: Error) => {
      Toast.error(error.message || '删除失败')
    },
  })

  const handleEdit = (strategy: Strategy) => {
    setEditingStrategy(strategy)
    setCode(strategy.code || '')
    setModalVisible(true)
  }

  const handleCreate = () => {
    setEditingStrategy(null)
    setCode('')
    setModalVisible(false)
    setTimeout(() => setModalVisible(true), 0)
  }

  const handleSubmit = (values: Record<string, unknown>) => {
    const data = {
      name: values.name as string,
      description: values.description as string,
      tag: values.tag as StrategyTag,
      code: code,
      version: values.version as string,
      status: values.status as StrategyStatus,
      isPublic: values.isPublic as boolean,
      params: values.params as Record<string, unknown>,
    }

    if (editingStrategy) {
      updateMutation.mutate({ id: editingStrategy.id, data })
    } else {
      createMutation.mutate(data)
    }
  }

  const columns = [
    {
      title: '策略名称',
      dataIndex: 'name',
      width: 200,
    },
    {
      title: '描述',
      dataIndex: 'description',
      ellipsis: true,
    },
    {
      title: '类型',
      dataIndex: 'tag',
      width: 100,
      render: (tag: StrategyTag) => (
        <Tag
          color={
            tag === 'long' ? 'green' : tag === 'short' ? 'red' : 'blue'
          }
        >
          {tag === 'long' ? '做多' : tag === 'short' ? '做空' : '中性'}
        </Tag>
      ),
    },
    {
      title: '版本',
      dataIndex: 'version',
      width: 80,
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 100,
      render: (status: StrategyStatus) => (
        <Tag color={status === 'active' ? 'green' : 'grey'}>
          {status === 'active' ? '启用' : '禁用'}
        </Tag>
      ),
    },
    {
      title: '创建人',
      dataIndex: 'creator',
      width: 120,
      render: (creator: any) => creator?.displayname || creator?.username || '-',
    },
    {
      title: '公开',
      dataIndex: 'isPublic',
      width: 80,
      render: (isPublic: boolean) => (
        <Tag color={isPublic ? 'blue' : 'grey'}>{isPublic ? '是' : '否'}</Tag>
      ),
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      width: 180,
      render: (date: string) => formatDateTime(date),
    },
    {
      title: '操作',
      width: 150,
      render: (_: unknown, record: Strategy) => (
        <div style={{ display: 'flex', gap: 8 }}>
          <Button
            size="small"
            icon={<IconEdit />}
            onClick={() => handleEdit(record)}
          >
            编辑
          </Button>
          <Popconfirm
            title="确定要删除此策略吗？"
            onConfirm={() => deleteMutation.mutate(record.id)}
          >
            <Button size="small" type="danger" icon={<IconDelete />}>
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
        <Title heading={4}>策略库管理</Title>
        <Button type="primary" icon={<IconPlus />} onClick={handleCreate}>
          创建策略
        </Button>
      </div>

      <Card>
        <Table
          columns={columns}
          dataSource={strategies || []}
          loading={isLoading}
          rowKey="id"
          pagination={{
            pageSize: 20,
          }}
          empty={<Empty description="暂无策略" />}
        />
      </Card>

      <Modal
        title={editingStrategy ? '编辑策略' : '创建策略'}
        visible={modalVisible}
        onCancel={() => {
          setModalVisible(false)
          setEditingStrategy(null)
        }}
        footer={null}
        width={800}
      >
        <Form
          getFormApi={(api) => setFormApi(api)}
          onSubmit={handleSubmit}
          labelPosition="left"
          labelWidth={100}
          initValues={
            editingStrategy
              ? {
                  name: editingStrategy.name,
                  description: editingStrategy.description,
                  tag: editingStrategy.tag,
                  code: editingStrategy.code,
                  version: editingStrategy.version,
                  status: editingStrategy.status,
                  isPublic: editingStrategy.isPublic,
                  params: editingStrategy.params,
                }
              : {
                  tag: 'neutral',
                  version: 'v1',
                  status: 'active',
                  isPublic: true,
                  params: {},
                }
          }
        >
          <Form.Input
            field="name"
            label="策略名称"
            placeholder="输入策略名称"
            rules={[{ required: true, message: '请输入策略名称' }]}
            style={{ width: '100%' }}
          />

          <Form.TextArea
            field="description"
            label="策略描述"
            placeholder="输入策略描述"
            rows={2}
            style={{ width: '100%' }}
          />

          <Form.Select field="tag" label="策略类型" style={{ width: '100%' }}>
            <Select.Option value="neutral">中性</Select.Option>
            <Select.Option value="long">做多</Select.Option>
            <Select.Option value="short">做空</Select.Option>
          </Form.Select>

          <Form.Input
            field="version"
            label="版本"
            placeholder="v1"
            style={{ width: '100%' }}
          />

          <Form.Select field="status" label="状态" style={{ width: '100%' }}>
            <Select.Option value="active">启用</Select.Option>
            <Select.Option value="inactive">禁用</Select.Option>
          </Form.Select>

          <Form.Switch
            field="isPublic"
            label="公开策略"
            checkedText="是"
            uncheckedText="否"
          />

          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', marginBottom: 8, fontWeight: 500 }}>
              策略代码
            </label>
            <StrategyEditor
              value={code}
              onChange={setCode}
              height={300}
            />
          </div>

          <div style={{ display: 'flex', gap: 12, marginTop: 24, justifyContent: 'flex-end' }}>
            <Button
              onClick={() => {
                setModalVisible(false)
                setEditingStrategy(null)
              }}
            >
              取消
            </Button>
            <Button
              type="primary"
              htmlType="submit"
              loading={createMutation.isPending || updateMutation.isPending}
            >
              {editingStrategy ? '保存' : '创建'}
            </Button>
          </div>
        </Form>
      </Modal>
    </div>
  )
}

export default StrategyLibrary
