import { useState, useEffect, useCallback, useMemo } from 'react'
import * as XLSX from 'xlsx'
import { api } from '../../services/api'
import { useAuth } from '../../context/AuthContext'

export default function UsersPage({ notify: propNotify }) {
  const { notify: authNotify } = useAuth()
  const notify = propNotify || authNotify

  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [waFilter, setWaFilter] = useState('all')
  const [editingUser, setEditingUser] = useState(null)
  const [editForm, setEditForm] = useState({ name: '', mobile: '', plan: 'Standard', role: 'user', status: 'active' })
  const [savingEdit, setSavingEdit] = useState(false)
  const [actionLoading, setActionLoading] = useState('')
  const [sentNotice, setSentNotice] = useState(null)

  const fetchUsers = useCallback(async () => {
    setLoading(true)
    try {
      const d = await api('/api/admin/users')
      if (d.success) {
        setUsers(d.users || [])
      }
    } catch (e) {
      notify('उपयोगकर्ता लोड करने में त्रुटि: ' + e.message)
    } finally {
      setLoading(false)
    }
  }, [notify])

  useEffect(() => {
    fetchUsers()
  }, [fetchUsers])

  const toggleStatus = async (u) => {
    setActionLoading(u.userId)
    try {
      const d = await api(`/api/admin/users/${u.userId}/toggle-status`, { method: 'POST' })
      if (d.success) {
        notify(`User ${u.name || u.userId} is now ${d.status}`)
        setUsers(prev => prev.map(item => item.userId === u.userId ? { ...item, status: d.status } : item))
      }
    } catch (e) {
      notify('Status update failed: ' + e.message)
    } finally {
      setActionLoading('')
    }
  }

  const sendPassword = async (u) => {
    const confirmSend = window.confirm(`क्या आप यूजर ${u.name || u.userId} (${u.mobile || u.username}) के लिए नया पासवर्ड जेनरेट करके उनके WhatsApp पर भेजना चाहते हैं?`)
    if (!confirmSend) return

    setActionLoading('pwd-' + u.userId)
    try {
      const d = await api(`/api/admin/users/${u.userId}/send-password`, { method: 'POST' })
      if (d.success) {
        setSentNotice({ userId: u.userId, mobile: u.mobile || u.username, newPassword: d.newPassword })
        notify(`नया पासवर्ड ${u.mobile || u.username} के WhatsApp पर भेज दिया गया है!`)
      }
    } catch (e) {
      notify('पासवर्ड भेजने में त्रुटि: ' + e.message)
    } finally {
      setActionLoading('')
    }
  }

  const openEdit = (u) => {
    setEditingUser(u)
    setEditForm({
      name: u.name || '',
      mobile: u.mobile || u.username || '',
      plan: u.plan || 'Standard',
      role: u.role || 'user',
      status: u.status || 'active'
    })
  }

  const saveEdit = async (e) => {
    e.preventDefault()
    if (!editingUser) return
    setSavingEdit(true)
    try {
      const d = await api(`/api/admin/users/${editingUser.userId}`, {
        method: 'PUT',
        body: JSON.stringify(editForm)
      })
      if (d.success) {
        notify('User profile updated successfully!')
        setUsers(prev => prev.map(item => item.userId === editingUser.userId ? { ...item, ...editForm } : item))
        setEditingUser(null)
      }
    } catch (e) {
      notify('Update failed: ' + e.message)
    } finally {
      setSavingEdit(false)
    }
  }

  const filteredUsers = useMemo(() => {
    return users.filter(u => {
      const term = search.toLowerCase().trim()
      const matchesSearch = !term || (
        (u.name && u.name.toLowerCase().includes(term)) ||
        (u.userId && u.userId.toLowerCase().includes(term)) ||
        (u.username && u.username.toLowerCase().includes(term)) ||
        (u.mobile && u.mobile.toLowerCase().includes(term))
      )
      const matchesStatus = statusFilter === 'all' || u.status === statusFilter
      const matchesWa = waFilter === 'all' || (
        waFilter === 'connected' ? u.whatsappStatus === 'connected' :
        waFilter === 'waiting' ? (u.whatsappStatus === 'waiting' || u.whatsappStatus === 'connecting') :
        (u.whatsappStatus === 'disconnected' || !u.whatsappStatus)
      )
      return matchesSearch && matchesStatus && matchesWa
    })
  }, [users, search, statusFilter, waFilter])

  const downloadExcel = () => {
    if (!filteredUsers || filteredUsers.length === 0) {
      notify('डाउनलोड करने के लिए कोई उपयोगकर्ता उपलब्ध नहीं है (No users to export)')
      return
    }
    try {
      const exportData = filteredUsers.map((u, i) => ({
        '#': i + 1,
        'User ID': u.userId || '',
        'Full Name': u.name || u.username || 'N/A',
        'Mobile Number': u.mobile || u.username || '',
        'Role': (u.role || 'user').toUpperCase(),
        'Subscription Plan': u.plan || 'Standard',
        'Account Status': u.status === 'active' ? 'Active' : 'Inactive',
        'WhatsApp Status': u.whatsappStatus === 'connected' ? 'Connected' : (u.whatsappStatus === 'waiting' || u.whatsappStatus === 'connecting') ? 'Waiting Scan' : 'Disconnected',
        'WhatsApp Phone': u.whatsappPhone ? `+${u.whatsappPhone}` : (u.whatsappStatus === 'connected' ? `+${u.mobile || ''}` : 'N/A'),
        'Joined Date': u.createdAt ? new Date(u.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : 'N/A'
      }))

      const ws = XLSX.utils.json_to_sheet(exportData)
      ws['!cols'] = [
        { wch: 6 },
        { wch: 16 },
        { wch: 24 },
        { wch: 18 },
        { wch: 12 },
        { wch: 20 },
        { wch: 16 },
        { wch: 18 },
        { wch: 20 },
        { wch: 18 },
      ]
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, 'Users_List')
      const today = new Date().toISOString().slice(0, 10)
      XLSX.writeFile(wb, `zendash_users_list_${today}.xlsx`)
      notify('✓ Users list downloaded as Excel (.xlsx)!')
    } catch (err) {
      notify('Excel export error: ' + err.message)
    }
  }

  const avatarPalettes = [
    'linear-gradient(135deg, #705ec8, #9b88f8)',
    'linear-gradient(135deg, #fb1c52, #f96387)',
    'linear-gradient(135deg, #2dce89, #48e5a3)',
    'linear-gradient(135deg, #1170e4, #5398f5)',
    'linear-gradient(135deg, #f7b731, #fbd37a)',
    'linear-gradient(135deg, #0d9488, #2dd4bf)',
    'linear-gradient(135deg, #e83e8c, #f37ba9)',
  ]

  return (
    <section className="page-user-management">
      {/* Compact User Management Toolbar (3 Filters left-to-right + Download Excel & Refresh buttons + Count) */}
      <div className="users-compact-toolbar mb-2">
        <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 w-100">
          {/* Left: 3 Compact Filters + Actions */}
          <div className="d-flex flex-wrap align-items-center gap-2">
            {/* Filter 1: Search Box */}
            <div style={{ position: 'relative', width: 200, minWidth: 150 }}>
              <svg 
                width="13" 
                height="13" 
                viewBox="0 0 24 24" 
                fill="none" 
                stroke="#8fa0b2" 
                strokeWidth="2" 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}
              >
                <circle cx="11" cy="11" r="8"></circle>
                <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
              </svg>
              <input 
                type="text" 
                className="form-control filter-control"
                placeholder="Search user, mobile, ID..." 
                value={search} 
                onChange={e => setSearch(e.target.value)}
                style={{ paddingLeft: 27, paddingRight: search ? 24 : 8, height: 32, fontSize: '0.8rem' }}
              />
              {search && (
                <button 
                  onClick={() => setSearch('')}
                  style={{ position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)', border: 'none', background: 'transparent', color: '#9ca3af', cursor: 'pointer', fontSize: 13, padding: 0 }}
                  title="Clear search"
                >
                  ×
                </button>
              )}
            </div>

            {/* Filter 2: Account Status */}
            <select 
              className="form-control filter-control filter-select" 
              value={statusFilter} 
              onChange={e => setStatusFilter(e.target.value)}
              style={{ height: 32, width: 'auto', minWidth: 130, cursor: 'pointer', fontSize: '0.8rem' }}
            >
              <option value="all">Account: All</option>
              <option value="active">Active Only (सक्रिय)</option>
              <option value="inactive">Inactive Only (निष्क्रिय)</option>
            </select>

            {/* Filter 3: WhatsApp Status */}
            <select 
              className="form-control filter-control filter-select" 
              value={waFilter} 
              onChange={e => setWaFilter(e.target.value)}
              style={{ height: 32, width: 'auto', minWidth: 140, cursor: 'pointer', fontSize: '0.8rem' }}
            >
              <option value="all">WhatsApp: All</option>
              <option value="connected">Connected 🟢</option>
              <option value="waiting">Waiting Scan 🟡</option>
              <option value="disconnected">Not Connected ⚪</option>
            </select>

            {/* Download Excel Button */}
            <button 
              className="btn btn-outline-primary"
              onClick={downloadExcel}
              title="Download Users List to Excel (.xlsx)"
              style={{ height: 32, padding: '0 10px', fontSize: '0.78rem' }}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                <polyline points="7 10 12 15 17 10"></polyline>
                <line x1="12" y1="15" x2="12" y2="3"></line>
              </svg>
              <span>Download Excel</span>
            </button>

            {/* Refresh Button */}
            <button 
              className="btn btn-primary"
              onClick={fetchUsers}
              disabled={loading}
              title="Refresh Users List"
              style={{ height: 32, padding: '0 10px', fontSize: '0.78rem' }}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={loading ? 'spin-icon' : ''}>
                <polyline points="23 4 23 10 17 10"></polyline>
                <polyline points="1 20 1 14 7 14"></polyline>
                <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
              </svg>
              <span>{loading ? 'Refreshing...' : 'Refresh'}</span>
            </button>
          </div>

          {/* Right: Showing Counter */}
          <div className="text-muted" style={{ fontSize: '0.78rem', fontWeight: 600, whiteSpace: 'nowrap' }}>
            Showing <strong style={{ color: '#705ec8' }}>{filteredUsers.length}</strong> of {users.length} Users
          </div>
        </div>
      </div>

      {/* Temporary Password Notice Alert */}
      {sentNotice && (
        <div className="alert alert-success d-flex align-items-center justify-content-between mb-2 p-2 px-3" style={{ borderRadius: 8, border: '1px solid #7ae0bd', background: '#e9f8f2', color: '#055b44', fontSize: '0.82rem' }}>
          <div>
            ✓ <strong>Password Sent to WhatsApp!</strong> User <strong>{sentNotice.mobile}</strong> ({sentNotice.userId}) को नया पासवर्ड भेज दिया गया है। 
            Temporary Password: <code style={{ background: '#fff', padding: '2px 8px', borderRadius: 4, border: '1px solid #7ae0bd', fontWeight: 'bold', color: '#0d835f', marginLeft: 6 }}>{sentNotice.newPassword}</code>
          </div>
          <button onClick={() => setSentNotice(null)} style={{ background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: '#055b44', fontWeight: 700 }}>×</button>
        </div>
      )}

      {/* Compact Users Table Card */}
      <div className="users-table-card">
        <div className="table-responsive">
          <table className="users-table-compact table-hover">
            <thead>
              <tr>
                <th style={{ width: 36, textAlign: 'center' }}>#</th>
                <th style={{ minWidth: 160 }}>User</th>
                <th style={{ minWidth: 160 }}>Mobile / WhatsApp</th>
                <th style={{ minWidth: 105 }}>Joined</th>
                <th style={{ minWidth: 130 }}>Plan / Performance</th>
                <th style={{ minWidth: 80 }}>Status</th>
                <th style={{ minWidth: 140, textAlign: 'center' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: '24px 16px', color: '#6b7280' }}>
                    <div className="spinner-border spinner-border-sm text-primary" role="status" style={{ marginRight: 8, display: 'inline-block' }}></div>
                    उपयोगकर्ता लोड हो रहे हैं (Loading users)...
                  </td>
                </tr>
              ) : filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: '24px 16px', color: '#6b7280' }}>
                    <div style={{ fontSize: 22, marginBottom: 4 }}>🔍</div>
                    <strong style={{ display: 'block', fontSize: 13, color: 'var(--text-main, #282f53)' }}>कोई उपयोगकर्ता नहीं मिला</strong>
                    <span style={{ fontSize: 12, color: 'var(--text-muted, #8fa0b2)' }}>No users found matching your search or filters.</span>
                  </td>
                </tr>
              ) : (
                filteredUsers.map((u, index) => {
                  const avatarLetter = (u.name || u.username || 'U')[0].toUpperCase()
                  const avatarBg = avatarPalettes[index % avatarPalettes.length]
                  const perfPercent = u.status === 'active' ? (u.whatsappStatus === 'connected' ? 85 : 50) : 15

                  return (
                    <tr key={u.userId || u._id}>
                      {/* # */}
                      <td style={{ textAlign: 'center', color: '#8fa0b2', fontWeight: 600, fontSize: 12 }}>
                        {index + 1}
                      </td>

                      {/* User */}
                      <td>
                        <div className="d-flex align-items-center" style={{ gap: 8 }}>
                          <span 
                            className="avatar-compact"
                            style={{ background: avatarBg }}
                          >
                            {avatarLetter}
                          </span>
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontWeight: 600, color: 'var(--text-main, #282f53)', fontSize: '0.82rem', lineHeight: 1.2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {u.name || u.username || 'No Name'}
                            </div>
                            <div className="d-flex align-items-center gap-1" style={{ marginTop: 2 }}>
                              <span className="text-muted" style={{ fontFamily: 'monospace', fontSize: 10 }}>
                                {u.userId}
                              </span>
                              <span className={`badge ${u.role === 'admin' ? 'badge-primary-light' : 'badge-secondary-light'}`} style={{ fontSize: 9, padding: '1px 5px', lineHeight: 1 }}>
                                {u.role || 'user'}
                              </span>
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Mobile / WhatsApp */}
                      <td>
                        <div style={{ fontWeight: 600, color: 'var(--text-main, #282f53)', fontSize: '0.8rem', lineHeight: 1.2 }}>
                          +91 {u.mobile || u.username}
                        </div>
                        <div style={{ marginTop: 2 }}>
                          {u.whatsappStatus === 'connected' ? (
                            <span className="badge badge-success-light d-inline-flex align-items-center" style={{ fontSize: 10, padding: '1px 6px', lineHeight: 1.2 }}>
                              <span className="dot-label bg-success" style={{ width: 5, height: 5, marginRight: 4 }}></span>
                              Connected {u.whatsappPhone ? `(+${u.whatsappPhone})` : ''}
                            </span>
                          ) : u.whatsappStatus === 'connecting' || u.whatsappStatus === 'waiting' ? (
                            <span className="badge badge-warning-light d-inline-flex align-items-center" style={{ fontSize: 10, padding: '1px 6px', lineHeight: 1.2 }}>
                              <span className="dot-label bg-warning" style={{ width: 5, height: 5, marginRight: 4 }}></span>
                              Waiting Scan
                            </span>
                          ) : (
                            <span className="badge badge-danger-light d-inline-flex align-items-center" style={{ fontSize: 10, padding: '1px 6px', lineHeight: 1.2 }}>
                              <span className="dot-label bg-danger" style={{ width: 5, height: 5, marginRight: 4 }}></span>
                              Not Connected
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Joined Date */}
                      <td style={{ fontSize: '0.78rem', color: 'var(--text-muted, #505d69)', whiteSpace: 'nowrap' }}>
                        {u.createdAt ? new Date(u.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : 'N/A'}
                      </td>

                      {/* Plan / Performance */}
                      <td>
                        <div className="d-flex align-items-center justify-content-between" style={{ marginBottom: 2 }}>
                          <span className="badge badge-primary-light font-weight-bold" style={{ fontSize: 10, padding: '1px 5px', lineHeight: 1 }}>
                            {u.plan || 'Standard'}
                          </span>
                          <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted, #505d69)' }}>{perfPercent}%</span>
                        </div>
                        <div className="progress progress-sm" style={{ height: 4, borderRadius: 6, background: '#f0f2f7', minWidth: 70 }}>
                          <div 
                            className={`progress-bar ${perfPercent >= 70 ? 'bg-primary' : perfPercent >= 40 ? 'bg-warning' : 'bg-danger'}`} 
                            style={{ 
                              width: `${perfPercent}%`,
                              borderRadius: 6,
                              background: perfPercent >= 70 ? '#705ec8' : perfPercent >= 40 ? '#f59e0b' : '#ef4444'
                            }}
                          ></div>
                        </div>
                      </td>

                      {/* Account Status */}
                      <td>
                        {u.status === 'active' ? (
                          <span className="badge badge-success-light" style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, lineHeight: 1.2 }}>
                            Active
                          </span>
                        ) : (
                          <span className="badge badge-danger-light" style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, lineHeight: 1.2 }}>
                            Inactive
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td style={{ textAlign: 'center' }}>
                        <div className="d-inline-flex align-items-center justify-content-center gap-1">
                          <button 
                            className="btn btn-white btn-table-action" 
                            type="button" 
                            onClick={() => openEdit(u)}
                            title="Edit profile"
                            style={{ border: '1px solid var(--border-color, #e1e7ee)', color: 'var(--text-main, #282f53)' }}
                          >
                            Edit
                          </button>
                          <button 
                            className={`btn btn-table-action ${u.status === 'active' ? 'btn-outline-danger' : 'btn-outline-success'}`}
                            type="button" 
                            onClick={() => toggleStatus(u)}
                            disabled={actionLoading === u.userId}
                            title={u.status === 'active' ? 'Deactivate user account' : 'Activate user account'}
                          >
                            {actionLoading === u.userId ? '...' : u.status === 'active' ? 'Deactivate' : 'Activate'}
                          </button>
                          <button 
                            className="btn btn-outline-primary btn-table-action"
                            type="button" 
                            onClick={() => sendPassword(u)}
                            disabled={actionLoading === 'pwd-' + u.userId}
                            title="Send new random password to user WhatsApp"
                          >
                            {actionLoading === 'pwd-' + u.userId ? '...' : '🔑 Pwd'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Zendash Edit User Modal */}
      {editingUser && (
        <div className="modal-overlay" onClick={() => setEditingUser(null)}>
          <div className="modal-content-card" onClick={e => e.stopPropagation()} style={{ maxWidth: 520, borderRadius: 16 }}>
            <div className="modal-header" style={{ padding: '16px 22px', borderBottom: '1px solid #eef2f6' }}>
              <h5 className="modal-title font-weight-bold" style={{ margin: 0, fontSize: 16, color: 'var(--text-main, #282f53)' }}>
                Edit User: {editingUser.name || editingUser.userId}
              </h5>
              <button 
                type="button" 
                onClick={() => setEditingUser(null)}
                style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#8a98ac', fontWeight: 600 }}
              >
                ×
              </button>
            </div>
            <form onSubmit={saveEdit}>
              <div className="modal-body" style={{ padding: 22 }}>
                <div className="form-group mb-3">
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#334455', marginBottom: 6 }}>
                    Full Name (नाम)
                  </label>
                  <input 
                    type="text" 
                    className="form-control"
                    value={editForm.name} 
                    onChange={e => setEditForm(prev => ({ ...prev, name: e.target.value }))} 
                    placeholder="Enter full name"
                    style={{ height: 40, borderRadius: 8, border: '1px solid var(--border-color, #d4dce4)', width: '100%', padding: '8px 12px' }}
                  />
                </div>
                <div className="form-group mb-3">
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#334455', marginBottom: 6 }}>
                    WhatsApp Mobile Number
                  </label>
                  <input 
                    type="text" 
                    className="form-control"
                    value={editForm.mobile} 
                    onChange={e => setEditForm(prev => ({ ...prev, mobile: e.target.value }))} 
                    placeholder="10 digit mobile"
                    style={{ height: 40, borderRadius: 8, border: '1px solid var(--border-color, #d4dce4)', width: '100%', padding: '8px 12px' }}
                  />
                </div>
                <div className="row g-2 mb-3">
                  <div className="col-6">
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#334455', marginBottom: 6 }}>
                      Subscription Plan
                    </label>
                    <select 
                      className="form-control"
                      value={editForm.plan} 
                      onChange={e => setEditForm(prev => ({ ...prev, plan: e.target.value }))}
                      style={{ height: 40, borderRadius: 8, border: '1px solid var(--border-color, #d4dce4)', width: '100%', padding: '8px 12px' }}
                    >
                      <option value="Free">Free (मुफ़्त)</option>
                      <option value="Starter">Starter</option>
                      <option value="Standard">Standard</option>
                      <option value="Pro">Pro</option>
                      <option value="Enterprise">Enterprise</option>
                    </select>
                  </div>
                  <div className="col-6">
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#334455', marginBottom: 6 }}>
                      Role
                    </label>
                    <select 
                      className="form-control"
                      value={editForm.role} 
                      onChange={e => setEditForm(prev => ({ ...prev, role: e.target.value }))}
                      style={{ height: 40, borderRadius: 8, border: '1px solid var(--border-color, #d4dce4)', width: '100%', padding: '8px 12px' }}
                    >
                      <option value="user">User</option>
                      <option value="admin">Admin</option>
                    </select>
                  </div>
                </div>
                <div className="form-group mb-2">
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#334455', marginBottom: 6 }}>
                    Account Status
                  </label>
                  <select 
                    className="form-control"
                    value={editForm.status} 
                    onChange={e => setEditForm(prev => ({ ...prev, status: e.target.value }))}
                    style={{ height: 40, borderRadius: 8, border: '1px solid var(--border-color, #d4dce4)', width: '100%', padding: '8px 12px' }}
                  >
                    <option value="active">Active (सक्रिय)</option>
                    <option value="inactive">Inactive (निष्क्रिय)</option>
                  </select>
                </div>
              </div>
              <div className="modal-footer" style={{ padding: '14px 22px', background: 'var(--header-bg, #f8fafc)', borderTop: '1px solid #eef2f6', display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                <button 
                  type="button" 
                  className="btn btn-white"
                  onClick={() => setEditingUser(null)}
                  style={{ border: '1px solid var(--border-color, #d6dee6)', borderRadius: 8, padding: '7px 16px', fontSize: 13, fontWeight: 600 }}
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="btn btn-primary"
                  disabled={savingEdit}
                  style={{ borderRadius: 8, padding: '7px 20px', fontSize: 13, fontWeight: 600 }}
                >
                  {savingEdit ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  )
}
