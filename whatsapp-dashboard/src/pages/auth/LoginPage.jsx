import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import api from '../../services/api'

export function LoginPage() {
  const { handleLogin, companySettings, loadCompanySettings } = useAuth()
  const navigate = useNavigate()

  const [u, setU] = useState('')
  const [p, setP] = useState('')
  const [err, setErr] = useState('')
  const [loading, setLoading] = useState(false)
  const [rememberMe, setRememberMe] = useState(true)
  const [inactivityNotice, setInactivityNotice] = useState(false)

  useEffect(() => {
    if (loadCompanySettings) {
      loadCompanySettings()
    }
    const reason = sessionStorage.getItem('wa_logout_reason')
    if (reason === 'inactivity') {
      setInactivityNotice(true)
      sessionStorage.removeItem('wa_logout_reason')
    }
  }, [loadCompanySettings])

  const submit = async (e) => { 
    e.preventDefault()
    if (!u.trim() || !p) return setErr('Username और Password दोनों भरें।')
    setLoading(true)
    setErr('')
    try { 
      const d = await api('/api/auth/login', { 
        method: 'POST', 
        body: JSON.stringify({ username: u.trim(), password: p }) 
      })
      if (d.success) { 
        handleLogin(d.user.token, d.user)
        navigate('/dashboard')
      } 
    } catch (e) { 
      setErr(e.message || 'Login failed') 
    } finally { 
      setLoading(false)
    }
  }

  return (
    <div className="page-style1">
      <div className="page">
        <div className="page-single">
          <div className="container">
            <div className="row">
              <div className="col mx-auto">
                <div className="row justify-content-center">
                  <div className="col-md-7 col-lg-4">
                    <div className="error-logo text-center">
                      <a href="/" style={{ display: 'inline-block' }}>
                        {companySettings?.logoUrl ? (
                          <img 
                            src={companySettings.logoUrl} 
                            className="header-brand-img dark-logo" 
                            alt={companySettings?.companyName || "logo"} 
                            style={{ maxHeight: '60px', maxWidth: '240px', objectFit: 'contain' }}
                          />
                        ) : (
                          <img src="/assets/images/brand/logo2.png" className="header-brand-img dark-logo" alt="logo" />
                        )}
                      </a>
                      {companySettings?.companyName && (
                        <div style={{ marginTop: '8px', fontSize: '13.5px', fontWeight: 600, color: '#6c757d', letterSpacing: '0.4px' }}>
                          {companySettings.companyName}
                        </div>
                      )}
                    </div>
                    <div className="card mb-0">
                      <div className="card-body">
                        <div className="text-center mb-6">
                          <h2 className="mb-2">Login</h2>
                        </div>
                        <form onSubmit={submit}>
                          {inactivityNotice && (
                            <div className="alert alert-warning mb-4 text-left" role="alert" style={{ fontSize: '12.5px', lineHeight: '1.45', borderRadius: '8px', borderLeft: '4px solid #ff9800' }}>
                              <div className="d-flex align-items-center mb-1">
                                <span style={{ fontSize: '15px', marginRight: '6px' }}>⏱️</span>
                                <strong style={{ color: '#2b2b2b' }}>सत्र समाप्त (Session Timed Out)</strong>
                              </div>
                              <div style={{ color: '#495057' }}>
                                30 मिनट तक निष्क्रिय रहने के कारण वेब सुरक्षा हेतु आपका सत्र समाप्त हो गया है। कृपया पुनः लॉगिन करें।
                              </div>
                              <div className="mt-1 font-weight-semibold text-success" style={{ fontSize: '11px' }}>
                                ✓ WhatsApp बैकएंड और API संदेश सुचारू रूप से सक्रिय हैं।
                              </div>
                            </div>
                          )}
                          {err && (
                            <div className="alert alert-danger mb-4" role="alert">
                              {err}
                            </div>
                          )}
                          <div className="input-group mb-4">
                            <input 
                              type="text" 
                              className="form-control" 
                              placeholder="Username" 
                              value={u}
                              onChange={e => setU(e.target.value)}
                              autoFocus
                            />
                          </div>
                          <div className="input-group mb-4">
                            <input 
                              type="password" 
                              className="form-control" 
                              placeholder="Password" 
                              value={p}
                              onChange={e => setP(e.target.value)}
                            />
                          </div>
                          <div className="row">
                            <div className="col-6">
                              <div className="form-group mb-0">
                                <label className="custom-control custom-checkbox mb-0">
                                  <input 
                                    type="checkbox" 
                                    className="custom-control-input" 
                                    checked={rememberMe}
                                    onChange={e => setRememberMe(e.target.checked)}
                                  />
                                  <span className="custom-control-label text-muted">Remember me</span>
                                </label>
                              </div>
                            </div>
                            <div className="col-6 text-right mt-1">
                              <a 
                                href="#forgot" 
                                className="text-muted"
                                onClick={e => {
                                  e.preventDefault()
                                  alert('Password recovery: Please contact system administrator (admin / admin123) or check your WhatsApp credentials.')
                                }}
                              >
                                Forgot password?
                              </a>
                            </div>
                            <div className="col-12 mt-5">
                              <button type="submit" className="btn btn-lg btn-primary btn-block" disabled={loading}>
                                {loading ? 'Logging in...' : 'Login'}
                              </button>
                            </div>
                          </div>
                          <div className="text-center mt-7 mb-5">
                            <div className="font-weight-normal fs-16 text-muted">
                              You Don't have an account <a className="btn-link font-weight-normal" href="/signup.html">Register Here</a>
                            </div>
                          </div>
                        </form>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default LoginPage
