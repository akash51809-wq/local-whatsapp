import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { api } from '../../services/api'
import { useAuth } from '../../context/AuthContext'
import '../../styles/group.css'

const QUICK_EMOJIS = [
  '🙏', '✅', '❤️', '😊', '👍', '🔥', '🎉', '💐', '💼', '📌',
  '📢', '🚀', '⭐', '🤝', '💯', '👋', '🔔', '💬', '✨', '🎯',
  '💰', '🎁', '🇮🇳', '👌', '👇', '👉', '⚡', '🏆', '📈', '📱'
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

  // Send message modal states
  const [showSendModal, setShowSendModal] = useState(false)
  const [msgText, setMsgText] = useState('')
  const [attachment, setAttachment] = useState(null)
  const [showEmojiPicker, setShowEmojiPicker] = useState(false)
  const [sendingProgress, setSendingProgress] = useState({
    active: false,
    current: 0,
    total: 0,
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

  // Fetch Groups from WhatsApp
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
        notify(`${res.groups.length} groups loaded successfully.`)
      } else {
        setGroups([])
        notify(res.message || 'Could not load groups.')
      }
    } catch (e) {
      notify('Error loading groups: ' + e.message)
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
      const query = searchQuery.trim().toLowerCase()
      const matchesSearch =
        !query ||
        (g.subject && g.subject.toLowerCase().includes(query)) ||
        (g.id && g.id.toLowerCase().includes(query))

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

  const selectAll = () => {
    const allIds = filteredGroups.map(g => g.id)
    setSelectedGroupIds(new Set(allIds))
  }

  const clearSelection = () => {
    setSelectedGroupIds(new Set())
  }

  const isAllSelected = filteredGroups.length > 0 && filteredGroups.every(g => selectedGroupIds.has(g.id))

  const toggleSelectAll = () => {
    if (isAllSelected) clearSelection()
    else selectAll()
  }

  // Selected groups list
  const selectedGroupsList = useMemo(() => {
    return groups.filter(g => selectedGroupIds.has(g.id))
  }, [groups, selectedGroupIds])

  // Total members in selected groups
  const totalSelectedMembers = useMemo(() => {
    return selectedGroupsList.reduce((acc, g) => acc + (g.size || g.participants?.length || 0), 0)
  }, [selectedGroupsList])

  // Action: Fetch Group Members
  const handleFetchMembers = () => {
    if (selectedGroupIds.size === 0) {
      if (filteredGroups.length > 0) {
        // Select first group or all if none selected
        setSelectedGroupIds(new Set([filteredGroups[0].id]))
        notify(`Showing members for ${filteredGroups[0].subject}`)
      } else {
        notify('Please select at least one group first.')
      }
      return
    }
    notify(`Fetched members for ${selectedGroupIds.size} selected group(s).`)
  }

  // Action: Remove Duplicates
  const handleRemoveDuplicates = () => {
    const seen = new Set()
    const unique = []
    groups.forEach(g => {
      const key = (g.subject || '').trim().toLowerCase()
      if (!seen.has(key)) {
        seen.add(key)
        unique.push(g)
      }
    })
    const removedCount = groups.length - unique.length
    setGroups(unique)
    notify(removedCount > 0 ? `Removed ${removedCount} duplicate group(s).` : 'No duplicate groups found.')
  }

  // Action: Download CSV
  const handleDownloadList = () => {
    const targetGroups = selectedGroupsList.length > 0 ? selectedGroupsList : groups
    if (targetGroups.length === 0) {
      notify('No groups available to download.')
      return
    }

    let csv = 'Group Name,Members Count,Group ID,My Role,Participants\n'
    targetGroups.forEach(g => {
      const parts = (g.participants || []).map(p => p.phone || p.id).join('; ')
      csv += `"${(g.subject || '').replace(/"/g, '""')}",${g.size || 0},"${g.id}","${g.myRole || 'Member'}","${parts}"\n`
    })

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `whatsapp-groups-${new Date().toISOString().slice(0, 10)}.csv`
    link.click()
    URL.revokeObjectURL(url)
    notify('Group list CSV downloaded successfully.')
  }

  // Attachment handler
  const handleAttachment = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 15 * 1024 * 1024) {
      notify('File size must be less than 15 MB.')
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      setAttachment({
        name: file.name,
        type: file.type || 'application/octet-stream',
        data: reader.result
      })
      notify(`Attached: ${file.name}`)
    }
    reader.readAsDataURL(file)
  }

  // Send Group Message
  const handleSendGroupMessage = async () => {
    const targetIds = Array.from(selectedGroupIds)
    if (targetIds.length === 0) {
      notify('Please select at least 1 group.')
      return
    }
    if (!msgText.trim() && !attachment) {
      notify('Please enter a message or attach a file.')
      return
    }

    setSendingProgress({
      active: true,
      current: 0,
      total: targetIds.length,
      sentCount: 0,
      failCount: 0
    })

    try {
      const payload = {
        groupIds: targetIds,
        message: msgText.trim(),
        session: selectedSession,
        attachment: attachment
      }

      const res = await api('/api/send-group-message', {
        method: 'POST',
        body: JSON.stringify(payload)
      })

      if (res.success) {
        const sent = res.results?.filter(r => r.status === 'sent')?.length || targetIds.length
        const failed = res.results?.filter(r => r.status === 'failed')?.length || 0
        setSendingProgress(prev => ({
          ...prev,
          active: false,
          current: targetIds.length,
          sentCount: sent,
          failCount: failed
        }))
        notify(`✓ Message sent to ${sent} groups successfully!${failed > 0 ? ` (${failed} failed)` : ''}`)
        setMsgText('')
        setAttachment(null)
        if (fileInputRef.current) fileInputRef.current.value = ''
        setShowSendModal(false)
      } else {
        throw new Error(res.message || 'Failed to send message.')
      }
    } catch (e) {
      notify('Error: ' + e.message)
      setSendingProgress(prev => ({ ...prev, active: false }))
    }
  }

  const connectedLabel = status?.number
    ? `${status?.profileName || 'WhatsApp'} · +${status.number}`
    : status?.profileName || 'Connected WhatsApp'

  return (
    <div className="content group-page">
      {/* ── Top Toolbar Card ── */}
      <section className="group-toolbar card">
        <div className="group-control">
          <label>CHOOSE SCAN NUMBER</label>
          <select
            id="scanNumber"
            className="select"
            value={selectedSession}
            onChange={e => setSelectedSession(e.target.value)}
          >
            {sessions.length > 0 ? (
              sessions.map(s => (
                <option key={s.id || s.sessionId} value={s.id || s.sessionId}>
                  {s.name || 'Account'} · {s.number ? `+${s.number}` : s.status}
                </option>
              ))
            ) : (
              <option value="">{connectedLabel}</option>
            )}
          </select>
        </div>

        <div className="group-count">
          <small>NUMBER OF GROUPS</small>
          <strong id="groupCount">{groups.length}</strong>
          <span>groups found</span>
        </div>

        <button
          className={`refresh-btn ${loading ? 'spin' : ''}`}
          id="refreshGroups"
          type="button"
          onClick={() => fetchGroups(selectedSession)}
          disabled={loading}
          title="Refresh Groups"
        >
          ↻ <span>{loading ? 'Fetching...' : 'Refresh'}</span>
        </button>
      </section>

      {/* ── Main Workspace: 2-Column Layout ── */}
      <div className="group-workspace">
        {/* Left Column: Group List Card */}
        <section className="card group-list-card">
          <div className="card-head">
            <div>
              <h3>WhatsApp Groups</h3>
              <p id="scanStatus">Groups for {connectedLabel}</p>
            </div>
            <div className="group-actions">
              <button
                id="fetchMembers"
                className="group-action-btn fetch-btn"
                type="button"
                onClick={handleFetchMembers}
                title="View selected group members in the right panel"
              >
                ♙ <span>Fetch Group Members</span>
              </button>
              <button
                id="removeDuplicate"
                className="group-action-btn duplicate-btn"
                type="button"
                onClick={handleRemoveDuplicates}
                title="Remove duplicate groups"
              >
                ◈ <span>Remove Duplicate</span>
              </button>
            </div>
            <div className="select-all">
              <input
                type="checkbox"
                id="selectAll"
                checked={isAllSelected}
                onChange={toggleSelectAll}
              />
              <label htmlFor="selectAll">Select All</label>
            </div>
          </div>

          {/* Quick Search & Role Filter sub-bar */}
          <div style={{ display: 'flex', gap: 10, padding: '10px 15px', borderBottom: '1px solid rgba(30,58,45,0.08)' }}>
            <input
              type="text"
              className="input"
              placeholder="🔍 Search group name or ID..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              style={{ height: 36, fontSize: 13, flex: 1 }}
            />
            <select
              className="select"
              value={roleFilter}
              onChange={e => setRoleFilter(e.target.value)}
              style={{ height: 36, width: 'auto', minWidth: 120, fontSize: 12 }}
            >
              <option value="all">All Roles</option>
              <option value="admin">Only Admin</option>
              <option value="member">Only Member</option>
            </select>
          </div>

          <div className="table-wrap">
            <table className="table group-table">
              <thead>
                <tr>
                  <th>Select</th>
                  <th>Group Name</th>
                  <th>Members</th>
                  <th>Group ID</th>
                  <th>My Role</th>
                </tr>
              </thead>
              <tbody id="groupRows">
                {loading ? (
                  <tr>
                    <td colSpan={5} style={{ textAlign: 'center', padding: '48px 16px', color: '#718078' }}>
                      <div style={{ fontSize: 26, marginBottom: 8 }}>⏳</div>
                      Fetching WhatsApp groups, please wait...
                    </td>
                  </tr>
                ) : filteredGroups.length === 0 ? (
                  <tr>
                    <td colSpan={5} style={{ textAlign: 'center', padding: '48px 16px', color: '#718078' }}>
                      {groups.length === 0
                        ? 'No groups found. Please ensure WhatsApp is connected.'
                        : 'No groups match your search filter.'}
                    </td>
                  </tr>
                ) : (
                  filteredGroups.map(g => {
                    const isSelected = selectedGroupIds.has(g.id)
                    const isAdmin = g.myRole?.toLowerCase().includes('admin')
                    const initialLetters = (g.subject || 'GP').trim().slice(0, 2).toUpperCase()
                    return (
                      <tr key={g.id} className={isSelected ? 'row-selected' : ''}>
                        <td>
                          <input
                            className="group-check"
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleSelectGroup(g.id)}
                          />
                        </td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <span
                              className="avatar"
                              style={{
                                width: 32,
                                height: 32,
                                minWidth: 32,
                                borderRadius: 10,
                                fontSize: 11,
                                fontWeight: 800,
                                display: 'grid',
                                placeItems: 'center',
                                flexShrink: 0
                              }}
                            >
                              {initialLetters}
                            </span>
                            <b>{g.subject || 'Unnamed Group'}</b>
                          </div>
                        </td>
                        <td>{g.size || g.participants?.length || 0}</td>
                        <td>
                          <code style={{ fontSize: 11, color: '#718078' }}>
                            {g.id ? g.id.replace('@g.us', '') : '—'}
                          </code>
                        </td>
                        <td>
                          <span className={`role ${isAdmin ? 'admin' : 'member'}`}>
                            {g.myRole || 'Member'}
                          </span>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* Right Column: Group Members Panel */}
        <aside className="group-right-placeholder card" id="memberPanel">
          <button
            className="download-list-btn"
            id="downloadList"
            type="button"
            onClick={handleDownloadList}
            title="Download CSV list"
          >
            ⬇ <span>Download List</span>
          </button>
          <button
            className="send-selected-btn"
            id="sendSelected"
            type="button"
            onClick={() => {
              if (selectedGroupIds.size === 0) {
                notify('Please select one or more groups first.')
                return
              }
              setShowSendModal(true)
            }}
            title="Send Message to selected groups"
          >
            ➤ <span>Send Message</span>
          </button>

          {selectedGroupIds.size === 0 ? (
            <>
              <div className="placeholder-icon">♙</div>
              <strong>Group Members</strong>
              <p>Select one or multiple groups from the left to view their members here.</p>
            </>
          ) : (
            <>
              <div className="member-head">
                <div>
                  <small>SELECTED GROUPS</small>
                  <strong>{selectedGroupIds.size}</strong>
                </div>
                <span id="memberTotal">{totalSelectedMembers} members</span>
              </div>

              <div className="member-list">
                {selectedGroupsList.map(g => {
                  const parts = g.participants || []
                  return (
                    <div key={g.id} className="member-group">
                      <div className="member-group-title">
                        <b>{g.subject}</b>
                        <span>{g.size || parts.length} members</span>
                      </div>
                      {parts.length > 0 ? (
                        parts.slice(0, 60).map((p, idx) => (
                          <div key={p.id || idx} className="member-row">
                            <span className="member-avatar">{idx + 1}</span>
                            <span>{p.name || `WhatsApp Member ${idx + 1}`}</span>
                            <small>+{p.phone || (p.id ? p.id.split('@')[0] : '')}</small>
                          </div>
                        ))
                      ) : (
                        <div style={{ padding: '6px 0', fontSize: 11, color: '#718078' }}>
                          {g.size || 0} members · Click &ldquo;Fetch Group Members&rdquo; to expand list
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </>
          )}
        </aside>
      </div>

      {/* ── Send Message Modal (3D Pop-in) ── */}
      {showSendModal && (
        <div className="group-modal-overlay" onClick={() => !sendingProgress.active && setShowSendModal(false)}>
          <div className="group-modal-card" onClick={e => e.stopPropagation()}>
            <div className="group-modal-head">
              <div>
                <h3>Send Message to Groups</h3>
                <small style={{ color: '#16a765', fontWeight: 800 }}>
                  {selectedGroupIds.size} Groups Selected · ~{totalSelectedMembers} Members
                </small>
              </div>
              <button
                type="button"
                className="group-modal-close"
                onClick={() => !sendingProgress.active && setShowSendModal(false)}
              >
                ✕
              </button>
            </div>

            {/* Selected Groups Chips */}
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', maxHeight: 80, overflowY: 'auto', marginBottom: 12 }}>
              {selectedGroupsList.map(g => (
                <span
                  key={g.id}
                  style={{
                    background: 'rgba(22, 167, 101, 0.08)',
                    color: '#17613f',
                    border: '1px solid rgba(22, 167, 101, 0.2)',
                    borderRadius: 8,
                    padding: '3px 8px',
                    fontSize: 11,
                    fontWeight: 700
                  }}
                >
                  {g.subject}
                </span>
              ))}
            </div>

            {/* Quick Emojis Toggle */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <label style={{ fontSize: 11, fontWeight: 800, color: '#60766c' }}>MESSAGE CONTENT</label>
              <button
                type="button"
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#16a765',
                  cursor: 'pointer',
                  fontWeight: 800,
                  fontSize: 12
                }}
                onClick={() => setShowEmojiPicker(!showEmojiPicker)}
              >
                😊 Emojis {showEmojiPicker ? '▲' : '▼'}
              </button>
            </div>

            {showEmojiPicker && (
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(10, 1fr)',
                  gap: 4,
                  padding: 8,
                  background: '#ffffff',
                  border: '1px solid rgba(30, 58, 45, 0.1)',
                  borderRadius: 10,
                  marginBottom: 8
                }}
              >
                {QUICK_EMOJIS.map(em => (
                  <button
                    key={em}
                    type="button"
                    style={{ background: 'transparent', border: 'none', fontSize: 16, cursor: 'pointer', padding: 3 }}
                    onClick={() => setMsgText(prev => prev + em)}
                  >
                    {em}
                  </button>
                ))}
              </div>
            )}

            <textarea
              className="textarea"
              rows={4}
              placeholder="Type message to broadcast to selected groups... (*bold*, _italic_)"
              value={msgText}
              onChange={e => setMsgText(e.target.value)}
              style={{ minHeight: 100, fontSize: 13, marginBottom: 12 }}
            />

            {/* File Attachment */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              <input
                type="file"
                ref={fileInputRef}
                style={{ display: 'none' }}
                onChange={handleAttachment}
              />
              <button
                type="button"
                className="btn"
                onClick={() => fileInputRef.current?.click()}
                style={{ fontSize: 12, padding: '7px 12px' }}
              >
                📎 Attach File (Photo / Video / Doc)
              </button>
              {attachment && (
                <span style={{ fontSize: 12, fontWeight: 700, color: '#17613f' }}>
                  📄 {attachment.name}
                  <button
                    type="button"
                    style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#e85b63', marginLeft: 6, fontWeight: 800 }}
                    onClick={() => { setAttachment(null); if (fileInputRef.current) fileInputRef.current.value = '' }}
                  >
                    ✕
                  </button>
                </span>
              )}
            </div>

            {/* Anti-Spam Safe Interval Notice */}
            <div
              style={{
                padding: '8px 12px',
                borderRadius: 9,
                background: 'rgba(22, 167, 101, 0.08)',
                color: '#17613f',
                fontSize: 11,
                lineHeight: 1.4,
                marginBottom: 16
              }}
            >
              🛡️ <b>Anti-Spam Safety:</b> Messages are dispatched with a natural safe interval to protect your WhatsApp account.
            </div>

            {/* Sending Progress Bar */}
            {sendingProgress.active && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, fontWeight: 800, marginBottom: 4 }}>
                  <span>Sending message to groups...</span>
                  <span>{sendingProgress.current} / {sendingProgress.total}</span>
                </div>
                <div style={{ height: 6, width: '100%', background: 'rgba(30, 58, 45, 0.1)', borderRadius: 4, overflow: 'hidden' }}>
                  <div
                    style={{
                      height: '100%',
                      width: `${(sendingProgress.current / Math.max(1, sendingProgress.total)) * 100}%`,
                      background: 'linear-gradient(145deg, #35cb89, #129e65)',
                      transition: 'width 0.3s ease'
                    }}
                  />
                </div>
              </div>
            )}

            {/* Modal Actions */}
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button
                type="button"
                className="btn"
                onClick={() => setShowSendModal(false)}
                disabled={sendingProgress.active}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn primary"
                onClick={handleSendGroupMessage}
                disabled={sendingProgress.active || (!msgText.trim() && !attachment)}
              >
                {sendingProgress.active ? '⏳ Sending...' : `➤ Send to ${selectedGroupIds.size} Groups`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
