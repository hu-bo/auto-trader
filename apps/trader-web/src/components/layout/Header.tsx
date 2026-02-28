import React from 'react'
import { useNavigate } from 'react-router-dom'
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
const exchanges = [
    // {
    //     "id": 4,
    //     "exchangeType": "BINANCE",
    //     "name": "币安",
    //     "isTestnet": true,
    //     "isActive": true,
    // },
    // {
    //     "id": 3,
    //     "exchangeType": "BINANCE",
    //     "name": "币安",
    //     "isTestnet": true,
    // },
    {
        "id": 2,
        "exchangeType": "OKX",
        "name": "欧易",
        "isTestnet": false,
        "isActive": true,
    },
    {
        "id": 1,
        "exchangeType": "BINANCE",
        "name": "币安",
        "isTestnet": false,
    }
]
export const Header: React.FC<HeaderProps> = ({ onToggleSidebar }) => {
  const navigate = useNavigate()
  const { user, logout } = useAuth()
  const { theme, toggleTheme, selectedExchange, setSelectedExchange } = useAppStore()

  // const handleExchangeChange = (value: string | number | any[] | Record<string, any> | undefined) => {
  //   const exchange = exchanges?.find((e) => e.id === value)
  //   if (exchange) {
  //     setSelectedExchange(exchange)
  //   }
  // }

  const userMenu = (
    <Dropdown.Menu>
      <Dropdown.Item icon={<IconUser />} onClick={() => navigate('/settings')}>个人信息</Dropdown.Item>
      <Dropdown.Item icon={<IconSetting />} onClick={() => navigate('/settings')}>设置</Dropdown.Item>
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
        {/* <Select
          value={selectedExchange?.id}
          onChange={handleExchangeChange}
          placeholder="选择交易所"
          style={{ width: 200 }}
          prefix={<IconComponent />}
          optionList={exchanges.map((e) => ({
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
        /> */}
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
              {user?.displayname?.[0] || user?.username?.[0] || 'U'}
            </Avatar>
            <span style={{ fontSize: 14 }}>{user?.displayname || user?.username}</span>
          </div>
        </Dropdown>
      </div>
    </SemiHeader>
  )
}
