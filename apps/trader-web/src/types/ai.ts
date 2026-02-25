export interface AIGenerateRequest {
  message: string
  codeContext?: string | null
  systemPrompt?: string | null
}

export interface AIMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: number
}
