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
      {/* Zendash Page Header */}
      <div className="page-header d-flex flex-wrap align-items-center justify-content-between mb-4">
        <div className="page-leftheader">
          <h4 className="page-title mb-1 font-weight-bold" style={{ fontSize: '1.35rem', color: 'var(--text-main, #282f53)' }}>User List</h4>
          <ol className="breadcrumb mb-0" style={{ background: 'transparent', padding: 0, fontSize: '0.82rem' }}>
            <li className="breadcrumb-item"><a href="#apps" onClick={e => e.preventDefault()} style={{ color: '#705ec8' }}>Apps</a></li>
            <li className="breadcrumb-item"><a href="#users" onClick={e => e.preventDefault()} style={{ color: '#705ec8' }}>User List</a></li>
            <li className="breadcrumb-item active" style={{ color: 'var(--text-muted, #68798b)' }}>User List 01</li>
          </ol>
        </div>
        <div className="page-rightheader d-flex align-items-center gap-2 mt-2 mt-sm-0">
          <button 
            className="btn btn-outline-primary d-inline-flex align-items-center"
            onClick={downloadExcel}
            title="Download Users List to Excel (.xlsx)"
            style={{ fontWeight: 600 }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 6 }}>
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
              <polyline points="7 10 12 15 17 10"></polyline>
              <line x1="12" y1="15" x2="12" y2="3"></line>
            </svg>
            Download Excel
          </button>
          <button 
            className="btn btn-primary d-inline-flex align-items-center"
            onClick={fetchUsers}
            disabled={loading}
            title="Refresh Users List"
            style={{ fontWeight: 600 }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={loading ? 'spin-icon' : ''} style={{ marginRight: 6 }}>
              <polyline points="23 4 23 10 17 10"></polyline>
              <polyline points="1 20 1 14 7 14"></polyline>
              <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
            </svg>
            {loading ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>
      </div>

      {/* Filter Toolbar Card */}
      <div className="card mb-4" style={{ borderRadius: 12, border: '1px solid var(--border-color, #ebecf1)', boxShadow: '0 4px 20px 0 rgba(160, 175, 208, 0.1)' }}>
        <div className="card-body p-3">
          <div className="row align-items-center g-3" style={{ rowGap: 12 }}>
            {/* Search Box */}
            <div className="col-lg-5 col-md-6 col-12">
              <div className="users-search-box" style={{ position: 'relative' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#8fa0b2" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>
                  <circle cx="11" cy="11" r="8"></circle>
                  <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                </svg>
                <input 
                  type="text" 
                  className="form-control"
                  placeholder="Search by name, mobile, user ID..." 
                  value={search} 
                  onChange={e => setSearch(e.target.value)}
                  style={{ paddingLeft: 38, paddingRight: search ? 32 : 12, height: 42, borderRadius: 8, border: '1px solid var(--border-color, #d5dce4)', fontSize: '0.875rem' }}
                />
                {search && (
                  <button 
                    onClick={() => setSearch('')}
                    style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', border: 'none', background: 'transparent', color: '#9ca3af', cursor: 'pointer', fontSize: 16 }}
                    title="Clear search"
                  >
                    ×
                  </button>
                )}
              </div>
            </div>

            {/* Filter Account Status */}
            <div className="col-lg-3 col-md-3 col-6">
              <select 
                className="form-control filter-select" 
                value={statusFilter} 
                onChange={e => setStatusFilter(e.target.value)}
                style={{ height: 42, borderRadius: 8, border: '1px solid var(--border-color, #d5dce4)', fontSize: '0.85rem' }}
              >
                <option value="all">Account: All Status (सभी)</option>
                <option value="active">Active Only (सक्रिय)</option>
                <option value="inactive">Inactive Only (निष्क्रिय)</option>
              </select>
            </div>

            {/* Filter WhatsApp Status */}
            <div className="col-lg-2 col-md-3 col-6">
              <select 
                className="form-control filter-select" 
                value={waFilter} 
                onChange={e => setWaFilter(e.target.value)}
                style={{ height: 42, borderRadius: 8, border: '1px solid var(--border-color, #d5dce4)', fontSize: '0.85rem' }}
              >
                <option value="all">WhatsApp: All</option>
                <option value="connected">Connected 🟢</option>
                <option value="waiting">Waiting Scan 🟡</option>
                <option value="disconnected">Not Connected ⚪</option>
              </select>
            </div>

            {/* Stats Counter & Reset */}
            <div className="col-lg-2 col-md-12 col-12 d-flex align-items-center justify-content-lg-end justify-content-between">
              <div className="text-muted" style={{ fontSize: '0.85rem', fontWeight: 600 }}>
                Showing <span style={{ color: '#705ec8', fontWeight: 700 }}>{filteredUsers.length}</span> of {users.length} Users
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Temporary Password Notice Alert */}
      {sentNotice && (
        <div className="alert alert-success d-flex align-items-center justify-content-between mb-4 p-3" style={{ borderRadius: 10, border: '1px solid #7ae0bd', background: '#e9f8f2', color: '#055b44' }}>
          <div>
            ✓ <strong>Password Sent to WhatsApp!</strong> User <strong>{sentNotice.mobile}</strong> ({sentNotice.userId}) को नया पासवर्ड भेज दिया गया है। 
            Temporary Password: <code style={{ background: '#fff', padding: '2px 8px', borderRadius: 4, border: '1px solid #7ae0bd', fontWeight: 'bold', color: '#0d835f', marginLeft: 6 }}>{sentNotice.newPassword}</code>
          </div>
          <button onClick={() => setSentNotice(null)} style={{ background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: '#055b44', fontWeight: 700 }}>×</button>
        </div>
      )}

      {/* Zendash users-list-1.html Table Layout */}
      <div className="row">
        <div className="col-12">
          <div className="row flex-lg-nowrap">
            <div className="col-12 mb-3">
              <div className="e-panel card" style={{ borderRadius: 12, border: '1px solid var(--border-color, #ebecf1)', boxShadow: '0 4px 20px 0 rgba(160, 175, 208, 0.12)' }}>
                <div className="card-body">
                  <div className="e-table">
                    <div className="table-responsive table-lg mt-3">
                      <table className="table table-bordered border-top text-nowrap mb-0" id="example1">
                        <thead>
                          <tr style={{ background: 'var(--header-bg, #f8fafc)', color: 'var(--text-muted, #505d69)' }}>
                            <th className="align-top border-bottom-0 wd-5 text-center" style={{ width: '45px' }}>#</th>
                            <th className="border-bottom-0 w-20">User</th>
                            <th className="border-bottom-0 w-20">Mobile / WhatsApp</th>
                            <th className="border-bottom-0 w-15">Date of joining</th>
                            <th className="border-bottom-0 w-20">Performance</th>
                            <th className="border-bottom-0 w-10">Account Status</th>
                            <th className="border-bottom-0 w-15 text-center">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {loading ? (
                            <tr>
                              <td colSpan={7} style={{ textAlign: 'center', padding: '48px 20px', color: '#6b7280' }}>
                                <div className="spinner-border spinner-border-sm text-primary" role="status" style={{ marginRight: 8, display: 'inline-block' }}></div>
                                उपयोगकर्ता लोड हो रहे हैं (Loading registered users)...
                              </td>
                            </tr>
                          ) : filteredUsers.length === 0 ? (
                            <tr>
                              <td colSpan={7} style={{ textAlign: 'center', padding: '48px 20px', color: '#6b7280' }}>
                                <div style={{ fontSize: 28, marginBottom: 8 }}>🔍</div>
                                <strong style={{ display: 'block', fontSize: 15, color: 'var(--text-main, #282f53)' }}>कोई उपयोगकर्ता नहीं मिला</strong>
                                <span style={{ fontSize: 13, color: 'var(--text-muted, #8fa0b2)' }}>No users found matching your search or filters.</span>
                              </td>
                            </tr>
                          ) : (
                            filteredUsers.map((u, index) => {
                              const avatarLetter = (u.name || u.username || 'U')[0].toUpperCase()
                              const avatarBg = avatarPalettes[index % avatarPalettes.length]
                              const perfPercent = u.status === 'active' ? (u.whatsappStatus === 'connected' ? 85 : 50) : 15

                              return (
                                <tr key={u.userId || u._id}>
                                  <td className="align-middle text-center text-muted font-weight-bold" style={{ fontSize: 13 }}>
                                    {index + 1}
                                  </td>
                                  <td className="align-middle">
                                    <div className="d-flex align-items-center">
                                      <span 
                                        className="avatar brround avatar-md d-inline-flex align-items-center justify-content-center text-white font-weight-bold flex-shrink-0"
                                        style={{ background: avatarBg, boxShadow: '0 2px 6px rgba(0,0,0,0.12)' }}
                                      >
                                        {avatarLetter}
                                      </span>
                                      <div className="ml-3 mt-1" style={{ marginLeft: 12 }}>
                                        <h6 className="mb-0 font-weight-bold" style={{ color: 'var(--text-main, #282f53)', fontSize: 14 }}>
                                          {u.name || u.username || 'No Name'}
                                        </h6>
                                        <div className="d-flex align-items-center gap-1 mt-1">
                                          <small className="text-muted" style={{ fontFamily: 'monospace', fontSize: 11 }}>
                                            {u.userId}
                                          </small>
                                          <span className={`badge ${u.role === 'admin' ? 'badge-primary-light' : 'badge-secondary-light'}`} style={{ fontSize: 10, padding: '2px 6px', marginLeft: 4 }}>
                                            {u.role || 'user'}
                                          </span>
                                        </div>
                                      </div>
                                    </div>
                                  </td>
                                  <td className="align-middle">
                                    <div className="font-weight-bold" style={{ color: 'var(--text-main, #282f53)', fontSize: 13 }}>
                                      +91 {u.mobile || u.username}
                                    </div>
                                    <div className="mt-1">
                                      {u.whatsappStatus === 'connected' ? (
                                        <span className="badge badge-success-light d-inline-flex align-items-center" style={{ fontSize: 11, padding: '3px 8px' }}>
                                          <span className="dot-label bg-success" style={{ width: 6, height: 6, borderRadius: '50%', background: '#22c55e', display: 'inline-block', marginRight: 6 }}></span>
                                          Connected {u.whatsappPhone ? `(+${u.whatsappPhone})` : ''}
                                        </span>
                                      ) : u.whatsappStatus === 'connecting' || u.whatsappStatus === 'waiting' ? (
                                        <span className="badge badge-warning-light d-inline-flex align-items-center" style={{ fontSize: 11, padding: '3px 8px' }}>
                                          <span className="dot-label bg-warning" style={{ width: 6, height: 6, borderRadius: '50%', background: '#f59e0b', display: 'inline-block', marginRight: 6 }}></span>
                                          Waiting Scan
                                        </span>
                                      ) : (
                                        <span className="badge badge-danger-light d-inline-flex align-items-center" style={{ fontSize: 11, padding: '3px 8px' }}>
                                          <span className="dot-label bg-danger" style={{ width: 6, height: 6, borderRadius: '50%', background: '#ef4444', display: 'inline-block', marginRight: 6 }}></span>
                                          Not Connected
                                        </span>
                                      )}
                                    </div>
                                  </td>
                                  <td className="text-nowrap align-middle">
                                    <span style={{ fontSize: 13, color: 'var(--text-muted, #505d69)' }}>
                                      {u.createdAt ? new Date(u.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : 'N/A'}
                                    </span>
                                  </td>
                                  <td className="text-nowrap align-middle">
                                    <div className="d-flex align-items-center justify-content-between mb-1">
                                      <span className="badge badge-primary-light font-weight-bold" style={{ fontSize: 11 }}>
                                        {u.plan || 'Standard'}
                                      </span>
                                      <h6 className="mb-0 font-weight-bold" style={{ fontSize: 12, color: 'var(--text-muted, #505d69)' }}>{perfPercent}%</h6>
                                    </div>
                                    <div className="progress progress-sm mb-0 mt-1" style={{ height: 6, borderRadius: 10, background: '#f0f2f7' }}>
                                      <div 
                                        className={`progress-bar ${perfPercent >= 70 ? 'bg-primary' : perfPercent >= 40 ? 'bg-warning' : 'bg-danger'}`} 
                                        style={{ 
                                          width: `${perfPercent}%`,
                                          borderRadius: 10,
                                          background: perfPercent >= 70 ? '#705ec8' : perfPercent >= 40 ? '#f59e0b' : '#ef4444'
                                        }}
                                      ></div>
                                    </div>
                                  </td>
                                  <td className="align-middle">
                                    {u.status === 'active' ? (
                                      <span className="badge badge-success-light" style={{ fontSize: 12, padding: '4px 10px', borderRadius: 6 }}>
                                        Active
                                      </span>
                                    ) : (
                                      <span className="badge badge-danger-light" style={{ fontSize: 12, padding: '4px 10px', borderRadius: 6 }}>
                                        Inactive
                                      </span>
                                    )}
                                  </td>
                                  <td className="align-middle text-center">
                                    <div className="btn-group align-top" role="group">
                                      <button 
                                        className="btn btn-sm btn-white btn-svg" 
                                        type="button" 
                                        onClick={() => openEdit(u)}
                                        title="Edit profile"
                                        style={{ border: '1px solid var(--border-color, #e1e7ee)', color: 'var(--text-main, #282f53)', fontSize: 12, fontWeight: 600, padding: '4px 10px' }}
                                      >
                                        Edit
                                      </button>
                                      <button 
                                        className={`btn btn-sm ${u.status === 'active' ? 'btn-outline-danger' : 'btn-outline-success'}`}
                                        type="button" 
                                        onClick={() => toggleStatus(u)}
                                        disabled={actionLoading === u.userId}
                                        title={u.status === 'active' ? 'Deactivate user account' : 'Activate user account'}
                                        style={{ fontSize: 12, fontWeight: 600, padding: '4px 10px', marginLeft: 4 }}
                                      >
                                        {actionLoading === u.userId ? '...' : u.status === 'active' ? 'Deactivate' : 'Activate'}
                                      </button>
                                      <button 
                                        className="btn btn-sm btn-outline-primary"
                                        type="button" 
                                        onClick={() => sendPassword(u)}
                                        disabled={actionLoading === 'pwd-' + u.userId}
                                        title="Send new random password to user WhatsApp"
                                        style={{ fontSize: 12, fontWeight: 600, padding: '4px 10px', marginLeft: 4 }}
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
                </div>
              </div>
            </div>
          </div>
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
