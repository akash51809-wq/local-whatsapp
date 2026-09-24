import React, { useState } from 'react'
import * as XLSX from 'xlsx'

export function GroupMembersModal({ group, onClose, notify }) {
  const [searchTerm, setSearchTerm] = useState('')
  const [copied, setCopied] = useState(false)

  if (!group) return null

  const participants = group.participants || []
  const filtered = participants.filter(p => {
    const term = searchTerm.toLowerCase()
    return (p.phone && p.phone.includes(term)) || (p.role && p.role.toLowerCase().includes(term))
  })

  const copyAllNumbers = () => {
    const phones = participants.map(p => p.phone).filter(Boolean)
    if (phones.length === 0) return
    navigator.clipboard.writeText(phones.join(', '))
    setCopied(true)
    if (notify) notify(`${phones.length} नंबर्स क्लिपबोर्ड पर कॉपी हो गए`)
    setTimeout(() => setCopied(false), 2000)
  }

  const exportToExcel = () => {
    try {
      const rows = participants.map((p, idx) => ({
        'S.No': idx + 1,
        'Phone Number': p.phone ? `+${p.phone}` : '',
        'Role': p.role || 'Member',
        'Is Admin': p.isAdmin ? 'Yes' : 'No'
      }))
      const ws = XLSX.utils.json_to_sheet(rows)
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, 'Participants')
      const fileName = `${(group.subject || 'group').replace(/[^a-zA-Z0-9_-]/g, '_')}_members.xlsx`
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
              {group.dp ? (
                <img src={group.dp} alt="DP" className="group-avatar-img" />
              ) : (
                <div className="group-avatar-placeholder">👥</div>
              )}
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: 16 }}>{group.subject || 'Unnamed Group'}</h3>
              <p style={{ margin: 0, fontSize: 12, color: '#64748b' }}>
                कुल {participants.length} सदस्य (Participants) • ID: <code style={{ fontSize: 11 }}>{group.id}</code>
              </p>
            </div>
          </div>
          <button type="button" onClick={onClose}>×</button>
        </div>

        <div className="modal-body">
          <div style={{ display: 'flex', gap: 10, marginBottom: 14, flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
            <input 
              type="text" 
              placeholder="🔍 नंबर या रोल से खोजें..." 
              value={searchTerm} 
              onChange={e => setSearchTerm(e.target.value)}
              style={{ maxWidth: 260, margin: 0 }}
            />
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="button" className="btn-action-icon" onClick={copyAllNumbers} title="Copy All Numbers">
                {copied ? '✓ कॉपी हुआ' : '📋 Copy All Numbers'}
              </button>
              <button type="button" className="btn-action-icon" onClick={exportToExcel} title="Download Excel">
                📥 Export Excel
              </button>
            </div>
          </div>

          <div className="group-members-list-container">
            <table className="groups-table">
              <thead>
                <tr>
                  <th style={{ width: 40 }}>#</th>
                  <th>मोबाइल नंबर (Phone)</th>
                  <th>रोल (Role)</th>
                  <th style={{ textAlign: 'right' }}>एक्शन</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((p, idx) => (
                  <tr key={p.id || idx}>
                    <td style={{ color: '#64748b' }}>{idx + 1}</td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontWeight: 600 }}>+{p.phone}</span>
                      </div>
                    </td>
                    <td>
                      <span className={`badge ${p.isSuperAdmin ? 'badge-purple' : p.isAdmin ? 'badge-primary' : 'badge-secondary'}`}>
                        {p.isSuperAdmin ? '👑 Super Admin' : p.isAdmin ? '🛡️ Admin' : '👤 Member'}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <button 
                        type="button" 
                        className="btn-action-icon"
                        style={{ fontSize: 11, padding: '4px 8px' }}
                        onClick={() => {
                          navigator.clipboard.writeText(p.phone)
                          if (notify) notify(`नंबर +${p.phone} कॉपी हुआ`)
                        }}
                      >
                        📋 Copy
                      </button>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={4} style={{ textAlign: 'center', padding: 24, color: '#94a3b8' }}>
                      कोई सदस्य नहीं मिला।
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="modal-footer">
          <button type="button" className="btn-action-icon" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  )
}

export default GroupMembersModal
