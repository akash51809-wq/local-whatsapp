import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import './App.css'

const api = async (url, options = {}) => {
  const res = await fetch(url, { headers: { 'Content-Type': 'application/json', ...(options.headers || {}) }, ...options })
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
  ['system', '⚙', 'System'],
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
  const [sending, setSending] = useState(false)
  const [attachment, setAttachment] = useState(null)
  const [reports, setReports] = useState([])
  const [reportStats, setReportStats] = useState({})
  const [login, setLogin] = useState(() => localStorage.getItem('wa_login') || '')
  const fileRef = useRef(null)

  const notify = useCallback((msg) => {
    setToast(msg)
    setTimeout(() => setToast(''), 2800)
  }, [])

  const loadStatus = useCallback(async () => {
    try { setStatus(await api('/api/status')); setError('') } catch (e) { setError(e.message) }
  }, [])

  const loadQr = useCallback(async () => {
    try {
      const d = await api('/api/whatsapp/qr')
      setQr(d.status === 'qr' ? d.qr : null)
      if (d.status === 'connected') loadStatus()
    } catch (e) { setError(e.message) }
  }, [loadStatus])

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

  useEffect(() => { loadStatus(); loadQr(); const t = setInterval(() => { loadStatus(); loadQr() }, 5000); return () => clearInterval(t) }, [loadStatus, loadQr])
  useEffect(() => { if (page === 'incoming' || page === 'dashboard') loadChats() }, [page, loadChats])
  useEffect(() => { if (selected) loadMessages(selected.chatJid) }, [selected, loadMessages])
  useEffect(() => { if (page === 'reports') loadReports() }, [page, loadReports])

  useEffect(() => {
    const es = new EventSource('/api/incoming/events')
    es.onmessage = () => { if (page === 'incoming' || page === 'dashboard') loadChats(); if (selected) loadMessages(selected.chatJid) }
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

  const onFile = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 10 * 1024 * 1024) return setError('फ़ाइल 10 MB से छोटी होनी चाहिए')
    const reader = new FileReader()
    reader.onload = () => setAttachment({ name: file.name, type: file.type || 'application/octet-stream', data: reader.result })
    reader.readAsDataURL(file)
  }

  const logout = () => { localStorage.removeItem('wa_login'); setLogin(''); notify('लोकल लॉगिन हटाया गया') }

  if (!login) return <Login onLogin={setLogin} />

  return <div className="app-shell">
    <aside className="sidebar">
      <div className="brand"><div className="brand-mark">W</div><div><strong>WA Control</strong><small>Baileys Automation</small></div></div>
      <div className="account-mini"><span className={`dot ${status.status === 'connected' ? 'online' : ''}`}></span><div><b>{status.profileName || 'WhatsApp Account'}</b><small>{status.number ? `+${status.number}` : 'Not connected'}</small></div></div>
      <nav>{nav.map(([id, icon, label]) => <button key={id} className={page === id ? 'active' : ''} onClick={() => setPage(id)}><span>{icon}</span>{label}</button>)}</nav>
      <div className="sidebar-bottom"><button onClick={loadStatus}>↻ Refresh status</button><button onClick={logout}>⇥ Logout</button></div>
    </aside>

    <main className="main">
      <header className="topbar"><div><h1>{nav.find(n => n[0] === page)?.[2]}</h1><p>WhatsApp automation control center</p></div><div className={`connection ${status.status === 'connected' ? 'connected' : ''}`}><span className="dot"></span>{status.status === 'connected' ? 'Connected' : 'Waiting for WhatsApp'}</div></header>
      {error && <div className="alert">⚠ {error}<button onClick={() => setError('')}>×</button></div>}
      {toast && <div className="toast">✓ {toast}</div>}

      {page === 'dashboard' && <Dashboard status={status} qr={qr} stats={stats} chats={chats} onConnect={loadQr} onChat={chooseChat} />}
      {page === 'send' && <SendPage chats={chats} selected={selected} setSelected={setSelected} text={text} setText={setText} attachment={attachment} setAttachment={setAttachment} fileRef={fileRef} onFile={onFile} onSend={sendReply} sending={sending} />}
      {page === 'incoming' && <IncomingPage chats={chats} selected={selected} setSelected={setSelected} messages={messages} search={search} setSearch={setSearch} filter={chatFilter} setFilter={setChatFilter} text={text} setText={setText} attachment={attachment} setAttachment={setAttachment} fileRef={fileRef} onFile={onFile} onSend={sendReply} sending={sending} />}
      {page === 'reports' && <ReportsPage reports={reports} stats={reportStats} refresh={loadReports} />}
      {page === 'api' && <ApiPage />}
      {page === 'system' && <SystemPage status={status} />}
    </main>
  </div>
}

function Login({ onLogin }) {
  const [u, setU] = useState('admin'); const [p, setP] = useState('admin123'); const [err, setErr] = useState('')
  const submit = async (e) => { e.preventDefault(); try { const d = await api('/api/auth/login', { method: 'POST', body: JSON.stringify({ username: u, password: p }) }); if (d.success) { localStorage.setItem('wa_login', d.user.token); onLogin(d.user.token) } } catch (e) { setErr(e.message) } }
  return <div className="login-page"><form className="login-card" onSubmit={submit}><div className="login-logo">W</div><h1>WA Control Center</h1><p>Sign in to manage your WhatsApp automation</p><label>Username<input value={u} onChange={e => setU(e.target.value)} /></label><label>Password<input type="password" value={p} onChange={e => setP(e.target.value)} /></label>{err && <div className="form-error">{err}</div>}<button className="primary full">Sign in</button><small>Default: admin / admin123</small></form></div>
}

function Dashboard({ status, qr, stats, chats, onConnect, onChat }) {
  return <section className="page-content">
    <div className="hero-card"><div><span className="eyebrow">WHATSAPP SESSION</span><h2>{status.status === 'connected' ? 'WhatsApp is connected' : 'Connect your WhatsApp'}</h2><p>{status.status === 'connected' ? `Account ${status.number ? '+' + status.number : ''} is ready for messaging.` : 'Open WhatsApp on your phone and scan the QR code to connect.'}</p><button className="primary" onClick={onConnect}>{status.status === 'connected' ? 'Refresh connection' : 'Get QR code'}</button></div>{qr ? <img className="qr" src={qr} alt="WhatsApp QR" /> : <div className={`status-art ${status.status === 'connected' ? 'ok' : ''}`}>{status.status === 'connected' ? '✓' : 'W'}</div>}</div>
    <div className="stat-grid"><Stat icon="◉" value={stats.chats} label="Active chats" /><Stat icon="!" value={stats.unread} label="Unread" /><Stat icon="▣" value={stats.groups} label="Groups" /><Stat icon="✓" value={status.status === 'connected' ? 'Online' : 'Offline'} label="Session" /></div>
    <div className="section-head"><div><h2>Recent conversations</h2><p>Latest chats received by the Baileys backend</p></div></div>
    <div className="chat-grid">{chats.slice(0, 8).map(c => <button className="chat-card" key={c.chatJid} onClick={() => onChat(c)}><div className="avatar">{(c.name || '?')[0].toUpperCase()}</div><div><b>{c.name}</b><p>{c.lastMessage || 'Media message'}</p></div>{c.unreadCount ? <span className="badge">{c.unreadCount}</span> : null}</button>)}{!chats.length && <Empty text="अभी कोई बातचीत उपलब्ध नहीं है" />}</div>
  </section>
}

function Stat({ icon, value, label }) { return <div className="stat"><span>{icon}</span><div><strong>{value}</strong><small>{label}</small></div></div> }
function Empty({ text }) { return <div className="empty">{text}</div> }

function IncomingPage({ chats, selected, setSelected, messages, search, setSearch, filter, setFilter, text, setText, attachment, setAttachment, fileRef, onFile, onSend, sending }) {
  return <section className="wa-layout">
    <div className="chat-list"><div className="list-head"><div className="search"><span>⌕</span><input placeholder="Search chats..." value={search} onChange={e => setSearch(e.target.value)} /></div><div className="filters">{[['all','All'],['unread','Unread'],['group','Groups'],['direct','Direct']].map(([v,l]) => <button className={filter === v ? 'selected' : ''} key={v} onClick={() => setFilter(v)}>{l}</button>)}</div></div><div className="chat-items">{chats.map(c => <button key={c.chatJid} className={`chat-item ${selected?.chatJid === c.chatJid ? 'selected' : ''}`} onClick={() => setSelected(c)}><div className="avatar">{(c.name || '?')[0].toUpperCase()}</div><div className="chat-copy"><div><b>{c.name}</b><time>{c.lastTimestamp ? new Date(c.lastTimestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}</time></div><p>{c.lastMessage || 'Media'}</p></div>{c.unreadCount ? <span className="badge">{c.unreadCount}</span> : null}</button>)}{!chats.length && <Empty text="No chats found" />}</div></div>
    <div className="conversation">{selected ? <><div className="conversation-head"><div className="avatar">{(selected.name || '?')[0].toUpperCase()}</div><div><b>{selected.name}</b><small>{selected.isGroup ? 'Group' : selected.from}</small></div><span className="head-actions">⌕ ⋮</span></div><div className="messages">{messages.map(m => <Message key={m.id} m={m} />)}</div><Composer text={text} setText={setText} attachment={attachment} setAttachment={setAttachment} fileRef={fileRef} onFile={onFile} onSend={onSend} sending={sending} /></> : <div className="conversation-empty"><div>◉</div><h2>Select a conversation</h2><p>Choose a chat from the left to view and reply to messages.</p></div>}</div>
    <aside className="details"><h3>Chat details</h3>{selected ? <><div className="profile-big">{(selected.name || '?')[0].toUpperCase()}</div><h2>{selected.name}</h2><p>{selected.isGroup ? 'WhatsApp Group' : '+' + selected.from}</p><div className="detail-box"><span>Messages</span><b>{selected.messages?.length || 0}</b></div><div className="detail-box"><span>Media</span><b>{selected.mediaCount || 0}</b></div><div className="detail-box"><span>Unread</span><b>{selected.unreadCount || 0}</b></div></> : <p className="muted">Select a chat to see details.</p>}</aside>
  </section>
}

function Message({ m }) { return <div className={`message-row ${m.fromMe ? 'mine' : ''}`}><div className="bubble">{m.quotedText && <div className="quote">↪ {m.quotedText}</div>}{m.mediaUrl && m.mediaType === 'image' ? <img src={m.mediaUrl} alt="media" /> : null}<div>{m.message || `[${m.mediaType || 'media'}]`}</div><time>{m.date ? new Date(m.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''} {m.fromMe ? '✓✓' : ''}</time></div></div> }

function Composer({ text, setText, attachment, setAttachment, fileRef, onFile, onSend, sending }) { return <div className="composer">{attachment && <div className="attachment">📎 {attachment.name}<button onClick={() => { setAttachment(null); if (fileRef.current) fileRef.current.value = '' }}>×</button></div>}<div className="composer-row"><button className="icon-btn" onClick={() => fileRef.current?.click()}>📎</button><input type="file" ref={fileRef} hidden onChange={onFile} /><input value={text} onChange={e => setText(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); onSend() } }} placeholder="Type a message..." /><button className="send-btn" disabled={sending} onClick={onSend}>{sending ? '…' : '➤'}</button></div></div> }

function SendPage({ chats, selected, setSelected, ...composer }) { return <section className="send-page"><div className="send-card"><span className="eyebrow">OUTGOING MESSAGE</span><h2>Send WhatsApp message</h2><p>Use an existing chat from the Baileys session and send text or media.</p><label>Recipient / chat<select value={selected?.chatJid || ''} onChange={e => setSelected(chats.find(c => c.chatJid === e.target.value) || null)}><option value="">Select a chat</option>{chats.map(c => <option key={c.chatJid} value={c.chatJid}>{c.name} — {c.from}</option>)}</select></label><div className="send-composer"><Composer {...composer} /></div></div></section> }

function ReportsPage({ reports, stats, refresh }) { return <section className="page-content"><div className="section-head"><div><span className="eyebrow">DELIVERY LOG</span><h2>Message reports</h2><p>Outgoing message activity stored by the backend.</p></div><button className="secondary" onClick={refresh}>↻ Refresh</button></div><div className="stat-grid"><Stat value={stats.total ?? reports.length} label="Total" icon="▤" /><Stat value={stats.sent ?? '-'} label="Sent" icon="✓" /><Stat value={stats.failed ?? '-'} label="Failed" icon="!" /><Stat value={stats.pending ?? '-'} label="Pending" icon="◷" /></div><div className="table-card"><table><thead><tr><th>Date</th><th>To</th><th>Message</th><th>Status</th></tr></thead><tbody>{reports.slice(0, 100).map((r, i) => <tr key={r.id || i}><td>{r.date ? new Date(r.date).toLocaleString() : '-'}</td><td>{r.to || r.recipient || r.number || '-'}</td><td>{r.message || r.text || '-'}</td><td><span className="status-pill">{r.status || 'sent'}</span></td></tr>)}</tbody></table>{!reports.length && <Empty text="No message reports yet" />}</div></section> }

function ApiPage() { const [data, setData] = useState(null); const [err, setErr] = useState(''); useEffect(() => { api('/api/settings/api').then(setData).catch(e => setErr(e.message)) }, []); return <section className="page-content"><div className="section-head"><div><span className="eyebrow">DEVELOPER ACCESS</span><h2>API & Webhook</h2><p>API settings provided by the WhatsApp backend.</p></div></div><div className="api-card"><h3>API status</h3>{err ? <div className="form-error">{err}</div> : <><div className="api-row"><span>Connection</span><b>Backend API active</b></div><div className="api-row"><span>Token</span><code>{data?.token || 'Loading...'}</code></div><div className="api-row"><span>Webhook</span><b>{data?.webhookEnabled ? 'Enabled' : 'Not configured'}</b></div></>}</div></section> }

function SystemPage({ status }) { const [info, setInfo] = useState(null); useEffect(() => { api('/api/admin/system-info').then(d => setInfo(d.info)).catch(() => {}) }, []); return <section className="page-content"><div className="section-head"><div><span className="eyebrow">SERVER HEALTH</span><h2>System</h2><p>Live information from the Node.js and Baileys backend.</p></div></div><div className="info-grid">{[['WhatsApp', status.status],['Number', status.number ? '+' + status.number : 'Not connected'],['Node.js', info?.nodeVersion || 'Loading'],['Uptime', info?.uptime || 'Loading'],['Memory RSS', info?.memoryRssMB ? `${info.memoryRssMB} MB` : 'Loading'],['Messages logged', info?.totalMessagesLogged ?? 'Loading']].map(([a,b]) => <div className="info-card" key={a}><small>{a}</small><strong>{b}</strong></div>)}</div></section> }

export default App
