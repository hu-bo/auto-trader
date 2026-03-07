import { requestData } from './api'
import type { RiskConfig, RiskConfigPreset } from '@/types'

type RiskConfigPresetServer = {
  id: string
  name: string
  riskConfig: RiskConfig
  createdAt: string
  updatedAt: string
}

const toPreset = (item: RiskConfigPresetServer): RiskConfigPreset => ({
  id: item.id,
  name: item.name,
  riskConfig: item.riskConfig ?? {},
  createdAt: item.createdAt,
  updatedAt: item.updatedAt,
})

type RiskConfigPresetPayload = {
  name: string
  riskConfig: RiskConfig
}

type RiskConfigPresetUpdatePayload = {
  name?: string
  riskConfig?: RiskConfig
}

export const riskConfigApi = {
  list: async (): Promise<RiskConfigPreset[]> => {
    const data = await requestData.get<RiskConfigPresetServer[]>('/risk-config')
    return data.map(toPreset)
  },

  get: async (id: string): Promise<RiskConfigPreset> => {
    const data = await requestData.get<RiskConfigPresetServer>(`/risk-config/${id}`)
    return toPreset(data)
  },

  create: async (payload: RiskConfigPresetPayload): Promise<RiskConfigPreset> => {
    const data = await requestData.post<RiskConfigPresetServer>('/risk-config', {
      name: payload.name,
      riskConfig: payload.riskConfig ?? {},
    })
    return toPreset(data)
  },

  update: async (id: string, payload: RiskConfigPresetUpdatePayload): Promise<RiskConfigPreset> => {
    const data = await requestData.put<RiskConfigPresetServer>(`/risk-config/${id}`, {
      name: payload.name,
      riskConfig: payload.riskConfig,
    })
    return toPreset(data)
  },

  delete: (id: string) => requestData.delete<null>(`/risk-config/${id}`),
}
