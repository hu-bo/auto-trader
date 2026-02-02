import React, { useEffect, useState, useRef } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { Typography } from '@douyinfe/semi-ui-19'
import { IconCheckboxTick, IconClose } from '@douyinfe/semi-icons'
import { Loading } from '@/components/common'
import { useAuth } from '@/hooks'

const { Title, Text } = Typography

const Callback: React.FC = () => {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { handleCallback } = useAuth()
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')
  const [errorMessage, setErrorMessage] = useState('')
  const hasHandledCallback = useRef(false)

  useEffect(() => {
    // 防止重复执行（React StrictMode 和依赖变化都可能导致重复执行）
    if (hasHandledCallback.current) {
      return
    }

    const code = searchParams.get('code')
    const error = searchParams.get('error')
    const errorDescription = searchParams.get('error_description')

    if (error) {
      setStatus('error')
      setErrorMessage(errorDescription || error || '登录失败')
      setTimeout(() => navigate('/login'), 3000)
      return
    }

    if (!code) {
      setStatus('error')
      setErrorMessage('缺少授权码')
      setTimeout(() => navigate('/login'), 3000)
      return
    }

    // 标记为已处理，防止重复执行
    hasHandledCallback.current = true

    handleCallback(code).then((success) => {
      if (success) {
        setStatus('success')
      } else {
        setStatus('error')
        setErrorMessage('登录失败，请重试')
        setTimeout(() => navigate('/login'), 3000)
      }
    })
  }, [searchParams, handleCallback, navigate])

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
