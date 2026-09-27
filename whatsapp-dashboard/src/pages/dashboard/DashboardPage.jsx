import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import '../../styles/dashboard.css'

export function DashboardPage() {
  const {
    status,
    stats,
    reports = [],
    loadReports,
    currentUser,
    isAdmin,
    planInfo
  } = useAuth()

  const navigate = useNavigate()
  const [timeframe, setTimeframe] = useState('this-month')

  useEffect(() => {
    if (loadReports) loadReports()
  }, [loadReports])

  // Dynamic greeting based on time of day
  const getGreeting = () => {
    const hours = new Date().getHours()
    if (hours < 12) return 'Good morning'
    if (hours < 17) return 'Good afternoon'
    return 'Good evening'
  }

  const formatExpiry = (isoString) => {
    if (!isoString) return '30 Sep 2026'
    try {
      const d = new Date(isoString)
      return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
    } catch {
      return '30 Sep 2026'
    }
  }

  const username = currentUser?.username || 'Prince'
  const isConnected = status?.status === 'connected'
  const currentPlan = isAdmin ? 'Super Admin' : (planInfo?.planName || currentUser?.plan || 'Professional')
  const validityDate = isAdmin ? 'Lifetime' : formatExpiry(planInfo?.expiresAt)

  // Recent messages for table
  const recentList = (reports && reports.length > 0)
    ? reports.slice(0, 5).map((r, idx) => ({
        id: idx + 1,
        service: r.source || 'WhatsApp Message',
        serviceColor: r.source === 'Campaign' ? 'orange' : (r.source === 'Inbox' ? 'blue' : 'green'),
        mobile: r.to ? (r.to.startsWith('+') ? r.to : `+91 ${r.to}`) : '+91 98765 43210',
        message: r.text || r.message || 'Message sent successfully',
        status: (r.status === 'delivered' || r.status === 'sent' || r.status === 'Success') ? 'Success' : (r.status === 'failed' ? 'Failed' : 'Pending'),
        badgeClass: (r.status === 'delivered' || r.status === 'sent' || r.status === 'Success') ? 'success' : (r.status === 'failed' ? 'failed' : 'pending'),
        date: r.date ? new Date(r.date).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '10 Sep 2026, 10:30 AM'
      }))
    : [
        {
          id: 1,
          service: 'WhatsApp Message',
          serviceColor: 'green',
          mobile: '+91 98765 43210',
          message: 'Order confirmation sent',
          status: 'Success',
          badgeClass: 'success',
          date: '09 Sep 2026, 10:30 AM'
        },
        {
          id: 2,
          service: 'Campaign',
          serviceColor: 'orange',
          mobile: '+91 98123 45678',
          message: 'Offer message delivered',
          status: 'Success',
          badgeClass: 'success',
          date: '09 Sep 2026, 10:20 AM'
        },
        {
          id: 3,
          service: 'Inbox',
          serviceColor: 'blue',
          mobile: '+91 98765 43210',
          message: 'Hello, is my order ready?',
          status: 'Pending',
          badgeClass: 'pending',
          date: '09 Sep 2026, 10:15 AM'
        },
        {
          id: 4,
          service: 'WhatsApp Message',
          serviceColor: 'pink',
          mobile: '+91 87654 32109',
          message: 'Payment received',
          status: 'Success',
          badgeClass: 'success',
          date: '09 Sep 2026, 10:10 AM'
        }
      ]

  return (
    <div className="content dashboard-page">
      
      {/* 1. Hero Banner */}
      <section className="dashboard-hero">
        <div className="hero-copy">
          <span className="eyebrow">WHATSAPP AUTOMATION</span>
          <h1>
            <span>{getGreeting()}</span>, {username} 👋
          </h1>
          <p>Manage your WhatsApp workspace, messages and connected numbers from one place.</p>
        </div>

        {isAdmin ? (
          <div className="hero-whatsapp">
            <div className="whatsapp-3d-icon" aria-label="WhatsApp">
              <span>◔</span>
            </div>
          </div>
        ) : (
          <div className="hero-plan">
            <div className="plan-summary">
              <span className="plan-orb">◆</span>
              <div className="plan-main">
                <span>CURRENT PLAN</span>
                <strong>{currentPlan}</strong>
              </div>
              <div className="plan-divider"></div>
              <div className="plan-main validity">
                <span>VALID UNTIL</span>
                <strong>{validityDate}</strong>
              </div>
            </div>
          </div>
        )}
      </section>

      {/* 2. Actions Filter Row */}
      <div className="actions" style={{ marginBottom: 16 }}>
        <button 
          type="button" 
          className="btn" 
          onClick={() => setTimeframe(t => t === 'this-month' ? 'today' : 'this-month')}
        >
          ▣ {timeframe === 'this-month' ? 'This Month' : 'Today'}
        </button>
      </div>

      {/* 3. 5 3D Stat Cards */}
      <div className="grid4">
        {/* Stat 1: Devices */}
        <article 
          className="stat stat-green" 
          onClick={() => navigate('/device')} 
          style={{ cursor: 'pointer' }}
          title="Click to manage WhatsApp devices"
        >
          <div className="stat-decoration deco-ring"></div>
          <div className="stat-icon stat-device">
            <span className="mini-device"></span>
          </div>
          <small>Devices</small>
          <strong>{isConnected ? '1' : '0'} / {planInfo?.allowedDevices || 4}</strong>
          <span>{isConnected ? 'Connected' : 'Scan Required'}</span>
        </article>

        {/* Stat 2: Messages Today */}
        <article className="stat stat-orange">
          <div className="stat-decoration deco-orb orange"></div>
          <div className="stat-icon stat-message">
            <span className="mini-message">✓</span>
          </div>
          <small>Messages Today</small>
          <strong>{stats?.today || stats?.sentToday || '3,248'}</strong>
          <span>↗ 12.45%</span>
        </article>

        {/* Stat 3: Messages Sent */}
        <article className="stat stat-blue">
          <div className="stat-decoration deco-cube blue"></div>
          <div className="stat-icon stat-send">
            <span className="mini-plane">➤</span>
          </div>
          <small>Messages Sent</small>
          <strong>{stats?.sent || '3,124'}</strong>
          <span>↗ 18.62%</span>
        </article>

        {/* Stat 4: Delivered */}
        <article className="stat stat-pink">
          <div className="stat-decoration deco-bubble pink"></div>
          <div className="stat-icon stat-delivered">
            <span className="mini-check">✓</span>
          </div>
          <small>Delivered</small>
          <strong>{stats?.delivered || '2,986'}</strong>
          <span>↗ 15.35%</span>
        </article>

        {/* Stat 5: Active Numbers */}
        <article 
          className="stat stat-yellow"
          onClick={() => navigate('/device')} 
          style={{ cursor: 'pointer' }}
          title="Click to view connected numbers"
        >
          <div className="stat-decoration deco-star yellow">✦</div>
          <div className="stat-icon stat-users">
            <span className="mini-users">
              <i></i><i></i><i></i>
            </span>
          </div>
          <small>Active Numbers</small>
          <strong style={{ fontSize: status?.number ? 16 : 22, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {status?.number ? `+${status.number}` : (isConnected ? '1 Number' : '0')}
          </strong>
          <span>↗ 8.45%</span>
        </article>
      </div>

      {/* 4. Dash Grid: Message Activity Chart + Smart Shortcuts */}
      <div className="dash-grid">
        {/* Message Activity Chart */}
        <article className="card">
          <div className="card-head">
            <div>
              <h3>Message Activity</h3>
              <p>Incoming and outgoing messages</p>
            </div>
            <select 
              className="select compact" 
              value={timeframe} 
              onChange={e => setTimeframe(e.target.value)}
              style={{ width: 'auto', minWidth: 120 }}
            >
              <option value="this-month">This Month</option>
              <option value="last-month">Last Month</option>
            </select>
          </div>
          <div className="chart-area">
            <div className="bars">
              <i style={{ height: '55%' }} title="Day 01: 55%"></i>
              <i style={{ height: '72%' }} title="Day 03: 72%"></i>
              <i style={{ height: '48%' }} title="Day 06: 48%"></i>
              <i style={{ height: '82%' }} title="Day 09: 82%"></i>
              <i style={{ height: '64%' }} title="Day 12: 64%"></i>
              <i style={{ height: '90%' }} title="Day 15: 90%"></i>
              <i style={{ height: '70%' }} title="Day 18: 70%"></i>
              <i style={{ height: '96%' }} title="Day 21: 96%"></i>
              <i style={{ height: '68%' }} title="Day 24: 68%"></i>
              <i style={{ height: '84%' }} title="Day 26: 84%"></i>
              <i style={{ height: '58%' }} title="Day 28: 58%"></i>
              <i style={{ height: '92%' }} title="Day 30: 92%"></i>
            </div>
            <div className="chart-labels">
              <span>01</span>
              <span>05</span>
              <span>10</span>
              <span>15</span>
              <span>20</span>
              <span>25</span>
              <span>30</span>
            </div>
          </div>
        </article>

        {/* Smart Shortcuts */}
        <article className="card">
          <div className="card-head">
            <div>
              <h3>Smart Shortcuts</h3>
              <p>Open your workspace instantly</p>
            </div>
          </div>
          <div className="shortcut-grid">
            <div 
              className="shortcut" 
              onClick={() => navigate('/send')} 
              style={{ cursor: 'pointer' }}
            >
              <span className="shortcut-visual visual-send">
                <i>➤</i>
              </span>
              <b>Send Message</b>
            </div>

            <div 
              className="shortcut" 
              onClick={() => navigate('/contacts')} 
              style={{ cursor: 'pointer' }}
            >
              <span className="shortcut-visual visual-contact">
                <i>♙</i>
              </span>
              <b>Contacts</b>
            </div>

            <div 
              className="shortcut" 
              onClick={() => navigate('/report')} 
              style={{ cursor: 'pointer' }}
            >
              <span className="shortcut-visual visual-report">
                <i>▥</i>
              </span>
              <b>Reports</b>
            </div>

            <div 
              className="shortcut" 
              onClick={() => navigate('/settings')} 
              style={{ cursor: 'pointer' }}
            >
              <span className="shortcut-visual visual-settings">
                <i>⚙</i>
              </span>
              <b>Settings</b>
            </div>

            <div 
              className="shortcut" 
              onClick={() => navigate('/api')} 
              style={{ cursor: 'pointer' }}
            >
              <span className="shortcut-visual visual-ai">
                <i>✦</i>
              </span>
              <b>AI Assistant</b>
            </div>

            <div 
              className="shortcut" 
              onClick={() => navigate('/campaigns')} 
              style={{ cursor: 'pointer' }}
            >
              <span className="shortcut-visual visual-campaign">
                <i>◇</i>
              </span>
              <b>Campaigns</b>
            </div>
          </div>
        </article>
      </div>

      {/* 5. Recent Messages Table */}
      <article className="card table-card" style={{ marginTop: 16 }}>
        <div className="card-head">
          <div>
            <h3>Recent Messages</h3>
            <p>Latest WhatsApp activity</p>
          </div>
          <button 
            type="button" 
            className="btn" 
            onClick={() => navigate('/report')}
          >
            View all
          </button>
        </div>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>#</th>
                <th>Service</th>
                <th>Mobile</th>
                <th>Message</th>
                <th>Status</th>
                <th>Date &amp; Time</th>
              </tr>
            </thead>
            <tbody>
              {recentList.map((row) => (
                <tr key={row.id}>
                  <td>{row.id}</td>
                  <td>
                    <span className={`service-object ${row.serviceColor}`}></span>
                    {row.service}
                  </td>
                  <td>{row.mobile}</td>
                  <td style={{ maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {row.message}
                  </td>
                  <td>
                    <span className={`badge ${row.badgeClass}`}>
                      {row.status}
                    </span>
                  </td>
                  <td>{row.date}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </article>

    </div>
  )
}

export default DashboardPage
