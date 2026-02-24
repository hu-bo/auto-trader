import { useCasdoorClient as useClient } from '@hquant/casdoor/client/react'

/**
 * 获取 Casdoor 客户端实例
 * 用于在非组件中访问 Casdoor 方法
 */
export function useCasdoorClient() {
  return useClient()
}
