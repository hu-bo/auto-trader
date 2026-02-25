import { TokenStorage } from '@hquant/casdoor/client'
import type { AIGenerateRequest } from '@/types'

const tokenStorage = new TokenStorage({ type: 'localStorage', prefix: 'hquant_casdoor_' })

interface StreamOptions {
  onChunk: (text: string) => void
  onDone: () => void
  onError: (error: Error) => void
}

export function streamAIGenerate(
  params: AIGenerateRequest,
  options: StreamOptions
): AbortController {
  const controller = new AbortController()
  const baseURL = import.meta.env.VITE_API_BASE_URL || '/api/v1'

  ;(async () => {
    try {
      const token = tokenStorage.getAccessToken()
      const response = await fetch(`${baseURL}/ai/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(params),
        signal: controller.signal,
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const reader = response.body?.getReader()
      if (!reader) {
        throw new Error('No readable stream')
      }

      const decoder = new TextDecoder()
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        const text = decoder.decode(value, { stream: true })
        options.onChunk(text)
      }

      options.onDone()
    } catch (err) {
      if ((err as Error).name === 'AbortError') return
      options.onError(err instanceof Error ? err : new Error(String(err)))
    }
  })()

  return controller
}
