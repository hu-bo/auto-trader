import React, { useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
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
import { useAuth, useNavigateKeepParams } from '@/hooks'
import { useAppStore } from '@/stores/appStore'
import { exchangeApi } from '@/api'
import { Exchange } from '@/types'

const { Header: SemiHeader } = Layout

interface HeaderProps {
  onToggleSidebar?: () => void
}
const defalutExchanges: Exchange[] = [
  {
    id: '1',
    name: 'Binance',
    exchangeType: 'binance' as const,
    isTestnet: false,
    isActive: true,
    userId: '',
  },
  {
    id: '2',
    name: 'OKX',
    exchangeType: 'okx' as const,
    isTestnet: false,
    isActive: true,
    userId: '',
  }
]
export const Header: React.FC<HeaderProps> = ({ onToggleSidebar }) => {
  const navigate = useNavigateKeepParams()
  const [searchParams, setSearchParams] = useSearchParams()
  const { user, logout } = useAuth()
  const { theme, toggleTheme, selectedExchange, setSelectedExchange } = useAppStore()
  const [exchangeOptions, setExchangeOptions] = React.useState<Exchange[]>(defalutExchanges)
  const { data: exchanges } = useQuery({
    queryKey: ['exchanges'],
    queryFn: exchangeApi.list,
  })

  // On mount: sync URL query -> store (if URL has exchangeId and store doesn't match)
  useEffect(() => {
    if (!exchanges?.length) {
      setSelectedExchange(defalutExchanges[0])
      setSearchParams((prev) => {
        prev.set('exchangeId', defalutExchanges[0].id)
        prev.set('exchangeType', defalutExchanges[0].exchangeType)
        return prev
      }, { replace: true })
      return
    }
    const urlExchangeId = searchParams.get('exchangeId')
    if (urlExchangeId && urlExchangeId !== selectedExchange?.id) {
      const found = exchanges.find((e) => e.id === urlExchangeId)
      if (found) {
        setSelectedExchange(found)
      }
    } else if (!urlExchangeId && selectedExchange) {
      // Store has selection but URL doesn't — sync URL
      setSearchParams((prev) => {
        prev.set('exchangeId', selectedExchange.id)
        prev.set('exchangeType', selectedExchange.exchangeType)
        return prev
      }, { replace: true })
    }
    setExchangeOptions(exchanges)
  }, [exchanges])

  const handleExchangeChange = (value: string | number | any[] | Record<string, any> | undefined) => {
    const exchange = exchangeOptions?.find((e) => e.id === value)
    if (exchange) {
      setSelectedExchange(exchange)
      setSearchParams((prev) => {
        prev.set('exchangeId', exchange.id)
        return prev
      }, { replace: true })
    }
  }

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
        <Select
          value={selectedExchange?.id}
          onChange={handleExchangeChange}
          placeholder="选择交易所"
          style={{ width: 240 }}
          prefix={<IconComponent />}
          optionList={exchangeOptions.map((e) => ({
            value: e.id,
            label: (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span>{e.exchangeType} ({e.name})</span>
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
              {user?.displayname?.[0] || user?.username?.[0] || 'U'}
            </Avatar>
            <span style={{ fontSize: 14 }}>{user?.displayname || user?.username}</span>
          </div>
        </Dropdown>
      </div>
    </SemiHeader>
  )
}
