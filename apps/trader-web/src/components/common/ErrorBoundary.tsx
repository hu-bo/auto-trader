import React, { Component, ErrorInfo, ReactNode } from 'react'
import { Button, Empty } from '@douyinfe/semi-ui-19'
import { IconRefresh } from '@douyinfe/semi-icons'

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo)
  }

  private handleRetry = () => {
    this.setState({ hasError: false, error: null })
  }

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback
      }

      return (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100%',
            minHeight: 300,
            padding: 24,
          }}
        >
          <Empty
            title="出错了"
            description={
              <div style={{ maxWidth: 400 }}>
                <p style={{ marginBottom: 16 }}>
                  页面加载时发生错误，请尝试刷新页面。
                </p>
                {import.meta.env.DEV && this.state.error && (
                  <pre
                    style={{
                      padding: 12,
                      background: 'var(--bg-2)',
                      borderRadius: 8,
                      fontSize: 12,
                      overflow: 'auto',
                      textAlign: 'left',
                    }}
                  >
                    {this.state.error.message}
                  </pre>
                )}
              </div>
            }
          />
          <Button
            icon={<IconRefresh />}
            theme="solid"
            onClick={this.handleRetry}
            style={{ marginTop: 16 }}
          >
            重试
          </Button>
        </div>
      )
    }

    return this.props.children
  }
}
