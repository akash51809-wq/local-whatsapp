import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
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

const nav = [
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
    const t = setInterval(() => { loadStatus(); loadQr() }, 5000)
    return () => clearInterval(t) 
  }, [loadStatus, loadQr])

  useEffect(() => { if (page === 'incoming' || page === 'dashboard') loadChats() }, [page, loadChats])
  useEffect(() => { if (selected) loadMessages(selected.chatJid) }, [selected, loadMessages])
  useEffect(() => { if (page === 'reports') loadReports() }, [page, loadReports])

  useEffect(() => {
    const es = new EventSource('/api/incoming/events')
    es.onmessage = () => { 
      if (page === 'incoming' || page === 'dashboard') loadChats()
      if (selected) loadMessages(selected.chatJid) 
    }
    es.onerror = () => {}
    return () => es.close()
  }, [page, selected, loadChats, loadMessages])

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

  if (!login) return <Login onLogin={(token, user) => { setLogin(token); setCurrentUser(user) }} />

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
      <nav>{nav.map(([id, icon, label]) => <button key={id} className={page === id ? 'active' : ''} onClick={() => setPage(id)}><span>{icon}</span>{label}</button>)}</nav>
      <div className="sidebar-bottom">
        <button onClick={() => { loadStatus(); loadQr(); notify('Status refreshed') }}>↻ Refresh status</button>
        <button onClick={logout}>⇥ Logout</button>
      </div>
    </aside>

    <main className="main">
      <header className="topbar">
        <div>
          <h1>{nav.find(n => n[0] === page)?.[2]}</h1>
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
      {page === 'send' && <SendPage 
        chats={chats} 
        selected={selected} 
        setSelected={setSelected} 
        text={text} 
        setText={setText} 
        recipient={recipient}
        setRecipient={setRecipient}
        attachment={attachment} 
        setAttachment={setAttachment} 
        fileRef={fileRef} 
        onFile={onFile} 
        onSend={selected ? sendReply : sendDirectMessage} 
        sending={sending} 
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
      {page === 'api' && <ApiPage />}
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
  return <div className={`message-row ${m.fromMe ? 'mine' : ''}`}>
    <div className="bubble">
      {m.quotedText && <div className="quote">↪ {m.quotedText}</div>}
      {m.mediaUrl && m.mediaType === 'image' ? <img src={m.mediaUrl} alt="media" /> : null}
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

function SendPage({ chats, selected, setSelected, recipient, setRecipient, ...composer }) { 
  return <section className="send-page">
    <div className="send-card">
      <span className="eyebrow">OUTGOING MESSAGE</span>
      <h2>Send WhatsApp message</h2>
      <p>अपने कनेक्टेड WhatsApp नंबर से सीधे किसी भी नंबर पर संदेश भेजें।</p>
      
      <div style={{marginBottom:16}}>
        <label>Direct Mobile Number (या नीचे से चैट चुनें)
          <input 
            placeholder="10 अंकों का मोबाइल नंबर (e.g. 9876543210)" 
            value={recipient} 
            onChange={e => { setRecipient(e.target.value); setSelected(null) }} 
          />
        </label>
      </div>

      <label>Existing Chat (वैकल्पिक)
        <select value={selected?.chatJid || ''} onChange={e => {
          const found = chats.find(c => c.chatJid === e.target.value) || null
          setSelected(found)
          if (found) setRecipient('')
        }}>
          <option value="">Select an active chat</option>
          {chats.map(c => <option key={c.chatJid} value={c.chatJid}>{c.name} — {c.from}</option>)}
        </select>
      </label>

      <div className="send-composer" style={{marginTop:16}}>
        <Composer {...composer} />
      </div>
    </div>
  </section> 
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

function ApiPage() { 
  const [data, setData] = useState(null)
  const [err, setErr] = useState('')
  useEffect(() => { api('/api/settings/api').then(setData).catch(e => setErr(e.message)) }, [])
  return <section className="page-content">
    <div className="section-head">
      <div>
        <span className="eyebrow">DEVELOPER ACCESS</span>
        <h2>API & Webhook</h2>
        <p>WhatsApp API इंटीग्रेशन सेटिंग्स</p>
      </div>
    </div>
    <div className="api-card">
      <h3>API Status</h3>
      {err ? <div className="form-error">{err}</div> : (
        <>
          <div className="api-row"><span>Connection</span><b>Backend API Active</b></div>
          <div className="api-row"><span>Token</span><code>{data?.token || 'Loading...'}</code></div>
          <div className="api-row"><span>Webhook</span><b>{data?.webhookEnabled ? 'Enabled' : 'Not configured'}</b></div>
        </>
      )}
    </div>
  </section> 
}

function SystemPage({ status, currentUser, notify }) { 
  const [info, setInfo] = useState(null)
  const [curPass, setCurPass] = useState('')
  const [newPass, setNewPass] = useState('')
  const [passErr, setPassErr] = useState('')
  const [passOk, setPassOk] = useState('')
  const [savingPass, setSavingPass] = useState(false)

  useEffect(() => { api('/api/admin/system-info').then(d => setInfo(d.info)).catch(() => {}) }, [])

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

  return <section className="page-content">
    <div className="section-head">
      <div>
        <span className="eyebrow">SETTINGS & SECURITY</span>
        <h2>System & Account Settings</h2>
        <p>अकाउंट सुरक्षा और सिस्टम जानकारी</p>
      </div>
    </div>

    {/* Change Password Card for User */}
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
      {[
        ['Account User ID', currentUser?.userId || 'USR'],
        ['Login Username', currentUser?.username || currentUser?.mobile || 'Admin'],
        ['WhatsApp Status', status.status],
        ['Connected Number', status.number ? '+' + status.number : 'Not connected'],
        ['Node.js Version', info?.nodeVersion || 'Loading'],
        ['Uptime', info?.uptime || 'Loading']
      ].map(([a,b]) => (
        <div className="info-card" key={a}>
          <small>{a}</small>
          <strong>{b}</strong>
        </div>
      ))}
    </div>
  </section> 
}

export default App
