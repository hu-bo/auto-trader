import React, { useState, useCallback, useRef, useEffect } from 'react'
import { Button, TextArea, Typography, Empty, Tooltip } from '@douyinfe/semi-ui-19'
import { IconSend, IconDelete, IconStop, IconChevronRight, IconStar } from '@douyinfe/semi-icons'
import { StrategyEditor } from './StrategyEditor'
import { useAIGenerate } from '@/hooks/useAIGenerate'
import type { AIMessage } from '@/types'
import './ai-editor.css'

const { Text } = Typography

interface AIEditorProps {
  value?: string
  onChange?: (value: string) => void
  height?: string | number
  readOnly?: boolean
  showMaximize?: boolean
  systemPrompt?: string
  defaultPanelOpen?: boolean
}

export const AIEditor: React.FC<AIEditorProps> = ({
  value = '',
  onChange,
  height = 400,
  readOnly = false,
  showMaximize = true,
  systemPrompt,
  defaultPanelOpen = false,
}) => {
  const [panelOpen, setPanelOpen] = useState(defaultPanelOpen)
  const [input, setInput] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const handleCodeGenerated = useCallback(
    (code: string) => {
      onChange?.(code)
    },
    [onChange]
  )

  const { messages, isGenerating, streamedText, generate, stop, clearMessages } =
    useAIGenerate({ onCodeGenerated: handleCodeGenerated })

  const handleSend = useCallback(() => {
    const trimmed = input.trim()
    if (!trimmed || isGenerating) return
    generate(trimmed, value || undefined, systemPrompt)
    setInput('')
  }, [input, isGenerating, generate, value, systemPrompt])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault()
        handleSend()
      }
    },
    [handleSend]
  )

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, streamedText])

  const containerHeight = typeof height === 'number' ? `${height}px` : height

  return (
    <div className="ai-editor" style={{ height: containerHeight }}>
      <div className="ai-editor__main">
        <StrategyEditor
          value={value}
          onChange={onChange}
          height="100%"
          readOnly={readOnly}
          showMaximize={showMaximize}
        />
      </div>

      <div className="ai-editor__toggle">
        <Tooltip content={panelOpen ? '收起 AI 面板' : '展开 AI 面板'} position="left">
          <Button
            icon={panelOpen ? <IconChevronRight /> : <IconStar />}
            size="small"
            theme="borderless"
            onClick={() => setPanelOpen(!panelOpen)}
          />
        </Tooltip>
      </div>

      {panelOpen && (
        <div className="ai-editor__panel">
          <div className="ai-editor__panel-header">
            <Text strong>AI 助手</Text>
            <div className="ai-editor__panel-actions">
              <Tooltip content="清空对话">
                <Button
                  icon={<IconDelete />}
                  size="small"
                  theme="borderless"
                  onClick={clearMessages}
                  disabled={isGenerating}
                />
              </Tooltip>
              <Tooltip content="收起">
                <Button
                  icon={<IconChevronRight />}
                  size="small"
                  theme="borderless"
                  onClick={() => setPanelOpen(false)}
                />
              </Tooltip>
            </div>
          </div>

          <div className="ai-editor__messages">
            {messages.length === 0 && !isGenerating && (
              <Empty
                description="用自然语言描述你的策略，AI 将生成 HQuant DSL 代码"
                style={{ marginTop: 40 }}
              />
            )}
            {messages.map((msg: AIMessage) => (
              <div key={msg.id} className={`ai-editor__message ai-editor__message--${msg.role}`}>
                <div className="ai-editor__message-bubble">
                  <pre className="ai-editor__message-text">{msg.content}</pre>
                </div>
              </div>
            ))}
            {isGenerating && streamedText && (
              <div className="ai-editor__message ai-editor__message--assistant">
                <div className="ai-editor__message-bubble">
                  <pre className="ai-editor__message-text">{streamedText}</pre>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          <div className="ai-editor__input">
            <TextArea
              value={input}
              onChange={(val) => setInput(val)}
              onKeyDown={handleKeyDown}
              placeholder="描述你的策略... (Ctrl+Enter 发送)"
              autosize={{ minRows: 2, maxRows: 4 }}
              disabled={isGenerating}
            />
            <div className="ai-editor__input-actions">
              {isGenerating ? (
                <Button
                  icon={<IconStop />}
                  size="small"
                  type="warning"
                  onClick={stop}
                >
                  停止
                </Button>
              ) : (
                <Button
                  icon={<IconSend />}
                  size="small"
                  type="primary"
                  onClick={handleSend}
                  disabled={!input.trim()}
                >
                  发送
                </Button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
