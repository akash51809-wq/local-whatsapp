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

  // Company settings tab is strictly for admin. Regular users can only access system tab.
  const [activeTab, setActiveTab] = useState(() => (isAdmin ? defaultTab : 'system'))

  useEffect(() => {
    if (!isAdmin && activeTab === 'company') {
      setActiveTab('system')
    }
  }, [isAdmin, activeTab])

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

  // Auto Send Image Tab States
  const [autoImgConfig, setAutoImgConfig] = useState({
    enabled: false,
    imageUrl: '',
    fileName: '',
    updatedAt: null
  })
  const [autoImgFile, setAutoImgFile] = useState(null)
  const [autoImgUrlInput, setAutoImgUrlInput] = useState('')
  const [loadingAutoImg, setLoadingAutoImg] = useState(false)
  const [savingAutoImg, setSavingAutoImg] = useState(false)
  const autoImgInputRef = useRef(null)

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

  // Auto Image Settings loader
  const loadAutoImageSettings = useCallback(async () => {
    setLoadingAutoImg(true)
    try {
      const res = await api('/api/user/settings/auto-image')
      if (res.success && res.autoSendImage) {
        setAutoImgConfig(res.autoSendImage)
        if (res.autoSendImage.imageUrl?.startsWith('http')) {
          setAutoImgUrlInput(res.autoSendImage.imageUrl)
        } else {
          setAutoImgUrlInput('')
        }
      }
    } catch (err) {
      console.warn('Load auto image error:', err.message)
    } finally {
      setLoadingAutoImg(false)
    }
  }, [])

  useEffect(() => {
    if (activeTab === 'auto-image') {
      loadAutoImageSettings()
    }
  }, [activeTab, loadAutoImageSettings])

  // Handle Auto Image File selection
  const handleAutoImgFileSelect = (file) => {
    if (!file) return
    if (!file.type.startsWith('image/')) {
      notify('कृपया केवल इमेज फाइल (JPG, PNG, WebP) चुनें।')
      return
    }
    if (file.size > 8 * 1024 * 1024) {
      notify('इमेज साइज 8MB से कम होना चाहिए (File size must be under 8MB)')
      return
    }
    const reader = new FileReader()
    reader.onload = (e) => {
      const dataUrl = e.target.result
      setAutoImgFile(dataUrl)
      setAutoImgUrlInput('')
      setAutoImgConfig(prev => ({
        ...prev,
        imageUrl: dataUrl,
        fileName: file.name
      }))
      notify('✓ इमेज चुनी गई! सेटिंग्स लागू करने के लिए Save Settings पर क्लिक करें।')
    }
    reader.readAsDataURL(file)
  }

  // Save Auto Send Image Settings
  const handleSaveAutoImage = async (e) => {
    e?.preventDefault()
    setSavingAutoImg(true)
    try {
      const payload = {
        enabled: Boolean(autoImgConfig.enabled),
        fileName: autoImgConfig.fileName || ''
      }
      if (autoImgFile) {
        payload.fileData = autoImgFile
      } else if (autoImgUrlInput.trim()) {
        payload.imageUrl = autoImgUrlInput.trim()
      } else {
        payload.imageUrl = autoImgConfig.imageUrl || ''
      }

      const res = await api('/api/user/settings/auto-image', {
        method: 'POST',
        body: JSON.stringify(payload)
      })

      if (res.success) {
        setAutoImgConfig(res.autoSendImage)
        setAutoImgFile(null)
        if (res.autoSendImage.imageUrl?.startsWith('http')) {
          setAutoImgUrlInput(res.autoSendImage.imageUrl)
        }
        notify('✓ Auto Send Image सेटिंग्स सफलतापूर्वक सेव हो गई!')
      } else {
        notify('सेव करने में विफल: ' + (res.message || 'Unknown error'))
      }
    } catch (err) {
      notify('Save failed: ' + err.message)
    } finally {
      setSavingAutoImg(false)
    }
  }

  // Remove Auto Send Image
  const handleRemoveAutoImage = async () => {
    if (!window.confirm('क्या आप Auto Send Image को हटाना चाहते हैं?')) return
    setSavingAutoImg(true)
    try {
      const res = await api('/api/user/settings/auto-image', {
        method: 'DELETE'
      })
      if (res.success) {
        setAutoImgConfig({ enabled: false, imageUrl: '', fileName: '', updatedAt: null })
        setAutoImgFile(null)
        setAutoImgUrlInput('')
        if (autoImgInputRef.current) autoImgInputRef.current.value = ''
        notify('✓ Auto Send Image हटा दी गई!')
      }
    } catch (err) {
      notify('Remove failed: ' + err.message)
    } finally {
      setSavingAutoImg(false)
    }
  }

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
            {isAdmin ? '⚙️ System & Brand Settings' : '⚙️ System & Security Settings'}
          </h4>
          <span className="text-muted" style={{ fontSize: '0.8rem' }}>
            {isAdmin 
              ? 'कंपनी ब्रांडिंग, फेविकॉन, लोगो और सर्वर सुरक्षा कॉन्फ़िगरेशन'
              : 'पासवर्ड बदलें, सेशन और खाता सुरक्षा कॉन्फ़िगरेशन'}
          </span>
        </div>
      </div>

      {/* Tabs Header */}
      <div className="users-compact-toolbar mb-3 p-1 d-flex flex-wrap gap-1 align-items-center">
        {isAdmin && (
          <button
            type="button"
            onClick={() => setActiveTab('company')}
            className={`btn ${activeTab === 'company' ? 'btn-primary' : 'btn-white'}`}
            style={{ height: 34, fontSize: '0.82rem', padding: '0 16px', borderRadius: 6 }}
          >
            🏢 1. Company Setting
          </button>
        )}

        <button
          type="button"
          onClick={() => setActiveTab('system')}
          className={`btn ${activeTab === 'system' ? 'btn-primary' : 'btn-white'}`}
          style={{ height: 34, fontSize: '0.82rem', padding: '0 16px', borderRadius: 6 }}
        >
          {isAdmin ? '🔒 2. System & Security' : '🔒 1. System & Security'}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('auto-image')}
          className={`btn ${activeTab === 'auto-image' ? 'btn-primary' : 'btn-white'}`}
          style={{ height: 34, fontSize: '0.82rem', padding: '0 16px', borderRadius: 6 }}
        >
          {isAdmin ? '🖼️ 3. Auto Send Image' : '🖼️ 2. Auto Send Image'}
          {autoImgConfig.enabled && (
            <span className="badge badge-success" style={{ fontSize: 9, padding: '2px 6px', marginLeft: 6 }}>
              ON
            </span>
          )}
        </button>

        <button
          type="button"
          disabled
          className="btn btn-white"
          style={{ height: 34, fontSize: '0.82rem', padding: '0 14px', borderRadius: 6, opacity: 0.6, cursor: 'not-allowed' }}
          title="Upcoming tab"
        >
          {isAdmin ? '🔔 4. Notifications' : '🔔 3. Notifications'} <small style={{ fontSize: 9, opacity: 0.8, marginLeft: 4 }}>Soon</small>
        </button>

        <button
          type="button"
          disabled
          className="btn btn-white"
          style={{ height: 34, fontSize: '0.82rem', padding: '0 14px', borderRadius: 6, opacity: 0.6, cursor: 'not-allowed' }}
          title="Upcoming tab"
        >
          {isAdmin ? '🌐 5. Localization' : '🌐 4. Localization'} <small style={{ fontSize: 9, opacity: 0.8, marginLeft: 4 }}>Soon</small>
        </button>
      </div>

      {/* ============================================================== */}
      {/* TAB 1: COMPANY SETTINGS (ADMIN ONLY)                           */}
      {/* ============================================================== */}
      {isAdmin && activeTab === 'company' && (
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

      {/* ============================================================== */}
      {/* TAB: AUTO SEND IMAGE (FOR USER AND ADMIN)                     */}
      {/* ============================================================== */}
      {activeTab === 'auto-image' && (
        <div className="row g-3">
          {/* Left Column: Configuration Form */}
          <div className="col-lg-7 col-12">
            <div className="card users-table-card p-4">
              <div className="d-flex align-items-center justify-content-between mb-3 border-bottom pb-2">
                <div>
                  <h5 className="font-weight-bold mb-1" style={{ fontSize: '1.05rem', color: 'var(--text-main, #282f53)' }}>
                    🖼️ Auto Send Image with API Messages
                  </h5>
                  <span className="text-muted" style={{ fontSize: '0.8rem' }}>
                    API (<code style={{ color: '#705ec8' }}>/send-text</code>) se aane wale sabhi text messages ke saath ye image automatically caption ke saath send ho jayegi.
                  </span>
                </div>
                {autoImgConfig.imageUrl && (
                  <button
                    type="button"
                    className="btn btn-outline-danger btn-sm"
                    onClick={handleRemoveAutoImage}
                    disabled={savingAutoImg}
                    style={{ fontSize: '0.78rem', borderRadius: 6, height: 32 }}
                  >
                    🗑️ Remove Image
                  </button>
                )}
              </div>

              {loadingAutoImg ? (
                <div className="text-center py-4 text-muted">
                  <div className="spinner-border spinner-border-sm text-primary mr-2" role="status"></div>
                  सेटिंग्स लोड हो रही हैं...
                </div>
              ) : (
                <form onSubmit={handleSaveAutoImage}>
                  {/* Enable / Disable Feature Toggle */}
                  <div className="card p-3 mb-3" style={{ background: autoImgConfig.enabled ? 'rgba(40, 167, 69, 0.06)' : 'rgba(100, 116, 139, 0.06)', border: autoImgConfig.enabled ? '1px solid rgba(40, 167, 69, 0.3)' : '1px solid #e2e8f0', borderRadius: 8 }}>
                    <div className="d-flex align-items-center justify-content-between">
                      <div>
                        <div className="font-weight-bold" style={{ fontSize: '0.9rem', color: 'var(--text-main, #282f53)' }}>
                          Auto Send Image Feature
                        </div>
                        <small className="text-muted" style={{ fontSize: '0.78rem' }}>
                          {autoImgConfig.enabled 
                            ? 'सक्रिय (Active): API se send kiye gaye text ke saath ye image auto attach hogi.' 
                            : 'निष्क्रिय (Disabled): API messages sirf plain text ki tarah bina image ke jayenge.'}
                        </small>
                      </div>
                      <div className="custom-control custom-switch">
                        <input
                          type="checkbox"
                          className="custom-control-input"
                          id="autoImageSwitch"
                          checked={Boolean(autoImgConfig.enabled)}
                          onChange={e => setAutoImgConfig(prev => ({ ...prev, enabled: e.target.checked }))}
                          style={{ cursor: 'pointer' }}
                        />
                        <label className="custom-control-label font-weight-bold" htmlFor="autoImageSwitch" style={{ cursor: 'pointer', fontSize: '0.85rem' }}>
                          {autoImgConfig.enabled ? 'Enabled' : 'Disabled'}
                        </label>
                      </div>
                    </div>
                  </div>

                  {/* Option 1: File Upload */}
                  <div className="form-group mb-3">
                    <label className="d-block font-weight-bold mb-1" style={{ fontSize: 13, color: 'var(--text-main, #282f53)' }}>
                      1. इमेज फाइल अपलोड करें (Upload Image File)
                    </label>
                    <div className="text-muted mb-2" style={{ fontSize: '0.78rem' }}>
                      Apne computer ya mobile se banner/logo image chunein (JPG, PNG, WebP - Max 8MB).
                    </div>

                    <input
                      type="file"
                      ref={autoImgInputRef}
                      accept="image/*"
                      style={{ display: 'none' }}
                      onChange={e => {
                        const file = e.target.files?.[0]
                        if (file) handleAutoImgFileSelect(file)
                      }}
                    />

                    <div className="d-flex align-items-center gap-2">
                      <button
                        type="button"
                        className="btn btn-outline-primary"
                        onClick={() => autoImgInputRef.current?.click()}
                        style={{ height: 36, fontSize: '0.82rem', fontWeight: 600, borderRadius: 6 }}
                      >
                        📁 Choose Image File
                      </button>

                      {autoImgConfig.fileName && (
                        <span className="badge badge-light border text-truncate" style={{ maxWidth: 220, fontSize: '0.78rem', padding: '6px 10px' }}>
                          📎 {autoImgConfig.fileName}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Divider */}
                  <div className="d-flex align-items-center my-3">
                    <div style={{ flex: 1, height: 1, backgroundColor: '#e2e8f0' }}></div>
                    <span className="px-3 text-muted font-weight-bold" style={{ fontSize: '0.75rem' }}>OR / या</span>
                    <div style={{ flex: 1, height: 1, backgroundColor: '#e2e8f0' }}></div>
                  </div>

                  {/* Option 2: Image URL */}
                  <div className="form-group mb-3">
                    <label className="d-block font-weight-bold mb-1" style={{ fontSize: 13, color: 'var(--text-main, #282f53)' }}>
                      2. डायरेक्ट इमेज लिंक / URL (Direct Image URL)
                    </label>
                    <div className="text-muted mb-2" style={{ fontSize: '0.78rem' }}>
                      Agar aap kisi hosted image ka direct link (https://...) use karna chahte hain:
                    </div>

                    <div className="input-group">
                      <input
                        type="url"
                        className="form-control"
                        placeholder="https://example.com/banner.jpg"
                        value={autoImgUrlInput}
                        onChange={e => {
                          const val = e.target.value
                          setAutoImgUrlInput(val)
                          setAutoImgFile(null)
                          setAutoImgConfig(prev => ({
                            ...prev,
                            imageUrl: val,
                            fileName: val ? 'url_image' : ''
                          }))
                        }}
                        style={{ height: 36, fontSize: '0.85rem' }}
                      />
                      {autoImgUrlInput && (
                        <div className="input-group-append">
                          <button
                            type="button"
                            className="btn btn-white text-danger border"
                            onClick={() => {
                              setAutoImgUrlInput('')
                              setAutoImgConfig(prev => ({ ...prev, imageUrl: '', fileName: '' }))
                            }}
                            style={{ height: 36, fontSize: '0.8rem' }}
                          >
                            Clear
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Current Active Image Info */}
                  {autoImgConfig.imageUrl && (
                    <div className="alert alert-light border mb-3 py-2 px-3 d-flex align-items-center justify-content-between" style={{ borderRadius: 6 }}>
                      <div className="d-flex align-items-center gap-2 overflow-hidden">
                        <img 
                          src={autoImgConfig.imageUrl} 
                          alt="Thumbnail" 
                          style={{ width: 34, height: 34, objectFit: 'cover', borderRadius: 4, border: '1px solid #ddd' }} 
                        />
                        <div className="text-truncate" style={{ fontSize: '0.8rem' }}>
                          <span className="font-weight-bold text-dark d-block text-truncate">
                            {autoImgConfig.fileName || 'Active Image'}
                          </span>
                          <span className="text-muted" style={{ fontSize: '0.72rem' }}>
                            {autoImgConfig.imageUrl.startsWith('data:') ? 'Local file selected' : autoImgConfig.imageUrl}
                          </span>
                        </div>
                      </div>
                      <span className="badge badge-info" style={{ fontSize: '0.72rem' }}>
                        Ready to Send
                      </span>
                    </div>
                  )}

                  {/* Save Button */}
                  <div className="d-flex align-items-center gap-2 mt-4">
                    <button
                      type="submit"
                      className="btn btn-primary"
                      disabled={savingAutoImg}
                      style={{ height: 38, fontSize: '0.85rem', fontWeight: 600, minWidth: 160, borderRadius: 6 }}
                    >
                      {savingAutoImg ? (
                        <>
                          <span className="spinner-border spinner-border-sm mr-2" role="status"></span>
                          सेव हो रहा है...
                        </>
                      ) : (
                        '💾 Save Settings'
                      )}
                    </button>
                    {autoImgConfig.updatedAt && (
                      <small className="text-muted ml-2" style={{ fontSize: '0.75rem' }}>
                        Last updated: {new Date(autoImgConfig.updatedAt).toLocaleString()}
                      </small>
                    )}
                  </div>
                </form>
              )}
            </div>
          </div>

          {/* Right Column: WhatsApp Live Message Preview & Instructions */}
          <div className="col-lg-5 col-12">
            {/* Live WhatsApp Preview Mockup */}
            <div className="card users-table-card p-3 mb-3">
              <div className="d-flex align-items-center justify-content-between mb-2 pb-2 border-bottom">
                <h6 className="font-weight-bold mb-0" style={{ fontSize: '0.9rem', color: 'var(--text-main, #282f53)' }}>
                  📱 WhatsApp Live Message Preview
                </h6>
                <span className="badge badge-light border" style={{ fontSize: '0.72rem' }}>
                  Receiver View
                </span>
              </div>
              <p className="text-muted mb-3" style={{ fontSize: '0.78rem' }}>
                Jab API se koi text message aayega, to receiver ke WhatsApp par message is tarah dikhai dega:
              </p>

              {/* Simulated WhatsApp Chat Background */}
              <div 
                style={{
                  background: '#eae6df',
                  backgroundImage: 'radial-gradient(#d3cdc4 1px, transparent 1px)',
                  backgroundSize: '16px 16px',
                  borderRadius: 10,
                  padding: 14,
                  minHeight: 260,
                  display: 'flex',
                  alignItems: 'flex-start',
                  justifyContent: 'flex-end'
                }}
              >
                {/* Outgoing Message Bubble (WhatsApp Green Style) */}
                <div 
                  style={{
                    background: '#d9fdd3',
                    borderRadius: '8px 2px 8px 8px',
                    boxShadow: '0 1px 2px rgba(0,0,0,0.13)',
                    maxWidth: '88%',
                    width: 280,
                    padding: 4,
                    overflow: 'hidden'
                  }}
                >
                  {/* Image Part */}
                  {autoImgConfig.imageUrl ? (
                    <div style={{ borderRadius: 6, overflow: 'hidden', background: '#000' }}>
                      <img
                        src={autoImgConfig.imageUrl}
                        alt="Auto Send Preview"
                        style={{
                          width: '100%',
                          maxHeight: 180,
                          objectFit: 'cover',
                          display: 'block'
                        }}
                      />
                    </div>
                  ) : (
                    <div 
                      style={{
                        height: 120,
                        background: '#e9edef',
                        borderRadius: 6,
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#667781',
                        fontSize: '0.8rem'
                      }}
                    >
                      <span style={{ fontSize: 24, marginBottom: 4 }}>🖼️</span>
                      <span>No image selected</span>
                    </div>
                  )}

                  {/* Caption / Text Part */}
                  <div style={{ padding: '6px 8px 4px 8px' }}>
                    <div style={{ fontSize: '0.82rem', color: '#111b21', lineHeight: '1.35', wordBreak: 'break-word' }}>
                      Dear Customer, your message from API will appear here as the image caption! ✨
                    </div>

                    {/* Timestamp & Ticks */}
                    <div className="d-flex align-items-center justify-content-end gap-1 mt-1" style={{ fontSize: '0.68rem', color: '#667781' }}>
                      <span>12:45 PM</span>
                      <span style={{ color: '#53bdeb', fontWeight: 'bold' }}>✓✓</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* How it works info card */}
            <div className="card users-table-card p-3">
              <h6 className="font-weight-bold mb-2" style={{ fontSize: '0.88rem', color: 'var(--text-main, #282f53)' }}>
                💡 Feature Highlights &amp; Tips
              </h6>
              <ul className="mb-0 pl-3" style={{ fontSize: '0.78rem', color: 'var(--text-muted, #64748b)', lineHeight: '1.6' }}>
                <li>
                  <strong>Direct API Integration:</strong> Aapko apni API call me image param pass karne ki zaroorat nahi hai. Sirf <code>to</code> aur <code>message</code> bhejiye, image apne aap attach ho jayegi.
                </li>
                <li>
                  <strong>One-click Toggle:</strong> Kisi bhi samay upar diye switch se is feature ko Enable ya Disable kiya ja sakta hai.
                </li>
                <li>
                  <strong>Promotions &amp; Branding:</strong> Apni company ka marketing flyer, festive greeting ya business card auto-attach karne ke liye perfect solution.
                </li>
              </ul>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
