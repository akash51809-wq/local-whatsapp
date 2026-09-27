import React, { useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'

export function Sidebar() {
  const {
    currentUser,
    isAdmin,
    status,
    stats,
    setSidebarOpen,
    sidebarCollapsed,
    toggleSidebarCollapsed,
    companySettings
  } = useAuth()

  const location = useLocation()
  const isReportsActive = location.pathname.startsWith('/report') || location.pathname === '/msg-report'
  const [reportsOpen, setReportsOpen] = useState(true)
  const closeMobile = () => setSidebarOpen(false)

  const isConnected = status?.status === 'connected'

  return (
    <aside className={`sidebar ${sidebarCollapsed ? 'collapsed' : ''}`}>
      {/* Collapse Toggle Button */}
      <button 
        type="button" 
        className="sidebar-collapse-btn" 
        onClick={toggleSidebarCollapsed} 
        title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
        aria-label="Toggle sidebar collapse"
      >
        {sidebarCollapsed ? '›' : '‹'}
      </button>

      {/* Brand Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
        <NavLink className="brand" to={isAdmin ? "/admin" : "/dashboard"} onClick={closeMobile} data-title={companySettings?.companyName || "Easy Recharge"}>
          {companySettings?.logoUrl ? (
            <img
              src={companySettings.logoUrl}
              alt={companySettings?.companyName || "Logo"}
              style={{ maxHeight: 38, maxWidth: 120, objectFit: 'contain' }}
            />
          ) : (
            <span className="brand-mark">⚡</span>
          )}
          <div>
            <strong>{companySettings?.companyName || "Easy Recharge"}</strong>
            <small>WhatsApp Automation</small>
          </div>
        </NavLink>
        <button 
          type="button" 
          className="mobile-close-btn" 
          onClick={closeMobile} 
          aria-label="Close sidebar"
          title="Close sidebar"
        >
          ×
        </button>
      </div>

      {/* Navigation */}
      <nav className="nav">
        <NavLink 
          to="/dashboard" 
          className={({ isActive }) => (isActive ? 'active' : '')} 
          onClick={closeMobile}
          data-title="Dashboard"
        >
          <span>⌂</span><b>Dashboard</b>
        </NavLink>

        <NavLink 
          to="/device" 
          className={({ isActive }) => (isActive ? 'active' : '')} 
          onClick={closeMobile}
          data-title="Device"
        >
          <span>▣</span><b>Device</b>
        </NavLink>

        <NavLink 
          to="/send" 
          className={({ isActive }) => (isActive ? 'active' : '')} 
          onClick={closeMobile}
          data-title="Send message"
        >
          <span>↗</span><b>Send message</b>
        </NavLink>

        <NavLink 
          to="/incoming" 
          className={({ isActive }) => (isActive ? 'active' : '')} 
          onClick={closeMobile}
          data-title="Inbox"
        >
          <span>▤</span><b>Inbox</b>
          {stats?.unread > 0 && (
            <span 
              className="side-badge" 
              style={{ 
                marginLeft: 'auto', 
                background: '#e85b63', 
                color: '#fff', 
                padding: '2px 8px', 
                borderRadius: 10, 
                fontSize: 10,
                fontWeight: 800
              }}
            >
              {stats.unread}
            </span>
          )}
        </NavLink>

        <NavLink 
          to="/groups" 
          className={({ isActive }) => (isActive ? 'active' : '')} 
          onClick={closeMobile}
          data-title="Group"
        >
          <span>▦</span><b>Group</b>
        </NavLink>

        {/* Reports Nav Group */}
        <div className={`nav-group ${reportsOpen || isReportsActive ? 'is-open' : ''}`}>
          <div 
            className={`nav-parent ${isReportsActive ? 'active' : ''}`}
            role="button" 
            tabIndex={0} 
            data-title="Reports"
            onClick={() => {
              if (sidebarCollapsed) {
                toggleSidebarCollapsed()
              } else {
                setReportsOpen(!reportsOpen)
              }
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                setReportsOpen(!reportsOpen)
              }
            }}
          >
            <span>▥</span><b>Reports</b><i className="nav-caret">⌄</i>
          </div>
          <div className="nav-submenu">
            <NavLink 
              to="/report" 
              className={({ isActive }) => (isActive ? 'active' : '')} 
              onClick={closeMobile}
              data-title="Msg Report"
            >
              <span>↳</span><b>Msg Report</b>
            </NavLink>
          </div>
        </div>

        <NavLink 
          to="/campaigns" 
          className={({ isActive }) => (isActive ? 'active' : '')} 
          onClick={closeMobile}
          data-title="Campaigns"
        >
          <span>◇</span><b>Campaigns</b>
        </NavLink>

        <NavLink 
          to="/templates" 
          className={({ isActive }) => (isActive ? 'active' : '')} 
          onClick={closeMobile}
          data-title="Templates"
        >
          <span>▧</span><b>Templates</b>
        </NavLink>

        <NavLink 
          to="/contacts" 
          className={({ isActive }) => (isActive ? 'active' : '')} 
          onClick={closeMobile}
          data-title="Contacts"
        >
          <span>♙</span><b>Contacts</b>
        </NavLink>

        <NavLink 
          to="/settings" 
          className={({ isActive }) => (isActive ? 'active' : '')} 
          onClick={closeMobile}
          data-title="Settings"
        >
          <span>⚙</span><b>Settings</b>
        </NavLink>

        <NavLink 
          to="/plans" 
          className={({ isActive }) => (isActive ? 'active' : '')} 
          onClick={closeMobile}
          data-title="Plans"
        >
          <span>◆</span><b>Plans</b>
        </NavLink>

        <NavLink 
          to="/api" 
          className={({ isActive }) => (isActive ? 'active' : '')} 
          onClick={closeMobile}
          data-title="API Docs"
        >
          <span>⌘</span><b>API Docs</b>
        </NavLink>

        {isAdmin && (
          <>
            <div className="nav-section-title">
              <span>ADMINISTRATION</span>
              <hr className="nav-section-divider" />
            </div>
            <NavLink 
              to="/admin" 
              end 
              className={({ isActive }) => (isActive ? 'active' : '')} 
              onClick={closeMobile}
              data-title="User Management"
            >
              <span>👥</span><b>User Management</b>
            </NavLink>
            <NavLink 
              to="/admin/plans" 
              className={({ isActive }) => (isActive ? 'active' : '')} 
              onClick={closeMobile}
              data-title="Plan Management"
            >
              <span>🏷️</span><b>Plan Management</b>
            </NavLink>
            <NavLink 
              to="/payment/daybook" 
              className={({ isActive }) => (isActive ? 'active' : '')} 
              onClick={closeMobile}
              data-title="Purchase Requests"
            >
              <span>💳</span><b>Purchase Requests</b>
            </NavLink>
          </>
        )}
      </nav>

      {/* Sidebar Live Status */}
      <div className="sidebar-status" data-title={isConnected ? 'WhatsApp Online' : 'WhatsApp Offline'}>
        <span 
          className="dot" 
          style={{ 
            backgroundColor: isConnected ? '#16a765' : '#e85b63',
            boxShadow: isConnected ? '0 0 10px rgba(22,167,101,.7)' : '0 0 10px rgba(232,91,99,.7)'
          }}
        ></span>
        <div>
          <strong>{isConnected ? 'WhatsApp Online' : 'WhatsApp Offline'}</strong>
          <small>
            {status?.number ? `+${status.number}` : (isConnected ? 'All systems operational' : 'Not connected')}
          </small>
        </div>
      </div>
    </aside>
  )
}

export default Sidebar
