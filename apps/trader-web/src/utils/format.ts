import dayjs from 'dayjs'

// 货币格式化
export function formatCurrency(
  value: number | null | undefined,
  currency = 'USD',
  decimals = 2
): string {
  if (value == null) return '-'

  const formatter = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })

  return formatter.format(value)
}

// 数字格式化
export function formatNumber(
  value: number | null | undefined,
  decimals = 2
): string {
  if (value == null) return '-'

  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value)
}

// 百分比格式化
export function formatPercent(
  value: number | null | undefined,
  decimals = 2
): string {
  if (value == null) return '-'

  return `${(value * 100).toFixed(decimals)}%`
}

// 价格格式化 (自动精度)
export function formatPrice(value: number | null | undefined): string {
  if (value == null) return '-'

  if (value >= 1000) {
    return formatNumber(value, 2)
  } else if (value >= 1) {
    return formatNumber(value, 4)
  } else if (value >= 0.01) {
    return formatNumber(value, 6)
  } else {
    return formatNumber(value, 8)
  }
}

// 数量格式化
export function formatQuantity(value: number | null | undefined): string {
  if (value == null) return '-'

  if (value >= 1000000) {
    return `${(value / 1000000).toFixed(2)}M`
  } else if (value >= 1000) {
    return `${(value / 1000).toFixed(2)}K`
  } else if (value >= 1) {
    return formatNumber(value, 4)
  } else {
    return formatNumber(value, 8)
  }
}

// 日期格式化
export function formatDate(
  date: string | number | Date | null | undefined,
  format = 'YYYY-MM-DD'
): string {
  if (!date) return '-'
  return dayjs(date).format(format)
}

// 日期时间格式化
export function formatDateTime(
  date: string | number | Date | null | undefined,
  format = 'YYYY/M/D H:m:s'
): string {
  if (!date) return '-'
  return dayjs(date).format(format)
}

// 相对时间
export function formatRelativeTime(date: string | number | Date | null | undefined): string {
  if (!date) return '-'

  const now = dayjs()
  const target = dayjs(date)
  const diff = now.diff(target, 'second')

  if (diff < 60) return '刚刚'
  if (diff < 3600) return `${Math.floor(diff / 60)} 分钟前`
  if (diff < 86400) return `${Math.floor(diff / 3600)} 小时前`
  if (diff < 604800) return `${Math.floor(diff / 86400)} 天前`

  return formatDate(date)
}

// PnL 颜色
export function getPnlColor(value: number | null | undefined): string {
  if (value == null || value === 0) return 'var(--semi-color-text-0)'
  return value > 0 ? 'var(--semi-color-success)' : 'var(--semi-color-danger)'
}

// 订单状态文本
export function formatOrderStatus(status: string): string {
  const statusMap: Record<string, string> = {
    new: '待成交',
    partially_filled: '部分成交',
    filled: '已成交',
    canceled: '已取消',
    rejected: '已拒绝',
    expired: '已过期',
  }
  return statusMap[status] || status
}

// 订单方向文本
export function formatOrderSide(side: string, positionSide?: string): string {
  if (positionSide) {
    const positionSideMap: Record<string, Record<string, string>> = {
      long: { buy: '开多', sell: '平多' },
      short: { buy: '平空', sell: '开空' },
    }
    return positionSideMap[positionSide]?.[side] || side
  }
  return side === 'buy' ? '买入' : '卖出'
}

// 订单类型文本
export function formatOrderType(type: string): string {
  const typeMap: Record<string, string> = {
    market: '市价',
    limit: '限价',
    stop_market: '止损市价',
    stop_limit: '止损限价',
  }
  return typeMap[type] || type
}
