// 引入js
import { KLineChartPro, DefaultDatafeed } from '@klinecharts/pro'
// 引入样式
import '@klinecharts/pro/dist/klinecharts-pro.css'

// 创建实例
const chart = new KLineChartPro({
  container: document.getElementById('container'),
  // 初始化标的信息
  symbol: {
    exchange: 'XNYS',
    market: 'stocks',
    name: 'Alibaba Group Holding Limited American Depositary Shares, each represents eight Ordinary Shares',
    shortName: 'BABA',
    ticker: 'BABA',
    priceCurrency: 'usd',
    type: 'ADRC',
  },
  // 初始化周期
  period: { multiplier: 15, timespan: 'minute', text: '15m' },
  // 这里使用默认的数据接入，如果实际使用中也使用默认数据，需要去 https://polygon.io/ 申请 API key
  datafeed: new DefaultDatafeed(`${polygonIoApiKey}`)
})

```ts
// 数据接入api
class CustomDatafeed {
  /**
   * 模糊搜索标的
   * 在搜索框输入的时候触发
   * 返回标的信息数组
   */
  searchSymbols (search?: string): Promise<SymbolInfo[]> {
    // 根据模糊字段远程拉取标的数据
  }

  /**
   * 获取历史k线数据
   * 当标的和周期发生变化的时候触发
   * 
   * 返回标的k线数据数组
   */
  getHistoryKLineData (symbol: SymbolInfo, period: Period, from: number, to: number): Promise<KLineData[]> {
    // 完成数据请求
  }

  /**
   * 订阅标的在某个周期的实时数据
   * 当标的和周期发生变化的时候触发
   * 
   * 通过callback告知图表接收数据
   */
  subscribe (symbol: SymbolInfo, period: Period, callback: DatafeedSubscribeCallback): void {
    // 完成ws订阅或者http轮询
  }

  /**
   * 取消订阅标的在某个周期的实时数据
   * 当标的和周期发生变化的时候触发
   * 
   */ 
  unsubscribe (symbol: SymbolInfo, period: Period): void {
    // 完成ws订阅取消或者http轮询取消
  }
}
```


创建图表对象
typescript
new KLineChartPro(
  options: {
    container: string | HTMLElement;
    styles?: DeepPartial<Styles>;
    watermark?: string | Node;
    theme?: string;
    locale?: string;
    drawingBarVisible?: boolean;
    symbol: SymbolInfo;
    period: Period;
    periods?: Period[];
    timezone?: string;
    mainIndicators?: string[];
    subIndicators?: string[];
    datafeed: Datafeed;
  }
) => KLineChartPro
container 容器id或者容器
styles 核心图表样式
watermark 水印
theme 主题
locale 语言类型
drawingBarVisible 是否显示画线工具栏
symbol 标的
period 当前周期
periods 所以周期
timezone 时区
mainIndicators 主图指标
subIndicators 副图指标
datafeed 数据接入api实现
图表API
setTheme(theme)
typescript
(theme: string) => void
设置主题

getTheme()
typescript
() => string
获取主题

setStyles(styles)
typescript
(styles: DeepPartial<Styles>) => void
设置核心图表样式

getStyles()
typescript
() => Styles
获取核心图表样式

setLocale(locale)
typescript
(locale: string) => void
设置语言

getLocale()
typescript
() => string
获取语言

setTimezone(timezone)
typescript
(timezone: string) => void
设置时区

getTimezone()
typescript
() => string
获取时区

setSymbol(symbol)
typescript
(symbol: SymbolInfo) => void
设置标的

getSymbol()
typescript
() => SymbolInfo
获取标的

setPeriod(period)
typescript
(period: Period) => void
设置周期

getPeriod()
typescript
() => Period