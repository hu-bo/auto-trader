import React from 'react'
import { Layout, Avatar, Dropdown, Button, Select, Tag } from '@douyinfe/semi-ui-19'
import {
  IconMenu,
  IconUser,
  IconSetting,
  IconExit,
  IconMoon,
  IconSun,
  IconComponent,
} from '@douyinfe/semi-icons'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@/hooks'
import { useAppStore } from '@/stores/appStore'
import { exchangeApi } from '@/api'
import type { Exchange } from '@/types'

const { Header: SemiHeader } = Layout

interface HeaderProps {
  onToggleSidebar?: () => void
}

export const Header: React.FC<HeaderProps> = ({ onToggleSidebar }) => {
  const { user, logout } = useAuth()
  const { theme, toggleTheme, selectedExchange, setSelectedExchange } = useAppStore()

  const { data: exchanges } = useQuery({
    queryKey: ['exchanges'],
    queryFn: exchangeApi.list,
  })

  const handleExchangeChange = (value: string | number | any[] | Record<string, any> | undefined) => {
    const exchange = exchanges?.find((e) => e.id === value)
    if (exchange) {
      setSelectedExchange(exchange)
    }
  }

  const userMenu = (
    <Dropdown.Menu>
      <Dropdown.Item icon={<IconUser />}>个人信息</Dropdown.Item>
      <Dropdown.Item icon={<IconSetting />}>设置</Dropdown.Item>
      <Dropdown.Divider />
      <Dropdown.Item icon={<IconExit />} onClick={logout}>
        退出登录
      </Dropdown.Item>
    </Dropdown.Menu>
  )

  return (
    <SemiHeader
      style={{
        height: 56,
        padding: '0 24px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        background: 'var(--bg-1)',
        borderBottom: '1px solid var(--border-color)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <Button
          icon={<IconMenu />}
          theme="borderless"
          onClick={onToggleSidebar}
        />

        {/* 交易所选择器 */}
        <Select
          value={selectedExchange?.id}
          onChange={handleExchangeChange}
          placeholder="选择交易所"
          style={{ width: 200 }}
          prefix={<IconComponent />}
          optionList={exchanges?.map((e: Exchange) => ({
            value: e.id,
            label: (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span>{e.name}</span>
                <Tag size="small" color={e.isTestnet ? 'orange' : 'green'}>
                  {e.isTestnet ? '测试网' : '主网'}
                </Tag>
              </div>
            ),
          }))}
        />
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        {/* 主题切换 */}
        <Button
          icon={theme === 'dark' ? <IconSun /> : <IconMoon />}
          theme="borderless"
          onClick={toggleTheme}
        />

        {/* 用户菜单 */}
        <Dropdown
          trigger="click"
          position="bottomRight"
          render={userMenu}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              cursor: 'pointer',
              padding: '4px 8px',
              borderRadius: 8,
            }}
          >
            <Avatar size="small" style={{ background: 'var(--semi-color-primary)' }}>
              {user?.displayName?.[0] || user?.username?.[0] || 'U'}
            </Avatar>
            <span style={{ fontSize: 14 }}>{user?.displayName || user?.username}</span>
          </div>
        </Dropdown>
      </div>
    </SemiHeader>
  )
}
