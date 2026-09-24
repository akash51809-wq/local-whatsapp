import React, { useRef, useState } from 'react'
import api from '../../services/api'

export function PaymentDetailsModal({ plan, onClose, onSuccess, notify }) {
  const [amount, setAmount] = useState(plan.price)
  const [paymentDate, setPaymentDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [bankDetails, setBankDetails] = useState('')
  const [notes, setNotes] = useState('')
  const [screenshot, setScreenshot] = useState('')
  const [screenshotPreview, setScreenshotPreview] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const fileInputRef = useRef(null)

  const handleFileChange = (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (file.size > 5 * 1024 * 1024) {
      return notify('फाइल का आकार 5MB से कम होना चाहिए।')
    }

    const reader = new FileReader()
    reader.onload = () => {
      setScreenshot(reader.result)
      setScreenshotPreview(reader.result)
    }
    reader.readAsDataURL(file)
  }

  const removeScreenshot = () => {
    setScreenshot('')
    setScreenshotPreview('')
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!bankDetails.trim()) {
      return notify('कृपया Payment / Bank / UTR Details अवश्य भरें।')
    }

    setSubmitting(true)
    try {
      const d = await api('/api/plans/purchase', {
        method: 'POST',
        body: JSON.stringify({
          planId: plan.planId,
          amount: Number(amount) || plan.price,
          paymentDate,
          bankDetails: bankDetails.trim(),
          screenshot,
          notes: notes.trim()
        })
      })

      if (d.success) {
        notify('आपकी पेमेंट रिक्वेस्ट सफलतापूर्वक सबमिट हो गई है! एडमिन द्वारा अप्रूवल के बाद प्लान एक्टिवेट हो जाएगा।')
        onSuccess()
      }
    } catch (e) {
      notify('रिक्वेस्ट सबमिट करने में त्रुटि: ' + e.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div 
        className="modal-content-card" 
        onClick={e => e.stopPropagation()} 
        style={{ maxWidth: 580, width: '92%', borderRadius: 18, maxHeight: '92vh', overflowY: 'auto' }}
      >
        {/* Modal Header */}
        <div className="modal-header d-flex align-items-center justify-content-between" style={{ padding: '18px 24px', borderBottom: '1px solid var(--zd-border, #eef2f6)' }}>
          <div>
            <h5 className="modal-title font-weight-bold m-0" style={{ fontSize: 18, color: 'inherit' }}>
              💳 Complete Your Purchase
            </h5>
            <small className="text-muted">Enter your payment transaction details to activate {plan.name} plan.</small>
          </div>
          <button 
            type="button" 
            onClick={onClose}
            style={{ background: 'none', border: 'none', fontSize: 24, cursor: 'pointer', color: '#8a98ac', lineHeight: 1 }}
          >
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body" style={{ padding: '22px 24px' }}>
            {/* Selected Plan Summary Card */}
            <div className="card p-3 mb-4" style={{ borderRadius: 12, background: 'var(--zd-border-subtle, rgba(0,0,0,0.02))', border: '1px solid var(--zd-border, #eef2f6)' }}>
              <div className="d-flex align-items-center justify-content-between mb-2">
                <div>
                  <span className="badge badge-primary-light" style={{ fontSize: 11, padding: '3px 8px', marginBottom: 4, display: 'inline-block' }}>
                    Selected Plan
                  </span>
                  <h4 className="m-0 font-weight-bold" style={{ fontSize: 18, color: 'inherit' }}>{plan.name}</h4>
                </div>
                <div className="text-right">
                  <span style={{ fontSize: 22, fontWeight: 900, color: '#10b981' }}>₹{plan.price}</span>
                  <small className="text-muted d-block" style={{ fontSize: 11 }}>/ {plan.validity}</small>
                </div>
              </div>
              <div className="d-flex flex-wrap gap-2 text-muted" style={{ gap: 12, fontSize: 12, borderTop: '1px solid var(--zd-border, rgba(0,0,0,0.05))', paddingTop: 8 }}>
                <div>✓ <strong>Daily:</strong> {plan.dailyLimit}</div>
                <div>✓ <strong>Devices:</strong> {plan.deviceLimit}</div>
                {plan.apiAccess && <div>✓ <strong>API Access</strong></div>}
                {plan.groupOption && <div>✓ <strong>Group Sending</strong></div>}
              </div>
            </div>

            {/* Admin Bank & UPI Instructions Box */}
            <div className="alert alert-info mb-4" style={{ borderRadius: 12, padding: '12px 16px', fontSize: 12, lineHeight: 1.5 }}>
              <strong style={{ display: 'block', fontSize: 13, marginBottom: 4 }}>🏦 Payment Instructions:</strong>
              1. Pay the plan amount (<strong>₹{plan.price}</strong>) via Google Pay / PhonePe / Paytm / UPI to our payment address: 
              <div style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: 13, background: 'rgba(0,0,0,0.06)', padding: '4px 8px', borderRadius: 6, margin: '6px 0', display: 'inline-block' }}>
                upi-id: whatsapppay@upi / Bank Transfer
              </div>
              <div>2. Note the Transaction ID / UTR reference number and fill the form below.</div>
            </div>

            {/* Form Fields: Amount & Payment Date */}
            <div className="row g-3 mb-3">
              <div className="col-sm-6">
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, marginBottom: 6 }}>
                  Payment Amount (राशि ₹) *
                </label>
                <div className="input-group">
                  <span className="input-group-text" style={{ borderRadius: '8px 0 0 8px', fontWeight: 700 }}>₹</span>
                  <input 
                    type="number" 
                    className="form-control" 
                    value={amount}
                    onChange={e => setAmount(e.target.value)}
                    min="1"
                    required
                    style={{ height: 42, borderRadius: '0 8px 8px 0' }}
                  />
                </div>
              </div>
              <div className="col-sm-6">
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, marginBottom: 6 }}>
                  Payment Date (भुगतान की तारीख) *
                </label>
                <input 
                  type="date" 
                  className="form-control" 
                  value={paymentDate}
                  onChange={e => setPaymentDate(e.target.value)}
                  required
                  style={{ height: 42, borderRadius: 8 }}
                />
              </div>
            </div>

            {/* Bank Details & UTR */}
            <div className="form-group mb-3">
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, marginBottom: 6 }}>
                Bank / UPI / UTR Transaction ID (बैंक या UTR नंबर) *
              </label>
              <textarea 
                className="form-control" 
                rows="2"
                value={bankDetails}
                onChange={e => setBankDetails(e.target.value)}
                placeholder="e.g. Paid via Google Pay. UPI Ref / UTR No: 328491823901, Sender Bank: HDFC Bank"
                required
                style={{ borderRadius: 8, padding: '10px 12px' }}
              />
              <small className="text-muted">Enter UTR, Transaction Ref No, or Bank account from which payment was made.</small>
            </div>

            {/* Screenshot Upload (Optional) */}
            <div className="form-group mb-3">
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, marginBottom: 6 }}>
                Payment Screenshot / Receipt (स्क्रीनशॉट - वैकल्पिक)
              </label>
              <input 
                type="file" 
                ref={fileInputRef}
                accept="image/*"
                onChange={handleFileChange}
                className="form-control"
                style={{ height: 42, borderRadius: 8, padding: '7px 12px' }}
              />
              <small className="text-muted">Upload screenshot of your payment slip (PNG, JPG, max 5MB).</small>

              {screenshotPreview && (
                <div className="mt-2 position-relative d-inline-block">
                  <img 
                    src={screenshotPreview} 
                    alt="Payment Slip Preview" 
                    style={{ maxHeight: 110, borderRadius: 8, border: '1px solid #d0d7de', display: 'block' }}
                  />
                  <button 
                    type="button" 
                    onClick={removeScreenshot}
                    className="btn btn-sm btn-danger"
                    style={{ position: 'absolute', top: 4, right: 4, borderRadius: '50%', width: 22, height: 22, padding: 0, lineHeight: 1 }}
                    title="Remove Image"
                  >
                    ×
                  </button>
                </div>
              )}
            </div>

            {/* Notes */}
            <div className="form-group mb-0">
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, marginBottom: 6 }}>
                Additional Notes (अतिरिक्त टिप्पणी - वैकल्पिक)
              </label>
              <input 
                type="text" 
                className="form-control" 
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Any special remarks for admin"
                style={{ height: 40, borderRadius: 8 }}
              />
            </div>
          </div>

          <div className="modal-footer d-flex justify-content-end gap-2" style={{ padding: '14px 24px', borderTop: '1px solid var(--zd-border, #eef2f6)', gap: 10 }}>
            <button 
              type="button" 
              className="btn btn-outline-secondary" 
              onClick={onClose}
              disabled={submitting}
              style={{ borderRadius: 8, padding: '8px 16px', fontWeight: 600 }}
            >
              Cancel
            </button>
            <button 
              type="submit" 
              className="btn btn-primary"
              disabled={submitting}
              style={{ borderRadius: 8, padding: '8px 24px', fontWeight: 700 }}
            >
              {submitting ? '⏳ Submitting Request...' : '✓ Submit Payment Details'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default PaymentDetailsModal
