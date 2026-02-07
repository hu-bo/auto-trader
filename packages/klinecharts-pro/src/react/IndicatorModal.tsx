import React from 'react'
import { BUILT_IN_INDICATORS } from '../core/defaults'

export interface IndicatorModalProps {
  visible: boolean
  onClose: () => void
  theme: 'light' | 'dark' | string
  /** Current active main indicator (single select, null = none) */
  mainIndicator: string | null
  subIndicators: Set<string>
  onMainSelect: (name: string | null) => void
  onSubToggle: (name: string) => void
}

export function IndicatorModal({
  visible,
  onClose,
  theme,
  mainIndicator,
  subIndicators,
  onMainSelect,
  onSubToggle,
}: IndicatorModalProps): React.ReactElement | null {
  if (!visible) return null

  const isDark = theme === 'dark'
  const bg = isDark ? '#252525' : '#ffffff'
  const border = isDark ? '#3d3d3d' : '#e5e5e5'
  const text = isDark ? '#e5e5e5' : '#333333'
  const subText = isDark ? '#929aa5' : '#666666'

  return (
    <div
      className="klinecharts-pro-modal-overlay"
      style={{
        position: 'fixed', inset: 0,
        backgroundColor: 'rgba(0,0,0,0.5)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 2000,
      }}
      onClick={onClose}
    >
      <div
        className="klinecharts-pro-modal"
        style={{
          backgroundColor: bg, borderRadius: 8, width: 480,
          maxHeight: '80vh', overflow: 'hidden',
          boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{
          padding: '16px 20px', borderBottom: `1px solid ${border}`,
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <span style={{ fontSize: 16, fontWeight: 600, color: text }}>指标设置</span>
          <button onClick={onClose} style={{
            background: 'none', border: 'none', fontSize: 20,
            cursor: 'pointer', color: subText, padding: 4, lineHeight: 1,
          }}>×</button>
        </div>

        {/* Content */}
        <div style={{ padding: '16px 20px', maxHeight: '60vh', overflow: 'auto' }}>
          {/* Main indicators */}
          <div style={{ marginBottom: 20 }}>
            <div style={{
              fontSize: 14, fontWeight: 500, color: text, marginBottom: 12,
              display: 'flex', alignItems: 'center', gap: 8,
            }}>
              <span style={{ width: 4, height: 16, backgroundColor: '#1677ff', borderRadius: 2, display: 'inline-block' }} />
              主图指标
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
              {BUILT_IN_INDICATORS.main.map((name) => {
                const active = mainIndicator === name
                return (
                  <label key={name} style={{
                    display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px',
                    borderRadius: 6, cursor: 'pointer',
                    backgroundColor: active ? (isDark ? 'rgba(22,119,255,0.15)' : 'rgba(22,119,255,0.08)') : 'transparent',
                    border: `1px solid ${active ? '#1677ff' : border}`,
                    transition: 'all 0.2s',
                  }}>
                    <input type="radio" name="main-indicator" checked={active}
                      onChange={() => onMainSelect(active ? null : name)} style={{ accentColor: '#1677ff' }} />
                    <span style={{ fontSize: 13, color: text }}>{name}</span>
                  </label>
                )
              })}
            </div>
          </div>

          {/* Sub indicators */}
          <div>
            <div style={{
              fontSize: 14, fontWeight: 500, color: text, marginBottom: 12,
              display: 'flex', alignItems: 'center', gap: 8,
            }}>
              <span style={{ width: 4, height: 16, backgroundColor: '#52c41a', borderRadius: 2, display: 'inline-block' }} />
              副图指标
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
              {BUILT_IN_INDICATORS.sub.map((name) => {
                const active = subIndicators.has(name)
                return (
                  <label key={name} style={{
                    display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px',
                    borderRadius: 6, cursor: 'pointer',
                    backgroundColor: active ? (isDark ? 'rgba(82,196,26,0.15)' : 'rgba(82,196,26,0.08)') : 'transparent',
                    border: `1px solid ${active ? '#52c41a' : border}`,
                    transition: 'all 0.2s',
                  }}>
                    <input type="checkbox" checked={active}
                      onChange={() => onSubToggle(name)} style={{ accentColor: '#52c41a' }} />
                    <span style={{ fontSize: 13, color: text }}>{name}</span>
                  </label>
                )
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
