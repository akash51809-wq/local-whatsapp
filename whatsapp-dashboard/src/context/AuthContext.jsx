import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { api, clearToken, getSavedUser, setSavedUser, setToken } from '../services/api'

const AuthContext = createContext(null)

const INACTIVITY_TIMEOUT_MS = 30 * 60 * 1000 // 30 minutes of web inactivity

export function AuthProvider({ children }) {
  const [login, setLogin] = useState(() => {
    const savedToken = localStorage.getItem('wa_login') || ''
    if (savedToken) {
      const lastAct = Number(localStorage.getItem('wa_last_activity') || 0)
      if (lastAct && (Date.now() - lastAct >= INACTIVITY_TIMEOUT_MS)) {
        clearToken()
        sessionStorage.setItem('wa_logout_reason', 'inactivity')
        return ''
      }
    }
    return savedToken
  })

  const [currentUser, setCurrentUser] = useState(() => {
    const savedToken = localStorage.getItem('wa_login') || ''
    if (!savedToken) return {}
    const lastAct = Number(localStorage.getItem('wa_last_activity') || 0)
    if (lastAct && (Date.now() - lastAct >= INACTIVITY_TIMEOUT_MS)) {
      return {}
    }
    return getSavedUser()
  })
  const [theme, setTheme] = useState(() => localStorage.getItem('wa_theme') || 'dark')
  const [status, setStatus] = useState({ status: 'waiting', number: null, profileName: 'WhatsApp Account' })
  const [qr, setQr] = useState(null)
  const [error, setError] = useState('')
  const [toast, setToast] = useState('')
  const [connecting, setConnecting] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    try {
      return localStorage.getItem('sidebar_collapsed') === '1'
    } catch {
      return false
    }
  })

  const toggleSidebarCollapsed = useCallback(() => {
    setSidebarCollapsed(prev => {
      const next = !prev
      try {
        localStorage.setItem('sidebar_collapsed', next ? '1' : '0')
      } catch {}
      return next
    })
  }, [])

  // Chat & Reports global caches
  const [chats, setChats] = useState([])
  const [selected, setSelected] = useState(null)
  const [messages, setMessages] = useState([])
  const [chatFilter, setChatFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [reports, setReports] = useState([])
  const [reportStats, setReportStats] = useState({})

  const isAdmin = currentUser?.role === 'admin'

  // Company Branding Settings (Favicon, Company Name, Logo)
  const [companySettings, setCompanySettings] = useState({
    companyName: '',
    faviconUrl: '',
    logoUrl: ''
  })

  const applyBranding = useCallback((settings) => {
    if (!settings) return
    if (settings.faviconUrl) {
      let link = document.querySelector("link[rel*='icon']")
      if (!link) {
        link = document.createElement('link')
        link.rel = 'icon'
        document.head.appendChild(link)
      }
      link.href = settings.faviconUrl
    }
    if (settings.companyName) {
      document.title = `${settings.companyName} - WhatsApp Automation`
    }
  }, [])

  const loadCompanySettings = useCallback(async () => {
    try {
      const res = await api('/api/settings/company')
      if (res && res.success && res.settings) {
        setCompanySettings(res.settings)
        applyBranding(res.settings)
      }
    } catch (e) {
      // ignore
    }
  }, [applyBranding])

  const updateCompanySettings = useCallback((newSettings) => {
    setCompanySettings(newSettings)
    applyBranding(newSettings)
  }, [applyBranding])

  useEffect(() => {
    loadCompanySettings()
  }, [loadCompanySettings])

  // User Current Subscription Plan State
  const [planInfo, setPlanInfo] = useState(null)

  const loadPlanInfo = useCallback(async () => {
    if (!login || isAdmin) return
    try {
      const res = await api('/api/user/plan-status')
      if (res && res.success && res.plan) {
        setPlanInfo(res.plan)
        setCurrentUser(prev => {
          const updated = { 
            ...prev, 
            plan: res.plan.planName, 
            planExpiresAt: res.plan.expiresAt 
          }
          setSavedUser(updated)
          return updated
        })
      }
    } catch {}
  }, [login, isAdmin])

  useEffect(() => {
    if (login && !isAdmin) {
      loadPlanInfo()
    }
  }, [login, isAdmin, loadPlanInfo])

  // Dark mode effect
  useEffect(() => {
    localStorage.setItem('wa_theme', theme)
    if (theme === 'dark') {
      document.body.classList.add('dark-mode')
    } else {
      document.body.classList.remove('dark-mode')
    }
  }, [theme])

  const toggleTheme = () => {
    setTheme(prev => (prev === 'dark' ? 'light' : 'dark'))
  }

  const notify = useCallback((msg) => {
    setToast(msg)
    setTimeout(() => setToast(''), 3000)
  }, [])

  // Status and QR loaders
  const loadStatus = useCallback(async () => {
    if (!login) return
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
  }, [isAdmin, login])

  const loadQr = useCallback(async () => {
    if (!login) return
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
  }, [isAdmin, loadStatus, login])

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
    if (!login) return
    try {
      const qs = new URLSearchParams()
      if (chatFilter !== 'all') qs.set('filter', chatFilter)
      if (search) qs.set('search', search)
      const d = await api(`/api/incoming/chats?${qs}`)
      setChats(d.chats || [])
    } catch (e) {
      setError(e.message)
    }
  }, [chatFilter, search, login])

  const loadMessages = useCallback(async (chatJid) => {
    if (!chatJid || !login) return
    try {
      const d = await api(`/api/incoming/messages?chatJid=${encodeURIComponent(chatJid)}`)
      setMessages(d.messages || [])
      await api('/api/incoming/mark-read', { method: 'POST', body: JSON.stringify({ chatJid }) }).catch(() => {})
    } catch (e) {
      setError(e.message)
    }
  }, [login])

  const loadReports = useCallback(async () => {
    if (!login) return
    try {
      const d = await api('/api/reports/messages')
      setReports(d.reports || [])
      setReportStats(d.stats || {})
    } catch (e) {
      setError(e.message)
    }
  }, [login])

  // Polling status & qr
  useEffect(() => {
    if (!login) return
    loadStatus()
    loadQr()
    const t = setInterval(() => { loadStatus(); loadQr() }, 3500)
    return () => clearInterval(t)
  }, [login, loadStatus, loadQr])

  // Real-time EventSource listener
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
      loadChats()
      if (selected) loadMessages(selected.chatJid)
      loadReports()
    }
    es.onerror = () => {}
    return () => es.close()
  }, [login, selected, loadChats, loadMessages, loadStatus, loadQr, loadReports])

  // Inactivity Watcher (30 minutes non-use condition)
  // Only logs out the web browser panel. WhatsApp Baileys session & API message workers remain active 24/7 on the server.
  useEffect(() => {
    if (!login) return

    if (!localStorage.getItem('wa_last_activity')) {
      localStorage.setItem('wa_last_activity', Date.now().toString())
    }

    let lastThrottle = 0
    const recordActivity = () => {
      const now = Date.now()
      if (now - lastThrottle > 5000) {
        lastThrottle = now
        localStorage.setItem('wa_last_activity', now.toString())
      }
    }

    const events = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart', 'click']
    events.forEach(evt => window.addEventListener(evt, recordActivity, { passive: true }))

    const checkInactivity = () => {
      const storedLast = Number(localStorage.getItem('wa_last_activity') || 0)
      if (storedLast && (Date.now() - storedLast >= INACTIVITY_TIMEOUT_MS)) {
        // Auto logout web panel
        sessionStorage.setItem('wa_logout_reason', 'inactivity')
        clearToken()
        localStorage.removeItem('wa_last_activity')
        setLogin('')
        setCurrentUser({})
        notify('30 मिनट की निष्क्रियता (non-use) के कारण आप वेब से लॉगआउट हो गए हैं।')
      }
    }

    const intervalId = setInterval(checkInactivity, 10000)

    return () => {
      events.forEach(evt => window.removeEventListener(evt, recordActivity))
      clearInterval(intervalId)
    }
  }, [login, notify])

  // Computed stats
  const stats = useMemo(() => ({
    chats: chats.length,
    unread: chats.reduce((n, c) => n + (c.unreadCount || 0), 0),
    groups: chats.filter(c => c.isGroup).length,
  }), [chats])

  // Login handler
  const handleLogin = (token, user) => {
    setToken(token)
    setSavedUser(user)
    localStorage.setItem('wa_last_activity', Date.now().toString())
    sessionStorage.removeItem('wa_logout_reason')
    setLogin(token)
    setCurrentUser(user)
    notify('लॉगिन सफल!')
  }

  // Logout handler
  const logout = () => {
    clearToken()
    localStorage.removeItem('wa_last_activity')
    sessionStorage.removeItem('wa_logout_reason')
    setLogin('')
    setCurrentUser({})
    notify('लॉगआउट सफल')
  }

  const toggleSidebar = () => setSidebarOpen(prev => !prev)

  const value = {
    login,
    token: login,
    currentUser,
    user: currentUser,
    setCurrentUser,
    isAdmin,
    handleLogin,
    logout,
    theme,
    setTheme,
    toggleTheme,
    status,
    setStatus,
    qr,
    setQr,
    error,
    setError,
    toast,
    notify,
    connecting,
    sidebarOpen,
    setSidebarOpen,
    toggleSidebar,
    sidebarCollapsed,
    setSidebarCollapsed,
    toggleSidebarCollapsed,
    chats,
    setChats,
    loadChats,
    selected,
    setSelected,
    messages,
    setMessages,
    loadMessages,
    chatFilter,
    setChatFilter,
    search,
    setSearch,
    reports,
    setReports,
    reportStats,
    loadReports,
    stats,
    loadStatus,
    loadQr,
    connectUserWhatsApp,
    disconnectUserWhatsApp,
    companySettings,
    loadCompanySettings,
    updateCompanySettings,
    planInfo,
    loadPlanInfo
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

export default AuthContext
