import React from 'react'
import { Outlet } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import Toast from '../common/Toast'
import Navbar from './Navbar'
import Sidebar from './Sidebar'

export function Layout() {
  const { sidebarOpen, sidebarCollapsed, toast, error, setError, companySettings } = useAuth()

  return (
    <div className={`app ${sidebarOpen ? 'sidebar-open' : ''} ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
      <Sidebar />
      <main className="main">
        <Navbar />
        <Toast toast={toast} error={error} onClearError={() => setError('')} />
        <Outlet />
        <footer className="footer">
          © 2026 {companySettings?.companyName || "Easy Recharge Solution"} · WhatsApp Automation · All rights reserved.
        </footer>
      </main>
    </div>
  )
}

export default Layout
