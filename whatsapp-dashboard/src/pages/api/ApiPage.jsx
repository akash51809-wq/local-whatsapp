import React, { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import api from '../../services/api'

export function ApiPage() { 
  const { notify } = useAuth()
  const [data, setData] = useState(null)
  const [err, setErr] = useState('')
  const [copied, setCopied] = useState('')
  const [testTo, setTestTo] = useState('')
  const [testMsg, setTestMsg] = useState('Hello from WhatsApp API!')
  const [testResult, setTestResult] = useState(null)
  const [testing, setTesting] = useState(false)
  const [regenLoading, setRegenLoading] = useState(false)

  const loadApiData = useCallback(() => {
    api('/api/user/api-token')
      .then(setData)
      .catch(() => {
        api('/api/settings/api-token').then(setData).catch(e => setErr(e.message))
      })
  }, [])

  useEffect(() => {
    loadApiData()
  }, [loadApiData])

  const copyText = (text, label) => {
    navigator.clipboard.writeText(text)
    setCopied(label)
    if (notify) notify(`${label} copied to clipboard!`)
    setTimeout(() => setCopied(''), 2500)
  }

  const regenerateToken = async () => {
    if (!window.confirm('क्या आप नया API Token जनरेट करना चाहते हैं? पुराना टोकन काम करना बंद कर देगा।')) return
    setRegenLoading(true)
    try {
      const res = await api('/api/user/api-token/regenerate', { method: 'POST' })
      if (res.success) {
        if (notify) notify('नया API Token सफलतापूर्वक बन गया!')
        loadApiData()
      }
    } catch (e) {
      alert(e.message || 'Token regeneration failed')
    } finally {
      setRegenLoading(false)
    }
  }

  const runTestApi = async (e) => {
    e.preventDefault()
    if (!testTo.trim() || !testMsg.trim()) {
      alert('Recipient Number और Message दोनों दर्ज करें।')
      return
    }
    setTesting(true)
    setTestResult(null)
    try {
      const url = `/send-text?token=${encodeURIComponent(data?.token || '')}&to=${encodeURIComponent(testTo.trim())}&message=${encodeURIComponent(testMsg.trim())}${data?.session ? `&session=${encodeURIComponent(data.session)}` : ''}`
      const res = await fetch(url)
      const json = await res.json()
      setTestResult(json)
      if (json.status) {
        if (notify) notify('API Test message sent successfully!')
      }
    } catch (e) {
      setTestResult({ status: false, message: e.message })
    } finally {
      setTesting(false)
    }
  }

  const sampleUrl = data?.sampleProductionUrl || data?.sampleUrl || `https://local-whatsapp.onrender.com/send-text?token=${data?.token || 'YOUR_TOKEN'}&to=9876543210&message=Hello${data?.session ? `&session=${data.session}` : ''}`

  return (
    <section className="page-content">
      <div className="section-head">
        <div>
          <span className="eyebrow">DEVELOPER & EXTERNAL INTEGRATION</span>
          <h2>WhatsApp Send-Text API</h2>
          <p>इस API का उपयोग करके किसी भी सॉफ्टवेयर, CRM या वेबसाइट से ऑटोमैटिक WhatsApp मैसेज भेजें।</p>
        </div>
      </div>

      {err && <div className="alert">⚠ {err}</div>}

      {/* Token & Session Card */}
      <div className="api-card" style={{ marginBottom: 24 }}>
        <h3>🔑 आपकी API क्रेडेंशियल्स (API Credentials)</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16, marginTop: 14 }}>
          <div style={{ background: '#f8fafc', padding: 16, borderRadius: 10, border: '1px solid #e2e8f0' }}>
            <small style={{ color: '#64748b', fontWeight: 700, display: 'block', marginBottom: 6 }}>YOUR API TOKEN</small>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <code style={{ fontSize: 14, background: '#fff', padding: '8px 12px', borderRadius: 6, border: '1px solid #cbd5e1', flex: 1, wordBreak: 'break-all' }}>
                {data?.token || 'Loading...'}
              </code>
              <button className="secondary" onClick={() => copyText(data?.token || '', 'Token')} style={{ padding: '8px 12px' }}>
                {copied === 'Token' ? '✓ Copied' : '📋 Copy'}
              </button>
              <button className="secondary" onClick={regenerateToken} disabled={regenLoading} title="Generate New Token" style={{ padding: '8px 10px' }}>
                {regenLoading ? '...' : '🔄'}
              </button>
            </div>
          </div>

          <div style={{ background: '#f8fafc', padding: 16, borderRadius: 10, border: '1px solid #e2e8f0' }}>
            <small style={{ color: '#64748b', fontWeight: 700, display: 'block', marginBottom: 6 }}>YOUR SCANNED WHATSAPP SESSION</small>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <span style={{ fontSize: 16, fontWeight: 700, color: '#0f172a', background: '#fff', padding: '8px 14px', borderRadius: 6, border: '1px solid #cbd5e1', flex: 1 }}>
                {data?.session ? `+91 ${data.session}` : (data?.connectedNumber ? `+${data.connectedNumber}` : 'Not Scanned Yet')}
              </span>
              <span style={{
                padding: '6px 12px',
                borderRadius: 20,
                fontSize: 12,
                fontWeight: 700,
                background: data?.status === 'connected' ? '#dcfce7' : '#fee2e2',
                color: data?.status === 'connected' ? '#15803d' : '#b91c1c'
              }}>
                {data?.status === 'connected' ? '● Connected' : '○ Offline'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Live API URL Card */}
      <div className="api-card" style={{ marginBottom: 24 }}>
        <h3>🌐 HTTP GET / POST Endpoint URL</h3>
        <p style={{ color: '#666', fontSize: 13, margin: '6px 0 12px' }}>
          निचे दिए गए URL पर GET या POST रिक्वेस्ट भेजकर अपने स्कैन किए हुए WhatsApp नंबर से तुरंत मैसेज भेजें:
        </p>

        <div style={{ background: '#1e293b', color: '#f8fafc', padding: '14px 16px', borderRadius: 10, fontFamily: 'monospace', fontSize: 13, overflowX: 'auto', display: 'flex', alignItems: 'center', justifyItems: 'space-between', gap: 12 }}>
          <span style={{ wordBreak: 'break-all' }}>{sampleUrl}</span>
          <button 
            onClick={() => copyText(sampleUrl, 'API URL')} 
            style={{ background: '#128c7e', color: '#fff', border: 'none', borderRadius: 6, padding: '8px 14px', fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}
          >
            {copied === 'API URL' ? '✓ Copied' : '📋 Copy URL'}
          </button>
        </div>

        <div style={{ marginTop: 20 }}>
          <h4 style={{ margin: '0 0 10px', fontSize: 14 }}>Parameter विवरण (Query Parameters):</h4>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: '#f1f5f9', textAlign: 'left' }}>
                <th style={{ padding: 8, border: '1px solid #e2e8f0' }}>Parameter</th>
                <th style={{ padding: 8, border: '1px solid #e2e8f0' }}>Type</th>
                <th style={{ padding: 8, border: '1px solid #e2e8f0' }}>Required</th>
                <th style={{ padding: 8, border: '1px solid #e2e8f0' }}>विवरण (Description)</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style={{ padding: 8, border: '1px solid #e2e8f0' }}><code>token</code></td>
                <td style={{ padding: 8, border: '1px solid #e2e8f0' }}>String</td>
                <td style={{ padding: 8, border: '1px solid #e2e8f0', color: '#16a34a', fontWeight: 700 }}>Yes</td>
                <td style={{ padding: 8, border: '1px solid #e2e8f0' }}>आपका API Token (ऊपर से कॉपी करें)</td>
              </tr>
              <tr>
                <td style={{ padding: 8, border: '1px solid #e2e8f0' }}><code>to</code></td>
                <td style={{ padding: 8, border: '1px solid #e2e8f0' }}>String</td>
                <td style={{ padding: 8, border: '1px solid #e2e8f0', color: '#16a34a', fontWeight: 700 }}>Yes</td>
                <td style={{ padding: 8, border: '1px solid #e2e8f0' }}>10-digit मोबाइल नंबर (e.g. 9876543210) या WhatsApp Group ID (e.g. 120363049565083040@g.us)</td>
              </tr>
              <tr>
                <td style={{ padding: 8, border: '1px solid #e2e8f0' }}><code>message</code></td>
                <td style={{ padding: 8, border: '1px solid #e2e8f0' }}>String</td>
                <td style={{ padding: 8, border: '1px solid #e2e8f0', color: '#16a34a', fontWeight: 700 }}>Yes</td>
                <td style={{ padding: 8, border: '1px solid #e2e8f0' }}>भेजा जाने वाला टेक्स्ट संदेश (URL Encoded)</td>
              </tr>
              <tr>
                <td style={{ padding: 8, border: '1px solid #e2e8f0' }}><code>session</code></td>
                <td style={{ padding: 8, border: '1px solid #e2e8f0' }}>String</td>
                <td style={{ padding: 8, border: '1px solid #e2e8f0', color: '#d97706' }}>Optional</td>
                <td style={{ padding: 8, border: '1px solid #e2e8f0' }}>आपका 10 अंकों का स्कैन WhatsApp नंबर (e.g. {data?.session || '9876543210'})</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Live API Tester */}
      <div className="api-card">
        <h3>⚡ Live API Tester (यहाँ से टेस्ट करें)</h3>
        <p style={{ color: '#666', fontSize: 13, margin: '4px 0 16px' }}>नीचे नंबर/ग्रुप ID और मैसेज लिखकर सीधे API चलाकर टेस्ट करें:</p>
        
        <form onSubmit={runTestApi} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12, alignItems: 'end' }}>
          <div>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 700, marginBottom: 4 }}>Recipient (मोबाइल नंबर या Group ID)</label>
            <input 
              placeholder="मोबाइल नंबर (e.g. 9876543210) या Group ID (@g.us)" 
              value={testTo} 
              onChange={e => setTestTo(e.target.value)} 
              style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #cbd5e1' }}
            />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 700, marginBottom: 4 }}>Message</label>
            <input 
              placeholder="मैसेज लिखें..." 
              value={testMsg} 
              onChange={e => setTestMsg(e.target.value)} 
              style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #cbd5e1' }}
            />
          </div>
          <div>
            <button className="primary" disabled={testing || !data?.token} style={{ width: '100%', padding: '11px' }}>
              {testing ? 'Sending...' : '🚀 Send Test API Request'}
            </button>
          </div>
        </form>

        {testResult && (
          <div style={{ marginTop: 16, background: testResult.status ? '#f0fdf4' : '#fef2f2', border: `1px solid ${testResult.status ? '#bbf7d0' : '#fecaca'}`, borderRadius: 8, padding: 14 }}>
            <b style={{ color: testResult.status ? '#16a34a' : '#dc2626' }}>
              {testResult.status ? '✓ Success: ' : '✗ Error: '}
              {testResult.message}
            </b>
            <pre style={{ marginTop: 8, fontSize: 12, overflowX: 'auto', background: '#fff', padding: 10, borderRadius: 6, border: '1px solid #e2e8f0' }}>
              {JSON.stringify(testResult, null, 2)}
            </pre>
          </div>
        )}
      </div>
    </section>
  )
}

export default ApiPage
