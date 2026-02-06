import axios, { AxiosInstance, AxiosError, InternalAxiosRequestConfig } from 'axios'
import { Notification } from '@douyinfe/semi-ui-19'
import { TokenStorage } from '@hquant/casdoor/client'
import type { ApiResponse } from '@/types'

// 复用与 CasdoorProvider 相同的 storage 配置读取 token
const tokenStorage = new TokenStorage({ type: 'localStorage', prefix: 'hquant_casdoor_' })

// 创建 axios 实例
const api: AxiosInstance = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api/v1',
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
})

// 请求拦截器
api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = tokenStorage.getAccessToken()
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => Promise.reject(error)
)

// 响应拦截器
api.interceptors.response.use(
  (response) => {
    // 返回完整的 ApiResponse，包含 code, message, data
    const data = response.data as ApiResponse<unknown>

    // 检查业务错误码
    if (data.code !== 0) {
      Notification.error({content: data.message || '请求失败'})
      return Promise.reject(new Error(data.message))
    }

    // 保持 AxiosResponse 结构，但 data 字段是完整的 ApiResponse
    return response
  },
  async (error: AxiosError<ApiResponse<unknown>>) => {
    const status = error.response?.status
    const message = error.response?.data?.message || error.message

    if (status === 401) {
      // Token 过期或无效 — casdoor 层会处理 token 刷新/清除
    } else if (status === 403) {
      Notification.error({content: '没有权限执行此操作'})
    } else if (status === 404) {
      Notification.error({content: '请求的资源不存在'})
    } else {
      Notification.error({content: message || '服务错误'})
    }

    return Promise.reject(error)
  }
)

export default api

// 封装请求方法 - 所有方法返回 ApiResponse<T> 格式
export const request = {
  async get<T>(url: string, params?: Record<string, unknown>): Promise<ApiResponse<T>> {
    const response = await api.get(url, { params })
    return response.data as ApiResponse<T>
  },

  async post<T>(url: string, data?: unknown): Promise<ApiResponse<T>> {
    const response = await api.post(url, data)
    return response.data as ApiResponse<T>
  },

  async put<T>(url: string, data?: unknown): Promise<ApiResponse<T>> {
    const response = await api.put(url, data)
    return response.data as ApiResponse<T>
  },

  async delete<T>(url: string, params?: Record<string, unknown>): Promise<ApiResponse<T>> {
    const response = await api.delete(url, { params })
    return response.data as ApiResponse<T>
  },

  async patch<T>(url: string, data?: unknown): Promise<ApiResponse<T>> {
    const response = await api.patch(url, data)
    return response.data as ApiResponse<T>
  },
}

// 便捷方法 - 直接返回 data 字段，用于 React Query 等场景
export const requestData = {
  async get<T>(url: string, params?: Record<string, unknown>): Promise<T> {
    const response = await request.get<T>(url, params)
    return response.data as T
  },

  async post<T>(url: string, data?: unknown): Promise<T> {
    const response = await request.post<T>(url, data)
    return response.data as T
  },

  async put<T>(url: string, data?: unknown): Promise<T> {
    const response = await request.put<T>(url, data)
    return response.data as T
  },

  async delete<T>(url: string, params?: Record<string, unknown>): Promise<T> {
    const response = await request.delete<T>(url, params)
    return response.data as T
  },

  async patch<T>(url: string, data?: unknown): Promise<T> {
    const response = await request.patch<T>(url, data)
    return response.data as T
  },
}
