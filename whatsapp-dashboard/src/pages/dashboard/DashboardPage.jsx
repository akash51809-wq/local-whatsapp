import React from 'react'
import { useNavigate } from 'react-router-dom'
import Empty from '../../components/common/Empty'
import Stat from '../../components/common/Stat'
import { useAuth } from '../../context/AuthContext'

export function DashboardPage() {
  const {
    status,
    qr,
    stats,
    chats,
    isAdmin,
    connecting,
    loadQr,
    connectUserWhatsApp,
    disconnectUserWhatsApp,
    setSelected,
    currentUser,
    planInfo
  } = useAuth()

  const navigate = useNavigate()

  const onConnect = isAdmin ? loadQr : connectUserWhatsApp
  const onDisconnect = isAdmin ? null : disconnectUserWhatsApp
  const onRefresh = loadQr

  const onChat = (chat) => {
    setSelected(chat)
    navigate('/incoming')
  }

  const formatExpiry = (isoString) => {
    if (!isoString) return ''
    try {
      const d = new Date(isoString)
      return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
    } catch {
      return ''
    }
  }

  const currentPlanName = planInfo?.planName || currentUser?.plan || 'Standard'

  return (
    <section className="page-content">
      {/* USER CURRENT PLAN & VALIDITY BANNER (Visible for regular users) */}
      {!isAdmin && (
        <div className="card plan-banner-card mb-4">
          <div className="d-flex flex-wrap align-items-center justify-content-between gap-3 p-3">
            <div className="d-flex align-items-center gap-3">
              <div className="plan-badge-icon">
                💎
              </div>
              <div>
                <div className="d-flex align-items-center gap-2 flex-wrap mb-1">
                  <span className="font-weight-semibold text-muted" style={{ fontSize: '0.85rem' }}>
                    वर्तमान प्लान (Current Plan):
                  </span>
                  <span className="badge badge-purple" style={{ fontSize: '0.85rem', fontWeight: 700, padding: '4px 10px', borderRadius: 6 }}>
                    {currentPlanName}
                  </span>
                  <span className={`badge ${planInfo?.isExpired ? 'badge-danger' : 'badge-success'}`} style={{ fontSize: '0.75rem', padding: '3px 8px', borderRadius: 6 }}>
                    {planInfo?.isExpired ? '⚠️ Expired' : '● Active'}
                  </span>
                </div>
                <div className="d-flex align-items-center gap-2 flex-wrap" style={{ fontSize: '0.82rem', color: 'var(--text-main, #282f53)' }}>
                  <span>
                    ⏳ <strong>वैधता (Validity):</strong> {planInfo?.validity || '30 Days'}
                  </span>
                  {planInfo?.expiresAt && (
                    <>
                      <span className="text-muted">•</span>
                      <span>
                        📅 <strong>समाप्ति (Valid Till):</strong> {formatExpiry(planInfo.expiresAt)}
                      </span>
                      <span className="text-muted">•</span>
                      <span style={{ 
                        color: planInfo.isExpired ? '#e53e3e' : (planInfo.daysLeft <= 5 ? '#e67e22' : '#087a5d'), 
                        fontWeight: 700 
                      }}>
                        {planInfo.isExpired ? 'प्लान समाप्त (Expired)' : `${planInfo.daysLeft} दिन शेष (${planInfo.daysLeft} Days Left)`}
                      </span>
                    </>
                  )}
                  {planInfo?.dailyLimit && (
                    <>
                      <span className="text-muted">•</span>
                      <span className="text-muted">
                        📊 लिमिट: <strong>{planInfo.dailyLimit}</strong>
                      </span>
                    </>
                  )}
                </div>
              </div>
            </div>

            <div>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={() => navigate('/plans')}
                style={{ 
                  height: 36, 
                  fontSize: '0.82rem', 
                  fontWeight: 600, 
                  padding: '0 16px', 
                  borderRadius: 8,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6
                }}
              >
                <span>🏷️</span> प्लान अपग्रेड / बदलें (Upgrade Plan)
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="hero-card">
        <div className="hero-text-content">
          <span className="hero-eyebrow-badge">
            {isAdmin 
              ? 'ADMIN WHATSAPP SESSION' 
              : `YOUR PERSONAL WHATSAPP SESSION · ${currentPlanName.toUpperCase()} PLAN (${planInfo?.validity || '30 Days'})`}
          </span>
          <h2>{status.status === 'connected' ? 'WhatsApp Connected ✓' : 'अपना WhatsApp जोड़ें'}</h2>
          <p>
            {status.status === 'connected' 
              ? `आपका WhatsApp (+${status.number || ''}) कनेक्टेड है। अब आप इस नंबर से सीधे मैसेज भेज सकते हैं।` 
              : 'QR कोड स्कैन करने के लिए नीचे बटन दबाएं और अपने फ़ोन के WhatsApp से स्कैन करें।'}
          </p>
          <div className="hero-btn-group">
            {status.status === 'connected' ? (
              <>
                <button className="btn-hero-primary" onClick={onRefresh}>↻ Refresh Status</button>
                {onDisconnect && <button className="btn-hero-danger" onClick={onDisconnect}>⏏ Disconnect</button>}
              </>
            ) : (
              <button className="btn-hero-primary" onClick={onConnect} disabled={connecting}>
                {connecting ? '⏳ शुरू हो रहा है...' : '📱 Connect / Get QR Code'}
              </button>
            )}
          </div>
        </div>

        <div className="hero-visual-content">
          {qr ? (
            <div className="hero-qr-box">
              <img className="qr-image" src={qr} alt="WhatsApp QR" />
              <div className="qr-caption">WhatsApp &gt; Linked Devices से scan करें</div>
            </div>
          ) : (
            <div className={`hero-status-circle ${status.status === 'connected' ? 'is-connected' : ''}`}>
              {status.status === 'connected' ? (
                <div className="hero-connected-badge">
                  <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12"></polyline>
                  </svg>
                  <span>Online</span>
                </div>
              ) : (
                <div className="hero-disconnected-badge">
                  <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="5" y="2" width="14" height="20" rx="2" ry="2"></rect>
                    <line x1="12" y1="18" x2="12.01" y2="18"></line>
                  </svg>
                  <span>Scan Needed</span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="stat-grid">
        <Stat 
          variant="teal"
          icon={
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
            </svg>
          } 
          value={stats.chats} 
          label="Active chats" 
          sub="Live conversations"
        />
        <Stat 
          variant="coral"
          icon={
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="12" y1="8" x2="12" y2="12"></line>
              <line x1="12" y1="16" x2="12.01" y2="16"></line>
            </svg>
          } 
          value={stats.unread} 
          label="Unread" 
          sub="Requires attention"
        />
        <Stat 
          variant="purple"
          icon={
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
              <circle cx="9" cy="7" r="4"></circle>
              <rect x="14" y="3" width="7" height="7" rx="1.5"></rect>
            </svg>
          } 
          value={stats.groups} 
          label="Groups" 
          sub="WhatsApp groups"
        />
        <Stat 
          variant={status.status === 'connected' ? 'success' : 'amber'}
          icon={
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
          } 
          value={status.status === 'connected' ? 'Online' : 'Offline'} 
          label="Status" 
          sub={status.number ? `+${status.number}` : 'Not connected'}
        />
      </div>

      <div className="zendash-card">
        <div className="zendash-card-header">
          <div>
            <h3 className="zendash-card-title">Recent Conversations</h3>
            <p className="zendash-card-subtitle">हाल के मैसेजेस और चैट्स</p>
          </div>
          {chats.length > 0 && <span className="badge-zendash-count">{chats.length} Total</span>}
        </div>
        <div className="zendash-card-body">
          <div className="chat-grid">
            {chats.slice(0, 8).map(c => (
              <button className="chat-card" key={c.chatJid} onClick={() => onChat(c)}>
                <div className="avatar">{(c.name || '?')[0].toUpperCase()}</div>
                <div className="chat-info">
                  <b>{c.name}</b>
                  <p>{c.lastMessage || 'Media message'}</p>
                </div>
                {c.unreadCount ? <span className="badge">{c.unreadCount}</span> : null}
                <span className="chat-action-arrow">›</span>
              </button>
            ))}
            {!chats.length && <Empty text="अभी कोई बातचीत उपलब्ध नहीं है" />}
          </div>
        </div>
      </div>
    </section>
  )
}

export default DashboardPage
