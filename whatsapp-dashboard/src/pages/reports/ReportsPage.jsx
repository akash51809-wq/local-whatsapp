import React, { useMemo, useState } from 'react'
import * as XLSX from 'xlsx'
import Stat from '../../components/common/Stat'
import { useAuth } from '../../context/AuthContext'

export function ReportsPage() {
  const {
    reports = [],
    reportStats = {},
    loadReports: refresh,
    notify
  } = useAuth()

  const stats = reportStats

  // Filters state
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [fromNumber, setFromNumber] = useState('all')
  const [toNumber, setToNumber] = useState('')
  const [msgType, setMsgType] = useState('all')
  const [msgSource, setMsgSource] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')

  // Pagination & detail modal
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(25)
  const [selectedReport, setSelectedReport] = useState(null)
  const [isRefreshing, setIsRefreshing] = useState(false)

  // Extract unique sender numbers for dropdown
  const uniqueFromNumbers = useMemo(() => {
    const set = new Set()
    reports.forEach(r => {
      const f = r.from || r.session
      if (f) set.add(String(f).trim())
    })
    return Array.from(set).filter(Boolean)
  }, [reports])

  // Reset all filters
  const resetFilters = () => {
    setFromDate('')
    setToDate('')
    setFromNumber('all')
    setToNumber('')
    setMsgType('all')
    setMsgSource('all')
    setStatusFilter('all')
    setSearchQuery('')
    setCurrentPage(1)
    if (notify) notify('फ़िल्टर रीसेट कर दिए गए हैं (Filters reset)')
  }

  // Handle manual refresh
  const handleRefresh = async () => {
    if (isRefreshing) return
    setIsRefreshing(true)
    try {
      if (refresh) await refresh()
      if (notify) notify('✓ रिपोर्ट्स रीफ़्रेश हो गई हैं (Reports refreshed)')
    } catch (e) {
      if (notify) notify('Refresh failed: ' + e.message)
    } finally {
      setIsRefreshing(false)
    }
  }

  // Filtered reports computation
  const filteredReports = useMemo(() => {
    return reports.filter(r => {
      // 1. From Date
      if (fromDate) {
        const rTime = new Date(r.date).getTime()
        const fTime = new Date(fromDate).getTime()
        if (rTime < fTime) return false
      }
      // 2. To Date
      if (toDate) {
        const rTime = new Date(r.date).getTime()
        const tEnd = new Date(toDate)
        tEnd.setHours(23, 59, 59, 999)
        if (rTime > tEnd.getTime()) return false
      }
      // 3. From Number
      if (fromNumber && fromNumber !== 'all') {
        const cleanF = fromNumber.replace(/\D/g, '')
        const rF = String(r.from || r.session || '').replace(/\D/g, '')
        if (cleanF && !rF.includes(cleanF)) return false
      }
      // 4. To Number
      if (toNumber.trim()) {
        const cleanT = toNumber.replace(/\D/g, '')
        const rT = String(r.to || r.recipient || r.number || '').replace(/\D/g, '')
        const rawT = String(r.to || r.recipient || r.number || '').toLowerCase()
        if (cleanT) {
          if (!rT.includes(cleanT) && !rawT.includes(toNumber.toLowerCase().trim())) return false
        } else {
          if (!rawT.includes(toNumber.toLowerCase().trim())) return false
        }
      }
      // 5. Type of Msg
      if (msgType !== 'all') {
        const rType = String(r.type || 'text').toLowerCase()
        if (rType !== msgType.toLowerCase()) return false
      }
      // 6. Source of Msg
      if (msgSource !== 'all') {
        const rSrc = String(r.source || 'web').toLowerCase()
        if (rSrc !== msgSource.toLowerCase()) return false
      }
      // 7. Status Filter
      if (statusFilter !== 'all') {
        const rStat = String(r.status || 'sent').toLowerCase()
        if (rStat !== statusFilter.toLowerCase()) return false
      }
      // 8. Search query in message or party
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim()
        const msg = String(r.message || r.text || '').toLowerCase()
        const to = String(r.to || r.recipient || '').toLowerCase()
        const from = String(r.from || r.session || '').toLowerCase()
        if (!msg.includes(q) && !to.includes(q) && !from.includes(q)) return false
      }
      return true
    })
  }, [reports, fromDate, toDate, fromNumber, toNumber, msgType, msgSource, statusFilter, searchQuery])

  // Count active filters
  const activeFilterCount = useMemo(() => {
    let count = 0
    if (fromDate) count++
    if (toDate) count++
    if (fromNumber !== 'all') count++
    if (toNumber.trim()) count++
    if (msgType !== 'all') count++
    if (msgSource !== 'all') count++
    if (statusFilter !== 'all') count++
    if (searchQuery.trim()) count++
    return count
  }, [fromDate, toDate, fromNumber, toNumber, msgType, msgSource, statusFilter, searchQuery])

  // Pagination calculation
  const effPageSize = pageSize === 'all' ? (filteredReports.length || 1) : Number(pageSize)
  const totalPages = Math.max(1, Math.ceil(filteredReports.length / effPageSize))
  const safeCurrentPage = Math.min(currentPage, totalPages)

  const paginatedReports = useMemo(() => {
    if (pageSize === 'all') return filteredReports
    const start = (safeCurrentPage - 1) * effPageSize
    return filteredReports.slice(start, start + effPageSize)
  }, [filteredReports, safeCurrentPage, effPageSize, pageSize])

  // Download Excel functionality
  const downloadExcel = () => {
    if (!filteredReports || filteredReports.length === 0) {
      if (notify) notify('डाउनलोड करने के लिए कोई रिपोर्ट उपलब्ध नहीं है (No reports to export)')
      return
    }
    try {
      const exportData = filteredReports.map((r, i) => {
        const d = r.date ? new Date(r.date) : null
        const formattedDate = d 
          ? `${d.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })} ${d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}`
          : 'N/A'

        const typeLabel = (r.type || (r.message && r.message.startsWith('[IMAGE') ? 'image' : 'text')).toUpperCase()
        const sourceLabel = r.source === 'api' ? 'API Integration' 
          : r.source === 'group' ? 'Group Send' 
          : r.source === 'direct' ? 'Direct Reply' 
          : 'Web Portal'

        return {
          'SL No': i + 1,
          'From Number': r.from || r.session || 'N/A',
          'To Number': r.to || r.recipient || r.number || 'N/A',
          'Date Time': formattedDate,
          'Msg': r.message || r.text || '',
          'Type': typeLabel,
          'Source': sourceLabel,
          'Status': (r.status || 'sent').toUpperCase()
        }
      })

      const ws = XLSX.utils.json_to_sheet(exportData)
      ws['!cols'] = [
        { wch: 8 },  // SL No
        { wch: 20 }, // From Number
        { wch: 24 }, // To Number
        { wch: 22 }, // Date Time
        { wch: 45 }, // Msg
        { wch: 12 }, // Type
        { wch: 18 }, // Source
        { wch: 14 }  // Status
      ]
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, 'Message_Reports')
      const today = new Date().toISOString().slice(0, 10)
      XLSX.writeFile(wb, `whatsapp_message_reports_${today}.xlsx`)
      if (notify) notify('✓ Message reports downloaded as Excel (.xlsx)!')
    } catch (err) {
      if (notify) notify('Excel export error: ' + err.message)
    }
  }

  // Format Helper for Date
  const formatDateTime = (dateStr) => {
    if (!dateStr) return '-'
    try {
      const d = new Date(dateStr)
      if (isNaN(d.getTime())) return dateStr
      return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) + ', ' +
             d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })
    } catch {
      return dateStr
    }
  }

  // Type Badge helper
  const renderTypeBadge = (type, message) => {
    let t = (type || '').toLowerCase()
    if (!t) {
      const m = (message || '').toLowerCase()
      if (m.startsWith('[image') || m.includes('.jpg') || m.includes('.png')) t = 'image'
      else if (m.startsWith('[document') || m.startsWith('[file') || m.includes('.pdf')) t = 'document'
      else if (m.startsWith('[video') || m.includes('.mp4')) t = 'video'
      else if (m.startsWith('[audio') || m.includes('.mp3')) t = 'audio'
      else if (m.startsWith('[sticker')) t = 'sticker'
      else t = 'text'
    }

    switch (t) {
      case 'image':
        return <span className="report-badge-type" title="Image Message">🖼️ Image</span>
      case 'document':
        return <span className="report-badge-type" title="Document / File">📄 Document</span>
      case 'video':
        return <span className="report-badge-type" title="Video Message">🎥 Video</span>
      case 'audio':
        return <span className="report-badge-type" title="Audio Message">🎵 Audio</span>
      case 'sticker':
        return <span className="report-badge-type" title="Sticker">🏷️ Sticker</span>
      default:
        return <span className="report-badge-type" title="Text Message">💬 Text</span>
    }
  }

  // Source Badge helper
  const renderSourceBadge = (source, to) => {
    let s = (source || '').toLowerCase()
    if (!s) {
      if (to && (to.includes('@g.us') || to.length > 18 || to.startsWith('grp_'))) s = 'group'
      else s = 'web'
    }

    switch (s) {
      case 'api':
        return <span className="report-badge-source" title="Sent via REST API Integration">🔌 API</span>
      case 'group':
        return <span className="report-badge-source" title="Sent to WhatsApp Group">👥 Group</span>
      case 'direct':
        return <span className="report-badge-source" title="Direct 1-on-1 Reply">💬 Direct</span>
      default:
        return <span className="report-badge-source" title="Sent via Web Dashboard">🌐 Web Portal</span>
    }
  }

  // Status Badge helper
  const renderStatusBadge = (status) => {
    const st = String(status || 'sent').toLowerCase()
    if (st === 'sent' || st === 'delivered' || st === 'read') {
      return <span className="report-status-badge report-status-sent">✓ Sent</span>
    }
    if (st === 'failed' || st === 'error') {
      return <span className="report-status-badge report-status-failed">✕ Failed</span>
    }
    return <span className="report-status-badge report-status-pending">◷ {st}</span>
  }

  return (
    <section className="reports-page-section">
      {/* Zendesk Page Header */}
      <div className="page-header d-flex flex-wrap align-items-center justify-content-between mb-4">
        <div className="page-leftheader">
          <h4 className="page-title mb-1 font-weight-bold" style={{ fontSize: '1.35rem', color: '#282f53' }}>Message Reports</h4>
          <ol className="breadcrumb mb-0" style={{ background: 'transparent', padding: 0, fontSize: '0.82rem' }}>
            <li className="breadcrumb-item"><a href="#apps" onClick={e => e.preventDefault()} style={{ color: '#705ec8' }}>Home</a></li>
            <li className="breadcrumb-item"><a href="#reports" onClick={e => e.preventDefault()} style={{ color: '#705ec8' }}>Reports</a></li>
            <li className="breadcrumb-item active" style={{ color: '#68798b' }}>Delivery Logs</li>
          </ol>
        </div>
        <div className="page-rightheader d-flex align-items-center gap-2 mt-2 mt-sm-0">
          <button 
            className="btn btn-outline-primary d-inline-flex align-items-center"
            onClick={downloadExcel}
            title="Download Message Reports to Excel (.xlsx)"
            style={{ fontWeight: 600, padding: '8px 16px', borderRadius: 8 }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 6 }}>
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
              <polyline points="7 10 12 15 17 10"></polyline>
              <line x1="12" y1="15" x2="12" y2="3"></line>
            </svg>
            Download Excel
          </button>
          <button 
            className="btn btn-primary d-inline-flex align-items-center"
            onClick={handleRefresh}
            disabled={isRefreshing}
            title="Refresh Message Reports"
            style={{ fontWeight: 600, padding: '8px 16px', borderRadius: 8 }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={isRefreshing ? 'spin-icon' : ''} style={{ marginRight: 6 }}>
              <polyline points="23 4 23 10 17 10"></polyline>
              <polyline points="1 20 1 14 7 14"></polyline>
              <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
            </svg>
            {isRefreshing ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>
      </div>

      {/* Summary KPI Stats */}
      <div className="stat-grid mb-4">
        <Stat value={stats.total ?? reports.length} label="Total Messages" icon="▤" />
        <Stat value={stats.sent ?? reports.filter(r => r.status === 'sent').length} label="Successful (Sent)" icon="✓" />
        <Stat value={stats.failed ?? reports.filter(r => r.status === 'failed').length} label="Failed Delivery" icon="!" />
        <Stat value={filteredReports.length} label="Filtered Results" icon="🔍" />
      </div>

      {/* Filter Toolbar Card */}
      <div className="reports-filter-card">
        <div className="reports-filter-header">
          <div className="reports-filter-title">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#705ec8" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"></polygon>
            </svg>
            <span>Filter Message Reports</span>
            {activeFilterCount > 0 && (
              <span className="badge badge-purple" style={{ fontSize: 11, padding: '2px 8px', borderRadius: 12 }}>
                {activeFilterCount} Active Filter{activeFilterCount > 1 ? 's' : ''}
              </span>
            )}
          </div>
          {activeFilterCount > 0 && (
            <button 
              className="btn btn-sm btn-link text-danger p-0" 
              onClick={resetFilters}
              style={{ fontSize: 12, textDecoration: 'none', fontWeight: 600 }}
            >
              ↺ Reset All Filters
            </button>
          )}
        </div>

        <div className="reports-filter-grid">
          {/* 1. From Date */}
          <div className="report-filter-field">
            <label>From Date</label>
            <input 
              type="date" 
              className="report-filter-input" 
              value={fromDate} 
              onChange={e => { setFromDate(e.target.value); setCurrentPage(1); }} 
            />
          </div>

          {/* 2. To Date */}
          <div className="report-filter-field">
            <label>To Date</label>
            <input 
              type="date" 
              className="report-filter-input" 
              value={toDate} 
              onChange={e => { setToDate(e.target.value); setCurrentPage(1); }} 
            />
          </div>

          {/* 3. From Number */}
          <div className="report-filter-field">
            <label>From Number</label>
            <select 
              className="report-filter-select"
              value={fromNumber}
              onChange={e => { setFromNumber(e.target.value); setCurrentPage(1); }}
            >
              <option value="all">All Senders (सभी नंबर्स)</option>
              {uniqueFromNumbers.map((num, idx) => (
                <option key={idx} value={num}>{num}</option>
              ))}
            </select>
          </div>

          {/* 4. To Number */}
          <div className="report-filter-field">
            <label>To Number</label>
            <input 
              type="text" 
              className="report-filter-input" 
              placeholder="Search recipient number..." 
              value={toNumber} 
              onChange={e => { setToNumber(e.target.value); setCurrentPage(1); }} 
            />
          </div>

          {/* 5. Type of Msg */}
          <div className="report-filter-field">
            <label>Type of Msg</label>
            <select 
              className="report-filter-select"
              value={msgType}
              onChange={e => { setMsgType(e.target.value); setCurrentPage(1); }}
            >
              <option value="all">All Types (सभी प्रकार)</option>
              <option value="text">💬 Text Message</option>
              <option value="image">🖼️ Image</option>
              <option value="document">📄 Document / File</option>
              <option value="video">🎥 Video</option>
              <option value="audio">🎵 Audio</option>
              <option value="sticker">🏷️ Sticker</option>
            </select>
          </div>

          {/* 6. Source of Msg */}
          <div className="report-filter-field">
            <label>Source of Msg</label>
            <select 
              className="report-filter-select"
              value={msgSource}
              onChange={e => { setMsgSource(e.target.value); setCurrentPage(1); }}
            >
              <option value="all">All Sources (सभी सोर्स)</option>
              <option value="web">🌐 Web Portal / Bulk</option>
              <option value="api">🔌 API Integration</option>
              <option value="group">👥 Group Send</option>
              <option value="direct">💬 Direct Reply</option>
            </select>
          </div>

          {/* 7. Status */}
          <div className="report-filter-field">
            <label>Status</label>
            <select 
              className="report-filter-select"
              value={statusFilter}
              onChange={e => { setStatusFilter(e.target.value); setCurrentPage(1); }}
            >
              <option value="all">All Statuses (सभी स्थिति)</option>
              <option value="sent">✓ Sent (सफल)</option>
              <option value="failed">✕ Failed (असफल)</option>
              <option value="pending">◷ Pending (प्रतीक्षारत)</option>
            </select>
          </div>

          {/* 8. Search Content */}
          <div className="report-filter-field">
            <label>Search in Message</label>
            <input 
              type="text" 
              className="report-filter-input" 
              placeholder="Search keyword in text..." 
              value={searchQuery} 
              onChange={e => { setSearchQuery(e.target.value); setCurrentPage(1); }} 
            />
          </div>
        </div>
      </div>

      {/* Detail Table Card */}
      <div className="report-table-card">
        {/* Table Toolbar */}
        <div className="reports-table-toolbar">
          <div className="d-flex align-items-center gap-2">
            <span style={{ fontSize: 13, fontWeight: 600, color: '#68798b' }}>
              Showing {filteredReports.length === 0 ? 0 : (safeCurrentPage - 1) * effPageSize + 1} to {Math.min(safeCurrentPage * effPageSize, filteredReports.length)} of {filteredReports.length} records
            </span>
          </div>

          <div className="d-flex align-items-center gap-3">
            <div className="d-flex align-items-center gap-2">
              <span style={{ fontSize: 12, color: '#68798b', fontWeight: 600 }}>Rows per page:</span>
              <select 
                className="form-select form-select-sm"
                value={pageSize}
                onChange={e => { setPageSize(e.target.value === 'all' ? 'all' : Number(e.target.value)); setCurrentPage(1); }}
                style={{ width: 80, height: 32, fontSize: 12, borderRadius: 6, borderColor: '#dcdfe6' }}
              >
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
                <option value="all">All</option>
              </select>
            </div>

            {/* Pagination Buttons */}
            {totalPages > 1 && (
              <div className="d-flex align-items-center gap-1">
                <button 
                  className="btn btn-sm btn-outline-secondary"
                  disabled={safeCurrentPage <= 1}
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  style={{ padding: '4px 10px', fontSize: 12 }}
                >
                  ◀ Prev
                </button>
                <span style={{ fontSize: 12, fontWeight: 600, color: '#282f53', padding: '0 6px' }}>
                  {safeCurrentPage} / {totalPages}
                </span>
                <button 
                  className="btn btn-sm btn-outline-secondary"
                  disabled={safeCurrentPage >= totalPages}
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  style={{ padding: '4px 10px', fontSize: 12 }}
                >
                  Next ▶
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Table Content */}
        <div className="reports-table-container">
          <table className="reports-table">
            <thead>
              <tr>
                <th style={{ width: 60, textAlign: 'center' }}>SL No</th>
                <th style={{ width: 150 }}>From Number</th>
                <th style={{ width: 160 }}>To Number</th>
                <th style={{ width: 170 }}>Date Time</th>
                <th>Msg</th>
                <th style={{ width: 110 }}>Type</th>
                <th style={{ width: 120 }}>Source</th>
                <th style={{ width: 100 }}>Status</th>
                <th style={{ width: 80, textAlign: 'center' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {paginatedReports.map((r, i) => {
                const slNo = (safeCurrentPage - 1) * effPageSize + (i + 1)
                const isGroup = r.to && (r.to.includes('@g.us') || r.to.length > 18 || String(r.to).startsWith('grp_'))
                return (
                  <tr key={r.id || i} style={{ cursor: 'pointer' }} onClick={() => setSelectedReport(r)}>
                    <td style={{ textAlign: 'center', fontWeight: 600, color: '#68798b' }}>
                      {slNo}
                    </td>
                    <td>
                      <div className="d-flex align-items-center gap-2">
                        <span style={{ color: '#25D366', fontSize: 14 }}>📱</span>
                        <span style={{ fontWeight: 600, fontSize: 13 }}>{r.from || r.session || 'User'}</span>
                      </div>
                    </td>
                    <td>
                      <div className="d-flex align-items-center gap-2">
                        <span style={{ fontSize: 14 }}>{isGroup ? '👥' : '👤'}</span>
                        <span style={{ fontWeight: 500, fontSize: 13, wordBreak: 'break-all' }}>
                          {r.to || r.recipient || r.number || '-'}
                        </span>
                      </div>
                    </td>
                    <td style={{ whiteSpace: 'nowrap', fontSize: 12, color: '#64748b' }}>
                      {formatDateTime(r.date)}
                    </td>
                    <td style={{ maxWidth: 320 }}>
                      <div style={{
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        color: '#1e293b',
                        fontSize: 13
                      }} title={r.message || r.text || ''}>
                        {r.message || r.text || <span style={{ color: '#94a3b8', fontStyle: 'italic' }}>(No text)</span>}
                      </div>
                    </td>
                    <td>
                      {renderTypeBadge(r.type, r.message || r.text)}
                    </td>
                    <td>
                      {renderSourceBadge(r.source, r.to)}
                    </td>
                    <td>
                      {renderStatusBadge(r.status)}
                    </td>
                    <td style={{ textAlign: 'center' }} onClick={e => e.stopPropagation()}>
                      <button 
                        className="btn btn-sm btn-outline-secondary"
                        onClick={() => setSelectedReport(r)}
                        title="View Full Message Details"
                        style={{ padding: '3px 8px', fontSize: 12, borderRadius: 6 }}
                      >
                        👁️
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>

          {filteredReports.length === 0 && (
            <div style={{ padding: '40px 20px', textAlign: 'center' }}>
              <div style={{ fontSize: 36, marginBottom: 12 }}>📭</div>
              <h5 style={{ fontWeight: 600, color: '#282f53', marginBottom: 6 }}>No Message Reports Found</h5>
              <p style={{ color: '#68798b', fontSize: 13, marginBottom: 16 }}>
                {activeFilterCount > 0 
                  ? 'चयनित फ़िल्टर के अनुसार कोई संदेश नहीं मिला। फ़िल्टर रीसेट करके पुनः प्रयास करें।' 
                  : 'अभी तक कोई आउटगोइंग संदेश रिकॉर्ड नहीं किया गया है।'}
              </p>
              {activeFilterCount > 0 && (
                <button className="btn btn-sm btn-primary" onClick={resetFilters}>
                  ↺ Clear All Filters
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Message Detail Modal Popup */}
      {selectedReport && (
        <div 
          className="modal-backdrop-custom"
          onClick={() => setSelectedReport(null)}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.55)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: 20
          }}
        >
          <div 
            className="card"
            onClick={e => e.stopPropagation()}
            style={{
              width: '100%',
              maxWidth: 550,
              borderRadius: 14,
              boxShadow: '0 10px 40px rgba(0,0,0,0.3)',
              overflow: 'hidden'
            }}
          >
            <div className="card-header d-flex align-items-center justify-content-between p-3" style={{ borderBottom: '1px solid #ebecf1' }}>
              <h5 className="mb-0 font-weight-bold" style={{ fontSize: 16 }}>Message Details</h5>
              <button 
                type="button" 
                className="btn-close" 
                onClick={() => setSelectedReport(null)} 
                style={{ background: 'none', border: 'none', fontSize: 18, cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>
            <div className="card-body p-4" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div className="d-flex justify-content-between align-items-center pb-2" style={{ borderBottom: '1px dashed #e2e8f0' }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: '#68798b' }}>STATUS</span>
                <div>{renderStatusBadge(selectedReport.status)}</div>
              </div>
              <div className="d-flex justify-content-between align-items-center pb-2" style={{ borderBottom: '1px dashed #e2e8f0' }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: '#68798b' }}>DATE & TIME</span>
                <span style={{ fontSize: 13, fontWeight: 600 }}>{formatDateTime(selectedReport.date)}</span>
              </div>
              <div className="d-flex justify-content-between align-items-center pb-2" style={{ borderBottom: '1px dashed #e2e8f0' }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: '#68798b' }}>FROM NUMBER</span>
                <span style={{ fontSize: 13, fontWeight: 600 }}>{selectedReport.from || selectedReport.session || '-'}</span>
              </div>
              <div className="d-flex justify-content-between align-items-center pb-2" style={{ borderBottom: '1px dashed #e2e8f0' }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: '#68798b' }}>TO NUMBER / RECIPIENT</span>
                <span style={{ fontSize: 13, fontWeight: 600 }}>{selectedReport.to || selectedReport.recipient || '-'}</span>
              </div>
              <div className="d-flex justify-content-between align-items-center pb-2" style={{ borderBottom: '1px dashed #e2e8f0' }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: '#68798b' }}>TYPE & SOURCE</span>
                <div className="d-flex gap-2">
                  {renderTypeBadge(selectedReport.type, selectedReport.message)}
                  {renderSourceBadge(selectedReport.source, selectedReport.to)}
                </div>
              </div>
              <div>
                <span style={{ fontSize: 12, fontWeight: 700, color: '#68798b', display: 'block', marginBottom: 6 }}>MESSAGE CONTENT</span>
                <div style={{
                  padding: 12,
                  background: '#f8fafc',
                  borderRadius: 8,
                  border: '1px solid #e2e8f0',
                  fontSize: 13,
                  lineHeight: 1.5,
                  maxHeight: 180,
                  overflowY: 'auto',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                  color: '#1e293b'
                }}>
                  {selectedReport.message || selectedReport.text || '(No message content)'}
                </div>
              </div>
              {selectedReport.id && (
                <div style={{ fontSize: 11, color: '#94a3b8' }}>
                  Message ID: <code style={{ fontSize: 11 }}>{selectedReport.id}</code>
                </div>
              )}
            </div>
            <div className="card-footer d-flex justify-content-between p-3" style={{ borderTop: '1px solid #ebecf1', background: '#f8fafc' }}>
              <button 
                className="btn btn-sm btn-outline-secondary"
                onClick={() => {
                  const txt = selectedReport.message || selectedReport.text || ''
                  if (txt) {
                    navigator.clipboard.writeText(txt)
                    if (notify) notify('संदेश कॉपी कर लिया गया (Message copied)')
                  }
                }}
              >
                📋 Copy Message
              </button>
              <button className="btn btn-sm btn-primary" onClick={() => setSelectedReport(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}

export default ReportsPage
