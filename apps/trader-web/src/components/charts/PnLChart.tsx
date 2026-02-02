import React, { useEffect, useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Spin, Empty } from '@douyinfe/semi-ui-19'
import { statsApi } from '@/api'
import { useAppStore } from '@/stores/appStore'
import { formatCurrency } from '@/utils/format'

interface PnLChartProps {
  days?: number
  height?: number
}

export const PnLChart: React.FC<PnLChartProps> = ({ days = 30, height = 268 }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const { theme } = useAppStore()

  const { data, isLoading, error } = useQuery({
    queryKey: ['pnl-history', days],
    queryFn: () => statsApi.getPnlHistory(days),
  })

  useEffect(() => {
    if (!canvasRef.current || !data || data.length === 0) return

    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // 设置画布尺寸
    const dpr = window.devicePixelRatio || 1
    const rect = canvas.getBoundingClientRect()
    canvas.width = rect.width * dpr
    canvas.height = rect.height * dpr
    ctx.scale(dpr, dpr)

    const width = rect.width
    const chartHeight = rect.height
    const padding = { top: 20, right: 60, bottom: 30, left: 20 }
    const chartWidth = width - padding.left - padding.right
    const innerHeight = chartHeight - padding.top - padding.bottom

    // 清空画布
    ctx.clearRect(0, 0, width, chartHeight)

    // 计算数据范围
    const values = data.map((d) => d.cumulativePnl)
    const minValue = Math.min(...values, 0)
    const maxValue = Math.max(...values, 0)
    const range = maxValue - minValue || 1

    // 绘制网格线和刻度
    const gridColor = theme === 'dark' ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'
    const textColor = theme === 'dark' ? 'rgba(255, 255, 255, 0.5)' : 'rgba(0, 0, 0, 0.5)'

    ctx.strokeStyle = gridColor
    ctx.lineWidth = 1
    ctx.font = '11px sans-serif'
    ctx.fillStyle = textColor
    ctx.textAlign = 'right'

    // 水平网格线
    const gridLines = 5
    for (let i = 0; i <= gridLines; i++) {
      const y = padding.top + (innerHeight / gridLines) * i
      const value = maxValue - (range / gridLines) * i

      ctx.beginPath()
      ctx.moveTo(padding.left, y)
      ctx.lineTo(width - padding.right, y)
      ctx.stroke()

      ctx.fillText(formatCurrency(value), width - 5, y + 4)
    }

    // 绘制零线
    if (minValue < 0 && maxValue > 0) {
      const zeroY = padding.top + (maxValue / range) * innerHeight
      ctx.strokeStyle = theme === 'dark' ? 'rgba(255, 255, 255, 0.3)' : 'rgba(0, 0, 0, 0.3)'
      ctx.setLineDash([4, 4])
      ctx.beginPath()
      ctx.moveTo(padding.left, zeroY)
      ctx.lineTo(width - padding.right, zeroY)
      ctx.stroke()
      ctx.setLineDash([])
    }

    // 绘制折线
    const stepX = chartWidth / (data.length - 1 || 1)

    // 创建渐变
    const gradient = ctx.createLinearGradient(0, padding.top, 0, chartHeight - padding.bottom)
    const isPositive = data[data.length - 1]?.cumulativePnl >= 0
    if (isPositive) {
      gradient.addColorStop(0, 'rgba(16, 185, 129, 0.3)')
      gradient.addColorStop(1, 'rgba(16, 185, 129, 0)')
    } else {
      gradient.addColorStop(0, 'rgba(239, 68, 68, 0)')
      gradient.addColorStop(1, 'rgba(239, 68, 68, 0.3)')
    }

    // 绘制面积
    ctx.beginPath()
    ctx.moveTo(padding.left, chartHeight - padding.bottom)
    data.forEach((point, index) => {
      const x = padding.left + stepX * index
      const y = padding.top + ((maxValue - point.cumulativePnl) / range) * innerHeight
      ctx.lineTo(x, y)
    })
    ctx.lineTo(padding.left + stepX * (data.length - 1), chartHeight - padding.bottom)
    ctx.closePath()
    ctx.fillStyle = gradient
    ctx.fill()

    // 绘制折线
    ctx.beginPath()
    ctx.strokeStyle = isPositive ? '#10b981' : '#ef4444'
    ctx.lineWidth = 2
    data.forEach((point, index) => {
      const x = padding.left + stepX * index
      const y = padding.top + ((maxValue - point.cumulativePnl) / range) * innerHeight
      if (index === 0) {
        ctx.moveTo(x, y)
      } else {
        ctx.lineTo(x, y)
      }
    })
    ctx.stroke()

    // 绘制日期标签
    ctx.fillStyle = textColor
    ctx.textAlign = 'center'
    const labelStep = Math.ceil(data.length / 6)
    data.forEach((point, index) => {
      if (index % labelStep === 0 || index === data.length - 1) {
        const x = padding.left + stepX * index
        ctx.fillText(point.date, x, chartHeight - 10)
      }
    })
  }, [data, theme])

  if (isLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height }}>
        <Spin />
      </div>
    )
  }

  if (error || !data || data.length === 0) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height }}>
        <Empty description="暂无数据" />
      </div>
    )
  }

  return (
    <canvas
      ref={canvasRef}
      style={{ width: '100%', height }}
    />
  )
}
