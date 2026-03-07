import React, { useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { Card, Row, Col, Tabs, TabPane } from '@douyinfe/semi-ui-19'
import { KLineChart } from '@/components/charts/KLineChart'
import { OrderForm } from '@/components/trading/OrderForm'
import { OrderTable } from '@/components/trading/OrderTable'
import { useAppStore } from '@/stores/appStore'
import { useNavigateKeepParams } from '@/hooks'

const TradingView: React.FC = () => {
  const { symbol: urlSymbol } = useParams<{ symbol: string }>()
  const navigate = useNavigateKeepParams()
  const {
    tradingSymbol,
    tradingTradeType,
    tradingInterval,
    setTradingSymbol,
    setTradingInterval,
    setTradingTradeType
  } = useAppStore()

  // URL param → store 同步
  useEffect(() => {
    if (urlSymbol && urlSymbol !== tradingSymbol) {
      setTradingSymbol(urlSymbol)
    }
  }, [urlSymbol])

  // symbol 变化时同步 URL
  const handleSymbolChange = (newSymbol: string) => {
    setTradingSymbol(newSymbol)
    navigate(`/trading/${newSymbol}`, { replace: true })
  }

  return (
    <div>
      <Row gutter={[16, 16]}>
        {/* 图表区域 — toolbar built into KLineChart (symbol search + period + indicator) */}
        <Col span={18}>
          <Card bodyStyle={{ padding: 0 }}>
            <KLineChart
              symbol={urlSymbol || tradingSymbol}
              interval={tradingInterval}
              height={638}
              onSymbolChange={handleSymbolChange}
              onIntervalChange={setTradingInterval}
            />
          </Card>
        </Col>

        {/* 下单区域 */}
        <Col span={6}>
          <Card title="下单" bodyStyle={{ padding: 16 }}>
            <OrderForm
              tradeType={tradingTradeType}
              symbol={urlSymbol || tradingSymbol}
              onTradeTypeChange={setTradingTradeType} />
          </Card>
        </Col>

        {/* 订单和持仓列表 */}
        <Col span={24} >
          <Card bodyStyle={{ padding: 4 }}>
            <Tabs type="line">
              <TabPane tab="当前委托" itemKey="open">
                <OrderTable symbol={urlSymbol || tradingSymbol} />
              </TabPane>
              <TabPane tab="历史订单" itemKey="history">
                <OrderTable symbol={urlSymbol || tradingSymbol} showActions={false} />
              </TabPane>
            </Tabs>
          </Card>
        </Col>
      </Row>
    </div>
  )
}

export default TradingView
