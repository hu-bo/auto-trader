import React from 'react'
import { Card, Form, Button, Toast, Typography, Descriptions } from '@douyinfe/semi-ui-19'
import { useAuthStore } from '@/stores/authStore'
import { useAppStore } from '@/stores/appStore'
import { formatDateTime } from '@/utils/format'

const { Title } = Typography

const Settings: React.FC = () => {
  const { user } = useAuthStore()
  const { theme, setTheme } = useAppStore()

  const handleThemeChange = (values: Record<string, unknown>) => {
    setTheme(values.theme as 'light' | 'dark')
    Toast.success('设置已保存')
  }

  return (
    <div>
      <Title heading={4} style={{ marginBottom: 24 }}>
        设置
      </Title>

      {/* 个人信息 */}
      <Card title="个人信息" style={{ marginBottom: 16 }}>
        <Descriptions row>
          <Descriptions.Item itemKey="用户名">{user?.username}</Descriptions.Item>
          <Descriptions.Item itemKey="显示名">{user?.displayName || '-'}</Descriptions.Item>
          <Descriptions.Item itemKey="邮箱">{user?.email || '-'}</Descriptions.Item>
          <Descriptions.Item itemKey="角色">
            {user?.role === 'admin' ? '管理员' : '普通用户'}
          </Descriptions.Item>
          <Descriptions.Item itemKey="注册时间">
            {formatDateTime(user?.createdAt)}
          </Descriptions.Item>
          <Descriptions.Item itemKey="更新时间">
            {formatDateTime(user?.updatedAt)}
          </Descriptions.Item>
        </Descriptions>
      </Card>

      {/* 外观设置 */}
      <Card title="外观设置" style={{ marginBottom: 16 }}>
        <Form
          onSubmit={handleThemeChange}
          initValues={{ theme }}
          labelPosition="left"
          labelWidth={100}
        >
          <Form.RadioGroup
            field="theme"
            label="主题"
            type="button"
            options={[
              { value: 'light', label: '浅色' },
              { value: 'dark', label: '深色' },
            ]}
          />

          <Button type="primary" htmlType="submit" style={{ marginTop: 16 }}>
            保存设置
          </Button>
        </Form>
      </Card>

      {/* 通知设置 */}
      <Card title="通知设置" style={{ marginBottom: 16 }}>
        <Form labelPosition="left" labelWidth={150}>
          <Form.Switch
            field="orderNotification"
            label="订单通知"
            initValue={true}
            checkedText="开"
            uncheckedText="关"
          />
          <Form.Switch
            field="positionNotification"
            label="持仓变动通知"
            initValue={true}
            checkedText="开"
            uncheckedText="关"
          />
          <Form.Switch
            field="strategyNotification"
            label="策略信号通知"
            initValue={true}
            checkedText="开"
            uncheckedText="关"
          />
          <Form.Switch
            field="riskNotification"
            label="风控预警通知"
            initValue={true}
            checkedText="开"
            uncheckedText="关"
          />
        </Form>
      </Card>

      {/* API 设置 */}
      <Card title="API 设置">
        <Descriptions row>
          <Descriptions.Item itemKey="API 地址">
            {import.meta.env.VITE_API_BASE_URL || '/api'}
          </Descriptions.Item>
          <Descriptions.Item itemKey="WebSocket 地址">
            {import.meta.env.VITE_WS_URL || 'ws://localhost:9103/ws'}
          </Descriptions.Item>
          <Descriptions.Item itemKey="认证服务">
            {import.meta.env.VITE_CASDOOR_ENDPOINT || '-'}
          </Descriptions.Item>
        </Descriptions>
      </Card>
    </div>
  )
}

export default Settings
