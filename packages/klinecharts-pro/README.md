# @hquant/klinecharts-pro

Professional K-line chart component based on [klinecharts](https://github.com/klinecharts/KLineChart) with React support.

## Installation

```bash
pnpm add @hquant/klinecharts-pro
```

## Usage

### Core (Vanilla JS)

```typescript
import { KLineChartPro, DefaultDatafeed } from '@hquant/klinecharts-pro'
import '@hquant/klinecharts-pro/styles.css'

const chart = new KLineChartPro({
  container: document.getElementById('chart'),
  symbol: {
    ticker: 'AAPL',
    name: 'Apple Inc.',
    exchange: 'NASDAQ',
  },
  period: { multiplier: 1, timespan: 'day', text: '1D' },
  datafeed: new DefaultDatafeed('your-polygon-api-key'),
})

// API methods
chart.setTheme('dark')
chart.setPeriod({ multiplier: 15, timespan: 'minute', text: '15m' })
chart.createIndicator('MACD', true)
```

### React

```tsx
import { useRef } from 'react'
import { KLineChart, DefaultDatafeed, type KLineChartRef } from '@hquant/klinecharts-pro/react'
import '@hquant/klinecharts-pro/styles.css'

function TradingChart() {
  const chartRef = useRef<KLineChartRef>(null)
  const datafeed = new DefaultDatafeed('your-polygon-api-key')

  return (
    <KLineChart
      ref={chartRef}
      symbol={{ ticker: 'AAPL', name: 'Apple Inc.' }}
      period={{ multiplier: 1, timespan: 'day', text: '1D' }}
      datafeed={datafeed}
      markers={[
        { timestamp: 1605052800000, text: 'BUY:2020-11-11', color: '#26A69A' },
        { timestamp: 1606003200000, text: 'SELL:2020-11-22', color: '#EF5350' },
        { timestamp: 1606608000000, text: 'HOLD', color: '#FFA500' },
      ]}
      theme="dark"
      locale="en-US"
      onSymbolChange={(data) => console.log('Symbol changed:', data)}
      onPeriodChange={(data) => console.log('Period changed:', data)}
      style={{ width: '100%', height: 500 }}
    />
  )
}
```

## Custom Datafeed

Implement your own datafeed by extending `BaseDatafeed` or implementing the `Datafeed` interface:

```typescript
import type { Datafeed, SymbolInfo, Period, KLineData, DatafeedSubscribeCallback } from '@hquant/klinecharts-pro'

class CustomDatafeed implements Datafeed {
  async searchSymbols(search?: string): Promise<SymbolInfo[]> {
    // Implement symbol search
    return []
  }

  async getHistoryKLineData(
    symbol: SymbolInfo,
    period: Period,
    from: number,
    to: number
  ): Promise<KLineData[]> {
    // Fetch historical K-line data
    return []
  }

  subscribe(
    symbol: SymbolInfo,
    period: Period,
    callback: DatafeedSubscribeCallback
  ): void {
    // Subscribe to real-time data via WebSocket or polling
  }

  unsubscribe(symbol: SymbolInfo, period: Period): void {
    // Clean up subscription
  }
}
```

## API Reference

### KLineChartPro Options

| Option | Type | Required | Description |
|--------|------|----------|-------------|
| `container` | `string \| HTMLElement` | Yes | Container element or ID |
| `symbol` | `SymbolInfo` | Yes | Initial symbol |
| `period` | `Period` | Yes | Initial period |
| `datafeed` | `Datafeed` | Yes | Data provider |
| `theme` | `'light' \| 'dark'` | No | Theme (default: 'light') |
| `locale` | `'zh-CN' \| 'zh-TW' \| 'en-US'` | No | Language (default: 'en-US') |
| `timezone` | `string` | No | Timezone |
| `styles` | `DeepPartial<Styles>` | No | Custom styles |
| `watermark` | `string \| Node` | No | Watermark |
| `periods` | `Period[]` | No | Available periods |
| `mainIndicators` | `string[]` | No | Main chart indicators |
| `subIndicators` | `string[]` | No | Sub-pane indicators |
| `drawingBarVisible` | `boolean` | No | Show drawing toolbar |

### Instance Methods

| Method | Description |
|--------|-------------|
| `setTheme(theme)` | Set theme |
| `getTheme()` | Get current theme |
| `setStyles(styles)` | Set chart styles |
| `getStyles()` | Get chart styles |
| `setLocale(locale)` | Set language |
| `getLocale()` | Get current language |
| `setTimezone(timezone)` | Set timezone |
| `getTimezone()` | Get current timezone |
| `setSymbol(symbol)` | Change symbol |
| `getSymbol()` | Get current symbol |
| `setPeriod(period)` | Change period |
| `getPeriod()` | Get current period |
| `createIndicator(indicator, isStack?, paneOptions?)` | Add indicator |
| `removeIndicator(paneId, name?)` | Remove indicator |
| `createOverlay(overlay, paneId?)` | Add overlay/drawing |
| `removeOverlay(overlayId?)` | Remove overlay |
| `subscribeAction(type, callback)` | Subscribe to chart events |
| `unsubscribeAction(type, callback?)` | Unsubscribe from events |
| `searchSymbols(search)` | Search symbols |
| `applyNewData(data, more?)` | Apply new K-line data |
| `updateData(data)` | Update latest K-line data |
| `getDataList()` | Get all K-line data |
| `resize()` | Resize chart |
| `destroy()` | Destroy chart instance |

### Built-in Indicators

**Main Chart:**
- MA (Moving Average)
- EMA (Exponential Moving Average)
- SMA (Simple Moving Average)
- BOLL (Bollinger Bands)
- SAR (Parabolic SAR)
- BBI
- VWAP

**Sub-Pane:**
- VOL, MACD, KDJ, RSI, BIAS, BRAR, CCI, DMI, CR, PSY, DMA, TRIX, OBV, VR, WR, MTM, EMV, SAR, AO, ROC, PVT, AVP

## Types

```typescript
interface SymbolInfo {
  ticker: string
  name?: string
  shortName?: string
  exchange?: string
  market?: string
  priceCurrency?: string
  type?: string
}

interface Period {
  multiplier: number
  timespan: 'minute' | 'hour' | 'day' | 'week' | 'month' | 'year'
  text: string
}

interface KLineData {
  timestamp: number
  open: number
  high: number
  low: number
  close: number
  volume?: number
  turnover?: number
}
```

## License

MIT
