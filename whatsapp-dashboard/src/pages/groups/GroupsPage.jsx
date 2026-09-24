import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { api } from '../../services/api'
import { useAuth } from '../../context/AuthContext'
import GroupMembersModal from '../../components/modals/GroupMembersModal'

const QUICK_EMOJIS = [
  '🙏', '✅', '❤️', '😊', '👍', '🔥', '🎉', '💐', '💼', '📌',
  '💼', '📢', '🚀', '⭐', '🤝', '💯', '👋', '🔔', '💬', '✨',
  '🎯', '📍', '💰', '🎁', '💐', '🇮🇳', '👌', '👇', '👉', '⚡'
]

export default function GroupsPage({ notify: propNotify, status: propStatus }) {
  const { notify: authNotify, status: authStatus } = useAuth()
  const notify = propNotify || authNotify
  const status = propStatus || authStatus

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
              <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: 'inherit' }}>WhatsApp Groups</h2>
              <p style={{ margin: 0, fontSize: 13, color: 'var(--zd-text-muted, #64748b)' }}>
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
                            <span style={{ fontWeight: 700, color: 'inherit', fontSize: 13 }}>
                              {g.subject || 'Unnamed Group'}
                            </span>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <code style={{ fontSize: 11, color: 'var(--zd-text-muted, #64748b)' }}>{g.id}</code>
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
                              <span style={{ fontSize: 11, color: 'var(--zd-text-muted, #94a3b8)', maxWidth: 350, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
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
                            style={{ fontSize: 12, padding: '5px 10px', background: 'var(--zd-border-subtle, #eef2f6)', color: 'inherit' }}
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
              <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: 'inherit' }}>
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
              <span style={{ fontSize: 11, fontWeight: 700, color: 'inherit' }}>संदेश (Message Text):</span>
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
            <div style={{ marginTop: 12, padding: 8, background: 'var(--zd-border-subtle, #f1f5f9)', borderRadius: 6, fontSize: 11, color: 'var(--zd-text-muted, #64748b)', lineHeight: 1.4 }}>
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
