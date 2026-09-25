import React, { useState, useMemo } from 'react'
import * as XLSX from 'xlsx'

export function GroupMembersDropdown({ groups = [], onClose, notify, onRemoveGroup }) {
  const [searchTerm, setSearchTerm] = useState('')
  const [removeDuplicates, setRemoveDuplicates] = useState(false)
  const [activeGroupTab, setActiveGroupTab] = useState('all')
  const [copied, setCopied] = useState(false)
  const [roleFilter, setRoleFilter] = useState('all')

  // Extract all participants across all given groups
  const rawMembers = useMemo(() => {
    const list = []
    groups.forEach(g => {
      const parts = g.participants || []
      parts.forEach(p => {
        const phone = p.phone ? String(p.phone).replace(/\D/g, '') : ''
        list.push({
          id: p.id || phone,
          phone: phone,
          role: p.role || (p.isSuperAdmin ? 'Super Admin' : (p.isAdmin ? 'Admin' : 'Member')),
          isAdmin: Boolean(p.isAdmin),
          isSuperAdmin: Boolean(p.isSuperAdmin),
          groupId: g.id,
          groupSubject: g.subject || 'Unnamed Group',
          groupDp: g.dp
        })
      })
    })
    return list
  }, [groups])

  // Map of phone number -> array of group subjects it belongs to
  const phoneGroupMap = useMemo(() => {
    const map = new Map()
    rawMembers.forEach(m => {
      if (!m.phone) return
      if (!map.has(m.phone)) {
        map.set(m.phone, [])
      }
      map.get(m.phone).push(m.groupSubject)
    })
    return map
  }, [rawMembers])

  // Count how many duplicate entries exist across the groups
  const duplicatePhoneCount = useMemo(() => {
    let dups = 0
    phoneGroupMap.forEach(groupNames => {
      if (groupNames.length > 1) {
        dups += (groupNames.length - 1)
      }
    })
    return dups
  }, [phoneGroupMap])

  const uniqueCount = useMemo(() => {
    return phoneGroupMap.size
  }, [phoneGroupMap])

  // Filter out duplicates if toggle is on
  const displayList = useMemo(() => {
    if (!removeDuplicates) return rawMembers

    const seen = new Set()
    const result = []
    rawMembers.forEach(m => {
      if (!m.phone) {
        result.push(m)
        return
      }
      if (!seen.has(m.phone)) {
        seen.add(m.phone)
        result.push(m)
      }
    })
    return result
  }, [rawMembers, removeDuplicates])

  // Search & tab & role filtered list
  const filtered = useMemo(() => {
    return displayList.filter(m => {
      const term = searchTerm.trim().toLowerCase()
      const matchesSearch = !term ||
        (m.phone && m.phone.includes(term)) ||
        (m.role && m.role.toLowerCase().includes(term)) ||
        (m.groupSubject && m.groupSubject.toLowerCase().includes(term))

      const matchesGroup = activeGroupTab === 'all' || m.groupId === activeGroupTab

      const matchesRole =
        roleFilter === 'all' ||
        (roleFilter === 'admin' && m.isAdmin) ||
        (roleFilter === 'member' && !m.isAdmin)

      return matchesSearch && matchesGroup && matchesRole
    })
  }, [displayList, searchTerm, activeGroupTab, roleFilter])

  // Toggle remove duplicates
  const handleToggleRemoveDuplicates = () => {
    const nextState = !removeDuplicates
    setRemoveDuplicates(nextState)
    if (nextState) {
      if (notify) notify(`✓ ${duplicatePhoneCount} डुप्लीकेट नंबर्स हटा दिए गए! (${uniqueCount} यूनिक नंबर्स बचे)`)
    } else {
      if (notify) notify('सभी मेंबर्स (डुप्लीकेट सहित) पुनः दिखाए जा रहे हैं।')
    }
  }

  // Export to Excel (.xlsx)
  const handleExportToExcel = () => {
    try {
      if (filtered.length === 0) {
        if (notify) notify('एक्सपोर्ट करने के लिए कोई सदस्य नहीं है।')
        return
      }

      const rows = filtered.map((m, idx) => ({
        'S.No': idx + 1,
        'Phone Number': m.phone ? `+${m.phone}` : '',
        'Role': m.role || 'Member',
        'Group Name': m.groupSubject,
        'Group ID': m.groupId,
        'Is Admin': m.isAdmin ? 'Yes' : 'No',
        'Is Super Admin': m.isSuperAdmin ? 'Yes' : 'No',
        'In Multiple Groups': (phoneGroupMap.get(m.phone)?.length > 1) ? `Yes (${phoneGroupMap.get(m.phone)?.length} groups)` : 'No'
      }))

      const ws = XLSX.utils.json_to_sheet(rows)
      ws['!cols'] = [
        { wch: 6 },
        { wch: 18 },
        { wch: 14 },
        { wch: 28 },
        { wch: 34 },
        { wch: 10 },
        { wch: 14 },
        { wch: 22 }
      ]

      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, 'Group Members')

      let fileName = ''
      if (groups.length === 1) {
        const safeName = (groups[0].subject || 'group').replace(/[^a-zA-Z0-9_-]/g, '_')
        fileName = `${safeName}_members_${removeDuplicates ? 'unique_' : ''}${Date.now().toString().slice(-4)}.xlsx`
      } else {
        fileName = `Combined_${groups.length}_Groups_Members_${removeDuplicates ? 'Unique_' : ''}${Date.now().toString().slice(-4)}.xlsx`
      }

      XLSX.writeFile(wb, fileName)
      if (notify) notify(`✓ ${rows.length} मेंबर्स की एक्सेल फ़ाइल डाउनलोड हो गई!`)
    } catch (e) {
      if (notify) notify('एक्सपोर्ट एरर: ' + e.message)
    }
  }

  // Copy all visible numbers
  const copyAllNumbers = () => {
    const phones = Array.from(new Set(filtered.map(m => m.phone).filter(Boolean)))
    if (phones.length === 0) {
      if (notify) notify('कॉपी करने के लिए कोई नंबर नहीं है')
      return
    }
    navigator.clipboard.writeText(phones.map(p => `+${p}`).join(', '))
    setCopied(true)
    if (notify) notify(`✓ ${phones.length} नंबर्स क्लिपबोर्ड पर कॉपी हो गए`)
    setTimeout(() => setCopied(false), 2000)
  }

  if (!groups || groups.length === 0) return null

  return (
    <div className="group-members-dropdown-panel">
      {/* Dropdown Header */}
      <div className="members-dropdown-header">
        <div className="dropdown-title-wrap">
          <div className="dropdown-icon-badge">👥</div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <h3 className="dropdown-title">ग्रुप मेंबर्स लिस्ट (Group Members List)</h3>
              <span className="badge badge-primary">
                {groups.length === 1 ? '1 ग्रुप' : `${groups.length} ग्रुप्स चुने गए`}
              </span>
              {removeDuplicates && (
                <span className="badge badge-success">
                  ✓ Duplicates Removed
                </span>
              )}
            </div>
            <p className="dropdown-subtitle">
              {groups.length === 1
                ? `${groups[0].subject || 'Unnamed Group'} के सभी सदस्य`
                : `चुने गए सभी ${groups.length} ग्रुप्स के सदस्य एक साथ`}
            </p>
          </div>
        </div>

        {/* Header Action Buttons */}
        <div className="dropdown-actions">
          {/* Remove Duplicate Button */}
          <button
            type="button"
            className={`btn-action-icon btn-remove-dups ${removeDuplicates ? 'active' : ''}`}
            onClick={handleToggleRemoveDuplicates}
            title={removeDuplicates ? 'डुप्लीकेट वापस दिखाएं' : 'समान नंबर वाले डुप्लीकेट हटाएं'}
          >
            {removeDuplicates ? (
              <>↩️ Undo Remove Dups ({duplicatePhoneCount})</>
            ) : (
              <>🧹 Remove Duplicates {duplicatePhoneCount > 0 ? `(${duplicatePhoneCount})` : ''}</>
            )}
          </button>

          {/* Download Excel Button */}
          <button
            type="button"
            className="btn-action-icon btn-download-excel"
            onClick={handleExportToExcel}
            title="पूरी लिस्ट एक्सेल (.xlsx) फ़ाइल में डाउनलोड करें"
          >
            📥 Download Excel
          </button>

          {/* Copy All Numbers */}
          <button
            type="button"
            className="btn-action-icon"
            onClick={copyAllNumbers}
            title="सभी नंबर्स कॉपी करें"
          >
            {copied ? '✓ कॉपी हुआ' : '📋 Copy Numbers'}
          </button>

          {/* Close Dropdown */}
          <button
            type="button"
            className="btn-action-icon btn-close-dropdown"
            onClick={onClose}
            title="ड्रॉपडाउन बंद करें"
          >
            ▲ Hide List
          </button>
        </div>
      </div>

      {/* Stats Bar */}
      <div className="members-dropdown-stats">
        <div className="members-stat-item">
          <span className="label">कुल मेंबर्स:</span>
          <span className="val">{rawMembers.length}</span>
        </div>
        <div className="members-stat-item">
          <span className="label">यूनिक नंबर्स:</span>
          <span className="val text-success">{uniqueCount}</span>
        </div>
        <div className="members-stat-item">
          <span className="label">डुप्लीकेट्स:</span>
          <span className={`val ${duplicatePhoneCount > 0 ? 'text-warning' : ''}`}>
            {duplicatePhoneCount}
          </span>
        </div>
        <div className="members-stat-item">
          <span className="label">वर्तमान में दिखाए गए:</span>
          <span className="val">{filtered.length}</span>
        </div>
      </div>

      {/* Group Pills (when multiple groups selected) */}
      {groups.length > 1 && (
        <div className="members-group-chips-bar">
          <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--zd-text-muted, #64748b)', marginRight: 4 }}>
            ग्रुप फ़िल्टर:
          </span>
          <button
            type="button"
            className={`group-filter-chip ${activeGroupTab === 'all' ? 'active' : ''}`}
            onClick={() => setActiveGroupTab('all')}
          >
            सभी {groups.length} ग्रुप्स ({displayList.length})
          </button>
          {groups.map(g => {
            const count = (g.participants || []).length
            return (
              <span key={g.id} className="group-chip-wrapper">
                <button
                  type="button"
                  className={`group-filter-chip ${activeGroupTab === g.id ? 'active' : ''}`}
                  onClick={() => setActiveGroupTab(g.id)}
                >
                  {g.subject || 'Unnamed'} ({count})
                </button>
                {onRemoveGroup && (
                  <button
                    type="button"
                    className="chip-remove-btn"
                    title={`हटाएं ${g.subject}`}
                    onClick={(e) => {
                      e.stopPropagation()
                      onRemoveGroup(g.id)
                    }}
                  >
                    ×
                  </button>
                )}
              </span>
            )
          })}
        </div>
      )}

      {/* Search & Filter Toolbar inside Dropdown */}
      <div className="members-dropdown-toolbar">
        <div style={{ display: 'flex', gap: 10, flex: 1, minWidth: 260, alignItems: 'center' }}>
          <input
            type="text"
            className="field-input"
            placeholder="🔍 नंबर, रोल या ग्रुप नाम से खोजें..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            style={{ fontSize: 12, padding: '7px 12px', margin: 0 }}
          />
          <select
            className="field-select"
            style={{ width: 'auto', minWidth: 120, fontSize: 12, padding: '7px 10px', margin: 0 }}
            value={roleFilter}
            onChange={e => setRoleFilter(e.target.value)}
          >
            <option value="all">सभी रोल्स</option>
            <option value="admin">केवल Admins</option>
            <option value="member">केवल Members</option>
          </select>
        </div>

        {searchTerm && (
          <button
            type="button"
            className="btn-action-icon"
            style={{ fontSize: 11, padding: '4px 8px' }}
            onClick={() => setSearchTerm('')}
          >
            ✕ Clear Search
          </button>
        )}
      </div>

      {/* Members Table */}
      <div className="members-dropdown-table-container">
        <table className="groups-table">
          <thead>
            <tr>
              <th style={{ width: 40 }}>#</th>
              <th>मोबाइल नंबर (Phone)</th>
              <th>ग्रुप नाम (Group)</th>
              <th style={{ width: 120 }}>रोल (Role)</th>
              <th style={{ width: 110, textAlign: 'center' }}>डुप्लीकेट स्थिति</th>
              <th style={{ width: 90, textAlign: 'right' }}>एक्शन</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((m, idx) => {
              const occurrences = phoneGroupMap.get(m.phone)?.length || 1
              const isDup = occurrences > 1

              return (
                <tr key={`${m.groupId}_${m.id || idx}`} className={isDup && !removeDuplicates ? 'row-duplicate-notice' : ''}>
                  <td style={{ color: '#64748b', fontSize: 12 }}>{idx + 1}</td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontWeight: 600, fontFamily: 'monospace', fontSize: 13 }}>
                        {m.phone ? `+${m.phone}` : 'No Number'}
                      </span>
                    </div>
                  </td>
                  <td>
                    <span style={{ fontSize: 12, fontWeight: 500, color: 'inherit' }} title={m.groupSubject}>
                      {m.groupSubject}
                    </span>
                  </td>
                  <td>
                    <span className={`badge ${m.isSuperAdmin ? 'badge-purple' : m.isAdmin ? 'badge-primary' : 'badge-secondary'}`}>
                      {m.isSuperAdmin ? '👑 Super Admin' : m.isAdmin ? '🛡️ Admin' : '👤 Member'}
                    </span>
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    {isDup ? (
                      <span
                        className="badge badge-warning"
                        title={`यह नंबर ${occurrences} ग्रुप्स में है: ${phoneGroupMap.get(m.phone)?.join(', ')}`}
                        style={{ fontSize: 10, padding: '2px 6px' }}
                      >
                        🔁 {occurrences} ग्रुप्स में
                      </span>
                    ) : (
                      <span style={{ fontSize: 11, color: '#94a3b8' }}>—</span>
                    )}
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <button
                      type="button"
                      className="btn-action-icon"
                      style={{ fontSize: 11, padding: '3px 8px' }}
                      onClick={() => {
                        if (m.phone) {
                          navigator.clipboard.writeText(`+${m.phone}`)
                          if (notify) notify(`+${m.phone} कॉपी हुआ`)
                        }
                      }}
                      title="नंबर कॉपी करें"
                    >
                      📋 Copy
                    </button>
                  </td>
                </tr>
              )
            })}

            {filtered.length === 0 && (
              <tr>
                <td colSpan={6} style={{ textAlign: 'center', padding: 28, color: '#94a3b8' }}>
                  {searchTerm ? 'सर्च से मेल खाता कोई सदस्य नहीं मिला।' : 'इस ग्रुप में कोई सदस्य नहीं मिला।'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Dropdown Footer */}
      <div className="members-dropdown-footer">
        <span style={{ fontSize: 12, color: 'var(--zd-text-muted, #64748b)' }}>
          कुल {filtered.length} सदस्य दिखाए गए {removeDuplicates ? `(डुप्लीकेट हटाने के बाद)` : ''}
        </span>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            type="button"
            className="btn-action-icon btn-download-excel"
            style={{ fontSize: 12 }}
            onClick={handleExportToExcel}
          >
            📥 Download Excel
          </button>
          <button
            type="button"
            className="btn-action-icon"
            style={{ fontSize: 12 }}
            onClick={onClose}
          >
            Close Dropdown
          </button>
        </div>
      </div>
    </div>
  )
}

export default GroupMembersDropdown
