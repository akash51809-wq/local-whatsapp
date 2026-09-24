import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import * as XLSX from 'xlsx'
import { useAuth } from '../../context/AuthContext'
import api from '../../services/api'

export const QUICK_EMOJIS = [
  '🙏', '✅', '❤️', '😊', '👍', '🔥', '🎉', '💐', '💼', '📌',
  '💼', '📢', '🚀', '⭐', '🤝', '💯', '👋', '🔔', '💬', '✨',
  '🎯', '📍', '💰', '🎁', '💐', '🇮🇳', '👌', '👇', '👉', '⚡'
]

export function cleanTo10Digit(val) {
  if (!val) return null
  let s = String(val).trim().replace(/\D/g, '')
  if (s.length === 12 && s.startsWith('91')) s = s.slice(2)
  else if (s.length === 11 && s.startsWith('0')) s = s.slice(1)
  if (/^[6-9]\d{9}$/.test(s)) return s
  return null
}

export function parseNumbers(rawText) {
  if (!rawText) return { unique: [], total: 0, validCount: 0, invalid: [] }
  const items = String(rawText)
    .split(/[\r\n,;\t ]+/)
    .map(s => s.trim())
    .filter(Boolean)

  const valid = []
  const invalid = []
  for (const item of items) {
    const cleaned = cleanTo10Digit(item)
    if (cleaned) {
      valid.push(cleaned)
    } else {
      invalid.push(item)
    }
  }
  const unique = Array.from(new Set(valid))
  return {
    unique,
    total: items.length,
    validCount: valid.length,
    invalid
  }
}

export function SendPage() {
  const { notify } = useAuth()
  const [sessions, setSessions] = useState([])
  const [selectedSession, setSelectedSession] = useState('')
  const [loadingSessions, setLoadingSessions] = useState(false)
  const [numbersText, setNumbersText] = useState('')
  const [msgText, setMsgText] = useState('')
  const [attachment, setAttachment] = useState(null)
  const [showEmojiPicker, setShowEmojiPicker] = useState(false)
  const [sendingProgress, setSendingProgress] = useState({
    active: false,
    current: 0,
    total: 0,
    currentNumber: '',
    statusText: '',
    sentCount: 0,
    failCount: 0
  })

  const fileInputRef = useRef(null)
  const excelInputRef = useRef(null)
  const cancelSendingRef = useRef(false)

  // Fetch available WhatsApp sessions
  const loadSessions = useCallback(async () => {
    setLoadingSessions(true)
    try {
      const d = await api('/api/user/whatsapp/sessions')
      const list = d.sessions || []
      setSessions(list)
      if (list.length > 0) {
        const connected = list.find(s => s.status === 'connected')
        if (connected) {
          setSelectedSession(connected.id || connected.sessionId)
        } else if (!selectedSession) {
          setSelectedSession(list[0].id || list[0].sessionId)
        }
      }
    } catch (e) {
      console.warn('Sessions load warning:', e.message)
    } finally {
      setLoadingSessions(false)
    }
  }, [selectedSession])

  useEffect(() => {
    loadSessions()
  }, [loadSessions])

  // Compute number statistics in real-time
  const numberStats = useMemo(() => parseNumbers(numbersText), [numbersText])

  // 1. Download Sample Excel template
  const downloadSampleExcel = () => {
    try {
      const sampleRows = [
        { 'Name': 'Rajesh Kumar', 'Number': '9876543210', 'City': 'Delhi' },
        { 'Name': 'Amit Sharma', 'Number': '9123456780', 'City': 'Mumbai' },
        { 'Name': 'Pooja Patel', 'Number': '9988776655', 'City': 'Ahmedabad' }
      ]
      const ws = XLSX.utils.json_to_sheet(sampleRows)
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, 'Contacts')
      XLSX.writeFile(wb, 'sample_whatsapp_contacts.xlsx')
      if (notify) notify('Sample Excel सफलतापूर्वक डाउनलोड हो गया!')
    } catch (err) {
      if (notify) notify('Sample Excel डाउनलोड करने में समस्या: ' + err.message)
    }
  }

  // 2. Upload and Parse Excel file
  const handleExcelUpload = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (excelInputRef.current) excelInputRef.current.value = ''

    const reader = new FileReader()
    reader.onload = (evt) => {
      try {
        const data = new Uint8Array(evt.target.result)
        const workbook = XLSX.read(data, { type: 'array' })
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]]
        const rows = XLSX.utils.sheet_to_json(firstSheet, { header: 1, defval: '' })

        if (!rows || rows.length === 0) {
          if (notify) notify('चयनित Excel शीट खाली है।')
          return
        }

        let numberColIdx = -1
        let headerRowIdx = -1
        const numberRegex = /(number|phone|mobile|contact|whatsapp|mob|num|कॉल|नंबर|मोबाइल)/i

        for (let r = 0; r < Math.min(5, rows.length); r++) {
          const row = rows[r]
          if (Array.isArray(row)) {
            for (let c = 0; c < row.length; c++) {
              const val = String(row[c] || '').trim()
              if (numberRegex.test(val)) {
                numberColIdx = c
                headerRowIdx = r
                break
              }
            }
          }
          if (numberColIdx !== -1) break
        }

        const extracted = []
        if (numberColIdx !== -1) {
          for (let r = headerRowIdx + 1; r < rows.length; r++) {
            const cellVal = rows[r]?.[numberColIdx]
            const clean = cleanTo10Digit(cellVal)
            if (clean) extracted.push(clean)
          }
        } else {
          for (let r = 0; r < rows.length; r++) {
            const row = rows[r]
            if (Array.isArray(row)) {
              for (let c = 0; c < row.length; c++) {
                const clean = cleanTo10Digit(row[c])
                if (clean) extracted.push(clean)
              }
            }
          }
        }

        if (extracted.length === 0) {
          if (notify) notify('Excel शीट में कोई वैध 10-अंकीय नंबर नहीं मिला। कृपया "Number" कॉलम जांचें।')
          return
        }

        const existingUnique = new Set(numberStats.unique)
        extracted.forEach(n => existingUnique.add(n))
        const combined = Array.from(existingUnique).join(', ')
        setNumbersText(combined)

        if (notify) notify(`✓ Excel से ${extracted.length} नंबर सफलतापूर्वक जोड़े गए!`)
      } catch (err) {
        if (notify) notify('Excel फ़ाइल पढ़ने में त्रुटि: ' + err.message)
      }
    }
    reader.readAsArrayBuffer(file)
  }

  // 3. Remove Duplicates
  const handleRemoveDuplicates = () => {
    const { unique, total } = parseNumbers(numbersText)
    if (unique.length === 0) {
      if (notify) notify('हटाने के लिए कोई वैध नंबर नहीं मिला।')
      return
    }
    const deduplicated = unique.join(', ')
    setNumbersText(deduplicated)
    const removedCount = total - unique.length
    if (notify) notify(`✓ Duplicates हटा दिए गए! ${unique.length} यूनिक 10-अंकीय नंबर शेष हैं (${removedCount} हटाए गए)।`)
  }

  // 4. Handle Attachment
  const handleAttachment = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 15 * 1024 * 1024) {
      if (notify) notify('फ़ाइल का आकार 15 MB से कम होना चाहिए।')
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      setAttachment({
        name: file.name,
        type: file.type || 'application/octet-stream',
        size: (file.size / 1024).toFixed(1) + ' KB',
        data: reader.result
      })
      if (notify) notify(`फ़ाइल संलग्न की गई: ${file.name}`)
    }
    reader.readAsDataURL(file)
  }

  // 5. Add Emoji
  const handleAddEmoji = (emoji) => {
    setMsgText(prev => prev + emoji)
  }

  // 6. Sequential 1-by-1 Sending
  const handleSendMessages = async () => {
    const targets = numberStats.unique
    if (targets.length === 0) {
      if (notify) notify('कम से कम एक वैध 10-अंकीय मोबाइल नंबर दर्ज करें।')
      return
    }
    if (!msgText.trim() && !attachment) {
      if (notify) notify('मैसेज टेक्स्ट लिखें या कोई अटैचमेंट फ़ाइल जोड़ें।')
      return
    }

    const currentSessionObj = sessions.find(s => s.id === selectedSession || s.sessionId === selectedSession)
    if (currentSessionObj && currentSessionObj.status !== 'connected') {
      if (notify) notify('चयनित WhatsApp कनेक्टेड नहीं है। कृपया पहले Dashboard से QR कोड स्कैन करें।')
      return
    }

    cancelSendingRef.current = false
    setSendingProgress({
      active: true,
      current: 0,
      total: targets.length,
      currentNumber: '',
      statusText: 'भेजना शुरू हो रहा है...',
      sentCount: 0,
      failCount: 0
    })

    let sent = 0
    let failed = 0
    let lastError = ''

    for (let i = 0; i < targets.length; i++) {
      if (cancelSendingRef.current) {
        if (notify) notify('मैसेज भेजना रोक दिया गया।')
        break
      }

      const num = targets[i]
      setSendingProgress(prev => ({
        ...prev,
        current: i + 1,
        currentNumber: num,
        statusText: `भेजा जा रहा है (${i + 1}/${targets.length}): +91 ${num}`
      }))

      try {
        await api('/api/user/send', {
          method: 'POST',
          body: JSON.stringify({
            to: num,
            text: msgText.trim(),
            attachment: attachment ? { name: attachment.name, type: attachment.type, data: attachment.data } : null,
            session: selectedSession
          })
        })
        sent++
      } catch (err) {
        failed++
        lastError = err.message || ''
        console.error(`Send to ${num} failed:`, err.message)
      }

      setSendingProgress(prev => ({
        ...prev,
        sentCount: sent,
        failCount: failed
      }))

      // 1.2s delay between messages to protect account from anti-spam limits
      if (i < targets.length - 1 && !cancelSendingRef.current) {
        await new Promise(res => setTimeout(res, 1200))
      }
    }

    setSendingProgress(prev => ({
      ...prev,
      active: false,
      statusText: `पूरा हुआ! भेजे गए: ${sent}, विफल: ${failed}`
    }))

    if (sent > 0) {
      if (notify) notify(`✓ ${sent} संदेश सफलतापूर्वक भेज दिए गए!`)
    } else if (failed > 0) {
      if (notify) notify(lastError ? `मैसेज भेजने में समस्या हुई: ${lastError}` : `मैसेज भेजने में समस्या हुई। कृपया WhatsApp कनेक्शन जांचें।`)
    }
  }

  const handleStopSending = () => {
    cancelSendingRef.current = true
  }

  return (
    <section className="page-content">
      <div className="send-page-container">
        
        {/* Left Column: Send Form */}
        <div className="send-main-card">
          <span className="eyebrow">DIRECT / BULK WHATSAPP DISPATCH</span>
          <h2 style={{ margin: '6px 0 4px', fontSize: 22 }}>Send WhatsApp Message</h2>
          <p style={{ color: '#728498', fontSize: 12, margin: '0 0 20px' }}>
            अपने स्कैन किए गए WhatsApp नंबर से सिंगल या मल्टीपल संदेश सुरक्षित तरीके से भेजें।
          </p>

          {/* 1. Choose WhatsApp Dropdown */}
          <div className="field-group">
            <div className="field-label">
              <span>Choose WhatsApp Account (व्हाट्सएप चुनें)</span>
              <button 
                type="button" 
                onClick={loadSessions} 
                className="tool-btn" 
                style={{ padding: '3px 9px', fontSize: 11 }}
              >
                {loadingSessions ? 'लोड हो रहा है...' : '↻ Refresh Accounts'}
              </button>
            </div>
            <select 
              className="field-select" 
              value={selectedSession} 
              onChange={e => setSelectedSession(e.target.value)}
            >
              {sessions.length === 0 && <option value="">कोई WhatsApp अकाउंट उपलब्ध नहीं है</option>}
              {sessions.map(s => (
                <option key={s.id || s.sessionId} value={s.id || s.sessionId}>
                  {s.display || s.name} {s.status === 'connected' ? '✓' : '(Offline / Not Connected)'}
                </option>
              ))}
            </select>
          </div>

          {/* 2. Type Number & Upload Excel Toolbar */}
          <div className="field-group">
            <div className="field-label">
              <span>Type Number / Mobile Numbers (मोबाइल नंबर)</span>
              <small>सिंगल या कॉमा (,) लगाकर मल्टीपल नंबर दर्ज करें</small>
            </div>

            <div className="numbers-toolbar">
              {/* Sample Excel Button */}
              <button 
                type="button" 
                className="tool-btn" 
                onClick={downloadSampleExcel}
                title="Download Sample Excel template with Number column"
              >
                📥 Sample Excel
              </button>

              {/* Upload Excel Button */}
              <input 
                type="file" 
                ref={excelInputRef} 
                accept=".xlsx, .xls, .csv" 
                hidden 
                onChange={handleExcelUpload} 
              />
              <button 
                type="button" 
                className="tool-btn primary-tool" 
                onClick={() => excelInputRef.current?.click()}
                title="Upload Excel or CSV file containing Number column"
              >
                📁 Upload Excel / CSV
              </button>

              {/* Remove Duplicates Button */}
              <button 
                type="button" 
                className="tool-btn danger-tool" 
                onClick={handleRemoveDuplicates}
                title="Remove duplicate numbers and invalid entries"
              >
                🗑️ Remove Duplicates
              </button>

              {/* Counter Badge */}
              <span className="numbers-stat-badge">
                Total: {numberStats.total} | Unique: {numberStats.unique.length}
              </span>
            </div>

            <textarea 
              className="field-textarea" 
              rows={4}
              placeholder="यहाँ 10 अंकों का मोबाइल नंबर डालें (Single या Comma/Enter लगाकर Multiple, जैसे: 9876543210, 9123456789)..."
              value={numbersText}
              onChange={e => setNumbersText(e.target.value)}
            />
            {numberStats.invalid.length > 0 && (
              <small style={{ display: 'block', color: '#d32f2f', fontSize: 11, marginTop: 4 }}>
                ⚠ {numberStats.invalid.length} अमान्य प्रविष्टियां हैं (जैसे: {numberStats.invalid.slice(0, 3).join(', ')})। इन्हें हटाने के लिए "Remove Duplicates" दबाएं।
              </small>
            )}
          </div>

          {/* 3. Type Message Box with compact Attachment, Emoji, Send button at bottom */}
          <div className="field-group" style={{ marginBottom: 10 }}>
            <div className="field-label">
              <span>Type Message (संदेश लिखें)</span>
              <small>{msgText.length} characters</small>
            </div>

            <div className="message-box-wrap">
              {/* Attachment chip if file selected */}
              {attachment && (
                <div className="attachment-tag">
                  <span>📎 {attachment.name} ({attachment.size})</span>
                  <button type="button" onClick={() => setAttachment(null)}>×</button>
                </div>
              )}

              <textarea 
                className="main-msg-textarea"
                rows={4}
                placeholder="यहाँ अपना मैसेज लिखें (Type your message here)..."
                value={msgText}
                onChange={e => setMsgText(e.target.value)}
              />

              {/* Compact bottom action bar: Attachment, Emoji, Send button */}
              <div className="msg-action-bar">
                <div className="msg-tools-group">
                  {/* Attachment Button */}
                  <input 
                    type="file" 
                    ref={fileInputRef} 
                    hidden 
                    onChange={handleAttachment} 
                  />
                  <button 
                    type="button" 
                    className="tool-icon-btn" 
                    onClick={() => fileInputRef.current?.click()}
                    title="Attach Image, Video, or Document"
                  >
                    📎 Attach
                  </button>

                  {/* Emoji Picker Button */}
                  <button 
                    type="button" 
                    className="tool-icon-btn" 
                    onClick={() => setShowEmojiPicker(prev => !prev)}
                    title="Insert Emojis"
                  >
                    😊 Emoji
                  </button>

                  {/* Emoji Popover */}
                  {showEmojiPicker && (
                    <div className="emoji-popover-box">
                      {QUICK_EMOJIS.map(emoji => (
                        <button 
                          type="button" 
                          key={emoji} 
                          className="single-emoji-btn" 
                          onClick={() => { handleAddEmoji(emoji); }}
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Send Button */}
                <button 
                  type="button" 
                  className="btn-send-main"
                  disabled={sendingProgress.active || numberStats.unique.length === 0 || (!msgText.trim() && !attachment)}
                  onClick={handleSendMessages}
                >
                  {sendingProgress.active ? 'Sending...' : `🚀 Send Message (${numberStats.unique.length})`}
                </button>
              </div>
            </div>
          </div>

          {/* Sequential Live Sending Progress */}
          {sendingProgress.active && (
            <div className="sending-progress-container">
              <div className="progress-header-row">
                <span>{sendingProgress.statusText}</span>
                <button type="button" className="btn-stop-sending" onClick={handleStopSending}>
                  ⏹ Cancel / Stop
                </button>
              </div>
              <div className="progress-bar-track">
                <div 
                  className="progress-bar-fill" 
                  style={{ width: `${Math.round((sendingProgress.current / sendingProgress.total) * 100)}%` }} 
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#0b694e', marginTop: 6 }}>
                <span>Sent: {sendingProgress.sentCount} | Failed: {sendingProgress.failCount}</span>
                <span>{Math.round((sendingProgress.current / sendingProgress.total) * 100)}%</span>
              </div>
            </div>
          )}

        </div>

        {/* Right Column: How to Use Guide */}
        <div className="how-to-guide-card">
          <div className="how-to-header">
            <span style={{ fontSize: 22 }}>📖</span>
            <div>
              <h3>How to Use</h3>
              <small style={{ color: '#7e8e9f' }}>उपयोग करने का पूरा तरीका (Step-by-Step)</small>
            </div>
          </div>

          <div className="how-to-steps">
            
            <div className="how-step">
              <div className="step-num-badge">1</div>
              <div className="step-content">
                <strong>Choose WhatsApp (व्हाट्सएप चुनें)</strong>
                Dropdown सूची से अपना कनेक्टेड WhatsApp अकाउंट सेलेक्ट करें। (यदि कोई कनेक्ट नहीं है, तो पहले Dashboard टैब में जाकर अपना QR कोड स्कैन करें)।
              </div>
            </div>

            <div className="how-step">
              <div className="step-num-badge">2</div>
              <div className="step-content">
                <strong>Type Number (नंबर दर्ज करें)</strong>
                मोबाइल नंबर बॉक्स में 10 अंकों का नंबर टाइप करें। आप एक नंबर या कॉमा (,) लगाकर एक साथ कई नंबर डाल सकते हैं।
              </div>
            </div>

            <div className="how-step">
              <div className="step-num-badge">3</div>
              <div className="step-content">
                <strong>Upload Excel & Sample (एक्सेल अपलोड)</strong>
                <b>Sample Excel</b> बटन दबाकर सही फ़ाइल फॉर्मेट देखें। <b>Upload Excel / CSV</b> से अपनी फ़ाइल अपलोड करें — सिस्टम शीट में से केवल "Number" वाले कॉलम को अपने आप पहचानकर नंबर निकाल लेगा।
              </div>
            </div>

            <div className="how-step">
              <div className="step-num-badge">4</div>
              <div className="step-content">
                <strong>Remove Duplicates (डुप्लिकेट हटाएं)</strong>
                <b>Remove Duplicates</b> बटन पर क्लिक करें। इससे बार-बार आने वाले और अमान्य नंबर तुरंत हट जाएंगे और केवल सही 10-अंकीय यूनिक नंबर बचेंगे।
              </div>
            </div>

            <div className="how-step">
              <div className="step-num-badge">5</div>
              <div className="step-content">
                <strong>Message, Emoji & Attachment</strong>
                मैसेज बॉक्स में अपना टेक्स्ट लिखें। नीचे दिए गए <b>😊 Emoji</b> बटन से इमोजी लगाएं और <b>📎 Attach</b> बटन से फ़ोटो, PDF या कोई भी डॉक्यूमेंट जोड़ें।
              </div>
            </div>

            <div className="how-step">
              <div className="step-num-badge">6</div>
              <div className="step-content">
                <strong>Send Message (1-by-1 सुरक्षित डिलीवरी)</strong>
                <b>Send Message</b> बटन दबाएं। सिस्टम हर नंबर पर सुरक्षित 1.2 सेकंड के अंतराल से 1-by-1 मैसेज भेजेगा ताकि आपका व्हाट्सएप अकाउंट सुरक्षित रहे।
              </div>
            </div>

          </div>

          <div className="guide-tip-box">
            💡 <b>सुरक्षा टिप:</b> बल्क मैसेजिंग के दौरान 1-by-1 सुरक्षित डिलीवरी और वैध 10-अंकीय भारतीय मोबाइल नंबरों का ही उपयोग करें। स्टेटस देखने के लिए <b>Message Reports</b> टैब देखें।
          </div>

        </div>

      </div>
    </section>
  )
}

export default SendPage
