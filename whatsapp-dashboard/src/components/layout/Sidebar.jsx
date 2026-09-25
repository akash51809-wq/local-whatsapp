import React from 'react'
import { NavLink } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import NavIcon from '../common/NavIcon'

export function Sidebar() {
  const {
    currentUser,
    isAdmin,
    status,
    stats,
    loadStatus,
    loadQr,
    notify,
    logout,
    setSidebarOpen,
    companySettings,
    planInfo
  } = useAuth()

  const closeMobile = () => setSidebarOpen(false)

  return (
    <aside className="app-sidebar">
      <div className="app-sidebar__logo">
        <NavLink className="header-brand" to={isAdmin ? "/admin" : "/dashboard"} onClick={closeMobile} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {companySettings?.logoUrl ? (
            <img 
              src={companySettings.logoUrl} 
              className="header-brand-img desktop-lgo" 
              alt={companySettings?.companyName || "Company Logo"} 
              style={{ maxHeight: 38, maxWidth: '100%', objectFit: 'contain' }}
            />
          ) : (
            <img src="/assets/images/brand/logo.png" className="header-brand-img desktop-lgo" alt="Zendash logo" />
          )}
          {companySettings?.faviconUrl ? (
            <img 
              src={companySettings.faviconUrl} 
              className="header-brand-img mobile-logo" 
              alt={companySettings?.companyName || "Favicon"} 
              style={{ maxHeight: 30, width: 30, objectFit: 'contain' }}
            />
          ) : (
            <img src="/assets/images/brand/favicon.png" className="header-brand-img mobile-logo" alt="Zendash logo" />
          )}
        </NavLink>
      </div>

      <div className="app-sidebar3">
        <div className="app-sidebar__user">
          <div className="dropdown user-pro-body text-center">
            <div className="user-pic">
              <div className="avatar-xl rounded-circle mb-1 user-avatar-circle">
                {(currentUser?.username || status.profileName || 'W')[0].toUpperCase()}
              </div>
            </div>
            <div className="user-info">
              <h5 className="mb-0 font-weight-normal">
                {status.profileName || (currentUser?.username ? currentUser.username : 'WhatsApp Account')}
              </h5>
              <span className="text-muted app-sidebar__user-name text-sm">
                {isAdmin ? 'System Administrator' : `Plan: ${planInfo?.planName || currentUser?.plan || 'Standard'}`}
              </span>
              <div className="sidebar-status-line">
                <span className={`dot ${status.status === 'connected' ? 'online' : ''}`}></span>
                <small>{status.number ? `+${status.number}` : (status.status === 'connected' ? 'Connected' : 'Not connected')}</small>
              </div>
            </div>
          </div>
        </div>

        <ul className="side-menu">
          <li><h3>MAIN</h3></li>
          <li className="slide">
            <NavLink 
              to="/dashboard" 
              className={({ isActive }) => `side-menu__item ${isActive ? 'active' : ''}`}
              onClick={closeMobile}
            >
              <span className="shape1"></span>
              <span className="shape2"></span>
              <span className="side-menu__icon"><NavIcon name="dashboard" fallback="⌂" /></span>
              <span className="side-menu__label">Dashboard</span>
            </NavLink>
          </li>

          <li><h3>WHATSAPP ACTIONS</h3></li>
          <li className="slide">
            <NavLink 
              to="/send" 
              className={({ isActive }) => `side-menu__item ${isActive ? 'active' : ''}`}
              onClick={closeMobile}
            >
              <span className="shape1"></span>
              <span className="shape2"></span>
              <span className="side-menu__icon"><NavIcon name="send" fallback="➤" /></span>
              <span className="side-menu__label">Send Message</span>
            </NavLink>
          </li>
          <li className="slide">
            <NavLink 
              to="/groups" 
              className={({ isActive }) => `side-menu__item ${isActive ? 'active' : ''}`}
              onClick={closeMobile}
            >
              <span className="shape1"></span>
              <span className="shape2"></span>
              <span className="side-menu__icon"><NavIcon name="groups" fallback="👥" /></span>
              <span className="side-menu__label">Groups</span>
            </NavLink>
          </li>
          <li className="slide">
            <NavLink 
              to="/incoming" 
              className={({ isActive }) => `side-menu__item ${isActive ? 'active' : ''}`}
              onClick={closeMobile}
            >
              <span className="shape1"></span>
              <span className="shape2"></span>
              <span className="side-menu__icon"><NavIcon name="incoming" fallback="◉" /></span>
              <span className="side-menu__label">Incoming Messages</span>
              {stats.unread > 0 && <span className="side-badge">{stats.unread}</span>}
            </NavLink>
          </li>
          <li className="slide">
            <NavLink 
              to="/report" 
              className={({ isActive }) => `side-menu__item ${isActive ? 'active' : ''}`}
              onClick={closeMobile}
            >
              <span className="shape1"></span>
              <span className="shape2"></span>
              <span className="side-menu__icon"><NavIcon name="reports" fallback="▤" /></span>
              <span className="side-menu__label">Message Reports</span>
            </NavLink>
          </li>

          {isAdmin ? (
            <>
              <li><h3>ADMINISTRATION</h3></li>
              <li className="slide">
                <NavLink 
                  to="/admin" 
                  end
                  className={({ isActive }) => `side-menu__item ${isActive ? 'active' : ''}`}
                  onClick={closeMobile}
                >
                  <span className="shape1"></span>
                  <span className="shape2"></span>
                  <span className="side-menu__icon"><NavIcon name="users" fallback="👥" /></span>
                  <span className="side-menu__label">User Management</span>
                </NavLink>
              </li>
              <li className="slide">
                <NavLink 
                  to="/admin/plans" 
                  className={({ isActive }) => `side-menu__item ${isActive ? 'active' : ''}`}
                  onClick={closeMobile}
                >
                  <span className="shape1"></span>
                  <span className="shape2"></span>
                  <span className="side-menu__icon"><NavIcon name="plans" fallback="🏷️" /></span>
                  <span className="side-menu__label">Plan Management</span>
                </NavLink>
              </li>
              <li className="slide">
                <NavLink 
                  to="/payment/daybook" 
                  className={({ isActive }) => `side-menu__item ${isActive ? 'active' : ''}`}
                  onClick={closeMobile}
                >
                  <span className="shape1"></span>
                  <span className="shape2"></span>
                  <span className="side-menu__icon"><NavIcon name="plan-requests" fallback="💳" /></span>
                  <span className="side-menu__label">Purchase Requests</span>
                </NavLink>
              </li>
              <li className="slide">
                <NavLink 
                  to="/settings" 
                  className={({ isActive }) => `side-menu__item ${isActive ? 'active' : ''}`}
                  onClick={closeMobile}
                >
                  <span className="shape1"></span>
                  <span className="shape2"></span>
                  <span className="side-menu__icon"><NavIcon name="system" fallback="⚙" /></span>
                  <span className="side-menu__label">Company Settings</span>
                </NavLink>
              </li>
            </>
          ) : (
            <>
              <li><h3>SUBSCRIPTION</h3></li>
              <li className="slide">
                <NavLink 
                  to="/plans" 
                  className={({ isActive }) => `side-menu__item ${isActive ? 'active' : ''}`}
                  onClick={closeMobile}
                >
                  <span className="shape1"></span>
                  <span className="shape2"></span>
                  <span className="side-menu__icon"><NavIcon name="plans" fallback="💎" /></span>
                  <span className="side-menu__label">Pricing &amp; Plans</span>
                </NavLink>
              </li>
            </>
          )}

          <li><h3>SYSTEM</h3></li>
          <li className="slide">
            <NavLink 
              to="/api" 
              className={({ isActive }) => `side-menu__item ${isActive ? 'active' : ''}`}
              onClick={closeMobile}
            >
              <span className="shape1"></span>
              <span className="shape2"></span>
              <span className="side-menu__icon"><NavIcon name="api" fallback="{}" /></span>
              <span className="side-menu__label">API &amp; Webhook</span>
            </NavLink>
          </li>
          <li className="slide">
            <NavLink 
              to={isAdmin ? "/system" : "/settings"} 
              className={({ isActive }) => `side-menu__item ${isActive ? 'active' : ''}`}
              onClick={closeMobile}
            >
              <span className="shape1"></span>
              <span className="shape2"></span>
              <span className="side-menu__icon"><NavIcon name="system" fallback="⚙" /></span>
              <span className="side-menu__label">{isAdmin ? "System & Security" : "System & Settings"}</span>
            </NavLink>
          </li>
        </ul>

        <div className="app-sidebar-footer">
          <button 
            type="button"
            className="btn-sidebar-footer refresh" 
            onClick={() => { loadStatus(); loadQr(); notify('Status refreshed') }}
          >
            <span>↻</span> Refresh
          </button>
          <button 
            type="button"
            className="btn-sidebar-footer logout" 
            onClick={logout}
          >
            <span>⇥</span> Logout
          </button>
        </div>
      </div>
    </aside>
  )
}

export default Sidebar
