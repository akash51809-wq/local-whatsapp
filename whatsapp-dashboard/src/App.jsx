import { Component, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import * as XLSX from 'xlsx'
import './App.css'

const getToken = () => localStorage.getItem('wa_login') || ''
const getSavedUser = () => {
  try { return JSON.parse(localStorage.getItem('wa_user') || '{}') } catch { return {} }
}

const api = async (url, options = {}) => {
  const token = getToken()
  const headers = { 
    'Content-Type': 'application/json', 
    ...(token ? { Authorization: `Bearer ${token}` } : {}), 
    ...(options.headers || {}) 
  }
  const res = await fetch(url, { ...options, headers })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.message || `Request failed: ${res.status}`)
  return data
}

const defaultNav = [
  ['dashboard', '⌂', 'Dashboard'],
  ['send', '➤', 'Send Message'],
  ['incoming', '◉', 'Incoming Messages'],
  ['reports', '▤', 'Message Reports'],
  ['api', '{}', 'API & Webhook'],
  ['system', '⚙', 'System & Settings'],
]

function NavIcon({ name, fallback }) {
  switch (name) {
    case 'dashboard':
      return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg>
    case 'users':
      return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
    case 'send':
      return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
    case 'groups':
      return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><rect x="14" y="3" width="7" height="7" rx="1.5"></rect></svg>
    case 'incoming':
      return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
    case 'reports':
      return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line></svg>
    case 'api':
      return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="16 18 22 12 16 6"></polyline><polyline points="8 6 2 12 8 18"></polyline></svg>
    case 'system':
      return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>
    case 'plans':
      return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"></path><line x1="7" y1="7" x2="7.01" y2="7"></line></svg>
    case 'plan-requests':
      return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"></rect><line x1="1" y1="10" x2="23" y2="10"></line></svg>
    default:
      return <span>{fallback}</span>
  }
}

function App() {
  const [page, setPage] = useState('dashboard')
  const [theme, setTheme] = useState(() => localStorage.getItem('wa_theme') || 'dark')
  const [status, setStatus] = useState({ status: 'waiting', number: null, profileName: 'WhatsApp Account' })
  const [qr, setQr] = useState(null)
  const [error, setError] = useState('')
  const [toast, setToast] = useState('')
  const [chats, setChats] = useState([])
  const [selected, setSelected] = useState(null)
  const [messages, setMessages] = useState([])
  const [chatFilter, setChatFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [text, setText] = useState('')
  const [recipient, setRecipient] = useState('')
  const [sending, setSending] = useState(false)
  const [attachment, setAttachment] = useState(null)
  const [reports, setReports] = useState([])
  const [reportStats, setReportStats] = useState({})
  const [login, setLogin] = useState(() => localStorage.getItem('wa_login') || '')
  const [currentUser, setCurrentUser] = useState(getSavedUser)
  const [connecting, setConnecting] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const fileRef = useRef(null)

  const isAdmin = currentUser?.role === 'admin'

  useEffect(() => {
    if (theme === 'dark') {
      document.body.classList.add('dark-mode')
    } else {
      document.body.classList.remove('dark-mode')
    }
  }, [theme])

  const notify = useCallback((msg) => {
    setToast(msg)
    setTimeout(() => setToast(''), 3000)
  }, [])

  const loadStatus = useCallback(async () => {
    try {
      if (isAdmin) {
        const s = await api('/api/status')
        setStatus(s)
        if (s.status === 'connected' || s.ready) {
          setQr(null)
        }
      } else {
        const d = await api('/api/user/whatsapp/status')
        const s = {
          status: d.status || 'waiting',
          number: d.number,
          profileName: d.profileName || 'My WhatsApp',
          ready: d.ready
        }
        setStatus(s)
        if (s.status === 'connected' || s.ready) {
          setQr(null)
        }
      }
      setError('')
    } catch (e) {
      setError(e.message)
    }
  }, [isAdmin])

  const loadQr = useCallback(async () => {
    try {
      if (isAdmin) {
        const d = await api('/api/whatsapp/qr')
        if (d.status === 'connected') {
          setQr(null)
          loadStatus()
        } else {
          setQr(d.status === 'qr' ? d.qr : null)
        }
      } else {
        const d = await api('/api/user/whatsapp/qr')
        if (d.status === 'connected') {
          setQr(null)
          loadStatus()
        } else {
          setQr(d.status === 'waiting' || d.status === 'qr' ? d.qr : null)
        }
      }
    } catch (e) {
      // Don't show noise error on poll
    }
  }, [isAdmin, loadStatus])

  const connectUserWhatsApp = async () => {
    setConnecting(true)
    setError('')
    try {
      await api('/api/user/whatsapp/connect', { method: 'POST' })
      notify('WhatsApp session शुरू हो रहा है... QR कोड लोड हो रहा है...')
      setTimeout(() => { loadQr(); loadStatus() }, 1500)
    } catch (e) {
      setError(e.message)
    } finally {
      setConnecting(false)
    }
  }

  const disconnectUserWhatsApp = async () => {
    try {
      await api('/api/user/whatsapp/disconnect', { method: 'POST' })
      setStatus({ status: 'disconnected', number: null, profileName: 'WhatsApp Account' })
      setQr(null)
      notify('WhatsApp disconnected.')
    } catch (e) {
      setError(e.message)
    }
  }

  const loadChats = useCallback(async () => {
    try {
      const qs = new URLSearchParams()
      if (chatFilter !== 'all') qs.set('filter', chatFilter)
      if (search) qs.set('search', search)
      const d = await api(`/api/incoming/chats?${qs}`)
      setChats(d.chats || [])
    } catch (e) { setError(e.message) }
  }, [chatFilter, search])

  const loadMessages = useCallback(async (chatJid) => {
    if (!chatJid) return
    try {
      const d = await api(`/api/incoming/messages?chatJid=${encodeURIComponent(chatJid)}`)
      setMessages(d.messages || [])
      await api('/api/incoming/mark-read', { method: 'POST', body: JSON.stringify({ chatJid }) }).catch(() => {})
    } catch (e) { setError(e.message) }
  }, [])

  const loadReports = useCallback(async () => {
    try {
      const d = await api('/api/reports/messages')
      setReports(d.reports || [])
      setReportStats(d.stats || {})
    } catch (e) { setError(e.message) }
  }, [])

  useEffect(() => { 
    loadStatus()
    loadQr()
    const t = setInterval(() => { loadStatus(); loadQr() }, 3500)
    return () => clearInterval(t) 
  }, [loadStatus, loadQr])

  useEffect(() => { if (page === 'incoming' || page === 'dashboard') loadChats() }, [page, loadChats])
  useEffect(() => { if (selected) loadMessages(selected.chatJid) }, [selected, loadMessages])
  useEffect(() => { if (page === 'reports') loadReports() }, [page, loadReports])

  useEffect(() => {
    if (!login) return
    const es = new EventSource(`/api/incoming/events?token=${encodeURIComponent(login)}`)
    es.onmessage = (e) => { 
      try {
        const payload = JSON.parse(e.data || '{}')
        if (payload.type === 'connection_status' || payload.type === 'qr' || payload.type === 'refresh') {
          loadStatus()
          loadQr()
        }
      } catch {}
      if (page === 'incoming' || page === 'dashboard') loadChats()
      if (selected) loadMessages(selected.chatJid) 
    }
    es.onerror = () => {}
    return () => es.close()
  }, [login, page, selected, loadChats, loadMessages, loadStatus, loadQr])

  const stats = useMemo(() => ({
    chats: chats.length,
    unread: chats.reduce((n, c) => n + (c.unreadCount || 0), 0),
    groups: chats.filter(c => c.isGroup).length,
  }), [chats])

  const chooseChat = (chat) => { setSelected(chat); setPage('incoming') }

  const sendReply = async () => {
    if (!selected || (!text.trim() && !attachment)) return
    setSending(true); setError('')
    try {
      const body = { chatJid: selected.chatJid, text: text.trim() }
      if (attachment) body.attachment = attachment
      await api('/api/incoming/reply', { method: 'POST', body: JSON.stringify(body) })
      setText(''); setAttachment(null); if (fileRef.current) fileRef.current.value = ''
      await loadMessages(selected.chatJid); await loadChats(); notify('संदेश भेज दिया गया')
    } catch (e) { setError(e.message) } finally { setSending(false) }
  }

  const sendDirectMessage = async () => {
    if (!recipient.trim() || !text.trim()) return setError('Recipient Number और Message दोनों भरें।')
    setSending(true); setError('')
    try {
      if (!isAdmin) {
        await api('/api/user/send', { method: 'POST', body: JSON.stringify({ to: recipient.trim(), text: text.trim() }) })
      } else {
        await api('/api/send-text', { method: 'POST', body: JSON.stringify({ to: recipient.trim(), text: text.trim() }) })
      }
      setText(''); setRecipient(''); notify('संदेश सफलतापुर्वक भेज दिया गया!')
    } catch (e) {
      setError(e.message)
    } finally {
      setSending(false)
    }
  }

  const onFile = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 10 * 1024 * 1024) return setError('फ़ाइल 10 MB से छोटी होनी चाहिए')
    const reader = new FileReader()
    reader.onload = () => setAttachment({ name: file.name, type: file.type || 'application/octet-stream', data: reader.result })
    reader.readAsDataURL(file)
  }

  const logout = () => { 
    localStorage.removeItem('wa_login')
    localStorage.removeItem('wa_user')
    setLogin('')
    setCurrentUser({})
    notify('लॉगआउट सफल') 
  }

  const navList = useMemo(() => [
    ['dashboard', '⌂', 'Dashboard'],
    ...(isAdmin ? [
      ['users', '👥', 'User Management'],
      ['plans', '🏷️', 'Plan Management'],
      ['plan-requests', '💳', 'Purchase Requests'],
    ] : [
      ['plans', '💎', 'Pricing & Plans'],
    ]),
    ['send', '➤', 'Send Message'],
    ['groups', '👥', 'Groups'],
    ['incoming', '◉', 'Incoming Messages'],
    ['reports', '▤', 'Message Reports'],
    ['api', '{}', 'API & Webhook'],
    ['system', '⚙', 'System & Settings'],
  ], [isAdmin])

  if (!login) return <Login onLogin={(token, user) => { 
    setLogin(token)
    setCurrentUser(user || {})
    setPage('dashboard')
    setTimeout(() => {
      loadStatus()
      loadQr()
    }, 50)
  }} />

  return (
    <div className={`app page ${theme === 'dark' ? 'dark-mode' : ''} ${sidebarOpen ? 'sidenav-toggled' : ''}`}>
      <div className="page-main">
        {/* Mobile sidebar overlay */}
        <div 
          className="app-sidebar__overlay" 
          onClick={() => setSidebarOpen(false)}
        />

        {/* Zendash App Sidebar */}
        <aside className="app-sidebar">
          <div className="app-sidebar__logo">
            <a className="header-brand" href="#dashboard" onClick={(e) => { e.preventDefault(); setPage('dashboard'); }}>
              <img src="/assets/images/brand/logo.png" className="header-brand-img desktop-lgo" alt="Zendash logo" />
              <img src="/assets/images/brand/favicon.png" className="header-brand-img mobile-logo" alt="Zendash logo" />
            </a>
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
                  <h5 className="mb-0 font-weight-normal">{status.profileName || (currentUser?.username ? currentUser.username : 'WhatsApp Account')}</h5>
                  <span className="text-muted app-sidebar__user-name text-sm">
                    {isAdmin ? 'System Administrator' : 'User Portal'}
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
                <a 
                  className={`side-menu__item ${page === 'dashboard' ? 'active' : ''}`}
                  onClick={() => { setPage('dashboard'); setSidebarOpen(false); }}
                >
                  <span className="shape1"></span>
                  <span className="shape2"></span>
                  <span className="side-menu__icon"><NavIcon name="dashboard" fallback="⌂" /></span>
                  <span className="side-menu__label">Dashboard</span>
                </a>
              </li>

              <li><h3>WHATSAPP ACTIONS</h3></li>
              <li className="slide">
                <a 
                  className={`side-menu__item ${page === 'send' ? 'active' : ''}`}
                  onClick={() => { setPage('send'); setSidebarOpen(false); }}
                >
                  <span className="shape1"></span>
                  <span className="shape2"></span>
                  <span className="side-menu__icon"><NavIcon name="send" fallback="➤" /></span>
                  <span className="side-menu__label">Send Message</span>
                </a>
              </li>
              <li className="slide">
                <a 
                  className={`side-menu__item ${page === 'groups' ? 'active' : ''}`}
                  onClick={() => { setPage('groups'); setSidebarOpen(false); }}
                >
                  <span className="shape1"></span>
                  <span className="shape2"></span>
                  <span className="side-menu__icon"><NavIcon name="groups" fallback="👥" /></span>
                  <span className="side-menu__label">Groups</span>
                </a>
              </li>
              <li className="slide">
                <a 
                  className={`side-menu__item ${page === 'incoming' ? 'active' : ''}`}
                  onClick={() => { setPage('incoming'); setSidebarOpen(false); }}
                >
                  <span className="shape1"></span>
                  <span className="shape2"></span>
                  <span className="side-menu__icon"><NavIcon name="incoming" fallback="◉" /></span>
                  <span className="side-menu__label">Incoming Messages</span>
                  {stats.unread > 0 && <span className="side-badge">{stats.unread}</span>}
                </a>
              </li>
              <li className="slide">
                <a 
                  className={`side-menu__item ${page === 'reports' ? 'active' : ''}`}
                  onClick={() => { setPage('reports'); setSidebarOpen(false); }}
                >
                  <span className="shape1"></span>
                  <span className="shape2"></span>
                  <span className="side-menu__icon"><NavIcon name="reports" fallback="▤" /></span>
                  <span className="side-menu__label">Message Reports</span>
                </a>
              </li>

              {isAdmin ? (
                <>
                  <li><h3>ADMINISTRATION</h3></li>
                  <li className="slide">
                    <a 
                      className={`side-menu__item ${page === 'users' ? 'active' : ''}`}
                      onClick={() => { setPage('users'); setSidebarOpen(false); }}
                    >
                      <span className="shape1"></span>
                      <span className="shape2"></span>
                      <span className="side-menu__icon"><NavIcon name="users" fallback="👥" /></span>
                      <span className="side-menu__label">User Management</span>
                    </a>
                  </li>
                  <li className="slide">
                    <a 
                      className={`side-menu__item ${page === 'plans' ? 'active' : ''}`}
                      onClick={() => { setPage('plans'); setSidebarOpen(false); }}
                    >
                      <span className="shape1"></span>
                      <span className="shape2"></span>
                      <span className="side-menu__icon"><NavIcon name="plans" fallback="🏷️" /></span>
                      <span className="side-menu__label">Plan Management</span>
                    </a>
                  </li>
                  <li className="slide">
                    <a 
                      className={`side-menu__item ${page === 'plan-requests' ? 'active' : ''}`}
                      onClick={() => { setPage('plan-requests'); setSidebarOpen(false); }}
                    >
                      <span className="shape1"></span>
                      <span className="shape2"></span>
                      <span className="side-menu__icon"><NavIcon name="plan-requests" fallback="💳" /></span>
                      <span className="side-menu__label">Purchase Requests</span>
                    </a>
                  </li>
                </>
              ) : (
                <>
                  <li><h3>SUBSCRIPTION</h3></li>
                  <li className="slide">
                    <a 
                      className={`side-menu__item ${page === 'plans' ? 'active' : ''}`}
                      onClick={() => { setPage('plans'); setSidebarOpen(false); }}
                    >
                      <span className="shape1"></span>
                      <span className="shape2"></span>
                      <span className="side-menu__icon"><NavIcon name="plans" fallback="💎" /></span>
                      <span className="side-menu__label">Pricing &amp; Plans</span>
                    </a>
                  </li>
                </>
              )}

              <li><h3>SYSTEM</h3></li>
              <li className="slide">
                <a 
                  className={`side-menu__item ${page === 'api' ? 'active' : ''}`}
                  onClick={() => { setPage('api'); setSidebarOpen(false); }}
                >
                  <span className="shape1"></span>
                  <span className="shape2"></span>
                  <span className="side-menu__icon"><NavIcon name="api" fallback="{}" /></span>
                  <span className="side-menu__label">API &amp; Webhook</span>
                </a>
              </li>
              <li className="slide">
                <a 
                  className={`side-menu__item ${page === 'system' ? 'active' : ''}`}
                  onClick={() => { setPage('system'); setSidebarOpen(false); }}
                >
                  <span className="shape1"></span>
                  <span className="shape2"></span>
                  <span className="side-menu__icon"><NavIcon name="system" fallback="⚙" /></span>
                  <span className="side-menu__label">System &amp; Settings</span>
                </a>
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

        {/* Zendash App Content */}
        <div className="app-content">
          <div className="side-app">
            {/* Zendash App Header */}
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
                  <h1>{navList.find(n => n[0] === page)?.[2]}</h1>
                  <p>{isAdmin ? 'System Admin Control Center' : `Logged in as: ${currentUser?.username || currentUser?.mobile || 'User'}`}</p>
                </div>
              </div>

              <div className="header-right">
                <div className={`connection-pill ${status.status === 'connected' ? 'is-online' : status.status === 'connecting' ? 'is-connecting' : 'is-waiting'}`}>
                  <span className="pill-dot"></span>
                  <span>{status.status === 'connected' ? `Connected (+${status.number || ''})` : status.status === 'connecting' ? 'Connecting...' : 'Waiting for Scan'}</span>
                </div>
                <button 
                  type="button"
                  className="btn-header-action theme-toggle-btn" 
                  onClick={() => {
                    const next = theme === 'dark' ? 'light' : 'dark'
                    setTheme(next)
                    localStorage.setItem('wa_theme', next)
                    notify(next === 'dark' ? 'Dark Mode सक्रिय (Dark Theme Active) 🌙' : 'Light Mode सक्रिय (Light Theme Active) ☀️')
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

            {error && <div className="alert">⚠ {error}<button onClick={() => setError('')}>×</button></div>}
            {toast && <div className="toast">✓ {toast}</div>}

            {page === 'dashboard' && <Dashboard 
              status={status} 
              qr={qr} 
              stats={stats} 
              chats={chats} 
              isAdmin={isAdmin}
              connecting={connecting}
              onConnect={isAdmin ? loadQr : connectUserWhatsApp} 
              onDisconnect={isAdmin ? null : disconnectUserWhatsApp}
              onChat={chooseChat} 
              onRefresh={loadQr}
            />}
            {page === 'users' && <UsersPage notify={notify} />}
            {page === 'plans' && (
              isAdmin 
                ? <AdminPlansPage notify={notify} /> 
                : <UserPlansPage currentUser={currentUser} notify={notify} />
            )}
            {page === 'plan-requests' && isAdmin && (
              <AdminPlanRequestsPage notify={notify} />
            )}
            {page === 'send' && <SendPage 
              notify={notify}
              status={status}
              isAdmin={isAdmin}
              currentUser={currentUser}
              chats={chats}
            />}
            {page === 'groups' && <GroupsPage 
              notify={notify}
              status={status}
              isAdmin={isAdmin}
              currentUser={currentUser}
            />}
            {page === 'incoming' && <IncomingPage 
              chats={chats} 
              selected={selected} 
              setSelected={setSelected} 
              messages={messages} 
              search={search} 
              setSearch={setSearch} 
              filter={chatFilter} 
              setFilter={setChatFilter} 
              text={text} 
              setText={setText} 
              attachment={attachment} 
              setAttachment={setAttachment} 
              fileRef={fileRef} 
              onFile={onFile} 
              onSend={sendReply} 
              sending={sending} 
            />}
            {page === 'reports' && <ReportsPage reports={reports} stats={reportStats} refresh={loadReports} />}
            {page === 'api' && <ApiPage notify={notify} />}
            {page === 'system' && <SystemPage status={status} currentUser={currentUser} notify={notify} />}
          </div>
        </div>
      </div>
    </div>
  )
}

function Login({ onLogin }) {
  const [u, setU] = useState('')
  const [p, setP] = useState('')
  const [err, setErr] = useState('')
  const [loading, setLoading] = useState(false)
  const [rememberMe, setRememberMe] = useState(true)

  const submit = async (e) => { 
    e.preventDefault()
    if (!u.trim() || !p) return setErr('Username और Password दोनों भरें।')
    setLoading(true)
    setErr('')
    try { 
      const d = await api('/api/auth/login', { method: 'POST', body: JSON.stringify({ username: u.trim(), password: p }) })
      if (d.success) { 
        localStorage.setItem('wa_login', d.user.token)
        localStorage.setItem('wa_user', JSON.stringify(d.user))
        onLogin(d.user.token, d.user) 
      } 
    } catch (e) { 
      setErr(e.message || 'Login failed') 
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="page-style1">
      <div className="page">
        <div className="page-single">
          <div className="container">
            <div className="row">
              <div className="col mx-auto">
                <div className="row justify-content-center">
                  <div className="col-md-7 col-lg-4">
                    <div className="error-logo">
                      <a href="/">
                        <img src="/assets/images/brand/logo2.png" className="header-brand-img dark-logo" alt="logo" />
                      </a>
                    </div>
                    <div className="card mb-0">
                      <div className="card-body">
                        <div className="text-center mb-6">
                          <h2 className="mb-2">Login</h2>
                        </div>
                        <form onSubmit={submit}>
                          {err && (
                            <div className="alert alert-danger mb-4" role="alert">
                              {err}
                            </div>
                          )}
                          <div className="input-group mb-4">
                            <input 
                              type="text" 
                              className="form-control" 
                              placeholder="Username" 
                              value={u}
                              onChange={e => setU(e.target.value)}
                              autoFocus
                            />
                          </div>
                          <div className="input-group mb-4">
                            <input 
                              type="password" 
                              className="form-control" 
                              placeholder="Password" 
                              value={p}
                              onChange={e => setP(e.target.value)}
                            />
                          </div>
                          <div className="row">
                            <div className="col-6">
                              <div className="form-group mb-0">
                                <label className="custom-control custom-checkbox mb-0">
                                  <input 
                                    type="checkbox" 
                                    className="custom-control-input" 
                                    checked={rememberMe}
                                    onChange={e => setRememberMe(e.target.checked)}
                                  />
                                  <span className="custom-control-label text-muted">Remember me</span>
                                </label>
                              </div>
                            </div>
                            <div className="col-6 text-right mt-1">
                              <a 
                                href="#forgot" 
                                className="text-muted"
                                onClick={e => {
                                  e.preventDefault()
                                  alert('Password recovery: Please contact system administrator (admin / admin123) or check your WhatsApp credentials.')
                                }}
                              >
                                Forgot password?
                              </a>
                            </div>
                            <div className="col-12 mt-5">
                              <button type="submit" className="btn btn-lg btn-primary btn-block" disabled={loading}>
                                {loading ? 'Logging in...' : 'Login'}
                              </button>
                            </div>
                          </div>
                          <div className="text-center mt-7 mb-5">
                            <div className="font-weight-normal fs-16 text-muted">
                              You Don't have an account <a className="btn-link font-weight-normal" href="/signup.html">Register Here</a>
                            </div>
                          </div>
                        </form>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function Dashboard({ status, qr, stats, chats, isAdmin, connecting, onConnect, onDisconnect, onChat, onRefresh }) {
  return <section className="page-content">
    <div className="hero-card">
      <div className="hero-text-content">
        <span className="hero-eyebrow-badge">{isAdmin ? 'ADMIN WHATSAPP SESSION' : 'YOUR PERSONAL WHATSAPP SESSION'}</span>
        <h2>{status.status === 'connected' ? 'WhatsApp Connected ✓' : 'अपना WhatsApp जोड़ें'}</h2>
        <p>
          {status.status === 'connected' 
            ? `आपका WhatsApp (+${status.number || ''}) कनेक्टेड है। अब आप इस नंबर से सीधे मैसेज भेज सकते हैं।` 
            : 'QR कोड स्कैन करने के लिए नीचे बटन दबाएं और अपने फ़ोन के WhatsApp से स्कैन करें।'}
        </p>
        <div className="hero-btn-group">
          {status.status === 'connected' ? (
            <>
              <button className="btn-hero-primary" onClick={onRefresh}>↻ Refresh Status</button>
              {onDisconnect && <button className="btn-hero-danger" onClick={onDisconnect}>⏏ Disconnect</button>}
            </>
          ) : (
            <button className="btn-hero-primary" onClick={onConnect} disabled={connecting}>
              {connecting ? '⏳ शुरू हो रहा है...' : '📱 Connect / Get QR Code'}
            </button>
          )}
        </div>
      </div>

      <div className="hero-visual-content">
        {qr ? (
          <div className="hero-qr-box">
            <img className="qr-image" src={qr} alt="WhatsApp QR" />
            <div className="qr-caption">WhatsApp &gt; Linked Devices से scan करें</div>
          </div>
        ) : (
          <div className={`hero-status-circle ${status.status === 'connected' ? 'is-connected' : ''}`}>
            {status.status === 'connected' ? (
              <div className="hero-connected-badge">
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                <span>Online</span>
              </div>
            ) : (
              <div className="hero-disconnected-badge">
                <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="5" y="2" width="14" height="20" rx="2" ry="2"></rect><line x1="12" y1="18" x2="12.01" y2="18"></line></svg>
                <span>Scan Needed</span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>

    <div className="stat-grid">
      <Stat 
        variant="teal"
        icon={<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>} 
        value={stats.chats} 
        label="Active chats" 
        sub="Live conversations"
      />
      <Stat 
        variant="coral"
        icon={<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>} 
        value={stats.unread} 
        label="Unread" 
        sub="Requires attention"
      />
      <Stat 
        variant="purple"
        icon={<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><rect x="14" y="3" width="7" height="7" rx="1.5"></rect></svg>} 
        value={stats.groups} 
        label="Groups" 
        sub="WhatsApp groups"
      />
      <Stat 
        variant={status.status === 'connected' ? 'success' : 'amber'}
        icon={<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>} 
        value={status.status === 'connected' ? 'Online' : 'Offline'} 
        label="Status" 
        sub={status.number ? `+${status.number}` : 'Not connected'}
      />
    </div>

    <div className="zendash-card">
      <div className="zendash-card-header">
        <div>
          <h3 className="zendash-card-title">Recent Conversations</h3>
          <p className="zendash-card-subtitle">हाल के मैसेजेस और चैट्स</p>
        </div>
        {chats.length > 0 && <span className="badge-zendash-count">{chats.length} Total</span>}
      </div>
      <div className="zendash-card-body">
        <div className="chat-grid">
          {chats.slice(0, 8).map(c => (
            <button className="chat-card" key={c.chatJid} onClick={() => onChat(c)}>
              <div className="avatar">{(c.name || '?')[0].toUpperCase()}</div>
              <div className="chat-info">
                <b>{c.name}</b>
                <p>{c.lastMessage || 'Media message'}</p>
              </div>
              {c.unreadCount ? <span className="badge">{c.unreadCount}</span> : null}
              <span className="chat-action-arrow">›</span>
            </button>
          ))}
          {!chats.length && <Empty text="अभी कोई बातचीत उपलब्ध नहीं है" />}
        </div>
      </div>
    </div>
  </section>
}

function Stat({ icon, value, label, variant, sub }) { 
  let computedVariant = variant
  if (!computedVariant) {
    const l = String(label || '').toLowerCase()
    if (l.includes('chat') || l.includes('total')) computedVariant = 'teal'
    else if (l.includes('unread') || l.includes('fail')) computedVariant = 'coral'
    else if (l.includes('group') || l.includes('pending')) computedVariant = 'purple'
    else if (l.includes('status') || l.includes('sent') || l.includes('online')) computedVariant = 'success'
    else computedVariant = 'amber'
  }

  return (
    <div className={`stat-card stat-${computedVariant}`}>
      <div className="stat-icon-wrap">
        <span>{icon}</span>
      </div>
      <div className="stat-content">
        <span className="stat-label">{label}</span>
        <strong className="stat-value">{value}</strong>
        {sub && <span className="stat-sub">{sub}</span>}
      </div>
    </div>
  )
}

function Empty({ text }) { 
  return (
    <div className="empty">
      <div style={{ fontSize: 24, marginBottom: 6, opacity: 0.6 }}>💬</div>
      <div>{text}</div>
    </div>
  )
}


function IncomingPage({ chats, selected, setSelected, messages, search, setSearch, filter, setFilter, text, setText, attachment, setAttachment, fileRef, onFile, onSend, sending }) {
  return <section className="wa-layout">
    <div className="chat-list">
      <div className="list-head">
        <div className="search"><span>⌕</span><input placeholder="Search chats..." value={search} onChange={e => setSearch(e.target.value)} /></div>
        <div className="filters">{[['all','All'],['unread','Unread'],['group','Groups'],['direct','Direct']].map(([v,l]) => <button className={filter === v ? 'selected' : ''} key={v} onClick={() => setFilter(v)}>{l}</button>)}</div>
      </div>
      <div className="chat-items">
        {chats.map(c => (
          <button key={c.chatJid} className={`chat-item ${selected?.chatJid === c.chatJid ? 'selected' : ''}`} onClick={() => setSelected(c)}>
            <div className="avatar">{(c.name || '?')[0].toUpperCase()}</div>
            <div className="chat-copy"><div><b>{c.name}</b><time>{c.lastTimestamp ? new Date(c.lastTimestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}</time></div><p>{c.lastMessage || 'Media'}</p></div>
            {c.unreadCount ? <span className="badge">{c.unreadCount}</span> : null}
          </button>
        ))}
        {!chats.length && <Empty text="No chats found" />}
      </div>
    </div>
    <div className="conversation">
      {selected ? (
        <>
          <div className="conversation-head">
            <div className="avatar">{(selected.name || '?')[0].toUpperCase()}</div>
            <div><b>{selected.name}</b><small>{selected.isGroup ? 'Group' : selected.from}</small></div>
          </div>
          <div className="messages">{messages.map(m => <Message key={m.id} m={m} />)}</div>
          <Composer text={text} setText={setText} attachment={attachment} setAttachment={setAttachment} fileRef={fileRef} onFile={onFile} onSend={onSend} sending={sending} />
        </>
      ) : (
        <div className="conversation-empty">
          <div>◉</div>
          <h2>Select a conversation</h2>
          <p>बाएं से कोई भी चैट चुनें और मैसेज का जवाब दें।</p>
        </div>
      )}
    </div>
    <aside className="details">
      <h3>Chat details</h3>
      {selected ? (
        <>
          <div className="profile-big">{(selected.name || '?')[0].toUpperCase()}</div>
          <h2>{selected.name}</h2>
          <p>{selected.isGroup ? 'WhatsApp Group' : '+' + selected.from}</p>
          <div className="detail-box"><span>Messages</span><b>{selected.messages?.length || 0}</b></div>
          <div className="detail-box"><span>Unread</span><b>{selected.unreadCount || 0}</b></div>
        </>
      ) : <p className="muted">Select a chat to see details.</p>}
    </aside>
  </section>
}

function Message({ m }) { 
  const token = getToken()
  const mediaSrc = m.mediaUrl ? `${m.mediaUrl}${m.mediaUrl.includes('?') ? '&' : '?'}token=${encodeURIComponent(token)}` : null

  return <div className={`message-row ${m.fromMe ? 'mine' : ''}`}>
    <div className="bubble">
      {m.quotedText && <div className="quote">↪ {m.quotedText}</div>}
      {mediaSrc && m.mediaType === 'image' ? <img src={mediaSrc} alt="media" /> : null}
      <div>{m.message || `[${m.mediaType || 'media'}]`}</div>
      <time>{m.date ? new Date(m.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''} {m.fromMe ? '✓✓' : ''}</time>
    </div>
  </div> 
}

function Composer({ text, setText, attachment, setAttachment, fileRef, onFile, onSend, sending }) { 
  return <div className="composer">
    {attachment && <div className="attachment">📎 {attachment.name}<button onClick={() => { setAttachment(null); if (fileRef.current) fileRef.current.value = '' }}>×</button></div>}
    <div className="composer-row">
      <button className="icon-btn" onClick={() => fileRef.current?.click()}>📎</button>
      <input type="file" ref={fileRef} hidden onChange={onFile} />
      <input value={text} onChange={e => setText(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); onSend() } }} placeholder="Type a message..." />
      <button className="send-btn" disabled={sending} onClick={onSend}>{sending ? '…' : '➤'}</button>
    </div>
  </div> 
}

const QUICK_EMOJIS = [
  '😊', '🙏', '👍', '❤️', '🔥', '🎉', '👏', '✔️', '✅', '📱',
  '💼', '📢', '🚀', '⭐', '🤝', '💯', '👋', '🔔', '💬', '✨',
  '🎯', '📍', '💰', '🎁', '💐', '🇮🇳', '👌', '👇', '👉', '⚡'
];

function cleanTo10Digit(val) {
  if (!val) return null;
  let s = String(val).trim().replace(/\D/g, '');
  if (s.length === 12 && s.startsWith('91')) s = s.slice(2);
  else if (s.length === 11 && s.startsWith('0')) s = s.slice(1);
  if (/^[6-9]\d{9}$/.test(s)) return s;
  return null;
}

function parseNumbers(rawText) {
  if (!rawText) return { unique: [], total: 0, validCount: 0, invalid: [] };
  const items = String(rawText)
    .split(/[\r\n,;\t ]+/)
    .map(s => s.trim())
    .filter(Boolean);

  const valid = [];
  const invalid = [];
  for (const item of items) {
    const cleaned = cleanTo10Digit(item);
    if (cleaned) {
      valid.push(cleaned);
    } else {
      invalid.push(item);
    }
  }
  const unique = Array.from(new Set(valid));
  return {
    unique,
    total: items.length,
    validCount: valid.length,
    invalid
  };
}

function SendPage({ notify, status, isAdmin, currentUser }) {
  const [sessions, setSessions] = useState([]);
  const [selectedSession, setSelectedSession] = useState('');
  const [loadingSessions, setLoadingSessions] = useState(false);
  const [numbersText, setNumbersText] = useState('');
  const [msgText, setMsgText] = useState('');
  const [attachment, setAttachment] = useState(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [sendingProgress, setSendingProgress] = useState({
    active: false,
    current: 0,
    total: 0,
    currentNumber: '',
    statusText: '',
    sentCount: 0,
    failCount: 0
  });

  const fileInputRef = useRef(null);
  const excelInputRef = useRef(null);
  const cancelSendingRef = useRef(false);

  // Fetch available WhatsApp sessions
  const loadSessions = useCallback(async () => {
    setLoadingSessions(true);
    try {
      const d = await api('/api/user/whatsapp/sessions');
      const list = d.sessions || [];
      setSessions(list);
      if (list.length > 0) {
        const connected = list.find(s => s.status === 'connected');
        if (connected) {
          setSelectedSession(connected.id || connected.sessionId);
        } else if (!selectedSession) {
          setSelectedSession(list[0].id || list[0].sessionId);
        }
      }
    } catch (e) {
      console.warn('Sessions load warning:', e.message);
    } finally {
      setLoadingSessions(false);
    }
  }, [selectedSession]);

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  // Compute number statistics in real-time
  const numberStats = useMemo(() => parseNumbers(numbersText), [numbersText]);

  // 1. Download Sample Excel template
  const downloadSampleExcel = () => {
    try {
      const sampleRows = [
        { 'Name': 'Rajesh Kumar', 'Number': '9876543210', 'City': 'Delhi' },
        { 'Name': 'Amit Sharma', 'Number': '9123456780', 'City': 'Mumbai' },
        { 'Name': 'Pooja Patel', 'Number': '9988776655', 'City': 'Ahmedabad' }
      ];
      const ws = XLSX.utils.json_to_sheet(sampleRows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Contacts');
      XLSX.writeFile(wb, 'sample_whatsapp_contacts.xlsx');
      if (notify) notify('Sample Excel सफलतापूर्वक डाउनलोड हो गया!');
    } catch (err) {
      if (notify) notify('Sample Excel डाउनलोड करने में समस्या: ' + err.message);
    }
  };

  // 2. Upload and Parse Excel file
  const handleExcelUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (excelInputRef.current) excelInputRef.current.value = '';

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = new Uint8Array(evt.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(firstSheet, { header: 1, defval: '' });

        if (!rows || rows.length === 0) {
          if (notify) notify('चयनित Excel शीट खाली है।');
          return;
        }

        let numberColIdx = -1;
        let headerRowIdx = -1;
        const numberRegex = /(number|phone|mobile|contact|whatsapp|mob|num|कॉल|नंबर|मोबाइल)/i;

        for (let r = 0; r < Math.min(5, rows.length); r++) {
          const row = rows[r];
          if (Array.isArray(row)) {
            for (let c = 0; c < row.length; c++) {
              const val = String(row[c] || '').trim();
              if (numberRegex.test(val)) {
                numberColIdx = c;
                headerRowIdx = r;
                break;
              }
            }
          }
          if (numberColIdx !== -1) break;
        }

        const extracted = [];
        if (numberColIdx !== -1) {
          for (let r = headerRowIdx + 1; r < rows.length; r++) {
            const cellVal = rows[r]?.[numberColIdx];
            const clean = cleanTo10Digit(cellVal);
            if (clean) extracted.push(clean);
          }
        } else {
          for (let r = 0; r < rows.length; r++) {
            const row = rows[r];
            if (Array.isArray(row)) {
              for (let c = 0; c < row.length; c++) {
                const clean = cleanTo10Digit(row[c]);
                if (clean) extracted.push(clean);
              }
            }
          }
        }

        if (extracted.length === 0) {
          if (notify) notify('Excel शीट में कोई वैध 10-अंकीय नंबर नहीं मिला। कृपया "Number" कॉलम जांचें।');
          return;
        }

        const existingUnique = new Set(numberStats.unique);
        extracted.forEach(n => existingUnique.add(n));
        const combined = Array.from(existingUnique).join(', ');
        setNumbersText(combined);

        if (notify) notify(`✓ Excel से ${extracted.length} नंबर सफलतापूर्वक जोड़े गए!`);
      } catch (err) {
        if (notify) notify('Excel फ़ाइल पढ़ने में त्रुटि: ' + err.message);
      }
    };
    reader.readAsArrayBuffer(file);
  };

  // 3. Remove Duplicates
  const handleRemoveDuplicates = () => {
    const { unique, total } = parseNumbers(numbersText);
    if (unique.length === 0) {
      if (notify) notify('हटाने के लिए कोई वैध नंबर नहीं मिला।');
      return;
    }
    const deduplicated = unique.join(', ');
    setNumbersText(deduplicated);
    const removedCount = total - unique.length;
    if (notify) notify(`✓ Duplicates हटा दिए गए! ${unique.length} यूनिक 10-अंकीय नंबर शेष हैं (${removedCount} हटाए गए)।`);
  };

  // 4. Handle Attachment
  const handleAttachment = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 15 * 1024 * 1024) {
      if (notify) notify('फ़ाइल का आकार 15 MB से कम होना चाहिए।');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setAttachment({
        name: file.name,
        type: file.type || 'application/octet-stream',
        size: (file.size / 1024).toFixed(1) + ' KB',
        data: reader.result
      });
      if (notify) notify(`फ़ाइल संलग्न की गई: ${file.name}`);
    };
    reader.readAsDataURL(file);
  };

  // 5. Add Emoji
  const handleAddEmoji = (emoji) => {
    setMsgText(prev => prev + emoji);
  };

  // 6. Sequential 1-by-1 Sending
  const handleSendMessages = async () => {
    const targets = numberStats.unique;
    if (targets.length === 0) {
      if (notify) notify('कम से कम एक वैध 10-अंकीय मोबाइल नंबर दर्ज करें।');
      return;
    }
    if (!msgText.trim() && !attachment) {
      if (notify) notify('मैसेज टेक्स्ट लिखें या कोई अटैचमेंट फ़ाइल जोड़ें।');
      return;
    }

    const currentSessionObj = sessions.find(s => s.id === selectedSession || s.sessionId === selectedSession);
    if (currentSessionObj && currentSessionObj.status !== 'connected') {
      if (notify) notify('चयनित WhatsApp कनेक्टेड नहीं है। कृपया पहले Dashboard से QR कोड स्कैन करें।');
      return;
    }

    cancelSendingRef.current = false;
    setSendingProgress({
      active: true,
      current: 0,
      total: targets.length,
      currentNumber: '',
      statusText: 'भेजना शुरू हो रहा है...',
      sentCount: 0,
      failCount: 0
    });

    let sent = 0;
    let failed = 0;
    let lastError = '';

    for (let i = 0; i < targets.length; i++) {
      if (cancelSendingRef.current) {
        if (notify) notify('मैसेज भेजना रोक दिया गया।');
        break;
      }

      const num = targets[i];
      setSendingProgress(prev => ({
        ...prev,
        current: i + 1,
        currentNumber: num,
        statusText: `भेजा जा रहा है (${i + 1}/${targets.length}): +91 ${num}`
      }));

      try {
        await api('/api/user/send', {
          method: 'POST',
          body: JSON.stringify({
            to: num,
            text: msgText.trim(),
            attachment: attachment ? { name: attachment.name, type: attachment.type, data: attachment.data } : null,
            session: selectedSession
          })
        });
        sent++;
      } catch (err) {
        failed++;
        lastError = err.message || '';
        console.error(`Send to ${num} failed:`, err.message);
      }

      setSendingProgress(prev => ({
        ...prev,
        sentCount: sent,
        failCount: failed
      }));

      // 1.2s delay between messages to protect account from anti-spam limits
      if (i < targets.length - 1 && !cancelSendingRef.current) {
        await new Promise(res => setTimeout(res, 1200));
      }
    }

    setSendingProgress(prev => ({
      ...prev,
      active: false,
      statusText: `पूरा हुआ! भेजे गए: ${sent}, विफल: ${failed}`
    }));

    if (sent > 0) {
      if (notify) notify(`✓ ${sent} संदेश सफलतापूर्वक भेज दिए गए!`);
    } else if (failed > 0) {
      if (notify) notify(lastError ? `मैसेज भेजने में समस्या हुई: ${lastError}` : `मैसेज भेजने में समस्या हुई। कृपया WhatsApp कनेक्शन जांचें।`);
    }
  };

  const handleStopSending = () => {
    cancelSendingRef.current = true;
  };

  return (
    <section className="page-content">
      <div className="send-page-container">
        
        {/* Left Column: Send Form */}
        <div className="send-main-card">
          <span className="eyebrow">DIRECT / BULK WHATSAPP DISPATCH</span>
          <h2 style={{margin:'6px 0 4px', fontSize:22}}>Send WhatsApp Message</h2>
          <p style={{color:'#728498', fontSize:12, margin:'0 0 20px'}}>
            अपने स्कैन किए गए WhatsApp नंबर से सिंगल या मल्टीपल संदेश सुरक्षित तरीके से भेजें।
          </p>

          {/* 1. Choose WhatsApp Dropdown */}
          <div className="field-group">
            <div className="field-label">
              <span>Choose WhatsApp Account (व्हाट्सएप चुनें)</span>
              <button 
                type="button" 
                onClick={loadSessions} 
                className="tool-btn" 
                style={{padding:'3px 9px', fontSize:11}}
              >
                {loadingSessions ? 'लोड हो रहा है...' : '↻ Refresh Accounts'}
              </button>
            </div>
            <select 
              className="field-select" 
              value={selectedSession} 
              onChange={e => setSelectedSession(e.target.value)}
            >
              {sessions.length === 0 && <option value="">कोई WhatsApp अकाउंट उपलब्ध नहीं है</option>}
              {sessions.map(s => (
                <option key={s.id || s.sessionId} value={s.id || s.sessionId}>
                  {s.display || s.name} {s.status === 'connected' ? '✓' : '(Offline / Not Connected)'}
                </option>
              ))}
            </select>
          </div>

          {/* 2. Type Number & Upload Excel Toolbar */}
          <div className="field-group">
            <div className="field-label">
              <span>Type Number / Mobile Numbers (मोबाइल नंबर)</span>
              <small>सिंगल या कॉमा (,) लगाकर मल्टीपल नंबर दर्ज करें</small>
            </div>

            <div className="numbers-toolbar">
              {/* Sample Excel Button */}
              <button 
                type="button" 
                className="tool-btn" 
                onClick={downloadSampleExcel}
                title="Download Sample Excel template with Number column"
              >
                📥 Sample Excel
              </button>

              {/* Upload Excel Button */}
              <input 
                type="file" 
                ref={excelInputRef} 
                accept=".xlsx, .xls, .csv" 
                hidden 
                onChange={handleExcelUpload} 
              />
              <button 
                type="button" 
                className="tool-btn primary-tool" 
                onClick={() => excelInputRef.current?.click()}
                title="Upload Excel or CSV file containing Number column"
              >
                📁 Upload Excel / CSV
              </button>

              {/* Remove Duplicates Button */}
              <button 
                type="button" 
                className="tool-btn danger-tool" 
                onClick={handleRemoveDuplicates}
                title="Remove duplicate numbers and invalid entries"
              >
                🗑️ Remove Duplicates
              </button>

              {/* Counter Badge */}
              <span className="numbers-stat-badge">
                Total: {numberStats.total} | Unique: {numberStats.unique.length}
              </span>
            </div>

            <textarea 
              className="field-textarea" 
              rows={4}
              placeholder="यहाँ 10 अंकों का मोबाइल नंबर डालें (Single या Comma/Enter लगाकर Multiple, जैसे: 9876543210, 9123456789)..."
              value={numbersText}
              onChange={e => setNumbersText(e.target.value)}
            />
            {numberStats.invalid.length > 0 && (
              <small style={{display:'block', color:'#d32f2f', fontSize:11, marginTop:4}}>
                ⚠ {numberStats.invalid.length} अमान्य प्रविष्टियां हैं (जैसे: {numberStats.invalid.slice(0, 3).join(', ')})। इन्हें हटाने के लिए "Remove Duplicates" दबाएं।
              </small>
            )}
          </div>

          {/* 3. Type Message Box with compact Attachment, Emoji, Send button at bottom */}
          <div className="field-group" style={{marginBottom:10}}>
            <div className="field-label">
              <span>Type Message (संदेश लिखें)</span>
              <small>{msgText.length} characters</small>
            </div>

            <div className="message-box-wrap">
              {/* Attachment chip if file selected */}
              {attachment && (
                <div className="attachment-tag">
                  <span>📎 {attachment.name} ({attachment.size})</span>
                  <button type="button" onClick={() => setAttachment(null)}>×</button>
                </div>
              )}

              <textarea 
                className="main-msg-textarea"
                rows={4}
                placeholder="यहाँ अपना मैसेज लिखें (Type your message here)..."
                value={msgText}
                onChange={e => setMsgText(e.target.value)}
              />

              {/* Compact bottom action bar: Attachment, Emoji, Send button */}
              <div className="msg-action-bar">
                <div className="msg-tools-group">
                  {/* Attachment Button */}
                  <input 
                    type="file" 
                    ref={fileInputRef} 
                    hidden 
                    onChange={handleAttachment} 
                  />
                  <button 
                    type="button" 
                    className="tool-icon-btn" 
                    onClick={() => fileInputRef.current?.click()}
                    title="Attach Image, Video, or Document"
                  >
                    📎 Attach
                  </button>

                  {/* Emoji Picker Button */}
                  <button 
                    type="button" 
                    className="tool-icon-btn" 
                    onClick={() => setShowEmojiPicker(prev => !prev)}
                    title="Insert Emojis"
                  >
                    😊 Emoji
                  </button>

                  {/* Emoji Popover */}
                  {showEmojiPicker && (
                    <div className="emoji-popover-box">
                      {QUICK_EMOJIS.map(emoji => (
                        <button 
                          type="button" 
                          key={emoji} 
                          className="single-emoji-btn" 
                          onClick={() => { handleAddEmoji(emoji); }}
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Send Button */}
                <button 
                  type="button" 
                  className="btn-send-main"
                  disabled={sendingProgress.active || numberStats.unique.length === 0 || (!msgText.trim() && !attachment)}
                  onClick={handleSendMessages}
                >
                  {sendingProgress.active ? 'Sending...' : `🚀 Send Message (${numberStats.unique.length})`}
                </button>
              </div>
            </div>
          </div>

          {/* Sequential Live Sending Progress */}
          {sendingProgress.active && (
            <div className="sending-progress-container">
              <div className="progress-header-row">
                <span>{sendingProgress.statusText}</span>
                <button type="button" className="btn-stop-sending" onClick={handleStopSending}>
                  ⏹ Cancel / Stop
                </button>
              </div>
              <div className="progress-bar-track">
                <div 
                  className="progress-bar-fill" 
                  style={{width: `${Math.round((sendingProgress.current / sendingProgress.total) * 100)}%`}} 
                />
              </div>
              <div style={{display:'flex', justifyContent:'space-between', fontSize:11, color:'#0b694e', marginTop:6}}>
                <span>Sent: {sendingProgress.sentCount} | Failed: {sendingProgress.failCount}</span>
                <span>{Math.round((sendingProgress.current / sendingProgress.total) * 100)}%</span>
              </div>
            </div>
          )}

        </div>

        {/* Right Column: How to Use Guide */}
        <div className="how-to-guide-card">
          <div className="how-to-header">
            <span style={{fontSize:22}}>📖</span>
            <div>
              <h3>How to Use</h3>
              <small style={{color:'#7e8e9f'}}>उपयोग करने का पूरा तरीका (Step-by-Step)</small>
            </div>
          </div>

          <div className="how-to-steps">
            
            <div className="how-step">
              <div className="step-num-badge">1</div>
              <div className="step-content">
                <strong>Choose WhatsApp (व्हाट्सएप चुनें)</strong>
                Dropdown सूची से अपना कनेक्टेड WhatsApp अकाउंट सेलेक्ट करें। (यदि कोई कनेक्ट नहीं है, तो पहले Dashboard टैब में जाकर अपना QR कोड स्कैन करें)।
              </div>
            </div>

            <div className="how-step">
              <div className="step-num-badge">2</div>
              <div className="step-content">
                <strong>Type Number (नंबर दर्ज करें)</strong>
                मोबाइल नंबर बॉक्स में 10 अंकों का नंबर टाइप करें। आप एक नंबर या कॉमा (,) लगाकर एक साथ कई नंबर डाल सकते हैं।
              </div>
            </div>

            <div className="how-step">
              <div className="step-num-badge">3</div>
              <div className="step-content">
                <strong>Upload Excel & Sample (एक्सेल अपलोड)</strong>
                <b>Sample Excel</b> बटन दबाकर सही फ़ाइल फॉर्मेट देखें। <b>Upload Excel / CSV</b> से अपनी फ़ाइल अपलोड करें — सिस्टम शीट में से केवल "Number" वाले कॉलम को अपने आप पहचानकर नंबर निकाल लेगा।
              </div>
            </div>

            <div className="how-step">
              <div className="step-num-badge">4</div>
              <div className="step-content">
                <strong>Remove Duplicates (डुप्लिकेट हटाएं)</strong>
                <b>Remove Duplicates</b> बटन पर क्लिक करें। इससे बार-बार आने वाले और अमान्य नंबर तुरंत हट जाएंगे और केवल सही 10-अंकीय यूनिक नंबर बचेंगे।
              </div>
            </div>

            <div className="how-step">
              <div className="step-num-badge">5</div>
              <div className="step-content">
                <strong>Message, Emoji & Attachment</strong>
                मैसेज बॉक्स में अपना टेक्स्ट लिखें। नीचे दिए गए <b>😊 Emoji</b> बटन से इमोजी लगाएं और <b>📎 Attach</b> बटन से फ़ोटो, PDF या कोई भी डॉक्यूमेंट जोड़ें।
              </div>
            </div>

            <div className="how-step">
              <div className="step-num-badge">6</div>
              <div className="step-content">
                <strong>Send Message (1-by-1 सुरक्षित डिलीवरी)</strong>
                <b>Send Message</b> बटन दबाएं। सिस्टम हर नंबर पर सुरक्षित 1.2 सेकंड के अंतराल से 1-by-1 मैसेज भेजेगा ताकि आपका व्हाट्सएप अकाउंट सुरक्षित रहे।
              </div>
            </div>

          </div>

          <div className="guide-tip-box">
            💡 <b>सुरक्षा टिप:</b> बल्क मैसेजिंग के दौरान 1-by-1 सुरक्षित डिलीवरी और वैध 10-अंकीय भारतीय मोबाइल नंबरों का ही उपयोग करें। स्टेटस देखने के लिए <b>Message Reports</b> टैब देखें।
          </div>

        </div>

      </div>
    </section>
  );
}

function ReportsPage({ reports, stats, refresh }) { 
  return <section className="page-content">
    <div className="section-head">
      <div>
        <span className="eyebrow">DELIVERY LOG</span>
        <h2>Message reports</h2>
        <p>आउटगोइंग मैसेज की स्थिति और रिपोर्ट्स</p>
      </div>
      <button className="secondary" onClick={refresh}>↻ Refresh</button>
    </div>
    <div className="stat-grid">
      <Stat value={stats.total ?? reports.length} label="Total" icon="▤" />
      <Stat value={stats.sent ?? '-'} label="Sent" icon="✓" />
      <Stat value={stats.failed ?? '-'} label="Failed" icon="!" />
      <Stat value={stats.pending ?? '-'} label="Pending" icon="◷" />
    </div>
    <div className="table-card">
      <table>
        <thead><tr><th>Date</th><th>To</th><th>Message</th><th>Status</th></tr></thead>
        <tbody>
          {reports.slice(0, 100).map((r, i) => (
            <tr key={r.id || i}>
              <td>{r.date ? new Date(r.date).toLocaleString() : '-'}</td>
              <td>{r.to || r.recipient || r.number || '-'}</td>
              <td>{r.message || r.text || '-'}</td>
              <td><span className="status-pill">{r.status || 'sent'}</span></td>
            </tr>
          ))}
        </tbody>
      </table>
      {!reports.length && <Empty text="No message reports yet" />}
    </div>
  </section> 
}

function ApiPage({ notify }) { 
  const [data, setData] = useState(null)
  const [err, setErr] = useState('')
  const [copied, setCopied] = useState('')
  const [testTo, setTestTo] = useState('')
  const [testMsg, setTestMsg] = useState('Hello from WhatsApp API!')
  const [testResult, setTestResult] = useState(null)
  const [testing, setTesting] = useState(false)
  const [regenLoading, setRegenLoading] = useState(false)

  const loadApiData = useCallback(() => {
    api('/api/user/api-token')
      .then(setData)
      .catch(() => {
        api('/api/settings/api-token').then(setData).catch(e => setErr(e.message))
      })
  }, [])

  useEffect(() => {
    loadApiData()
  }, [loadApiData])

  const copyText = (text, label) => {
    navigator.clipboard.writeText(text)
    setCopied(label)
    if (notify) notify(`${label} copied to clipboard!`)
    setTimeout(() => setCopied(''), 2500)
  }

  const regenerateToken = async () => {
    if (!window.confirm('क्या आप नया API Token जनरेट करना चाहते हैं? पुराना टोकन काम करना बंद कर देगा।')) return
    setRegenLoading(true)
    try {
      const res = await api('/api/user/api-token/regenerate', { method: 'POST' })
      if (res.success) {
        if (notify) notify('नया API Token सफलतापूर्वक बन गया!')
        loadApiData()
      }
    } catch (e) {
      alert(e.message || 'Token regeneration failed')
    } finally {
      setRegenLoading(false)
    }
  }

  const runTestApi = async (e) => {
    e.preventDefault()
    if (!testTo.trim() || !testMsg.trim()) {
      alert('Recipient Number और Message दोनों दर्ज करें।')
      return
    }
    setTesting(true)
    setTestResult(null)
    try {
      const url = `/send-text?token=${encodeURIComponent(data?.token || '')}&to=${encodeURIComponent(testTo.trim())}&message=${encodeURIComponent(testMsg.trim())}${data?.session ? `&session=${encodeURIComponent(data.session)}` : ''}`
      const res = await fetch(url)
      const json = await res.json()
      setTestResult(json)
      if (json.status) {
        if (notify) notify('API Test message sent successfully!')
      }
    } catch (e) {
      setTestResult({ status: false, message: e.message })
    } finally {
      setTesting(false)
    }
  }

  const sampleUrl = data?.sampleProductionUrl || data?.sampleUrl || `https://local-whatsapp.onrender.com/send-text?token=${data?.token || 'YOUR_TOKEN'}&to=9876543210&message=Hello${data?.session ? `&session=${data.session}` : ''}`

  return <section className="page-content">
    <div className="section-head">
      <div>
        <span className="eyebrow">DEVELOPER & EXTERNAL INTEGRATION</span>
        <h2>WhatsApp Send-Text API</h2>
        <p>इस API का उपयोग करके किसी भी सॉफ्टवेयर, CRM या वेबसाइट से ऑटोमैटिक WhatsApp मैसेज भेजें।</p>
      </div>
    </div>

    {err && <div className="alert">⚠ {err}</div>}

    {/* Token & Session Card */}
    <div className="api-card" style={{marginBottom:24}}>
      <h3>🔑 आपकी API क्रेडेंशियल्स (API Credentials)</h3>
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit, minmax(280px, 1fr))',gap:16,marginTop:14}}>
        <div style={{background:'#f8fafc',padding:16,borderRadius:10,border:'1px solid #e2e8f0'}}>
          <small style={{color:'#64748b',fontWeight:700,display:'block',marginBottom:6}}>YOUR API TOKEN</small>
          <div style={{display:'flex',gap:8,alignItems:'center'}}>
            <code style={{fontSize:14,background:'#fff',padding:'8px 12px',borderRadius:6,border:'1px solid #cbd5e1',flex:1,wordBreak:'break-all'}}>
              {data?.token || 'Loading...'}
            </code>
            <button className="secondary" onClick={() => copyText(data?.token || '', 'Token')} style={{padding:'8px 12px'}}>
              {copied === 'Token' ? '✓ Copied' : '📋 Copy'}
            </button>
            <button className="secondary" onClick={regenerateToken} disabled={regenLoading} title="Generate New Token" style={{padding:'8px 10px'}}>
              {regenLoading ? '...' : '🔄'}
            </button>
          </div>
        </div>

        <div style={{background:'#f8fafc',padding:16,borderRadius:10,border:'1px solid #e2e8f0'}}>
          <small style={{color:'#64748b',fontWeight:700,display:'block',marginBottom:6}}>YOUR SCANNED WHATSAPP SESSION</small>
          <div style={{display:'flex',gap:8,alignItems:'center'}}>
            <span style={{fontSize:16,fontWeight:700,color:'#0f172a',background:'#fff',padding:'8px 14px',borderRadius:6,border:'1px solid #cbd5e1',flex:1}}>
              {data?.session ? `+91 ${data.session}` : (data?.connectedNumber ? `+${data.connectedNumber}` : 'Not Scanned Yet')}
            </span>
            <span style={{
              padding:'6px 12px',
              borderRadius:20,
              fontSize:12,
              fontWeight:700,
              background: data?.status === 'connected' ? '#dcfce7' : '#fee2e2',
              color: data?.status === 'connected' ? '#15803d' : '#b91c1c'
            }}>
              {data?.status === 'connected' ? '● Connected' : '○ Offline'}
            </span>
          </div>
        </div>
      </div>
    </div>

    {/* Live API URL Card */}
    <div className="api-card" style={{marginBottom:24}}>
      <h3>🌐 HTTP GET / POST Endpoint URL</h3>
      <p style={{color:'#666',fontSize:13,margin:'6px 0 12px'}}>
        निचे दिए गए URL पर GET या POST रिक्वेस्ट भेजकर अपने स्कैन किए हुए WhatsApp नंबर से तुरंत मैसेज भेजें:
      </p>

      <div style={{background:'#1e293b',color:'#f8fafc',padding:'14px 16px',borderRadius:10,fontFamily:'monospace',fontSize:13,overflowX:'auto',display:'flex',alignItems:'center',justifyContent:'space-between',gap:12}}>
        <span style={{wordBreak:'break-all'}}>{sampleUrl}</span>
        <button 
          onClick={() => copyText(sampleUrl, 'API URL')} 
          style={{background:'#128c7e',color:'#fff',border:'none',borderRadius:6,padding:'8px 14px',fontWeight:700,cursor:'pointer',whiteSpace:'nowrap'}}
        >
          {copied === 'API URL' ? '✓ Copied' : '📋 Copy URL'}
        </button>
      </div>

      <div style={{marginTop:20}}>
        <h4 style={{margin:'0 0 10px',fontSize:14}}>Parameter विवरण (Query Parameters):</h4>
        <table style={{width:'100%',borderCollapse:'collapse',fontSize:13}}>
          <thead>
            <tr style={{background:'#f1f5f9',textAlign:'left'}}>
              <th style={{padding:8,border:'1px solid #e2e8f0'}}>Parameter</th>
              <th style={{padding:8,border:'1px solid #e2e8f0'}}>Type</th>
              <th style={{padding:8,border:'1px solid #e2e8f0'}}>Required</th>
              <th style={{padding:8,border:'1px solid #e2e8f0'}}>विवरण (Description)</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style={{padding:8,border:'1px solid #e2e8f0'}}><code>token</code></td>
              <td style={{padding:8,border:'1px solid #e2e8f0'}}>String</td>
              <td style={{padding:8,border:'1px solid #e2e8f0',color:'#16a34a',fontWeight:700}}>Yes</td>
              <td style={{padding:8,border:'1px solid #e2e8f0'}}>आपका API Token (ऊपर से कॉपी करें)</td>
            </tr>
            <tr>
              <td style={{padding:8,border:'1px solid #e2e8f0'}}><code>to</code></td>
              <td style={{padding:8,border:'1px solid #e2e8f0'}}>String</td>
              <td style={{padding:8,border:'1px solid #e2e8f0',color:'#16a34a',fontWeight:700}}>Yes</td>
              <td style={{padding:8,border:'1px solid #e2e8f0'}}>10-digit मोबाइल नंबर (e.g. 9876543210) या WhatsApp Group ID (e.g. 120363049565083040@g.us)</td>
            </tr>
            <tr>
              <td style={{padding:8,border:'1px solid #e2e8f0'}}><code>message</code></td>
              <td style={{padding:8,border:'1px solid #e2e8f0'}}>String</td>
              <td style={{padding:8,border:'1px solid #e2e8f0',color:'#16a34a',fontWeight:700}}>Yes</td>
              <td style={{padding:8,border:'1px solid #e2e8f0'}}>भेजा जाने वाला टेक्स्ट संदेश (URL Encoded)</td>
            </tr>
            <tr>
              <td style={{padding:8,border:'1px solid #e2e8f0'}}><code>session</code></td>
              <td style={{padding:8,border:'1px solid #e2e8f0'}}>String</td>
              <td style={{padding:8,border:'1px solid #e2e8f0',color:'#d97706'}}>Optional</td>
              <td style={{padding:8,border:'1px solid #e2e8f0'}}>आपका 10 अंकों का स्कैन WhatsApp नंबर (e.g. {data?.session || '9876543210'})</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    {/* Live API Tester */}
    <div className="api-card">
      <h3>⚡ Live API Tester (यहाँ से टेस्ट करें)</h3>
      <p style={{color:'#666',fontSize:13,margin:'4px 0 16px'}}>नीचे नंबर/ग्रुप ID और मैसेज लिखकर सीधे API चलाकर टेस्ट करें:</p>
      
      <form onSubmit={runTestApi} style={{display:'grid',gridTemplateColumns:'repeat(auto-fit, minmax(240px, 1fr))',gap:12,alignItems:'end'}}>
        <div>
          <label style={{display:'block',fontSize:13,fontWeight:700,marginBottom:4}}>Recipient (मोबाइल नंबर या Group ID)</label>
          <input 
            placeholder="मोबाइल नंबर (e.g. 9876543210) या Group ID (@g.us)" 
            value={testTo} 
            onChange={e => setTestTo(e.target.value)} 
            style={{width:'100%',padding:'10px 12px',borderRadius:8,border:'1px solid #cbd5e1'}}
          />
        </div>
        <div>
          <label style={{display:'block',fontSize:13,fontWeight:700,marginBottom:4}}>Message</label>
          <input 
            placeholder="मैसेज लिखें..." 
            value={testMsg} 
            onChange={e => setTestMsg(e.target.value)} 
            style={{width:'100%',padding:'10px 12px',borderRadius:8,border:'1px solid #cbd5e1'}}
          />
        </div>
        <div>
          <button className="primary" disabled={testing || !data?.token} style={{width:'100%',padding:'11px'}}>
            {testing ? 'Sending...' : '🚀 Send Test API Request'}
          </button>
        </div>
      </form>

      {testResult && (
        <div style={{marginTop:16,background: testResult.status ? '#f0fdf4' : '#fef2f2',border:`1px solid ${testResult.status ? '#bbf7d0' : '#fecaca'}`,borderRadius:8,padding:14}}>
          <b style={{color: testResult.status ? '#16a34a' : '#dc2626'}}>
            {testResult.status ? '✓ Success: ' : '✗ Error: '}
            {testResult.message}
          </b>
          <pre style={{marginTop:8,fontSize:12,overflowX:'auto',background:'#fff',padding:10,borderRadius:6,border:'1px solid #e2e8f0'}}>
            {JSON.stringify(testResult, null, 2)}
          </pre>
        </div>
      )}
    </div>
  </section> 
}

function SystemPage({ status, currentUser, notify }) { 
  const isAdmin = currentUser?.role === 'admin'
  const [info, setInfo] = useState(null)
  const [pingData, setPingData] = useState(null)
  const [pinging, setPinging] = useState(false)
  const [curPass, setCurPass] = useState('')
  const [newPass, setNewPass] = useState('')
  const [passErr, setPassErr] = useState('')
  const [passOk, setPassOk] = useState('')
  const [savingPass, setSavingPass] = useState(false)

  const loadPingStatus = useCallback(() => {
    if (!isAdmin) return
    api('/api/system/autoping').then(setPingData).catch(() => {})
  }, [isAdmin])

  useEffect(() => { 
    if (isAdmin) {
      api('/api/admin/system-info').then(d => setInfo(d.info)).catch(() => {}) 
      loadPingStatus()
      const t = setInterval(loadPingStatus, 15000)
      return () => clearInterval(t)
    }
  }, [isAdmin, loadPingStatus])

  const triggerManualPing = async () => {
    if (!isAdmin) return
    setPinging(true)
    try {
      const res = await api('/api/system/autoping/trigger', { method: 'POST' })
      setPingData(res)
      if (notify) notify('Keep-Alive Ping सफलतापुर्वक भेजा गया!')
    } catch (e) {
      if (notify) notify('Ping failed: ' + e.message)
    } finally {
      setPinging(false)
    }
  }

  const handleChangePassword = async (e) => {
    e.preventDefault()
    setPassErr('')
    setPassOk('')
    if (!curPass || !newPass) return setPassErr('वर्तमान और नया पासवर्ड दोनों दर्ज करें।')
    if (newPass.length < 6) return setPassErr('नया पासवर्ड कम से कम 6 अक्षरों का होना चाहिए।')
    setSavingPass(true)
    try {
      const res = await api('/api/auth/change-password', {
        method: 'POST',
        body: JSON.stringify({ currentPassword: curPass, newPassword: newPass })
      })
      setPassOk(res.message || 'पासवर्ड बदल दिया गया!')
      setCurPass('')
      setNewPass('')
      notify('पासवर्ड सफलतापूर्वक अपडेट हुआ!')
    } catch (e) {
      setPassErr(e.message || 'पासवर्ड बदलने में त्रुटि')
    } finally {
      setSavingPass(false)
    }
  }

  const infoItems = [
    ['Account User ID', currentUser?.userId || 'USR'],
    ['Login Username', currentUser?.username || currentUser?.mobile || (isAdmin ? 'Admin' : 'User')],
    ['WhatsApp Status', status.status],
    ['Connected Number', status.number ? '+' + status.number : 'Not connected'],
    ...(isAdmin ? [
      ['Render Keep-Alive', 'Active (24/7 Awake)'],
      ...(info?.nodeVersion ? [['Node.js Version', info.nodeVersion]] : []),
      ...(info?.uptime ? [['Uptime', info.uptime]] : [])
    ] : [])
  ]

  return <section className="page-content">
    <div className="section-head">
      <div>
        <span className="eyebrow">{isAdmin ? 'SYSTEM & SECURITY' : 'ACCOUNT SECURITY'}</span>
        <h2>{isAdmin ? 'System & Account Settings' : 'Account & Security Settings'}</h2>
        <p>{isAdmin ? 'अकाउंट सुरक्षा, सर्वर की स्थिति और Render 24/7 Keep-Alive जानकारी' : 'अकाउंट सुरक्षा और पासवर्ड सेटिंग्स'}</p>
      </div>
    </div>

    {/* Auto-Ping / Render Sleep Prevention Card - Admin only */}
    {isAdmin && (
      <div className="api-card" style={{marginBottom:24}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',flexWrap:'wrap',gap:8}}>
          <div>
            <h3 style={{margin:0}}>⏰ Server Auto-Ping (Render 24/7 Keep-Alive)</h3>
            <p style={{color:'#666',fontSize:13,margin:'4px 0 0'}}>
              Render सर्वर 10-15 मिनट में स्लीप (Sleep) होने से रोकने के लिए ऑटो-पिंग लगातार सक्रिय है:
            </p>
          </div>
          <button className="secondary" onClick={triggerManualPing} disabled={pinging} style={{padding:'7px 14px',fontSize:12}}>
            {pinging ? 'Pinging...' : '⚡ Ping Now'}
          </button>
        </div>

        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit, minmax(200px, 1fr))',gap:12,marginTop:14}}>
          <div style={{background:'#f8fafc',padding:12,borderRadius:8,border:'1px solid #e2e8f0'}}>
            <small style={{color:'#64748b',fontWeight:700,display:'block',marginBottom:4}}>स्थिति (Status)</small>
            <strong style={{color:'#16a34a'}}>● Active (24/7 Awake)</strong>
          </div>
          <div style={{background:'#f8fafc',padding:12,borderRadius:8,border:'1px solid #e2e8f0'}}>
            <small style={{color:'#64748b',fontWeight:700,display:'block',marginBottom:4}}>Ping Frequency</small>
            <strong>हर {pingData?.stats?.intervalMinutes || 5} मिनट में</strong>
          </div>
          <div style={{background:'#f8fafc',padding:12,borderRadius:8,border:'1px solid #e2e8f0'}}>
            <small style={{color:'#64748b',fontWeight:700,display:'block',marginBottom:4}}>Last Ping Result</small>
            <strong style={{fontSize:12,color:'#0f172a',wordBreak:'break-all'}}>{pingData?.stats?.lastPingStatus || 'Starting...'}</strong>
          </div>
          <div style={{background:'#f8fafc',padding:12,borderRadius:8,border:'1px solid #e2e8f0'}}>
            <small style={{color:'#64748b',fontWeight:700,display:'block',marginBottom:4}}>Total Pings Sent</small>
            <strong>{pingData?.stats?.totalPings || 0} Pings</strong>
          </div>
        </div>
      </div>
    )}

    {/* Change Password Card */}
    <div className="api-card" style={{marginBottom:24}}>
      <h3>🔒 पासवर्ड बदलें (Change Password)</h3>
      <p style={{color:'#666',fontSize:13,margin:'4px 0 16px'}}>WhatsApp पर प्राप्त हुए रैंडम पासवर्ड को यहाँ अपने मनपसंद पासवर्ड से बदलें:</p>
      <form onSubmit={handleChangePassword} style={{maxWidth:400}}>
        <label style={{display:'block',fontSize:13,fontWeight:700,marginBottom:6}}>वर्तमान पासवर्ड (Current Password)
          <input 
            type="password" 
            placeholder="Current Password" 
            value={curPass} 
            onChange={e => setCurPass(e.target.value)} 
            style={{width:'100%',padding:'10px 12px',borderRadius:8,border:'1px solid #ccc',marginTop:4}}
          />
        </label>
        <label style={{display:'block',fontSize:13,fontWeight:700,margin:'12px 0 6px'}}>नया पासवर्ड (New Password)
          <input 
            type="password" 
            placeholder="कम से कम 6 अक्षर" 
            value={newPass} 
            onChange={e => setNewPass(e.target.value)} 
            style={{width:'100%',padding:'10px 12px',borderRadius:8,border:'1px solid #ccc',marginTop:4}}
          />
        </label>
        {passErr && <div className="form-error" style={{marginTop:8}}>{passErr}</div>}
        {passOk && <div style={{color:'#087a5d',background:'#e9f8f2',padding:'8px 12px',borderRadius:6,marginTop:8,fontSize:13}}>{passOk}</div>}
        <button className="primary" style={{marginTop:16}} disabled={savingPass}>
          {savingPass ? 'Updating...' : 'पासवर्ड सेव करें'}
        </button>
      </form>
    </div>

    <div className="info-grid">
      {infoItems.map(([a,b]) => (
        <div className="info-card" key={a}>
          <small>{a}</small>
          <strong>{b}</strong>
        </div>
      ))}
    </div>
  </section>
}

function UsersPage({ notify }) {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [waFilter, setWaFilter] = useState('all')
  const [editingUser, setEditingUser] = useState(null)
  const [editForm, setEditForm] = useState({ name: '', mobile: '', plan: 'Standard', role: 'user', status: 'active' })
  const [savingEdit, setSavingEdit] = useState(false)
  const [actionLoading, setActionLoading] = useState('')
  const [sentNotice, setSentNotice] = useState(null)

  const fetchUsers = useCallback(async () => {
    setLoading(true)
    try {
      const d = await api('/api/admin/users')
      if (d.success) {
        setUsers(d.users || [])
      }
    } catch (e) {
      notify('उपयोगकर्ता लोड करने में त्रुटि: ' + e.message)
    } finally {
      setLoading(false)
    }
  }, [notify])

  useEffect(() => {
    fetchUsers()
  }, [fetchUsers])

  const toggleStatus = async (u) => {
    setActionLoading(u.userId)
    try {
      const d = await api(`/api/admin/users/${u.userId}/toggle-status`, { method: 'POST' })
      if (d.success) {
        notify(`User ${u.name || u.userId} is now ${d.status}`)
        setUsers(prev => prev.map(item => item.userId === u.userId ? { ...item, status: d.status } : item))
      }
    } catch (e) {
      notify('Status update failed: ' + e.message)
    } finally {
      setActionLoading('')
    }
  }

  const sendPassword = async (u) => {
    const confirmSend = window.confirm(`क्या आप यूजर ${u.name || u.userId} (${u.mobile || u.username}) के लिए नया पासवर्ड जेनरेट करके उनके WhatsApp पर भेजना चाहते हैं?`)
    if (!confirmSend) return

    setActionLoading('pwd-' + u.userId)
    try {
      const d = await api(`/api/admin/users/${u.userId}/send-password`, { method: 'POST' })
      if (d.success) {
        setSentNotice({ userId: u.userId, mobile: u.mobile || u.username, newPassword: d.newPassword })
        notify(`नया पासवर्ड ${u.mobile || u.username} के WhatsApp पर भेज दिया गया है!`)
      }
    } catch (e) {
      notify('पासवर्ड भेजने में त्रुटि: ' + e.message)
    } finally {
      setActionLoading('')
    }
  }

  const openEdit = (u) => {
    setEditingUser(u)
    setEditForm({
      name: u.name || '',
      mobile: u.mobile || u.username || '',
      plan: u.plan || 'Standard',
      role: u.role || 'user',
      status: u.status || 'active'
    })
  }

  const saveEdit = async (e) => {
    e.preventDefault()
    if (!editingUser) return
    setSavingEdit(true)
    try {
      const d = await api(`/api/admin/users/${editingUser.userId}`, {
        method: 'PUT',
        body: JSON.stringify(editForm)
      })
      if (d.success) {
        notify('User profile updated successfully!')
        setUsers(prev => prev.map(item => item.userId === editingUser.userId ? { ...item, ...editForm } : item))
        setEditingUser(null)
      }
    } catch (e) {
      notify('Update failed: ' + e.message)
    } finally {
      setSavingEdit(false)
    }
  }

  const filteredUsers = useMemo(() => {
    return users.filter(u => {
      const term = search.toLowerCase().trim()
      const matchesSearch = !term || (
        (u.name && u.name.toLowerCase().includes(term)) ||
        (u.userId && u.userId.toLowerCase().includes(term)) ||
        (u.username && u.username.toLowerCase().includes(term)) ||
        (u.mobile && u.mobile.toLowerCase().includes(term))
      )
      const matchesStatus = statusFilter === 'all' || u.status === statusFilter
      const matchesWa = waFilter === 'all' || (
        waFilter === 'connected' ? u.whatsappStatus === 'connected' :
        waFilter === 'waiting' ? (u.whatsappStatus === 'waiting' || u.whatsappStatus === 'connecting') :
        (u.whatsappStatus === 'disconnected' || !u.whatsappStatus)
      )
      return matchesSearch && matchesStatus && matchesWa
    })
  }, [users, search, statusFilter, waFilter])

  const downloadExcel = () => {
    if (!filteredUsers || filteredUsers.length === 0) {
      notify('डाउनलोड करने के लिए कोई उपयोगकर्ता उपलब्ध नहीं है (No users to export)')
      return
    }
    try {
      const exportData = filteredUsers.map((u, i) => ({
        '#': i + 1,
        'User ID': u.userId || '',
        'Full Name': u.name || u.username || 'N/A',
        'Mobile Number': u.mobile || u.username || '',
        'Role': (u.role || 'user').toUpperCase(),
        'Subscription Plan': u.plan || 'Standard',
        'Account Status': u.status === 'active' ? 'Active' : 'Inactive',
        'WhatsApp Status': u.whatsappStatus === 'connected' ? 'Connected' : (u.whatsappStatus === 'waiting' || u.whatsappStatus === 'connecting') ? 'Waiting Scan' : 'Disconnected',
        'WhatsApp Phone': u.whatsappPhone ? `+${u.whatsappPhone}` : (u.whatsappStatus === 'connected' ? `+${u.mobile || ''}` : 'N/A'),
        'Joined Date': u.createdAt ? new Date(u.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : 'N/A'
      }))

      const ws = XLSX.utils.json_to_sheet(exportData)
      ws['!cols'] = [
        { wch: 6 },
        { wch: 16 },
        { wch: 24 },
        { wch: 18 },
        { wch: 12 },
        { wch: 20 },
        { wch: 16 },
        { wch: 18 },
        { wch: 20 },
        { wch: 18 },
      ]
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, 'Users_List')
      const today = new Date().toISOString().slice(0, 10)
      XLSX.writeFile(wb, `zendash_users_list_${today}.xlsx`)
      notify('✓ Users list downloaded as Excel (.xlsx)!')
    } catch (err) {
      notify('Excel export error: ' + err.message)
    }
  }

  const avatarPalettes = [
    'linear-gradient(135deg, #705ec8, #9b88f8)',
    'linear-gradient(135deg, #fb1c52, #f96387)',
    'linear-gradient(135deg, #2dce89, #48e5a3)',
    'linear-gradient(135deg, #1170e4, #5398f5)',
    'linear-gradient(135deg, #f7b731, #fbd37a)',
    'linear-gradient(135deg, #0d9488, #2dd4bf)',
    'linear-gradient(135deg, #e83e8c, #f37ba9)',
  ]

  return (
    <section className="page-user-management">
      {/* Zendash Page Header */}
      <div className="page-header d-flex flex-wrap align-items-center justify-content-between mb-4">
        <div className="page-leftheader">
          <h4 className="page-title mb-1 font-weight-bold" style={{ fontSize: '1.35rem', color: '#282f53' }}>User List</h4>
          <ol className="breadcrumb mb-0" style={{ background: 'transparent', padding: 0, fontSize: '0.82rem' }}>
            <li className="breadcrumb-item"><a href="#apps" onClick={e => e.preventDefault()} style={{ color: '#705ec8' }}>Apps</a></li>
            <li className="breadcrumb-item"><a href="#users" onClick={e => e.preventDefault()} style={{ color: '#705ec8' }}>User List</a></li>
            <li className="breadcrumb-item active" style={{ color: '#68798b' }}>User List 01</li>
          </ol>
        </div>
        <div className="page-rightheader d-flex align-items-center gap-2 mt-2 mt-sm-0">
          <button 
            className="btn btn-outline-primary d-inline-flex align-items-center"
            onClick={downloadExcel}
            title="Download Users List to Excel (.xlsx)"
            style={{ fontWeight: 600 }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 6 }}>
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
              <polyline points="7 10 12 15 17 10"></polyline>
              <line x1="12" y1="15" x2="12" y2="3"></line>
            </svg>
            Download Excel
          </button>
          <button 
            className="btn btn-primary d-inline-flex align-items-center"
            onClick={fetchUsers}
            disabled={loading}
            title="Refresh Users List"
            style={{ fontWeight: 600 }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={loading ? 'spin-icon' : ''} style={{ marginRight: 6 }}>
              <polyline points="23 4 23 10 17 10"></polyline>
              <polyline points="1 20 1 14 7 14"></polyline>
              <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
            </svg>
            {loading ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>
      </div>

      {/* Filter Toolbar Card */}
      <div className="card mb-4" style={{ borderRadius: 12, border: '1px solid #ebecf1', boxShadow: '0 4px 20px 0 rgba(160, 175, 208, 0.1)' }}>
        <div className="card-body p-3">
          <div className="row align-items-center g-3" style={{ rowGap: 12 }}>
            {/* Search Box */}
            <div className="col-lg-5 col-md-6 col-12">
              <div className="users-search-box" style={{ position: 'relative' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#8fa0b2" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>
                  <circle cx="11" cy="11" r="8"></circle>
                  <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                </svg>
                <input 
                  type="text" 
                  className="form-control"
                  placeholder="Search by name, mobile, user ID..." 
                  value={search} 
                  onChange={e => setSearch(e.target.value)}
                  style={{ paddingLeft: 38, paddingRight: search ? 32 : 12, height: 42, borderRadius: 8, border: '1px solid #d5dce4', fontSize: '0.875rem' }}
                />
                {search && (
                  <button 
                    onClick={() => setSearch('')}
                    style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', border: 'none', background: 'transparent', color: '#9ca3af', cursor: 'pointer', fontSize: 16 }}
                    title="Clear search"
                  >
                    ×
                  </button>
                )}
              </div>
            </div>

            {/* Filter Account Status */}
            <div className="col-lg-3 col-md-3 col-6">
              <select 
                className="form-control filter-select" 
                value={statusFilter} 
                onChange={e => setStatusFilter(e.target.value)}
                style={{ height: 42, borderRadius: 8, border: '1px solid #d5dce4', fontSize: '0.85rem' }}
              >
                <option value="all">Account: All Status (सभी)</option>
                <option value="active">Active Only (सक्रिय)</option>
                <option value="inactive">Inactive Only (निष्क्रिय)</option>
              </select>
            </div>

            {/* Filter WhatsApp Status */}
            <div className="col-lg-2 col-md-3 col-6">
              <select 
                className="form-control filter-select" 
                value={waFilter} 
                onChange={e => setWaFilter(e.target.value)}
                style={{ height: 42, borderRadius: 8, border: '1px solid #d5dce4', fontSize: '0.85rem' }}
              >
                <option value="all">WhatsApp: All</option>
                <option value="connected">Connected 🟢</option>
                <option value="waiting">Waiting Scan 🟡</option>
                <option value="disconnected">Not Connected ⚪</option>
              </select>
            </div>

            {/* Stats Counter & Reset */}
            <div className="col-lg-2 col-md-12 col-12 d-flex align-items-center justify-content-lg-end justify-content-between">
              <div className="text-muted" style={{ fontSize: '0.85rem', fontWeight: 600 }}>
                Showing <span style={{ color: '#705ec8', fontWeight: 700 }}>{filteredUsers.length}</span> of {users.length} Users
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Temporary Password Notice Alert */}
      {sentNotice && (
        <div className="alert alert-success d-flex align-items-center justify-content-between mb-4 p-3" style={{ borderRadius: 10, border: '1px solid #7ae0bd', background: '#e9f8f2', color: '#055b44' }}>
          <div>
            ✓ <strong>Password Sent to WhatsApp!</strong> User <strong>{sentNotice.mobile}</strong> ({sentNotice.userId}) को नया पासवर्ड भेज दिया गया है। 
            Temporary Password: <code style={{ background: '#fff', padding: '2px 8px', borderRadius: 4, border: '1px solid #7ae0bd', fontWeight: 'bold', color: '#0d835f', marginLeft: 6 }}>{sentNotice.newPassword}</code>
          </div>
          <button onClick={() => setSentNotice(null)} style={{ background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: '#055b44', fontWeight: 700 }}>×</button>
        </div>
      )}

      {/* Zendash users-list-1.html Table Layout */}
      <div className="row">
        <div className="col-12">
          <div className="row flex-lg-nowrap">
            <div className="col-12 mb-3">
              <div className="e-panel card" style={{ borderRadius: 12, border: '1px solid #ebecf1', boxShadow: '0 4px 20px 0 rgba(160, 175, 208, 0.12)' }}>
                <div className="card-body">
                  <div className="e-table">
                    <div className="table-responsive table-lg mt-3">
                      <table className="table table-bordered border-top text-nowrap mb-0" id="example1">
                        <thead>
                          <tr style={{ background: '#f8fafc', color: '#505d69' }}>
                            <th className="align-top border-bottom-0 wd-5 text-center" style={{ width: '45px' }}>#</th>
                            <th className="border-bottom-0 w-20">User</th>
                            <th className="border-bottom-0 w-20">Mobile / WhatsApp</th>
                            <th className="border-bottom-0 w-15">Date of joining</th>
                            <th className="border-bottom-0 w-20">Performance</th>
                            <th className="border-bottom-0 w-10">Account Status</th>
                            <th className="border-bottom-0 w-15 text-center">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {loading ? (
                            <tr>
                              <td colSpan={7} style={{ textAlign: 'center', padding: '48px 20px', color: '#6b7280' }}>
                                <div className="spinner-border spinner-border-sm text-primary" role="status" style={{ marginRight: 8, display: 'inline-block' }}></div>
                                उपयोगकर्ता लोड हो रहे हैं (Loading registered users)...
                              </td>
                            </tr>
                          ) : filteredUsers.length === 0 ? (
                            <tr>
                              <td colSpan={7} style={{ textAlign: 'center', padding: '48px 20px', color: '#6b7280' }}>
                                <div style={{ fontSize: 28, marginBottom: 8 }}>🔍</div>
                                <strong style={{ display: 'block', fontSize: 15, color: '#282f53' }}>कोई उपयोगकर्ता नहीं मिला</strong>
                                <span style={{ fontSize: 13, color: '#8fa0b2' }}>No users found matching your search or filters.</span>
                              </td>
                            </tr>
                          ) : (
                            filteredUsers.map((u, index) => {
                              const avatarLetter = (u.name || u.username || 'U')[0].toUpperCase()
                              const avatarBg = avatarPalettes[index % avatarPalettes.length]
                              const perfPercent = u.status === 'active' ? (u.whatsappStatus === 'connected' ? 85 : 50) : 15

                              return (
                                <tr key={u.userId || u._id}>
                                  <td className="align-middle text-center text-muted font-weight-bold" style={{ fontSize: 13 }}>
                                    {index + 1}
                                  </td>
                                  <td className="align-middle">
                                    <div className="d-flex align-items-center">
                                      <span 
                                        className="avatar brround avatar-md d-inline-flex align-items-center justify-content-center text-white font-weight-bold flex-shrink-0"
                                        style={{ background: avatarBg, boxShadow: '0 2px 6px rgba(0,0,0,0.12)' }}
                                      >
                                        {avatarLetter}
                                      </span>
                                      <div className="ml-3 mt-1" style={{ marginLeft: 12 }}>
                                        <h6 className="mb-0 font-weight-bold" style={{ color: '#282f53', fontSize: 14 }}>
                                          {u.name || u.username || 'No Name'}
                                        </h6>
                                        <div className="d-flex align-items-center gap-1 mt-1">
                                          <small className="text-muted" style={{ fontFamily: 'monospace', fontSize: 11 }}>
                                            {u.userId}
                                          </small>
                                          <span className={`badge ${u.role === 'admin' ? 'badge-primary-light' : 'badge-secondary-light'}`} style={{ fontSize: 10, padding: '2px 6px', marginLeft: 4 }}>
                                            {u.role || 'user'}
                                          </span>
                                        </div>
                                      </div>
                                    </div>
                                  </td>
                                  <td className="align-middle">
                                    <div className="font-weight-bold" style={{ color: '#282f53', fontSize: 13 }}>
                                      +91 {u.mobile || u.username}
                                    </div>
                                    <div className="mt-1">
                                      {u.whatsappStatus === 'connected' ? (
                                        <span className="badge badge-success-light d-inline-flex align-items-center" style={{ fontSize: 11, padding: '3px 8px' }}>
                                          <span className="dot-label bg-success" style={{ width: 6, height: 6, borderRadius: '50%', background: '#22c55e', display: 'inline-block', marginRight: 6 }}></span>
                                          Connected {u.whatsappPhone ? `(+${u.whatsappPhone})` : ''}
                                        </span>
                                      ) : u.whatsappStatus === 'connecting' || u.whatsappStatus === 'waiting' ? (
                                        <span className="badge badge-warning-light d-inline-flex align-items-center" style={{ fontSize: 11, padding: '3px 8px' }}>
                                          <span className="dot-label bg-warning" style={{ width: 6, height: 6, borderRadius: '50%', background: '#f59e0b', display: 'inline-block', marginRight: 6 }}></span>
                                          Waiting Scan
                                        </span>
                                      ) : (
                                        <span className="badge badge-danger-light d-inline-flex align-items-center" style={{ fontSize: 11, padding: '3px 8px' }}>
                                          <span className="dot-label bg-danger" style={{ width: 6, height: 6, borderRadius: '50%', background: '#ef4444', display: 'inline-block', marginRight: 6 }}></span>
                                          Not Connected
                                        </span>
                                      )}
                                    </div>
                                  </td>
                                  <td className="text-nowrap align-middle">
                                    <span style={{ fontSize: 13, color: '#505d69' }}>
                                      {u.createdAt ? new Date(u.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : 'N/A'}
                                    </span>
                                  </td>
                                  <td className="text-nowrap align-middle">
                                    <div className="d-flex align-items-center justify-content-between mb-1">
                                      <span className="badge badge-primary-light font-weight-bold" style={{ fontSize: 11 }}>
                                        {u.plan || 'Standard'}
                                      </span>
                                      <h6 className="mb-0 font-weight-bold" style={{ fontSize: 12, color: '#505d69' }}>{perfPercent}%</h6>
                                    </div>
                                    <div className="progress progress-sm mb-0 mt-1" style={{ height: 6, borderRadius: 10, background: '#f0f2f7' }}>
                                      <div 
                                        className={`progress-bar ${perfPercent >= 70 ? 'bg-primary' : perfPercent >= 40 ? 'bg-warning' : 'bg-danger'}`} 
                                        style={{ 
                                          width: `${perfPercent}%`,
                                          borderRadius: 10,
                                          background: perfPercent >= 70 ? '#705ec8' : perfPercent >= 40 ? '#f59e0b' : '#ef4444'
                                        }}
                                      ></div>
                                    </div>
                                  </td>
                                  <td className="align-middle">
                                    {u.status === 'active' ? (
                                      <span className="badge badge-success-light" style={{ fontSize: 12, padding: '4px 10px', borderRadius: 6 }}>
                                        Active
                                      </span>
                                    ) : (
                                      <span className="badge badge-danger-light" style={{ fontSize: 12, padding: '4px 10px', borderRadius: 6 }}>
                                        Inactive
                                      </span>
                                    )}
                                  </td>
                                  <td className="align-middle text-center">
                                    <div className="btn-group align-top" role="group">
                                      <button 
                                        className="btn btn-sm btn-white btn-svg" 
                                        type="button" 
                                        onClick={() => openEdit(u)}
                                        title="Edit profile"
                                        style={{ border: '1px solid #e1e7ee', color: '#282f53', fontSize: 12, fontWeight: 600, padding: '4px 10px' }}
                                      >
                                        Edit
                                      </button>
                                      <button 
                                        className={`btn btn-sm ${u.status === 'active' ? 'btn-outline-danger' : 'btn-outline-success'}`}
                                        type="button" 
                                        onClick={() => toggleStatus(u)}
                                        disabled={actionLoading === u.userId}
                                        title={u.status === 'active' ? 'Deactivate user account' : 'Activate user account'}
                                        style={{ fontSize: 12, fontWeight: 600, padding: '4px 10px', marginLeft: 4 }}
                                      >
                                        {actionLoading === u.userId ? '...' : u.status === 'active' ? 'Deactivate' : 'Activate'}
                                      </button>
                                      <button 
                                        className="btn btn-sm btn-outline-primary"
                                        type="button" 
                                        onClick={() => sendPassword(u)}
                                        disabled={actionLoading === 'pwd-' + u.userId}
                                        title="Send new random password to user WhatsApp"
                                        style={{ fontSize: 12, fontWeight: 600, padding: '4px 10px', marginLeft: 4 }}
                                      >
                                        {actionLoading === 'pwd-' + u.userId ? '...' : '🔑 Pwd'}
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                              )
                            })
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Zendash Edit User Modal */}
      {editingUser && (
        <div className="modal-overlay" onClick={() => setEditingUser(null)}>
          <div className="modal-content-card" onClick={e => e.stopPropagation()} style={{ maxWidth: 520, borderRadius: 16 }}>
            <div className="modal-header" style={{ padding: '16px 22px', borderBottom: '1px solid #eef2f6' }}>
              <h5 className="modal-title font-weight-bold" style={{ margin: 0, fontSize: 16, color: '#282f53' }}>
                Edit User: {editingUser.name || editingUser.userId}
              </h5>
              <button 
                type="button" 
                onClick={() => setEditingUser(null)}
                style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#8a98ac', fontWeight: 600 }}
              >
                ×
              </button>
            </div>
            <form onSubmit={saveEdit}>
              <div className="modal-body" style={{ padding: 22 }}>
                <div className="form-group mb-3">
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#334455', marginBottom: 6 }}>
                    Full Name (नाम)
                  </label>
                  <input 
                    type="text" 
                    className="form-control"
                    value={editForm.name} 
                    onChange={e => setEditForm(prev => ({ ...prev, name: e.target.value }))} 
                    placeholder="Enter full name"
                    style={{ height: 40, borderRadius: 8, border: '1px solid #d4dce4', width: '100%', padding: '8px 12px' }}
                  />
                </div>
                <div className="form-group mb-3">
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#334455', marginBottom: 6 }}>
                    WhatsApp Mobile Number
                  </label>
                  <input 
                    type="text" 
                    className="form-control"
                    value={editForm.mobile} 
                    onChange={e => setEditForm(prev => ({ ...prev, mobile: e.target.value }))} 
                    placeholder="10 digit mobile"
                    style={{ height: 40, borderRadius: 8, border: '1px solid #d4dce4', width: '100%', padding: '8px 12px' }}
                  />
                </div>
                <div className="row g-2 mb-3">
                  <div className="col-6">
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#334455', marginBottom: 6 }}>
                      Subscription Plan
                    </label>
                    <select 
                      className="form-control"
                      value={editForm.plan} 
                      onChange={e => setEditForm(prev => ({ ...prev, plan: e.target.value }))}
                      style={{ height: 40, borderRadius: 8, border: '1px solid #d4dce4', width: '100%', padding: '8px 12px' }}
                    >
                      <option value="Free">Free (मुफ़्त)</option>
                      <option value="Starter">Starter</option>
                      <option value="Standard">Standard</option>
                      <option value="Pro">Pro</option>
                      <option value="Enterprise">Enterprise</option>
                    </select>
                  </div>
                  <div className="col-6">
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#334455', marginBottom: 6 }}>
                      Role
                    </label>
                    <select 
                      className="form-control"
                      value={editForm.role} 
                      onChange={e => setEditForm(prev => ({ ...prev, role: e.target.value }))}
                      style={{ height: 40, borderRadius: 8, border: '1px solid #d4dce4', width: '100%', padding: '8px 12px' }}
                    >
                      <option value="user">User</option>
                      <option value="admin">Admin</option>
                    </select>
                  </div>
                </div>
                <div className="form-group mb-2">
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#334455', marginBottom: 6 }}>
                    Account Status
                  </label>
                  <select 
                    className="form-control"
                    value={editForm.status} 
                    onChange={e => setEditForm(prev => ({ ...prev, status: e.target.value }))}
                    style={{ height: 40, borderRadius: 8, border: '1px solid #d4dce4', width: '100%', padding: '8px 12px' }}
                  >
                    <option value="active">Active (सक्रिय)</option>
                    <option value="inactive">Inactive (निष्क्रिय)</option>
                  </select>
                </div>
              </div>
              <div className="modal-footer" style={{ padding: '14px 22px', background: '#f8fafc', borderTop: '1px solid #eef2f6', display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                <button 
                  type="button" 
                  className="btn btn-white"
                  onClick={() => setEditingUser(null)}
                  style={{ border: '1px solid #d6dee6', borderRadius: 8, padding: '7px 16px', fontSize: 13, fontWeight: 600 }}
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="btn btn-primary"
                  disabled={savingEdit}
                  style={{ borderRadius: 8, padding: '7px 20px', fontSize: 13, fontWeight: 600 }}
                >
                  {savingEdit ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  )
}

/* =========================================================
   ADMIN PLANS MANAGEMENT PAGE
========================================================= */

const DEFAULT_PLAN_COLORS = [
  { name: 'Soft Blue', hex: '#4f75f2' },
  { name: 'Teal Green', hex: '#00b894' },
  { name: 'Zendash Purple', hex: '#705ec8' },
  { name: 'Warm Orange', hex: '#f77f00' },
  { name: 'Rose Pink', hex: '#e83e8c' },
  { name: 'Ocean Cyan', hex: '#00a8ff' },
]

function AdminPlansPage({ notify }) {
  const [plans, setPlans] = useState([])
  const [loading, setLoading] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [editingPlan, setEditingPlan] = useState(null)
  const [previewMode, setPreviewMode] = useState(false)
  const [saving, setSaving] = useState(false)
  const [actionLoading, setActionLoading] = useState('')

  const emptyForm = {
    name: '',
    price: 99,
    currency: 'INR',
    description: '',
    dailyLimit: '500/Day',
    validity: '30 Days',
    validityDays: 30,
    deviceLimit: '1 Free + 1 Add-on',
    apiAccess: false,
    webAccess: true,
    bulkMsg: true,
    groupOption: false,
    scheduleMsg: false,
    ipSecurity: false,
    headerColor: '#4f75f2',
    badgeText: '',
    active: true,
    sortOrder: 0
  }

  const [form, setForm] = useState(emptyForm)

  const fetchPlans = useCallback(async () => {
    setLoading(true)
    try {
      const d = await api('/api/admin/plans')
      if (d.success) {
        setPlans(d.plans || [])
      }
    } catch (e) {
      notify('प्लान लोड करने में त्रुटि: ' + e.message)
    } finally {
      setLoading(false)
    }
  }, [notify])

  useEffect(() => {
    fetchPlans()
  }, [fetchPlans])

  const openCreateModal = () => {
    setEditingPlan(null)
    setForm({
      ...emptyForm,
      sortOrder: plans.length + 1
    })
    setShowModal(true)
  }

  const openEditModal = (p) => {
    setEditingPlan(p)
    setForm({
      name: p.name || '',
      price: p.price ?? 99,
      currency: p.currency || 'INR',
      description: p.description || '',
      dailyLimit: p.dailyLimit || '500/Day',
      validity: p.validity || '30 Days',
      validityDays: p.validityDays ?? 30,
      deviceLimit: p.deviceLimit || '1 Free + 1 Add-on',
      apiAccess: Boolean(p.apiAccess),
      webAccess: p.webAccess !== undefined ? Boolean(p.webAccess) : true,
      bulkMsg: Boolean(p.bulkMsg),
      groupOption: Boolean(p.groupOption),
      scheduleMsg: Boolean(p.scheduleMsg),
      ipSecurity: Boolean(p.ipSecurity),
      headerColor: p.headerColor || '#4f75f2',
      badgeText: p.badgeText || '',
      active: p.active !== undefined ? Boolean(p.active) : true,
      sortOrder: p.sortOrder ?? 0
    })
    setShowModal(true)
  }

  const handleSave = async (e) => {
    e.preventDefault()
    if (!form.name.trim()) return notify('कृपया Plan Name भरें।')
    if (form.price === '' || isNaN(form.price) || Number(form.price) < 0) return notify('कृपया वैध Price भरें।')

    setSaving(true)
    try {
      if (editingPlan) {
        const d = await api(`/api/admin/plans/${editingPlan.planId}`, {
          method: 'PUT',
          body: JSON.stringify(form)
        })
        if (d.success) {
          notify(`Plan '${form.name}' सफलतापूर्वक अपडेट किया गया!`)
          setShowModal(false)
          fetchPlans()
        }
      } else {
        const d = await api('/api/admin/plans', {
          method: 'POST',
          body: JSON.stringify(form)
        })
        if (d.success) {
          notify(`नया Plan '${form.name}' सफलतापूर्वक बनाया गया!`)
          setShowModal(false)
          fetchPlans()
        }
      }
    } catch (e) {
      notify('एरर: ' + e.message)
    } finally {
      setSaving(false)
    }
  }

  const togglePlanActive = async (p) => {
    setActionLoading(p.planId)
    try {
      const d = await api(`/api/admin/plans/${p.planId}`, {
        method: 'PUT',
        body: JSON.stringify({ active: !p.active })
      })
      if (d.success) {
        notify(`Plan '${p.name}' को ${!p.active ? 'सक्रिय (Active)' : 'निष्क्रिय (Inactive)'} कर दिया गया।`)
        setPlans(prev => prev.map(item => item.planId === p.planId ? { ...item, active: !p.active } : item))
      }
    } catch (e) {
      notify('Status update error: ' + e.message)
    } finally {
      setActionLoading('')
    }
  }

  const handleDeletePlan = async (p) => {
    if (!window.confirm(`क्या आप वाकई Plan '${p.name}' को हटाना चाहते हैं?`)) return
    setActionLoading(p.planId)
    try {
      const d = await api(`/api/admin/plans/${p.planId}`, { method: 'DELETE' })
      if (d.success) {
        notify(`Plan '${p.name}' हटा दिया गया है।`)
        setPlans(prev => prev.filter(item => item.planId !== p.planId))
      }
    } catch (e) {
      notify('Delete error: ' + e.message)
    } finally {
      setActionLoading('')
    }
  }

  return (
    <section className="admin-plans-page">
      {/* Page Header */}
      <div className="page-header d-flex flex-wrap align-items-center justify-content-between mb-4">
        <div>
          <h1 className="page-title mb-1" style={{ fontSize: 24, fontWeight: 700, color: 'inherit' }}>
            🏷️ Plan Management
          </h1>
          <ol className="breadcrumb mb-0" style={{ background: 'transparent', padding: 0, fontSize: 13 }}>
            <li className="breadcrumb-item text-muted">Admin</li>
            <li className="breadcrumb-item active text-primary">Plans &amp; Subscriptions</li>
          </ol>
        </div>
        <div className="d-flex align-items-center gap-2 mt-2 mt-md-0" style={{ gap: 10 }}>
          <button 
            type="button" 
            className="btn btn-outline-primary"
            onClick={() => setPreviewMode(!previewMode)}
            style={{ borderRadius: 8, padding: '8px 16px', fontWeight: 600, fontSize: 13 }}
          >
            {previewMode ? '⚙️ Admin List View' : '👁️ Preview User Pricing Table'}
          </button>
          <button 
            type="button" 
            className="btn btn-primary"
            onClick={openCreateModal}
            style={{ borderRadius: 8, padding: '8px 18px', fontWeight: 700, fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <span>➕</span> Create New Plan
          </button>
        </div>
      </div>

      {previewMode ? (
        <div className="card shadow-sm mb-4" style={{ borderRadius: 16 }}>
          <div className="card-header d-flex align-items-center justify-content-between" style={{ padding: '16px 20px' }}>
            <div>
              <h5 className="card-title mb-0" style={{ fontSize: 16, fontWeight: 700 }}>
                👁️ User Pricing Table Live Preview
              </h5>
              <small className="text-muted">This is exactly how users see the comparison table on their portal.</small>
            </div>
            <button 
              type="button" 
              className="btn btn-sm btn-white" 
              onClick={() => setPreviewMode(false)}
              style={{ borderRadius: 6, fontSize: 12 }}
            >
              Close Preview
            </button>
          </div>
          <div className="card-body p-3">
            <UserPlansPage currentUser={{ plan: 'Startup' }} notify={notify} isPreview={true} />
          </div>
        </div>
      ) : (
        <>
          {/* Stats Bar */}
          <div className="row row-cards mb-4">
            <div className="col-sm-6 col-lg-3">
              <div className="card p-3" style={{ borderRadius: 12 }}>
                <div className="d-flex align-items-center">
                  <span className="stamp stamp-md bg-primary-transparent text-primary mr-3" style={{ marginRight: 14, fontSize: 20, width: 44, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 10, background: 'rgba(79, 117, 242, 0.12)' }}>
                    🏷️
                  </span>
                  <div>
                    <h4 className="m-0 font-weight-bold" style={{ fontSize: 20 }}>{plans.length}</h4>
                    <small className="text-muted">Total Configured Plans</small>
                  </div>
                </div>
              </div>
            </div>
            <div className="col-sm-6 col-lg-3">
              <div className="card p-3" style={{ borderRadius: 12 }}>
                <div className="d-flex align-items-center">
                  <span className="stamp stamp-md bg-success-transparent text-success mr-3" style={{ marginRight: 14, fontSize: 20, width: 44, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 10, background: 'rgba(45, 206, 137, 0.12)' }}>
                    ✓
                  </span>
                  <div>
                    <h4 className="m-0 font-weight-bold" style={{ fontSize: 20 }}>{plans.filter(p => p.active).length}</h4>
                    <small className="text-muted">Active in User Panel</small>
                  </div>
                </div>
              </div>
            </div>
            <div className="col-sm-6 col-lg-3">
              <div className="card p-3" style={{ borderRadius: 12 }}>
                <div className="d-flex align-items-center">
                  <span className="stamp stamp-md bg-info-transparent text-info mr-3" style={{ marginRight: 14, fontSize: 20, width: 44, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 10, background: 'rgba(0, 168, 255, 0.12)' }}>
                    ₹
                  </span>
                  <div>
                    <h4 className="m-0 font-weight-bold" style={{ fontSize: 20 }}>
                      ₹{plans.length ? Math.min(...plans.map(p => p.price)) : 0}
                    </h4>
                    <small className="text-muted">Starting Base Price</small>
                  </div>
                </div>
              </div>
            </div>
            <div className="col-sm-6 col-lg-3">
              <div className="card p-3" style={{ borderRadius: 12 }}>
                <div className="d-flex align-items-center">
                  <span className="stamp stamp-md bg-warning-transparent text-warning mr-3" style={{ marginRight: 14, fontSize: 20, width: 44, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 10, background: 'rgba(255, 171, 0, 0.12)' }}>
                    ⚙️
                  </span>
                  <div>
                    <h4 className="m-0 font-weight-bold" style={{ fontSize: 20 }}>11 Fields</h4>
                    <small className="text-muted">Full Parameter Control</small>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Plans Table & Cards */}
          <div className="card shadow-sm" style={{ borderRadius: 16 }}>
            <div className="card-header d-flex align-items-center justify-content-between" style={{ padding: '16px 20px', borderBottom: '1px solid var(--zd-border, rgba(0,0,0,0.06))' }}>
              <div>
                <h5 className="card-title mb-0" style={{ fontSize: 16, fontWeight: 700 }}>All Subscription Plans</h5>
                <small className="text-muted">Manage plan prices, message limits, validity, and feature toggles.</small>
              </div>
              <button 
                type="button" 
                className="btn btn-sm btn-outline-secondary" 
                onClick={fetchPlans}
                disabled={loading}
                style={{ borderRadius: 8 }}
              >
                ↻ Refresh
              </button>
            </div>

            <div className="card-body p-0">
              {loading ? (
                <div style={{ textAlign: 'center', padding: '60px 20px', color: '#6b7280' }}>
                  <div className="spinner-border text-primary mb-2" role="status"></div>
                  <div>योजनाएं लोड हो रही हैं (Loading plans)...</div>
                </div>
              ) : plans.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '60px 20px' }}>
                  <div style={{ fontSize: 36, marginBottom: 12 }}>🏷️</div>
                  <h4 style={{ fontWeight: 700 }}>अभी कोई प्लान नहीं बना है</h4>
                  <p className="text-muted mb-3">Create your first subscription plan with limits and features.</p>
                  <button type="button" className="btn btn-primary" onClick={openCreateModal}>
                    ➕ Create First Plan
                  </button>
                </div>
              ) : (
                <div className="table-responsive">
                  <table className="table card-table table-vcenter text-nowrap mb-0" style={{ borderCollapse: 'separate', borderSpacing: 0 }}>
                    <thead>
                      <tr style={{ background: 'var(--zd-card-bg, #f8fafc)', borderBottom: '1px solid var(--zd-border, #eef2f6)' }}>
                        <th style={{ width: 40, textAlign: 'center', fontWeight: 700 }}>#</th>
                        <th style={{ fontWeight: 700 }}>Plan Name &amp; Banner</th>
                        <th style={{ fontWeight: 700 }}>Price &amp; Validity</th>
                        <th style={{ fontWeight: 700 }}>Limits</th>
                        <th style={{ fontWeight: 700 }}>Key Capabilities</th>
                        <th style={{ fontWeight: 700, textAlign: 'center' }}>Status</th>
                        <th style={{ fontWeight: 700, textAlign: 'right', paddingRight: 24 }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {plans.map((p, idx) => (
                        <tr key={p.planId || idx}>
                          <td style={{ textAlign: 'center', fontWeight: 600, color: 'var(--zd-text-muted, #64748b)' }}>
                            {idx + 1}
                          </td>
                          <td>
                            <div className="d-flex align-items-center" style={{ gap: 12 }}>
                              <span 
                                style={{ 
                                  width: 14, 
                                  height: 38, 
                                  borderRadius: 4, 
                                  background: p.headerColor || '#4f75f2',
                                  display: 'inline-block',
                                  flexShrink: 0
                                }} 
                              />
                              <div>
                                <div className="d-flex align-items-center" style={{ gap: 8 }}>
                                  <strong style={{ fontSize: 15, color: 'inherit' }}>{p.name}</strong>
                                  {p.badgeText && (
                                    <span className="badge badge-warning" style={{ fontSize: 10, padding: '2px 6px', fontWeight: 700 }}>
                                      {p.badgeText}
                                    </span>
                                  )}
                                </div>
                                <small className="text-muted" style={{ display: 'block', maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                  {p.description || 'No description'}
                                </small>
                              </div>
                            </div>
                          </td>
                          <td>
                            <div>
                              <span style={{ fontSize: 16, fontWeight: 700, color: '#10b981' }}>
                                ₹{p.price}
                              </span>
                              <span className="text-muted" style={{ fontSize: 12, marginLeft: 4 }}>
                                / {p.validity || `${p.validityDays} Days`}
                              </span>
                            </div>
                            <small className="text-muted" style={{ fontSize: 11 }}>
                              Currency: {p.currency || 'INR'}
                            </small>
                          </td>
                          <td>
                            <div style={{ fontSize: 12, lineHeight: 1.6 }}>
                              <div><strong>Daily:</strong> <span className="badge badge-primary-light" style={{ padding: '2px 6px' }}>{p.dailyLimit}</span></div>
                              <div><strong>Devices:</strong> <span className="badge badge-info-light" style={{ padding: '2px 6px' }}>{p.deviceLimit}</span></div>
                            </div>
                          </td>
                          <td>
                            <div className="d-flex flex-wrap gap-1" style={{ gap: 4, maxWidth: 260 }}>
                              <span className={`badge ${p.apiAccess ? 'badge-success-light' : 'badge-light text-muted'}`} style={{ fontSize: 10 }}>
                                {p.apiAccess ? '✓ API' : '✕ API'}
                              </span>
                              <span className={`badge ${p.webAccess ? 'badge-success-light' : 'badge-light text-muted'}`} style={{ fontSize: 10 }}>
                                {p.webAccess ? '✓ Web' : '✕ Web'}
                              </span>
                              <span className={`badge ${p.bulkMsg ? 'badge-success-light' : 'badge-light text-muted'}`} style={{ fontSize: 10 }}>
                                {p.bulkMsg ? '✓ Bulk' : '✕ Bulk'}
                              </span>
                              <span className={`badge ${p.groupOption ? 'badge-success-light' : 'badge-light text-muted'}`} style={{ fontSize: 10 }}>
                                {p.groupOption ? '✓ Group' : '✕ Group'}
                              </span>
                              <span className={`badge ${p.scheduleMsg ? 'badge-success-light' : 'badge-light text-muted'}`} style={{ fontSize: 10 }}>
                                {p.scheduleMsg ? '✓ Schedule' : '✕ Schedule'}
                              </span>
                              <span className={`badge ${p.ipSecurity ? 'badge-success-light' : 'badge-light text-muted'}`} style={{ fontSize: 10 }}>
                                {p.ipSecurity ? '✓ IP Sec' : '✕ IP Sec'}
                              </span>
                            </div>
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            <button
                              type="button"
                              className={`btn btn-sm ${p.active ? 'btn-success-light' : 'btn-outline-secondary'}`}
                              onClick={() => togglePlanActive(p)}
                              disabled={actionLoading === p.planId}
                              style={{ borderRadius: 20, padding: '3px 12px', fontSize: 11, fontWeight: 700 }}
                              title="Click to toggle status"
                            >
                              {p.active ? '✓ Active' : '✕ Inactive'}
                            </button>
                          </td>
                          <td style={{ textAlign: 'right', paddingRight: 20 }}>
                            <div className="d-inline-flex gap-1" style={{ gap: 6 }}>
                              <button
                                type="button"
                                className="btn btn-sm btn-outline-primary"
                                onClick={() => openEditModal(p)}
                                style={{ borderRadius: 6, padding: '4px 10px', fontSize: 12 }}
                              >
                                ✏️ Edit
                              </button>
                              <button
                                type="button"
                                className="btn btn-sm btn-outline-danger"
                                onClick={() => handleDeletePlan(p)}
                                disabled={actionLoading === p.planId}
                                style={{ borderRadius: 6, padding: '4px 10px', fontSize: 12 }}
                              >
                                🗑️ Delete
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* CREATE / EDIT PLAN MODAL */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div 
            className="modal-content-card" 
            onClick={e => e.stopPropagation()} 
            style={{ maxWidth: 680, width: '92%', borderRadius: 16, maxHeight: '90vh', overflowY: 'auto' }}
          >
            <div className="modal-header d-flex align-items-center justify-content-between" style={{ padding: '16px 24px', borderBottom: '1px solid var(--zd-border, #eef2f6)' }}>
              <div>
                <h5 className="modal-title font-weight-bold m-0" style={{ fontSize: 17, color: 'inherit' }}>
                  {editingPlan ? `✏️ Edit Plan: ${editingPlan.name}` : '➕ Create New Subscription Plan'}
                </h5>
                <small className="text-muted">Configure all 11 plan parameters, pricing, and visual styling.</small>
              </div>
              <button 
                type="button" 
                onClick={() => setShowModal(false)}
                style={{ background: 'none', border: 'none', fontSize: 24, cursor: 'pointer', color: '#8a98ac', lineHeight: 1 }}
              >
                ×
              </button>
            </div>

            <form onSubmit={handleSave}>
              <div className="modal-body" style={{ padding: '22px 24px' }}>
                {/* 1 & 2: Plan Name and Price */}
                <div className="row g-3 mb-3">
                  <div className="col-md-7">
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 700, marginBottom: 6 }}>
                      Plan Name (प्लान का नाम) *
                    </label>
                    <input 
                      type="text" 
                      className="form-control" 
                      value={form.name}
                      onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                      placeholder="e.g. Startup, Business, Enterprise, Pro"
                      required
                      style={{ height: 42, borderRadius: 8 }}
                    />
                  </div>
                  <div className="col-md-5">
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 700, marginBottom: 6 }}>
                      Price (कीमत INR में) *
                    </label>
                    <div className="input-group">
                      <span className="input-group-text" style={{ borderRadius: '8px 0 0 8px', fontWeight: 700 }}>₹</span>
                      <input 
                        type="number" 
                        className="form-control" 
                        value={form.price}
                        onChange={e => setForm(f => ({ ...f, price: e.target.value }))}
                        placeholder="e.g. 99"
                        min="0"
                        required
                        style={{ height: 42, borderRadius: '0 8px 8px 0' }}
                      />
                    </div>
                  </div>
                </div>

                {/* 3 & 4: Daily Msg Limit and Validity */}
                <div className="row g-3 mb-3">
                  <div className="col-md-6">
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 700, marginBottom: 6 }}>
                      Daily Message Limit (प्रतिदिन संदेश सीमा) *
                    </label>
                    <input 
                      type="text" 
                      className="form-control" 
                      value={form.dailyLimit}
                      onChange={e => setForm(f => ({ ...f, dailyLimit: e.target.value }))}
                      placeholder="e.g. 500/Day, 1000/Day, Unlimited"
                      required
                      style={{ height: 42, borderRadius: 8 }}
                    />
                  </div>
                  <div className="col-md-6">
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 700, marginBottom: 6 }}>
                      Validity Display (वैधता) *
                    </label>
                    <input 
                      type="text" 
                      className="form-control" 
                      value={form.validity}
                      onChange={e => setForm(f => ({ ...f, validity: e.target.value }))}
                      placeholder="e.g. 30 Days, 365 Days, Lifetime"
                      required
                      style={{ height: 42, borderRadius: 8 }}
                    />
                  </div>
                </div>

                {/* 5: Device Limit & Validity in Days */}
                <div className="row g-3 mb-3">
                  <div className="col-md-6">
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 700, marginBottom: 6 }}>
                      Device Limit (डिवाइस सीमा) *
                    </label>
                    <input 
                      type="text" 
                      className="form-control" 
                      value={form.deviceLimit}
                      onChange={e => setForm(f => ({ ...f, deviceLimit: e.target.value }))}
                      placeholder="e.g. 1 Free + 1 Add-on, 1 Device"
                      required
                      style={{ height: 42, borderRadius: 8 }}
                    />
                  </div>
                  <div className="col-md-6">
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 700, marginBottom: 6 }}>
                      Validity in Days (सिस्टम गणना हेतु दिन)
                    </label>
                    <input 
                      type="number" 
                      className="form-control" 
                      value={form.validityDays}
                      onChange={e => setForm(f => ({ ...f, validityDays: Number(e.target.value) || 30 }))}
                      placeholder="30"
                      min="1"
                      style={{ height: 42, borderRadius: 8 }}
                    />
                  </div>
                </div>

                {/* Tagline / Description */}
                <div className="form-group mb-3">
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 700, marginBottom: 6 }}>
                    Description / Subtitle (योजना का विवरण/टैगलाइन)
                  </label>
                  <input 
                    type="text" 
                    className="form-control" 
                    value={form.description}
                    onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                    placeholder="e.g. Send message to contacts only / Received message webhook support"
                    style={{ height: 42, borderRadius: 8 }}
                  />
                </div>

                {/* Color and Badge */}
                <div className="row g-3 mb-4">
                  <div className="col-md-7">
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 700, marginBottom: 6 }}>
                      Header Banner Theme Color (कलर थीम)
                    </label>
                    <div className="d-flex align-items-center gap-2" style={{ gap: 8 }}>
                      <input 
                        type="color" 
                        value={form.headerColor} 
                        onChange={e => setForm(f => ({ ...f, headerColor: e.target.value }))}
                        style={{ width: 44, height: 42, padding: 2, border: '1px solid #d0d7de', borderRadius: 8, cursor: 'pointer' }}
                      />
                      <div className="d-flex flex-wrap gap-1" style={{ gap: 6 }}>
                        {DEFAULT_PLAN_COLORS.map(c => (
                          <button
                            key={c.hex}
                            type="button"
                            onClick={() => setForm(f => ({ ...f, headerColor: c.hex }))}
                            style={{
                              width: 26,
                              height: 26,
                              borderRadius: '50%',
                              background: c.hex,
                              border: form.headerColor === c.hex ? '2px solid #000' : '1px solid rgba(0,0,0,0.15)',
                              cursor: 'pointer',
                              padding: 0
                            }}
                            title={c.name}
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="col-md-5">
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 700, marginBottom: 6 }}>
                      Badge Text (बैज जैसे POPULAR, BEST)
                    </label>
                    <input 
                      type="text" 
                      className="form-control" 
                      value={form.badgeText}
                      onChange={e => setForm(f => ({ ...f, badgeText: e.target.value }))}
                      placeholder="e.g. POPULAR, RECOMMENDED"
                      style={{ height: 42, borderRadius: 8 }}
                    />
                  </div>
                </div>

                {/* 6 to 11: Feature Toggles */}
                <div className="card p-3 mb-3" style={{ borderRadius: 12, background: 'var(--zd-border-subtle, rgba(0,0,0,0.02))', border: '1px solid var(--zd-border, #eef2f6)' }}>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 700, marginBottom: 12, color: 'inherit' }}>
                    ⚡ Feature Access &amp; Capabilities (सुविधाएं चालू / बंद करें)
                  </label>
                  <div className="row g-3">
                    <div className="col-sm-6">
                      <label className="custom-control custom-checkbox d-flex align-items-center" style={{ gap: 8, cursor: 'pointer', margin: 0 }}>
                        <input 
                          type="checkbox" 
                          checked={form.apiAccess}
                          onChange={e => setForm(f => ({ ...f, apiAccess: e.target.checked }))}
                        />
                        <span style={{ fontSize: 13, fontWeight: 600 }}>6. API Access</span>
                      </label>
                      <small className="text-muted d-block" style={{ marginLeft: 22, fontSize: 11 }}>REST API &amp; Webhook support</small>
                    </div>

                    <div className="col-sm-6">
                      <label className="custom-control custom-checkbox d-flex align-items-center" style={{ gap: 8, cursor: 'pointer', margin: 0 }}>
                        <input 
                          type="checkbox" 
                          checked={form.webAccess}
                          onChange={e => setForm(f => ({ ...f, webAccess: e.target.checked }))}
                        />
                        <span style={{ fontSize: 13, fontWeight: 600 }}>7. Web Access for Send Msg</span>
                      </label>
                      <small className="text-muted d-block" style={{ marginLeft: 22, fontSize: 11 }}>Web UI direct message portal</small>
                    </div>

                    <div className="col-sm-6">
                      <label className="custom-control custom-checkbox d-flex align-items-center" style={{ gap: 8, cursor: 'pointer', margin: 0 }}>
                        <input 
                          type="checkbox" 
                          checked={form.bulkMsg}
                          onChange={e => setForm(f => ({ ...f, bulkMsg: e.target.checked }))}
                        />
                        <span style={{ fontSize: 13, fontWeight: 600 }}>8. Send Bulk Msg</span>
                      </label>
                      <small className="text-muted d-block" style={{ marginLeft: 22, fontSize: 11 }}>Excel upload and bulk campaigns</small>
                    </div>

                    <div className="col-sm-6">
                      <label className="custom-control custom-checkbox d-flex align-items-center" style={{ gap: 8, cursor: 'pointer', margin: 0 }}>
                        <input 
                          type="checkbox" 
                          checked={form.groupOption}
                          onChange={e => setForm(f => ({ ...f, groupOption: e.target.checked }))}
                        />
                        <span style={{ fontSize: 13, fontWeight: 600 }}>9. Group Option</span>
                      </label>
                      <small className="text-muted d-block" style={{ marginLeft: 22, fontSize: 11 }}>Send message to WhatsApp groups</small>
                    </div>

                    <div className="col-sm-6">
                      <label className="custom-control custom-checkbox d-flex align-items-center" style={{ gap: 8, cursor: 'pointer', margin: 0 }}>
                        <input 
                          type="checkbox" 
                          checked={form.scheduleMsg}
                          onChange={e => setForm(f => ({ ...f, scheduleMsg: e.target.checked }))}
                        />
                        <span style={{ fontSize: 13, fontWeight: 600 }}>10. Send Schedule Msg</span>
                      </label>
                      <small className="text-muted d-block" style={{ marginLeft: 22, fontSize: 11 }}>Scheduled broadcast queues</small>
                    </div>

                    <div className="col-sm-6">
                      <label className="custom-control custom-checkbox d-flex align-items-center" style={{ gap: 8, cursor: 'pointer', margin: 0 }}>
                        <input 
                          type="checkbox" 
                          checked={form.ipSecurity}
                          onChange={e => setForm(f => ({ ...f, ipSecurity: e.target.checked }))}
                        />
                        <span style={{ fontSize: 13, fontWeight: 600 }}>11. IP Security</span>
                      </label>
                      <small className="text-muted d-block" style={{ marginLeft: 22, fontSize: 11 }}>IP Whitelisting &amp; rate protection</small>
                    </div>
                  </div>
                </div>

                {/* Status & Sort Order */}
                <div className="row g-3">
                  <div className="col-6">
                    <label className="custom-control custom-checkbox d-flex align-items-center" style={{ gap: 8, cursor: 'pointer', marginTop: 8 }}>
                      <input 
                        type="checkbox" 
                        checked={form.active}
                        onChange={e => setForm(f => ({ ...f, active: e.target.checked }))}
                      />
                      <span style={{ fontSize: 13, fontWeight: 700 }}>Plan Active (सक्रिय रखें)</span>
                    </label>
                  </div>
                  <div className="col-6">
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 700, marginBottom: 4 }}>
                      Display Sort Order
                    </label>
                    <input 
                      type="number" 
                      className="form-control" 
                      value={form.sortOrder}
                      onChange={e => setForm(f => ({ ...f, sortOrder: Number(e.target.value) || 0 }))}
                      style={{ height: 38, borderRadius: 8 }}
                    />
                  </div>
                </div>
              </div>

              <div className="modal-footer d-flex justify-content-end gap-2" style={{ padding: '14px 24px', borderTop: '1px solid var(--zd-border, #eef2f6)', gap: 10 }}>
                <button 
                  type="button" 
                  className="btn btn-outline-secondary" 
                  onClick={() => setShowModal(false)}
                  style={{ borderRadius: 8, padding: '8px 16px', fontWeight: 600 }}
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="btn btn-primary"
                  disabled={saving}
                  style={{ borderRadius: 8, padding: '8px 22px', fontWeight: 700 }}
                >
                  {saving ? '⏳ Saving Plan...' : (editingPlan ? '💾 Update Plan' : '➕ Create Plan')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  )
}

/* =========================================================
   USER PLANS & COMPARISON TABLE (Matches Reference Image)
========================================================= */

function UserPlansPage({ currentUser, notify, isPreview = false }) {
  const [plans, setPlans] = useState([])
  const [loading, setLoading] = useState(false)
  const [currentPlan, setCurrentPlan] = useState(currentUser?.plan || 'Standard')
  const [myRequests, setMyRequests] = useState([])
  const [activeTab, setActiveTab] = useState('plans')
  const [selectedPlan, setSelectedPlan] = useState(null)

  const fetchPlansData = useCallback(async () => {
    setLoading(true)
    try {
      const d = await api('/api/plans')
      if (d.success) {
        setPlans(d.plans || [])
        if (d.currentPlan) setCurrentPlan(d.currentPlan)
        if (d.myRequests) setMyRequests(d.myRequests)
      }
    } catch (e) {
      notify('Plans लोड करने में त्रुटि: ' + e.message)
    } finally {
      setLoading(false)
    }
  }, [notify])

  useEffect(() => {
    fetchPlansData()
  }, [fetchPlansData])

  const pendingCount = myRequests.filter(r => r.status === 'pending').length

  const handleOpenPurchase = (plan) => {
    setSelectedPlan(plan)
  }

  const handlePurchaseSuccess = () => {
    setSelectedPlan(null)
    fetchPlansData()
    setActiveTab('requests')
  }

  return (
    <section className="user-plans-page">
      {!isPreview && (
        <>
          {/* Header & Breadcrumb */}
          <div className="page-header d-flex flex-wrap align-items-center justify-content-between mb-4">
            <div>
              <h1 className="page-title mb-1" style={{ fontSize: 24, fontWeight: 700, color: 'inherit' }}>
                💎 Subscription Plans &amp; Pricing
              </h1>
              <ol className="breadcrumb mb-0" style={{ background: 'transparent', padding: 0, fontSize: 13 }}>
                <li className="breadcrumb-item text-muted">Portal</li>
                <li className="breadcrumb-item active text-primary">Pricing Comparison</li>
              </ol>
            </div>
            <div className="d-flex align-items-center gap-2 mt-2 mt-md-0" style={{ gap: 10 }}>
              <button 
                type="button" 
                className={`btn ${activeTab === 'plans' ? 'btn-primary' : 'btn-outline-primary'}`}
                onClick={() => setActiveTab('plans')}
                style={{ borderRadius: 8, padding: '8px 16px', fontWeight: 600, fontSize: 13 }}
              >
                🏷️ Pricing Table
              </button>
              <button 
                type="button" 
                className={`btn ${activeTab === 'requests' ? 'btn-primary' : 'btn-outline-primary'}`}
                onClick={() => setActiveTab('requests')}
                style={{ borderRadius: 8, padding: '8px 16px', fontWeight: 600, fontSize: 13, position: 'relative' }}
              >
                📋 My Purchase Requests
                {pendingCount > 0 && (
                  <span className="badge badge-warning" style={{ marginLeft: 6, fontSize: 10, padding: '2px 6px' }}>
                    {pendingCount}
                  </span>
                )}
              </button>
            </div>
          </div>

          {/* Current Active Plan Alert Banner */}
          <div className="card mb-4" style={{ borderRadius: 16, background: 'linear-gradient(135deg, rgba(79,117,242,0.12) 0%, rgba(112,94,200,0.12) 100%)', border: '1px solid rgba(112,94,200,0.2)' }}>
            <div className="card-body p-3 p-md-4 d-flex flex-wrap align-items-center justify-content-between" style={{ gap: 14 }}>
              <div className="d-flex align-items-center" style={{ gap: 14 }}>
                <div style={{ width: 48, height: 48, borderRadius: 12, background: '#705ec8', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, flexShrink: 0 }}>
                  🌟
                </div>
                <div>
                  <h4 className="mb-1 font-weight-bold" style={{ color: 'inherit' }}>
                    Your Current Active Plan: <span style={{ color: '#705ec8' }}>{currentPlan}</span>
                  </h4>
                  <p className="text-muted mb-0" style={{ fontSize: 13 }}>
                    Choose any higher plan below to increase daily messaging capacity, add devices, and unlock group &amp; webhook access!
                  </p>
                </div>
              </div>
              <div>
                <button 
                  type="button" 
                  className="btn btn-outline-primary"
                  onClick={fetchPlansData}
                  style={{ borderRadius: 8, padding: '6px 14px', fontSize: 12, fontWeight: 600 }}
                >
                  ↻ Refresh Status
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px 20px', color: '#6b7280' }}>
          <div className="spinner-border text-primary mb-2" role="status"></div>
          <div>प्लान लोड हो रहे हैं (Loading pricing table)...</div>
        </div>
      ) : activeTab === 'plans' ? (
        plans.length === 0 ? (
          <div className="card p-5 text-center" style={{ borderRadius: 16 }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>🏷️</div>
            <h3>कोई सक्रिय प्लान उपलब्ध नहीं है</h3>
            <p className="text-muted">No active subscription plans available at the moment. Please contact the administrator.</p>
          </div>
        ) : (
          /* PRICING COMPARISON TABLE - EXACT LAYOUT AS MEDIA SAMPLE */
          <div className="pricing-comparison-table-wrapper card shadow-sm" style={{ borderRadius: 20, overflow: 'hidden' }}>
            <div className="table-responsive">
              <table className="pricing-comparison-table mb-0 w-100">
                <thead>
                  <tr>
                    {/* Left corner empty / title cell */}
                    <th className="pricing-feature-col-head" style={{ width: '22%', minWidth: 200, padding: '24px 20px', verticalAlign: 'bottom', borderRight: '1px solid var(--zd-border, #eef2f6)' }}>
                      <span style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--zd-text-muted, #8a98ac)', fontWeight: 700 }}>
                        Features &amp; Specs
                      </span>
                      <h3 style={{ margin: '6px 0 0', fontSize: 18, fontWeight: 800, color: 'inherit' }}>
                        Compare All Plans
                      </h3>
                    </th>

                    {/* Dynamic Plan Header Columns */}
                    {plans.map((p, idx) => {
                      // Palette shades
                      const isCurrent = currentPlan?.toLowerCase() === p.name?.toLowerCase()
                      const headerBg = p.headerColor || (idx === 0 ? '#9bc5ff' : idx === 1 ? '#8fe3c9' : '#d2b4ff')
                      const isDarkHeader = ['#10b981', '#3b82f6', '#705ec8', '#f77f00', '#4f75f2'].includes(p.headerColor)

                      return (
                        <th 
                          key={p.planId || idx} 
                          className="pricing-plan-header-col" 
                          style={{ 
                            width: `${78 / plans.length}%`, 
                            minWidth: 200, 
                            padding: 0, 
                            verticalAlign: 'top',
                            borderRight: idx < plans.length - 1 ? '1px solid var(--zd-border, #eef2f6)' : 'none'
                          }}
                        >
                          <div 
                            className="plan-header-card text-center"
                            style={{
                              backgroundColor: headerBg,
                              color: isDarkHeader ? '#ffffff' : '#141b47',
                              padding: '24px 16px 20px',
                              position: 'relative'
                            }}
                          >
                            {p.badgeText && (
                              <span 
                                style={{
                                  position: 'absolute',
                                  top: 8,
                                  right: 12,
                                  background: 'rgba(0,0,0,0.25)',
                                  color: '#fff',
                                  fontSize: 10,
                                  fontWeight: 800,
                                  padding: '2px 8px',
                                  borderRadius: 999
                                }}
                              >
                                {p.badgeText}
                              </span>
                            )}

                            <h2 style={{ fontSize: 24, fontWeight: 900, margin: '0 0 6px', letterSpacing: '-0.02em', color: 'inherit' }}>
                              {p.name}
                            </h2>

                            <p style={{ fontSize: 12, margin: '0 0 14px', minHeight: 34, opacity: 0.9, lineHeight: 1.3, color: 'inherit' }}>
                              {p.description || 'WhatsApp Automation Plan'}
                            </p>

                            {/* Price Pill */}
                            <div className="d-flex justify-content-center mb-3">
                              <span 
                                className="price-pill-banner"
                                style={{
                                  background: isDarkHeader ? 'rgba(0,0,0,0.3)' : '#1e3a8a',
                                  color: '#ffffff',
                                  fontSize: 17,
                                  fontWeight: 800,
                                  padding: '6px 22px',
                                  borderRadius: 999,
                                  display: 'inline-block',
                                  boxShadow: '0 2px 8px rgba(0,0,0,0.18)'
                                }}
                              >
                                INR {p.price}
                              </span>
                            </div>

                            {/* Buy Now Button in Header */}
                            <div>
                              {isCurrent ? (
                                <button 
                                  type="button" 
                                  className="btn btn-sm"
                                  disabled
                                  style={{
                                    background: 'rgba(255,255,255,0.7)',
                                    color: '#0f172a',
                                    fontWeight: 800,
                                    borderRadius: 999,
                                    padding: '7px 24px',
                                    border: 'none',
                                    fontSize: 13
                                  }}
                                >
                                  ✓ Current Plan
                                </button>
                              ) : (
                                <button 
                                  type="button" 
                                  className="btn-buy-plan-pill"
                                  onClick={() => handleOpenPurchase(p)}
                                  style={{
                                    background: isDarkHeader ? '#ffffff' : '#1e3a8a',
                                    color: isDarkHeader ? '#141b47' : '#ffffff',
                                    fontWeight: 800,
                                    borderRadius: 999,
                                    padding: '8px 26px',
                                    border: 'none',
                                    fontSize: 14,
                                    cursor: 'pointer',
                                    boxShadow: '0 4px 14px rgba(0,0,0,0.25)',
                                    transition: 'all 0.2s ease'
                                  }}
                                >
                                  Buy Now
                                </button>
                              )}
                            </div>
                          </div>
                        </th>
                      )
                    })}
                  </tr>
                </thead>

                <tbody>
                  {/* Row 1: Daily msg limit */}
                  <tr className="pricing-spec-row">
                    <td className="pricing-spec-label font-weight-bold" style={{ padding: '16px 20px', borderRight: '1px solid var(--zd-border, #eef2f6)' }}>
                      1. Daily Message Limit
                    </td>
                    {plans.map((p, idx) => (
                      <td key={p.planId || idx} className="text-center" style={{ padding: '14px 12px', borderRight: idx < plans.length - 1 ? '1px solid var(--zd-border, #eef2f6)' : 'none' }}>
                        <span className="plan-check-pill">
                          <span className="check-icon-circle">✓</span> {p.dailyLimit}
                        </span>
                      </td>
                    ))}
                  </tr>

                  {/* Row 2: Validity */}
                  <tr className="pricing-spec-row">
                    <td className="pricing-spec-label font-weight-bold" style={{ padding: '16px 20px', borderRight: '1px solid var(--zd-border, #eef2f6)' }}>
                      2. Validity
                    </td>
                    {plans.map((p, idx) => (
                      <td key={p.planId || idx} className="text-center" style={{ padding: '14px 12px', borderRight: idx < plans.length - 1 ? '1px solid var(--zd-border, #eef2f6)' : 'none' }}>
                        <span className="plan-check-pill">
                          <span className="check-icon-circle">✓</span> {p.validity}
                        </span>
                      </td>
                    ))}
                  </tr>

                  {/* Row 3: Device limit */}
                  <tr className="pricing-spec-row">
                    <td className="pricing-spec-label font-weight-bold" style={{ padding: '16px 20px', borderRight: '1px solid var(--zd-border, #eef2f6)' }}>
                      3. Device Limit
                    </td>
                    {plans.map((p, idx) => (
                      <td key={p.planId || idx} className="text-center" style={{ padding: '14px 12px', borderRight: idx < plans.length - 1 ? '1px solid var(--zd-border, #eef2f6)' : 'none' }}>
                        <span className="plan-check-pill">
                          <span className="check-icon-circle">✓</span> {p.deviceLimit}
                        </span>
                      </td>
                    ))}
                  </tr>

                  {/* Row 4: Device Add-on Price (Matching sample image: + ₹49 / device) */}
                  <tr className="pricing-spec-row">
                    <td className="pricing-spec-label font-weight-bold" style={{ padding: '16px 20px', borderRight: '1px solid var(--zd-border, #eef2f6)' }}>
                      4. Extra Device Add-on
                    </td>
                    {plans.map((p, idx) => (
                      <td key={p.planId || idx} className="text-center" style={{ padding: '14px 12px', borderRight: idx < plans.length - 1 ? '1px solid var(--zd-border, #eef2f6)' : 'none' }}>
                        <span className="plan-addon-pill">
                          <span className="plus-icon-circle">+</span> ₹49 / device
                        </span>
                      </td>
                    ))}
                  </tr>

                  {/* Row 5: API Access */}
                  <tr className="pricing-spec-row">
                    <td className="pricing-spec-label font-weight-bold" style={{ padding: '16px 20px', borderRight: '1px solid var(--zd-border, #eef2f6)' }}>
                      5. API Access
                    </td>
                    {plans.map((p, idx) => (
                      <td key={p.planId || idx} className="text-center" style={{ padding: '14px 12px', borderRight: idx < plans.length - 1 ? '1px solid var(--zd-border, #eef2f6)' : 'none' }}>
                        {p.apiAccess ? (
                          <span className="plan-check-pill">
                            <span className="check-icon-circle">✓</span> Included
                          </span>
                        ) : (
                          <span className="plan-cross-pill">✕ Not Included</span>
                        )}
                      </td>
                    ))}
                  </tr>

                  {/* Row 6: Web access for send msg */}
                  <tr className="pricing-spec-row">
                    <td className="pricing-spec-label font-weight-bold" style={{ padding: '16px 20px', borderRight: '1px solid var(--zd-border, #eef2f6)' }}>
                      6. Web Access for Send Msg
                    </td>
                    {plans.map((p, idx) => (
                      <td key={p.planId || idx} className="text-center" style={{ padding: '14px 12px', borderRight: idx < plans.length - 1 ? '1px solid var(--zd-border, #eef2f6)' : 'none' }}>
                        {p.webAccess ? (
                          <span className="plan-check-pill">
                            <span className="check-icon-circle">✓</span> Included
                          </span>
                        ) : (
                          <span className="plan-cross-pill">✕ Not Included</span>
                        )}
                      </td>
                    ))}
                  </tr>

                  {/* Row 7: Send bulk msg */}
                  <tr className="pricing-spec-row">
                    <td className="pricing-spec-label font-weight-bold" style={{ padding: '16px 20px', borderRight: '1px solid var(--zd-border, #eef2f6)' }}>
                      7. Send Bulk Msg
                    </td>
                    {plans.map((p, idx) => (
                      <td key={p.planId || idx} className="text-center" style={{ padding: '14px 12px', borderRight: idx < plans.length - 1 ? '1px solid var(--zd-border, #eef2f6)' : 'none' }}>
                        {p.bulkMsg ? (
                          <span className="plan-check-pill">
                            <span className="check-icon-circle">✓</span> Included
                          </span>
                        ) : (
                          <span className="plan-cross-pill">✕ Not Included</span>
                        )}
                      </td>
                    ))}
                  </tr>

                  {/* Row 8: Group option */}
                  <tr className="pricing-spec-row">
                    <td className="pricing-spec-label font-weight-bold" style={{ padding: '16px 20px', borderRight: '1px solid var(--zd-border, #eef2f6)' }}>
                      8. Group Option
                    </td>
                    {plans.map((p, idx) => (
                      <td key={p.planId || idx} className="text-center" style={{ padding: '14px 12px', borderRight: idx < plans.length - 1 ? '1px solid var(--zd-border, #eef2f6)' : 'none' }}>
                        {p.groupOption ? (
                          <span className="plan-check-pill">
                            <span className="check-icon-circle">✓</span> Included
                          </span>
                        ) : (
                          <span className="plan-cross-pill">✕ Not Included</span>
                        )}
                      </td>
                    ))}
                  </tr>

                  {/* Row 9: Send schedule msg */}
                  <tr className="pricing-spec-row">
                    <td className="pricing-spec-label font-weight-bold" style={{ padding: '16px 20px', borderRight: '1px solid var(--zd-border, #eef2f6)' }}>
                      9. Send Schedule Msg
                    </td>
                    {plans.map((p, idx) => (
                      <td key={p.planId || idx} className="text-center" style={{ padding: '14px 12px', borderRight: idx < plans.length - 1 ? '1px solid var(--zd-border, #eef2f6)' : 'none' }}>
                        {p.scheduleMsg ? (
                          <span className="plan-check-pill">
                            <span className="check-icon-circle">✓</span> Included
                          </span>
                        ) : (
                          <span className="plan-cross-pill">✕ Not Included</span>
                        )}
                      </td>
                    ))}
                  </tr>

                  {/* Row 10: IP security */}
                  <tr className="pricing-spec-row">
                    <td className="pricing-spec-label font-weight-bold" style={{ padding: '16px 20px', borderRight: '1px solid var(--zd-border, #eef2f6)' }}>
                      10. IP Security
                    </td>
                    {plans.map((p, idx) => (
                      <td key={p.planId || idx} className="text-center" style={{ padding: '14px 12px', borderRight: idx < plans.length - 1 ? '1px solid var(--zd-border, #eef2f6)' : 'none' }}>
                        {p.ipSecurity ? (
                          <span className="plan-check-pill">
                            <span className="check-icon-circle">✓</span> Included
                          </span>
                        ) : (
                          <span className="plan-cross-pill">✕ Not Included</span>
                        )}
                      </td>
                    ))}
                  </tr>

                  {/* Bottom Action Row with duplicate Buy Now buttons */}
                  <tr className="pricing-spec-row" style={{ background: 'var(--zd-border-subtle, rgba(0,0,0,0.02))' }}>
                    <td className="pricing-spec-label font-weight-bold" style={{ padding: '20px', borderRight: '1px solid var(--zd-border, #eef2f6)' }}>
                      Ready to get started?
                    </td>
                    {plans.map((p, idx) => {
                      const isCurrent = currentPlan?.toLowerCase() === p.name?.toLowerCase()
                      return (
                        <td key={p.planId || idx} className="text-center" style={{ padding: '20px 12px', borderRight: idx < plans.length - 1 ? '1px solid var(--zd-border, #eef2f6)' : 'none' }}>
                          {isCurrent ? (
                            <span className="badge badge-success-light" style={{ padding: '8px 18px', fontSize: 13, borderRadius: 20 }}>
                              ✓ Active Plan
                            </span>
                          ) : (
                            <button
                              type="button"
                              className="btn btn-primary"
                              onClick={() => handleOpenPurchase(p)}
                              style={{ borderRadius: 999, padding: '7px 22px', fontSize: 13, fontWeight: 700 }}
                            >
                              Buy {p.name}
                            </button>
                          )}
                        </td>
                      )
                    })}
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )
      ) : (
        /* MY PURCHASE REQUESTS TAB */
        <div className="card shadow-sm" style={{ borderRadius: 16 }}>
          <div className="card-header d-flex align-items-center justify-content-between" style={{ padding: '16px 20px', borderBottom: '1px solid var(--zd-border, rgba(0,0,0,0.06))' }}>
            <div>
              <h5 className="card-title mb-0" style={{ fontSize: 16, fontWeight: 700 }}>
                📋 My Subscription Purchase History
              </h5>
              <small className="text-muted">Track all your submitted plan purchase payments and activation statuses.</small>
            </div>
            <button 
              type="button" 
              className="btn btn-sm btn-outline-primary"
              onClick={fetchPlansData}
              style={{ borderRadius: 8 }}
            >
              ↻ Refresh
            </button>
          </div>

          <div className="card-body p-0">
            {myRequests.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '60px 20px' }}>
                <div style={{ fontSize: 36, marginBottom: 12 }}>💳</div>
                <h4>आपने अभी तक कोई पेमेंट रिक्वेस्ट नहीं भेजी है</h4>
                <p className="text-muted mb-3">You haven't submitted any plan purchase requests yet.</p>
                <button type="button" className="btn btn-primary" onClick={() => setActiveTab('plans')}>
                  Browse Plans &amp; Pricing
                </button>
              </div>
            ) : (
              <div className="table-responsive">
                <table className="table card-table table-vcenter text-nowrap mb-0">
                  <thead>
                    <tr style={{ background: 'var(--zd-card-bg, #f8fafc)', borderBottom: '1px solid var(--zd-border, #eef2f6)' }}>
                      <th style={{ fontWeight: 700 }}>Request ID</th>
                      <th style={{ fontWeight: 700 }}>Plan Name</th>
                      <th style={{ fontWeight: 700 }}>Amount</th>
                      <th style={{ fontWeight: 700 }}>Payment Date</th>
                      <th style={{ fontWeight: 700 }}>Bank / Txn Details</th>
                      <th style={{ fontWeight: 700 }}>Status</th>
                      <th style={{ fontWeight: 700 }}>Submitted On</th>
                      <th style={{ fontWeight: 700 }}>Notes / Reason</th>
                    </tr>
                  </thead>
                  <tbody>
                    {myRequests.map((req) => (
                      <tr key={req.requestId}>
                        <td>
                          <span style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: 12, color: 'var(--zd-text-muted, #64748b)' }}>
                            {req.requestId}
                          </span>
                        </td>
                        <td>
                          <strong style={{ fontSize: 14 }}>{req.planName}</strong>
                        </td>
                        <td>
                          <span style={{ fontSize: 15, fontWeight: 700, color: '#10b981' }}>
                            ₹{req.amount}
                          </span>
                        </td>
                        <td>
                          <span style={{ fontSize: 13 }}>{req.paymentDate}</span>
                        </td>
                        <td>
                          <div style={{ fontSize: 12, maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis' }} title={req.bankDetails}>
                            {req.bankDetails}
                          </div>
                        </td>
                        <td>
                          {req.status === 'pending' && (
                            <span className="badge badge-warning" style={{ fontSize: 11, padding: '4px 10px', borderRadius: 999 }}>
                              ⏳ Pending Review
                            </span>
                          )}
                          {req.status === 'approved' && (
                            <span className="badge badge-success" style={{ fontSize: 11, padding: '4px 10px', borderRadius: 999 }}>
                              ✓ Activated / Approved
                            </span>
                          )}
                          {req.status === 'rejected' && (
                            <span className="badge badge-danger" style={{ fontSize: 11, padding: '4px 10px', borderRadius: 999 }}>
                              ✕ Rejected
                            </span>
                          )}
                        </td>
                        <td>
                          <span style={{ fontSize: 12, color: 'var(--zd-text-muted, #8a98ac)' }}>
                            {req.createdAt ? new Date(req.createdAt).toLocaleDateString() : '-'}
                          </span>
                        </td>
                        <td>
                          <span style={{ fontSize: 12, color: 'var(--zd-text-muted, #8a98ac)' }}>
                            {req.adminNotes || '-'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* PAYMENT DETAILS POPUP MODAL (When user clicks Buy Now) */}
      {selectedPlan && (
        <PaymentDetailsModal 
          plan={selectedPlan}
          onClose={() => setSelectedPlan(null)}
          onSuccess={handlePurchaseSuccess}
          notify={notify}
        />
      )}
    </section>
  )
}

/* =========================================================
   USER PAYMENT DETAILS POPUP MODAL
========================================================= */

function PaymentDetailsModal({ plan, onClose, onSuccess, notify }) {
  const [amount, setAmount] = useState(plan.price)
  const [paymentDate, setPaymentDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [bankDetails, setBankDetails] = useState('')
  const [notes, setNotes] = useState('')
  const [screenshot, setScreenshot] = useState('')
  const [screenshotPreview, setScreenshotPreview] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const fileInputRef = useRef(null)

  const handleFileChange = (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (file.size > 5 * 1024 * 1024) {
      return notify('फाइल का आकार 5MB से कम होना चाहिए।')
    }

    const reader = new FileReader()
    reader.onload = () => {
      setScreenshot(reader.result)
      setScreenshotPreview(reader.result)
    }
    reader.readAsDataURL(file)
  }

  const removeScreenshot = () => {
    setScreenshot('')
    setScreenshotPreview('')
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!bankDetails.trim()) {
      return notify('कृपया Payment / Bank / UTR Details अवश्य भरें।')
    }

    setSubmitting(true)
    try {
      const d = await api('/api/plans/purchase', {
        method: 'POST',
        body: JSON.stringify({
          planId: plan.planId,
          amount: Number(amount) || plan.price,
          paymentDate,
          bankDetails: bankDetails.trim(),
          screenshot,
          notes: notes.trim()
        })
      })

      if (d.success) {
        notify('आपकी पेमेंट रिक्वेस्ट सफलतापूर्वक सबमिट हो गई है! एडमिन द्वारा अप्रूवल के बाद प्लान एक्टिवेट हो जाएगा।')
        onSuccess()
      }
    } catch (e) {
      notify('रिक्वेस्ट सबमिट करने में त्रुटि: ' + e.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div 
        className="modal-content-card" 
        onClick={e => e.stopPropagation()} 
        style={{ maxWidth: 580, width: '92%', borderRadius: 18, maxHeight: '92vh', overflowY: 'auto' }}
      >
        {/* Modal Header */}
        <div className="modal-header d-flex align-items-center justify-content-between" style={{ padding: '18px 24px', borderBottom: '1px solid var(--zd-border, #eef2f6)' }}>
          <div>
            <h5 className="modal-title font-weight-bold m-0" style={{ fontSize: 18, color: 'inherit' }}>
              💳 Complete Your Purchase
            </h5>
            <small className="text-muted">Enter your payment transaction details to activate {plan.name} plan.</small>
          </div>
          <button 
            type="button" 
            onClick={onClose}
            style={{ background: 'none', border: 'none', fontSize: 24, cursor: 'pointer', color: '#8a98ac', lineHeight: 1 }}
          >
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body" style={{ padding: '22px 24px' }}>
            {/* Selected Plan Summary Card */}
            <div className="card p-3 mb-4" style={{ borderRadius: 12, background: 'var(--zd-border-subtle, rgba(0,0,0,0.02))', border: '1px solid var(--zd-border, #eef2f6)' }}>
              <div className="d-flex align-items-center justify-content-between mb-2">
                <div>
                  <span className="badge badge-primary-light" style={{ fontSize: 11, padding: '3px 8px', marginBottom: 4, display: 'inline-block' }}>
                    Selected Plan
                  </span>
                  <h4 className="m-0 font-weight-bold" style={{ fontSize: 18, color: 'inherit' }}>{plan.name}</h4>
                </div>
                <div className="text-right">
                  <span style={{ fontSize: 22, fontWeight: 900, color: '#10b981' }}>₹{plan.price}</span>
                  <small className="text-muted d-block" style={{ fontSize: 11 }}>/ {plan.validity}</small>
                </div>
              </div>
              <div className="d-flex flex-wrap gap-2 text-muted" style={{ gap: 12, fontSize: 12, borderTop: '1px solid var(--zd-border, rgba(0,0,0,0.05))', paddingTop: 8 }}>
                <div>✓ <strong>Daily:</strong> {plan.dailyLimit}</div>
                <div>✓ <strong>Devices:</strong> {plan.deviceLimit}</div>
                {plan.apiAccess && <div>✓ <strong>API Access</strong></div>}
                {plan.groupOption && <div>✓ <strong>Group Sending</strong></div>}
              </div>
            </div>

            {/* Admin Bank & UPI Instructions Box */}
            <div className="alert alert-info mb-4" style={{ borderRadius: 12, padding: '12px 16px', fontSize: 12, lineHeight: 1.5 }}>
              <strong style={{ display: 'block', fontSize: 13, marginBottom: 4 }}>🏦 Payment Instructions:</strong>
              1. Pay the plan amount (<strong>₹{plan.price}</strong>) via Google Pay / PhonePe / Paytm / UPI to our payment address: 
              <div style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: 13, background: 'rgba(0,0,0,0.06)', padding: '4px 8px', borderRadius: 6, margin: '6px 0', display: 'inline-block' }}>
                upi-id: whatsapppay@upi / Bank Transfer
              </div>
              <div>2. Note the Transaction ID / UTR reference number and fill the form below.</div>
            </div>

            {/* Form Fields: Amount & Payment Date */}
            <div className="row g-3 mb-3">
              <div className="col-sm-6">
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, marginBottom: 6 }}>
                  Payment Amount (राशि ₹) *
                </label>
                <div className="input-group">
                  <span className="input-group-text" style={{ borderRadius: '8px 0 0 8px', fontWeight: 700 }}>₹</span>
                  <input 
                    type="number" 
                    className="form-control" 
                    value={amount}
                    onChange={e => setAmount(e.target.value)}
                    min="1"
                    required
                    style={{ height: 42, borderRadius: '0 8px 8px 0' }}
                  />
                </div>
              </div>
              <div className="col-sm-6">
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, marginBottom: 6 }}>
                  Payment Date (भुगतान की तारीख) *
                </label>
                <input 
                  type="date" 
                  className="form-control" 
                  value={paymentDate}
                  onChange={e => setPaymentDate(e.target.value)}
                  required
                  style={{ height: 42, borderRadius: 8 }}
                />
              </div>
            </div>

            {/* Bank Details & UTR */}
            <div className="form-group mb-3">
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, marginBottom: 6 }}>
                Bank / UPI / UTR Transaction ID (बैंक या UTR नंबर) *
              </label>
              <textarea 
                className="form-control" 
                rows="2"
                value={bankDetails}
                onChange={e => setBankDetails(e.target.value)}
                placeholder="e.g. Paid via Google Pay. UPI Ref / UTR No: 328491823901, Sender Bank: HDFC Bank"
                required
                style={{ borderRadius: 8, padding: '10px 12px' }}
              />
              <small className="text-muted">Enter UTR, Transaction Ref No, or Bank account from which payment was made.</small>
            </div>

            {/* Screenshot Upload (Optional) */}
            <div className="form-group mb-3">
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, marginBottom: 6 }}>
                Payment Screenshot / Receipt (स्क्रीनशॉट - वैकल्पिक)
              </label>
              <input 
                type="file" 
                ref={fileInputRef}
                accept="image/*"
                onChange={handleFileChange}
                className="form-control"
                style={{ height: 42, borderRadius: 8, padding: '7px 12px' }}
              />
              <small className="text-muted">Upload screenshot of your payment slip (PNG, JPG, max 5MB).</small>

              {screenshotPreview && (
                <div className="mt-2 position-relative d-inline-block">
                  <img 
                    src={screenshotPreview} 
                    alt="Payment Slip Preview" 
                    style={{ maxHeight: 110, borderRadius: 8, border: '1px solid #d0d7de', display: 'block' }}
                  />
                  <button 
                    type="button" 
                    onClick={removeScreenshot}
                    className="btn btn-sm btn-danger"
                    style={{ position: 'absolute', top: 4, right: 4, borderRadius: '50%', width: 22, height: 22, padding: 0, lineHeight: 1 }}
                    title="Remove Image"
                  >
                    ×
                  </button>
                </div>
              )}
            </div>

            {/* Notes */}
            <div className="form-group mb-0">
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, marginBottom: 6 }}>
                Additional Notes (अतिरिक्त टिप्पणी - वैकल्पिक)
              </label>
              <input 
                type="text" 
                className="form-control" 
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Any special remarks for admin"
                style={{ height: 40, borderRadius: 8 }}
              />
            </div>
          </div>

          <div className="modal-footer d-flex justify-content-end gap-2" style={{ padding: '14px 24px', borderTop: '1px solid var(--zd-border, #eef2f6)', gap: 10 }}>
            <button 
              type="button" 
              className="btn btn-outline-secondary" 
              onClick={onClose}
              disabled={submitting}
              style={{ borderRadius: 8, padding: '8px 16px', fontWeight: 600 }}
            >
              Cancel
            </button>
            <button 
              type="submit" 
              className="btn btn-primary"
              disabled={submitting}
              style={{ borderRadius: 8, padding: '8px 24px', fontWeight: 700 }}
            >
              {submitting ? '⏳ Submitting Request...' : '✓ Submit Payment Details'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

/* =========================================================
   ADMIN PURCHASE REQUESTS MANAGEMENT PAGE
========================================================= */

function AdminPlanRequestsPage({ notify }) {
  const [requests, setRequests] = useState([])
  const [counts, setCounts] = useState({ total: 0, pending: 0, approved: 0, rejected: 0 })
  const [loading, setLoading] = useState(false)
  const [statusFilter, setStatusFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [actionLoading, setActionLoading] = useState('')
  const [previewImage, setPreviewImage] = useState(null)
  const [rejectingRequest, setRejectingRequest] = useState(null)
  const [rejectNote, setRejectNote] = useState('')

  const fetchRequests = useCallback(async () => {
    setLoading(true)
    try {
      const qs = statusFilter !== 'all' ? `?status=${statusFilter}` : ''
      const d = await api(`/api/admin/plan-requests${qs}`)
      if (d.success) {
        setRequests(d.requests || [])
        if (d.counts) setCounts(d.counts)
      }
    } catch (e) {
      notify('अनुरोध लोड करने में त्रुटि: ' + e.message)
    } finally {
      setLoading(false)
    }
  }, [statusFilter, notify])

  useEffect(() => {
    fetchRequests()
  }, [fetchRequests])

  const handleApprove = async (req) => {
    const confirmMsg = `क्या आप User ${req.userName} (${req.userMobile || req.userId}) का प्लान '${req.planName}' तुरंत एक्टिवेट करना चाहते हैं?`
    if (!window.confirm(confirmMsg)) return

    setActionLoading(req.requestId)
    try {
      const d = await api(`/api/admin/plan-requests/${req.requestId}/approve`, {
        method: 'POST',
        body: JSON.stringify({ notes: 'Approved by admin' })
      })
      if (d.success) {
        notify(d.message || 'प्लान सफलतापूर्वक एक्टिवेट कर दिया गया!')
        fetchRequests()
      }
    } catch (e) {
      notify('Approve Error: ' + e.message)
    } finally {
      setActionLoading('')
    }
  }

  const openRejectModal = (req) => {
    setRejectingRequest(req)
    setRejectNote('')
  }

  const handleConfirmReject = async (e) => {
    e.preventDefault()
    if (!rejectingRequest) return

    setActionLoading(rejectingRequest.requestId)
    try {
      const d = await api(`/api/admin/plan-requests/${rejectingRequest.requestId}/reject`, {
        method: 'POST',
        body: JSON.stringify({ notes: rejectNote.trim() || 'Payment details could not be verified' })
      })
      if (d.success) {
        notify('रिक्वेस्ट अस्वीकार (Reject) कर दी गई है।')
        setRejectingRequest(null)
        fetchRequests()
      }
    } catch (e) {
      notify('Reject Error: ' + e.message)
    } finally {
      setActionLoading('')
    }
  }

  const filteredRequests = useMemo(() => {
    if (!search.trim()) return requests
    const q = search.toLowerCase()
    return requests.filter(r => 
      (r.userName && r.userName.toLowerCase().includes(q)) ||
      (r.userMobile && r.userMobile.includes(q)) ||
      (r.userId && r.userId.toLowerCase().includes(q)) ||
      (r.requestId && r.requestId.toLowerCase().includes(q)) ||
      (r.planName && r.planName.toLowerCase().includes(q)) ||
      (r.bankDetails && r.bankDetails.toLowerCase().includes(q))
    )
  }, [requests, search])

  return (
    <section className="admin-plan-requests-page">
      {/* Page Header */}
      <div className="page-header d-flex flex-wrap align-items-center justify-content-between mb-4">
        <div>
          <h1 className="page-title mb-1" style={{ fontSize: 24, fontWeight: 700, color: 'inherit' }}>
            💳 Plan Purchase Requests
          </h1>
          <ol className="breadcrumb mb-0" style={{ background: 'transparent', padding: 0, fontSize: 13 }}>
            <li className="breadcrumb-item text-muted">Admin</li>
            <li className="breadcrumb-item active text-primary">Purchase Requests &amp; Approvals</li>
          </ol>
        </div>
        <div className="d-flex align-items-center gap-2 mt-2 mt-md-0">
          <button 
            type="button" 
            className="btn btn-outline-primary"
            onClick={fetchRequests}
            disabled={loading}
            style={{ borderRadius: 8, padding: '8px 16px', fontWeight: 600, fontSize: 13 }}
          >
            ↻ Refresh Requests
          </button>
        </div>
      </div>

      {/* Metric Counters */}
      <div className="row row-cards mb-4">
        <div className="col-sm-6 col-lg-3">
          <div 
            className="card p-3 cursor-pointer" 
            style={{ borderRadius: 12, border: statusFilter === 'all' ? '2px solid #4f75f2' : undefined }}
            onClick={() => setStatusFilter('all')}
          >
            <div className="d-flex align-items-center">
              <span className="stamp stamp-md mr-3" style={{ marginRight: 14, fontSize: 20, width: 44, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 10, background: 'rgba(79, 117, 242, 0.12)', color: '#4f75f2' }}>
                📋
              </span>
              <div>
                <h4 className="m-0 font-weight-bold" style={{ fontSize: 20 }}>{counts.total}</h4>
                <small className="text-muted">Total Requests</small>
              </div>
            </div>
          </div>
        </div>

        <div className="col-sm-6 col-lg-3">
          <div 
            className="card p-3 cursor-pointer" 
            style={{ borderRadius: 12, border: statusFilter === 'pending' ? '2px solid #ffab00' : undefined }}
            onClick={() => setStatusFilter('pending')}
          >
            <div className="d-flex align-items-center">
              <span className="stamp stamp-md mr-3" style={{ marginRight: 14, fontSize: 20, width: 44, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 10, background: 'rgba(255, 171, 0, 0.14)', color: '#ffab00' }}>
                ⏳
              </span>
              <div>
                <h4 className="m-0 font-weight-bold" style={{ fontSize: 20, color: counts.pending > 0 ? '#ffab00' : 'inherit' }}>
                  {counts.pending}
                </h4>
                <small className="text-muted">Pending Approvals</small>
              </div>
            </div>
          </div>
        </div>

        <div className="col-sm-6 col-lg-3">
          <div 
            className="card p-3 cursor-pointer" 
            style={{ borderRadius: 12, border: statusFilter === 'approved' ? '2px solid #2dce89' : undefined }}
            onClick={() => setStatusFilter('approved')}
          >
            <div className="d-flex align-items-center">
              <span className="stamp stamp-md mr-3" style={{ marginRight: 14, fontSize: 20, width: 44, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 10, background: 'rgba(45, 206, 137, 0.12)', color: '#2dce89' }}>
                ✓
              </span>
              <div>
                <h4 className="m-0 font-weight-bold" style={{ fontSize: 20 }}>{counts.approved}</h4>
                <small className="text-muted">Approved &amp; Active</small>
              </div>
            </div>
          </div>
        </div>

        <div className="col-sm-6 col-lg-3">
          <div 
            className="card p-3 cursor-pointer" 
            style={{ borderRadius: 12, border: statusFilter === 'rejected' ? '2px solid #f5365c' : undefined }}
            onClick={() => setStatusFilter('rejected')}
          >
            <div className="d-flex align-items-center">
              <span className="stamp stamp-md mr-3" style={{ marginRight: 14, fontSize: 20, width: 44, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 10, background: 'rgba(245, 54, 92, 0.12)', color: '#f5365c' }}>
                ✕
              </span>
              <div>
                <h4 className="m-0 font-weight-bold" style={{ fontSize: 20 }}>{counts.rejected}</h4>
                <small className="text-muted">Rejected Requests</small>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Table Card */}
      <div className="card shadow-sm" style={{ borderRadius: 16 }}>
        {/* Filters Header */}
        <div className="card-header d-flex flex-wrap align-items-center justify-content-between p-3" style={{ borderBottom: '1px solid var(--zd-border, rgba(0,0,0,0.06))', gap: 12 }}>
          {/* Status Tabs */}
          <div className="btn-group" role="group">
            <button 
              type="button" 
              className={`btn btn-sm ${statusFilter === 'all' ? 'btn-primary' : 'btn-outline-secondary'}`}
              onClick={() => setStatusFilter('all')}
              style={{ borderRadius: '6px 0 0 6px', fontWeight: 600 }}
            >
              All ({counts.total})
            </button>
            <button 
              type="button" 
              className={`btn btn-sm ${statusFilter === 'pending' ? 'btn-primary' : 'btn-outline-secondary'}`}
              onClick={() => setStatusFilter('pending')}
              style={{ fontWeight: 600 }}
            >
              Pending ({counts.pending})
            </button>
            <button 
              type="button" 
              className={`btn btn-sm ${statusFilter === 'approved' ? 'btn-primary' : 'btn-outline-secondary'}`}
              onClick={() => setStatusFilter('approved')}
              style={{ fontWeight: 600 }}
            >
              Approved ({counts.approved})
            </button>
            <button 
              type="button" 
              className={`btn btn-sm ${statusFilter === 'rejected' ? 'btn-primary' : 'btn-outline-secondary'}`}
              onClick={() => setStatusFilter('rejected')}
              style={{ borderRadius: '0 6px 6px 0', fontWeight: 600 }}
            >
              Rejected ({counts.rejected})
            </button>
          </div>

          {/* Search Box */}
          <div style={{ maxWidth: 280, width: '100%' }}>
            <input 
              type="text" 
              className="form-control form-control-sm"
              placeholder="Search user, mobile, ID, UTR..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ borderRadius: 8, height: 36 }}
            />
          </div>
        </div>

        {/* Requests Table Body */}
        <div className="card-body p-0">
          {loading ? (
            <div style={{ textAlign: 'center', padding: '60px 20px', color: '#6b7280' }}>
              <div className="spinner-border text-primary mb-2" role="status"></div>
              <div>अनुरोध लोड हो रहे हैं (Loading purchase requests)...</div>
            </div>
          ) : filteredRequests.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 20px' }}>
              <div style={{ fontSize: 36, marginBottom: 12 }}>🔍</div>
              <h4>कोई अनुरोध नहीं मिला</h4>
              <p className="text-muted">No purchase requests matching your criteria.</p>
            </div>
          ) : (
            <div className="table-responsive">
              <table className="table card-table table-vcenter text-nowrap mb-0">
                <thead>
                  <tr style={{ background: 'var(--zd-card-bg, #f8fafc)', borderBottom: '1px solid var(--zd-border, #eef2f6)' }}>
                    <th style={{ fontWeight: 700 }}>Request ID</th>
                    <th style={{ fontWeight: 700 }}>User Details</th>
                    <th style={{ fontWeight: 700 }}>Requested Plan</th>
                    <th style={{ fontWeight: 700 }}>Amount</th>
                    <th style={{ fontWeight: 700 }}>Payment Info</th>
                    <th style={{ fontWeight: 700, textAlign: 'center' }}>Screenshot Proof</th>
                    <th style={{ fontWeight: 700, textAlign: 'center' }}>Status</th>
                    <th style={{ fontWeight: 700, textAlign: 'right', paddingRight: 24 }}>Actions / Approvals</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRequests.map((req) => (
                    <tr key={req.requestId}>
                      <td>
                        <span style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: 12, color: 'var(--zd-text-muted, #64748b)' }}>
                          {req.requestId}
                        </span>
                        <div style={{ fontSize: 11, color: 'var(--zd-text-muted, #8a98ac)' }}>
                          {req.createdAt ? new Date(req.createdAt).toLocaleDateString() : ''}
                        </div>
                      </td>
                      <td>
                        <div>
                          <strong style={{ fontSize: 14, color: 'inherit' }}>{req.userName || 'User'}</strong>
                          <div style={{ fontSize: 12, color: 'var(--zd-text-muted, #64748b)' }}>
                            📱 {req.userMobile || 'No Phone'}
                          </div>
                          <small className="text-muted" style={{ fontFamily: 'monospace', fontSize: 11 }}>
                            ID: {req.userId}
                          </small>
                        </div>
                      </td>
                      <td>
                        <span className="badge badge-primary-light" style={{ fontSize: 12, padding: '4px 10px', fontWeight: 700 }}>
                          {req.planName}
                        </span>
                      </td>
                      <td>
                        <span style={{ fontSize: 16, fontWeight: 800, color: '#10b981' }}>
                          ₹{req.amount}
                        </span>
                      </td>
                      <td>
                        <div style={{ maxWidth: 220, fontSize: 12 }}>
                          <div><strong>Date:</strong> {req.paymentDate}</div>
                          <div style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }} title={req.bankDetails}>
                            <strong>Txn:</strong> {req.bankDetails}
                          </div>
                          {req.adminNotes && (
                            <small className="text-muted d-block mt-1">
                              <em>Note: {req.adminNotes}</em>
                            </small>
                          )}
                        </div>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        {req.screenshot ? (
                          <div 
                            style={{ cursor: 'pointer', display: 'inline-block' }}
                            onClick={() => setPreviewImage(req.screenshot)}
                            title="Click to view full screenshot"
                          >
                            <img 
                              src={req.screenshot} 
                              alt="Receipt" 
                              style={{ width: 44, height: 44, objectFit: 'cover', borderRadius: 8, border: '1px solid #d0d7de' }}
                            />
                            <small className="d-block text-primary" style={{ fontSize: 10, fontWeight: 700 }}>View 🔍</small>
                          </div>
                        ) : (
                          <span className="text-muted" style={{ fontSize: 12 }}>No Slip</span>
                        )}
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        {req.status === 'pending' && (
                          <span className="badge badge-warning" style={{ fontSize: 11, padding: '4px 10px', borderRadius: 999 }}>
                            ⏳ Pending
                          </span>
                        )}
                        {req.status === 'approved' && (
                          <span className="badge badge-success" style={{ fontSize: 11, padding: '4px 10px', borderRadius: 999 }}>
                            ✓ Approved
                          </span>
                        )}
                        {req.status === 'rejected' && (
                          <span className="badge badge-danger" style={{ fontSize: 11, padding: '4px 10px', borderRadius: 999 }}>
                            ✕ Rejected
                          </span>
                        )}
                      </td>
                      <td style={{ textAlign: 'right', paddingRight: 20 }}>
                        {req.status === 'pending' ? (
                          <div className="d-inline-flex gap-1" style={{ gap: 6 }}>
                            <button
                              type="button"
                              className="btn btn-sm btn-success"
                              onClick={() => handleApprove(req)}
                              disabled={actionLoading === req.requestId}
                              style={{ borderRadius: 6, padding: '5px 12px', fontSize: 12, fontWeight: 700 }}
                            >
                              {actionLoading === req.requestId ? '⏳' : '✓ Approve Plan'}
                            </button>
                            <button
                              type="button"
                              className="btn btn-sm btn-outline-danger"
                              onClick={() => openRejectModal(req)}
                              disabled={actionLoading === req.requestId}
                              style={{ borderRadius: 6, padding: '5px 10px', fontSize: 12, fontWeight: 600 }}
                            >
                              ✕ Reject
                            </button>
                          </div>
                        ) : req.status === 'approved' ? (
                          <span className="text-success" style={{ fontSize: 12, fontWeight: 600 }}>
                            Plan Activated ✓
                          </span>
                        ) : (
                          <span className="text-danger" style={{ fontSize: 12 }}>
                            Rejected
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* SCREENSHOT LIGHTBOX MODAL */}
      {previewImage && (
        <div className="modal-overlay" onClick={() => setPreviewImage(null)}>
          <div 
            className="modal-content-card" 
            onClick={e => e.stopPropagation()} 
            style={{ maxWidth: 650, width: '92%', borderRadius: 16, textAlign: 'center', padding: 20 }}
          >
            <div className="d-flex align-items-center justify-content-between mb-3">
              <h5 className="m-0 font-weight-bold" style={{ color: 'inherit' }}>Payment Screenshot / Receipt</h5>
              <button 
                type="button" 
                onClick={() => setPreviewImage(null)}
                style={{ background: 'none', border: 'none', fontSize: 24, cursor: 'pointer', color: '#8a98ac', lineHeight: 1 }}
              >
                ×
              </button>
            </div>
            <div style={{ maxHeight: '75vh', overflow: 'auto', borderRadius: 8 }}>
              <img 
                src={previewImage} 
                alt="Full Payment Slip" 
                style={{ maxWidth: '100%', height: 'auto', display: 'inline-block', borderRadius: 8 }}
              />
            </div>
            <div className="mt-3">
              <button 
                type="button" 
                className="btn btn-sm btn-secondary" 
                onClick={() => setPreviewImage(null)}
                style={{ borderRadius: 8, padding: '6px 18px' }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* REJECT REQUEST MODAL */}
      {rejectingRequest && (
        <div className="modal-overlay" onClick={() => setRejectingRequest(null)}>
          <div 
            className="modal-content-card" 
            onClick={e => e.stopPropagation()} 
            style={{ maxWidth: 480, width: '90%', borderRadius: 16 }}
          >
            <div className="modal-header d-flex align-items-center justify-content-between" style={{ padding: '16px 20px', borderBottom: '1px solid var(--zd-border, #eef2f6)' }}>
              <h5 className="modal-title font-weight-bold m-0" style={{ fontSize: 16, color: '#dc2626' }}>
                ✕ Reject Purchase Request
              </h5>
              <button 
                type="button" 
                onClick={() => setRejectingRequest(null)}
                style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: '#8a98ac', lineHeight: 1 }}
              >
                ×
              </button>
            </div>
            <form onSubmit={handleConfirmReject}>
              <div className="modal-body" style={{ padding: 20 }}>
                <p style={{ fontSize: 13, color: 'inherit' }}>
                  User <strong>{rejectingRequest.userName}</strong> ({rejectingRequest.userMobile}) की 
                  <strong> {rejectingRequest.planName} (₹{rejectingRequest.amount})</strong> रिक्वेस्ट को अस्वीकार करने का कारण लिखें:
                </p>
                <div className="form-group mb-0">
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 700, marginBottom: 6 }}>
                    Rejection Reason / Note (अस्वीकृति का कारण)
                  </label>
                  <textarea 
                    className="form-control" 
                    rows="3"
                    value={rejectNote}
                    onChange={e => setRejectNote(e.target.value)}
                    placeholder="e.g. UTR number not matched with bank account, or incorrect amount paid."
                    style={{ borderRadius: 8 }}
                  />
                </div>
              </div>
              <div className="modal-footer d-flex justify-content-end gap-2" style={{ padding: '12px 20px', borderTop: '1px solid var(--zd-border, #eef2f6)', gap: 10 }}>
                <button 
                  type="button" 
                  className="btn btn-outline-secondary" 
                  onClick={() => setRejectingRequest(null)}
                  style={{ borderRadius: 8, padding: '7px 14px' }}
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="btn btn-danger"
                  style={{ borderRadius: 8, padding: '7px 18px', fontWeight: 700 }}
                >
                  Confirm Reject
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  )
}

function GroupMembersModal({ group, onClose, notify }) {
  const [searchTerm, setSearchTerm] = useState('')
  const [copied, setCopied] = useState(false)

  if (!group) return null

  const participants = group.participants || []
  const filtered = participants.filter(p => {
    const term = searchTerm.toLowerCase()
    return (p.phone && p.phone.includes(term)) || (p.role && p.role.toLowerCase().includes(term))
  })

  const copyAllNumbers = () => {
    const phones = participants.map(p => p.phone).filter(Boolean)
    if (phones.length === 0) return
    navigator.clipboard.writeText(phones.join(', '))
    setCopied(true)
    notify(`${phones.length} नंबर्स क्लिपबोर्ड पर कॉपी हो गए`)
    setTimeout(() => setCopied(false), 2000)
  }

  const exportToExcel = () => {
    try {
      const rows = participants.map((p, idx) => ({
        'S.No': idx + 1,
        'Phone Number': p.phone ? `+${p.phone}` : '',
        'Role': p.role || 'Member',
        'Is Admin': p.isAdmin ? 'Yes' : 'No'
      }))
      const ws = XLSX.utils.json_to_sheet(rows)
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, 'Participants')
      const fileName = `${(group.subject || 'group').replace(/[^a-zA-Z0-9_-]/g, '_')}_members.xlsx`
      XLSX.writeFile(wb, fileName)
      notify('एक्सेल फ़ाइल डाउनलोड हो गई!')
    } catch (e) {
      notify('एक्सपोर्ट एरर: ' + e.message)
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card modal-large" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div className="group-avatar-wrapper">
              {group.dp ? (
                <img src={group.dp} alt="DP" className="group-avatar-img" />
              ) : (
                <div className="group-avatar-placeholder">👥</div>
              )}
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: 16 }}>{group.subject || 'Unnamed Group'}</h3>
              <p style={{ margin: 0, fontSize: 12, color: '#64748b' }}>
                कुल {participants.length} सदस्य (Participants) • ID: <code style={{ fontSize: 11 }}>{group.id}</code>
              </p>
            </div>
          </div>
          <button type="button" onClick={onClose}>×</button>
        </div>

        <div className="modal-body">
          <div style={{ display: 'flex', gap: 10, marginBottom: 14, flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
            <input 
              type="text" 
              placeholder="🔍 नंबर या रोल से खोजें..." 
              value={searchTerm} 
              onChange={e => setSearchTerm(e.target.value)}
              style={{ maxWidth: 260, margin: 0 }}
            />
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="button" className="btn-action-icon" onClick={copyAllNumbers} title="Copy All Numbers">
                {copied ? '✓ कॉपी हुआ' : '📋 Copy All Numbers'}
              </button>
              <button type="button" className="btn-action-icon" onClick={exportToExcel} title="Download Excel">
                📥 Export Excel
              </button>
            </div>
          </div>

          <div className="group-members-list-container">
            <table className="groups-table">
              <thead>
                <tr>
                  <th style={{ width: 40 }}>#</th>
                  <th>मोबाइल नंबर (Phone)</th>
                  <th>रोल (Role)</th>
                  <th style={{ textAlign: 'right' }}>एक्शन</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((p, idx) => (
                  <tr key={p.id || idx}>
                    <td style={{ color: '#64748b' }}>{idx + 1}</td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontWeight: 600 }}>+{p.phone}</span>
                      </div>
                    </td>
                    <td>
                      <span className={`badge ${p.isSuperAdmin ? 'badge-purple' : p.isAdmin ? 'badge-primary' : 'badge-secondary'}`}>
                        {p.isSuperAdmin ? '👑 Super Admin' : p.isAdmin ? '🛡️ Admin' : '👤 Member'}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <button 
                        type="button" 
                        className="btn-action-icon"
                        style={{ fontSize: 11, padding: '4px 8px' }}
                        onClick={() => {
                          navigator.clipboard.writeText(p.phone)
                          notify(`नंबर +${p.phone} कॉपी हुआ`)
                        }}
                      >
                        📋 Copy
                      </button>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={4} style={{ textAlign: 'center', padding: 24, color: '#94a3b8' }}>
                      कोई सदस्य नहीं मिला।
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="modal-footer">
          <button type="button" className="btn-action-icon" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  )
}

function GroupsPage({ notify, status, isAdmin, currentUser }) {
  const [sessions, setSessions] = useState([])
  const [selectedSession, setSelectedSession] = useState('')
  const [groups, setGroups] = useState([])
  const [loading, setLoading] = useState(false)
  const [selectedGroupIds, setSelectedGroupIds] = useState(new Set())
  const [searchQuery, setSearchQuery] = useState('')
  const [roleFilter, setRoleFilter] = useState('all')
  const [activeModalGroup, setActiveModalGroup] = useState(null)

  // Message Sending states
  const [msgText, setMsgText] = useState('')
  const [attachment, setAttachment] = useState(null)
  const [showEmojiPicker, setShowEmojiPicker] = useState(false)
  const [sendingProgress, setSendingProgress] = useState({
    active: false,
    current: 0,
    total: 0,
    currentGroupName: '',
    sentCount: 0,
    failCount: 0
  })

  const fileInputRef = useRef(null)

  // Load Sessions
  const loadSessions = useCallback(async () => {
    try {
      const d = await api('/api/user/whatsapp/sessions')
      const list = d.sessions || []
      setSessions(list)
      if (list.length > 0) {
        const connected = list.find(s => s.status === 'connected')
        if (connected) {
          setSelectedSession(connected.id || connected.sessionId)
        } else if (!selectedSession) {
          setSelectedSession(list[0].id || list[0].sessionId)
        }
      }
    } catch (e) {
      console.warn('Sessions load warning:', e.message)
    }
  }, [selectedSession])

  useEffect(() => {
    loadSessions()
  }, [loadSessions])

  // Fetch Groups
  const fetchGroups = useCallback(async (sessId) => {
    const targetSession = sessId !== undefined ? sessId : selectedSession
    setLoading(true)
    try {
      const url = targetSession 
        ? `/api/whatsapp/groups?session=${encodeURIComponent(targetSession)}` 
        : '/api/whatsapp/groups'
      const res = await api(url)
      if (res.success && Array.isArray(res.groups)) {
        setGroups(res.groups)
        setSelectedGroupIds(new Set())
        notify(`${res.groups.length} ग्रुप्स लोड हो गए।`)
      } else {
        setGroups([])
        notify(res.message || 'ग्रुप्स लोड नहीं हुए।')
      }
    } catch (e) {
      notify('ग्रुप्स लोड करने में एरर: ' + e.message)
      setGroups([])
    } finally {
      setLoading(false)
    }
  }, [selectedSession, notify])

  useEffect(() => {
    if (selectedSession || status?.status === 'connected') {
      fetchGroups(selectedSession)
    }
  }, [selectedSession])

  // Filtered groups
  const filteredGroups = useMemo(() => {
    return groups.filter(g => {
      const matchesSearch = !searchQuery.trim() || 
        (g.subject && g.subject.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (g.id && g.id.toLowerCase().includes(searchQuery.toLowerCase()))
      
      const matchesRole = 
        roleFilter === 'all' ||
        (roleFilter === 'admin' && (g.myRole === 'Admin' || g.myRole === 'Super Admin')) ||
        (roleFilter === 'member' && g.myRole === 'Member')

      return matchesSearch && matchesRole
    })
  }, [groups, searchQuery, roleFilter])

  // Selection handlers
  const toggleSelectGroup = (gid) => {
    setSelectedGroupIds(prev => {
      const next = new Set(prev)
      if (next.has(gid)) next.delete(gid)
      else next.add(gid)
      return next
    })
  }

  const selectAllFiltered = () => {
    const allFilteredIds = filteredGroups.map(g => g.id)
    setSelectedGroupIds(new Set(allFilteredIds))
  }

  const clearSelection = () => {
    setSelectedGroupIds(new Set())
  }

  const isAllFilteredSelected = filteredGroups.length > 0 && filteredGroups.every(g => selectedGroupIds.has(g.id))

  // Attachment handler
  const handleAttachment = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 15 * 1024 * 1024) {
      notify('फ़ाइल साइज़ 15 MB से कम होना चाहिए।')
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      setAttachment({
        name: file.name,
        type: file.type || 'application/octet-stream',
        data: reader.result
      })
      notify(`फ़ाइल "${file.name}" चुनी गई`)
    }
    reader.readAsDataURL(file)
  }

  // Send Group Message
  const handleSendGroupMessage = async () => {
    const selectedIds = Array.from(selectedGroupIds)
    if (selectedIds.length === 0) {
      notify('कृपया कम से कम 1 ग्रुप चुनें!')
      return
    }
    if (!msgText.trim() && !attachment) {
      notify('कृपया मैसेज लिखें या अटैचमेंट जोड़ें!')
      return
    }

    setSendingProgress({
      active: true,
      current: 0,
      total: selectedIds.length,
      currentGroupName: 'तैयारी हो रही है...',
      sentCount: 0,
      failCount: 0
    })

    try {
      const payload = {
        groupIds: selectedIds,
        message: msgText.trim(),
        session: selectedSession,
        attachment: attachment
      }

      const res = await api('/api/send-group-message', {
        method: 'POST',
        body: JSON.stringify(payload)
      })

      if (res.success) {
        const sent = res.results?.filter(r => r.status === 'sent')?.length || selectedIds.length
        const failed = res.results?.filter(r => r.status === 'failed')?.length || 0
        setSendingProgress(prev => ({
          ...prev,
          active: false,
          current: selectedIds.length,
          sentCount: sent,
          failCount: failed
        }))
        notify(`✓ ${sent} ग्रुप्स में मैसेज सफलतापुर्वक भेजा गया!${failed > 0 ? ` (${failed} विफल)` : ''}`)
        setMsgText('')
        setAttachment(null)
        if (fileInputRef.current) fileInputRef.current.value = ''
      } else {
        throw new Error(res.message || 'मैसेज भेजने में समस्या हुई।')
      }
    } catch (e) {
      notify('एरर: ' + e.message)
      setSendingProgress(prev => ({ ...prev, active: false }))
    }
  }

  // Copy Group ID
  const copyGroupId = (gid) => {
    navigator.clipboard.writeText(gid)
    notify(`Group ID कॉपी हुई: ${gid}`)
  }

  // Calculate Reach
  const totalReach = useMemo(() => {
    return groups
      .filter(g => selectedGroupIds.has(g.id))
      .reduce((acc, g) => acc + (g.size || 0), 0)
  }, [groups, selectedGroupIds])

  return (
    <section className="groups-page-container">
      {/* Top Header Card */}
      <div className="groups-header-card">
        <div className="groups-title-area">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 26 }}>👥</span>
            <div>
              <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: '#172433' }}>WhatsApp Groups</h2>
              <p style={{ margin: 0, fontSize: 13, color: '#64748b' }}>
                स्कैन किए गए WhatsApp के सभी ग्रुप्स देखें, मेंबर्स चेक करें और डायरेक्ट मैसेज भेजें।
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            {sessions.length > 0 && (
              <select 
                className="field-select" 
                style={{ width: 'auto', minWidth: 160, padding: '7px 10px', fontSize: 12 }}
                value={selectedSession} 
                onChange={e => setSelectedSession(e.target.value)}
              >
                {sessions.map(s => (
                  <option key={s.id || s.sessionId} value={s.id || s.sessionId}>
                    {s.number ? `+${s.number}` : s.name} ({s.status})
                  </option>
                ))}
              </select>
            )}
            <button 
              className="btn-action-icon" 
              onClick={() => fetchGroups(selectedSession)} 
              disabled={loading}
              title="रीफ्रेश ग्रुप्स"
            >
              {loading ? '⏳ फेच हो रहा है...' : '🔄 Refresh Groups'}
            </button>
          </div>
        </div>

        {/* Stats Row */}
        <div className="groups-stats-grid">
          <div className="group-stat-card">
            <span className="stat-label">कुल ग्रुप्स</span>
            <span className="stat-value">{groups.length}</span>
          </div>
          <div className="group-stat-card highlight">
            <span className="stat-label">चुने गए ग्रुप्स</span>
            <span className="stat-value">{selectedGroupIds.size}</span>
          </div>
          <div className="group-stat-card">
            <span className="stat-label">एडमिन ग्रुप्स</span>
            <span className="stat-value">{groups.filter(g => g.myRole === 'Admin' || g.myRole === 'Super Admin').length}</span>
          </div>
          <div className="group-stat-card">
            <span className="stat-label">कुल रीच (Members)</span>
            <span className="stat-value">{totalReach.toLocaleString()}</span>
          </div>
        </div>
      </div>

      {/* Main Content Layout: Left Table, Right/Bottom Composer */}
      <div className="groups-content-grid">
        {/* Table Area */}
        <div className="groups-table-card">
          {/* Table Controls */}
          <div className="groups-table-toolbar">
            <div style={{ display: 'flex', gap: 10, flex: 1, minWidth: 260 }}>
              <input 
                type="text" 
                className="field-input" 
                placeholder="🔍 ग्रुप नाम या ID से खोजें..." 
                value={searchQuery} 
                onChange={e => setSearchQuery(e.target.value)}
                style={{ fontSize: 12, padding: '8px 12px' }}
              />
              <select 
                className="field-select" 
                style={{ width: 'auto', minWidth: 120, fontSize: 12, padding: '8px 10px' }}
                value={roleFilter} 
                onChange={e => setRoleFilter(e.target.value)}
              >
                <option value="all">सभी ग्रुप्स</option>
                <option value="admin">केवल Admin</option>
                <option value="member">केवल Member</option>
              </select>
            </div>

            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <button 
                type="button" 
                className="btn-action-icon" 
                style={{ fontSize: 12, padding: '6px 12px' }}
                onClick={isAllFilteredSelected ? clearSelection : selectAllFiltered}
              >
                {isAllFilteredSelected ? '❌ Deselect All' : '☑️ Select All Filtered'}
              </button>
            </div>
          </div>

          {/* Table */}
          <div className="groups-table-wrapper">
            <table className="groups-table">
              <thead>
                <tr>
                  <th style={{ width: 36, textAlign: 'center' }}>
                    <input 
                      type="checkbox" 
                      checked={isAllFilteredSelected} 
                      onChange={isAllFilteredSelected ? clearSelection : selectAllFiltered} 
                    />
                  </th>
                  <th style={{ width: 48, textAlign: 'center' }}>DP</th>
                  <th>ग्रुप विवरण (Group Details)</th>
                  <th style={{ width: 110 }}>सदस्य संख्या</th>
                  <th style={{ width: 100 }}>मेरा रोल</th>
                  <th style={{ width: 130, textAlign: 'right' }}>एक्शन</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={6} style={{ textAlign: 'center', padding: 40, color: '#64748b' }}>
                      <div style={{ fontSize: 24, marginBottom: 8 }}>⏳</div>
                      WhatsApp से ग्रुप्स फेच किए जा रहे हैं, कृपया प्रतीक्षा करें...
                    </td>
                  </tr>
                ) : filteredGroups.length > 0 ? (
                  filteredGroups.map(g => {
                    const isSelected = selectedGroupIds.has(g.id)
                    return (
                      <tr key={g.id} className={isSelected ? 'row-selected' : ''}>
                        <td style={{ textAlign: 'center' }}>
                          <input 
                            type="checkbox" 
                            checked={isSelected} 
                            onChange={() => toggleSelectGroup(g.id)} 
                          />
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <div className="group-avatar-wrapper small">
                            {g.dp ? (
                              <img 
                                src={g.dp} 
                                alt="DP" 
                                className="group-avatar-img" 
                                onError={e => { e.currentTarget.style.display = 'none'; e.currentTarget.parentElement.innerHTML = '👥' }}
                              />
                            ) : (
                              <div className="group-avatar-placeholder">👥</div>
                            )}
                          </div>
                        </td>
                        <td>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                            <span style={{ fontWeight: 700, color: '#172433', fontSize: 13 }}>
                              {g.subject || 'Unnamed Group'}
                            </span>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <code style={{ fontSize: 11, color: '#64748b' }}>{g.id}</code>
                              <button 
                                type="button" 
                                className="btn-copy-mini" 
                                onClick={() => copyGroupId(g.id)}
                                title="Copy Group ID"
                              >
                                📋
                              </button>
                            </div>
                            {g.desc && (
                              <span style={{ fontSize: 11, color: '#94a3b8', maxWidth: 350, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {g.desc}
                              </span>
                            )}
                          </div>
                        </td>
                        <td>
                          <span className="badge badge-info">
                            👥 {g.size || 0}
                          </span>
                        </td>
                        <td>
                          <span className={`badge ${g.myRole === 'Super Admin' ? 'badge-purple' : g.myRole === 'Admin' ? 'badge-primary' : 'badge-secondary'}`}>
                            {g.myRole === 'Super Admin' ? '👑 Super Admin' : g.myRole === 'Admin' ? '🛡️ Admin' : '👤 Member'}
                          </span>
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <button 
                            type="button" 
                            className="btn-action-icon" 
                            style={{ fontSize: 12, padding: '5px 10px', background: '#eef2f6', color: '#1e293b' }}
                            onClick={() => setActiveModalGroup(g)}
                          >
                            👥 View Members
                          </button>
                        </td>
                      </tr>
                    )
                  })
                ) : (
                  <tr>
                    <td colSpan={6} style={{ textAlign: 'center', padding: 40, color: '#94a3b8' }}>
                      {groups.length === 0 ? 'कोई ग्रुप नहीं मिला। कृपया सुनिश्चित करें कि WhatsApp कनेक्टेड है।' : 'सर्च से मेल खाता कोई ग्रुप नहीं मिला।'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Manual Message Composer Card */}
        <div className="groups-composer-card">
          <div className="composer-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 18 }}>✉️</span>
              <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#172433' }}>
                संदेश भेजें (Send Message)
              </h3>
            </div>
            <span className="badge badge-primary">
              {selectedGroupIds.size} ग्रुप चुने गए
            </span>
          </div>

          <div className="composer-body">
            {selectedGroupIds.size === 0 ? (
              <div className="empty-selection-note">
                👈 कृपया बाईं ओर टेबल से कम से कम 1 ग्रुप चुनें जिन्हें आप संदेश भेजना चाहते हैं।
              </div>
            ) : (
              <div className="selected-groups-chips">
                {Array.from(selectedGroupIds).map(gid => {
                  const grp = groups.find(g => g.id === gid)
                  return (
                    <span key={gid} className="group-chip">
                      {grp?.subject || gid.substring(0, 12) + '...'}
                      <button type="button" onClick={() => toggleSelectGroup(gid)}>×</button>
                    </span>
                  )
                })}
              </div>
            )}

            {/* Quick Emojis */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, marginBottom: 4 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: '#475569' }}>संदेश (Message Text):</span>
              <button 
                type="button" 
                className="btn-toggle-emojis" 
                onClick={() => setShowEmojiPicker(!showEmojiPicker)}
              >
                😊 Emojis {showEmojiPicker ? '▲' : '▼'}
              </button>
            </div>

            {showEmojiPicker && (
              <div className="quick-emoji-grid">
                {QUICK_EMOJIS.map(em => (
                  <button 
                    key={em} 
                    type="button" 
                    className="emoji-btn" 
                    onClick={() => setMsgText(prev => prev + em)}
                  >
                    {em}
                  </button>
                ))}
              </div>
            )}

            <textarea 
              className="field-textarea"
              rows={4}
              placeholder="ग्रुप्स के लिए संदेश टाइप करें... (*bold*, _italic_)"
              value={msgText}
              onChange={e => setMsgText(e.target.value)}
              style={{ fontSize: 13 }}
            />

            {/* Attachment */}
            <div style={{ marginTop: 12 }}>
              <input 
                type="file" 
                ref={fileInputRef} 
                style={{ display: 'none' }} 
                onChange={handleAttachment} 
              />
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <button 
                  type="button" 
                  className="btn-action-icon" 
                  onClick={() => fileInputRef.current?.click()}
                  style={{ fontSize: 12 }}
                >
                  📎 फ़ाइल जोड़ें (Image / Doc / Video)
                </button>
                {attachment && (
                  <div className="attachment-badge">
                    <span>📄 {attachment.name}</span>
                    <button type="button" onClick={() => { setAttachment(null); if (fileInputRef.current) fileInputRef.current.value = '' }}>×</button>
                  </div>
                )}
              </div>
            </div>

            {/* Anti-spam delay disclaimer */}
            <div style={{ marginTop: 12, padding: 8, background: '#f1f5f9', borderRadius: 6, fontSize: 11, color: '#64748b', lineHeight: 1.4 }}>
              ⚡ <b>Anti-Spam Delay:</b> एकाधिक ग्रुप्स पर संदेश 1.2 सेकंड के सुरक्षित अंतराल पर भेजे जाएंगे ताकि WhatsApp नंबर ब्लॉक होने का जोखिम न रहे।
            </div>

            {/* Progress Bar if Sending */}
            {sendingProgress.active && (
              <div style={{ marginTop: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                  <span>संदेश भेजा जा रहा है...</span>
                  <span>{sendingProgress.current} / {sendingProgress.total}</span>
                </div>
                <div className="progress-bar-track">
                  <div 
                    className="progress-bar-fill" 
                    style={{ width: `${(sendingProgress.current / Math.max(1, sendingProgress.total)) * 100}%` }}
                  />
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
              {selectedGroupIds.size > 0 && (
                <button 
                  type="button" 
                  className="btn-action-icon"
                  onClick={clearSelection}
                  disabled={sendingProgress.active}
                >
                  Clear Selection
                </button>
              )}
              <button 
                type="button" 
                className="primary" 
                style={{ flex: 1, padding: '10px 16px', fontWeight: 700 }}
                onClick={handleSendGroupMessage}
                disabled={sendingProgress.active || selectedGroupIds.size === 0 || (!msgText.trim() && !attachment)}
              >
                {sendingProgress.active ? '⏳ भेजा जा रहा है...' : `➤ Send to ${selectedGroupIds.size} Selected Groups`}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Member Details Modal */}
      {activeModalGroup && (
        <GroupMembersModal 
          group={activeModalGroup} 
          onClose={() => setActiveModalGroup(null)} 
          notify={notify} 
        />
      )}
    </section>
  )
}

class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }
  componentDidCatch(error, errorInfo) {
    console.error('App Error Caught:', error, errorInfo)
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{minHeight:'100vh',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:24,background:'#f8fafc',fontFamily:'system-ui, sans-serif'}}>
          <div style={{background:'#fff',padding:32,borderRadius:12,boxShadow:'0 4px 12px rgba(0,0,0,0.08)',maxWidth:480,textAlign:'center',width:'100%'}}>
            <h2 style={{color:'#dc2626',marginBottom:12}}>कुछ गलत हो गया (Something went wrong)</h2>
            <p style={{color:'#64748b',fontSize:14,marginBottom:20}}>
              {this.state.error?.message || 'एप्लिकेशन लोड करने में समस्या आई।'}
            </p>
            <button 
              onClick={() => { this.setState({ hasError: false }); window.location.reload() }}
              style={{background:'#128c7e',color:'#fff',border:'none',padding:'10px 20px',borderRadius:8,fontWeight:700,cursor:'pointer'}}
            >
              रीलोड करें (Reload)
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}

export default function RootApp() {
  return (
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  )
}


