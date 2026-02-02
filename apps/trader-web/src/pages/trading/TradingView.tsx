import React from 'react'
import { Card, Row, Col, Select, Tabs, TabPane } from '@douyinfe/semi-ui-19'
import { KLineChart } from '@/components/charts/KLineChart'
import { OrderForm } from '@/components/trading/OrderForm'
import { OrderTable } from '@/components/trading/OrderTable'
import { PositionCard } from '@/components/trading/PositionCard'
import { useAppStore } from '@/stores/appStore'

const SYMBOLS = [
  { value: 'BTC-USDT', label: 'BTC/USDT' },
  { value: 'ETH-USDT', label: 'ETH/USDT' },
  { value: 'BNB-USDT', label: 'BNB/USDT' },
  { value: 'SOL-USDT', label: 'SOL/USDT' },
  { value: 'XRP-USDT', label: 'XRP/USDT' },
  { value: 'DOGE-USDT', label: 'DOGE/USDT' },
]

const INTERVALS = [
  { value: '1m', label: '1分钟' },
  { value: '5m', label: '5分钟' },
  { value: '15m', label: '15分钟' },
  { value: '30m', label: '30分钟' },
  { value: '1H', label: '1小时' },
  { value: '4H', label: '4小时' },
  { value: '1D', label: '1天' },
  { value: '1W', label: '1周' },
]

const TradingView: React.FC = () => {
  const { tradingSymbol, tradingInterval, setTradingSymbol, setTradingInterval } = useAppStore()

  return (
    <div>
      <Row gutter={[16, 16]}>
        {/* 图表区域 */}
        <Col span={18}>
          <Card
            title={
              <div style={{ display: 'flex', gap: 16 }}>
                <Select
                  value={tradingSymbol}
                  onChange={(value) => setTradingSymbol(value as string)}
                  optionList={SYMBOLS}
                  style={{ width: 150 }}
                />
                <Select
                  value={tradingInterval}
                  onChange={(value) => setTradingInterval(value as string)}
                  optionList={INTERVALS}
                  style={{ width: 100 }}
                />
              </div>
            }
            bodyStyle={{ padding: 0 }}
          >
            <KLineChart
              symbol={tradingSymbol}
              interval={tradingInterval}
              height={500}
              onSymbolChange={setTradingSymbol}
              onIntervalChange={setTradingInterval}
            />
          </Card>
        </Col>

        {/* 下单区域 */}
        <Col span={6}>
          <Card title="下单" bodyStyle={{ padding: 16 }}>
            <OrderForm symbol={tradingSymbol} />
          </Card>

          <Card title="当前持仓" style={{ marginTop: 16 }}>
            <PositionCard symbol={tradingSymbol} />
          </Card>
        </Col>

        {/* 订单和持仓列表 */}
        <Col span={24}>
          <Card bodyStyle={{ padding: 0 }}>
            <Tabs type="line">
              <TabPane tab="当前委托" itemKey="open">
                <div style={{ padding: 16 }}>
                  <OrderTable symbol={tradingSymbol} />
                </div>
              </TabPane>
              <TabPane tab="历史订单" itemKey="history">
                <div style={{ padding: 16 }}>
                  <OrderTable symbol={tradingSymbol} showActions={false} />
                </div>
              </TabPane>
              <TabPane tab="所有持仓" itemKey="positions">
                <div style={{ padding: 16 }}>
                  <PositionCard />
                </div>
              </TabPane>
            </Tabs>
          </Card>
        </Col>
      </Row>
    </div>
  )
}

export default TradingView
