import React, { useState } from 'react'
import { Steps, Button, Card, Typography, Empty } from '@douyinfe/semi-ui-19'
import { IconTicketCodeExchangeStroked } from '@douyinfe/semi-icons'
import { useNavigateKeepParams } from '@/hooks'

const { Title, Paragraph, Text } = Typography

const Onboarding: React.FC = () => {
  const navigate = useNavigateKeepParams()
  const [current, setCurrent] = useState(0)

  return (
    <div style={{ maxWidth: 720, margin: '48px auto', padding: '0 24px' }}>
      <Title heading={3} style={{ textAlign: 'center', marginBottom: 32 }}>
        欢迎使用 HQuant
      </Title>

      <Steps current={current} style={{ marginBottom: 32 }}>
        <Steps.Step title="添加交易所" />
        <Steps.Step title="使用说明" />
      </Steps>

      {current === 0 && (
        <Card>
          <Empty
            image={<IconTicketCodeExchangeStroked style={{ fontSize: 48, color: 'var(--semi-color-primary)' }} />}
            title="尚未配置交易所"
            description="请先添加至少一个交易所 API 配置，才能开始使用交易功能"
            style={{ padding: '32px 0' }}
          />
          <div style={{ display: 'flex', justifyContent: 'center', gap: 12, marginTop: 16 }}>
            <Button
              type="primary"
              theme="solid"
              onClick={() => navigate('/exchanges')}
            >
              前往添加交易所
            </Button>
            <Button onClick={() => setCurrent(1)}>
              跳过，先看说明
            </Button>
          </div>
        </Card>
      )}

      {current === 1 && (
        <Card>
          <div style={{ padding: '16px 0' }}>
            <Title heading={5} style={{ marginBottom: 16 }}>快速上手</Title>
            <div style={{ lineHeight: '2em' }}>
              <Paragraph>
                <Text strong>1. 配置交易所</Text>
                <br />
                在「交易所」页面添加你的 API Key，支持 Binance、OKX 等主流交易所。
              </Paragraph>
              <Paragraph>
                <Text strong>2. 浏览行情</Text>
                <br />
                在「行情总览」页面查看实时行情，支持多选交易对进行批量操作。
              </Paragraph>
              <Paragraph>
                <Text strong>3. 创建策略</Text>
                <br />
                选中交易对后可创建策略订单或条件单，系统会自动计算止盈止损。
              </Paragraph>
              <Paragraph>
                <Text strong>4. 风控管理</Text>
                <br />
                在「风控配置」页面设置风控规则，保护你的资金安全。
              </Paragraph>
              <Paragraph>
                <Text strong>5. 策略运行</Text>
                <br />
                在「策略运行」页面管理所有策略订单，支持启动、停止、编辑。
              </Paragraph>
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 12, marginTop: 16 }}>
            <Button onClick={() => setCurrent(0)}>上一步</Button>
            <Button type="primary" theme="solid" onClick={() => navigate('/market')}>
              开始使用
            </Button>
          </div>
        </Card>
      )}
    </div>
  )
}

export default Onboarding
