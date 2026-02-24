import type { ClientConfig } from '@hquant/casdoor/client'
import { CasdoorClient } from '@hquant/casdoor/client'

/**
 * Casdoor 客户端配置
 */
export const casdoorConfig: ClientConfig = {
  endpoint: 'http://sso.8and1.cn',
  clientId: '7b474919541526399765',
  orgName: '8PLUS1',
  appName: '8PLUS1',
  redirectUri: `${window.location.origin}/callback`,
  logoutRedirectUri: `${window.location.origin}/login`,
  storage: {
    type: 'localStorage',
    prefix: 'hquant_casdoor_',
  },
  silentRefresh: true,
  refreshBeforeExpiry: 60,
}

// 创建一个临时客户端实例用于获取 URL（不会影响全局状态）
let _tempClient: CasdoorClient | null = null

function getTempClient(): CasdoorClient {
  if (!_tempClient) {
    _tempClient = new CasdoorClient(casdoorConfig)
  }
  return _tempClient
}

/**
 * 获取 Casdoor 登录 URL
 */
export function getCasdoorLoginUrl(): string {
  return getTempClient().getLoginUrl()
}

/**
 * 跳转到 Casdoor 登录页
 */
export function redirectToCasdoorLogin(): void {
  window.location.href = getCasdoorLoginUrl()
}
