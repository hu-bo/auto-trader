import React from 'react'
import { Card, Row, Col, Tabs, TabPane } from '@douyinfe/semi-ui-19'
import { KLineChart } from '@/components/charts/KLineChart'
import { OrderForm } from '@/components/trading/OrderForm'
import { OrderTable } from '@/components/trading/OrderTable'
import { PositionCard } from '@/components/trading/PositionCard'
import { useAppStore } from '@/stores/appStore'

const TradingView: React.FC = () => {
  const { tradingSymbol, tradingInterval, setTradingSymbol, setTradingInterval } = useAppStore()

  return (
    <div>
      <Row gutter={[16, 16]}>
        {/* 图表区域 — toolbar built into KLineChart (symbol search + period + indicator) */}
        <Col span={18}>
          <Card bodyStyle={{ padding: 0 }}>
            <KLineChart
              symbol={tradingSymbol}
              interval={tradingInterval}
              height={560}
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

          {/* <Card title="当前持仓" style={{ marginTop: 16 }}>
            <PositionCard symbol={tradingSymbol} />
          </Card> */}
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
