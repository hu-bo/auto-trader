import React from 'react'
import { Outlet } from 'react-router-dom'
import { Layout } from '@douyinfe/semi-ui-19'
import { Header } from './Header'
import { Sidebar } from './Sidebar'
import { useAppStore } from '@/stores/appStore'

const { Content } = Layout

export const MainLayout: React.FC = () => {
  const { sidebarCollapsed, toggleSidebar } = useAppStore()

  return (
    <Layout style={{ height: '100vh' }}>
      <Sidebar collapsed={sidebarCollapsed} />
      <Layout>
        <Header onToggleSidebar={toggleSidebar} />
        <Content
          style={{
            padding: 24,
            background: 'var(--bg-0)',
            overflow: 'auto',
          }}
        >
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  )
}
