import React, { useEffect, useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Typography } from '@douyinfe/semi-ui-19'
import { IconCheckboxTick, IconClose } from '@douyinfe/semi-icons'
import { Loading } from '@/components/common'
import { useAuth } from '@/hooks'

const { Title, Text } = Typography

const Callback: React.FC = () => {
  const navigate = useNavigate()
  const { handleCallback } = useAuth()
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')
  const [errorMessage, setErrorMessage] = useState('')
  const hasHandledCallback = useRef(false)

  useEffect(() => {
    if (hasHandledCallback.current) return
    hasHandledCallback.current = true

    handleCallback().then((success) => {
      if (success) {
        setStatus('success')
      } else {
        setStatus('error')
        setErrorMessage('登录失败，请重试')
        setTimeout(() => navigate('/login'), 3000)
      }
    })
  }, [handleCallback, navigate])

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #0a0a0f 0%, #1a1a24 50%, #12121a 100%)',
      }}
    >
      <div style={{ textAlign: 'center' }}>
        {status === 'loading' && (
          <>
            <Loading size="large" tip="" />
            <Title heading={4} style={{ marginTop: 24 }}>
              正在登录...
            </Title>
            <Text type="tertiary">请稍候，正在验证您的身份</Text>
          </>
        )}

        {status === 'success' && (
          <>
            <IconCheckboxTick
              size="extra-large"
              style={{ color: 'var(--semi-color-success)', fontSize: 64 }}
            />
            <Title heading={4} style={{ marginTop: 24 }}>
              登录成功
            </Title>
            <Text type="tertiary">正在跳转到控制台...</Text>
          </>
        )}

        {status === 'error' && (
          <>
            <div
              style={{
                width: 64,
                height: 64,
                borderRadius: '50%',
                background: 'var(--semi-color-danger-light-default)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto',
              }}
            >
              <IconClose size="extra-large" style={{ color: 'var(--semi-color-danger)' }} />
            </div>
            <Title heading={4} style={{ marginTop: 24 }}>
              登录失败
            </Title>
            <Text type="tertiary">{errorMessage}</Text>
            <Text
              type="quaternary"
              style={{ display: 'block', marginTop: 16 }}
            >
              3秒后自动跳转到登录页...
            </Text>
          </>
        )}
      </div>
    </div>
  )
}

export default Callback
