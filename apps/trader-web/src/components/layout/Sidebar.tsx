import React from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { Layout, Nav } from '@douyinfe/semi-ui-19'
import {
  IconHome,
  IconLineChartStroked,
  IconGridStroked,
  IconHistogram,
  IconSetting,
  IconPulse,
  IconList,
  IconUserGroup,
  IconServer,
  IconCode,
  IconCopyStroked,
} from '@douyinfe/semi-icons'
import { useAuthStore } from '@/stores/authStore'

const { Sider } = Layout

interface SidebarProps {
  collapsed?: boolean
}

const menuItems = [
  { itemKey: '/dashboard', text: '仪表盘', icon: <IconHome /> },
  { itemKey: '/market', text: '行情', icon: <IconLineChartStroked /> },
  { itemKey: '/trading/BTC-USDT', text: '交易', icon: <IconPulse /> },
  { itemKey: '/positions', text: '持仓', icon: <IconPulse /> },
  { itemKey: '/orders', text: '订单', icon: <IconList /> },
  { itemKey: '/strategy-orders', text: '策略运行', icon: <IconGridStroked /> },
  { itemKey: '/batch-trading', text: '批量交易', icon: <IconCopyStroked /> },
  { itemKey: '/strategy-debugger', text: '策略调试', icon: <IconCode /> },
  { itemKey: '/exchanges', text: '交易所', icon: <IconServer /> },
  { itemKey: '/settings', text: '设置', icon: <IconSetting /> },
]

const adminMenuItems = [
  { itemKey: '/admin/users', text: '用户管理', icon: <IconUserGroup /> },
  { itemKey: '/admin/strategy-library', text: '策略库', icon: <IconServer /> },
]

export const Sidebar: React.FC<SidebarProps> = ({ collapsed = false }) => {
  const navigate = useNavigate()
  const location = useLocation()
  const { user } = useAuthStore()

  const isAdmin = user?.role === 'admin'

  const handleSelect = (data: { itemKey?: string | number }) => {
    if (data.itemKey) {
      navigate(data.itemKey as string)
    }
  }

  const items = isAdmin
    ? [...menuItems, { itemKey: 'admin', text: '管理后台', icon: <IconUserGroup />, items: adminMenuItems }]
    : menuItems

  return (
    <Sider
      style={{
        background: 'var(--bg-1)',
        borderRight: '1px solid var(--border-color)',
      }}
    >
      <div
        style={{
          height: 56,
          display: 'flex',
          alignItems: 'center',
          justifyContent: collapsed ? 'center' : 'flex-start',
          padding: collapsed ? 0 : '0 24px',
          borderBottom: '1px solid var(--border-color)',
        }}
      >
        {collapsed ? (
          <span style={{ fontSize: 24, fontWeight: 'bold' }}>H</span>
        ) : (
          <span style={{ fontSize: 18, fontWeight: 'bold', letterSpacing: 1 }}>
            HQuant
          </span>
        )}
      </div>

      <Nav
        isCollapsed={collapsed}
        selectedKeys={[location.pathname]}
        onSelect={handleSelect}
        style={{
          height: 'calc(100% - 56px)',
        }}
        items={items}
        footer={{
          collapseButton: false,
        }}
      />
    </Sider>
  )
}
