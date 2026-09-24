import React, { useEffect, useRef, useState } from 'react'
import Empty from '../../components/common/Empty'
import { useAuth } from '../../context/AuthContext'
import api, { getToken } from '../../services/api'

export function Message({ m }) { 
  const token = getToken()
  const mediaSrc = m.mediaUrl ? `${m.mediaUrl}${m.mediaUrl.includes('?') ? '&' : '?'}token=${encodeURIComponent(token)}` : null

  return (
    <div className={`message-row ${m.fromMe ? 'mine' : ''}`}>
      <div className="bubble">
        {m.quotedText && <div className="quote">↪ {m.quotedText}</div>}
        {mediaSrc && m.mediaType === 'image' ? <img src={mediaSrc} alt="media" /> : null}
        <div>{m.message || `[${m.mediaType || 'media'}]`}</div>
        <time>{m.date ? new Date(m.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''} {m.fromMe ? '✓✓' : ''}</time>
      </div>
    </div>
  )
}

export function Composer({ text, setText, attachment, setAttachment, fileRef, onFile, onSend, sending }) { 
  return (
    <div className="composer">
      {attachment && (
        <div className="attachment">
          📎 {attachment.name}
          <button onClick={() => { setAttachment(null); if (fileRef.current) fileRef.current.value = '' }}>×</button>
        </div>
      )}
      <div className="composer-row">
        <button className="icon-btn" onClick={() => fileRef.current?.click()} title="Attach file">📎</button>
        <input type="file" ref={fileRef} hidden onChange={onFile} />
        <input 
          value={text} 
          onChange={e => setText(e.target.value)} 
          onKeyDown={e => { 
            if (e.key === 'Enter' && !e.shiftKey) { 
              e.preventDefault(); 
              onSend() 
            } 
          }} 
          placeholder="Type a message..." 
        />
        <button className="send-btn" disabled={sending} onClick={onSend} title="Send reply">
          {sending ? '…' : '➤'}
        </button>
      </div>
    </div>
  )
}

export function IncomingPage() {
  const {
    chats,
    selected,
    setSelected,
    messages,
    loadMessages,
    loadChats,
    chatFilter,
    setFilter = () => {},
    setChatFilter,
    search,
    setSearch,
    notify,
    setError
  } = useAuth()

  const currentFilter = chatFilter || 'all'
  const handleSetFilter = setChatFilter || setFilter

  const [text, setText] = useState('')
  const [attachment, setAttachment] = useState(null)
  const [sending, setSending] = useState(false)
  const fileRef = useRef(null)

  useEffect(() => {
    loadChats()
  }, [loadChats])

  useEffect(() => {
    if (selected?.chatJid) {
      loadMessages(selected.chatJid)
    }
  }, [selected, loadMessages])

  const onFile = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 10 * 1024 * 1024) {
      if (setError) setError('फ़ाइल 10 MB से छोटी होनी चाहिए')
      return
    }
    const reader = new FileReader()
    reader.onload = () => setAttachment({ name: file.name, type: file.type || 'application/octet-stream', data: reader.result })
    reader.readAsDataURL(file)
  }

  const sendReply = async () => {
    if (!selected || (!text.trim() && !attachment)) return
    setSending(true)
    if (setError) setError('')
    try {
      const body = { chatJid: selected.chatJid, text: text.trim() }
      if (attachment) body.attachment = attachment
      await api('/api/incoming/reply', { method: 'POST', body: JSON.stringify(body) })
      setText('')
      setAttachment(null)
      if (fileRef.current) fileRef.current.value = ''
      await loadMessages(selected.chatJid)
      await loadChats()
      if (notify) notify('संदेश भेज दिया गया')
    } catch (e) {
      if (setError) setError(e.message)
    } finally {
      setSending(false)
    }
  }

  return (
    <section className="wa-layout">
      <div className="chat-list">
        <div className="list-head">
          <div className="search">
            <span>⌕</span>
            <input 
              placeholder="Search chats..." 
              value={search} 
              onChange={e => setSearch(e.target.value)} 
            />
          </div>
          <div className="filters">
            {[['all','All'],['unread','Unread'],['group','Groups'],['direct','Direct']].map(([v,l]) => (
              <button 
                className={currentFilter === v ? 'selected' : ''} 
                key={v} 
                onClick={() => handleSetFilter(v)}
              >
                {l}
              </button>
            ))}
          </div>
        </div>

        <div className="chat-items">
          {chats.map(c => (
            <button 
              key={c.chatJid} 
              className={`chat-item ${selected?.chatJid === c.chatJid ? 'selected' : ''}`} 
              onClick={() => setSelected(c)}
            >
              <div className="avatar">{(c.name || '?')[0].toUpperCase()}</div>
              <div className="chat-copy">
                <div>
                  <b>{c.name}</b>
                  <time>{c.lastTimestamp ? new Date(c.lastTimestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}</time>
                </div>
                <p>{c.lastMessage || 'Media'}</p>
              </div>
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
              <div>
                <b>{selected.name}</b>
                <small>{selected.isGroup ? 'Group' : selected.from}</small>
              </div>
            </div>
            <div className="messages">
              {messages.map(m => <Message key={m.id} m={m} />)}
            </div>
            <Composer 
              text={text} 
              setText={setText} 
              attachment={attachment} 
              setAttachment={setAttachment} 
              fileRef={fileRef} 
              onFile={onFile} 
              onSend={sendReply} 
              sending={sending} 
            />
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
        ) : (
          <p className="muted">Select a chat to see details.</p>
        )}
      </aside>
    </section>
  )
}

export default IncomingPage
