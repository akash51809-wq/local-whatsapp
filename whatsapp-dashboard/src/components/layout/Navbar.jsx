import React from 'react'
import { useLocation } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'

const pageMeta = {
  '/': { title: 'Dashboard', eyebrow: 'WHATSAPP AUTOMATION' },
  '/dashboard': { title: 'Dashboard', eyebrow: 'WHATSAPP AUTOMATION' },
  '/device': { title: 'Device', eyebrow: 'WHATSAPP SESSIONS' },
  '/send': { title: 'Send message', eyebrow: 'DIRECT & BULK MESSAGING' },
  '/groups': { title: 'Group', eyebrow: 'WHATSAPP GROUPS' },
  '/incoming': { title: 'Inbox', eyebrow: 'CONVERSATIONS' },
  '/chat': { title: 'Inbox', eyebrow: 'CONVERSATIONS' },
  '/report': { title: 'Msg Report', eyebrow: 'REPORTS' },
  '/reports': { title: 'Msg Report', eyebrow: 'REPORTS' },
  '/campaigns': { title: 'Campaigns', eyebrow: 'CAMPAIGN CENTER' },
  '/templates': { title: 'Templates', eyebrow: 'MESSAGE LIBRARY' },
  '/contacts': { title: 'Contacts', eyebrow: 'CONTACT MANAGEMENT' },
  '/plans': { title: 'Plans', eyebrow: 'PLANS' },
  '/subscription': { title: 'Plans', eyebrow: 'PLANS' },
  '/api': { title: 'API Docs', eyebrow: 'DEVELOPER' },
  '/settings': { title: 'Settings', eyebrow: 'SETTINGS' },
  '/admin': { title: 'User Management', eyebrow: 'SUPER ADMIN' },
  '/admin/plans': { title: 'Plan Management', eyebrow: 'SUPER ADMIN' },
  '/payment/daybook': { title: 'Purchase Requests', eyebrow: 'SUPER ADMIN' }
}

export function Navbar() {
  const {
    currentUser,
    isAdmin,
    loadStatus,
    loadQr,
    notify,
    logout,
    sidebarOpen,
    setSidebarOpen,
    planInfo
  } = useAuth()

  const location = useLocation()
  const meta = pageMeta[location.pathname] || { title: 'Dashboard', eyebrow: 'WHATSAPP AUTOMATION' }

  const username = currentUser?.name || currentUser?.username || 'Prince Goyal'
  const initials = username.replace(/[^a-zA-Z]/g, '').slice(0, 2).toUpperCase() || 'PG'
  const roleLabel = isAdmin ? 'Super Admin' : (planInfo?.planName || 'Standard User')

  return (
    <header className="topbar">
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <button 
          type="button"
          className="icon-btn mobile-menu-btn" 
          onClick={() => setSidebarOpen(!sidebarOpen)}
          aria-label="Toggle mobile menu"
          style={{ display: 'none' }}
        >
          ☰
        </button>
        <div className="topbar-title">
          <small>{meta.eyebrow}</small>
          <strong>{meta.title}</strong>
        </div>
      </div>

      <div className="top-actions">
        <button 
          type="button"
          className="icon-btn" 
          title="Search"
          aria-label="Search"
          onClick={() => notify('Search shortcut ready')}
        >
          ⌕
        </button>

        <button 
          type="button"
          className="icon-btn" 
          title="Status & Notifications"
          aria-label="Status & Notifications"
          onClick={() => {
            loadStatus()
            loadQr()
            notify('System status updated')
          }}
        >
          ♧
        </button>

        <div className="user" title={`Logged in as ${username}`}>
          <span className="avatar">{initials}</span>
          <div>
            <strong>{username}</strong>
            <small>{roleLabel}</small>
          </div>
        </div>

        <button 
          type="button"
          className="icon-btn" 
          title="Logout" 
          onClick={logout}
          style={{ color: '#e85b63' }}
          aria-label="Logout"
        >
          ⇥
        </button>
      </div>
    </header>
  )
}

export default Navbar
