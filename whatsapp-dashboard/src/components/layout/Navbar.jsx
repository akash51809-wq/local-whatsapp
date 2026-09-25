import React from 'react'
import { useLocation } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'

const pageTitles = {
  '/': 'Dashboard',
  '/dashboard': 'Dashboard',
  '/send': 'Send Message',
  '/groups': 'Groups Management',
  '/incoming': 'Incoming Messages',
  '/chat': 'Incoming Messages',
  '/report': 'Message Reports',
  '/reports': 'Message Reports',
  '/admin': 'User Management',
  '/admin/users': 'User Management',
  '/user': 'User Management',
  '/users': 'User Management',
  '/admin/plans': 'Plan Management',
  '/payment/daybook': 'Purchase Requests',
  '/admin/plan-requests': 'Purchase Requests',
  '/admin/purchases': 'Purchase Requests',
  '/plans': 'Pricing & Plans',
  '/subscription': 'Pricing & Plans',
  '/api': 'API & Webhook',
  '/system': 'System & Security',
  '/settings': 'Settings',
  '/admin/settings': 'Company Settings'
}

export function Navbar() {
  const {
    currentUser,
    isAdmin,
    status,
    theme,
    toggleTheme,
    loadStatus,
    loadQr,
    notify,
    logout,
    sidebarOpen,
    setSidebarOpen
  } = useAuth()

  const location = useLocation()
  const currentPath = location.pathname
  const pageTitle = (currentPath === '/settings')
    ? (isAdmin ? 'Company Settings' : 'System & Security')
    : (pageTitles[currentPath] || 'WhatsApp Dashboard')

  return (
    <header className="app-header header">
      <div className="header-left">
        <div className="app-sidebar__toggle" onClick={() => setSidebarOpen(!sidebarOpen)}>
          <a className="open-toggle" href="#toggle" onClick={e => e.preventDefault()}>
            <svg className="header-icon" xmlns="http://www.w3.org/2000/svg" height="24" viewBox="0 0 24 24" width="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="3" y1="12" x2="21" y2="12"></line>
              <line x1="3" y1="6" x2="21" y2="6"></line>
              <line x1="3" y1="18" x2="21" y2="18"></line>
            </svg>
          </a>
        </div>
        <div className="header-page-title">
          <h1>{pageTitle}</h1>
          <p>{isAdmin ? 'System Admin Control Center' : `Logged in as: ${currentUser?.username || currentUser?.mobile || 'User'}`}</p>
        </div>
      </div>

      <div className="header-right">
        <div className={`connection-pill ${status.status === 'connected' ? 'is-online' : status.status === 'connecting' ? 'is-connecting' : 'is-waiting'}`}>
          <span className="pill-dot"></span>
          <span>
            {status.status === 'connected' 
              ? `Connected (+${status.number || ''})` 
              : status.status === 'connecting' 
                ? 'Connecting...' 
                : 'Waiting for Scan'}
          </span>
        </div>

        <button 
          type="button"
          className="btn-header-action theme-toggle-btn" 
          onClick={() => {
            toggleTheme()
            notify(theme === 'dark' ? 'Light Mode सक्रिय (Light Theme Active) ☀️' : 'Dark Mode सक्रिय (Dark Theme Active) 🌙')
          }}
          title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} Mode`}
        >
          {theme === 'dark' ? '🌙 Dark' : '☀️ Light'}
        </button>

        <button 
          type="button"
          className="btn-header-action" 
          onClick={() => { loadStatus(); loadQr(); notify('Status refreshed') }}
          title="Refresh Status"
        >
          ↻ Refresh
        </button>

        <button 
          type="button"
          className="btn-header-action logout" 
          onClick={logout}
          title="Logout"
        >
          ⇥ Logout
        </button>
      </div>
    </header>
  )
}

export default Navbar
