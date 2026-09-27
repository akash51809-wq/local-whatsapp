import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import api, { getToken } from '../../services/api'
import '../../styles/inbox.css'

/* ─── Helpers ─────────────────────────────────────────────────────── */
function fmtTime(ts) {
  if (!ts) return ''
  const d = new Date(ts)
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function fmtDate(ts) {
  if (!ts) return ''
  const d = new Date(ts)
  const now = new Date()
  const yesterday = new Date(now)
  yesterday.setDate(now.getDate() - 1)
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
  '#2a9d8f', '#e76f51', '#264653', '#f4a261', '#16a765',
  '#4361ee', '#3a0ca3', '#7209b7', '#f72585', '#4895ef'
]

function avatarColor(name = '') {
  let h = 0
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) & 0xffffff
  return AVATAR_COLORS[h % AVATAR_COLORS.length]
}

function mediaPrev(m) {
  if (m?.mediaType === 'image') return '📷 Photo'
  if (m?.mediaType === 'video') return '📹 Video'
  if (m?.mediaType === 'audio' || m?.mediaType === 'ptt') return '🎤 Audio'
  if (m?.mediaType === 'document') return `📄 ${m.fileName || 'Document'}`
  if (m?.mediaType === 'sticker') return '😊 Sticker'
  return m?.message || ''
}

function fmtBytes(b) {
  if (!b) return ''
  if (b < 1024) return b + ' B'
  if (b < 1048576) return (b / 1024).toFixed(1) + ' KB'
  return (b / 1048576).toFixed(1) + ' MB'
}

const AVATAR_GRADIENTS = [
  'linear-gradient(145deg, #f0b24e, #ef7e51)',
  'linear-gradient(145deg, #35cb89, #129e65)',
  'linear-gradient(145deg, #2fa373, #157952)',
  'linear-gradient(145deg, #4facfe, #00c6fb)',
  'linear-gradient(145deg, #f39c12, #d35400)',
  'linear-gradient(145deg, #e67e22, #c0392b)',
  'linear-gradient(145deg, #1abc9c, #16a085)'
]

function avatarGradient(name = '') {
  let h = 0
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) & 0xffffff
  return AVATAR_GRADIENTS[Math.abs(h) % AVATAR_GRADIENTS.length]
}

/* ─── Avatar Component ────────────────────────────────────────────── */
function Avatar({ name, size = 36, src, className = '', isBig = false }) {
  const radius = isBig ? '14px' : '10px'
  if (src) {
    return (
      <img
        className={`avatar ${className} ${isBig ? 'big' : ''}`}
        style={{
          width: size,
          height: size,
          minWidth: size,
          borderRadius: radius,
          objectFit: 'cover',
          display: 'block'
        }}
        src={src}
        alt=""
      />
    )
  }
  return (
    <span
      className={`avatar ${className} ${isBig ? 'big' : ''}`}
      style={{
        width: size,
        height: size,
        minWidth: size,
        borderRadius: radius,
        background: avatarGradient(name || ''),
        color: '#ffffff',
        fontWeight: 800,
        fontSize: isBig ? 15 : 12,
        display: 'grid',
        placeItems: 'center',
        flexShrink: 0,
        userSelect: 'none',
        boxShadow: isBig ? '0 6px 16px rgba(0, 0, 0, 0.12)' : '0 4px 10px rgba(0, 0, 0, 0.10)'
      }}
    >
      {initials(name)}
    </span>
  )
}

/* ─── MediaBubble Component ───────────────────────────────────────── */
function MediaBubble({ m, token }) {
  const src = m.mediaUrl
    ? `${m.mediaUrl}${m.mediaUrl.includes('?') ? '&' : '?'}token=${encodeURIComponent(token)}`
    : null

  if (!src) return null

  if (m.mediaType === 'image' || m.mediaType === 'sticker') {
    return (
      <a href={src} target="_blank" rel="noopener noreferrer" className="media-img-wrap">
        <img src={src} alt="media" className="media-img" loading="lazy" />
      </a>
    )
  }
  if (m.mediaType === 'video') {
    return (
      <video src={src} controls className="media-video" preload="metadata" />
    )
  }
  if (m.mediaType === 'audio' || m.mediaType === 'ptt') {
    return (
      <div className="media-audio">
        <span>🎤</span>
        <audio src={src} controls preload="metadata" style={{ flex: 1, height: 32 }} />
      </div>
    )
  }
  if (m.mediaType === 'document') {
    return (
      <a href={src} target="_blank" rel="noopener noreferrer" className="media-doc">
        <span className="media-doc-icon">📄</span>
        <div className="media-doc-info">
          <div className="media-doc-name">{m.fileName || 'Document'}</div>
          {m.fileSize && <div className="media-doc-size">{fmtBytes(m.fileSize)}</div>}
        </div>
        <span className="media-doc-dl">⬇</span>
      </a>
    )
  }
  return null
}

/* ─── MessageBubble Component ─────────────────────────────────────── */
function MessageBubble({ m, showSender, isGroup }) {
  const token = getToken()
  const hasMedia = !!m.mediaUrl

  return (
    <div className={`bubble ${m.fromMe ? 'out' : 'in'}`}>
      {/* Group Sender Name */}
      {isGroup && !m.fromMe && showSender && m.pushName && (
        <div className="bubble-sender" style={{ color: avatarColor(m.pushName) }}>
          {m.pushName}
        </div>
      )}

      {/* Quoted Message */}
      {m.quotedText && (
        <div className="bubble-quote">
          {m.quotedParticipant && (
            <span style={{ display: 'block', fontWeight: 800, fontSize: 11, marginBottom: 2 }}>
              {m.quotedParticipant.split('@')[0]}
            </span>
          )}
          <span>{m.quotedText}</span>
        </div>
      )}

      {/* Media Attachment */}
      {hasMedia && <MediaBubble m={m} token={token} />}

      {/* Text Message */}
      {m.message && <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{m.message}</div>}
      {!m.message && !hasMedia && (
        <div style={{ fontStyle: 'italic', opacity: 0.7 }}>[{m.mediaType || 'message'}]</div>
      )}

      {/* Time & Read Status Ticks */}
      <div className="bubble-footer">
        <small>{fmtTime(m.date)}</small>
        {m.fromMe && (
          <span className="bubble-ticks" title={m.isRead ? 'Read' : 'Delivered'}>
            ✓✓
          </span>
        )}
      </div>
    </div>
  )
}

/* ─── ChatItem Component ──────────────────────────────────────────── */
function ChatItem({ c, active, onClick }) {
  const preview = c.lastMessage || mediaPrev({ mediaType: c.mediaType })
  const name = c.name || c.pushName || c.from || 'Unknown'

  return (
    <div
      className={`chat-item ${active ? 'active' : ''}`}
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={e => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onClick()
        }
      }}
    >
      <Avatar name={name} size={36} />
      <div className="chat-item-body">
        <div className="chat-item-head">
          <strong>{name}</strong>
          <time>{chatTimestamp(c.lastTimestamp)}</time>
        </div>
        <div className="chat-item-sub">
          <small>{preview || '\u00A0'}</small>
          {c.unreadCount > 0 && (
            <span className="unread-badge">{c.unreadCount > 99 ? '99+' : c.unreadCount}</span>
          )}
        </div>
      </div>
    </div>
  )
}

/* ─── Composer Component ──────────────────────────────────────────── */
function Composer({ chatJid }) {
  const [text, setText] = useState('')
  const [attachment, setAttachment] = useState(null)
  const [sending, setSending] = useState(false)
  const { setError, notify, loadMessages, loadChats } = useAuth()
  const fileRef = useRef(null)
  const textareaRef = useRef(null)

  const onFile = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 10 * 1024 * 1024) {
      setError('File must be smaller than 10 MB')
      return
    }
    const reader = new FileReader()
    reader.onload = () =>
      setAttachment({
        name: file.name,
        type: file.type || 'application/octet-stream',
        data: reader.result
      })
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
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      send()
    }
  }

  // Auto-resize textarea
  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 120) + 'px'
  }, [text])

  return (
    <>
      {attachment && (
        <div className="attach-preview-bar">
          <span>📎 {attachment.name}</span>
          <button
            type="button"
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              fontWeight: 800,
              color: '#17613f',
              fontSize: 14
            }}
            onClick={() => {
              setAttachment(null)
              if (fileRef.current) fileRef.current.value = ''
            }}
          >
            ✕
          </button>
        </div>
      )}
      <div className="reply">
        <input type="file" ref={fileRef} hidden onChange={onFile} />
        <button
          type="button"
          className="attach-btn"
          title="Attach file"
          onClick={() => fileRef.current?.click()}
        >
          📎
        </button>
        <textarea
          ref={textareaRef}
          className="input"
          rows={1}
          placeholder="Type a message"
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={onKey}
        />
        <button
          type="button"
          className="reply-btn"
          onClick={send}
          disabled={sending || (!text.trim() && !attachment)}
          title="Send"
        >
          {sending ? <span className="inbox-spinner" /> : '➤'}
        </button>
      </div>
    </>
  )
}

/* ─── Main IncomingPage Component ─────────────────────────────────── */
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
    notify
  } = useAuth()

  const [syncing, setSyncing] = useState(false)
  const [historyLoading, setHistoryLoading] = useState(false)
  const [historyMsg, setHistoryMsg] = useState('')
  const messagesEndRef = useRef(null)

  useEffect(() => {
    loadChats()
  }, [loadChats])

  useEffect(() => {
    if (selected?.chatJid) {
      loadMessages(selected.chatJid)
    }
  }, [selected, loadMessages])

  // Scroll to bottom when messages update
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

  // Trigger soft-reconnect to pull full WhatsApp history (no QR rescan needed)
  const handleRequestHistory = async () => {
    setHistoryLoading(true)
    setHistoryMsg('')
    try {
      const res = await api('/api/incoming/request-history', { method: 'POST' })
      setHistoryMsg(res.message || 'Reconnecting WhatsApp history...')
      setTimeout(async () => {
        await loadChats()
        setHistoryMsg('✅ Done! Chats refreshed.')
        setTimeout(() => setHistoryMsg(''), 4000)
        setHistoryLoading(false)
      }, 8000)
    } catch (e) {
      setHistoryMsg('❌ ' + (e.message || 'Error syncing history'))
      setHistoryLoading(false)
    }
  }

  // Group messages by date
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

  // Detect consecutive messages from same sender for group display
  const senderChangeIdx = useMemo(() => {
    const set = new Set()
    messages.forEach((m, i) => {
      const prev = messages[i - 1]
      if (!prev || prev.from !== m.from || prev.fromMe !== m.fromMe) {
        set.add(m.id || m.date)
      }
    })
    return set
  }, [messages])

  const contactName = selected?.name || selected?.pushName || selected?.from || 'Unknown'
  const rawPhone = selected?.from ? selected.from.replace(/\D/g, '') : ''
  const displayPhone = rawPhone ? `+${rawPhone}` : '—'
  const totalMessages = selected?.messages?.length || messages.length

  const copyPhone = () => {
    if (rawPhone) {
      navigator.clipboard.writeText(`+${rawPhone}`)
      notify('Phone number copied to clipboard!')
    }
  }

  return (
    <div className="content inbox-content">
      <div className={`inbox ${selected ? 'has-selected' : ''}`}>
        {/* ── Left Column: Chat List ── */}
        <aside className="chat-list">
          <div className="chat-head">
            <div>
              <span className="eyebrow">LIVE INBOX</span>
              <h3>Chats</h3>
            </div>
            <div className="chat-head-actions">
              <button
                type="button"
                className="chat-head-btn"
                onClick={handleRequestHistory}
                disabled={historyLoading}
                title="Sync full history from WhatsApp"
              >
                {historyLoading ? <span className="inbox-spinner" style={{ borderColor: 'rgba(22,167,101,0.3)', borderTopColor: '#16a765' }} /> : '⬇'}
                <span>Full Sync</span>
              </button>
              <button
                type="button"
                className="chat-head-btn"
                onClick={handleSync}
                disabled={syncing}
                title="Refresh chats"
              >
                <span style={{ display: 'inline-block', transform: syncing ? 'rotate(180deg)' : 'none', transition: 'transform 0.4s' }}>↻</span>
                <span>Refresh</span>
              </button>
            </div>
          </div>

          {/* Sync notification message */}
          {historyMsg && (
            <div className="history-alert-bar">
              {historyLoading && !historyMsg.startsWith('✅') && !historyMsg.startsWith('❌') && (
                <span className="inbox-spinner" style={{ borderColor: 'rgba(22,167,101,0.3)', borderTopColor: '#16a765' }} />
              )}
              <span>{historyMsg}</span>
            </div>
          )}

          {/* Search Input */}
          <div className="chat-list-search">
            <input
              className="input"
              placeholder="Search chats or numbers..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>

          {/* Filter Chips */}
          <div className="chat-filters">
            {[
              ['all', 'All'],
              ['unread', 'Unread'],
              ['group', 'Groups'],
              ['direct', 'Direct']
            ].map(([val, label]) => (
              <button
                type="button"
                key={val}
                className={`filter-chip ${chatFilter === val ? 'active' : ''}`}
                onClick={() => setChatFilter(val)}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Chat Items List */}
          <div className="chat-items-wrap">
            {chats.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 16px', color: '#718078' }}>
                <div style={{ fontSize: 36, marginBottom: 8, opacity: 0.6 }}>💬</div>
                <strong style={{ display: 'block', fontSize: 13, color: '#17372a', marginBottom: 4 }}>No chats found</strong>
                <small style={{ fontSize: 11, color: '#718078' }}>Messages will appear once your WhatsApp is connected</small>
              </div>
            ) : (
              chats.map(c => (
                <ChatItem
                  key={c.chatJid}
                  c={c}
                  active={selected?.chatJid === c.chatJid}
                  onClick={() => setSelected(c)}
                />
              ))
            )}
          </div>
        </aside>

        {/* ── Center Column: Conversation ── */}
        <section className="conversation">
          {selected ? (
            <>
              {/* Conversation Header */}
              <div className="conversation-head">
                <button
                  type="button"
                  className="conv-back-btn"
                  onClick={() => setSelected(null)}
                  title="Back to chats"
                >
                  ‹ Back
                </button>
                <Avatar name={contactName} size={38} />
                <div className="conversation-head-info">
                  <strong>{contactName}</strong>
                  <small>
                    <span className="online-dot" />
                    <span>{selected.isGroup ? 'Group Chat' : 'WhatsApp Online'} · {displayPhone}</span>
                  </small>
                </div>
                <div className="conversation-head-actions">
                  <button
                    type="button"
                    className="chat-head-btn"
                    title="Refresh messages"
                    onClick={() => loadMessages(selected.chatJid)}
                  >
                    ↻ Refresh
                  </button>
                </div>
              </div>

              {/* Chat Wall (Messages) */}
              <div className="chat-wall">
                {groupedMessages.length === 0 ? (
                  <div style={{ margin: 'auto', textAlign: 'center', color: '#718078', padding: '30px' }}>
                    <div style={{ fontSize: 32, marginBottom: 6 }}>✉️</div>
                    <p style={{ fontSize: 13, fontWeight: 700 }}>No messages yet in this conversation</p>
                  </div>
                ) : (
                  groupedMessages.map(item =>
                    item.type === 'sep' ? (
                      <span key={item.key} className="day">
                        {item.label.toUpperCase()}
                      </span>
                    ) : (
                      <MessageBubble
                        key={item.key}
                        m={item.m}
                        isGroup={selected.isGroup}
                        showSender={senderChangeIdx.has(item.m.id || item.m.date)}
                      />
                    )
                  )
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Message Composer */}
              <Composer chatJid={selected.chatJid} />
            </>
          ) : (
            <div className="conv-empty-splash">
              <svg viewBox="0 0 24 24" width="70" height="70" fill="none" stroke="#16a765" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
              </svg>
              <h2>WhatsApp Live Inbox</h2>
              <p>
                Select a conversation from the left panel to read and send messages in real-time.
              </p>
              <span className="conv-empty-badge">
                🔒 End-to-end encrypted live chat
              </span>
            </div>
          )}
        </section>

        {/* ── Right Column: Chat Details ── */}
        <aside className="chat-details">
          {selected ? (
            <>
              <span className="eyebrow">CHAT DETAILS</span>
              <Avatar name={contactName} size={55} isBig={true} className="big" />
              <h3>{contactName}</h3>
              <p>{displayPhone}</p>
              <span className="badge success">
                ● {selected.isGroup ? 'Group Active' : 'Online Now'}
              </span>

              <hr />

              {/* Stats Grid */}
              <div className="chat-details-stats">
                <div className="chat-details-stat-box">
                  <strong>{totalMessages}</strong>
                  <small>Messages</small>
                </div>
                <div className="chat-details-stat-box">
                  <strong>{selected.unreadCount || 0}</strong>
                  <small>Unread</small>
                </div>
                <div className="chat-details-stat-box">
                  <strong>{selected.mediaCount || 0}</strong>
                  <small>Media</small>
                </div>
              </div>

              {/* Quick Actions */}
              <strong style={{ fontSize: 13, color: '#17372a', alignSelf: 'flex-start', margin: '8px 0 6px' }}>
                Quick actions
              </strong>
              <div className="chat-details-actions">
                {rawPhone && (
                  <a className="chat-details-action-item" href={`tel:+${rawPhone}`}>
                    <span>📞 Voice Call</span>
                    <span>›</span>
                  </a>
                )}
                {rawPhone && (
                  <a
                    className="chat-details-action-item"
                    href={`https://wa.me/${rawPhone}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <span>↗ WhatsApp Web</span>
                    <span>›</span>
                  </a>
                )}
                {rawPhone && (
                  <div className="chat-details-action-item" onClick={copyPhone} role="button" tabIndex={0}>
                    <span>📋 Copy Phone</span>
                    <span>›</span>
                  </div>
                )}
                <div
                  className="chat-details-action-item"
                  onClick={() => setSelected(null)}
                  role="button"
                  tabIndex={0}
                >
                  <span>✕ Close Details</span>
                  <span>›</span>
                </div>
              </div>
            </>
          ) : (
            <div style={{ margin: 'auto', textAlign: 'center', color: '#718078', padding: '20px' }}>
              <span className="eyebrow" style={{ display: 'block', marginBottom: 20 }}>CHAT DETAILS</span>
              <div style={{ fontSize: 44, marginBottom: 12, opacity: 0.6 }}>👤</div>
              <strong style={{ display: 'block', fontSize: 13, color: '#17372a', marginBottom: 6 }}>No Chat Selected</strong>
              <small style={{ fontSize: 11.5, color: '#718078', lineHeight: 1.5, display: 'block' }}>
                Click any chat on the left to view profile info, statistics, and quick actions.
              </small>
            </div>
          )}
        </aside>
      </div>
    </div>
  )
}

export default IncomingPage
