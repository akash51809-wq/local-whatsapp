import React, { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import api from '../../services/api'

export function SystemPage() { 
  const { status, currentUser, notify, isAdmin } = useAuth()
  const [info, setInfo] = useState(null)
  const [pingData, setPingData] = useState(null)
  const [pinging, setPinging] = useState(false)
  const [curPass, setCurPass] = useState('')
  const [newPass, setNewPass] = useState('')
  const [passErr, setPassErr] = useState('')
  const [passOk, setPassOk] = useState('')
  const [savingPass, setSavingPass] = useState(false)

  const loadPingStatus = useCallback(() => {
    if (!isAdmin) return
    api('/api/system/autoping').then(setPingData).catch(() => {})
  }, [isAdmin])

  useEffect(() => { 
    if (isAdmin) {
      api('/api/admin/system-info').then(d => setInfo(d.info)).catch(() => {}) 
      loadPingStatus()
      const t = setInterval(loadPingStatus, 15000)
      return () => clearInterval(t)
    }
  }, [isAdmin, loadPingStatus])

  const triggerManualPing = async () => {
    if (!isAdmin) return
    setPinging(true)
    try {
      const res = await api('/api/system/autoping/trigger', { method: 'POST' })
      setPingData(res)
      if (notify) notify('Keep-Alive Ping सफलतापुर्वक भेजा गया!')
    } catch (e) {
      if (notify) notify('Ping failed: ' + e.message)
    } finally {
      setPinging(false)
    }
  }

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
    <section className="page-content">
      <div className="section-head">
        <div>
          <span className="eyebrow">{isAdmin ? 'SYSTEM & SECURITY' : 'ACCOUNT SECURITY'}</span>
          <h2>{isAdmin ? 'System & Account Settings' : 'Account & Security Settings'}</h2>
          <p>{isAdmin ? 'अकाउंट सुरक्षा, सर्वर की स्थिति और Render 24/7 Keep-Alive जानकारी' : 'अकाउंट सुरक्षा और पासवर्ड सेटिंग्स'}</p>
        </div>
      </div>

      {/* Auto-Ping / Render Sleep Prevention Card - Admin only */}
      {isAdmin && (
        <div className="api-card" style={{ marginBottom: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
            <div>
              <h3 style={{ margin: 0 }}>⏰ Server Auto-Ping (Render 24/7 Keep-Alive)</h3>
              <p style={{ color: '#666', fontSize: 13, margin: '4px 0 0' }}>
                Render सर्वर 10-15 मिनट में स्लीप (Sleep) होने से रोकने के लिए ऑटो-पिंग लगातार सक्रिय है:
              </p>
            </div>
            <button className="secondary" onClick={triggerManualPing} disabled={pinging} style={{ padding: '7px 14px', fontSize: 12 }}>
              {pinging ? 'Pinging...' : '⚡ Ping Now'}
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginTop: 14 }}>
            <div style={{ background: '#f8fafc', padding: 12, borderRadius: 8, border: '1px solid #e2e8f0' }}>
              <small style={{ color: '#64748b', fontWeight: 700, display: 'block', marginBottom: 4 }}>स्थिति (Status)</small>
              <strong style={{ color: '#16a34a' }}>● Active (24/7 Awake)</strong>
            </div>
            <div style={{ background: '#f8fafc', padding: 12, borderRadius: 8, border: '1px solid #e2e8f0' }}>
              <small style={{ color: '#64748b', fontWeight: 700, display: 'block', marginBottom: 4 }}>Ping Frequency</small>
              <strong>हर {pingData?.stats?.intervalMinutes || 5} मिनट में</strong>
            </div>
            <div style={{ background: '#f8fafc', padding: 12, borderRadius: 8, border: '1px solid #e2e8f0' }}>
              <small style={{ color: '#64748b', fontWeight: 700, display: 'block', marginBottom: 4 }}>Last Ping Result</small>
              <strong style={{ fontSize: 12, color: '#0f172a', wordBreak: 'break-all' }}>{pingData?.stats?.lastPingStatus || 'Starting...'}</strong>
            </div>
            <div style={{ background: '#f8fafc', padding: 12, borderRadius: 8, border: '1px solid #e2e8f0' }}>
              <small style={{ color: '#64748b', fontWeight: 700, display: 'block', marginBottom: 4 }}>Total Pings Sent</small>
              <strong>{pingData?.stats?.totalPings || 0} Pings</strong>
            </div>
          </div>
        </div>
      )}

      {/* Change Password Card */}
      <div className="api-card" style={{ marginBottom: 24 }}>
        <h3>🔒 पासवर्ड बदलें (Change Password)</h3>
        <p style={{ color: '#666', fontSize: 13, margin: '4px 0 16px' }}>WhatsApp पर प्राप्त हुए रैंडम पासवर्ड को यहाँ अपने मनपसंद पासवर्ड से बदलें:</p>
        <form onSubmit={handleChangePassword} style={{ maxWidth: 400 }}>
          <label style={{ display: 'block', fontSize: 13, fontWeight: 700, marginBottom: 6 }}>वर्तमान पासवर्ड (Current Password)
            <input 
              type="password" 
              placeholder="Current Password" 
              value={curPass} 
              onChange={e => setCurPass(e.target.value)} 
              style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #ccc', marginTop: 4 }}
            />
          </label>
          <label style={{ display: 'block', fontSize: 13, fontWeight: 700, margin: '12px 0 6px' }}>नया पासवर्ड (New Password)
            <input 
              type="password" 
              placeholder="कम से कम 6 अक्षर" 
              value={newPass} 
              onChange={e => setNewPass(e.target.value)} 
              style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #ccc', marginTop: 4 }}
            />
          </label>
          {passErr && <div className="form-error" style={{ marginTop: 8 }}>{passErr}</div>}
          {passOk && <div style={{ color: '#087a5d', background: '#e9f8f2', padding: '8px 12px', borderRadius: 6, marginTop: 8, fontSize: 13 }}>{passOk}</div>}
          <button className="primary" style={{ marginTop: 16 }} disabled={savingPass}>
            {savingPass ? 'Updating...' : 'पासवर्ड सेव करें'}
          </button>
        </form>
      </div>

      <div className="info-grid">
        {infoItems.map(([a,b]) => (
          <div className="info-card" key={a}>
            <small>{a}</small>
            <strong>{b}</strong>
          </div>
        ))}
      </div>
    </section>
  )
}

export default SystemPage
