export * from './auth'
export * from './exchange'
export * from './strategy'
export * from './order'
export * from './position'
export * from './stats'
export * from './ai'

// 通用 API 响应类型
export interface ApiResponse<T> {
  code: number
  message: string
  data: T | null
}

// 分页参数
export interface PaginationParams {
  page?: number
  pageSize?: number
  limit?: number
  offset?: number
}

// 分页响应
export interface PaginatedResponse<T> {
  items: T[]
  total: number
  page: number
  pageSize: number
}

// 通用选项类型
export interface SelectOption {
  value: string
  label: string
}
