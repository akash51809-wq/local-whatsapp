import React from 'react'
import { Outlet } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import Toast from '../common/Toast'
import Navbar from './Navbar'
import Sidebar from './Sidebar'

export function Layout() {
  const { sidebarOpen, toast, error, setError } = useAuth()

  return (
    <div className={`app-container ${sidebarOpen ? 'sidebar-open' : ''}`}>
      <div className="page">
        <div className="page-main">
          <Sidebar />
          <div className="app-content">
            <div className="side-app">
              <Navbar />
              <Toast toast={toast} error={error} onClearError={() => setError('')} />
              <Outlet />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Layout
