import React from 'react'
import { Card, Table, Tag, Typography, Empty } from '@douyinfe/semi-ui-19'
import { useQuery } from '@tanstack/react-query'
import { adminApi } from '@/api'
import { formatDateTime } from '@/utils/format'

const { Title } = Typography

const StrategyManage: React.FC = () => {
  const { data: strategies, isLoading } = useQuery({
    queryKey: ['admin-strategies'],
    queryFn: adminApi.getStrategies,
  })

  const columns = [
    {
      title: '策略名称',
      dataIndex: 'name',
    },
    {
      title: '描述',
      dataIndex: 'description',
      render: (desc: string | undefined) => desc || '-',
    },
    {
      title: '类型',
      dataIndex: 'tag',
      render: (tag: string) => {
        const colorMap: Record<string, string> = {
          long: 'green',
          short: 'red',
          neutral: 'blue',
        }
        const textMap: Record<string, string> = {
          long: '做多',
          short: '做空',
          neutral: '中性',
        }
        return (
          <Tag color={colorMap[tag] || 'grey'}>
            {textMap[tag] || tag}
          </Tag>
        )
      },
    },
    {
      title: '状态',
      dataIndex: 'status',
      render: (status: string) => (
        <Tag color={status === 'active' ? 'green' : 'grey'}>
          {status === 'active' ? '启用' : '禁用'}
        </Tag>
      ),
    },
    {
      title: '公开',
      dataIndex: 'isPublic',
      render: (isPublic: boolean) => (
        <Tag color={isPublic ? 'blue' : 'grey'}>
          {isPublic ? '是' : '否'}
        </Tag>
      ),
    },
    {
      title: '版本',
      dataIndex: 'version',
    },
    {
      title: '创建者',
      dataIndex: 'userId',
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      render: (date: string) => formatDateTime(date),
    },
  ]

  return (
    <div>
      <Title heading={4} style={{ marginBottom: 24 }}>
        策略管理
      </Title>

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
    </div>
  )
}

export default StrategyManage
