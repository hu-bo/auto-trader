import React from 'react'
import { useParams } from 'react-router-dom'
import {
  Card,
  Form,
  Button,
  Typography,
  Toast,
  Spin,
  Select,
} from '@douyinfe/semi-ui-19'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { strategyApi } from '@/api'
import { useNavigateKeepParams } from '@/hooks'
import type { StrategyTag, StrategyStatus } from '@/types'

const { Title } = Typography

const StrategyConfigForm: React.FC = () => {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigateKeepParams()
  const queryClient = useQueryClient()
  const isEdit = !!id

  const { data: strategy, isLoading } = useQuery({
    queryKey: ['strategy', id],
    queryFn: () => strategyApi.get(id!),
    enabled: isEdit,
  })

  const createMutation = useMutation({
    mutationFn: strategyApi.create,
    onSuccess: () => {
      Toast.success('策略创建成功')
      queryClient.invalidateQueries({ queryKey: ['strategies'] })
      navigate('/strategies')
    },
    onError: (error: Error) => {
      Toast.error(error.message || '创建失败')
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id: value, data }: { id: string; data: Parameters<typeof strategyApi.update>[1] }) =>
      strategyApi.update(value, data),
    onSuccess: () => {
      Toast.success('策略更新成功')
      queryClient.invalidateQueries({ queryKey: ['strategies'] })
      queryClient.invalidateQueries({ queryKey: ['strategy', id] })
    },
    onError: (error: Error) => {
      Toast.error(error.message || '更新失败')
    },
  })

  const handleSubmit = (values: Record<string, unknown>) => {
    const data = {
      name: values.name as string,
      description: values.description as string,
      tag: values.tag as StrategyTag,
      code: values.code as string,
      status: values.status as StrategyStatus,
      isPublic: values.isPublic as boolean,
    }

    if (isEdit) {
      updateMutation.mutate({ id: id!, data })
    } else {
      createMutation.mutate(data)
    }
  }

  if (isEdit && isLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}>
        <Spin size="large" />
      </div>
    )
  }

  return (
    <div>
      <Title heading={4} style={{ marginBottom: 24 }}>
        {isEdit ? '编辑策略' : '创建策略'}
      </Title>

      <Card>
        <Form
          onSubmit={handleSubmit}
          labelPosition="left"
          labelWidth={120}
          initValues={
            strategy
              ? {
                  name: strategy.name,
                  description: strategy.description,
                  tag: strategy.tag,
                  code: strategy.code,
                  status: strategy.status,
                  isPublic: strategy.isPublic,
                }
              : {
                  tag: 'neutral',
                  status: 'inactive',
                  isPublic: true,
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
            rows={3}
            style={{ width: '100%' }}
          />

          <Form.Select
            field="tag"
            label="策略类型"
            style={{ width: '100%' }}
          >
            <Select.Option value="neutral">中性</Select.Option>
            <Select.Option value="long">做多</Select.Option>
            <Select.Option value="short">做空</Select.Option>
          </Form.Select>


          <Form.Select
            field="status"
            label="状态"
            style={{ width: '100%' }}
          >
            <Select.Option value="active">启用</Select.Option>
            <Select.Option value="inactive">禁用</Select.Option>
          </Form.Select>

          <Form.Switch
            field="isPublic"
            label="公开策略"
            checkedText="是"
            uncheckedText="否"
          />

          <Form.TextArea
            field="code"
            label="策略代码"
            placeholder="输入策略代码（Python）"
            rows={15}
            style={{ width: '100%', fontFamily: 'monospace' }}
          />

          <div style={{ display: 'flex', gap: 12, marginTop: 24 }}>
            <Button onClick={() => navigate('/strategies')}>取消</Button>
            <Button
              theme="light"
              onClick={() => navigate('/strategy-config/debugger')}
            >
              策略调试器
            </Button>
            <Button
              type="primary"
              htmlType="submit"
              loading={createMutation.isPending || updateMutation.isPending}
            >
              {isEdit ? '保存' : '创建'}
            </Button>
          </div>
        </Form>
      </Card>
    </div>
  )
}

export default StrategyConfigForm
