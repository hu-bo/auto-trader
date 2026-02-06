import React, { useState } from 'react'
import { Card, Table, Tag, Button, Modal, Toast, Typography } from '@douyinfe/semi-ui-19'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { adminApi } from '@/api'
import { formatDateTime } from '@/utils/format'
import type { User } from '@/types'

const { Title } = Typography

const UserManage: React.FC = () => {
  const queryClient = useQueryClient()
  const [page, setPage] = useState(1)

  const { data, isLoading } = useQuery({
    queryKey: ['admin-users', page],
    queryFn: () => adminApi.getUsers({ page, pageSize: 20 }),
  })

  const toggleStatusMutation = useMutation({
    mutationFn: ({ userId, isActive }: { userId: number; isActive: boolean }) =>
      adminApi.updateUserStatus(userId, { isActive }),
    onSuccess: () => {
      Toast.success('状态更新成功')
      queryClient.invalidateQueries({ queryKey: ['admin-users'] })
    },
    onError: (error: Error) => {
      Toast.error(error.message || '更新失败')
    },
  })

  const columns = [
    {
      title: '用户名',
      dataIndex: 'username',
    },
    {
      title: '显示名',
      dataIndex: 'displayname',
      render: (name: string | undefined) => name || '-',
    },
    {
      title: '角色',
      dataIndex: 'role',
      render: (role: string) => (
        <Tag color={role === 'admin' ? 'red' : 'blue'}>
          {role === 'admin' ? '管理员' : '用户'}
        </Tag>
      ),
    },
    {
      title: '状态',
      dataIndex: 'isactive',
      render: (isactive: boolean) => (
        <Tag color={isactive ? 'green' : 'grey'}>
          {isactive ? '活跃' : '禁用'}
        </Tag>
      ),
    },
    {
      title: '注册时间',
      dataIndex: 'created_at',
      render: (date: string) => formatDateTime(date),
    },
    {
      title: '操作',
      render: (_: unknown, record: User) => (
        <Button
          type="tertiary"
          size="small"
          onClick={() => {
            Modal.confirm({
              title: '确认操作',
              content: `确定要${record.isactive ? '禁用' : '启用'}该用户吗？`,
              onOk: () =>
                toggleStatusMutation.mutate({
                  userId: record.id,
                  isActive: !record.isactive,
                }),
            })
          }}
        >
          {record.isactive ? '禁用' : '启用'}
        </Button>
      ),
    },
  ]

  return (
    <div>
      <Title heading={4} style={{ marginBottom: 24 }}>
        用户管理
      </Title>

      <Card>
        <Table
          columns={columns}
          dataSource={data?.users || []}
          loading={isLoading}
          rowKey="id"
          pagination={{
            currentPage: page,
            total: data?.total || 0,
            pageSize: 20,
            onPageChange: setPage,
          }}
        />
      </Card>
    </div>
  )
}

export default UserManage
