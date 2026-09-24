import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { api, clearToken, getSavedUser, setSavedUser, setToken } from '../services/api'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [login, setLogin] = useState(() => localStorage.getItem('wa_login') || '')
  const [currentUser, setCurrentUser] = useState(getSavedUser)
  const [theme, setTheme] = useState(() => localStorage.getItem('wa_theme') || 'dark')
  const [status, setStatus] = useState({ status: 'waiting', number: null, profileName: 'WhatsApp Account' })
  const [qr, setQr] = useState(null)
  const [error, setError] = useState('')
  const [toast, setToast] = useState('')
  const [connecting, setConnecting] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)

  // Chat & Reports global caches
  const [chats, setChats] = useState([])
  const [selected, setSelected] = useState(null)
  const [messages, setMessages] = useState([])
  const [chatFilter, setChatFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [reports, setReports] = useState([])
  const [reportStats, setReportStats] = useState({})

  const isAdmin = currentUser?.role === 'admin'

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
    }
    es.onerror = () => {}
    return () => es.close()
  }, [login, selected, loadChats, loadMessages, loadStatus, loadQr])

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
    setLogin(token)
    setCurrentUser(user)
    notify('लॉगिन सफल!')
  }

  // Logout handler
  const logout = () => {
    clearToken()
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
    disconnectUserWhatsApp
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
