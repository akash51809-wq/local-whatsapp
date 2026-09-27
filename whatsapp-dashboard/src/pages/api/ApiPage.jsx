import React, { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import api from '../../services/api'
import '../../styles/api-docs.css'

export function ApiPage() {
  const { notify, user } = useAuth()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')
  const [copied, setCopied] = useState('')
  const [testTo, setTestTo] = useState('')
  const [testMsg, setTestMsg] = useState('Hello from WhatsApp API!')
  const [testResult, setTestResult] = useState(null)
  const [testing, setTesting] = useState(false)
  const [regenLoading, setRegenLoading] = useState(false)

  const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'https://your-domain.com'

  const loadApiData = useCallback(() => {
    setLoading(true)
    api('/api/user/api-token')
      .then(res => {
        setData(res)
        setLoading(false)
      })
      .catch(() => {
        api('/api/settings/api-token')
          .then(res => {
            setData(res)
            setLoading(false)
          })
          .catch(e => {
            setErr(e.message)
            setLoading(false)
          })
      })
  }, [])

  useEffect(() => {
    loadApiData()
  }, [loadApiData])

  const copyText = (text, key) => {
    if (!text) return
    navigator.clipboard.writeText(text)
    setCopied(key)
    if (notify) notify(`${key} copied to clipboard!`)
    setTimeout(() => setCopied(''), 2000)
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
      alert('Recipient Number / Group ID और Message दोनों दर्ज करें।')
      return
    }
    setTesting(true)
    setTestResult(null)
    try {
      const url = `/api/message/send`
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${data?.token || ''}`
        },
        body: JSON.stringify({
          token: data?.token || '',
          number: testTo.trim(),
          message: testMsg.trim(),
          session: data?.session || ''
        })
      })
      const json = await res.json()
      setTestResult(json)
      if (json.status || json.success) {
        if (notify) notify('API Test message sent successfully!')
      }
    } catch (e) {
      setTestResult({ status: false, message: e.message })
    } finally {
      setTesting(false)
    }
  }

  const currentToken = data?.token || 'YOUR_API_TOKEN'
  const currentSession = data?.session || (user?.mobile || 'main')

  const singleSendUrl = `${baseUrl}/api/message/send`
  const groupSendUrl = `${baseUrl}/api/group/message/send`
  const getUrl = `${baseUrl}/send-text?token=${currentToken}&to=9876543210&message=Hello+from+API${data?.session ? `&session=${data.session}` : ''}`

  const singleRequestBody = JSON.stringify({
    number: "+919876543210",
    message: "Hello from API",
    token: currentToken,
    session: currentSession
  }, null, 2)

  const groupRequestBody = JSON.stringify({
    groupId: "120363012345678901@g.us",
    message: "Hello group",
    token: currentToken,
    session: currentSession
  }, null, 2)

  return (
    <div className="content api-content">
      {/* Intro Header */}
      <div className="api-intro">
        <div>
          <h1>API Docs</h1>
          <p>Integrate automated WhatsApp messaging into your website, CRM, ERP, or billing software.</p>
        </div>
        <div className="api-version">REST API <b>v1.0</b></div>
      </div>

      {err && <div className="alert" style={{ marginBottom: 16 }}>⚠ {err}</div>}

      {/* API Credentials & Session Cards */}
      <div className="api-credentials-grid">
        <div className="cred-card">
          <small>Your Secret API Token</small>
          <div className="cred-token-box">
            <span className="cred-token-code">{loading ? 'Loading...' : currentToken}</span>
            <button 
              type="button" 
              className={`copy-btn ${copied === 'Token' ? 'copied' : ''}`} 
              onClick={() => copyText(data?.token || '', 'Token')}
            >
              <span>{copied === 'Token' ? '✓' : '⧉'}</span> {copied === 'Token' ? 'Copied' : 'Copy'}
            </button>
            <button 
              type="button" 
              className="copy-btn" 
              onClick={regenerateToken} 
              disabled={regenLoading} 
              title="Regenerate API Token"
            >
              <span>{regenLoading ? '...' : '🔄'}</span>
            </button>
          </div>
        </div>

        <div className="cred-card">
          <small>Scanned WhatsApp Session</small>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <strong style={{ fontSize: 15, color: '#183126' }}>
              {data?.session ? `+91 ${data.session}` : (data?.connectedNumber ? `+${data.connectedNumber}` : 'Not Scanned Yet')}
            </strong>
            <span className={`cred-status-pill ${data?.status === 'connected' ? 'connected' : 'offline'}`}>
              <span className="dot" style={{ width: 6, height: 6, margin: 0 }}></span>
              {data?.status === 'connected' ? 'Connected' : 'Offline'}
            </span>
          </div>
        </div>

        <div className="cred-card">
          <small>API Server Base URL</small>
          <div className="cred-token-box">
            <span className="cred-token-code" style={{ fontSize: 12 }}>{baseUrl}</span>
            <button 
              type="button" 
              className={`copy-btn ${copied === 'BaseURL' ? 'copied' : ''}`} 
              onClick={() => copyText(baseUrl, 'BaseURL')}
            >
              <span>{copied === 'BaseURL' ? '✓' : '⧉'}</span> {copied === 'BaseURL' ? 'Copied' : 'Copy'}
            </button>
          </div>
        </div>
      </div>

      {/* Section 01: Send Message API */}
      <section className="api-section">
        <div className="api-section-head">
          <div className="api-number">01</div>
          <div>
            <h2>Send Message API</h2>
            <p>Send a WhatsApp message to a single recipient or a prepared number.</p>
          </div>
          <span className="method-badge post">POST</span>
        </div>

        <div className="api-io">
          <article className="api-panel request-panel">
            <div className="panel-title">
              <div>
                <span className="panel-icon">↗</span>
                <div>
                  <h3>Request URL</h3>
                  <small>Endpoint and request example</small>
                </div>
              </div>
              <button 
                className={`copy-btn ${copied === 'url_01' ? 'copied' : ''}`} 
                onClick={() => copyText(singleSendUrl, 'url_01')} 
                type="button"
              >
                <span>{copied === 'url_01' ? '✓' : '⧉'}</span> {copied === 'url_01' ? 'Copied' : 'Copy'}
              </button>
            </div>
            <div className="url-box">
              <span className="method-mini">POST</span>
              <code>{singleSendUrl}</code>
            </div>
            <div className="code-title">REQUEST BODY (JSON)</div>
            <pre className="code-block"><code>{singleRequestBody}</code></pre>
          </article>

          <article className="api-panel response-panel">
            <div className="panel-title">
              <div>
                <span className="panel-icon response">✓</span>
                <div>
                  <h3>Response</h3>
                  <small>Successful response</small>
                </div>
              </div>
              <span className="status-badge">200 OK</span>
            </div>
            <pre className="code-block response-code"><code>{`{
  "status": true,
  "success": true,
  "message": "Message sent"
}`}</code></pre>
          </article>
        </div>
      </section>

      {/* Section 02: Send Message in Group */}
      <section className="api-section">
        <div className="api-section-head">
          <div className="api-number">02</div>
          <div>
            <h2>Send Message in Group</h2>
            <p>Send a WhatsApp message directly to a selected group.</p>
          </div>
          <span className="method-badge post">POST</span>
        </div>

        <div className="api-io">
          <article className="api-panel request-panel">
            <div className="panel-title">
              <div>
                <span className="panel-icon">↗</span>
                <div>
                  <h3>Request URL</h3>
                  <small>Group messaging endpoint</small>
                </div>
              </div>
              <button 
                className={`copy-btn ${copied === 'url_02' ? 'copied' : ''}`} 
                onClick={() => copyText(groupSendUrl, 'url_02')} 
                type="button"
              >
                <span>{copied === 'url_02' ? '✓' : '⧉'}</span> {copied === 'url_02' ? 'Copied' : 'Copy'}
              </button>
            </div>
            <div className="url-box">
              <span className="method-mini">POST</span>
              <code>{groupSendUrl}</code>
            </div>
            <div className="code-title">REQUEST BODY (JSON)</div>
            <pre className="code-block"><code>{groupRequestBody}</code></pre>
          </article>

          <article className="api-panel response-panel">
            <div className="panel-title">
              <div>
                <span className="panel-icon response">✓</span>
                <div>
                  <h3>Response</h3>
                  <small>Successful response</small>
                </div>
              </div>
              <span className="status-badge">200 OK</span>
            </div>
            <pre className="code-block response-code"><code>{`{
  "status": true,
  "success": true,
  "message": "Group message sent"
}`}</code></pre>
          </article>
        </div>
      </section>

      {/* Section 03: HTTP GET URL API */}
      <section className="api-section">
        <div className="api-section-head">
          <div className="api-number">03</div>
          <div>
            <h2>HTTP GET URL (Simple Webhook / URL Request)</h2>
            <p>One-line instant URL request for Google Sheets, Zapier, Excel, Webhooks, or browser integration.</p>
          </div>
          <span className="method-badge get">GET</span>
        </div>

        <div className="api-io">
          <article className="api-panel request-panel">
            <div className="panel-title">
              <div>
                <span className="panel-icon">↗</span>
                <div>
                  <h3>Request URL</h3>
                  <small>Instant URL format with query parameters</small>
                </div>
              </div>
              <button 
                className={`copy-btn ${copied === 'url_03' ? 'copied' : ''}`} 
                onClick={() => copyText(getUrl, 'url_03')} 
                type="button"
              >
                <span>{copied === 'url_03' ? '✓' : '⧉'}</span> {copied === 'url_03' ? 'Copied' : 'Copy'}
              </button>
            </div>
            <div className="url-box">
              <span className="method-mini get">GET</span>
              <code>{getUrl}</code>
            </div>
            <div className="code-title">SUPPORTED QUERY PARAMETERS</div>
            <pre className="code-block"><code>{`token   : ${currentToken}
to      : 9876543210 (or 120363012345678901@g.us)
message : Hello from API (URL-encoded text)
session : ${currentSession} (optional)
voice   : 1 (optional, to send as voice audio note)`}</code></pre>
          </article>

          <article className="api-panel response-panel">
            <div className="panel-title">
              <div>
                <span className="panel-icon response">✓</span>
                <div>
                  <h3>Response</h3>
                  <small>Successful response</small>
                </div>
              </div>
              <span className="status-badge">200 OK</span>
            </div>
            <pre className="code-block response-code"><code>{`{
  "status": true,
  "message": "Message sent successfully"
}`}</code></pre>
          </article>
        </div>
      </section>

      {/* Parameter Specification Table Card */}
      <div className="card" style={{ marginTop: 16 }}>
        <div className="card-head">
          <div>
            <h3>API Parameters Reference</h3>
            <p>All query and JSON body parameters supported by the messaging endpoints</p>
          </div>
        </div>
        <div className="card-body" style={{ overflowX: 'auto' }}>
          <table className="api-param-table">
            <thead>
              <tr>
                <th>Parameter</th>
                <th>Type</th>
                <th>Required</th>
                <th>Description</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><code>token</code></td>
                <td>String</td>
                <td><span className="badge success">Required</span></td>
                <td>Your secret API token. Can also be passed in HTTP header: <code>Authorization: Bearer YOUR_TOKEN</code> or <code>x-api-token</code>.</td>
              </tr>
              <tr>
                <td><code>number</code> / <code>to</code></td>
                <td>String</td>
                <td><span className="badge success">Required</span></td>
                <td>Recipient's 10-digit mobile number (e.g. <code>9876543210</code>) or group JID (e.g. <code>120363012345678901@g.us</code>).</td>
              </tr>
              <tr>
                <td><code>message</code></td>
                <td>String</td>
                <td><span className="badge success">Required</span></td>
                <td>Text message content to send. Supports emojis and multi-line strings.</td>
              </tr>
              <tr>
                <td><code>session</code></td>
                <td>String</td>
                <td><span className="badge pending">Optional</span></td>
                <td>Your 10-digit scanned WhatsApp number (e.g. <code>{currentSession}</code>). If omitted, default active session is used.</td>
              </tr>
              <tr>
                <td><code>voice</code></td>
                <td>Number / Boolean</td>
                <td><span className="badge pending">Optional</span></td>
                <td>Pass <code>1</code> or <code>true</code> to convert text into Hindi/English speech and send as a WhatsApp Voice Note (PTT).</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Live Interactive API Tester */}
      <div className="card" style={{ marginTop: 16 }}>
        <div className="card-head">
          <div>
            <h3>⚡ Live API Tester (Console)</h3>
            <p>Test sending real WhatsApp messages right from your browser using your active credentials</p>
          </div>
        </div>
        <div className="card-body">
          <form onSubmit={runTestApi} className="api-tester-form">
            <div className="field">
              <label>Recipient Number or Group ID</label>
              <input 
                className="input" 
                placeholder="e.g. 9876543210 or group @g.us" 
                value={testTo} 
                onChange={e => setTestTo(e.target.value)} 
                required 
              />
            </div>
            <div className="field">
              <label>Message Text</label>
              <input 
                className="input" 
                placeholder="Type test message..." 
                value={testMsg} 
                onChange={e => setTestMsg(e.target.value)} 
                required 
              />
            </div>
            <div className="field" style={{ alignSelf: 'end' }}>
              <button 
                type="submit" 
                className="btn primary" 
                disabled={testing || !data?.token} 
                style={{ width: '100%', height: 42, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
              >
                {testing ? 'Sending...' : '🚀 Send Test API Request'}
              </button>
            </div>
          </form>

          {testResult && (
            <div className={`api-tester-result ${testResult.status || testResult.success ? 'success' : 'error'}`}>
              <strong style={{ color: testResult.status || testResult.success ? '#15803d' : '#b91c1c' }}>
                {testResult.status || testResult.success ? '✓ API Success: ' : '✗ API Error: '}
                {testResult.message || 'Response received'}
              </strong>
              <pre><code>{JSON.stringify(testResult, null, 2)}</code></pre>
            </div>
          )}
        </div>
      </div>

      {/* API Note Footer matching sample UI */}
      <div className="api-note" style={{ marginTop: 20 }}>
        <span>✦</span>
        <div>
          <strong>API Base URL</strong>
          <small>All API requests should be sent to your active server address: <b>{baseUrl}</b></small>
        </div>
      </div>
    </div>
  )
}

export default ApiPage
