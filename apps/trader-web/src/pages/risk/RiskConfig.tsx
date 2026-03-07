import React, { useMemo, useState } from 'react'
import {
  Card,
  Form,
  Button,
  Toast,
  Typography,
  Table,
  Empty,
  Modal,
} from '@douyinfe/semi-ui-19'
import { IconPlus, IconDelete, IconEdit } from '@douyinfe/semi-icons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { riskConfigApi } from '@/api'
import type { RiskConfig, RiskConfigPreset } from '@/types'

const { Title } = Typography

type RiskFormValues = {
  name: string
  maxPositionSize?: number
  maxDailyLoss?: number
  maxDrawdown?: number
  stopLossPercent?: number
  takeProfitPercent?: number
  maxLeverage?: number
}

const toFormValues = (preset?: RiskConfigPreset): RiskFormValues => ({
  name: preset?.name ?? '',
  maxPositionSize: preset?.riskConfig.maxPositionSize,
  maxDailyLoss: preset?.riskConfig.maxDailyLoss,
  maxDrawdown: preset?.riskConfig.maxDrawdown,
  stopLossPercent: preset?.riskConfig.stopLossPercent,
  takeProfitPercent: preset?.riskConfig.takeProfitPercent,
  maxLeverage: preset?.riskConfig.maxLeverage,
})

const toRiskConfig = (values: RiskFormValues): RiskConfig => ({
  maxPositionSize: values.maxPositionSize,
  maxDailyLoss: values.maxDailyLoss,
  maxDrawdown: values.maxDrawdown,
  stopLossPercent: values.stopLossPercent,
  takeProfitPercent: values.takeProfitPercent,
  maxLeverage: values.maxLeverage,
})

const RiskConfigPage: React.FC = () => {
  const queryClient = useQueryClient()
  const [modalVisible, setModalVisible] = useState(false)
  const [editing, setEditing] = useState<RiskConfigPreset | null>(null)
  const [formApi, setFormApi] = useState<any>(null)

  const { data: configs = [], isLoading } = useQuery({
    queryKey: ['risk-configs'],
    queryFn: riskConfigApi.list,
  })

  const createMutation = useMutation({
    mutationFn: riskConfigApi.create,
    onSuccess: () => {
      Toast.success('风控配置已创建')
      queryClient.invalidateQueries({ queryKey: ['risk-configs'] })
      setModalVisible(false)
      setEditing(null)
      formApi?.reset()
    },
    onError: (error: Error) => Toast.error(error.message || '创建失败'),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: { name?: string; riskConfig?: RiskConfig } }) =>
      riskConfigApi.update(id, data),
    onSuccess: () => {
      Toast.success('风控配置已更新')
      queryClient.invalidateQueries({ queryKey: ['risk-configs'] })
      setModalVisible(false)
      setEditing(null)
      formApi?.reset()
    },
    onError: (error: Error) => Toast.error(error.message || '更新失败'),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => riskConfigApi.delete(id),
    onSuccess: () => {
      Toast.success('已删除')
      queryClient.invalidateQueries({ queryKey: ['risk-configs'] })
    },
    onError: (error: Error) => Toast.error(error.message || '删除失败'),
  })

  const submitting = createMutation.isPending || updateMutation.isPending

  const columns = useMemo(
    () => [
      { title: '名称', dataIndex: 'name', width: 150 },
      {
        title: '最大持仓 (USDT)',
        width: 140,
        render: (_: unknown, record: RiskConfigPreset) => record.riskConfig.maxPositionSize ?? '-',
      },
      {
        title: '日最大亏损 (USDT)',
        width: 150,
        render: (_: unknown, record: RiskConfigPreset) => record.riskConfig.maxDailyLoss ?? '-',
      },
      {
        title: '最大回撤 %',
        width: 120,
        render: (_: unknown, record: RiskConfigPreset) => record.riskConfig.maxDrawdown ?? '-',
      },
      {
        title: '止损 %',
        width: 100,
        render: (_: unknown, record: RiskConfigPreset) => record.riskConfig.stopLossPercent ?? '-',
      },
      {
        title: '止盈 %',
        width: 100,
        render: (_: unknown, record: RiskConfigPreset) => record.riskConfig.takeProfitPercent ?? '-',
      },
      {
        title: '最大杠杆',
        width: 100,
        render: (_: unknown, record: RiskConfigPreset) => record.riskConfig.maxLeverage ?? '-',
      },
      {
        title: '操作',
        width: 140,
        render: (_: unknown, record: RiskConfigPreset) => (
          <div style={{ display: 'flex', gap: 8 }}>
            <Button
              size="small"
              icon={<IconEdit />}
              onClick={() => {
                setEditing(record)
                setModalVisible(true)
              }}
            />
            <Button
              size="small"
              type="danger"
              icon={<IconDelete />}
              loading={deleteMutation.isPending}
              onClick={() =>
                Modal.confirm({
                  title: '确认删除',
                  content: `确定删除「${record.name}」？`,
                  onOk: () => deleteMutation.mutate(record.id),
                })
              }
            />
          </div>
        ),
      },
    ],
    [deleteMutation]
  )

  const handleSubmit = (values: RiskFormValues) => {
    const payload = {
      name: values.name,
      riskConfig: toRiskConfig(values),
    }

    if (editing) {
      updateMutation.mutate({ id: editing.id, data: payload })
      return
    }

    createMutation.mutate(payload)
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <Title heading={4}>风控配置</Title>
        <Button
          type="primary"
          icon={<IconPlus />}
          onClick={() => {
            setEditing(null)
            setModalVisible(true)
          }}
        >
          新建配置
        </Button>
      </div>

      <Card>
        <Table
          columns={columns}
          dataSource={configs}
          rowKey="id"
          loading={isLoading}
          pagination={false}
          empty={<Empty description="暂无风控配置，点击右上角新建" />}
        />
      </Card>

      <Modal
        title={editing ? '编辑风控配置' : '新建风控配置'}
        visible={modalVisible}
        onCancel={() => {
          setModalVisible(false)
          setEditing(null)
        }}
        footer={null}
        width={500}
      >
        <Form
          key={editing?.id ?? 'create'}
          initValues={toFormValues(editing ?? undefined)}
          getFormApi={setFormApi}
          onSubmit={handleSubmit}
          labelPosition="left"
          labelWidth={130}
        >
          <Form.Input field="name" label="配置名称" rules={[{ required: true, message: '请输入名称' }]} placeholder="如：保守型" />
          <Form.InputNumber field="maxPositionSize" label="最大持仓" initValue={10000} suffix="USDT" style={{ width: '100%' }} />
          <Form.InputNumber field="maxDailyLoss" label="日最大亏损" initValue={500} suffix="USDT" style={{ width: '100%' }} />
          <Form.InputNumber field="maxDrawdown" label="最大回撤" initValue={10} suffix="%" style={{ width: '100%' }} />
          <Form.InputNumber field="stopLossPercent" label="止损" initValue={2} suffix="%" style={{ width: '100%' }} />
          <Form.InputNumber field="takeProfitPercent" label="止盈" initValue={5} suffix="%" style={{ width: '100%' }} />
          <Form.InputNumber field="maxLeverage" label="最大杠杆" initValue={10} suffix="x" style={{ width: '100%' }} />
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 16 }}>
            <Button
              onClick={() => {
                setModalVisible(false)
                setEditing(null)
              }}
            >
              取消
            </Button>
            <Button type="primary" htmlType="submit" loading={submitting}>
              保存
            </Button>
          </div>
        </Form>
      </Modal>
    </div>
  )
}

export default RiskConfigPage
