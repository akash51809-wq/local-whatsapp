import React, { useState, useMemo } from 'react'
import * as XLSX from 'xlsx'

export function GroupMembersModal({ group, groups: propGroups, onClose, notify }) {
  const [searchTerm, setSearchTerm] = useState('')
  const [removeDuplicates, setRemoveDuplicates] = useState(false)
  const [copied, setCopied] = useState(false)

  // Normalize groups input: either single group or array of groups
  const groupsList = useMemo(() => {
    if (Array.isArray(propGroups) && propGroups.length > 0) return propGroups
    if (group) return [group]
    return []
  }, [group, propGroups])

  if (groupsList.length === 0) return null

  // Flatten participants
  const rawMembers = useMemo(() => {
    const list = []
    groupsList.forEach(g => {
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
          groupSubject: g.subject || 'Unnamed Group'
        })
      })
    })
    return list
  }, [groupsList])

  // Track phone occurrences for duplicate detection
  const phoneGroupMap = useMemo(() => {
    const map = new Map()
    rawMembers.forEach(m => {
      if (!m.phone) return
      if (!map.has(m.phone)) map.set(m.phone, [])
      map.get(m.phone).push(m.groupSubject)
    })
    return map
  }, [rawMembers])

  const duplicateCount = useMemo(() => {
    let dups = 0
    phoneGroupMap.forEach(grps => {
      if (grps.length > 1) dups += (grps.length - 1)
    })
    return dups
  }, [phoneGroupMap])

  const uniqueCount = phoneGroupMap.size

  // Apply remove duplicates if active
  const displayList = useMemo(() => {
    if (!removeDuplicates) return rawMembers
    const seen = new Set()
    const res = []
    rawMembers.forEach(m => {
      if (!m.phone) {
        res.push(m)
        return
      }
      if (!seen.has(m.phone)) {
        seen.add(m.phone)
        res.push(m)
      }
    })
    return res
  }, [rawMembers, removeDuplicates])

  // Search filter
  const filtered = useMemo(() => {
    const term = searchTerm.trim().toLowerCase()
    return displayList.filter(p => {
      return !term ||
        (p.phone && p.phone.includes(term)) ||
        (p.role && p.role.toLowerCase().includes(term)) ||
        (p.groupSubject && p.groupSubject.toLowerCase().includes(term))
    })
  }, [displayList, searchTerm])

  const toggleRemoveDuplicates = () => {
    const nextState = !removeDuplicates
    setRemoveDuplicates(nextState)
    if (nextState) {
      if (notify) notify(`✓ ${duplicateCount} डुप्लीकेट नंबर्स हटा दिए गए! (${uniqueCount} यूनिक नंबर्स बचे)`)
    } else {
      if (notify) notify('सभी मेंबर्स (डुप्लीकेट सहित) पुनः दिखाए जा रहे हैं।')
    }
  }

  const copyAllNumbers = () => {
    const phones = Array.from(new Set(filtered.map(p => p.phone).filter(Boolean)))
    if (phones.length === 0) return
    navigator.clipboard.writeText(phones.map(p => `+${p}`).join(', '))
    setCopied(true)
    if (notify) notify(`${phones.length} नंबर्स क्लिपबोर्ड पर कॉपी हो गए`)
    setTimeout(() => setCopied(false), 2000)
  }

  const exportToExcel = () => {
    try {
      const rows = filtered.map((p, idx) => ({
        'S.No': idx + 1,
        'Phone Number': p.phone ? `+${p.phone}` : '',
        'Role': p.role || 'Member',
        'Group Name': p.groupSubject,
        'Group ID': p.groupId,
        'Is Admin': p.isAdmin ? 'Yes' : 'No',
        'In Multiple Groups': (phoneGroupMap.get(p.phone)?.length > 1) ? `Yes (${phoneGroupMap.get(p.phone)?.length} groups)` : 'No'
      }))
      const ws = XLSX.utils.json_to_sheet(rows)
      ws['!cols'] = [
        { wch: 6 },
        { wch: 18 },
        { wch: 14 },
        { wch: 28 },
        { wch: 34 },
        { wch: 10 },
        { wch: 20 }
      ]
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, 'Participants')

      let fileName = ''
      if (groupsList.length === 1) {
        fileName = `${(groupsList[0].subject || 'group').replace(/[^a-zA-Z0-9_-]/g, '_')}_members.xlsx`
      } else {
        fileName = `Combined_${groupsList.length}_Groups_Members_${removeDuplicates ? 'Unique_' : ''}${Date.now().toString().slice(-4)}.xlsx`
      }
      XLSX.writeFile(wb, fileName)
      if (notify) notify('एक्सेल फ़ाइल डाउनलोड हो गई!')
    } catch (e) {
      if (notify) notify('एक्सपोर्ट एरर: ' + e.message)
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card modal-large" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div className="group-avatar-wrapper">
              {groupsList.length === 1 && groupsList[0].dp ? (
                <img src={groupsList[0].dp} alt="DP" className="group-avatar-img" />
              ) : (
                <div className="group-avatar-placeholder">👥</div>
              )}
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: 16 }}>
                {groupsList.length === 1 ? (groupsList[0].subject || 'Unnamed Group') : `${groupsList.length} ग्रुप्स के सदस्य`}
              </h3>
              <p style={{ margin: 0, fontSize: 12, color: '#64748b' }}>
                कुल {rawMembers.length} सदस्य • यूनिक: {uniqueCount} {duplicateCount > 0 ? `• डुप्लीकेट्स: ${duplicateCount}` : ''}
              </p>
            </div>
          </div>
          <button type="button" onClick={onClose}>×</button>
        </div>

        <div className="modal-body">
          <div style={{ display: 'flex', gap: 10, marginBottom: 14, flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
            <input 
              type="text" 
              placeholder="🔍 नंबर, रोल या ग्रुप से खोजें..." 
              value={searchTerm} 
              onChange={e => setSearchTerm(e.target.value)}
              style={{ maxWidth: 260, margin: 0 }}
            />
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button
                type="button"
                className={`btn-action-icon btn-remove-dups ${removeDuplicates ? 'active' : ''}`}
                onClick={toggleRemoveDuplicates}
                title="डुप्लीकेट नंबर हटाएं"
              >
                {removeDuplicates ? `↩️ Undo Remove Dups (${duplicateCount})` : `🧹 Remove Duplicates ${duplicateCount > 0 ? `(${duplicateCount})` : ''}`}
              </button>
              <button type="button" className="btn-action-icon btn-download-excel" onClick={exportToExcel} title="Download Excel">
                📥 Export Excel
              </button>
              <button type="button" className="btn-action-icon" onClick={copyAllNumbers} title="Copy All Numbers">
                {copied ? '✓ कॉपी हुआ' : '📋 Copy All'}
              </button>
            </div>
          </div>

          <div className="group-members-list-container">
            <table className="groups-table">
              <thead>
                <tr>
                  <th style={{ width: 40 }}>#</th>
                  <th>मोबाइल नंबर (Phone)</th>
                  {groupsList.length > 1 && <th>ग्रुप नाम</th>}
                  <th>रोल (Role)</th>
                  <th style={{ width: 110, textAlign: 'center' }}>डुप्लीकेट</th>
                  <th style={{ textAlign: 'right' }}>एक्शन</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((p, idx) => {
                  const occurrences = phoneGroupMap.get(p.phone)?.length || 1
                  const isDup = occurrences > 1
                  return (
                    <tr key={`${p.groupId}_${p.id || idx}`} className={isDup && !removeDuplicates ? 'row-duplicate-notice' : ''}>
                      <td style={{ color: '#64748b' }}>{idx + 1}</td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontWeight: 600 }}>+{p.phone}</span>
                        </div>
                      </td>
                      {groupsList.length > 1 && (
                        <td style={{ fontSize: 12 }}>{p.groupSubject}</td>
                      )}
                      <td>
                        <span className={`badge ${p.isSuperAdmin ? 'badge-purple' : p.isAdmin ? 'badge-primary' : 'badge-secondary'}`}>
                          {p.isSuperAdmin ? '👑 Super Admin' : p.isAdmin ? '🛡️ Admin' : '👤 Member'}
                        </span>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        {isDup ? (
                          <span className="badge badge-warning" style={{ fontSize: 10 }}>
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
                          style={{ fontSize: 11, padding: '4px 8px' }}
                          onClick={() => {
                            navigator.clipboard.writeText(`+${p.phone}`)
                            if (notify) notify(`नंबर +${p.phone} कॉपी हुआ`)
                          }}
                        >
                          📋 Copy
                        </button>
                      </td>
                    </tr>
                  )
                })}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={groupsList.length > 1 ? 6 : 5} style={{ textAlign: 'center', padding: 24, color: '#94a3b8' }}>
                      कोई सदस्य नहीं मिला।
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="modal-footer">
          <span style={{ fontSize: 12, color: '#64748b', marginRight: 'auto' }}>
            कुल {filtered.length} सदस्य दिखाए गए
          </span>
          <button type="button" className="btn-action-icon" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  )
}

export default GroupMembersModal
