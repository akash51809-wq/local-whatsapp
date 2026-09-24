import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import api, { getToken } from '../../services/api'
import './IncomingPage.css'

/* ─── helpers ─────────────────────────────────────────────────────── */
function fmtTime(ts) {
  if (!ts) return ''
  const d = new Date(ts)
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function fmtDate(ts) {
  if (!ts) return ''
  const d = new Date(ts)
  const now = new Date()
  const yesterday = new Date(now); yesterday.setDate(now.getDate() - 1)
  if (d.toDateString() === now.toDateString()) return 'Today'
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday'
  return d.toLocaleDateString([], { day: '2-digit', month: 'short', year: 'numeric' })
}

function chatTimestamp(ts) {
  if (!ts) return ''
  const d = new Date(ts)
  const now = new Date()
  if (d.toDateString() === now.toDateString()) return fmtTime(ts)
  const diffDays = Math.floor((now - d) / 86400000)
  if (diffDays < 7) return d.toLocaleDateString([], { weekday: 'short' })
  return d.toLocaleDateString([], { day: '2-digit', month: '2-digit', year: '2-digit' })
}

function initials(name) {
  if (!name) return '?'
  const parts = name.trim().split(/\s+/)
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase()
  return name[0].toUpperCase()
}

const AVATAR_COLORS = [
  '#e57373','#f06292','#ba68c8','#9575cd','#7986cb',
  '#64b5f6','#4dd0e1','#4db6ac','#81c784','#dce775',
  '#ffb74d','#ff8a65','#a1887f','#90a4ae'
]

function avatarColor(name = '') {
  let h = 0
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) & 0xffffff
  return AVATAR_COLORS[h % AVATAR_COLORS.length]
}

function mediaPrev(m) {
  if (m.mediaType === 'image') return '📷 Photo'
  if (m.mediaType === 'video') return '📹 Video'
  if (m.mediaType === 'audio' || m.mediaType === 'ptt') return '🎤 Audio'
  if (m.mediaType === 'document') return `📄 ${m.fileName || 'Document'}`
  if (m.mediaType === 'sticker') return '😊 Sticker'
  return m.message || ''
}

function fmtBytes(b) {
  if (!b) return ''
  if (b < 1024) return b + ' B'
  if (b < 1048576) return (b / 1024).toFixed(1) + ' KB'
  return (b / 1048576).toFixed(1) + ' MB'
}

/* ─── Avatar ──────────────────────────────────────────────────────── */
function Avatar({ name, size = 40, src }) {
  if (src) return <img className="wa-avatar" style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover' }} src={src} alt="" />
  return (
    <div className="wa-avatar" style={{
      width: size, height: size, borderRadius: '50%',
      background: avatarColor(name || ''),
      color: '#fff', fontWeight: 700,
      fontSize: Math.max(12, size * 0.38),
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      flexShrink: 0, userSelect: 'none'
    }}>
      {initials(name)}
    </div>
  )
}

/* ─── MediaBubble ─────────────────────────────────────────────────── */
function MediaBubble({ m, token }) {
  const src = m.mediaUrl
    ? `${m.mediaUrl}${m.mediaUrl.includes('?') ? '&' : '?'}token=${encodeURIComponent(token)}`
    : null

  if (!src) return null

  if (m.mediaType === 'image' || m.mediaType === 'sticker') {
    return (
      <a href={src} target="_blank" rel="noopener noreferrer" className="wa-media-img-wrap">
        <img src={src} alt="media" className="wa-media-img" />
      </a>
    )
  }
  if (m.mediaType === 'video') {
    return (
      <video src={src} controls className="wa-media-video" preload="metadata" />
    )
  }
  if (m.mediaType === 'audio' || m.mediaType === 'ptt') {
    return (
      <div className="wa-media-audio">
        <span>🎤</span>
        <audio src={src} controls preload="metadata" style={{ flex: 1, height: 32 }} />
      </div>
    )
  }
  if (m.mediaType === 'document') {
    return (
      <a href={src} target="_blank" rel="noopener noreferrer" className="wa-media-doc">
        <span className="wa-doc-icon">📄</span>
        <div className="wa-doc-info">
          <div className="wa-doc-name">{m.fileName || 'Document'}</div>
          {m.fileSize && <div className="wa-doc-size">{fmtBytes(m.fileSize)}</div>}
        </div>
        <span className="wa-doc-dl">⬇</span>
      </a>
    )
  }
  return null
}

/* ─── MessageBubble ───────────────────────────────────────────────── */
function MessageBubble({ m, showSender, isGroup }) {
  const token = getToken()
  const hasMedia = !!m.mediaUrl

  return (
    <div className={`wa-msg-row ${m.fromMe ? 'wa-out' : 'wa-in'}`}>
      <div className={`wa-bubble ${m.fromMe ? 'wa-bubble-out' : 'wa-bubble-in'}`}>
        {/* group sender name */}
        {isGroup && !m.fromMe && showSender && m.pushName && (
          <div className="wa-sender-name" style={{ color: avatarColor(m.pushName) }}>
            {m.pushName}
          </div>
        )}
        {/* quoted / reply */}
        {m.quotedText && (
          <div className="wa-quote">
            {m.quotedParticipant && (
              <span className="wa-quote-author">{m.quotedParticipant.split('@')[0]}</span>
            )}
            <span className="wa-quote-text">{m.quotedText}</span>
          </div>
        )}
        {/* media */}
        {hasMedia && <MediaBubble m={m} token={token} />}
        {/* text */}
        {m.message && <div className="wa-msg-text">{m.message}</div>}
        {!m.message && !hasMedia && (
          <div className="wa-msg-text wa-msg-muted">[{m.mediaType || 'message'}]</div>
        )}
        {/* footer */}
        <div className="wa-msg-foot">
          <span className="wa-msg-time">{fmtTime(m.date)}</span>
          {m.fromMe && (
            <span className={`wa-ticks ${m.isRead ? 'wa-ticks-read' : ''}`}>✓✓</span>
          )}
        </div>
      </div>
    </div>
  )
}

/* ─── DateSeparator ───────────────────────────────────────────────── */
function DateSeparator({ label }) {
  return (
    <div className="wa-date-sep">
      <span>{label}</span>
    </div>
  )
}

/* ─── ChatItem ────────────────────────────────────────────────────── */
function ChatItem({ c, active, onClick }) {
  const preview = c.lastMessage || mediaPrev({ mediaType: c.mediaType })
  return (
    <button className={`wa-chat-item ${active ? 'wa-chat-item-active' : ''}`} onClick={onClick}>
      <Avatar name={c.name || c.pushName || c.from} size={46} />
      <div className="wa-ci-body">
        <div className="wa-ci-top">
          <span className="wa-ci-name">{c.name || c.pushName || c.from || 'Unknown'}</span>
          <span className="wa-ci-time">{chatTimestamp(c.lastTimestamp)}</span>
        </div>
        <div className="wa-ci-bottom">
          <span className="wa-ci-preview">
            {c.isGroup && c.lastFromMe === false ? '' : ''}
            {preview || '\u00A0'}
          </span>
          {c.unreadCount > 0 && (
            <span className="wa-unread-badge">{c.unreadCount > 99 ? '99+' : c.unreadCount}</span>
          )}
        </div>
      </div>
    </button>
  )
}

/* ─── Composer ────────────────────────────────────────────────────── */
function Composer({ onSend, chatJid }) {
  const [text, setText] = useState('')
  const [attachment, setAttachment] = useState(null)
  const [sending, setSending] = useState(false)
  const { setError, notify, loadMessages, loadChats } = useAuth()
  const fileRef = useRef(null)
  const textareaRef = useRef(null)

  const onFile = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 10 * 1024 * 1024) { setError('File must be < 10 MB'); return }
    const reader = new FileReader()
    reader.onload = () => setAttachment({ name: file.name, type: file.type || 'application/octet-stream', data: reader.result })
    reader.readAsDataURL(file)
  }

  const send = async () => {
    if (!chatJid || (!text.trim() && !attachment)) return
    setSending(true)
    setError('')
    try {
      const body = { chatJid, text: text.trim() }
      if (attachment) body.attachment = attachment
      await api('/api/incoming/reply', { method: 'POST', body: JSON.stringify(body) })
      setText('')
      setAttachment(null)
      if (fileRef.current) fileRef.current.value = ''
      await loadMessages(chatJid)
      await loadChats()
      notify('संदेश भेज दिया गया ✓')
    } catch (e) {
      setError(e.message)
    } finally {
      setSending(false)
    }
  }

  const onKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() }
  }

  // auto-resize textarea
  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 120) + 'px'
  }, [text])

  return (
    <div className="wa-composer">
      {attachment && (
        <div className="wa-attachment-preview">
          📎 <span>{attachment.name}</span>
          <button onClick={() => { setAttachment(null); if (fileRef.current) fileRef.current.value = '' }}>✕</button>
        </div>
      )}
      <div className="wa-composer-row">
        <button className="wa-comp-btn" title="Attach" onClick={() => fileRef.current?.click()}>📎</button>
        <input type="file" ref={fileRef} hidden onChange={onFile} />
        <textarea
          ref={textareaRef}
          className="wa-composer-input"
          placeholder="Type a message"
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={onKey}
          rows={1}
        />
        <button className={`wa-send-btn ${sending ? 'wa-sending' : ''}`} onClick={send} disabled={sending} title="Send">
          {sending
            ? <span className="wa-spinner" />
            : <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M1.101 21.757 23.8 12.028 1.101 2.3l.011 7.912 13.623 1.816-13.623 1.817-.011 7.912z" /></svg>}
        </button>
      </div>
    </div>
  )
}

/* ─── Main Page ───────────────────────────────────────────────────── */
export function IncomingPage() {
  const {
    chats,
    selected,
    setSelected,
    messages,
    loadMessages,
    loadChats,
    chatFilter,
    setChatFilter,
    search,
    setSearch,
  } = useAuth()

  const [syncing, setSyncing] = useState(false)
  const messagesEndRef = useRef(null)

  useEffect(() => { loadChats() }, [loadChats])

  useEffect(() => {
    if (selected?.chatJid) loadMessages(selected.chatJid)
  }, [selected, loadMessages])

  // scroll to bottom when new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSync = async () => {
    setSyncing(true)
    try {
      await api('/api/incoming/sync-chats', { method: 'POST' })
      await loadChats()
    } catch {}
    setSyncing(false)
  }

  // group messages by date for separators
  const groupedMessages = useMemo(() => {
    const groups = []
    let lastDate = null
    messages.forEach(m => {
      const label = fmtDate(m.date)
      if (label !== lastDate) {
        groups.push({ type: 'sep', label, key: `sep-${m.date}` })
        lastDate = label
      }
      groups.push({ type: 'msg', m, key: m.id || m.date })
    })
    return groups
  }, [messages])

  // detect consecutive messages from same sender (for group name display)
  const senderChangeIdx = useMemo(() => {
    const set = new Set()
    messages.forEach((m, i) => {
      const prev = messages[i - 1]
      if (!prev || prev.from !== m.from || prev.fromMe !== m.fromMe) set.add(m.id || m.date)
    })
    return set
  }, [messages])

  const totalMessages = selected?.messages?.length || messages.length

  return (
    <div className="wa-shell">
      {/* ── Left: Chat list ── */}
      <aside className="wa-sidebar">
        {/* Header */}
        <div className="wa-sidebar-head">
          <span className="wa-sidebar-title">Chats</span>
          <button className="wa-head-icon-btn" onClick={handleSync} disabled={syncing} title="Sync chats">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" style={{ opacity: syncing ? 0.5 : 1 }}>
              <path d="M17.65 6.35A7.958 7.958 0 0 0 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08A5.99 5.99 0 0 1 12 18c-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z" />
            </svg>
          </button>
        </div>

        {/* Search */}
        <div className="wa-search-wrap">
          <div className="wa-search-box">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
            </svg>
            <input
              className="wa-search-input"
              placeholder="Search or start new chat"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
        </div>

        {/* Filters */}
        <div className="wa-filters">
          {[['all', 'All'], ['unread', 'Unread'], ['group', 'Groups'], ['direct', 'Direct']].map(([v, l]) => (
            <button
              key={v}
              className={`wa-filter-btn ${chatFilter === v ? 'wa-filter-active' : ''}`}
              onClick={() => setChatFilter(v)}
            >{l}</button>
          ))}
        </div>

        {/* Chat list */}
        <div className="wa-chat-list">
          {chats.length === 0 && (
            <div className="wa-empty-list">
              <div className="wa-empty-icon">💬</div>
              <p>No chats found</p>
              <small>Messages will appear here once your WhatsApp is connected</small>
            </div>
          )}
          {chats.map(c => (
            <ChatItem
              key={c.chatJid}
              c={c}
              active={selected?.chatJid === c.chatJid}
              onClick={() => setSelected(c)}
            />
          ))}
        </div>
      </aside>

      {/* ── Center: Conversation ── */}
      <main className="wa-conversation">
        {selected ? (
          <>
            {/* Chat header */}
            <div className="wa-conv-head">
              <Avatar name={selected.name || selected.pushName || selected.from} size={40} />
              <div className="wa-conv-head-info">
                <div className="wa-conv-head-name">{selected.name || selected.pushName || selected.from}</div>
                <div className="wa-conv-head-sub">
                  {selected.isGroup
                    ? `${selected.messages?.length || 0} messages · Group`
                    : `+${(selected.from || '').replace(/\D/g, '')}`}
                </div>
              </div>
              <div className="wa-conv-head-actions">
                <button className="wa-head-icon-btn" title="Refresh" onClick={() => loadMessages(selected.chatJid)}>
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
                    <path d="M17.65 6.35A7.958 7.958 0 0 0 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08A5.99 5.99 0 0 1 12 18c-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Messages area */}
            <div className="wa-messages-area">
              <div className="wa-messages-inner">
                {groupedMessages.length === 0 && (
                  <div className="wa-no-msgs">No messages yet</div>
                )}
                {groupedMessages.map(item =>
                  item.type === 'sep'
                    ? <DateSeparator key={item.key} label={item.label} />
                    : <MessageBubble
                        key={item.key}
                        m={item.m}
                        isGroup={selected.isGroup}
                        showSender={senderChangeIdx.has(item.m.id || item.m.date)}
                      />
                )}
                <div ref={messagesEndRef} />
              </div>
            </div>

            {/* Composer */}
            <Composer chatJid={selected.chatJid} />
          </>
        ) : (
          <div className="wa-conv-empty">
            <div className="wa-conv-empty-icon">
              <svg viewBox="0 0 303 172" width="280" fill="none" xmlns="http://www.w3.org/2000/svg">
                <circle cx="151" cy="86" r="86" fill="#2a3942" />
                <path d="M151 50c-20 0-36 16-36 36s16 36 36 36 36-16 36-36-16-36-36-36zm0 64c-15.5 0-28-12.5-28-28s12.5-28 28-28 28 12.5 28 28-12.5 28-28 28z" fill="#3b4a54" />
                <path d="M151 74a12 12 0 1 0 0 24 12 12 0 0 0 0-24z" fill="#00a884" />
              </svg>
            </div>
            <h2 className="wa-conv-empty-title">WhatsApp Web</h2>
            <p className="wa-conv-empty-sub">
              बाएं पैनल से कोई भी चैट चुनें
              <br />और मैसेज का जवाब दें।
            </p>
            <div className="wa-conv-empty-note">
              🔒 End-to-end encrypted conversations
            </div>
          </div>
        )}
      </main>

      {/* ── Right: Chat Details ── */}
      <aside className="wa-details">
        {selected ? (
          <>
            <div className="wa-det-header">Contact Info</div>
            <div className="wa-det-avatar-wrap">
              <Avatar name={selected.name || selected.pushName || selected.from} size={80} />
            </div>
            <div className="wa-det-name">{selected.name || selected.pushName || selected.from}</div>
            <div className="wa-det-sub">
              {selected.isGroup ? '👥 WhatsApp Group' : `📱 +${(selected.from || '').replace(/\D/g, '')}`}
            </div>

            <div className="wa-det-stats">
              <div className="wa-det-stat">
                <div className="wa-det-stat-val">{totalMessages}</div>
                <div className="wa-det-stat-lbl">Messages</div>
              </div>
              <div className="wa-det-stat">
                <div className="wa-det-stat-val">{selected.unreadCount || 0}</div>
                <div className="wa-det-stat-lbl">Unread</div>
              </div>
              <div className="wa-det-stat">
                <div className="wa-det-stat-val">{selected.mediaCount || 0}</div>
                <div className="wa-det-stat-lbl">Media</div>
              </div>
            </div>

            <div className="wa-det-rows">
              {selected.isGroup && (
                <div className="wa-det-row">
                  <span className="wa-det-row-lbl">Type</span>
                  <span className="wa-det-row-val">Group Chat</span>
                </div>
              )}
              <div className="wa-det-row">
                <span className="wa-det-row-lbl">Phone</span>
                <span className="wa-det-row-val">{selected.from ? '+' + selected.from.replace(/\D/g, '') : '—'}</span>
              </div>
              <div className="wa-det-row">
                <span className="wa-det-row-lbl">Last Active</span>
                <span className="wa-det-row-val">{selected.lastTimestamp ? new Date(selected.lastTimestamp).toLocaleString() : '—'}</span>
              </div>
            </div>
          </>
        ) : (
          <div className="wa-det-empty">
            <div style={{ fontSize: 40, marginBottom: 12 }}>💬</div>
            <p>Select a chat to see contact details</p>
          </div>
        )}
      </aside>
    </div>
  )
}

export default IncomingPage
