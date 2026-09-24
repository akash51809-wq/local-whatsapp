import { useState, useEffect, useCallback } from 'react'
import { api } from '../../services/api'
import { useAuth } from '../../context/AuthContext'
import UserPlansPage from '../subscription/UserPlansPage'

const DEFAULT_PLAN_COLORS = [
  { name: 'Soft Blue', hex: '#4f75f2' },
  { name: 'Teal Green', hex: '#00b894' },
  { name: 'Zendash Purple', hex: '#705ec8' },
  { name: 'Warm Orange', hex: '#f77f00' },
  { name: 'Rose Pink', hex: '#e83e8c' },
  { name: 'Ocean Cyan', hex: '#00a8ff' },
]

export default function AdminPlansPage({ notify: propNotify }) {
  const { notify: authNotify } = useAuth()
  const notify = propNotify || authNotify

  const [plans, setPlans] = useState([])
  const [loading, setLoading] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [editingPlan, setEditingPlan] = useState(null)
  const [previewMode, setPreviewMode] = useState(false)
  const [saving, setSaving] = useState(false)
  const [actionLoading, setActionLoading] = useState('')

  const emptyForm = {
    name: '',
    price: 99,
    currency: 'INR',
    description: '',
    dailyLimit: '500/Day',
    validity: '30 Days',
    validityDays: 30,
    deviceLimit: '1 Free + 1 Add-on',
    apiAccess: false,
    webAccess: true,
    bulkMsg: true,
    groupOption: false,
    scheduleMsg: false,
    ipSecurity: false,
    headerColor: '#4f75f2',
    badgeText: '',
    active: true,
    sortOrder: 0
  }

  const [form, setForm] = useState(emptyForm)

  const fetchPlans = useCallback(async () => {
    setLoading(true)
    try {
      const d = await api('/api/admin/plans')
      if (d.success) {
        setPlans(d.plans || [])
      }
    } catch (e) {
      notify('प्लान लोड करने में त्रुटि: ' + e.message)
    } finally {
      setLoading(false)
    }
  }, [notify])

  useEffect(() => {
    fetchPlans()
  }, [fetchPlans])

  const openCreateModal = () => {
    setEditingPlan(null)
    setForm({
      ...emptyForm,
      sortOrder: plans.length + 1
    })
    setShowModal(true)
  }

  const openEditModal = (p) => {
    setEditingPlan(p)
    setForm({
      name: p.name || '',
      price: p.price ?? 99,
      currency: p.currency || 'INR',
      description: p.description || '',
      dailyLimit: p.dailyLimit || '500/Day',
      validity: p.validity || '30 Days',
      validityDays: p.validityDays ?? 30,
      deviceLimit: p.deviceLimit || '1 Free + 1 Add-on',
      apiAccess: Boolean(p.apiAccess),
      webAccess: p.webAccess !== undefined ? Boolean(p.webAccess) : true,
      bulkMsg: Boolean(p.bulkMsg),
      groupOption: Boolean(p.groupOption),
      scheduleMsg: Boolean(p.scheduleMsg),
      ipSecurity: Boolean(p.ipSecurity),
      headerColor: p.headerColor || '#4f75f2',
      badgeText: p.badgeText || '',
      active: p.active !== undefined ? Boolean(p.active) : true,
      sortOrder: p.sortOrder ?? 0
    })
    setShowModal(true)
  }

  const handleSave = async (e) => {
    e.preventDefault()
    if (!form.name.trim()) return notify('कृपया Plan Name भरें।')
    if (form.price === '' || isNaN(form.price) || Number(form.price) < 0) return notify('कृपया वैध Price भरें।')

    setSaving(true)
    try {
      if (editingPlan) {
        const d = await api(`/api/admin/plans/${editingPlan.planId}`, {
          method: 'PUT',
          body: JSON.stringify(form)
        })
        if (d.success) {
          notify(`Plan '${form.name}' सफलतापूर्वक अपडेट किया गया!`)
          setShowModal(false)
          fetchPlans()
        }
      } else {
        const d = await api('/api/admin/plans', {
          method: 'POST',
          body: JSON.stringify(form)
        })
        if (d.success) {
          notify(`नया Plan '${form.name}' सफलतापूर्वक बनाया गया!`)
          setShowModal(false)
          fetchPlans()
        }
      }
    } catch (e) {
      notify('एरर: ' + e.message)
    } finally {
      setSaving(false)
    }
  }

  const togglePlanActive = async (p) => {
    setActionLoading(p.planId)
    try {
      const d = await api(`/api/admin/plans/${p.planId}`, {
        method: 'PUT',
        body: JSON.stringify({ active: !p.active })
      })
      if (d.success) {
        notify(`Plan '${p.name}' को ${!p.active ? 'सक्रिय (Active)' : 'निष्क्रिय (Inactive)'} कर दिया गया।`)
        setPlans(prev => prev.map(item => item.planId === p.planId ? { ...item, active: !p.active } : item))
      }
    } catch (e) {
      notify('Status update error: ' + e.message)
    } finally {
      setActionLoading('')
    }
  }

  const handleDeletePlan = async (p) => {
    if (!window.confirm(`क्या आप वाकई Plan '${p.name}' को हटाना चाहते हैं?`)) return
    setActionLoading(p.planId)
    try {
      const d = await api(`/api/admin/plans/${p.planId}`, { method: 'DELETE' })
      if (d.success) {
        notify(`Plan '${p.name}' हटा दिया गया है।`)
        setPlans(prev => prev.filter(item => item.planId !== p.planId))
      }
    } catch (e) {
      notify('Delete error: ' + e.message)
    } finally {
      setActionLoading('')
    }
  }

  return (
    <section className="admin-plans-page">
      {/* Page Header */}
      <div className="page-header d-flex flex-wrap align-items-center justify-content-between mb-4">
        <div>
          <h1 className="page-title mb-1" style={{ fontSize: 24, fontWeight: 700, color: 'inherit' }}>
            🏷️ Plan Management
          </h1>
          <ol className="breadcrumb mb-0" style={{ background: 'transparent', padding: 0, fontSize: 13 }}>
            <li className="breadcrumb-item text-muted">Admin</li>
            <li className="breadcrumb-item active text-primary">Plans &amp; Subscriptions</li>
          </ol>
        </div>
        <div className="d-flex align-items-center gap-2 mt-2 mt-md-0" style={{ gap: 10 }}>
          <button 
            type="button" 
            className="btn btn-outline-primary"
            onClick={() => setPreviewMode(!previewMode)}
            style={{ borderRadius: 8, padding: '8px 16px', fontWeight: 600, fontSize: 13 }}
          >
            {previewMode ? '⚙️ Admin List View' : '👁️ Preview User Pricing Table'}
          </button>
          <button 
            type="button" 
            className="btn btn-primary"
            onClick={openCreateModal}
            style={{ borderRadius: 8, padding: '8px 18px', fontWeight: 700, fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <span>➕</span> Create New Plan
          </button>
        </div>
      </div>

      {previewMode ? (
        <div className="card shadow-sm mb-4" style={{ borderRadius: 16 }}>
          <div className="card-header d-flex align-items-center justify-content-between" style={{ padding: '16px 20px' }}>
            <div>
              <h5 className="card-title mb-0" style={{ fontSize: 16, fontWeight: 700 }}>
                👁️ User Pricing Table Live Preview
              </h5>
              <small className="text-muted">This is exactly how users see the comparison table on their portal.</small>
            </div>
            <button 
              type="button" 
              className="btn btn-sm btn-white" 
              onClick={() => setPreviewMode(false)}
              style={{ borderRadius: 6, fontSize: 12 }}
            >
              Close Preview
            </button>
          </div>
          <div className="card-body p-3">
            <UserPlansPage currentUser={{ plan: 'Startup' }} notify={notify} isPreview={true} />
          </div>
        </div>
      ) : (
        <>
          {/* Stats Bar */}
          <div className="row row-cards mb-4">
            <div className="col-sm-6 col-lg-3">
              <div className="card p-3" style={{ borderRadius: 12 }}>
                <div className="d-flex align-items-center">
                  <span className="stamp stamp-md bg-primary-transparent text-primary mr-3" style={{ marginRight: 14, fontSize: 20, width: 44, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 10, background: 'rgba(79, 117, 242, 0.12)' }}>
                    🏷️
                  </span>
                  <div>
                    <h4 className="m-0 font-weight-bold" style={{ fontSize: 20 }}>{plans.length}</h4>
                    <small className="text-muted">Total Configured Plans</small>
                  </div>
                </div>
              </div>
            </div>
            <div className="col-sm-6 col-lg-3">
              <div className="card p-3" style={{ borderRadius: 12 }}>
                <div className="d-flex align-items-center">
                  <span className="stamp stamp-md bg-success-transparent text-success mr-3" style={{ marginRight: 14, fontSize: 20, width: 44, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 10, background: 'rgba(45, 206, 137, 0.12)' }}>
                    ✓
                  </span>
                  <div>
                    <h4 className="m-0 font-weight-bold" style={{ fontSize: 20 }}>{plans.filter(p => p.active).length}</h4>
                    <small className="text-muted">Active in User Panel</small>
                  </div>
                </div>
              </div>
            </div>
            <div className="col-sm-6 col-lg-3">
              <div className="card p-3" style={{ borderRadius: 12 }}>
                <div className="d-flex align-items-center">
                  <span className="stamp stamp-md bg-info-transparent text-info mr-3" style={{ marginRight: 14, fontSize: 20, width: 44, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 10, background: 'rgba(0, 168, 255, 0.12)' }}>
                    ₹
                  </span>
                  <div>
                    <h4 className="m-0 font-weight-bold" style={{ fontSize: 20 }}>
                      ₹{plans.length ? Math.min(...plans.map(p => p.price)) : 0}
                    </h4>
                    <small className="text-muted">Starting Base Price</small>
                  </div>
                </div>
              </div>
            </div>
            <div className="col-sm-6 col-lg-3">
              <div className="card p-3" style={{ borderRadius: 12 }}>
                <div className="d-flex align-items-center">
                  <span className="stamp stamp-md bg-warning-transparent text-warning mr-3" style={{ marginRight: 14, fontSize: 20, width: 44, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 10, background: 'rgba(255, 171, 0, 0.12)' }}>
                    ⚙️
                  </span>
                  <div>
                    <h4 className="m-0 font-weight-bold" style={{ fontSize: 20 }}>11 Fields</h4>
                    <small className="text-muted">Full Parameter Control</small>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Plans Table & Cards */}
          <div className="card shadow-sm" style={{ borderRadius: 16 }}>
            <div className="card-header d-flex align-items-center justify-content-between" style={{ padding: '16px 20px', borderBottom: '1px solid var(--zd-border, rgba(0,0,0,0.06))' }}>
              <div>
                <h5 className="card-title mb-0" style={{ fontSize: 16, fontWeight: 700 }}>All Subscription Plans</h5>
                <small className="text-muted">Manage plan prices, message limits, validity, and feature toggles.</small>
              </div>
              <button 
                type="button" 
                className="btn btn-sm btn-outline-secondary" 
                onClick={fetchPlans}
                disabled={loading}
                style={{ borderRadius: 8 }}
              >
                ↻ Refresh
              </button>
            </div>

            <div className="card-body p-0">
              {loading ? (
                <div style={{ textAlign: 'center', padding: '60px 20px', color: '#6b7280' }}>
                  <div className="spinner-border text-primary mb-2" role="status"></div>
                  <div>योजनाएं लोड हो रही हैं (Loading plans)...</div>
                </div>
              ) : plans.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '60px 20px' }}>
                  <div style={{ fontSize: 36, marginBottom: 12 }}>🏷️</div>
                  <h4 style={{ fontWeight: 700 }}>अभी कोई प्लान नहीं बना है</h4>
                  <p className="text-muted mb-3">Create your first subscription plan with limits and features.</p>
                  <button type="button" className="btn btn-primary" onClick={openCreateModal}>
                    ➕ Create First Plan
                  </button>
                </div>
              ) : (
                <div className="table-responsive">
                  <table className="table card-table table-vcenter text-nowrap mb-0" style={{ borderCollapse: 'separate', borderSpacing: 0 }}>
                    <thead>
                      <tr style={{ background: 'var(--zd-card-bg, #f8fafc)', borderBottom: '1px solid var(--zd-border, #eef2f6)' }}>
                        <th style={{ width: 40, textAlign: 'center', fontWeight: 700 }}>#</th>
                        <th style={{ fontWeight: 700 }}>Plan Name &amp; Banner</th>
                        <th style={{ fontWeight: 700 }}>Price &amp; Validity</th>
                        <th style={{ fontWeight: 700 }}>Limits</th>
                        <th style={{ fontWeight: 700 }}>Key Capabilities</th>
                        <th style={{ fontWeight: 700, textAlign: 'center' }}>Status</th>
                        <th style={{ fontWeight: 700, textAlign: 'right', paddingRight: 24 }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {plans.map((p, idx) => (
                        <tr key={p.planId || idx}>
                          <td style={{ textAlign: 'center', fontWeight: 600, color: 'var(--zd-text-muted, #64748b)' }}>
                            {idx + 1}
                          </td>
                          <td>
                            <div className="d-flex align-items-center" style={{ gap: 12 }}>
                              <span 
                                style={{ 
                                  width: 14, 
                                  height: 38, 
                                  borderRadius: 4, 
                                  background: p.headerColor || '#4f75f2',
                                  display: 'inline-block',
                                  flexShrink: 0
                                }} 
                              />
                              <div>
                                <div className="d-flex align-items-center" style={{ gap: 8 }}>
                                  <strong style={{ fontSize: 15, color: 'inherit' }}>{p.name}</strong>
                                  {p.badgeText && (
                                    <span className="badge badge-warning" style={{ fontSize: 10, padding: '2px 6px', fontWeight: 700 }}>
                                      {p.badgeText}
                                    </span>
                                  )}
                                </div>
                                <small className="text-muted" style={{ display: 'block', maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                  {p.description || 'No description'}
                                </small>
                              </div>
                            </div>
                          </td>
                          <td>
                            <div>
                              <span style={{ fontSize: 16, fontWeight: 700, color: '#10b981' }}>
                                ₹{p.price}
                              </span>
                              <span className="text-muted" style={{ fontSize: 12, marginLeft: 4 }}>
                                / {p.validity || `${p.validityDays} Days`}
                              </span>
                            </div>
                            <small className="text-muted" style={{ fontSize: 11 }}>
                              Currency: {p.currency || 'INR'}
                            </small>
                          </td>
                          <td>
                            <div style={{ fontSize: 12, lineHeight: 1.6 }}>
                              <div><strong>Daily:</strong> <span className="badge badge-primary-light" style={{ padding: '2px 6px' }}>{p.dailyLimit}</span></div>
                              <div><strong>Devices:</strong> <span className="badge badge-info-light" style={{ padding: '2px 6px' }}>{p.deviceLimit}</span></div>
                            </div>
                          </td>
                          <td>
                            <div className="d-flex flex-wrap gap-1" style={{ gap: 4, maxWidth: 260 }}>
                              <span className={`badge ${p.apiAccess ? 'badge-success-light' : 'badge-light text-muted'}`} style={{ fontSize: 10 }}>
                                {p.apiAccess ? '✓ API' : '✕ API'}
                              </span>
                              <span className={`badge ${p.webAccess ? 'badge-success-light' : 'badge-light text-muted'}`} style={{ fontSize: 10 }}>
                                {p.webAccess ? '✓ Web' : '✕ Web'}
                              </span>
                              <span className={`badge ${p.bulkMsg ? 'badge-success-light' : 'badge-light text-muted'}`} style={{ fontSize: 10 }}>
                                {p.bulkMsg ? '✓ Bulk' : '✕ Bulk'}
                              </span>
                              <span className={`badge ${p.groupOption ? 'badge-success-light' : 'badge-light text-muted'}`} style={{ fontSize: 10 }}>
                                {p.groupOption ? '✓ Group' : '✕ Group'}
                              </span>
                              <span className={`badge ${p.scheduleMsg ? 'badge-success-light' : 'badge-light text-muted'}`} style={{ fontSize: 10 }}>
                                {p.scheduleMsg ? '✓ Schedule' : '✕ Schedule'}
                              </span>
                              <span className={`badge ${p.ipSecurity ? 'badge-success-light' : 'badge-light text-muted'}`} style={{ fontSize: 10 }}>
                                {p.ipSecurity ? '✓ IP Sec' : '✕ IP Sec'}
                              </span>
                            </div>
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            <button
                              type="button"
                              className={`btn btn-sm ${p.active ? 'btn-success-light' : 'btn-outline-secondary'}`}
                              onClick={() => togglePlanActive(p)}
                              disabled={actionLoading === p.planId}
                              style={{ borderRadius: 20, padding: '3px 12px', fontSize: 11, fontWeight: 700 }}
                              title="Click to toggle status"
                            >
                              {p.active ? '✓ Active' : '✕ Inactive'}
                            </button>
                          </td>
                          <td style={{ textAlign: 'right', paddingRight: 20 }}>
                            <div className="d-inline-flex gap-1" style={{ gap: 6 }}>
                              <button
                                type="button"
                                className="btn btn-sm btn-outline-primary"
                                onClick={() => openEditModal(p)}
                                style={{ borderRadius: 6, padding: '4px 10px', fontSize: 12 }}
                              >
                                ✏️ Edit
                              </button>
                              <button
                                type="button"
                                className="btn btn-sm btn-outline-danger"
                                onClick={() => handleDeletePlan(p)}
                                disabled={actionLoading === p.planId}
                                style={{ borderRadius: 6, padding: '4px 10px', fontSize: 12 }}
                              >
                                🗑️ Delete
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* CREATE / EDIT PLAN MODAL */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div 
            className="modal-content-card" 
            onClick={e => e.stopPropagation()} 
            style={{ maxWidth: 680, width: '92%', borderRadius: 16, maxHeight: '90vh', overflowY: 'auto' }}
          >
            <div className="modal-header d-flex align-items-center justify-content-between" style={{ padding: '16px 24px', borderBottom: '1px solid var(--zd-border, #eef2f6)' }}>
              <div>
                <h5 className="modal-title font-weight-bold m-0" style={{ fontSize: 17, color: 'inherit' }}>
                  {editingPlan ? `✏️ Edit Plan: ${editingPlan.name}` : '➕ Create New Subscription Plan'}
                </h5>
                <small className="text-muted">Configure all 11 plan parameters, pricing, and visual styling.</small>
              </div>
              <button 
                type="button" 
                onClick={() => setShowModal(false)}
                style={{ background: 'none', border: 'none', fontSize: 24, cursor: 'pointer', color: '#8a98ac', lineHeight: 1 }}
              >
                ×
              </button>
            </div>

            <form onSubmit={handleSave}>
              <div className="modal-body" style={{ padding: '22px 24px' }}>
                {/* 1 & 2: Plan Name and Price */}
                <div className="row g-3 mb-3">
                  <div className="col-md-7">
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 700, marginBottom: 6 }}>
                      Plan Name (प्लान का नाम) *
                    </label>
                    <input 
                      type="text" 
                      className="form-control" 
                      value={form.name}
                      onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                      placeholder="e.g. Startup, Business, Enterprise, Pro"
                      required
                      style={{ height: 42, borderRadius: 8 }}
                    />
                  </div>
                  <div className="col-md-5">
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 700, marginBottom: 6 }}>
                      Price (कीमत INR में) *
                    </label>
                    <div className="input-group">
                      <span className="input-group-text" style={{ borderRadius: '8px 0 0 8px', fontWeight: 700 }}>₹</span>
                      <input 
                        type="number" 
                        className="form-control" 
                        value={form.price}
                        onChange={e => setForm(f => ({ ...f, price: e.target.value }))}
                        placeholder="e.g. 99"
                        min="0"
                        required
                        style={{ height: 42, borderRadius: '0 8px 8px 0' }}
                      />
                    </div>
                  </div>
                </div>

                {/* 3 & 4: Daily Msg Limit and Validity */}
                <div className="row g-3 mb-3">
                  <div className="col-md-6">
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 700, marginBottom: 6 }}>
                      Daily Message Limit (प्रतिदिन संदेश सीमा) *
                    </label>
                    <input 
                      type="text" 
                      className="form-control" 
                      value={form.dailyLimit}
                      onChange={e => setForm(f => ({ ...f, dailyLimit: e.target.value }))}
                      placeholder="e.g. 500/Day, 1000/Day, Unlimited"
                      required
                      style={{ height: 42, borderRadius: 8 }}
                    />
                  </div>
                  <div className="col-md-6">
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 700, marginBottom: 6 }}>
                      Validity Display (वैधता) *
                    </label>
                    <input 
                      type="text" 
                      className="form-control" 
                      value={form.validity}
                      onChange={e => setForm(f => ({ ...f, validity: e.target.value }))}
                      placeholder="e.g. 30 Days, 365 Days, Lifetime"
                      required
                      style={{ height: 42, borderRadius: 8 }}
                    />
                  </div>
                </div>

                {/* 5: Device Limit & Validity in Days */}
                <div className="row g-3 mb-3">
                  <div className="col-md-6">
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 700, marginBottom: 6 }}>
                      Device Limit (डिवाइस सीमा) *
                    </label>
                    <input 
                      type="text" 
                      className="form-control" 
                      value={form.deviceLimit}
                      onChange={e => setForm(f => ({ ...f, deviceLimit: e.target.value }))}
                      placeholder="e.g. 1 Free + 1 Add-on, 1 Device"
                      required
                      style={{ height: 42, borderRadius: 8 }}
                    />
                  </div>
                  <div className="col-md-6">
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 700, marginBottom: 6 }}>
                      Validity in Days (सिस्टम गणना हेतु दिन)
                    </label>
                    <input 
                      type="number" 
                      className="form-control" 
                      value={form.validityDays}
                      onChange={e => setForm(f => ({ ...f, validityDays: Number(e.target.value) || 30 }))}
                      placeholder="30"
                      min="1"
                      style={{ height: 42, borderRadius: 8 }}
                    />
                  </div>
                </div>

                {/* Tagline / Description */}
                <div className="form-group mb-3">
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 700, marginBottom: 6 }}>
                    Description / Subtitle (योजना का विवरण/टैगलाइन)
                  </label>
                  <input 
                    type="text" 
                    className="form-control" 
                    value={form.description}
                    onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                    placeholder="e.g. Send message to contacts only / Received message webhook support"
                    style={{ height: 42, borderRadius: 8 }}
                  />
                </div>

                {/* Color and Badge */}
                <div className="row g-3 mb-4">
                  <div className="col-md-7">
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 700, marginBottom: 6 }}>
                      Header Banner Theme Color (कलर थीम)
                    </label>
                    <div className="d-flex align-items-center gap-2" style={{ gap: 8 }}>
                      <input 
                        type="color" 
                        value={form.headerColor} 
                        onChange={e => setForm(f => ({ ...f, headerColor: e.target.value }))}
                        style={{ width: 44, height: 42, padding: 2, border: '1px solid #d0d7de', borderRadius: 8, cursor: 'pointer' }}
                      />
                      <div className="d-flex flex-wrap gap-1" style={{ gap: 6 }}>
                        {DEFAULT_PLAN_COLORS.map(c => (
                          <button
                            key={c.hex}
                            type="button"
                            onClick={() => setForm(f => ({ ...f, headerColor: c.hex }))}
                            style={{
                              width: 26,
                              height: 26,
                              borderRadius: '50%',
                              background: c.hex,
                              border: form.headerColor === c.hex ? '2px solid #000' : '1px solid rgba(0,0,0,0.15)',
                              cursor: 'pointer',
                              padding: 0
                            }}
                            title={c.name}
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="col-md-5">
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 700, marginBottom: 6 }}>
                      Badge Text (बैज जैसे POPULAR, BEST)
                    </label>
                    <input 
                      type="text" 
                      className="form-control" 
                      value={form.badgeText}
                      onChange={e => setForm(f => ({ ...f, badgeText: e.target.value }))}
                      placeholder="e.g. POPULAR, RECOMMENDED"
                      style={{ height: 42, borderRadius: 8 }}
                    />
                  </div>
                </div>

                {/* 6 to 11: Feature Toggles */}
                <div className="card p-3 mb-3" style={{ borderRadius: 12, background: 'var(--zd-border-subtle, rgba(0,0,0,0.02))', border: '1px solid var(--zd-border, #eef2f6)' }}>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 700, marginBottom: 12, color: 'inherit' }}>
                    ⚡ Feature Access &amp; Capabilities (सुविधाएं चालू / बंद करें)
                  </label>
                  <div className="row g-3">
                    <div className="col-sm-6">
                      <label className="custom-control custom-checkbox d-flex align-items-center" style={{ gap: 8, cursor: 'pointer', margin: 0 }}>
                        <input 
                          type="checkbox" 
                          checked={form.apiAccess}
                          onChange={e => setForm(f => ({ ...f, apiAccess: e.target.checked }))}
                        />
                        <span style={{ fontSize: 13, fontWeight: 600 }}>6. API Access</span>
                      </label>
                      <small className="text-muted d-block" style={{ marginLeft: 22, fontSize: 11 }}>REST API &amp; Webhook support</small>
                    </div>

                    <div className="col-sm-6">
                      <label className="custom-control custom-checkbox d-flex align-items-center" style={{ gap: 8, cursor: 'pointer', margin: 0 }}>
                        <input 
                          type="checkbox" 
                          checked={form.webAccess}
                          onChange={e => setForm(f => ({ ...f, webAccess: e.target.checked }))}
                        />
                        <span style={{ fontSize: 13, fontWeight: 600 }}>7. Web Access for Send Msg</span>
                      </label>
                      <small className="text-muted d-block" style={{ marginLeft: 22, fontSize: 11 }}>Web UI direct message portal</small>
                    </div>

                    <div className="col-sm-6">
                      <label className="custom-control custom-checkbox d-flex align-items-center" style={{ gap: 8, cursor: 'pointer', margin: 0 }}>
                        <input 
                          type="checkbox" 
                          checked={form.bulkMsg}
                          onChange={e => setForm(f => ({ ...f, bulkMsg: e.target.checked }))}
                        />
                        <span style={{ fontSize: 13, fontWeight: 600 }}>8. Send Bulk Msg</span>
                      </label>
                      <small className="text-muted d-block" style={{ marginLeft: 22, fontSize: 11 }}>Excel upload and bulk campaigns</small>
                    </div>

                    <div className="col-sm-6">
                      <label className="custom-control custom-checkbox d-flex align-items-center" style={{ gap: 8, cursor: 'pointer', margin: 0 }}>
                        <input 
                          type="checkbox" 
                          checked={form.groupOption}
                          onChange={e => setForm(f => ({ ...f, groupOption: e.target.checked }))}
                        />
                        <span style={{ fontSize: 13, fontWeight: 600 }}>9. Group Option</span>
                      </label>
                      <small className="text-muted d-block" style={{ marginLeft: 22, fontSize: 11 }}>Send message to WhatsApp groups</small>
                    </div>

                    <div className="col-sm-6">
                      <label className="custom-control custom-checkbox d-flex align-items-center" style={{ gap: 8, cursor: 'pointer', margin: 0 }}>
                        <input 
                          type="checkbox" 
                          checked={form.scheduleMsg}
                          onChange={e => setForm(f => ({ ...f, scheduleMsg: e.target.checked }))}
                        />
                        <span style={{ fontSize: 13, fontWeight: 600 }}>10. Send Schedule Msg</span>
                      </label>
                      <small className="text-muted d-block" style={{ marginLeft: 22, fontSize: 11 }}>Scheduled broadcast queues</small>
                    </div>

                    <div className="col-sm-6">
                      <label className="custom-control custom-checkbox d-flex align-items-center" style={{ gap: 8, cursor: 'pointer', margin: 0 }}>
                        <input 
                          type="checkbox" 
                          checked={form.ipSecurity}
                          onChange={e => setForm(f => ({ ...f, ipSecurity: e.target.checked }))}
                        />
                        <span style={{ fontSize: 13, fontWeight: 600 }}>11. IP Security</span>
                      </label>
                      <small className="text-muted d-block" style={{ marginLeft: 22, fontSize: 11 }}>IP Whitelisting &amp; rate protection</small>
                    </div>
                  </div>
                </div>

                {/* Status & Sort Order */}
                <div className="row g-3">
                  <div className="col-6">
                    <label className="custom-control custom-checkbox d-flex align-items-center" style={{ gap: 8, cursor: 'pointer', marginTop: 8 }}>
                      <input 
                        type="checkbox" 
                        checked={form.active}
                        onChange={e => setForm(f => ({ ...f, active: e.target.checked }))}
                      />
                      <span style={{ fontSize: 13, fontWeight: 700 }}>Plan Active (सक्रिय रखें)</span>
                    </label>
                  </div>
                  <div className="col-6">
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 700, marginBottom: 4 }}>
                      Display Sort Order
                    </label>
                    <input 
                      type="number" 
                      className="form-control" 
                      value={form.sortOrder}
                      onChange={e => setForm(f => ({ ...f, sortOrder: Number(e.target.value) || 0 }))}
                      style={{ height: 38, borderRadius: 8 }}
                    />
                  </div>
                </div>
              </div>

              <div className="modal-footer d-flex justify-content-end gap-2" style={{ padding: '14px 24px', borderTop: '1px solid var(--zd-border, #eef2f6)', gap: 10 }}>
                <button 
                  type="button" 
                  className="btn btn-outline-secondary" 
                  onClick={() => setShowModal(false)}
                  style={{ borderRadius: 8, padding: '8px 16px', fontWeight: 600 }}
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="btn btn-primary"
                  disabled={saving}
                  style={{ borderRadius: 8, padding: '8px 22px', fontWeight: 700 }}
                >
                  {saving ? '⏳ Saving Plan...' : (editingPlan ? '💾 Update Plan' : '➕ Create Plan')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  )
}
