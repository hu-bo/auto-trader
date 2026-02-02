import React, { useEffect, useRef } from 'react'
import { useAppStore } from '@/stores/appStore'

interface PieChartData {
  name: string
  value: number
  color?: string
}

interface PieChartProps {
  data: PieChartData[]
  size?: number
  innerRadius?: number
  showLegend?: boolean
}

const defaultColors = [
  '#6366f1',
  '#8b5cf6',
  '#ec4899',
  '#f43f5e',
  '#f97316',
  '#eab308',
  '#22c55e',
  '#14b8a6',
  '#06b6d4',
  '#3b82f6',
]

export const PieChart: React.FC<PieChartProps> = ({
  data,
  size = 200,
  innerRadius = 0.6,
  showLegend = true,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const { theme } = useAppStore()

  useEffect(() => {
    if (!canvasRef.current || data.length === 0) return

    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = window.devicePixelRatio || 1
    canvas.width = size * dpr
    canvas.height = size * dpr
    ctx.scale(dpr, dpr)

    ctx.clearRect(0, 0, size, size)

    const total = data.reduce((sum, item) => sum + item.value, 0)
    const centerX = size / 2
    const centerY = size / 2
    const outerRadius = size / 2 - 10
    const inner = outerRadius * innerRadius

    let startAngle = -Math.PI / 2

    data.forEach((item, index) => {
      const sliceAngle = (item.value / total) * 2 * Math.PI
      const endAngle = startAngle + sliceAngle

      ctx.beginPath()
      ctx.arc(centerX, centerY, outerRadius, startAngle, endAngle)
      ctx.arc(centerX, centerY, inner, endAngle, startAngle, true)
      ctx.closePath()

      ctx.fillStyle = item.color || defaultColors[index % defaultColors.length]
      ctx.fill()

      startAngle = endAngle
    })

    // 中心文字
    ctx.fillStyle = theme === 'dark' ? '#ffffff' : '#1f1f1f'
    ctx.font = 'bold 24px sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(total.toLocaleString(), centerX, centerY)
  }, [data, size, innerRadius, theme])

  if (data.length === 0) {
    return null
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
      <canvas ref={canvasRef} style={{ width: size, height: size }} />
      {showLegend && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {data.map((item, index) => (
            <div key={item.name} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div
                style={{
                  width: 12,
                  height: 12,
                  borderRadius: 2,
                  background: item.color || defaultColors[index % defaultColors.length],
                }}
              />
              <span style={{ color: 'var(--text-2)', fontSize: 13 }}>
                {item.name}: {item.value}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
