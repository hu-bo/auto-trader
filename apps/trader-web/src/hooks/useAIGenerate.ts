import { useState, useCallback, useRef } from 'react'
import { streamAIGenerate } from '@/api/ai'
import type { AIMessage } from '@/types'

interface UseAIGenerateOptions {
  onCodeGenerated?: (code: string) => void
}

export function useAIGenerate(options?: UseAIGenerateOptions) {
  const [messages, setMessages] = useState<AIMessage[]>([])
  const [isGenerating, setIsGenerating] = useState(false)
  const [streamedText, setStreamedText] = useState('')
  const abortRef = useRef<AbortController | null>(null)

  const generate = useCallback(
    (message: string, codeContext?: string, systemPrompt?: string) => {
      const userMsg: AIMessage = {
        id: `user-${Date.now()}`,
        role: 'user',
        content: message,
        timestamp: Date.now(),
      }
      setMessages(prev => [...prev, userMsg])
      setIsGenerating(true)
      setStreamedText('')

      let accumulated = ''

      abortRef.current = streamAIGenerate(
        { message, codeContext: codeContext || null, systemPrompt: systemPrompt || null },
        {
          onChunk: (text) => {
            accumulated += text
            setStreamedText(accumulated)
          },
          onDone: () => {
            const assistantMsg: AIMessage = {
              id: `assistant-${Date.now()}`,
              role: 'assistant',
              content: accumulated,
              timestamp: Date.now(),
            }
            setMessages(prev => [...prev, assistantMsg])
            setIsGenerating(false)
            setStreamedText('')
            options?.onCodeGenerated?.(accumulated)
          },
          onError: (error) => {
            const errorMsg: AIMessage = {
              id: `assistant-${Date.now()}`,
              role: 'assistant',
              content: `Error: ${error.message}`,
              timestamp: Date.now(),
            }
            setMessages(prev => [...prev, errorMsg])
            setIsGenerating(false)
            setStreamedText('')
          },
        }
      )
    },
    [options]
  )

  const stop = useCallback(() => {
    abortRef.current?.abort()
    if (streamedText) {
      const assistantMsg: AIMessage = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: streamedText + '\n\n[Stopped]',
        timestamp: Date.now(),
      }
      setMessages(prev => [...prev, assistantMsg])
    }
    setIsGenerating(false)
    setStreamedText('')
  }, [streamedText])

  const clearMessages = useCallback(() => {
    setMessages([])
  }, [])

  return {
    messages,
    isGenerating,
    streamedText,
    generate,
    stop,
    clearMessages,
  }
}
