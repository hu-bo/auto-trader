import type { Period, DrawingToolGroup } from '../types'

export const DEFAULT_PERIODS: Period[] = [
  { multiplier: 1, timespan: 'minute', text: '1m' },
  { multiplier: 5, timespan: 'minute', text: '5m' },
  { multiplier: 15, timespan: 'minute', text: '15m' },
  { multiplier: 30, timespan: 'minute', text: '30m' },
  { multiplier: 1, timespan: 'hour', text: '1H' },
  { multiplier: 4, timespan: 'hour', text: '4H' },
  { multiplier: 1, timespan: 'day', text: '1D' },
  { multiplier: 1, timespan: 'week', text: '1W' },
  { multiplier: 1, timespan: 'month', text: '1M' },
]

export function getDefaultMainIndicators(): string[] {
  return ['MA']
}

export function getDefaultSubIndicators(): string[] {
  return ['VOL']
}

export const BUILT_IN_INDICATORS = {
  main: ['MA', 'EMA', 'SMA', 'BOLL', 'SAR', 'BBI', 'VWAP'],
  sub: [
    'VOL',
    'MACD',
    'KDJ',
    'RSI',
    'BIAS',
    'BRAR',
    'CCI',
    'DMI',
    'CR',
    'PSY',
    'DMA',
    'TRIX',
    'OBV',
    'VR',
    'WR',
    'MTM',
    'EMV',
    'SAR',
    'AO',
    'ROC',
    'PVT',
    'AVP',
  ],
}

export const DRAWING_TOOL_GROUPS: DrawingToolGroup[] = [
  {
    name: 'line',
    icon: 'line',
    tools: [
      { name: 'horizontalRayLine', icon: 'horizontal-ray-line', overlayName: 'horizontalRayLine' },
      { name: 'horizontalSegment', icon: 'horizontal-segment', overlayName: 'horizontalSegment' },
      { name: 'horizontalStraightLine', icon: 'horizontal-straight-line', overlayName: 'horizontalStraightLine' },
      { name: 'verticalRayLine', icon: 'vertical-ray-line', overlayName: 'verticalRayLine' },
      { name: 'verticalSegment', icon: 'vertical-segment', overlayName: 'verticalSegment' },
      { name: 'verticalStraightLine', icon: 'vertical-straight-line', overlayName: 'verticalStraightLine' },
      { name: 'rayLine', icon: 'ray-line', overlayName: 'rayLine' },
      { name: 'segment', icon: 'segment', overlayName: 'segment' },
      { name: 'straightLine', icon: 'straight-line', overlayName: 'straightLine' },
      { name: 'priceLine', icon: 'price-line', overlayName: 'priceLine' },
      { name: 'priceChannelLine', icon: 'price-channel-line', overlayName: 'priceChannelLine' },
      { name: 'parallelStraightLine', icon: 'parallel-straight-line', overlayName: 'parallelStraightLine' },
    ],
  },
  {
    name: 'fibonacci',
    icon: 'fibonacci',
    tools: [
      { name: 'fibonacciLine', icon: 'fibonacci-line', overlayName: 'fibonacciLine' },
      { name: 'fibonacciSegment', icon: 'fibonacci-segment', overlayName: 'fibonacciSegment' },
      { name: 'fibonacciCircle', icon: 'fibonacci-circle', overlayName: 'fibonacciCircle' },
      { name: 'fibonacciSpiral', icon: 'fibonacci-spiral', overlayName: 'fibonacciSpiral' },
      { name: 'fibonacciSpeedResistanceFan', icon: 'fibonacci-speed-resistance-fan', overlayName: 'fibonacciSpeedResistanceFan' },
      { name: 'fibonacciExtension', icon: 'fibonacci-extension', overlayName: 'fibonacciExtension' },
    ],
  },
  {
    name: 'wave',
    icon: 'wave',
    tools: [
      { name: 'xabcd', icon: 'xabcd', overlayName: 'xabcd' },
      { name: 'abcd', icon: 'abcd', overlayName: 'abcd' },
      { name: 'threeWaves', icon: 'three-waves', overlayName: 'threeWaves' },
      { name: 'fiveWaves', icon: 'five-waves', overlayName: 'fiveWaves' },
      { name: 'eightWaves', icon: 'eight-waves', overlayName: 'eightWaves' },
      { name: 'anyWaves', icon: 'any-waves', overlayName: 'anyWaves' },
    ],
  },
  {
    name: 'annotation',
    icon: 'annotation',
    tools: [
      { name: 'simpleAnnotation', icon: 'simple-annotation', overlayName: 'simpleAnnotation' },
      { name: 'simpleTag', icon: 'simple-tag', overlayName: 'simpleTag' },
    ],
  },
]

export const DEFAULT_TIMEZONE = Intl.DateTimeFormat().resolvedOptions().timeZone
