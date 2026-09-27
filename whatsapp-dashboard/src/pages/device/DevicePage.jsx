import React, { useEffect } from 'react'
import { useAuth } from '../../context/AuthContext'
import '../../styles/device.css'

export function DevicePage() {
  const {
    status,
    qr,
    stats,
    currentUser,
    isAdmin,
    connecting,
    loadStatus,
    loadQr,
    connectUserWhatsApp,
    disconnectUserWhatsApp,
    notify,
    planInfo
  } = useAuth()

  const isConnected = status?.status === 'connected'

  useEffect(() => {
    if (loadStatus) loadStatus()
    if (loadQr) loadQr()
    const timer = setInterval(() => {
      if (loadStatus) loadStatus()
      if (loadQr) loadQr()
    }, 3000)
    return () => clearInterval(timer)
  }, [loadStatus, loadQr])

  const onConnect = () => {
    if (isAdmin) {
      loadQr()
    } else {
      connectUserWhatsApp()
    }
  }

  const onDisconnect = () => {
    if (window.confirm('Are you sure you want to disconnect this WhatsApp session?')) {
      disconnectUserWhatsApp()
    }
  }

  // Allowed devices: default 4 as per UI design, or from user plan
  const allowedDevices = planInfo?.allowedDevices || 4

  return (
    <div className="content device-page">
      <section className="device-limit-head">
        <div>
          <span className="eyebrow">DEVICE MANAGEMENT</span>
          <h1>Allow Device Limit</h1>
        </div>
        <div className="limit-pill">
          <small>ALLOWED DEVICES</small>
          <strong>{allowedDevices}</strong>
        </div>
      </section>

      <div className="device-grid device-slots">
        {/* Device Slot 01: Active session or Connect QR */}
        {isConnected ? (
          <article className="card device-card connected-card">
            <div className="device-top">
              <div className="dp-wrap">
                <div
                  className="device-dp"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: 'linear-gradient(145deg, #35cb89, #129e65)',
                    color: '#fff',
                    fontWeight: 800,
                    fontSize: 18,
                    borderRadius: 14,
                    width: 44,
                    height: 44
                  }}
                >
                  {(status.profileName || currentUser?.username || 'W')[0].toUpperCase()}
                </div>
                <span className="online-dot" title="Online"></span>
              </div>
              <span className="badge success">Connected</span>
            </div>

            <div className="device-info">
              <h3>{status.profileName || currentUser?.username || 'WhatsApp Account'}</h3>
              <p>{status.number ? `+${status.number}` : 'Primary WhatsApp'}</p>
              <span className="device-label">Main WhatsApp</span>
            </div>

            <div className="device-meta">
              <span>
                <small>MESSAGES</small>
                <b>{stats?.sent || 0}</b>
              </span>
              <span>
                <small>STATUS</small>
                <b style={{ color: '#148957' }}>Online</b>
              </span>
            </div>

            <button type="button" className="btn" onClick={onDisconnect}>
              Disconnect Session
            </button>
          </article>
        ) : (
          <article className="card device-card qr-card">
            {qr ? (
              <div className="qr-active-box">
                <img
                  src={qr}
                  alt="Scan WhatsApp QR"
                />
                <strong>Scan with WhatsApp</strong>
                <small>Linked Devices &gt; Link a Device</small>
              </div>
            ) : (
              <div className="qr-placeholder">
                <div className="qr-icon">▦</div>
                <strong>{connecting ? 'Generating QR...' : 'Show QR'}</strong>
                <small>{connecting ? 'Connecting to server...' : 'Scan QR to connect WhatsApp'}</small>
              </div>
            )}

            <div className="qr-slot">
              <span>DEVICE SLOT 01</span>
              <b>{connecting ? 'Connecting...' : (qr ? 'Scan Ready' : 'Available')}</b>
            </div>

            <button
              type="button"
              className="btn primary"
              onClick={onConnect}
              disabled={connecting}
            >
              {connecting ? 'Connecting...' : (qr ? '↻ Refresh QR' : 'Show QR')}
            </button>
          </article>
        )}

        {/* Device Slot 02: Empty/Available slot */}
        <article className="card device-card qr-card">
          <div className="qr-placeholder">
            <div className="qr-icon" style={{ opacity: 0.5 }}>▦</div>
            <strong>Show QR</strong>
            <small>Scan QR to connect WhatsApp</small>
          </div>
          <div className="qr-slot">
            <span>DEVICE SLOT 02</span>
            <b>Available</b>
          </div>
          <button
            type="button"
            className="btn primary"
            onClick={() => notify('Slot 02 will be enabled for multi-session support in your plan')}
          >
            Show QR
          </button>
        </article>

        {/* Device Slot 03: Empty/Available slot */}
        <article className="card device-card qr-card">
          <div className="qr-placeholder">
            <div className="qr-icon" style={{ opacity: 0.5 }}>▦</div>
            <strong>Show QR</strong>
            <small>Scan QR to connect WhatsApp</small>
          </div>
          <div className="qr-slot">
            <span>DEVICE SLOT 03</span>
            <b>Available</b>
          </div>
          <button
            type="button"
            className="btn primary"
            onClick={() => notify('Slot 03 will be enabled for multi-session support in your plan')}
          >
            Show QR
          </button>
        </article>

        {/* Device Slot 04: Empty/Available slot */}
        <article className="card device-card qr-card">
          <div className="qr-placeholder">
            <div className="qr-icon" style={{ opacity: 0.5 }}>▦</div>
            <strong>Show QR</strong>
            <small>Scan QR to connect WhatsApp</small>
          </div>
          <div className="qr-slot">
            <span>DEVICE SLOT 04</span>
            <b>Available</b>
          </div>
          <button
            type="button"
            className="btn primary"
            onClick={() => notify('Slot 04 will be enabled for multi-session support in your plan')}
          >
            Show QR
          </button>
        </article>
      </div>
    </div>
  )
}

export default DevicePage
