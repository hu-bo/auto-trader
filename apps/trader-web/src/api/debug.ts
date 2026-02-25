import { requestData } from './api'

export interface DebugBar {
  timestamp: number
  open: number
  high: number
  low: number
  close: number
  volume: number
  buy_volume: number
}

export interface DebugStep {
  index: number
  timestamp: number
  bar: DebugBar
  variables: Record<string, number | null>
  signal: string | null
  meta: string | null
}

export interface DebugResponse {
  variable_names: string[]
  steps: DebugStep[]
}

export interface DebugRequest {
  code: string
  bars: DebugBar[]
}

export const debugApi = {
  evaluate: (req: DebugRequest) =>
    requestData.post<DebugResponse>('/strategy-engine/debug/evaluate', req),
}
