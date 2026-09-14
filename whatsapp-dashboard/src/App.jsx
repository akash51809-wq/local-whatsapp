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


function App() {
  const [page, setPage] = useState('dashboard')
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
  const fileRef = useRef(null)

  const isAdmin = currentUser?.role === 'admin'

  const notify = useCallback((msg) => {
    setToast(msg)
    setTimeout(() => setToast(''), 3000)
  }, [])

  const loadStatus = useCallback(async () => {
    try {
      if (isAdmin) {
        setStatus(await api('/api/status'))
      } else {
        const d = await api('/api/user/whatsapp/status')
        setStatus({
          status: d.status || 'waiting',
          number: d.number,
          profileName: d.profileName || 'My WhatsApp',
          ready: d.ready
        })
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
        setQr(d.status === 'qr' ? d.qr : null)
        if (d.status === 'connected') loadStatus()
      } else {
        const d = await api('/api/user/whatsapp/qr')
        setQr(d.status === 'waiting' || d.status === 'qr' ? d.qr : null)
        if (d.status === 'connected') loadStatus()
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
    ...(isAdmin ? [['users', '👥', 'User Management']] : []),
    ['send', '➤', 'Send Message'],
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

  return <div className="app-shell">
    <aside className="sidebar">
      <div className="brand">
        <div className="brand-mark">W</div>
        <div><strong>WA Control</strong><small>{isAdmin ? 'Admin Portal' : 'User Portal'}</small></div>
      </div>
      <div className="account-mini">
        <span className={`dot ${status.status === 'connected' ? 'online' : ''}`}></span>
        <div>
          <b>{status.profileName || (currentUser?.username ? `User: ${currentUser.username}` : 'WhatsApp Account')}</b>
          <small>{status.number ? `+${status.number}` : (status.status === 'connected' ? 'Connected' : 'Not connected')}</small>
        </div>
      </div>
      <nav>{navList.map(([id, icon, label]) => <button key={id} className={page === id ? 'active' : ''} onClick={() => setPage(id)}><span>{icon}</span>{label}</button>)}</nav>
      <div className="sidebar-bottom">
        <button onClick={() => { loadStatus(); loadQr(); notify('Status refreshed') }}>↻ Refresh status</button>
        <button onClick={logout}>⇥ Logout</button>
      </div>
    </aside>

    <main className="main">
      <header className="topbar">
        <div>
          <h1>{navList.find(n => n[0] === page)?.[2]}</h1>
          <p>{isAdmin ? 'System Admin Control Center' : `Logged in as: ${currentUser?.username || currentUser?.mobile || 'User'}`}</p>
        </div>
        <div className={`connection ${status.status === 'connected' ? 'connected' : ''}`}>
          <span className="dot"></span>
          {status.status === 'connected' ? `Connected (+${status.number || ''})` : status.status === 'connecting' ? 'Connecting...' : 'Waiting for Scan'}
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
      {page === 'send' && <SendPage 
        notify={notify}
        status={status}
        isAdmin={isAdmin}
        currentUser={currentUser}
        chats={chats}
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
    </main>
  </div>
}

function Login({ onLogin }) {
  const [u, setU] = useState('')
  const [p, setP] = useState('')
  const [err, setErr] = useState('')
  const [loading, setLoading] = useState(false)

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

  return <div className="login-page">
    <form className="login-card" onSubmit={submit}>
      <div className="login-logo">W</div>
      <h1>WA Control Center</h1>
      <p>Login ID (Mobile Number) और Password दर्ज करें</p>
      <label>Login ID / Mobile Number
        <input placeholder="10 अंकों का मोबाइल नंबर या admin" value={u} onChange={e => setU(e.target.value)} />
      </label>
      <label>Password
        <input type="password" placeholder="Password (WhatsApp पर प्राप्त)" value={p} onChange={e => setP(e.target.value)} />
      </label>
      {err && <div className="form-error">{err}</div>}
      <button className="primary full" disabled={loading}>{loading ? 'Signing in...' : 'Sign in'}</button>
      <div style={{marginTop:16,textAlign:'center',fontSize:13}}>
        नया अकाउंट बनाना है? <a href="/signup.html" style={{color:'#128c7e',fontWeight:700,textDecoration:'none'}}>यहाँ Sign Up करें</a>
      </div>
    </form>
  </div>
}

function Dashboard({ status, qr, stats, chats, isAdmin, connecting, onConnect, onDisconnect, onChat, onRefresh }) {
  return <section className="page-content">
    <div className="hero-card">
      <div>
        <span className="eyebrow">{isAdmin ? 'ADMIN WHATSAPP SESSION' : 'YOUR PERSONAL WHATSAPP SESSION'}</span>
        <h2>{status.status === 'connected' ? 'WhatsApp Connected ✓' : 'अपना WhatsApp जोड़ें'}</h2>
        <p>
          {status.status === 'connected' 
            ? `आपका WhatsApp (+${status.number || ''}) कनेक्टेड है। अब आप इस नंबर से सीधे मैसेज भेज सकते हैं।` 
            : 'QR कोड स्कैन करने के लिए नीचे बटन दबाएं और अपने फ़ोन के WhatsApp से स्कैन करें।'}
        </p>
        <div style={{display:'flex',gap:10,marginTop:12}}>
          {status.status === 'connected' ? (
            <>
              <button className="primary" onClick={onRefresh}>↻ Refresh Status</button>
              {onDisconnect && <button className="secondary" onClick={onDisconnect} style={{background:'#ffebee',color:'#c62828',border:'none'}}>⏏ Disconnect</button>}
            </>
          ) : (
            <button className="primary" onClick={onConnect} disabled={connecting}>
              {connecting ? 'शुरू हो रहा है...' : '📱 Connect / Get QR Code'}
            </button>
          )}
        </div>
      </div>
      {qr ? (
        <div style={{textAlign:'center'}}>
          <img className="qr" src={qr} alt="WhatsApp QR" style={{background:'#fff',padding:8,borderRadius:10}} />
          <small style={{display:'block',color:'#666',marginTop:4}}>WhatsApp Linked Devices से scan करें</small>
        </div>
      ) : (
        <div className={`status-art ${status.status === 'connected' ? 'ok' : ''}`}>
          {status.status === 'connected' ? '✓' : '📱'}
        </div>
      )}
    </div>

    <div className="stat-grid">
      <Stat icon="◉" value={stats.chats} label="Active chats" />
      <Stat icon="!" value={stats.unread} label="Unread" />
      <Stat icon="▣" value={stats.groups} label="Groups" />
      <Stat icon="✓" value={status.status === 'connected' ? 'Online' : 'Offline'} label="Status" />
    </div>

    <div className="section-head">
      <div>
        <h2>Recent Conversations</h2>
        <p>हाल के मैसेजेस और चैट्स</p>
      </div>
    </div>
    <div className="chat-grid">
      {chats.slice(0, 8).map(c => (
        <button className="chat-card" key={c.chatJid} onClick={() => onChat(c)}>
          <div className="avatar">{(c.name || '?')[0].toUpperCase()}</div>
          <div><b>{c.name}</b><p>{c.lastMessage || 'Media message'}</p></div>
          {c.unreadCount ? <span className="badge">{c.unreadCount}</span> : null}
        </button>
      ))}
      {!chats.length && <Empty text="अभी कोई बातचीत उपलब्ध नहीं है" />}
    </div>
  </section>
}

function Stat({ icon, value, label }) { return <div className="stat"><span>{icon}</span><div><strong>{value}</strong><small>{label}</small></div></div> }
function Empty({ text }) { return <div className="empty">{text}</div> }

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
      if (notify) notify(`मैसेज भेजने में समस्या हुई। कृपया WhatsApp कनेक्शन जांचें।`);
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
              <td style={{padding:8,border:'1px solid #e2e8f0'}}>मैसेज प्राप्त करने वाले का 10-digit मोबाइल नंबर (e.g. 9876543210)</td>
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
      <p style={{color:'#666',fontSize:13,margin:'4px 0 16px'}}>नीचे नंबर और मैसेज लिखकर सीधे API चलाकर टेस्ट करें:</p>
      
      <form onSubmit={runTestApi} style={{display:'grid',gridTemplateColumns:'repeat(auto-fit, minmax(240px, 1fr))',gap:12,alignItems:'end'}}>
        <div>
          <label style={{display:'block',fontSize:13,fontWeight:700,marginBottom:4}}>To Mobile Number</label>
          <input 
            placeholder="10 अंकों का मोबाइल नंबर (e.g. 9876543210)" 
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

  return <section className="page-user-management">
    {/* Filter & Search Bar */}
    <div className="users-filter-card">
      <div className="users-search-box">
        <span>🔍</span>
        <input 
          type="text" 
          placeholder="Search by name, mobile, username, user ID..." 
          value={search} 
          onChange={e => setSearch(e.target.value)} 
        />
      </div>

      <select className="filter-select" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
        <option value="all">All Status (सभी)</option>
        <option value="active">Active Only</option>
        <option value="inactive">Inactive Only</option>
      </select>

      <select className="filter-select" value={waFilter} onChange={e => setWaFilter(e.target.value)}>
        <option value="all">All WhatsApp Status</option>
        <option value="connected">Connected 🟢</option>
        <option value="waiting">Waiting Scan 🟡</option>
        <option value="disconnected">Not Connected ⚪</option>
      </select>

      <button className="btn-action-icon" onClick={fetchUsers} title="Refresh User List">
        ↻ Refresh
      </button>

      <div style={{ marginLeft: 'auto', fontSize: 13, color: '#64748b', fontWeight: 600 }}>
        Total: <span style={{ color: '#0d835f', fontWeight: 700 }}>{filteredUsers.length}</span> / {users.length} Users
      </div>
    </div>

    {/* Notice when password sent */}
    {sentNotice && (
      <div className="alert" style={{ background: '#e9f8f2', borderColor: '#7ae0bd', color: '#055b44', marginBottom: 16 }}>
        <span>
          ✓ <strong>Password Sent to WhatsApp!</strong> User <strong>{sentNotice.mobile}</strong> ({sentNotice.userId}) को नया पासवर्ड भेज दिया गया है। 
          Temporary Password: <code style={{background:'#fff',padding:'2px 8px',borderRadius:4,border:'1px solid #7ae0bd',fontWeight:'bold',color:'#0d835f'}}>{sentNotice.newPassword}</code>
        </span>
        <button onClick={() => setSentNotice(null)}>×</button>
      </div>
    )}

    {/* Users Table */}
    <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
      <div style={{ overflowX: 'auto' }}>
        <table className="report-table" style={{ margin: 0, width: '100%' }}>
          <thead>
            <tr>
              <th>User Details</th>
              <th>Mobile / Login</th>
              <th>Connection Status</th>
              <th>Plan</th>
              <th>Account Status</th>
              <th style={{ textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} style={{ textAlign: 'center', padding: 36, color: '#64748b' }}>
                  ⏳ Loading registered users...
                </td>
              </tr>
            ) : filteredUsers.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ textAlign: 'center', padding: 36, color: '#64748b' }}>
                  कोई यूजर नहीं मिला (No users found matching your search).
                </td>
              </tr>
            ) : (
              filteredUsers.map(u => (
                <tr key={u.userId || u._id}>
                  <td>
                    <div style={{ fontWeight: 600, color: '#1a202c', fontSize: 14 }}>
                      {u.name || u.username || 'No Name'}
                    </div>
                    <div style={{ fontSize: 11, color: '#8fa0b2', marginTop: 3 }}>
                      ID: <span style={{ fontFamily: 'monospace' }}>{u.userId}</span>
                      <span className={`user-role-badge ${u.role || 'user'}`}>{u.role || 'user'}</span>
                    </div>
                  </td>
                  <td>
                    <strong style={{ fontSize: 13, color: '#1f2937' }}>+91 {u.mobile || u.username}</strong>
                    <div style={{ fontSize: 11, color: '#8fa0b2', marginTop: 3 }}>
                      Joined: {u.createdAt ? new Date(u.createdAt).toLocaleDateString('hi-IN') : 'N/A'}
                    </div>
                  </td>
                  <td>
                    {u.whatsappStatus === 'connected' ? (
                      <div>
                        <span className="status-pill connected">Connected</span>
                        <div style={{ fontSize: 11, color: '#0d835f', marginTop: 3 }}>
                          +{u.whatsappPhone || u.mobile}
                        </div>
                      </div>
                    ) : u.whatsappStatus === 'connecting' || u.whatsappStatus === 'waiting' ? (
                      <div>
                        <span className="status-pill waiting">Waiting Scan</span>
                        <div style={{ fontSize: 10, color: '#b45309', marginTop: 2 }}>QR Generated</div>
                      </div>
                    ) : (
                      <span className="status-pill disconnected">Not Connected</span>
                    )}
                  </td>
                  <td>
                    <span className="plan-badge">{u.plan || 'Standard'}</span>
                  </td>
                  <td>
                    <span className={`status-pill ${u.status === 'active' ? 'connected' : 'disconnected'}`}>
                      {u.status === 'active' ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td>
                    <div className="user-actions-group" style={{ justifyContent: 'flex-end' }}>
                      <button 
                        className="btn-action-icon" 
                        onClick={() => openEdit(u)} 
                        title="Edit profile"
                      >
                        ✏ Edit
                      </button>

                      <button 
                        className={`btn-action-icon toggle-btn ${u.status === 'active' ? 'active' : 'inactive'}`} 
                        onClick={() => toggleStatus(u)} 
                        disabled={actionLoading === u.userId}
                        title={u.status === 'active' ? 'Deactivate user account' : 'Activate user account'}
                      >
                        {actionLoading === u.userId ? '...' : u.status === 'active' ? 'Deactivate' : 'Activate'}
                      </button>

                      <button 
                        className="btn-action-icon pwd-btn" 
                        onClick={() => sendPassword(u)} 
                        disabled={actionLoading === 'pwd-' + u.userId}
                        title="Send new random password to user WhatsApp"
                      >
                        {actionLoading === 'pwd-' + u.userId ? 'Sending...' : '🔑 Send Password'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>

    {/* Edit Modal */}
    {editingUser && (
      <div className="modal-overlay" onClick={() => setEditingUser(null)}>
        <div className="modal-content-card" onClick={e => e.stopPropagation()}>
          <div className="modal-header">
            <h3>Edit User: {editingUser.name || editingUser.userId}</h3>
            <button onClick={() => setEditingUser(null)}>×</button>
          </div>
          <form onSubmit={saveEdit}>
            <div className="modal-body">
              <label>
                Full Name (नाम)
                <input 
                  type="text" 
                  value={editForm.name} 
                  onChange={e => setEditForm(prev => ({ ...prev, name: e.target.value }))} 
                  placeholder="User Name"
                />
              </label>
              <label>
                WhatsApp Mobile Number
                <input 
                  type="text" 
                  value={editForm.mobile} 
                  onChange={e => setEditForm(prev => ({ ...prev, mobile: e.target.value }))} 
                  placeholder="10 digit mobile"
                />
              </label>
              <label>
                Subscription Plan (प्लान)
                <select 
                  value={editForm.plan} 
                  onChange={e => setEditForm(prev => ({ ...prev, plan: e.target.value }))}
                >
                  <option value="Free">Free (मुफ़्त)</option>
                  <option value="Starter">Starter</option>
                  <option value="Standard">Standard</option>
                  <option value="Pro">Pro</option>
                  <option value="Enterprise">Enterprise</option>
                </select>
              </label>
              <label>
                Role
                <select 
                  value={editForm.role} 
                  onChange={e => setEditForm(prev => ({ ...prev, role: e.target.value }))}
                >
                  <option value="user">User</option>
                  <option value="admin">Admin</option>
                </select>
              </label>
              <label>
                Account Status
                <select 
                  value={editForm.status} 
                  onChange={e => setEditForm(prev => ({ ...prev, status: e.target.value }))}
                >
                  <option value="active">Active (सक्रिय)</option>
                  <option value="inactive">Inactive (निष्क्रिय)</option>
                </select>
              </label>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn-action-icon" onClick={() => setEditingUser(null)}>
                Cancel
              </button>
              <button type="submit" className="primary" disabled={savingEdit}>
                {savingEdit ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </form>
        </div>
      </div>
    )}
  </section>
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


