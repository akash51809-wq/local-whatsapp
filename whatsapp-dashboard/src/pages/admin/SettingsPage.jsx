import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { api, getToken } from '../../services/api';
import '../../styles/settings.css';

// All tabs defined for Admin and Regular Users
const ALL_TABS = [
  { key: 'company',        icon: '▦',  label: 'Company',        adminOnly: true },
  { key: 'api',            icon: '⚙',  label: 'API Setting',    adminOnly: false },
  { key: 'whatsapp',       icon: '◉',  label: 'WhatsApp',       adminOnly: false },
  { key: 'gdrive',         icon: '◈',  label: 'G Drive',        adminOnly: true },
  { key: 'gmail',          icon: '✉',  label: 'Gmail',          adminOnly: true },
  { key: 'gemini',         icon: '✦',  label: 'Gemini',         adminOnly: false },
  { key: 'email-template', icon: '▤',  label: 'Email Template', adminOnly: true },
  { key: 'system',         icon: '⚡',  label: 'System Info',    adminOnly: true },
  { key: 'security',       icon: '🔒',  label: 'Security',       adminOnly: false },
];

const apiGet  = (url) => api(url, { method: 'GET' });
const apiPost = (url, body) => api(url, { method: 'POST', body: JSON.stringify(body) });

function SInput({ type = 'text', value, onChange, placeholder, ...rest }) {
  return (
    <input
      className="sinput"
      type={type}
      value={value ?? ''}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      {...rest}
    />
  );
}

// ─── Tab 1: Company & Branding (Admin Only) ──────────────────────────────────
function CompanyTab({ notify }) {
  const { companySettings, updateCompanySettings } = useAuth();
  const [form, setForm] = useState({ companyName: '', faviconUrl: '', logoUrl: '' });
  const [saving, setSaving] = useState(false);
  const [previewTheme, setPreviewTheme] = useState('light');
  const faviconInputRef = useRef(null);
  const logoInputRef = useRef(null);

  useEffect(() => {
    if (companySettings) {
      setForm({
        companyName: companySettings.companyName || '',
        faviconUrl: companySettings.faviconUrl || '',
        logoUrl: companySettings.logoUrl || ''
      });
    }
  }, [companySettings]);

  const handleImageFile = (file, type) => {
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      notify('File size must be under 5MB', 'error');
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target.result;
      if (type === 'favicon') {
        setForm(prev => ({ ...prev, faviconUrl: dataUrl }));
        notify('Favicon image loaded! Click Save to apply.', 'success');
      } else if (type === 'logo') {
        setForm(prev => ({ ...prev, logoUrl: dataUrl }));
        notify('Logo image loaded! Click Save to apply.', 'success');
      }
    };
    reader.readAsDataURL(file);
  };

  const save = async (e) => {
    e?.preventDefault();
    setSaving(true);
    try {
      const res = await apiPost('/api/settings/company', form);
      if (res.success) {
        if (updateCompanySettings) updateCompanySettings(res.settings || form);
        notify('Company settings saved successfully!', 'success');
      } else {
        notify(res.message || 'Save failed', 'error');
      }
    } catch (err) {
      notify(err.message || 'Network error', 'error');
    } finally {
      setSaving(false);
    }
  };

  const resetDefaults = async () => {
    if (!window.confirm('Reset company branding (Name, Logo, Favicon) to default?')) return;
    const defaults = { companyName: '', faviconUrl: '', logoUrl: '' };
    setForm(defaults);
    setSaving(true);
    try {
      const res = await apiPost('/api/settings/company', defaults);
      if (res.success) {
        if (updateCompanySettings) updateCompanySettings(defaults);
        notify('Default branding restored!', 'success');
      }
    } catch (err) {
      notify('Reset failed: ' + err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: 20 }}>
      {/* Settings Form */}
      <article className="card settings-form" style={{ width: '100%', maxWidth: 'none' }}>
        <div className="scard-head">
          <div>
            <h3>Company Branding & Identity</h3>
            <p>Customize your dashboard website name, browser tab icon (favicon), and top navbar logo.</p>
          </div>
          <button type="button" className="btn secondary" onClick={resetDefaults} style={{ padding: '6px 12px', fontSize: 12 }}>
            Reset Defaults
          </button>
        </div>
        <div className="card-body">
          <form onSubmit={save}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div className="field">
                <label>COMPANY / WEBSITE NAME</label>
                <SInput
                  value={form.companyName}
                  onChange={v => setForm(f => ({ ...f, companyName: v }))}
                  placeholder="e.g. Easy Recharge / My WhatsApp Portal"
                />
              </div>

              <div className="field">
                <label>WEBSITE FAVICON (Browser Tab Icon)</label>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                  <input
                    type="file"
                    ref={faviconInputRef}
                    accept="image/*"
                    style={{ display: 'none' }}
                    onChange={e => handleImageFile(e.target.files?.[0], 'favicon')}
                  />
                  <button type="button" className="btn secondary" onClick={() => faviconInputRef.current?.click()} style={{ padding: '8px 14px' }}>
                    📁 Choose Favicon File
                  </button>
                  {form.faviconUrl && (
                    <img src={form.faviconUrl} alt="Favicon" style={{ width: 28, height: 28, borderRadius: 6, border: '1px solid #cbd5e1', objectFit: 'contain' }} />
                  )}
                  {form.faviconUrl && (
                    <button type="button" className="btn secondary" onClick={() => setForm(f => ({ ...f, faviconUrl: '' }))} style={{ padding: '4px 10px', fontSize: 12 }}>
                      Remove
                    </button>
                  )}
                </div>
              </div>

              <div className="field">
                <label>WEBSITE LOGO (Sidebar / Header)</label>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                  <input
                    type="file"
                    ref={logoInputRef}
                    accept="image/*"
                    style={{ display: 'none' }}
                    onChange={e => handleImageFile(e.target.files?.[0], 'logo')}
                  />
                  <button type="button" className="btn secondary" onClick={() => logoInputRef.current?.click()} style={{ padding: '8px 14px' }}>
                    📁 Choose Logo File
                  </button>
                  {form.logoUrl && (
                    <img src={form.logoUrl} alt="Logo" style={{ maxHeight: 34, maxWidth: 120, objectFit: 'contain', background: '#f1f5f9', padding: 4, borderRadius: 6 }} />
                  )}
                  {form.logoUrl && (
                    <button type="button" className="btn secondary" onClick={() => setForm(f => ({ ...f, logoUrl: '' }))} style={{ padding: '4px 10px', fontSize: 12 }}>
                      Remove
                    </button>
                  )}
                </div>
              </div>

              <div style={{ marginTop: 8 }}>
                <button type="submit" className="btn primary" disabled={saving}>
                  {saving ? 'Saving...' : '💾 Save Company Settings'}
                </button>
              </div>
            </div>
          </form>
        </div>
      </article>

      {/* Live Preview Column */}
      <article className="card" style={{ width: '100%', maxWidth: 'none' }}>
        <div className="scard-head">
          <div>
            <h3>Live Branding Preview</h3>
            <p>See exactly how your branding appears to users across the browser</p>
          </div>
        </div>
        <div className="card-body">
          {/* Browser Tab Preview */}
          <div className="preview-box">
            <small style={{ display: 'block', fontWeight: 800, color: '#718078', marginBottom: 6 }}>1. BROWSER TAB PREVIEW</small>
            <div className="browser-tab-mock">
              {form.faviconUrl ? (
                <img src={form.faviconUrl} alt="Favicon" />
              ) : (
                <span style={{ fontSize: 14 }}>⚡</span>
              )}
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {form.companyName || 'WhatsApp Automation'}
              </span>
              <span className="tab-close">×</span>
            </div>
          </div>

          {/* Menu Bar Logo Preview */}
          <div className="preview-box" style={{ marginTop: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <small style={{ fontWeight: 800, color: '#718078' }}>2. MENU BAR LOGO PREVIEW</small>
              <div style={{ display: 'flex', gap: 4 }}>
                <button
                  type="button"
                  className={`btn ${previewTheme === 'light' ? 'primary' : 'secondary'}`}
                  onClick={() => setPreviewTheme('light')}
                  style={{ padding: '4px 8px', fontSize: 11 }}
                >
                  Light
                </button>
                <button
                  type="button"
                  className={`btn ${previewTheme === 'dark' ? 'primary' : 'secondary'}`}
                  onClick={() => setPreviewTheme('dark')}
                  style={{ padding: '4px 8px', fontSize: 11 }}
                >
                  Dark
                </button>
              </div>
            </div>
            <div className={`sidebar-logo-mock ${previewTheme}`}>
              {form.logoUrl ? (
                <img src={form.logoUrl} alt="Brand Logo" />
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 34, height: 34, borderRadius: 10, background: 'linear-gradient(145deg, #35c987, #0f9b61)', display: 'grid', placeItems: 'center', color: '#fff', fontWeight: 900 }}>⚡</div>
                  <div>
                    <strong style={{ display: 'block', fontSize: 13 }}>{form.companyName || 'Easy Recharge'}</strong>
                    <small style={{ display: 'block', fontSize: 9, opacity: 0.7 }}>WhatsApp Automation</small>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </article>
    </div>
  );
}

// ─── Tab 2: API Setting ───────────────────────────────────────────────────────
function ApiTab({ notify }) {
  const [form, setForm]   = useState({ allowedIp: '', callbackUrl: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    apiGet('/api/settings/api-setting')
      .then(r => { if (r?.data) setForm({ allowedIp: r.data.allowedIp || '', callbackUrl: r.data.callbackUrl || '' }); })
      .catch(() => {});
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      const r = await apiPost('/api/settings/api-setting', form);
      notify(r.success ? 'API Setting saved!' : (r.message || 'Save failed'), r.success ? 'success' : 'error');
    } catch (e) { notify(e.message || 'Network error', 'error'); }
    setSaving(false);
  };

  return (
    <article className="card api-settings-card">
      <div className="scard-head">
        <div>
          <h3>API Setting</h3>
          <p>Configure allowed IP addresses and webhook callback URL for external API requests.</p>
        </div>
      </div>
      <div className="api-form">
        <div className="api-field">
          <label htmlFor="api-ip">Allowed IP (Leave blank for all)</label>
          <SInput id="api-ip" value={form.allowedIp} onChange={v => setForm(f => ({ ...f, allowedIp: v }))} placeholder="e.g. 192.168.1.100 or *" />
        </div>
        <div className="api-field">
          <label htmlFor="callback-url">Callback / Webhook URL</label>
          <SInput id="callback-url" type="url" value={form.callbackUrl} onChange={v => setForm(f => ({ ...f, callbackUrl: v }))} placeholder="https://your-crm.com/webhook" />
        </div>
        <div className="api-actions">
          <button className="btn primary" onClick={save} disabled={saving} style={{ height: 46 }}>{saving ? 'Saving…' : 'Save'}</button>
        </div>
      </div>
    </article>
  );
}

// ─── Tab 3: WhatsApp Setting ──────────────────────────────────────────────────
function WhatsAppTab({ notify }) {
  const [queue,       setQueue]       = useState({ minDelay: '', maxDelay: '' });
  const [savingQueue, setSavingQueue] = useState(false);
  const [autoImg,     setAutoImg]     = useState({ enabled: false, imageUrl: '', fileName: '' });
  const [imgFile,     setImgFile]     = useState(null);
  const [savingImg,   setSavingImg]   = useState(false);
  const fileInputRef = useRef(null);

  useEffect(() => {
    apiGet('/api/settings/wa-queue')
      .then(r => { if (r?.data) setQueue({ minDelay: r.data.minDelay ?? '', maxDelay: r.data.maxDelay ?? '' }); })
      .catch(() => {});

    apiGet('/api/user/settings/auto-image')
      .then(r => { if (r?.autoSendImage) setAutoImg({ enabled: r.autoSendImage.enabled || false, imageUrl: r.autoSendImage.imageUrl || '', fileName: r.autoSendImage.fileName || '' }); })
      .catch(() => {});
  }, []);

  const saveQueue = async () => {
    setSavingQueue(true);
    try {
      const r = await apiPost('/api/settings/wa-queue', { minDelay: Number(queue.minDelay), maxDelay: Number(queue.maxDelay) });
      notify(r.success ? 'Queue delay saved!' : (r.message || 'Save failed'), r.success ? 'success' : 'error');
    } catch (e) { notify(e.message || 'Network error', 'error'); }
    setSavingQueue(false);
  };

  const saveAutoImg = async () => {
    setSavingImg(true);
    try {
      const fd = new FormData();
      fd.append('enabled', autoImg.enabled);
      fd.append('imageUrl', autoImg.imageUrl || '');
      if (imgFile) fd.append('image', imgFile);
      const res = await fetch('/api/user/settings/auto-image', {
        method: 'POST',
        headers: { Authorization: `Bearer ${getToken()}` },
        body: fd,
      });
      const r = await res.json();
      notify(r.success ? 'Auto image settings saved!' : (r.message || 'Save failed'), r.success ? 'success' : 'error');
    } catch (e) { notify(e.message || 'Network error', 'error'); }
    setSavingImg(false);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Card 1: Queue Delay */}
      <article className="card wa-setting-card">
        <div className="scard-head">
          <div>
            <h3>Message Queue Delay</h3>
            <p>Control anti-ban delivery intervals between bulk messages.</p>
          </div>
        </div>
        <div className="wa-form-row">
          <div className="wa-field">
            <label>MIN DELAY (SECONDS)</label>
            <SInput type="number" min="0" value={queue.minDelay} onChange={v => setQueue(q => ({ ...q, minDelay: v }))} placeholder="3" />
          </div>
          <div className="wa-field">
            <label>MAX DELAY (SECONDS)</label>
            <SInput type="number" min="0" value={queue.maxDelay} onChange={v => setQueue(q => ({ ...q, maxDelay: v }))} placeholder="8" />
          </div>
          <button className="btn primary" onClick={saveQueue} disabled={savingQueue} style={{ height: 46 }}>
            {savingQueue ? 'Saving…' : 'Save'}
          </button>
        </div>
      </article>

      {/* Card 2: Auto Send Image with WhatsApp Live Preview */}
      <article className="card wa-setting-card">
        <div className="scard-head">
          <div>
            <h3>Auto Send Image with API Message</h3>
            <p>Automatically attach your promotional banner, flyer, or business card whenever an API message is sent.</p>
          </div>
          <button
            type="button"
            className={`compact-toggle ${autoImg.enabled ? 'on' : 'off'}`}
            onClick={() => setAutoImg(a => ({ ...a, enabled: !a.enabled }))}
          >
            <span />
            {autoImg.enabled ? 'Enabled' : 'Disabled'}
          </button>
        </div>
        <div className="card-body">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
            <div>
              <div className="field">
                <label>UPLOAD IMAGE OR ENTER IMAGE URL</label>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 10 }}>
                  <input
                    type="file"
                    ref={fileInputRef}
                    accept="image/*"
                    style={{ display: 'none' }}
                    onChange={e => {
                      const f = e.target.files?.[0];
                      if (f) {
                        setImgFile(f);
                        const r = new FileReader();
                        r.onload = ev => setAutoImg(prev => ({ ...prev, imageUrl: ev.target.result, fileName: f.name }));
                        r.readAsDataURL(f);
                      }
                    }}
                  />
                  <button type="button" className="btn secondary" onClick={() => fileInputRef.current?.click()} style={{ padding: '8px 12px' }}>
                    📁 Choose Image File
                  </button>
                  {autoImg.imageUrl && (
                    <button type="button" className="btn secondary" onClick={() => { setAutoImg(a => ({ ...a, imageUrl: '', fileName: '' })); setImgFile(null); }} style={{ padding: '4px 10px', fontSize: 12 }}>
                      Clear
                    </button>
                  )}
                </div>
                <SInput
                  value={autoImg.imageUrl?.startsWith('data:') ? '' : autoImg.imageUrl}
                  onChange={v => setAutoImg(a => ({ ...a, imageUrl: v }))}
                  placeholder="Or paste public Image URL (https://...)"
                />
              </div>

              <div style={{ marginTop: 16 }}>
                <button type="button" className="btn primary" onClick={saveAutoImg} disabled={savingImg}>
                  {savingImg ? 'Saving...' : '💾 Save Image Settings'}
                </button>
              </div>
            </div>

            {/* Simulated WhatsApp Bubble */}
            <div>
              <small style={{ fontWeight: 800, color: '#718078', display: 'block', marginBottom: 8 }}>WHATSAPP LIVE PREVIEW</small>
              <div style={{ background: '#eae6df', padding: 14, borderRadius: 12, minHeight: 180, display: 'flex', justifyContent: 'flex-end' }}>
                <div style={{ background: '#d9fdd3', borderRadius: '8px 2px 8px 8px', maxWidth: '85%', width: 240, padding: 4, boxShadow: '0 1px 2px rgba(0,0,0,.15)' }}>
                  {autoImg.imageUrl ? (
                    <img src={autoImg.imageUrl} alt="Preview" style={{ width: '100%', maxHeight: 150, objectFit: 'cover', borderRadius: 6, display: 'block' }} />
                  ) : (
                    <div style={{ height: 100, background: '#e2e8f0', borderRadius: 6, display: 'grid', placeItems: 'center', color: '#64748b', fontSize: 12 }}>
                      No Image Selected
                    </div>
                  )}
                  <div style={{ padding: '6px 8px', fontSize: 12, color: '#111b21', lineHeight: 1.4 }}>
                    Hello! This caption represents your automated WhatsApp message. ✨
                    <div style={{ textAlign: 'right', fontSize: 10, color: '#53bdeb', fontWeight: 'bold', marginTop: 2 }}>✓✓ 12:45 PM</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </article>
    </div>
  );
}

// ─── Tab 4: G Drive Setting (Admin Only) ──────────────────────────────────────
function GDriveTab({ notify }) {
  const [form, setForm] = useState({ clientId: '', clientSecret: '', redirectUri: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    apiGet('/api/settings/gdrive')
      .then(r => { if (r?.data) setForm({ clientId: r.data.clientId || '', clientSecret: r.data.clientSecret || '', redirectUri: r.data.redirectUri || '' }); })
      .catch(() => {});
  }, []);

  const save = async (e) => {
    e?.preventDefault();
    setSaving(true);
    try {
      const r = await apiPost('/api/settings/gdrive', form);
      notify(r.success ? 'Google Drive settings saved!' : (r.message || 'Save failed'), r.success ? 'success' : 'error');
    } catch (e) { notify(e.message || 'Network error', 'error'); }
    setSaving(false);
  };

  return (
    <article className="card settings-form">
      <div className="scard-head">
        <div>
          <h3>Google Drive Setting</h3>
          <p>Configure Google Drive OAuth credentials for cloud backup and file attachments.</p>
        </div>
        <button className="btn primary" onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save Changes'}</button>
      </div>
      <div className="card-body">
        <div className="fields">
          <div className="field">
            <label>GOOGLE CLIENT ID</label>
            <SInput value={form.clientId} onChange={v => setForm(f => ({ ...f, clientId: v }))} placeholder="Enter OAuth Client ID" />
          </div>
          <div className="field">
            <label>GOOGLE CLIENT SECRET</label>
            <SInput type="password" value={form.clientSecret} onChange={v => setForm(f => ({ ...f, clientSecret: v }))} placeholder="Enter Client Secret" />
          </div>
          <div className="field full">
            <label>REDIRECT URI</label>
            <SInput value={form.redirectUri} onChange={v => setForm(f => ({ ...f, redirectUri: v }))} placeholder="https://your-domain.com/oauth2callback" />
          </div>
        </div>
      </div>
    </article>
  );
}

// ─── Tab 5: Gmail Setting (Admin Only) ────────────────────────────────────────
function GmailTab({ notify }) {
  const [form, setForm] = useState({ gmailAddress: '', smtpHost: 'smtp.gmail.com', smtpPort: '587', appPassword: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    apiGet('/api/settings/gmail')
      .then(r => {
        if (r?.data) {
          setForm({
            gmailAddress: r.data.gmailAddress || '',
            smtpHost: r.data.smtpHost || 'smtp.gmail.com',
            smtpPort: r.data.smtpPort || '587',
            appPassword: r.data.appPassword || ''
          });
        }
      })
      .catch(() => {});
  }, []);

  const save = async (e) => {
    e?.preventDefault();
    setSaving(true);
    try {
      const r = await apiPost('/api/settings/gmail', form);
      notify(r.success ? 'Gmail & SMTP settings saved!' : (r.message || 'Save failed'), r.success ? 'success' : 'error');
    } catch (e) { notify(e.message || 'Network error', 'error'); }
    setSaving(false);
  };

  return (
    <article className="card settings-form">
      <div className="scard-head">
        <div>
          <h3>Gmail & SMTP Setting</h3>
          <p>Configure outgoing email delivery settings for user OTPs, alerts, and notifications.</p>
        </div>
        <button className="btn primary" onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save Changes'}</button>
      </div>
      <div className="card-body">
        <div className="fields">
          <div className="field">
            <label>GMAIL / SENDER ADDRESS</label>
            <SInput type="email" value={form.gmailAddress} onChange={v => setForm(f => ({ ...f, gmailAddress: v }))} placeholder="support@yourdomain.com" />
          </div>
          <div className="field">
            <label>SMTP HOST</label>
            <SInput value={form.smtpHost} onChange={v => setForm(f => ({ ...f, smtpHost: v }))} placeholder="smtp.gmail.com" />
          </div>
          <div className="field">
            <label>SMTP PORT</label>
            <SInput value={form.smtpPort} onChange={v => setForm(f => ({ ...f, smtpPort: v }))} placeholder="587" />
          </div>
          <div className="field">
            <label>APP PASSWORD / API KEY</label>
            <SInput type="password" value={form.appPassword} onChange={v => setForm(f => ({ ...f, appPassword: v }))} placeholder="16-character App Password" />
          </div>
        </div>
      </div>
    </article>
  );
}

// ─── Tab 6: Gemini AI ─────────────────────────────────────────────────────────
function GeminiTab({ notify }) {
  const [keys, setKeys]   = useState([{ id: `g_${Date.now()}`, apiKey: '', model: 'Gemini Flash' }]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    apiGet('/api/settings/gemini')
      .then(r => { if (Array.isArray(r?.keys) && r.keys.length > 0) setKeys(r.keys); })
      .catch(() => {});
  }, []);

  const addKey    = () => setKeys(k => [...k, { id: `g_${Date.now()}`, apiKey: '', model: 'Gemini Flash' }]);
  const removeKey = (id) => { if (keys.length > 1) setKeys(k => k.filter(x => x.id !== id)); };
  const updateKey = (id, field, value) => setKeys(k => k.map(x => x.id === id ? { ...x, [field]: value } : x));

  const save = async () => {
    setSaving(true);
    try {
      const r = await apiPost('/api/settings/gemini', { keys });
      if (r.success) { notify('Gemini settings saved!', 'success'); if (Array.isArray(r.keys)) setKeys(r.keys); }
      else notify(r.message || 'Save failed', 'error');
    } catch (e) { notify(e.message || 'Network error', 'error'); }
    setSaving(false);
  };

  return (
    <article className="card settings-form">
      <div className="scard-head">
        <div><h3>Gemini API Settings</h3><p>Add and manage multiple Gemini API keys for AI chat and auto-replies.</p></div>
        <button className="btn primary" onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
      </div>
      <div className="card-body">
        <div className="gemini-keys">
          {keys.map(k => (
            <div key={k.id} className="gemini-row">
              <div className="field">
                <label>GEMINI API KEY</label>
                <SInput type="password" value={k.apiKey} onChange={v => updateKey(k.id, 'apiKey', v)} placeholder="Enter Gemini API key" />
              </div>
              <div className="field">
                <label>MODEL</label>
                <select className="select sinput" value={k.model} onChange={e => updateKey(k.id, 'model', e.target.value)}>
                  <option>Gemini Flash</option>
                  <option>Gemini Pro</option>
                  <option>Gemini 1.5 Flash</option>
                  <option>Gemini 1.5 Pro</option>
                </select>
              </div>
              <button type="button" className="remove-key" title="Remove" onClick={() => removeKey(k.id)} disabled={keys.length <= 1}>×</button>
            </div>
          ))}
        </div>
        <div className="actions-row">
          <button type="button" className="btn secondary" onClick={addKey}>＋ Add Gemini Key</button>
        </div>
      </div>
    </article>
  );
}

// ─── Tab 7: Email Template (Admin Only) ───────────────────────────────────────
function EmailTemplateTab({ notify }) {
  const [form, setForm] = useState({ subject: '', htmlTemplate: '', availableVariables: '{{name}}, {{number}}, {{message}}' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    apiGet('/api/settings/email-template')
      .then(r => { if (r?.data) setForm(r.data); })
      .catch(() => {});
  }, []);

  const save = async (e) => {
    e?.preventDefault();
    setSaving(true);
    try {
      const r = await apiPost('/api/settings/email-template', form);
      notify(r.success ? 'Email template saved!' : (r.message || 'Save failed'), r.success ? 'success' : 'error');
    } catch (e) { notify(e.message || 'Network error', 'error'); }
    setSaving(false);
  };

  return (
    <article className="card settings-form">
      <div className="scard-head">
        <div>
          <h3>Email Template</h3>
          <p>Create and customize HTML template for customer emails and transaction notifications.</p>
        </div>
        <button className="btn primary" onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save Changes'}</button>
      </div>
      <div className="card-body">
        <div className="fields">
          <div className="field full">
            <label>EMAIL SUBJECT</label>
            <SInput value={form.subject} onChange={v => setForm(f => ({ ...f, subject: v }))} placeholder="e.g. WhatsApp Service Notification - {{name}}" />
          </div>
          <div className="field full">
            <label>HTML TEMPLATE CODE</label>
            <textarea
              className="textarea sinput"
              rows={8}
              style={{ fontFamily: 'Consolas, monospace', fontSize: 13, height: 'auto', minHeight: 180 }}
              value={form.htmlTemplate}
              onChange={e => setForm(f => ({ ...f, htmlTemplate: e.target.value }))}
              placeholder="<p>Dear {{name}},</p><p>Your WhatsApp message has been delivered to {{number}}.</p>"
            />
          </div>
          <div className="field full">
            <label>AVAILABLE VARIABLES</label>
            <SInput value={form.availableVariables} onChange={v => setForm(f => ({ ...f, availableVariables: v }))} placeholder="{{name}}, {{number}}, {{message}}" />
          </div>
        </div>
      </div>
    </article>
  );
}

// ─── Tab 8: System & Keep-Alive (Admin Only) ──────────────────────────────────
function SystemTab({ notify }) {
  const [pingData, setPingData] = useState(null);
  const [systemInfo, setSystemInfo] = useState(null);
  const [pinging, setPinging] = useState(false);

  const loadData = useCallback(() => {
    apiGet('/api/system/autoping').then(r => setPingData(r?.stats)).catch(() => {});
    apiGet('/api/admin/system-info').then(r => setSystemInfo(r?.info)).catch(() => {});
  }, []);

  useEffect(() => {
    loadData();
    const t = setInterval(loadData, 15000);
    return () => clearInterval(t);
  }, [loadData]);

  const triggerPing = async () => {
    setPinging(true);
    try {
      const res = await apiPost('/api/system/autoping/trigger', {});
      if (res?.stats) setPingData(res.stats);
      notify('Keep-Alive Ping triggered successfully!', 'success');
    } catch (e) {
      notify(e.message || 'Ping failed', 'error');
    } finally {
      setPinging(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Auto-Ping Card */}
      <article className="card">
        <div className="scard-head">
          <div>
            <h3>⏰ Render 24/7 Keep-Alive AutoPing</h3>
            <p>Automatic background ping scheduler to keep your server running 24/7 without going to sleep.</p>
          </div>
          <button className="btn primary" onClick={triggerPing} disabled={pinging} style={{ height: 38, padding: '0 16px' }}>
            {pinging ? 'Pinging...' : '⚡ Ping Now'}
          </button>
        </div>
        <div className="card-body">
          <div className="system-stats-grid">
            <div className="sys-stat-card">
              <small>Scheduler Status</small>
              <strong style={{ color: '#15803d' }}>● Active (24/7 Awake)</strong>
            </div>
            <div className="sys-stat-card">
              <small>Ping Interval</small>
              <strong>{pingData?.intervalMinutes ? `${pingData.intervalMinutes} Minutes` : '5 Minutes'}</strong>
            </div>
            <div className="sys-stat-card">
              <small>Total Successful Pings</small>
              <strong>{pingData?.totalPings ?? 0}</strong>
            </div>
            <div className="sys-stat-card">
              <small>Last Ping Response</small>
              <span style={{ fontSize: 12, fontWeight: 700, color: '#334155' }}>
                {pingData?.lastPingStatus || 'Pending'}
              </span>
            </div>
          </div>
        </div>
      </article>

      {/* System Specifications Card */}
      {systemInfo && (
        <article className="card">
          <div className="scard-head">
            <div>
              <h3>Server Specifications & Host Info</h3>
              <p>Platform hardware and Node.js runtime information</p>
            </div>
          </div>
          <div className="card-body">
            <div className="system-stats-grid">
              <div className="sys-stat-card">
                <small>Platform & OS</small>
                <strong>{systemInfo.platform || 'Linux'}</strong>
              </div>
              <div className="sys-stat-card">
                <small>Node.js Runtime</small>
                <strong>{systemInfo.nodeVersion || process.version}</strong>
              </div>
              <div className="sys-stat-card">
                <small>Server Uptime</small>
                <strong>{systemInfo.uptime || 'Active'}</strong>
              </div>
              <div className="sys-stat-card">
                <small>Memory (RAM) Usage</small>
                <strong>{systemInfo.memoryUsage || 'Normal'}</strong>
              </div>
            </div>
          </div>
        </article>
      )}
    </div>
  );
}

// ─── Tab 9: Security ──────────────────────────────────────────────────────────
function SecurityTab({ notify }) {
  const [form, setForm]   = useState({ oldPassword: '', newPassword: '', rePassword: '' });
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!form.newPassword) return notify('Please enter a new password', 'error');
    if (form.newPassword !== form.rePassword) return notify('New passwords do not match', 'error');
    setSaving(true);
    try {
      const r = await apiPost('/api/user/change-password', {
        currentPassword: form.oldPassword,
        newPassword:     form.newPassword,
      });
      if (r.success) {
        notify('Password updated successfully!', 'success');
        setForm({ oldPassword: '', newPassword: '', rePassword: '' });
      } else {
        notify(r.message || 'Password update failed', 'error');
      }
    } catch (e) { notify(e.message || 'Network error', 'error'); }
    setSaving(false);
  };

  return (
    <article className="card security-card" style={{ maxWidth: 640 }}>
      <div className="scard-head">
        <div><h3>Change Password</h3><p>Update your account password securely.</p></div>
      </div>
      <div className="security-form" style={{ padding: '20px' }}>
        <div className="security-field" style={{ marginBottom: 14 }}>
          <label style={{ display: 'block', fontWeight: 800, fontSize: 12, marginBottom: 6 }}>CURRENT PASSWORD</label>
          <SInput type="password" value={form.oldPassword} onChange={v => setForm(f => ({ ...f, oldPassword: v }))} placeholder="Enter current password" />
        </div>
        <div className="security-field" style={{ marginBottom: 14 }}>
          <label style={{ display: 'block', fontWeight: 800, fontSize: 12, marginBottom: 6 }}>NEW PASSWORD</label>
          <SInput type="password" value={form.newPassword} onChange={v => setForm(f => ({ ...f, newPassword: v }))} placeholder="Enter new password (min 6 characters)" />
        </div>
        <div className="security-field" style={{ marginBottom: 18 }}>
          <label style={{ display: 'block', fontWeight: 800, fontSize: 12, marginBottom: 6 }}>CONFIRM NEW PASSWORD</label>
          <SInput type="password" value={form.rePassword} onChange={v => setForm(f => ({ ...f, rePassword: v }))} placeholder="Re-enter new password" />
        </div>
        <div className="security-actions">
          <button className="btn primary" onClick={save} disabled={saving} style={{ height: 44, padding: '0 24px' }}>
            {saving ? 'Updating Password…' : '🔒 Update Password'}
          </button>
        </div>
      </div>
    </article>
  );
}

// ─── Main SettingsPage ────────────────────────────────────────────────────────
export default function SettingsPage({ defaultTab = 'company' }) {
  const { notify, isAdmin } = useAuth();

  // If Admin: show all 9 tabs. If regular user: show only user tabs.
  const visibleTabs = ALL_TABS.filter(t => isAdmin || !t.adminOnly);

  const initialTab = () => {
    if (isAdmin) {
      return defaultTab || 'company';
    }
    return defaultTab === 'company' || defaultTab === 'gdrive' || defaultTab === 'gmail' || defaultTab === 'email-template' || defaultTab === 'system'
      ? 'api'
      : defaultTab;
  };

  const [activeTab, setActiveTab] = useState(initialTab);

  useEffect(() => {
    if (!isAdmin && ['company', 'gdrive', 'gmail', 'email-template', 'system'].includes(activeTab)) {
      setActiveTab('api');
    }
  }, [isAdmin, activeTab]);

  return (
    <div className="content settings-page">
      <div className="settings-subnav">
        {visibleTabs.map(t => (
          <a
            key={t.key}
            href="#"
            className={activeTab === t.key ? 'active' : ''}
            onClick={e => { e.preventDefault(); setActiveTab(t.key); }}
          >
            <span>{t.icon}</span><b>{t.label}</b>
          </a>
        ))}
      </div>

      {activeTab === 'company'        && <CompanyTab        notify={notify} />}
      {activeTab === 'api'            && <ApiTab            notify={notify} />}
      {activeTab === 'whatsapp'       && <WhatsAppTab       notify={notify} />}
      {activeTab === 'gdrive'         && <GDriveTab         notify={notify} />}
      {activeTab === 'gmail'          && <GmailTab          notify={notify} />}
      {activeTab === 'gemini'         && <GeminiTab         notify={notify} />}
      {activeTab === 'email-template' && <EmailTemplateTab notify={notify} />}
      {activeTab === 'system'         && <SystemTab         notify={notify} />}
      {activeTab === 'security'       && <SecurityTab       notify={notify} />}
    </div>
  );
}
