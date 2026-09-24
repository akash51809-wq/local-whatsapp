import React, { useState, useEffect, useCallback, useRef } from 'react'
import { useAuth } from '../../context/AuthContext'
import api from '../../services/api'

export default function SettingsPage({ defaultTab = 'company' }) {
  const { 
    currentUser, 
    isAdmin, 
    notify, 
    status, 
    companySettings, 
    updateCompanySettings 
  } = useAuth()

  const [activeTab, setActiveTab] = useState(defaultTab)

  // Company Settings Form State
  const [form, setForm] = useState({
    companyName: '',
    faviconUrl: '',
    logoUrl: ''
  })
  const [savingCompany, setSavingCompany] = useState(false)
  const [previewTheme, setPreviewTheme] = useState('light') // 'light' or 'dark' for sidebar logo preview

  // System & Security Tab States
  const [info, setInfo] = useState(null)
  const [pingData, setPingData] = useState(null)
  const [pinging, setPinging] = useState(false)
  const [curPass, setCurPass] = useState('')
  const [newPass, setNewPass] = useState('')
  const [passErr, setPassErr] = useState('')
  const [passOk, setPassOk] = useState('')
  const [savingPass, setSavingPass] = useState(false)

  const faviconInputRef = useRef(null)
  const logoInputRef = useRef(null)

  // Sync initial company settings
  useEffect(() => {
    if (companySettings) {
      setForm({
        companyName: companySettings.companyName || '',
        faviconUrl: companySettings.faviconUrl || '',
        logoUrl: companySettings.logoUrl || ''
      })
    }
  }, [companySettings])

  // System info loaders
  const loadPingStatus = useCallback(() => {
    if (!isAdmin) return
    api('/api/system/autoping').then(setPingData).catch(() => {})
  }, [isAdmin])

  useEffect(() => {
    if (isAdmin && activeTab === 'system') {
      api('/api/admin/system-info').then(d => setInfo(d.info)).catch(() => {})
      loadPingStatus()
      const t = setInterval(loadPingStatus, 15000)
      return () => clearInterval(t)
    }
  }, [isAdmin, activeTab, loadPingStatus])

  // Handle image upload with FileReader
  const handleImageFile = (file, type) => {
    if (!file) return
    if (file.size > 5 * 1024 * 1024) {
      notify('इमेज साइज 5MB से कम होना चाहिए (File size must be under 5MB)')
      return
    }
    const reader = new FileReader()
    reader.onload = (e) => {
      const dataUrl = e.target.result
      if (type === 'favicon') {
        setForm(prev => ({ ...prev, faviconUrl: dataUrl }))
        notify('✓ Favicon image uploaded! Click Save to apply.')
      } else if (type === 'logo') {
        setForm(prev => ({ ...prev, logoUrl: dataUrl }))
        notify('✓ Logo image uploaded! Click Save to apply.')
      }
    }
    reader.readAsDataURL(file)
  }

  // Save Company Settings
  const saveCompanySettings = async (e) => {
    e?.preventDefault()
    setSavingCompany(true)
    try {
      const res = await api('/api/settings/company', {
        method: 'POST',
        body: JSON.stringify(form)
      })
      if (res.success) {
        updateCompanySettings(res.settings || form)
        notify('✓ Company settings saved! Favicon, Name aur Logo update ho gaya hai.')
      } else {
        notify('Failed to save: ' + (res.message || 'Unknown error'))
      }
    } catch (err) {
      notify('Save failed: ' + err.message)
    } finally {
      setSavingCompany(false)
    }
  }

  // Reset to default branding
  const resetToDefault = () => {
    if (window.confirm('क्या आप ब्रांडिंग को रीसेट (Default Zendash Logo & Favicon) करना चाहते हैं?')) {
      const defaults = { companyName: '', faviconUrl: '', logoUrl: '' }
      setForm(defaults)
      saveCompanySettingsWithData(defaults)
    }
  }

  const saveCompanySettingsWithData = async (data) => {
    setSavingCompany(true)
    try {
      const res = await api('/api/settings/company', {
        method: 'POST',
        body: JSON.stringify(data)
      })
      if (res.success) {
        updateCompanySettings(res.settings || data)
        notify('✓ Default branding restored!')
      }
    } catch (err) {
      notify('Reset failed: ' + err.message)
    } finally {
      setSavingCompany(false)
    }
  }

  // System Ping Trigger
  const triggerManualPing = async () => {
    if (!isAdmin) return
    setPinging(true)
    try {
      const res = await api('/api/system/autoping/trigger', { method: 'POST' })
      setPingData(res)
      notify('Keep-Alive Ping सफलतापूर्वक भेजा गया!')
    } catch (e) {
      notify('Ping failed: ' + e.message)
    } finally {
      setPinging(false)
    }
  }

  // Change Password
  const handleChangePassword = async (e) => {
    e.preventDefault()
    setPassErr('')
    setPassOk('')
    if (!curPass || !newPass) return setPassErr('वर्तमान और नया पासवर्ड दोनों दर्ज करें।')
    if (newPass.length < 6) return setPassErr('नया पासवर्ड कम से कम 6 अक्षरों का होना चाहिए।')
    setSavingPass(true)
    try {
      const res = await api('/api/auth/change-password', {
        method: 'POST',
        body: JSON.stringify({ currentPassword: curPass, newPassword: newPass })
      })
      setPassOk(res.message || 'पासवर्ड बदल दिया गया!')
      setCurPass('')
      setNewPass('')
      notify('पासवर्ड सफलतापूर्वक अपडेट हुआ!')
    } catch (e) {
      setPassErr(e.message || 'पासवर्ड बदलने में त्रुटि')
    } finally {
      setSavingPass(false)
    }
  }

  const infoItems = [
    ['Account User ID', currentUser?.userId || 'USR'],
    ['Login Username', currentUser?.username || currentUser?.mobile || (isAdmin ? 'Admin' : 'User')],
    ['WhatsApp Status', status.status],
    ['Connected Number', status.number ? '+' + status.number : 'Not connected'],
    ...(isAdmin ? [
      ['Render Keep-Alive', 'Active (24/7 Awake)'],
      ...(info?.nodeVersion ? [['Node.js Version', info.nodeVersion]] : []),
      ...(info?.uptime ? [['Uptime', info.uptime]] : [])
    ] : [])
  ]

  return (
    <section className="page-user-management" style={{ maxWidth: 1200 }}>
      {/* Page Title & Navigation Tabs */}
      <div className="d-flex flex-wrap align-items-center justify-content-between gap-3 mb-3">
        <div>
          <h4 className="page-title mb-1 font-weight-bold" style={{ fontSize: '1.25rem', color: 'var(--text-main, #282f53)' }}>
            ⚙️ System &amp; Brand Settings
          </h4>
          <span className="text-muted" style={{ fontSize: '0.8rem' }}>
            कंपनी ब्रांडिंग, फेविकॉन, लोगो और सर्वर सुरक्षा कॉन्फ़िगरेशन
          </span>
        </div>
      </div>

      {/* Tabs Header */}
      <div className="users-compact-toolbar mb-3 p-1 d-flex flex-wrap gap-1 align-items-center">
        <button
          type="button"
          onClick={() => setActiveTab('company')}
          className={`btn ${activeTab === 'company' ? 'btn-primary' : 'btn-white'}`}
          style={{ height: 34, fontSize: '0.82rem', padding: '0 16px', borderRadius: 6 }}
        >
          🏢 1. Company Setting
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('system')}
          className={`btn ${activeTab === 'system' ? 'btn-primary' : 'btn-white'}`}
          style={{ height: 34, fontSize: '0.82rem', padding: '0 16px', borderRadius: 6 }}
        >
          🔒 2. System &amp; Security
        </button>

        <button
          type="button"
          disabled
          className="btn btn-white"
          style={{ height: 34, fontSize: '0.82rem', padding: '0 14px', borderRadius: 6, opacity: 0.6, cursor: 'not-allowed' }}
          title="Upcoming tab"
        >
          🔔 3. Notifications <small style={{ fontSize: 9, opacity: 0.8, marginLeft: 4 }}>Soon</small>
        </button>

        <button
          type="button"
          disabled
          className="btn btn-white"
          style={{ height: 34, fontSize: '0.82rem', padding: '0 14px', borderRadius: 6, opacity: 0.6, cursor: 'not-allowed' }}
          title="Upcoming tab"
        >
          🌐 4. Localization <small style={{ fontSize: 9, opacity: 0.8, marginLeft: 4 }}>Soon</small>
        </button>
      </div>

      {/* ============================================================== */}
      {/* TAB 1: COMPANY SETTINGS                                         */}
      {/* ============================================================== */}
      {activeTab === 'company' && (
        <div className="row g-3">
          {/* Left Column: Form Settings */}
          <div className="col-lg-7 col-12">
            <div className="card users-table-card p-4">
              <div className="d-flex align-items-center justify-content-between mb-3 border-bottom pb-2">
                <h5 className="font-weight-bold mb-0" style={{ fontSize: '1rem', color: 'var(--text-main, #282f53)' }}>
                  🏢 Company Branding &amp; Identity
                </h5>
                <button
                  type="button"
                  onClick={resetToDefault}
                  className="btn btn-sm btn-outline-danger"
                  style={{ height: 26, fontSize: 11, padding: '2px 8px' }}
                  title="Reset favicon and logo to default Zendash"
                >
                  Reset Defaults
                </button>
              </div>

              <form onSubmit={saveCompanySettings}>
                {/* 1. COMPANY NAME */}
                <div className="form-group mb-4">
                  <label className="d-block font-weight-bold mb-1" style={{ fontSize: '0.85rem', color: 'var(--text-main, #282f53)' }}>
                    1. Company Name (कंपनी का नाम) <span className="text-danger">*</span>
                  </label>
                  <p className="text-muted mb-2" style={{ fontSize: '0.75rem' }}>
                    यह नाम ब्राउज़र टैब के टाइटल में फेविकॉन के साथ और पूरे डैशबोर्ड पर दिखाई देगा।
                  </p>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="उदा. My Business WhatsApp / TechnoSoft"
                    value={form.companyName}
                    onChange={e => setForm(prev => ({ ...prev, companyName: e.target.value }))}
                    style={{ height: 38, fontSize: '0.85rem', borderRadius: 6 }}
                  />
                </div>

                {/* 2. ADD FAVICON */}
                <div className="form-group mb-4">
                  <label className="d-block font-weight-bold mb-1" style={{ fontSize: '0.85rem', color: 'var(--text-main, #282f53)' }}>
                    2. Add Favicon (फेविकॉन जोड़ें) <span className="text-danger">*</span>
                  </label>
                  <p className="text-muted mb-2" style={{ fontSize: '0.75rem' }}>
                    यहाँ अपलोड की गई इमेज आपके ब्राउज़र टैब में फेविकॉन के रूप में कंपनी नाम के साथ दिखेगी।
                  </p>

                  <div className="d-flex align-items-center gap-2 flex-wrap mb-2">
                    <input
                      type="file"
                      ref={faviconInputRef}
                      accept="image/png,image/jpeg,image/x-icon,image/svg+xml,image/webp"
                      style={{ display: 'none' }}
                      onChange={e => handleImageFile(e.target.files?.[0], 'favicon')}
                    />
                    <button
                      type="button"
                      className="btn btn-outline-primary"
                      onClick={() => faviconInputRef.current?.click()}
                      style={{ height: 34, fontSize: '0.8rem', borderRadius: 6 }}
                    >
                      📁 Upload Favicon File (.ico, .png, .svg)
                    </button>
                    {form.faviconUrl && (
                      <button
                        type="button"
                        className="btn btn-white text-danger"
                        onClick={() => setForm(prev => ({ ...prev, faviconUrl: '' }))}
                        style={{ height: 34, fontSize: '0.78rem', borderRadius: 6 }}
                      >
                        Remove Favicon
                      </button>
                    )}
                  </div>

                  {/* Optional URL input */}
                  <div className="input-group">
                    <span className="input-group-text" style={{ fontSize: '0.75rem', background: 'var(--header-bg, #f8fafc)' }}>URL:</span>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="या इमेज URL पेस्ट करें (https://.../favicon.png)"
                      value={form.faviconUrl.startsWith('data:') ? '[Uploaded Base64 Image]' : form.faviconUrl}
                      onChange={e => setForm(prev => ({ ...prev, faviconUrl: e.target.value }))}
                      style={{ height: 34, fontSize: '0.78rem', borderRadius: '0 6px 6px 0' }}
                    />
                  </div>
                </div>

                {/* 3. LOGO */}
                <div className="form-group mb-4">
                  <label className="d-block font-weight-bold mb-1" style={{ fontSize: '0.85rem', color: 'var(--text-main, #282f53)' }}>
                    3. Logo (मेनू बार के ऊपर का लोगो) <span className="text-danger">*</span>
                  </label>
                  <p className="text-muted mb-2" style={{ fontSize: '0.75rem' }}>
                    यहाँ अपलोड किया गया लोगो मेन्यू बार के ऊपर लगे <strong>Zendash</strong> लोगो की जगह शो होगा। (Transparent PNG या SVG अनुशंसित)
                  </p>

                  <div className="d-flex align-items-center gap-2 flex-wrap mb-2">
                    <input
                      type="file"
                      ref={logoInputRef}
                      accept="image/png,image/jpeg,image/svg+xml,image/webp"
                      style={{ display: 'none' }}
                      onChange={e => handleImageFile(e.target.files?.[0], 'logo')}
                    />
                    <button
                      type="button"
                      className="btn btn-outline-primary"
                      onClick={() => logoInputRef.current?.click()}
                      style={{ height: 34, fontSize: '0.8rem', borderRadius: 6 }}
                    >
                      📁 Upload Main Logo (.png, .svg)
                    </button>
                    {form.logoUrl && (
                      <button
                        type="button"
                        className="btn btn-white text-danger"
                        onClick={() => setForm(prev => ({ ...prev, logoUrl: '' }))}
                        style={{ height: 34, fontSize: '0.78rem', borderRadius: 6 }}
                      >
                        Remove Logo
                      </button>
                    )}
                  </div>

                  {/* Optional URL input */}
                  <div className="input-group">
                    <span className="input-group-text" style={{ fontSize: '0.75rem', background: 'var(--header-bg, #f8fafc)' }}>URL:</span>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="या इमेज URL पेस्ट करें (https://.../logo.png)"
                      value={form.logoUrl.startsWith('data:') ? '[Uploaded Base64 Image]' : form.logoUrl}
                      onChange={e => setForm(prev => ({ ...prev, logoUrl: e.target.value }))}
                      style={{ height: 34, fontSize: '0.78rem', borderRadius: '0 6px 6px 0' }}
                    />
                  </div>
                </div>

                {/* SAVE BUTTON */}
                <div className="pt-2 border-top d-flex align-items-center justify-content-end gap-2">
                  <button
                    type="submit"
                    className="btn btn-primary px-4"
                    disabled={savingCompany}
                    style={{ height: 38, fontSize: '0.85rem', fontWeight: 600, borderRadius: 6 }}
                  >
                    {savingCompany ? 'Saving Settings...' : '💾 Save Company Settings'}
                  </button>
                </div>
              </form>
            </div>
          </div>

          {/* Right Column: Live Interactive Mockup Previews */}
          <div className="col-lg-5 col-12">
            {/* Live Browser Tab Preview */}
            <div className="card users-table-card p-3 mb-3">
              <h6 className="font-weight-bold mb-2" style={{ fontSize: '0.85rem', color: 'var(--text-main, #282f53)' }}>
                🌐 Live Browser Tab Preview (फेविकॉन + कंपनी नाम)
              </h6>
              <p className="text-muted mb-2" style={{ fontSize: '0.75rem' }}>
                देखें कि आपकी कंपनी का नाम और फेविकॉन ब्राउज़र टैब में कैसा दिखेगा:
              </p>

              {/* Mock Browser Frame */}
              <div style={{ background: '#dfe3e8', borderRadius: 8, padding: '8px 10px 0', border: '1px solid #c9d1d9' }}>
                <div className="d-flex align-items-center gap-1 mb-2">
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#ff5f56', display: 'inline-block' }}></span>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#ffbd2e', display: 'inline-block' }}></span>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#27c93f', display: 'inline-block' }}></span>
                </div>

                {/* Mock Active Tab */}
                <div style={{
                  background: '#ffffff',
                  borderRadius: '6px 6px 0 0',
                  padding: '6px 12px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  maxWidth: 240,
                  boxShadow: '0 -1px 3px rgba(0,0,0,0.06)'
                }}>
                  {form.faviconUrl ? (
                    <img
                      src={form.faviconUrl}
                      alt="favicon"
                      style={{ width: 16, height: 16, objectFit: 'contain', flexShrink: 0 }}
                    />
                  ) : (
                    <img
                      src="/assets/images/brand/favicon.ico"
                      alt="default favicon"
                      style={{ width: 16, height: 16, objectFit: 'contain', flexShrink: 0 }}
                    />
                  )}
                  <span style={{
                    fontSize: 12,
                    fontWeight: 600,
                    color: '#334155',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis'
                  }}>
                    {form.companyName || 'WhatsApp Automation'}
                  </span>
                  <span style={{ fontSize: 13, color: '#94a3b8', marginLeft: 'auto', cursor: 'default' }}>×</span>
                </div>
              </div>
            </div>

            {/* Live Sidebar Logo Preview */}
            <div className="card users-table-card p-3">
              <div className="d-flex align-items-center justify-content-between mb-2">
                <h6 className="font-weight-bold mb-0" style={{ fontSize: '0.85rem', color: 'var(--text-main, #282f53)' }}>
                  📌 Menu Bar Logo Preview (मेन्यू बार के ऊपर)
                </h6>
                <div className="btn-group btn-group-sm">
                  <button
                    type="button"
                    className={`btn btn-xs ${previewTheme === 'light' ? 'btn-primary' : 'btn-white'}`}
                    onClick={() => setPreviewTheme('light')}
                    style={{ fontSize: 10, padding: '2px 8px' }}
                  >
                    ☀️ Light
                  </button>
                  <button
                    type="button"
                    className={`btn btn-xs ${previewTheme === 'dark' ? 'btn-primary' : 'btn-white'}`}
                    onClick={() => setPreviewTheme('dark')}
                    style={{ fontSize: 10, padding: '2px 8px' }}
                  >
                    🌙 Dark
                  </button>
                </div>
              </div>
              <p className="text-muted mb-2" style={{ fontSize: '0.75rem' }}>
                यह लोगो साइडबार मेन्यू के ऊपर Zendash लोगो को रीप्लेस करेगा:
              </p>

              {/* Mock Sidebar Box */}
              <div style={{
                background: previewTheme === 'dark' ? '#0f163e' : '#ffffff',
                border: previewTheme === 'dark' ? '1px solid rgba(255,255,255,0.1)' : '1px solid #e2e8f0',
                borderRadius: 8,
                padding: '16px 20px',
                textAlign: 'center',
                transition: 'all 0.3s ease'
              }}>
                <div style={{
                  minHeight: 48,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderBottom: previewTheme === 'dark' ? '1px solid rgba(255,255,255,0.08)' : '1px solid #f1f5f9',
                  paddingBottom: 12,
                  marginBottom: 12
                }}>
                  {form.logoUrl ? (
                    <img
                      src={form.logoUrl}
                      alt="Uploaded Logo Preview"
                      style={{ maxHeight: 42, maxWidth: '100%', objectFit: 'contain' }}
                    />
                  ) : (
                    <img
                      src="/assets/images/brand/logo.png"
                      alt="Default Zendash Logo"
                      style={{ maxHeight: 38, objectFit: 'contain' }}
                    />
                  )}
                </div>

                {/* Mock Menu Items */}
                <div style={{ textAlign: 'left', opacity: 0.6, fontSize: 11 }}>
                  <div style={{ color: previewTheme === 'dark' ? '#94a3b8' : '#64748b', fontWeight: 700, letterSpacing: 0.5, marginBottom: 6 }}>
                    MAIN
                  </div>
                  <div style={{
                    padding: '6px 10px',
                    borderRadius: 6,
                    background: previewTheme === 'dark' ? '#141b47' : '#f8fafc',
                    color: '#705ec8',
                    fontWeight: 600,
                    marginBottom: 4,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6
                  }}>
                    <span>⌂</span> Dashboard
                  </div>
                  <div style={{
                    padding: '6px 10px',
                    borderRadius: 6,
                    color: previewTheme === 'dark' ? '#cbd5e1' : '#475569',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6
                  }}>
                    <span>➤</span> Send Message
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* TAB 2: SYSTEM & SECURITY                                        */}
      {/* ============================================================== */}
      {activeTab === 'system' && (
        <div className="row g-3">
          {/* Render 24/7 Keep-Alive Auto-Ping Card */}
          {isAdmin && (
            <div className="col-12">
              <div className="card users-table-card p-4">
                <div className="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-3">
                  <div>
                    <h5 className="font-weight-bold mb-1" style={{ fontSize: '1rem', color: 'var(--text-main, #282f53)' }}>
                      ⏰ Server Auto-Ping (Render 24/7 Keep-Alive)
                    </h5>
                    <p className="text-muted mb-0" style={{ fontSize: '0.8rem' }}>
                      Render सर्वर को 10-15 मिनट में स्लीप (Sleep) होने से रोकने के लिए ऑटो-पिंग सक्रिय है:
                    </p>
                  </div>
                  <button
                    className="btn btn-outline-primary"
                    onClick={triggerManualPing}
                    disabled={pinging}
                    style={{ height: 32, fontSize: '0.8rem', padding: '0 12px' }}
                  >
                    {pinging ? 'Pinging...' : '⚡ Ping Now'}
                  </button>
                </div>

                <div className="row g-2">
                  <div className="col-md-3 col-6">
                    <div className="p-2 border rounded" style={{ background: 'var(--header-bg, #f8fafc)' }}>
                      <small className="text-muted d-block" style={{ fontSize: 11, fontWeight: 700 }}>स्थिति (Status)</small>
                      <strong className="text-success" style={{ fontSize: 13 }}>● Active (24/7 Awake)</strong>
                    </div>
                  </div>
                  <div className="col-md-3 col-6">
                    <div className="p-2 border rounded" style={{ background: 'var(--header-bg, #f8fafc)' }}>
                      <small className="text-muted d-block" style={{ fontSize: 11, fontWeight: 700 }}>Ping Frequency</small>
                      <strong style={{ fontSize: 13, color: 'var(--text-main, #282f53)' }}>
                        हर {pingData?.stats?.interval || '5m'} मिनट में
                      </strong>
                    </div>
                  </div>
                  <div className="col-md-3 col-6">
                    <div className="p-2 border rounded" style={{ background: 'var(--header-bg, #f8fafc)' }}>
                      <small className="text-muted d-block" style={{ fontSize: 11, fontWeight: 700 }}>Last Ping Time</small>
                      <strong style={{ fontSize: 12, color: 'var(--text-main, #282f53)' }}>
                        {pingData?.stats?.lastPingTime ? new Date(pingData.stats.lastPingTime).toLocaleTimeString('en-IN') : 'सक्रिय'}
                      </strong>
                    </div>
                  </div>
                  <div className="col-md-3 col-6">
                    <div className="p-2 border rounded" style={{ background: 'var(--header-bg, #f8fafc)' }}>
                      <small className="text-muted d-block" style={{ fontSize: 11, fontWeight: 700 }}>Total Pings Sent</small>
                      <strong style={{ fontSize: 13, color: '#705ec8' }}>
                        {pingData?.stats?.totalPings ?? '—'} बार
                      </strong>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Change Password Card */}
          <div className="col-lg-6 col-12">
            <div className="card users-table-card p-4">
              <h5 className="font-weight-bold mb-2" style={{ fontSize: '1rem', color: 'var(--text-main, #282f53)' }}>
                🔑 Change Account Password
              </h5>
              <p className="text-muted mb-3" style={{ fontSize: '0.8rem' }}>
                अपने एडमिन/यूज़र खाते का पासवर्ड सुरक्षित रखें:
              </p>

              {passErr && <div className="alert alert-danger p-2 mb-3" style={{ fontSize: 12 }}>{passErr}</div>}
              {passOk && <div className="alert alert-success p-2 mb-3" style={{ fontSize: 12 }}>{passOk}</div>}

              <form onSubmit={handleChangePassword}>
                <div className="form-group mb-3">
                  <label className="d-block font-weight-bold mb-1" style={{ fontSize: 12 }}>वर्तमान पासवर्ड (Current Password)</label>
                  <input
                    type="password"
                    className="form-control"
                    value={curPass}
                    onChange={e => setCurPass(e.target.value)}
                    placeholder="वर्तमान पासवर्ड दर्ज करें"
                    style={{ height: 36, fontSize: '0.85rem' }}
                  />
                </div>
                <div className="form-group mb-3">
                  <label className="d-block font-weight-bold mb-1" style={{ fontSize: 12 }}>नया पासवर्ड (New Password)</label>
                  <input
                    type="password"
                    className="form-control"
                    value={newPass}
                    onChange={e => setNewPass(e.target.value)}
                    placeholder="नया मजबूत पासवर्ड दर्ज करें (कम से कम 6 अक्षर)"
                    style={{ height: 36, fontSize: '0.85rem' }}
                  />
                </div>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={savingPass}
                  style={{ height: 36, fontSize: '0.85rem', fontWeight: 600 }}
                >
                  {savingPass ? 'पासवर्ड बदल रहा है...' : 'पासवर्ड अपडेट करें'}
                </button>
              </form>
            </div>
          </div>

          {/* System & Session Details Card */}
          <div className="col-lg-6 col-12">
            <div className="card users-table-card p-4">
              <h5 className="font-weight-bold mb-2" style={{ fontSize: '1rem', color: 'var(--text-main, #282f53)' }}>
                ℹ️ System &amp; Session Info
              </h5>
              <p className="text-muted mb-3" style={{ fontSize: '0.8rem' }}>
                वर्तमान सेशन और सिस्टम पैरामीटर्स:
              </p>

              <div className="table-responsive">
                <table className="users-table-compact">
                  <tbody>
                    {infoItems.map(([label, val]) => (
                      <tr key={label}>
                        <td style={{ fontWeight: 600, color: 'var(--text-muted, #64748b)', width: '45%' }}>{label}</td>
                        <td style={{ fontWeight: 700, color: 'var(--text-main, #282f53)' }}>{String(val)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
