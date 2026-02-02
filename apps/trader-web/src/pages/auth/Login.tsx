import React from 'react'
import { Button, Card, Typography } from '@douyinfe/semi-ui-19'
import { IconUser } from '@douyinfe/semi-icons'
import { useAuth } from '@/hooks'

const { Title, Text } = Typography

const Login: React.FC = () => {
  const { login, isLoading } = useAuth()

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #0a0a0f 0%, #1a1a24 50%, #12121a 100%)',
        padding: 24,
      }}
    >
      <Card
        style={{
          width: '100%',
          maxWidth: 400,
          background: 'rgba(255, 255, 255, 0.05)',
          backdropFilter: 'blur(10px)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
        }}
        bodyStyle={{ padding: 40 }}
      >
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: 16,
              background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 16px',
              boxShadow: '0 0 30px rgba(99, 102, 241, 0.4)',
            }}
          >
            <span style={{ fontSize: 28, fontWeight: 'bold', color: 'white' }}>H</span>
          </div>
          <Title heading={3} style={{ marginBottom: 8 }}>
            HQuant Trader
          </Title>
          <Text type="tertiary">智能量化交易平台</Text>
        </div>

        <div style={{ marginBottom: 24 }}>
          <div
            style={{
              padding: 16,
              background: 'var(--bg-2)',
              borderRadius: 8,
              marginBottom: 16,
            }}
          >
            <Text type="secondary" style={{ fontSize: 13 }}>
              登录后您可以：
            </Text>
            <ul style={{ margin: '8px 0 0 16px', padding: 0 }}>
              <li style={{ color: 'var(--text-2)', fontSize: 13 }}>绑定交易所账户</li>
              <li style={{ color: 'var(--text-2)', fontSize: 13 }}>配置和运行量化策略</li>
              <li style={{ color: 'var(--text-2)', fontSize: 13 }}>查看实时持仓和订单</li>
              <li style={{ color: 'var(--text-2)', fontSize: 13 }}>分析交易数据和收益</li>
            </ul>
          </div>
        </div>

        <Button
          theme="solid"
          size="large"
          block
          icon={<IconUser />}
          loading={isLoading}
          onClick={login}
          style={{
            height: 48,
            background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
            border: 'none',
          }}
        >
          使用统一身份认证登录
        </Button>

        <div style={{ textAlign: 'center', marginTop: 24 }}>
          <Text type="quaternary" style={{ fontSize: 12 }}>
            登录即表示您同意我们的服务条款和隐私政策
          </Text>
        </div>
      </Card>
    </div>
  )
}

export default Login
