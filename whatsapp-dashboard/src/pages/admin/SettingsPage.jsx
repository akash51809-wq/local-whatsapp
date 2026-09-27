import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { api, getToken } from '../../services/api';
import '../../styles/settings.css';

const TABS = [
  { key: 'api',      icon: '⚙',  label: 'API Setting' },
  { key: 'whatsapp', icon: '◉',  label: 'WhatsApp Setting' },
  { key: 'security', icon: '◈',  label: 'Security' },
  { key: 'gemini',   icon: '✦',  label: 'Gemini' },
];

// Helper: api GET / POST
const apiGet  = (url)        => api(url, { method: 'GET' });
const apiPost = (url, body)  => api(url, { method: 'POST', body: JSON.stringify(body) });

// ─── Reusable Components ──────────────────────────────────────────────────────
function Field({ label, children }) {
  return (
    <div className="sfield">
      <label className="sfield-label">{label}</label>
      {children}
    </div>
  );
}

function SInput({ type = 'text', value, onChange, placeholder, ...rest }) {
  return (
    <input
      className="sinput"
      type={type}
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      {...rest}
    />
  );
}

// ─── Tab: API Setting ─────────────────────────────────────────────────────────
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
    <article className="scard api-settings-card">
      <div className="scard-head">
        <div>
          <h3>API Setting</h3>
          <p>Add the allowed IP address and callback URL for API access.</p>
        </div>
      </div>
      <div className="api-form">
        <div className="api-field">
          <label htmlFor="api-ip">Add IP</label>
          <SInput id="api-ip" value={form.allowedIp} onChange={v => setForm(f => ({ ...f, allowedIp: v }))} placeholder="Enter allowed IP address" />
        </div>
        <div className="api-field">
          <label htmlFor="callback-url">Add Callback URL</label>
          <SInput id="callback-url" type="url" value={form.callbackUrl} onChange={v => setForm(f => ({ ...f, callbackUrl: v }))} placeholder="https://example.com/callback" />
        </div>
        <div className="api-actions">
          <button className="save-api-btn" onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
        </div>
      </div>
    </article>
  );
}

// ─── Tab: WhatsApp Setting ────────────────────────────────────────────────────
function WhatsAppTab({ notify }) {
  const [queue,       setQueue]       = useState({ minDelay: '', maxDelay: '' });
  const [savingQueue, setSavingQueue] = useState(false);
  const [autoImg,     setAutoImg]     = useState({ enabled: false, imageUrl: '' });
  const [imgFile,     setImgFile]     = useState(null);
  const [savingImg,   setSavingImg]   = useState(false);

  useEffect(() => {
    apiGet('/api/settings/wa-queue')
      .then(r => { if (r?.data) setQueue({ minDelay: r.data.minDelay ?? '', maxDelay: r.data.maxDelay ?? '' }); })
      .catch(() => {});

    apiGet('/api/user/settings/auto-image')
      .then(r => { if (r?.autoSendImage) setAutoImg({ enabled: r.autoSendImage.enabled || false, imageUrl: r.autoSendImage.imageUrl || '' }); })
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
      notify(r.success ? 'Auto image saved!' : (r.message || 'Save failed'), r.success ? 'success' : 'error');
    } catch (e) { notify(e.message || 'Network error', 'error'); }
    setSavingImg(false);
  };

  return (
    <>
      {/* Card 1: Message Queue Delay */}
      <article className="card wa-setting-card">
        <div className="scard-head">
          <div>
            <h3>Message Queue Delay</h3>
            <p>Set the minimum and maximum delay between queued messages.</p>
          </div>
        </div>
        <div className="wa-form-row">
          <div className="wa-field">
            <label>MINIMUM DELAY</label>
            <SInput type="number" min="0" value={queue.minDelay} onChange={v => setQueue(q => ({ ...q, minDelay: v }))} placeholder="Minimum" />
          </div>
          <div className="wa-field">
            <label>MAXIMUM DELAY</label>
            <SInput type="number" min="0" value={queue.maxDelay} onChange={v => setQueue(q => ({ ...q, maxDelay: v }))} placeholder="Maximum" />
          </div>
          <button className="wa-save-btn" onClick={saveQueue} disabled={savingQueue}>{savingQueue ? 'Saving…' : 'Save'}</button>
        </div>
      </article>

      {/* Card 2: Auto Send Image */}
      <article className="card wa-setting-card image-api-card" style={{ marginTop: 14 }}>
        <div className="scard-head">
          <div>
            <h3>Auto Send Image with API Messages</h3>
            <p>Upload an image or paste an image URL to automatically send it with API messages.</p>
          </div>
          <button
            type="button"
            className={`compact-toggle ${autoImg.enabled ? 'on' : 'off'}`}
            role="switch"
            aria-checked={autoImg.enabled}
            aria-label="Toggle Auto Send Image"
            onClick={() => setAutoImg(a => ({ ...a, enabled: !a.enabled }))}
          >
            <span></span><b>{autoImg.enabled ? 'ON' : 'OFF'}</b>
          </button>
        </div>
        <div className="wa-form-row image-row">
          <div className="wa-field">
            <label>UPLOAD IMAGE</label>
            <input className="sinput" type="file" accept="image/*" onChange={e => setImgFile(e.target.files[0] || null)} />
          </div>
          <div className="wa-field image-url-field">
            <label>IMAGE URL</label>
            <SInput type="url" value={autoImg.imageUrl} onChange={v => setAutoImg(a => ({ ...a, imageUrl: v }))} placeholder="https://example.com/image.jpg" />
          </div>
          <button className="wa-save-btn" onClick={saveAutoImg} disabled={savingImg}>{savingImg ? 'Saving…' : 'Save'}</button>
        </div>
      </article>
    </>
  );
}

// ─── Tab: Security ────────────────────────────────────────────────────────────
function SecurityTab({ notify }) {
  const [form, setForm]   = useState({ oldPassword: '', newPassword: '', rePassword: '' });
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!form.oldPassword || !form.newPassword || !form.rePassword) { notify('Please fill all fields', 'error'); return; }
    if (form.newPassword !== form.rePassword) { notify('New passwords do not match', 'error'); return; }
    setSaving(true);
    try {
      const r = await apiPost('/api/auth/change-password', { oldPassword: form.oldPassword, newPassword: form.newPassword });
      if (r.success) { notify('Password changed!', 'success'); setForm({ oldPassword: '', newPassword: '', rePassword: '' }); }
      else notify(r.message || 'Failed', 'error');
    } catch (e) { notify(e.message || 'Network error', 'error'); }
    setSaving(false);
  };

  return (
    <article className="card security-card">
      <div className="scard-head">
        <div><h3>Change Password</h3><p>Update your account password securely.</p></div>
      </div>
      <div className="security-form">
        <div className="security-field">
          <label>OLD PASSWORD</label>
          <SInput type="password" value={form.oldPassword} onChange={v => setForm(f => ({ ...f, oldPassword: v }))} placeholder="Enter old password" />
        </div>
        <div className="security-field">
          <label>NEW PASSWORD</label>
          <SInput type="password" value={form.newPassword} onChange={v => setForm(f => ({ ...f, newPassword: v }))} placeholder="Enter new password" />
        </div>
        <div className="security-field">
          <label>RE-ENTER NEW PASSWORD</label>
          <SInput type="password" value={form.rePassword} onChange={v => setForm(f => ({ ...f, rePassword: v }))} placeholder="Re-enter new password" />
        </div>
        <div className="security-actions">
          <button className="security-save-btn" onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
        </div>
      </div>
    </article>
  );
}

// ─── Tab: Gemini ──────────────────────────────────────────────────────────────
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
        <div><h3>Gemini API Settings</h3><p>Add and manage multiple Gemini API keys for your automation.</p></div>
        <button className="btn primary" onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
      </div>
      <div className="card-body">
        <div className="gemini-keys" id="geminiKeys">
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
                  <option>Gemini Flash 2.0</option>
                  <option>Gemini Pro 2.0</option>
                </select>
              </div>
              <button type="button" className="remove-key" title="Remove" onClick={() => removeKey(k.id)} disabled={keys.length <= 1}>×</button>
            </div>
          ))}
        </div>
        <div className="actions-row">
          <button type="button" className="btn secondary" onClick={addKey}>＋ Add Gemini</button>
        </div>
      </div>
    </article>
  );
}

// ─── Main SettingsPage ────────────────────────────────────────────────────────
export default function SettingsPage({ defaultTab = 'api' }) {
  const { notify } = useAuth();
  const [activeTab, setActiveTab] = useState(defaultTab);

  useEffect(() => { setActiveTab(defaultTab); }, [defaultTab]);

  return (
    <div className="content settings-page">
      <div className="settings-subnav">
        {TABS.map(t => (
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

      {activeTab === 'api'      && <ApiTab      notify={notify} />}
      {activeTab === 'whatsapp' && <WhatsAppTab notify={notify} />}
      {activeTab === 'security' && <SecurityTab notify={notify} />}
      {activeTab === 'gemini'   && <GeminiTab   notify={notify} />}
    </div>
  );
}
