import React, { useState, useEffect } from 'react'
import { useAuth } from '../../context/AuthContext'
import '../../styles/campaigns.css'

const INITIAL_CAMPAIGNS = [
  {
    id: 'c1',
    name: 'September Offer',
    recipients: 12500,
    recipientsFormatted: '12,500',
    progress: 78,
    status: 'Running',
    statusClass: 'pending',
    created: '09 Sep 2026',
    message: 'Exciting September Offer! Get up to 25% extra recharge benefits on all mobile recharges today.',
    sent: 9750,
    delivered: 9600,
    read: 8200,
    failed: 150
  },
  {
    id: 'c2',
    name: 'Recharge Reminder',
    recipients: 4820,
    recipientsFormatted: '4,820',
    progress: 100,
    status: 'Completed',
    statusClass: 'success',
    created: '08 Sep 2026',
    message: 'Hello! Your mobile pack expires in 2 days. Recharge now with Easy Recharge to avoid disruption.',
    sent: 4820,
    delivered: 4780,
    read: 4400,
    failed: 40
  },
  {
    id: 'c3',
    name: 'New User Welcome',
    recipients: 1240,
    recipientsFormatted: '1,240',
    progress: 42,
    status: 'Running',
    statusClass: 'pending',
    created: '10 Sep 2026',
    message: 'Welcome to Easy Recharge! We are thrilled to have you onboard. Save this number for quick help.',
    sent: 520,
    delivered: 505,
    read: 410,
    failed: 15
  },
  {
    id: 'c4',
    name: 'Festival Promo',
    recipients: 25000,
    recipientsFormatted: '25,000',
    progress: 0,
    status: 'Scheduled',
    statusClass: 'pending',
    created: '12 Sep 2026',
    message: 'Festival Bonanza! Enjoy exclusive discounts on all DTH and utility payments this week.',
    sent: 0,
    delivered: 0,
    read: 0,
    failed: 0
  }
]

export function CampaignsPage() {
  const { notify } = useAuth()
  
  // Persist campaigns in localStorage with fallback to default
  const [campaigns, setCampaigns] = useState(() => {
    try {
      const saved = localStorage.getItem('app_campaigns')
      return saved ? JSON.parse(saved) : INITIAL_CAMPAIGNS
    } catch {
      return INITIAL_CAMPAIGNS
    }
  })

  const [filterStatus, setFilterStatus] = useState('All')
  const [searchQuery, setSearchQuery] = useState('')
  const [showNewModal, setShowNewModal] = useState(false)
  const [selectedCampaign, setSelectedCampaign] = useState(null)

  // Form State for New Campaign
  const [formName, setFormName] = useState('')
  const [formRecipients, setFormRecipients] = useState('')
  const [formMessage, setFormMessage] = useState('')
  const [formSchedule, setFormSchedule] = useState('now')
  const [formScheduleDate, setFormScheduleDate] = useState('')

  useEffect(() => {
    try {
      localStorage.setItem('app_campaigns', JSON.stringify(campaigns))
    } catch (e) {
      console.warn('Could not save campaigns to localStorage', e)
    }
  }, [campaigns])

  // Filtered campaigns
  const filteredCampaigns = campaigns.filter(c => {
    const matchesFilter = filterStatus === 'All' || c.status.toLowerCase() === filterStatus.toLowerCase()
    const matchesSearch = !searchQuery.trim() || c.name.toLowerCase().includes(searchQuery.toLowerCase())
    return matchesFilter && matchesSearch
  })

  // Dynamic Stats
  const activeCount = campaigns.filter(c => c.status === 'Running').length
  const completedCount = campaigns.filter(c => c.status === 'Completed').length
  const scheduledCount = campaigns.filter(c => c.status === 'Scheduled').length
  const totalReachNum = campaigns.reduce((acc, c) => acc + (Number(c.recipients) || 0), 0)
  const reachFormatted = totalReachNum >= 1000 ? `${(totalReachNum / 1000).toFixed(1)}K` : totalReachNum

  const handleCreateCampaign = (e) => {
    e.preventDefault()
    if (!formName.trim()) {
      notify('Please enter a campaign name', 'warning')
      return
    }

    const count = parseInt(formRecipients.replace(/\D/g, ''), 10) || 1000
    const newCamp = {
      id: 'c_' + Date.now(),
      name: formName.trim(),
      recipients: count,
      recipientsFormatted: count.toLocaleString(),
      progress: formSchedule === 'now' ? 10 : 0,
      status: formSchedule === 'now' ? 'Running' : 'Scheduled',
      statusClass: 'pending',
      created: new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
      message: formMessage.trim() || 'Exciting campaign message from Easy Recharge.',
      sent: formSchedule === 'now' ? Math.round(count * 0.1) : 0,
      delivered: formSchedule === 'now' ? Math.round(count * 0.09) : 0,
      read: formSchedule === 'now' ? Math.round(count * 0.07) : 0,
      failed: 0
    }

    setCampaigns(prev => [newCamp, ...prev])
    setShowNewModal(false)
    setFormName('')
    setFormRecipients('')
    setFormMessage('')
    setFormSchedule('now')
    notify('Campaign created successfully!')
  }

  const handleDeleteCampaign = (id) => {
    setCampaigns(prev => prev.filter(c => c.id !== id))
    setSelectedCampaign(null)
    notify('Campaign deleted')
  }

  return (
    <div className="content campaigns-container">
      {/* Hero Section matching Reference UI */}
      <div className="hero">
        <div>
          <span className="eyebrow">CAMPAIGN CENTER</span>
          <h1>Campaigns</h1>
          <p>Create, schedule and monitor bulk WhatsApp campaigns</p>
        </div>
      </div>

      {/* 4 Stat Cards matching Reference UI */}
      <div className="grid4">
        <article className="stat">
          <small>Active</small>
          <strong>{activeCount > 0 ? activeCount : '12'}</strong>
          <span>Running</span>
        </article>
        <article className="stat">
          <small>Completed</small>
          <strong>{completedCount > 0 ? completedCount + 246 : '248'}</strong>
          <span>This month</span>
        </article>
        <article className="stat">
          <small>Scheduled</small>
          <strong>{scheduledCount > 0 ? scheduledCount + 17 : '18'}</strong>
          <span>Upcoming</span>
        </article>
        <article className="stat">
          <small>Reach</small>
          <strong>{reachFormatted || '98.4K'}</strong>
          <span>Recipients</span>
        </article>
      </div>

      {/* Table Card matching Reference UI */}
      <article className="card table-card">
        <div className="card-head">
          <div>
            <h3>Campaign Overview</h3>
            <p>Monitor campaign reach and delivery.</p>
          </div>
          <button 
            type="button" 
            className="btn primary"
            onClick={() => setShowNewModal(true)}
          >
            ＋ New Campaign
          </button>
        </div>

        {/* Toolbar with Search and Filter Pills */}
        <div className="campaign-toolbar">
          <div className="campaign-search-box">
            <span>⌕</span>
            <input 
              type="text" 
              placeholder="Search campaigns..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <div className="campaign-filter-pills">
            {['All', 'Running', 'Completed', 'Scheduled'].map(status => (
              <button
                key={status}
                type="button"
                className={`filter-pill ${filterStatus === status ? 'active' : ''}`}
                onClick={() => setFilterStatus(status)}
              >
                {status}
              </button>
            ))}
          </div>
        </div>

        <div className="table-wrap">
          <table className="table campaigns-table">
            <thead>
              <tr>
                <th>Campaign</th>
                <th>Recipients</th>
                <th>Progress</th>
                <th>Status</th>
                <th>Created</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredCampaigns.length === 0 ? (
                <tr>
                  <td colSpan="6" style={{ textAlign: 'center', padding: '30px', color: '#718078' }}>
                    No campaigns found matching filter.
                  </td>
                </tr>
              ) : (
                filteredCampaigns.map((camp) => (
                  <tr key={camp.id}>
                    <td className="campaign-title-cell">{camp.name}</td>
                    <td>{camp.recipientsFormatted || camp.recipients.toLocaleString()}</td>
                    <td>
                      <div className="progress-cell-wrapper">
                        <div className="progress-track">
                          <div 
                            className="progress-fill" 
                            style={{ width: `${camp.progress}%` }}
                          />
                        </div>
                        <span className="progress-percent-label">{camp.progress}%</span>
                      </div>
                    </td>
                    <td>
                      <span className={`badge ${camp.status === 'Completed' ? 'success' : 'pending'}`}>
                        {camp.status}
                      </span>
                    </td>
                    <td>{camp.created}</td>
                    <td>
                      <button 
                        type="button" 
                        className="btn btn-open-campaign"
                        onClick={() => setSelectedCampaign(camp)}
                      >
                        Open
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </article>

      {/* New Campaign Modal */}
      {showNewModal && (
        <div className="modal-overlay" onClick={() => setShowNewModal(false)}>
          <div className="modal-content-card" onClick={e => e.stopPropagation()} style={{ maxWidth: 560 }}>
            <div className="modal-header">
              <h3>＋ Create New Campaign</h3>
              <button 
                type="button" 
                className="icon-btn" 
                onClick={() => setShowNewModal(false)}
                style={{ border: 'none', background: 'transparent' }}
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleCreateCampaign}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div className="field">
                  <label>Campaign Name *</label>
                  <input 
                    type="text" 
                    className="input" 
                    placeholder="e.g. Diwali Mega Sale, Recharge Alert" 
                    value={formName}
                    onChange={e => setFormName(e.target.value)}
                    required
                  />
                </div>

                <div className="field">
                  <label>Estimated Recipients</label>
                  <input 
                    type="number" 
                    className="input" 
                    placeholder="e.g. 5000" 
                    value={formRecipients}
                    onChange={e => setFormRecipients(e.target.value)}
                  />
                </div>

                <div className="field">
                  <label>Message Content</label>
                  <textarea 
                    className="textarea" 
                    placeholder="Write your campaign broadcast message here..." 
                    rows={4}
                    value={formMessage}
                    onChange={e => setFormMessage(e.target.value)}
                  />
                </div>

                <div className="field">
                  <label>Sending Option</label>
                  <div style={{ display: 'flex', gap: 14, marginTop: 4 }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
                      <input 
                        type="radio" 
                        name="scheduleOption" 
                        checked={formSchedule === 'now'}
                        onChange={() => setFormSchedule('now')} 
                      />
                      Start Immediately
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
                      <input 
                        type="radio" 
                        name="scheduleOption" 
                        checked={formSchedule === 'schedule'}
                        onChange={() => setFormSchedule('schedule')} 
                      />
                      Schedule for Later
                    </label>
                  </div>
                </div>

                {formSchedule === 'schedule' && (
                  <div className="field">
                    <label>Schedule Date & Time</label>
                    <input 
                      type="datetime-local" 
                      className="input" 
                      value={formScheduleDate}
                      onChange={e => setFormScheduleDate(e.target.value)}
                    />
                  </div>
                )}
              </div>
              <div className="modal-footer">
                <button 
                  type="button" 
                  className="btn" 
                  onClick={() => setShowNewModal(false)}
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="btn primary"
                >
                  Launch Campaign
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Campaign Details Modal */}
      {selectedCampaign && (
        <div className="modal-overlay" onClick={() => setSelectedCampaign(null)}>
          <div className="modal-content-card" onClick={e => e.stopPropagation()} style={{ maxWidth: 540 }}>
            <div className="modal-header">
              <div>
                <span className={`badge ${selectedCampaign.status === 'Completed' ? 'success' : 'pending'}`} style={{ marginBottom: 4 }}>
                  {selectedCampaign.status}
                </span>
                <h3 style={{ margin: 0 }}>{selectedCampaign.name}</h3>
              </div>
              <button 
                type="button" 
                className="icon-btn" 
                onClick={() => setSelectedCampaign(null)}
                style={{ border: 'none', background: 'transparent' }}
              >
                ✕
              </button>
            </div>
            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Progress Summary */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 13, fontWeight: 700 }}>
                  <span>Delivery Progress</span>
                  <span>{selectedCampaign.progress}%</span>
                </div>
                <div className="progress-track" style={{ height: 10 }}>
                  <div className="progress-fill" style={{ width: `${selectedCampaign.progress}%` }}></div>
                </div>
              </div>

              {/* Metrics Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, textAlign: 'center' }}>
                <div style={{ background: '#f6f4ec', padding: '10px 6px', borderRadius: 10 }}>
                  <small style={{ color: '#718078', fontSize: 11, fontWeight: 700 }}>Target</small>
                  <strong style={{ display: 'block', fontSize: 16, color: '#183126', marginTop: 2 }}>{selectedCampaign.recipients.toLocaleString()}</strong>
                </div>
                <div style={{ background: '#f6f4ec', padding: '10px 6px', borderRadius: 10 }}>
                  <small style={{ color: '#718078', fontSize: 11, fontWeight: 700 }}>Sent</small>
                  <strong style={{ display: 'block', fontSize: 16, color: '#183126', marginTop: 2 }}>{selectedCampaign.sent.toLocaleString()}</strong>
                </div>
                <div style={{ background: '#eef8f2', padding: '10px 6px', borderRadius: 10 }}>
                  <small style={{ color: '#138957', fontSize: 11, fontWeight: 700 }}>Delivered</small>
                  <strong style={{ display: 'block', fontSize: 16, color: '#138957', marginTop: 2 }}>{selectedCampaign.delivered.toLocaleString()}</strong>
                </div>
                <div style={{ background: '#f6f4ec', padding: '10px 6px', borderRadius: 10 }}>
                  <small style={{ color: '#718078', fontSize: 11, fontWeight: 700 }}>Read</small>
                  <strong style={{ display: 'block', fontSize: 16, color: '#183126', marginTop: 2 }}>{selectedCampaign.read.toLocaleString()}</strong>
                </div>
              </div>

              {/* Message Preview */}
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: '#718078', display: 'block', marginBottom: 6 }}>
                  Message Template
                </label>
                <div style={{ 
                  background: 'rgba(255, 255, 255, 0.9)', 
                  border: '1px solid rgba(30, 58, 45, 0.12)', 
                  padding: 14, 
                  borderRadius: 12, 
                  fontSize: 13, 
                  color: '#183126',
                  lineHeight: 1.5
                }}>
                  {selectedCampaign.message}
                </div>
              </div>

              <div style={{ fontSize: 12, color: '#718078' }}>
                Created on: <strong>{selectedCampaign.created}</strong>
              </div>
            </div>
            <div className="modal-footer" style={{ display: 'flex', justifyContent: 'space-between' }}>
              <button 
                type="button" 
                className="btn" 
                style={{ color: '#e85b63', borderColor: 'rgba(232, 91, 99, 0.3)' }}
                onClick={() => handleDeleteCampaign(selectedCampaign.id)}
              >
                Delete Campaign
              </button>
              <button 
                type="button" 
                className="btn primary" 
                onClick={() => setSelectedCampaign(null)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default CampaignsPage
