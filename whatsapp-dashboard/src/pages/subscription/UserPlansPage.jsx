import { useState, useEffect, useCallback } from 'react'
import { api } from '../../services/api'
import { useAuth } from '../../context/AuthContext'
import PaymentDetailsModal from '../../components/modals/PaymentDetailsModal'

export default function UserPlansPage({ currentUser: propUser, notify: propNotify, isPreview = false }) {
  const { user: authUser, notify: authNotify } = useAuth()
  const currentUser = propUser || authUser
  const notify = propNotify || authNotify

  const [plans, setPlans] = useState([])
  const [loading, setLoading] = useState(false)
  const [currentPlan, setCurrentPlan] = useState(currentUser?.plan || 'Standard')
  const [myRequests, setMyRequests] = useState([])
  const [activeTab, setActiveTab] = useState('plans')
  const [selectedPlan, setSelectedPlan] = useState(null)

  const fetchPlansData = useCallback(async () => {
    setLoading(true)
    try {
      const d = await api('/api/plans')
      if (d.success) {
        setPlans(d.plans || [])
        if (d.currentPlan) setCurrentPlan(d.currentPlan)
        if (d.myRequests) setMyRequests(d.myRequests)
      }
    } catch (e) {
      notify('Plans लोड करने में त्रुटि: ' + e.message)
    } finally {
      setLoading(false)
    }
  }, [notify])

  useEffect(() => {
    fetchPlansData()
  }, [fetchPlansData])

  const pendingCount = myRequests.filter(r => r.status === 'pending').length

  const handleOpenPurchase = (plan) => {
    setSelectedPlan(plan)
  }

  const handlePurchaseSuccess = () => {
    setSelectedPlan(null)
    fetchPlansData()
    setActiveTab('requests')
  }

  return (
    <section className="user-plans-page">
      {!isPreview && (
        <>
          {/* Header & Breadcrumb */}
          <div className="page-header d-flex flex-wrap align-items-center justify-content-between mb-4">
            <div>
              <h1 className="page-title mb-1" style={{ fontSize: 24, fontWeight: 700, color: 'inherit' }}>
                💎 Subscription Plans &amp; Pricing
              </h1>
              <ol className="breadcrumb mb-0" style={{ background: 'transparent', padding: 0, fontSize: 13 }}>
                <li className="breadcrumb-item text-muted">Portal</li>
                <li className="breadcrumb-item active text-primary">Pricing Comparison</li>
              </ol>
            </div>
            <div className="d-flex align-items-center gap-2 mt-2 mt-md-0" style={{ gap: 10 }}>
              <button 
                type="button" 
                className={`btn ${activeTab === 'plans' ? 'btn-primary' : 'btn-outline-primary'}`}
                onClick={() => setActiveTab('plans')}
                style={{ borderRadius: 8, padding: '8px 16px', fontWeight: 600, fontSize: 13 }}
              >
                🏷️ Pricing Table
              </button>
              <button 
                type="button" 
                className={`btn ${activeTab === 'requests' ? 'btn-primary' : 'btn-outline-primary'}`}
                onClick={() => setActiveTab('requests')}
                style={{ borderRadius: 8, padding: '8px 16px', fontWeight: 600, fontSize: 13, position: 'relative' }}
              >
                📋 My Purchase Requests
                {pendingCount > 0 && (
                  <span className="badge badge-warning" style={{ marginLeft: 6, fontSize: 10, padding: '2px 6px' }}>
                    {pendingCount}
                  </span>
                )}
              </button>
            </div>
          </div>

          {/* Current Active Plan Alert Banner */}
          <div className="card mb-4" style={{ borderRadius: 16, background: 'linear-gradient(135deg, rgba(79,117,242,0.12) 0%, rgba(112,94,200,0.12) 100%)', border: '1px solid rgba(112,94,200,0.2)' }}>
            <div className="card-body p-3 p-md-4 d-flex flex-wrap align-items-center justify-content-between" style={{ gap: 14 }}>
              <div className="d-flex align-items-center" style={{ gap: 14 }}>
                <div style={{ width: 48, height: 48, borderRadius: 12, background: '#705ec8', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, flexShrink: 0 }}>
                  🌟
                </div>
                <div>
                  <h4 className="mb-1 font-weight-bold" style={{ color: 'inherit' }}>
                    Your Current Active Plan: <span style={{ color: '#705ec8' }}>{currentPlan}</span>
                  </h4>
                  <p className="text-muted mb-0" style={{ fontSize: 13 }}>
                    Choose any higher plan below to increase daily messaging capacity, add devices, and unlock group &amp; webhook access!
                  </p>
                </div>
              </div>
              <div>
                <button 
                  type="button" 
                  className="btn btn-outline-primary"
                  onClick={fetchPlansData}
                  style={{ borderRadius: 8, padding: '6px 14px', fontSize: 12, fontWeight: 600 }}
                >
                  ↻ Refresh Status
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px 20px', color: '#6b7280' }}>
          <div className="spinner-border text-primary mb-2" role="status"></div>
          <div>प्लान लोड हो रहे हैं (Loading pricing table)...</div>
        </div>
      ) : activeTab === 'plans' ? (
        plans.length === 0 ? (
          <div className="card p-5 text-center" style={{ borderRadius: 16 }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>🏷️</div>
            <h3>कोई सक्रिय प्लान उपलब्ध नहीं है</h3>
            <p className="text-muted">No active subscription plans available at the moment. Please contact the administrator.</p>
          </div>
        ) : (
          /* PRICING COMPARISON TABLE - EXACT LAYOUT AS MEDIA SAMPLE */
          <div className="pricing-comparison-table-wrapper card shadow-sm" style={{ borderRadius: 20, overflow: 'hidden' }}>
            <div className="table-responsive">
              <table className="pricing-comparison-table mb-0 w-100">
                <thead>
                  <tr>
                    {/* Left corner empty / title cell */}
                    <th className="pricing-feature-col-head" style={{ width: '22%', minWidth: 200, padding: '24px 20px', verticalAlign: 'bottom', borderRight: '1px solid var(--zd-border, #eef2f6)' }}>
                      <span style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--zd-text-muted, #8a98ac)', fontWeight: 700 }}>
                        Features &amp; Specs
                      </span>
                      <h3 style={{ margin: '6px 0 0', fontSize: 18, fontWeight: 800, color: 'inherit' }}>
                        Compare All Plans
                      </h3>
                    </th>

                    {/* Dynamic Plan Header Columns */}
                    {plans.map((p, idx) => {
                      const isCurrent = currentPlan?.toLowerCase() === p.name?.toLowerCase()
                      const headerBg = p.headerColor || (idx === 0 ? '#9bc5ff' : idx === 1 ? '#8fe3c9' : '#d2b4ff')
                      const isDarkHeader = ['#10b981', '#3b82f6', '#705ec8', '#f77f00', '#4f75f2'].includes(p.headerColor)

                      return (
                        <th 
                          key={p.planId || idx} 
                          className="pricing-plan-header-col" 
                          style={{ 
                            width: `${78 / plans.length}%`, 
                            minWidth: 200, 
                            padding: 0, 
                            verticalAlign: 'top',
                            borderRight: idx < plans.length - 1 ? '1px solid var(--zd-border, #eef2f6)' : 'none'
                          }}
                        >
                          <div 
                            className="plan-header-card text-center"
                            style={{
                              backgroundColor: headerBg,
                              color: isDarkHeader ? '#ffffff' : '#141b47',
                              padding: '24px 16px 20px',
                              position: 'relative'
                            }}
                          >
                            {p.badgeText && (
                              <span 
                                style={{
                                  position: 'absolute',
                                  top: 8,
                                  right: 12,
                                  background: 'rgba(0,0,0,0.25)',
                                  color: '#fff',
                                  fontSize: 10,
                                  fontWeight: 800,
                                  padding: '2px 8px',
                                  borderRadius: 999
                                }}
                              >
                                {p.badgeText}
                              </span>
                            )}

                            <h2 style={{ fontSize: 24, fontWeight: 900, margin: '0 0 6px', letterSpacing: '-0.02em', color: 'inherit' }}>
                              {p.name}
                            </h2>

                            <p style={{ fontSize: 12, margin: '0 0 14px', minHeight: 34, opacity: 0.9, lineHeight: 1.3, color: 'inherit' }}>
                              {p.description || 'WhatsApp Automation Plan'}
                            </p>

                            {/* Price Pill */}
                            <div className="d-flex justify-content-center mb-3">
                              <span 
                                className="price-pill-banner"
                                style={{
                                  background: isDarkHeader ? 'rgba(0,0,0,0.3)' : '#1e3a8a',
                                  color: '#ffffff',
                                  fontSize: 17,
                                  fontWeight: 800,
                                  padding: '6px 22px',
                                  borderRadius: 999,
                                  display: 'inline-block',
                                  boxShadow: '0 2px 8px rgba(0,0,0,0.18)'
                                }}
                              >
                                INR {p.price}
                              </span>
                            </div>

                            {/* Buy Now Button in Header */}
                            <div>
                              {isCurrent ? (
                                <button 
                                  type="button" 
                                  className="btn btn-sm"
                                  disabled
                                  style={{
                                    background: 'rgba(255,255,255,0.7)',
                                    color: '#0f172a',
                                    fontWeight: 800,
                                    borderRadius: 999,
                                    padding: '7px 24px',
                                    border: 'none',
                                    fontSize: 13
                                  }}
                                >
                                  ✓ Current Plan
                                </button>
                              ) : (
                                <button 
                                  type="button" 
                                  className="btn-buy-plan-pill"
                                  onClick={() => handleOpenPurchase(p)}
                                  style={{
                                    background: isDarkHeader ? '#ffffff' : '#1e3a8a',
                                    color: isDarkHeader ? '#141b47' : '#ffffff',
                                    fontWeight: 800,
                                    borderRadius: 999,
                                    padding: '8px 26px',
                                    border: 'none',
                                    fontSize: 14,
                                    cursor: 'pointer',
                                    boxShadow: '0 4px 14px rgba(0,0,0,0.25)',
                                    transition: 'all 0.2s ease'
                                  }}
                                >
                                  Buy Now
                                </button>
                              )}
                            </div>
                          </div>
                        </th>
                      )
                    })}
                  </tr>
                </thead>

                <tbody>
                  {/* Row 1: Daily msg limit */}
                  <tr className="pricing-spec-row">
                    <td className="pricing-spec-label font-weight-bold" style={{ padding: '16px 20px', borderRight: '1px solid var(--zd-border, #eef2f6)' }}>
                      1. Daily Message Limit
                    </td>
                    {plans.map((p, idx) => (
                      <td key={p.planId || idx} className="text-center" style={{ padding: '14px 12px', borderRight: idx < plans.length - 1 ? '1px solid var(--zd-border, #eef2f6)' : 'none' }}>
                        <span className="plan-check-pill">
                          <span className="check-icon-circle">✓</span> {p.dailyLimit}
                        </span>
                      </td>
                    ))}
                  </tr>

                  {/* Row 2: Validity */}
                  <tr className="pricing-spec-row">
                    <td className="pricing-spec-label font-weight-bold" style={{ padding: '16px 20px', borderRight: '1px solid var(--zd-border, #eef2f6)' }}>
                      2. Validity
                    </td>
                    {plans.map((p, idx) => (
                      <td key={p.planId || idx} className="text-center" style={{ padding: '14px 12px', borderRight: idx < plans.length - 1 ? '1px solid var(--zd-border, #eef2f6)' : 'none' }}>
                        <span className="plan-check-pill">
                          <span className="check-icon-circle">✓</span> {p.validity}
                        </span>
                      </td>
                    ))}
                  </tr>

                  {/* Row 3: Device limit */}
                  <tr className="pricing-spec-row">
                    <td className="pricing-spec-label font-weight-bold" style={{ padding: '16px 20px', borderRight: '1px solid var(--zd-border, #eef2f6)' }}>
                      3. Device Limit
                    </td>
                    {plans.map((p, idx) => (
                      <td key={p.planId || idx} className="text-center" style={{ padding: '14px 12px', borderRight: idx < plans.length - 1 ? '1px solid var(--zd-border, #eef2f6)' : 'none' }}>
                        <span className="plan-check-pill">
                          <span className="check-icon-circle">✓</span> {p.deviceLimit}
                        </span>
                      </td>
                    ))}
                  </tr>

                  {/* Row 4: Device Add-on Price */}
                  <tr className="pricing-spec-row">
                    <td className="pricing-spec-label font-weight-bold" style={{ padding: '16px 20px', borderRight: '1px solid var(--zd-border, #eef2f6)' }}>
                      4. Extra Device Add-on
                    </td>
                    {plans.map((p, idx) => (
                      <td key={p.planId || idx} className="text-center" style={{ padding: '14px 12px', borderRight: idx < plans.length - 1 ? '1px solid var(--zd-border, #eef2f6)' : 'none' }}>
                        <span className="plan-addon-pill">
                          <span className="plus-icon-circle">+</span> ₹49 / device
                        </span>
                      </td>
                    ))}
                  </tr>

                  {/* Row 5: API Access */}
                  <tr className="pricing-spec-row">
                    <td className="pricing-spec-label font-weight-bold" style={{ padding: '16px 20px', borderRight: '1px solid var(--zd-border, #eef2f6)' }}>
                      5. API Access
                    </td>
                    {plans.map((p, idx) => (
                      <td key={p.planId || idx} className="text-center" style={{ padding: '14px 12px', borderRight: idx < plans.length - 1 ? '1px solid var(--zd-border, #eef2f6)' : 'none' }}>
                        {p.apiAccess ? (
                          <span className="plan-check-pill">
                            <span className="check-icon-circle">✓</span> Included
                          </span>
                        ) : (
                          <span className="plan-cross-pill">✕ Not Included</span>
                        )}
                      </td>
                    ))}
                  </tr>

                  {/* Row 6: Web access for send msg */}
                  <tr className="pricing-spec-row">
                    <td className="pricing-spec-label font-weight-bold" style={{ padding: '16px 20px', borderRight: '1px solid var(--zd-border, #eef2f6)' }}>
                      6. Web Access for Send Msg
                    </td>
                    {plans.map((p, idx) => (
                      <td key={p.planId || idx} className="text-center" style={{ padding: '14px 12px', borderRight: idx < plans.length - 1 ? '1px solid var(--zd-border, #eef2f6)' : 'none' }}>
                        {p.webAccess ? (
                          <span className="plan-check-pill">
                            <span className="check-icon-circle">✓</span> Included
                          </span>
                        ) : (
                          <span className="plan-cross-pill">✕ Not Included</span>
                        )}
                      </td>
                    ))}
                  </tr>

                  {/* Row 7: Send bulk msg */}
                  <tr className="pricing-spec-row">
                    <td className="pricing-spec-label font-weight-bold" style={{ padding: '16px 20px', borderRight: '1px solid var(--zd-border, #eef2f6)' }}>
                      7. Send Bulk Msg
                    </td>
                    {plans.map((p, idx) => (
                      <td key={p.planId || idx} className="text-center" style={{ padding: '14px 12px', borderRight: idx < plans.length - 1 ? '1px solid var(--zd-border, #eef2f6)' : 'none' }}>
                        {p.bulkMsg ? (
                          <span className="plan-check-pill">
                            <span className="check-icon-circle">✓</span> Included
                          </span>
                        ) : (
                          <span className="plan-cross-pill">✕ Not Included</span>
                        )}
                      </td>
                    ))}
                  </tr>

                  {/* Row 8: Group option */}
                  <tr className="pricing-spec-row">
                    <td className="pricing-spec-label font-weight-bold" style={{ padding: '16px 20px', borderRight: '1px solid var(--zd-border, #eef2f6)' }}>
                      8. Group Option
                    </td>
                    {plans.map((p, idx) => (
                      <td key={p.planId || idx} className="text-center" style={{ padding: '14px 12px', borderRight: idx < plans.length - 1 ? '1px solid var(--zd-border, #eef2f6)' : 'none' }}>
                        {p.groupOption ? (
                          <span className="plan-check-pill">
                            <span className="check-icon-circle">✓</span> Included
                          </span>
                        ) : (
                          <span className="plan-cross-pill">✕ Not Included</span>
                        )}
                      </td>
                    ))}
                  </tr>

                  {/* Row 9: Send schedule msg */}
                  <tr className="pricing-spec-row">
                    <td className="pricing-spec-label font-weight-bold" style={{ padding: '16px 20px', borderRight: '1px solid var(--zd-border, #eef2f6)' }}>
                      9. Send Schedule Msg
                    </td>
                    {plans.map((p, idx) => (
                      <td key={p.planId || idx} className="text-center" style={{ padding: '14px 12px', borderRight: idx < plans.length - 1 ? '1px solid var(--zd-border, #eef2f6)' : 'none' }}>
                        {p.scheduleMsg ? (
                          <span className="plan-check-pill">
                            <span className="check-icon-circle">✓</span> Included
                          </span>
                        ) : (
                          <span className="plan-cross-pill">✕ Not Included</span>
                        )}
                      </td>
                    ))}
                  </tr>

                  {/* Row 10: IP security */}
                  <tr className="pricing-spec-row">
                    <td className="pricing-spec-label font-weight-bold" style={{ padding: '16px 20px', borderRight: '1px solid var(--zd-border, #eef2f6)' }}>
                      10. IP Security
                    </td>
                    {plans.map((p, idx) => (
                      <td key={p.planId || idx} className="text-center" style={{ padding: '14px 12px', borderRight: idx < plans.length - 1 ? '1px solid var(--zd-border, #eef2f6)' : 'none' }}>
                        {p.ipSecurity ? (
                          <span className="plan-check-pill">
                            <span className="check-icon-circle">✓</span> Included
                          </span>
                        ) : (
                          <span className="plan-cross-pill">✕ Not Included</span>
                        )}
                      </td>
                    ))}
                  </tr>

                  {/* Bottom Action Row with duplicate Buy Now buttons */}
                  <tr className="pricing-spec-row" style={{ background: 'var(--zd-border-subtle, rgba(0,0,0,0.02))' }}>
                    <td className="pricing-spec-label font-weight-bold" style={{ padding: '20px', borderRight: '1px solid var(--zd-border, #eef2f6)' }}>
                      Ready to get started?
                    </td>
                    {plans.map((p, idx) => {
                      const isCurrent = currentPlan?.toLowerCase() === p.name?.toLowerCase()
                      return (
                        <td key={p.planId || idx} className="text-center" style={{ padding: '20px 12px', borderRight: idx < plans.length - 1 ? '1px solid var(--zd-border, #eef2f6)' : 'none' }}>
                          {isCurrent ? (
                            <span className="badge badge-success-light" style={{ padding: '8px 18px', fontSize: 13, borderRadius: 20 }}>
                              ✓ Active Plan
                            </span>
                          ) : (
                            <button
                              type="button"
                              className="btn btn-primary"
                              onClick={() => handleOpenPurchase(p)}
                              style={{ borderRadius: 999, padding: '7px 22px', fontSize: 13, fontWeight: 700 }}
                            >
                              Buy {p.name}
                            </button>
                          )}
                        </td>
                      )
                    })}
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )
      ) : (
        /* MY PURCHASE REQUESTS TAB */
        <div className="card shadow-sm" style={{ borderRadius: 16 }}>
          <div className="card-header d-flex align-items-center justify-content-between" style={{ padding: '16px 20px', borderBottom: '1px solid var(--zd-border, rgba(0,0,0,0.06))' }}>
            <div>
              <h5 className="card-title mb-0" style={{ fontSize: 16, fontWeight: 700 }}>
                📋 My Subscription Purchase History
              </h5>
              <small className="text-muted">Track all your submitted plan purchase payments and activation statuses.</small>
            </div>
            <button 
              type="button" 
              className="btn btn-sm btn-outline-primary"
              onClick={fetchPlansData}
              style={{ borderRadius: 8 }}
            >
              ↻ Refresh
            </button>
          </div>

          <div className="card-body p-0">
            {myRequests.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '60px 20px' }}>
                <div style={{ fontSize: 36, marginBottom: 12 }}>💳</div>
                <h4>आपने अभी तक कोई पेमेंट रिक्वेस्ट नहीं भेजी है</h4>
                <p className="text-muted mb-3">You haven't submitted any plan purchase requests yet.</p>
                <button type="button" className="btn btn-primary" onClick={() => setActiveTab('plans')}>
                  Browse Plans &amp; Pricing
                </button>
              </div>
            ) : (
              <div className="table-responsive">
                <table className="table card-table table-vcenter text-nowrap mb-0">
                  <thead>
                    <tr style={{ background: 'var(--zd-card-bg, #f8fafc)', borderBottom: '1px solid var(--zd-border, #eef2f6)' }}>
                      <th style={{ fontWeight: 700 }}>Request ID</th>
                      <th style={{ fontWeight: 700 }}>Plan Name</th>
                      <th style={{ fontWeight: 700 }}>Amount</th>
                      <th style={{ fontWeight: 700 }}>Payment Date</th>
                      <th style={{ fontWeight: 700 }}>Bank / Txn Details</th>
                      <th style={{ fontWeight: 700 }}>Status</th>
                      <th style={{ fontWeight: 700 }}>Submitted On</th>
                      <th style={{ fontWeight: 700 }}>Notes / Reason</th>
                    </tr>
                  </thead>
                  <tbody>
                    {myRequests.map((req) => (
                      <tr key={req.requestId}>
                        <td>
                          <span style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: 12, color: 'var(--zd-text-muted, #64748b)' }}>
                            {req.requestId}
                          </span>
                        </td>
                        <td>
                          <strong style={{ fontSize: 14 }}>{req.planName}</strong>
                        </td>
                        <td>
                          <span style={{ fontSize: 15, fontWeight: 700, color: '#10b981' }}>
                            ₹{req.amount}
                          </span>
                        </td>
                        <td>
                          <span style={{ fontSize: 13 }}>{req.paymentDate}</span>
                        </td>
                        <td>
                          <div style={{ fontSize: 12, maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis' }} title={req.bankDetails}>
                            {req.bankDetails}
                          </div>
                        </td>
                        <td>
                          {req.status === 'pending' && (
                            <span className="badge badge-warning" style={{ fontSize: 11, padding: '4px 10px', borderRadius: 999 }}>
                              ⏳ Pending Review
                            </span>
                          )}
                          {req.status === 'approved' && (
                            <span className="badge badge-success" style={{ fontSize: 11, padding: '4px 10px', borderRadius: 999 }}>
                              ✓ Activated / Approved
                            </span>
                          )}
                          {req.status === 'rejected' && (
                            <span className="badge badge-danger" style={{ fontSize: 11, padding: '4px 10px', borderRadius: 999 }}>
                              ✕ Rejected
                            </span>
                          )}
                        </td>
                        <td>
                          <span style={{ fontSize: 12, color: 'var(--zd-text-muted, #8a98ac)' }}>
                            {req.createdAt ? new Date(req.createdAt).toLocaleDateString() : '-'}
                          </span>
                        </td>
                        <td>
                          <span style={{ fontSize: 12, color: 'var(--zd-text-muted, #8a98ac)' }}>
                            {req.adminNotes || '-'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* PAYMENT DETAILS POPUP MODAL (When user clicks Buy Now) */}
      {selectedPlan && (
        <PaymentDetailsModal 
          plan={selectedPlan}
          onClose={() => setSelectedPlan(null)}
          onSuccess={handlePurchaseSuccess}
          notify={notify}
        />
      )}
    </section>
  )
}
