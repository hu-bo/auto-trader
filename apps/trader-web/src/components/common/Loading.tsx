import React from 'react'
import { Spin } from '@douyinfe/semi-ui-19'

interface LoadingProps {
  size?: 'small' | 'middle' | 'large'
  tip?: string
  fullscreen?: boolean
}

export const Loading: React.FC<LoadingProps> = ({
  size = 'large',
  tip = '加载中...',
  fullscreen = false,
}) => {
  const content = (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 16,
        padding: 24,
      }}
    >
      <Spin size={size} />
      {tip && <span style={{ color: 'var(--text-2)' }}>{tip}</span>}
    </div>
  )

  if (fullscreen) {
    return (
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'var(--bg-0)',
          zIndex: 9999,
        }}
      >
        {content}
      </div>
    )
  }

  return content
}
