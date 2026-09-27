import React, { useEffect, useMemo, useRef, useState } from 'react'
import * as XLSX from 'xlsx'
import { useAuth } from '../../context/AuthContext'
import '../../styles/reports.css'

export function ReportsPage() {
  const {
    reports = [],
    loadReports: refresh,
    notify
  } = useAuth()

  // Polling every 6 seconds for live reports
  useEffect(() => {
    if (refresh) refresh()
    const interval = setInterval(() => {
      if (refresh) refresh()
    }, 6000)
    return () => clearInterval(interval)
  }, [refresh])

  // Filter States matching reference UI
  const [pageSize, setPageSize] = useState('25')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [msgType, setMsgType] = useState('all')
  const [msgSource, setMsgSource] = useState('all')
  const [fromNumber, setFromNumber] = useState('')
  const [toNumber, setToNumber] = useState('')
  const [searchMsg, setSearchMsg] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')

  // Pagination & Modal
  const [currentPage, setCurrentPage] = useState(1)
  const [selectedReport, setSelectedReport] = useState(null)

  const fromDateRef = useRef(null)
  const toDateRef = useRef(null)

  // Reset all filters
  const resetFilters = () => {
    setPageSize('25')
    setFromDate('')
    setToDate('')
    setMsgType('all')
    setMsgSource('all')
    setFromNumber('')
    setToNumber('')
    setSearchMsg('')
    setStatusFilter('all')
    setCurrentPage(1)
    if (notify) notify('Filters have been reset.')
  }

  // Filter computation
  const filteredReports = useMemo(() => {
    return reports.filter(r => {
      // 1. From Date
      if (fromDate) {
        const rTime = new Date(r.date || r.createdAt || r.timestamp).getTime()
        const fTime = new Date(fromDate).getTime()
        if (!isNaN(rTime) && rTime < fTime) return false
      }

      // 2. To Date
      if (toDate) {
        const rTime = new Date(r.date || r.createdAt || r.timestamp).getTime()
        const tEnd = new Date(toDate)
        tEnd.setHours(23, 59, 59, 999)
        if (!isNaN(rTime) && rTime > tEnd.getTime()) return false
      }

      // 3. Msg Type
      if (msgType !== 'all') {
        const t = (r.type || r.mediaType || 'text').toLowerCase()
        if (t !== msgType.toLowerCase()) return false
      }

      // 4. Source of Msg
      if (msgSource !== 'all') {
        const s = (r.source || 'manual').toLowerCase()
        if (!s.includes(msgSource.toLowerCase())) return false
      }

      // 5. From Number
      if (fromNumber.trim()) {
        const cleanF = fromNumber.replace(/\D/g, '')
        const rF = String(r.from || r.session || '').replace(/\D/g, '')
        if (cleanF && !rF.includes(cleanF)) return false
      }

      // 6. To Number
      if (toNumber.trim()) {
        const cleanT = toNumber.replace(/\D/g, '')
        const rT = String(r.to || r.recipient || r.number || '').replace(/\D/g, '')
        if (cleanT && !rT.includes(cleanT)) return false
      }

      // 7. Message search text
      if (searchMsg.trim()) {
        const q = searchMsg.toLowerCase().trim()
        const msg = String(r.message || r.text || '').toLowerCase()
        if (!msg.includes(q)) return false
      }

      // 8. Status
      if (statusFilter !== 'all') {
        const st = String(r.status || 'delivered').toLowerCase()
        if (statusFilter === 'delivered') {
          if (st !== 'delivered' && st !== 'sent' && st !== 'read') return false
        } else if (statusFilter === 'pending') {
          if (st !== 'pending' && st !== 'queued') return false
        } else if (statusFilter === 'failed') {
          if (st !== 'failed' && st !== 'error') return false
        }
      }

      return true
    })
  }, [reports, fromDate, toDate, msgType, msgSource, fromNumber, toNumber, searchMsg, statusFilter])

  // Pagination calculation
  const effPageSize = pageSize === 'All' ? (filteredReports.length || 1) : Number(pageSize)
  const totalPages = Math.max(1, Math.ceil(filteredReports.length / effPageSize))
  const safeCurrentPage = Math.min(currentPage, totalPages)

  const paginatedReports = useMemo(() => {
    if (pageSize === 'All') return filteredReports
    const start = (safeCurrentPage - 1) * effPageSize
    return filteredReports.slice(start, start + effPageSize)
  }, [filteredReports, safeCurrentPage, effPageSize, pageSize])

  // Excel Export
  const exportReport = () => {
    if (filteredReports.length === 0) {
      if (notify) notify('No records found to export.')
      return
    }

    try {
      const exportData = filteredReports.map((r, i) => {
        const d = r.date || r.createdAt ? new Date(r.date || r.createdAt) : null
        const dateStr = d
          ? `${d.toLocaleDateString('en-GB')} ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
          : 'N/A'

        return {
          'SL NO': i + 1,
          'Sender': r.from || r.session || 'WhatsApp',
          'Recipient': r.to || r.recipient || r.number || 'N/A',
          'Date & Time': dateStr,
          'Message': r.message || r.text || '',
          'Type': (r.type || r.mediaType || 'Text').toUpperCase(),
          'Source': (r.source || 'Manual').toUpperCase(),
          'Status': (r.status || 'Delivered').toUpperCase()
        }
      })

      const ws = XLSX.utils.json_to_sheet(exportData)
      ws['!cols'] = [
        { wch: 8 },
        { wch: 22 },
        { wch: 22 },
        { wch: 20 },
        { wch: 45 },
        { wch: 12 },
        { wch: 14 },
        { wch: 14 }
      ]
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, 'Message_Report')
      const today = new Date().toISOString().slice(0, 10)
      XLSX.writeFile(wb, `message_report_${today}.xlsx`)
      if (notify) notify('Report exported as Excel (.xlsx) successfully!')
    } catch (err) {
      if (notify) notify('Export error: ' + err.message)
    }
  }

  // Format Date for display (DD/MM/YYYY hh:mm A)
  const formatDateTime = (dateVal) => {
    if (!dateVal) return '—'
    try {
      const d = new Date(dateVal)
      if (isNaN(d.getTime())) return dateVal
      const day = String(d.getDate()).padStart(2, '0')
      const month = String(d.getMonth() + 1).padStart(2, '0')
      const year = d.getFullYear()
      const time = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      return `${day}/${month}/${year} ${time}`
    } catch {
      return dateVal
    }
  }

  // Status Badge Helper
  const getStatusBadge = (status) => {
    const s = String(status || 'delivered').toLowerCase()
    if (s === 'delivered' || s === 'sent' || s === 'read') {
      return <span className="badge success">Delivered</span>
    }
    if (s === 'failed' || s === 'error') {
      return <span className="badge failed">Failed</span>
    }
    return <span className="badge pending">Pending</span>
  }

  // Source Label Helper
  const getSourceLabel = (source, to) => {
    const s = String(source || '').toLowerCase()
    if (s === 'api') return 'API'
    if (s === 'campaign') return 'Campaign'
    if (s === 'group' || (to && to.includes('@g.us'))) return 'Group'
    if (s === 'scheduler' || s === 'schedule') return 'Scheduler'
    return 'Manual'
  }

  return (
    <div className="content">
      {/* ── Filter Card ── */}
      <article className="report-filter card">
        <div className="filter-head">
          <div>
            <h3>Message Filters</h3>
            <p>Quickly filter message records</p>
          </div>
          <div className="filter-inline">
            <div className="filter-field inline-reset">
              <label>RESET</label>
              <button
                className="filter-clear"
                type="button"
                id="filterReset"
                onClick={resetFilters}
              >
                ↻ Reset
              </button>
            </div>
          </div>
        </div>

        <div className="filter-grid">
          {/* SL NO / Page Size */}
          <div className="filter-field">
            <label>SL NO</label>
            <select
              className="select"
              id="slNo"
              value={pageSize}
              onChange={e => {
                setPageSize(e.target.value)
                setCurrentPage(1)
              }}
            >
              <option value="25">25</option>
              <option value="50">50</option>
              <option value="100">100</option>
              <option value="500">500</option>
              <option value="All">All</option>
            </select>
          </div>

          {/* From Date */}
          <div className="filter-field date-field">
            <label>FROM DATE</label>
            <div className="date-wrap">
              <input
                className="input date-text"
                id="fromDateText"
                type="text"
                placeholder="YYYY-MM-DD"
                value={fromDate}
                onChange={e => setFromDate(e.target.value)}
              />
              <button
                className="date-picker"
                type="button"
                onClick={() => fromDateRef.current?.showPicker ? fromDateRef.current.showPicker() : fromDateRef.current?.focus()}
              >
                ▣
              </button>
              <input
                ref={fromDateRef}
                className="native-date"
                id="fromDate"
                type="date"
                value={fromDate}
                onChange={e => setFromDate(e.target.value)}
                tabIndex={-1}
              />
            </div>
          </div>

          {/* To Date */}
          <div className="filter-field date-field">
            <label>TO DATE</label>
            <div className="date-wrap">
              <input
                className="input date-text"
                id="toDateText"
                type="text"
                placeholder="YYYY-MM-DD"
                value={toDate}
                onChange={e => setToDate(e.target.value)}
              />
              <button
                className="date-picker"
                type="button"
                onClick={() => toDateRef.current?.showPicker ? toDateRef.current.showPicker() : toDateRef.current?.focus()}
              >
                ▣
              </button>
              <input
                ref={toDateRef}
                className="native-date"
                id="toDate"
                type="date"
                value={toDate}
                onChange={e => setToDate(e.target.value)}
                tabIndex={-1}
              />
            </div>
          </div>

          {/* Msg Type */}
          <div className="filter-field">
            <label>MSG TYPE</label>
            <select
              className="select"
              value={msgType}
              onChange={e => {
                setMsgType(e.target.value)
                setCurrentPage(1)
              }}
            >
              <option value="all">All Message Types</option>
              <option value="text">Text</option>
              <option value="image">Image</option>
              <option value="document">Document</option>
              <option value="video">Video</option>
              <option value="voice">Voice</option>
            </select>
          </div>

          {/* Source of Msg */}
          <div className="filter-field">
            <label>SOURCE OF MSG</label>
            <select
              className="select"
              value={msgSource}
              onChange={e => {
                setMsgSource(e.target.value)
                setCurrentPage(1)
              }}
            >
              <option value="all">All Sources</option>
              <option value="manual">Manual</option>
              <option value="api">API</option>
              <option value="campaign">Campaign</option>
              <option value="group">Group</option>
              <option value="scheduler">Scheduler</option>
            </select>
          </div>

          {/* From Number */}
          <div className="filter-field">
            <label>FROM NUMBER</label>
            <input
              className="input"
              inputMode="numeric"
              placeholder="+91 98765 43210"
              value={fromNumber}
              onChange={e => {
                setFromNumber(e.target.value)
                setCurrentPage(1)
              }}
            />
          </div>

          {/* To Number */}
          <div className="filter-field">
            <label>TO NUMBER</label>
            <input
              className="input"
              inputMode="numeric"
              placeholder="+91 98123 45678"
              value={toNumber}
              onChange={e => {
                setToNumber(e.target.value)
                setCurrentPage(1)
              }}
            />
          </div>

          {/* Msg Search */}
          <div className="filter-field message-field">
            <label>MSG</label>
            <input
              className="input"
              type="search"
              placeholder="Search message text"
              value={searchMsg}
              onChange={e => {
                setSearchMsg(e.target.value)
                setCurrentPage(1)
              }}
            />
          </div>

          {/* Status */}
          <div className="filter-field status-field">
            <label>STATUS</label>
            <select
              className="select"
              value={statusFilter}
              onChange={e => {
                setStatusFilter(e.target.value)
                setCurrentPage(1)
              }}
            >
              <option value="all">All Status</option>
              <option value="delivered">Delivered</option>
              <option value="pending">Pending</option>
              <option value="failed">Failed</option>
            </select>
          </div>
        </div>
      </article>

      {/* ── Table Card ── */}
      <article className="card table-card">
        <div className="card-head compact-card-head">
          <div>
            <h3>Latest Activity</h3>
            <p>Live messaging records ({filteredReports.length} found)</p>
          </div>
          <button
            type="button"
            className="btn export-btn"
            onClick={exportReport}
          >
            Export Report
          </button>
        </div>

        <div className="table-wrap">
          <table className="table compact-report-table">
            <thead>
              <tr>
                <th>SL NO</th>
                <th>Sender</th>
                <th>Recipient</th>
                <th>Date &amp; Time</th>
                <th>Msg</th>
                <th>Status</th>
                <th>Source</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {paginatedReports.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: '36px 16px', color: '#718078' }}>
                    {reports.length === 0
                      ? 'No message reports recorded yet.'
                      : 'No records match the selected filter criteria.'}
                  </td>
                </tr>
              ) : (
                paginatedReports.map((r, idx) => {
                  const sl = pageSize === 'All' ? idx + 1 : (safeCurrentPage - 1) * effPageSize + idx + 1
                  const senderName = r.from || r.session || 'WhatsApp'
                  const recipient = r.to || r.recipient || r.number || '—'
                  const msgText = r.message || r.text || (r.type ? `[${r.type.toUpperCase()}]` : '—')

                  return (
                    <tr key={r.id || r._id || `${r.date}-${idx}`}>
                      <td>{sl}</td>
                      <td><b>{senderName}</b></td>
                      <td>{recipient}</td>
                      <td>{formatDateTime(r.date || r.createdAt)}</td>
                      <td style={{ maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {msgText}
                      </td>
                      <td>{getStatusBadge(r.status)}</td>
                      <td>{getSourceLabel(r.source, recipient)}</td>
                      <td>
                        <button
                          type="button"
                          className="table-action"
                          onClick={() => setSelectedReport(r)}
                        >
                          View
                        </button>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="report-pagination" aria-label="Message report pagination">
          <button
            className="page-nav"
            id="pagePrev"
            type="button"
            disabled={safeCurrentPage <= 1}
            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
          >
            ‹ Prev
          </button>

          <div className="page-numbers">
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              let pageNum
              if (totalPages <= 5) {
                pageNum = i + 1
              } else if (safeCurrentPage <= 3) {
                pageNum = i + 1
              } else if (safeCurrentPage >= totalPages - 2) {
                pageNum = totalPages - 4 + i
              } else {
                pageNum = safeCurrentPage - 2 + i
              }

              return (
                <button
                  key={pageNum}
                  className={`page-number ${safeCurrentPage === pageNum ? 'active' : ''}`}
                  type="button"
                  data-page={pageNum}
                  onClick={() => setCurrentPage(pageNum)}
                >
                  {pageNum}
                </button>
              )
            })}
          </div>

          <button
            className="page-nav"
            id="pageNext"
            type="button"
            disabled={safeCurrentPage >= totalPages}
            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
          >
            Next ›
          </button>

          <span className="page-info" id="pageInfo">
            Page {safeCurrentPage} of {totalPages}
          </span>
        </div>
      </article>

      {/* ── View Detail Modal ── */}
      {selectedReport && (
        <div className="report-modal-overlay" onClick={() => setSelectedReport(null)}>
          <div className="report-modal-card" onClick={e => e.stopPropagation()}>
            <div className="report-modal-head">
              <h3>Message Details</h3>
              <button
                type="button"
                className="report-modal-close"
                onClick={() => setSelectedReport(null)}
              >
                ✕
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
              <div style={{ background: 'rgba(255,255,255,0.7)', padding: '10px 12px', borderRadius: 10, border: '1px solid rgba(30,58,45,0.08)' }}>
                <small style={{ display: 'block', fontSize: 9, fontWeight: 800, color: '#718078' }}>SENDER</small>
                <strong style={{ fontSize: 13, color: '#17372a' }}>{selectedReport.from || selectedReport.session || 'WhatsApp'}</strong>
              </div>
              <div style={{ background: 'rgba(255,255,255,0.7)', padding: '10px 12px', borderRadius: 10, border: '1px solid rgba(30,58,45,0.08)' }}>
                <small style={{ display: 'block', fontSize: 9, fontWeight: 800, color: '#718078' }}>RECIPIENT</small>
                <strong style={{ fontSize: 13, color: '#17372a' }}>{selectedReport.to || selectedReport.recipient || selectedReport.number || '—'}</strong>
              </div>
              <div style={{ background: 'rgba(255,255,255,0.7)', padding: '10px 12px', borderRadius: 10, border: '1px solid rgba(30,58,45,0.08)' }}>
                <small style={{ display: 'block', fontSize: 9, fontWeight: 800, color: '#718078' }}>DATE &amp; TIME</small>
                <strong style={{ fontSize: 12, color: '#17372a' }}>{formatDateTime(selectedReport.date || selectedReport.createdAt)}</strong>
              </div>
              <div style={{ background: 'rgba(255,255,255,0.7)', padding: '10px 12px', borderRadius: 10, border: '1px solid rgba(30,58,45,0.08)' }}>
                <small style={{ display: 'block', fontSize: 9, fontWeight: 800, color: '#718078' }}>STATUS</small>
                <div style={{ marginTop: 2 }}>{getStatusBadge(selectedReport.status)}</div>
              </div>
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 10, fontWeight: 800, color: '#60766c', marginBottom: 4 }}>
                MESSAGE CONTENT
              </label>
              <div
                style={{
                  padding: '12px 14px',
                  background: '#ffffff',
                  border: '1px solid rgba(30,58,45,0.1)',
                  borderRadius: 12,
                  fontSize: 13,
                  fontWeight: 600,
                  color: '#183126',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                  maxHeight: 180,
                  overflowY: 'auto'
                }}
              >
                {selectedReport.message || selectedReport.text || '—'}
              </div>
            </div>

            {selectedReport.error && (
              <div
                style={{
                  padding: '8px 12px',
                  background: '#feeef1',
                  color: '#e85b63',
                  borderRadius: 8,
                  fontSize: 11,
                  fontWeight: 700,
                  marginBottom: 16
                }}
              >
                ⚠️ Error: {selectedReport.error}
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button
                type="button"
                className="btn primary"
                onClick={() => setSelectedReport(null)}
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

export default ReportsPage
