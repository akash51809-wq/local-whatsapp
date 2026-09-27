import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import * as XLSX from 'xlsx'
import { useAuth } from '../../context/AuthContext'
import api from '../../services/api'
import '../../styles/send-msg.css'

export const QUICK_EMOJIS = [
  '😀', '😊', '😍', '🎉', '🔥',
  '👍', '❤️', '✅', '📢', '💰',
  '🚀', '🙏', '🎯', '⭐', '💬'
]

export const VOICE_LANGUAGES = [
  { code: 'hi', label: 'Hindi (हिन्दी 🇮🇳)' },
  { code: 'en', label: 'English (English 🇺🇸)' },
  { code: 'gu', label: 'Gujarati (ગુજરાતી)' },
  { code: 'mr', label: 'Marathi (मराठी)' },
  { code: 'bn', label: 'Bengali (বাংলা)' },
  { code: 'ta', label: 'Tamil (தமிழ்)' },
  { code: 'te', label: 'Telugu (తెలుగు)' },
  { code: 'ur', label: 'Urdu (اردو)' },
  { code: 'es', label: 'Spanish (Español)' },
  { code: 'fr', label: 'French (Français)' },
  { code: 'de', label: 'German (Deutsch)' },
  { code: 'ar', label: 'Arabic (العربية)' }
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
  const { notify, status: globalStatus } = useAuth()
  const [sessions, setSessions] = useState([])
  const [selectedSession, setSelectedSession] = useState('')
  const [loadingSessions, setLoadingSessions] = useState(false)
  const [numbersText, setNumbersText] = useState('')
  const [msgText, setMsgText] = useState('')
  const [attachment, setAttachment] = useState(null)
  const [showEmojiPicker, setShowEmojiPicker] = useState(false)

  // Sending Mode: 'now' or 'schedule'
  const [sendingMode, setSendingMode] = useState('now')
  const [scheduleDate, setScheduleDate] = useState('')
  const [scheduleTime, setScheduleTime] = useState('')
  const [countdownText, setCountdownText] = useState('00:00:00:00')

  // Voice Note (Google Text-to-Speech / gTTS) States
  const [voiceLang, setVoiceLang] = useState('hi')
  const [convertingVoice, setConvertingVoice] = useState(false)
  const [previewAudio, setPreviewAudio] = useState(null)
  const [showVoiceOptions, setShowVoiceOptions] = useState(false)
  const audioPlayerRef = useRef(null)

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

  useEffect(() => {
    const groupNumbers = sessionStorage.getItem('groupSelectedNumbers')
    if (groupNumbers) {
      setNumbersText(groupNumbers)
      sessionStorage.removeItem('groupSelectedNumbers')
    }

    const templateMsg = sessionStorage.getItem('templateSelectedMessage')
    if (templateMsg) {
      setMsgText(templateMsg)
      sessionStorage.removeItem('templateSelectedMessage')
    }
  }, [])

  // Real-time number stats
  const numberStats = useMemo(() => parseNumbers(numbersText), [numbersText])

  // Live countdown calculation for Schedule Mode
  useEffect(() => {
    if (sendingMode !== 'schedule' || !scheduleDate || !scheduleTime) {
      setCountdownText('00:00:00:00')
      return
    }

    const interval = setInterval(() => {
      const target = new Date(`${scheduleDate}T${scheduleTime}`).getTime()
      const now = Date.now()
      const diff = target - now

      if (diff <= 0) {
        setCountdownText('00:00:00:00')
        clearInterval(interval)
        return
      }

      const days = Math.floor(diff / (1000 * 60 * 60 * 24))
      const hours = Math.floor((diff / (1000 * 60 * 60)) % 24)
      const minutes = Math.floor((diff / (1000 * 60)) % 60)
      const seconds = Math.floor((diff / 1000) % 60)

      const pad = (n) => String(n).padStart(2, '0')
      setCountdownText(`${pad(days)}:${pad(hours)}:${pad(minutes)}:${pad(seconds)}`)
    }, 1000)

    return () => clearInterval(interval)
  }, [sendingMode, scheduleDate, scheduleTime])

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
      if (notify) notify('Sample Excel downloaded successfully!')
    } catch (err) {
      if (notify) notify('Error downloading sample Excel: ' + err.message)
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
          if (notify) notify('Selected Excel sheet is empty.')
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
          if (notify) notify('No valid 10-digit numbers found in Excel sheet. Check the "Number" column.')
          return
        }

        const existingUnique = new Set(numberStats.unique)
        extracted.forEach(n => existingUnique.add(n))
        const combined = Array.from(existingUnique).join(', ')
        setNumbersText(combined)

        if (notify) notify(`✓ ${extracted.length} numbers imported from Excel!`)
      } catch (err) {
        if (notify) notify('Error reading Excel file: ' + err.message)
      }
    }
    reader.readAsArrayBuffer(file)
  }

  // 3. Remove Duplicates
  const handleRemoveDuplicates = () => {
    const { unique, total } = parseNumbers(numbersText)
    if (unique.length === 0) {
      if (notify) notify('No valid numbers found to deduplicate.')
      return
    }
    const deduplicated = unique.join(', ')
    setNumbersText(deduplicated)
    const removedCount = total - unique.length
    if (notify) notify(`✓ Duplicates removed! ${unique.length} unique numbers remaining (${removedCount} duplicates removed).`)
  }

  // 4. Handle Attachment
  const handleAttachment = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 15 * 1024 * 1024) {
      if (notify) notify('File size must be less than 15 MB.')
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
      if (notify) notify(`File attached: ${file.name}`)
    }
    reader.readAsDataURL(file)
  }

  // 5. Add Emoji
  const handleAddEmoji = (emoji) => {
    setMsgText(prev => prev + emoji)
    setShowEmojiPicker(false)
  }

  // 6. Preview Voice (Google Text-to-Speech / gTTS -> MP3)
  const handlePreviewVoice = async () => {
    if (!msgText.trim()) {
      if (notify) notify('Please write some message text before converting to voice.')
      return
    }
    setConvertingVoice(true)
    try {
      const res = await api('/api/user/tts-convert', {
        method: 'POST',
        body: JSON.stringify({
          text: msgText.trim(),
          lang: voiceLang || 'hi'
        })
      })
      if (res.success && res.audioUrl) {
        setPreviewAudio({ url: res.audioUrl, fileName: res.fileName })
        if (notify) notify('✓ Converted to MP3 voice note! Listen below.')
        setTimeout(() => {
          if (audioPlayerRef.current) {
            audioPlayerRef.current.play().catch(() => {})
          }
        }, 150)
      } else {
        if (notify) notify('Voice conversion failed: ' + (res.message || 'Unknown error'))
      }
    } catch (err) {
      if (notify) notify('Voice conversion error: ' + err.message)
    } finally {
      setConvertingVoice(false)
    }
  }

  // 7. Sequential 1-by-1 Sending (Supports Text or Google Voice Note MP3)
  const handleSendMessages = async (asVoice = false) => {
    const targets = numberStats.unique
    if (targets.length === 0) {
      if (notify) notify('Please enter at least one valid 10-digit mobile number.')
      return
    }
    if (!msgText.trim() && !attachment && !asVoice) {
      if (notify) notify('Please enter a message or attach a file.')
      return
    }
    if (asVoice && !msgText.trim()) {
      if (notify) notify('Message text is required for voice note conversion.')
      return
    }

    if (sendingMode === 'schedule') {
      if (!scheduleDate || !scheduleTime) {
        if (notify) notify('Please select both schedule date and time.')
        return
      }
      if (notify) notify(`✓ Message scheduled for ${scheduleDate} at ${scheduleTime} for ${targets.length} recipients!`)
      return
    }

    cancelSendingRef.current = false
    setSendingProgress({
      active: true,
      current: 0,
      total: targets.length,
      currentNumber: '',
      statusText: asVoice ? 'Converting to MP3 voice note...' : 'Starting delivery...',
      sentCount: 0,
      failCount: 0
    })

    let sent = 0
    let failed = 0
    let lastError = ''

    for (let i = 0; i < targets.length; i++) {
      if (cancelSendingRef.current) {
        if (notify) notify('Sending stopped by user.')
        break
      }

      const num = targets[i]
      setSendingProgress(prev => ({
        ...prev,
        current: i + 1,
        currentNumber: num,
        statusText: asVoice 
          ? `Sending voice note (${i + 1}/${targets.length}): +91 ${num}`
          : `Sending message (${i + 1}/${targets.length}): +91 ${num}`
      }))

      try {
        await api('/api/user/send', {
          method: 'POST',
          body: JSON.stringify({
            to: num,
            text: msgText.trim(),
            sendAsVoice: asVoice,
            voiceLang: voiceLang || 'hi',
            attachment: (!asVoice && attachment) ? { name: attachment.name, type: attachment.type, data: attachment.data } : null,
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

      if (i < targets.length - 1 && !cancelSendingRef.current) {
        await new Promise(res => setTimeout(res, 1200))
      }
    }

    setSendingProgress(prev => ({
      ...prev,
      active: false,
      statusText: `Completed! Sent: ${sent}, Failed: ${failed}`
    }))

    if (sent > 0) {
      if (notify) notify(`✓ ${sent} ${asVoice ? 'voice notes (MP3)' : 'messages'} delivered successfully!`)
    } else if (failed > 0) {
      if (notify) notify(lastError ? `Sending failed: ${lastError}` : `Message delivery failed. Check your WhatsApp connection.`)
    }
  }

  const isConnected = globalStatus?.status === 'connected'

  return (
    <div className="content send-content">
      <div className="send-layout">
        
        {/* Left Column: Message Composer */}
        <section className="composer-card card">
          <div className="composer-head">
            <div className="step-badge">01</div>
            <div>
              <h2>Message Composer</h2>
              <p>Build your message in a few simple steps.</p>
            </div>
            <span className="secure-chip">
              <i style={{ background: isConnected ? '#16a765' : '#e85b63' }}></i>
              {isConnected ? 'Session Connected' : 'Not Connected'}
            </span>
          </div>

          <div className="composer-body">
            {/* Top row: Account & Mode */}
            <div className="quick-grid compact-top-grid">
              <div className="field account-field">
                <label>WHATSAPP ACCOUNT</label>
                <select 
                  className="select compact-select"
                  value={selectedSession}
                  onChange={e => setSelectedSession(e.target.value)}
                >
                  {sessions.length === 0 && (
                    <option value="default">
                      {globalStatus?.profileName || 'Primary WhatsApp'} · {globalStatus?.number ? `+${globalStatus.number}` : (isConnected ? 'Online' : 'Not Connected')}
                    </option>
                  )}
                  {sessions.map(s => (
                    <option key={s.id || s.sessionId} value={s.id || s.sessionId}>
                      {s.display || s.name || s.profileName} {s.status === 'connected' ? '✓' : '(Offline)'}
                    </option>
                  ))}
                </select>
              </div>

              <div className="field mode-field">
                <label>SENDING MODE</label>
                <select 
                  className="select compact-select"
                  id="sendingMode"
                  value={sendingMode}
                  onChange={e => setSendingMode(e.target.value)}
                >
                  <option value="now">Send Now</option>
                  <option value="schedule">Schedule Message</option>
                </select>
              </div>

              {/* Schedule Panel */}
              <div className="schedule-panel compact-schedule" id="schedulePanel" hidden={sendingMode !== 'schedule'}>
                <div className="schedule-mini-head"><span>◷</span><label>SCHEDULE DATE &amp; TIME</label></div>
                <div className="schedule-mini-fields">
                  <input 
                    className="input compact-input" 
                    id="scheduleDate" 
                    type="date" 
                    aria-label="Schedule date"
                    value={scheduleDate}
                    onChange={e => setScheduleDate(e.target.value)}
                  />
                  <input 
                    className="input compact-input" 
                    id="scheduleTime" 
                    type="time" 
                    aria-label="Schedule time"
                    value={scheduleTime}
                    onChange={e => setScheduleTime(e.target.value)}
                  />
                </div>
                <small id="scheduleLabel">{scheduleDate && scheduleTime ? `${scheduleDate} ${scheduleTime}` : 'Choose date & time'}</small>
                <strong id="countdown">{countdownText}</strong>
              </div>
            </div>

            {/* Recipient Numbers Field */}
            <div className="field recipient-field">
              <div className="field-row recipient-head">
                <div>
                  <label>RECIPIENT NUMBERS</label>
                  <span className="recipient-note">Enter single or multiple numbers separated by commas (,)</span>
                </div>
                <div className="recipient-tools">
                  <button 
                    type="button" 
                    className="round-tool sample-btn" 
                    id="sampleExcel"
                    onClick={downloadSampleExcel}
                    title="Download sample Excel"
                  >
                    ⇩<span>Sample</span>
                  </button>

                  <label className="round-tool upload-btn" title="Upload Excel">
                    ⇧<span>Upload</span>
                    <input 
                      id="excelUpload"
                      type="file" 
                      ref={excelInputRef} 
                      accept=".xlsx,.xls,.csv" 
                      onChange={handleExcelUpload} 
                      hidden 
                    />
                  </label>

                  <button 
                    type="button" 
                    className="round-tool duplicate-btn" 
                    id="removeDuplicates"
                    onClick={handleRemoveDuplicates}
                    title="Remove duplicates"
                  >
                    ⧉<span>Unique</span>
                  </button>
                </div>
              </div>

              <textarea 
                className="textarea recipient-area" 
                id="recipientNumbers"
                placeholder="+91 98765 43210, +91 98123 45678"
                value={numbersText}
                onChange={e => setNumbersText(e.target.value)}
              ></textarea>

              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, fontWeight: 700, color: '#718078', marginTop: 4 }}>
                <span>Valid: <strong style={{ color: '#16a765' }}>{numberStats.unique.length}</strong> unique numbers</span>
                {numberStats.invalid.length > 0 && (
                  <span style={{ color: '#e85b63' }}>Invalid: {numberStats.invalid.length} entries</span>
                )}
              </div>
            </div>

            {/* Message Area */}
            <div className="field">
              <div className="field-row">
                <label>MESSAGE</label>
                <span className="field-hint" id="charCount">
                  {msgText.length} / 1000
                </span>
              </div>

              <div className="message-box">
                <textarea 
                  className="textarea message-area" 
                  id="messageText"
                  maxLength={1000}
                  placeholder="Write your WhatsApp message here..."
                  value={msgText}
                  onChange={e => setMsgText(e.target.value)}
                ></textarea>

                <div className="message-tools">
                  {/* Emoji Button */}
                  <div className="emoji-wrap">
                    <button 
                      type="button" 
                      className="tool-btn" 
                      id="emojiBtn" 
                      aria-label="Add emoji"
                      onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                    >
                      ☺ <span>Emoji</span>
                    </button>
                    {showEmojiPicker && (
                      <div className="emoji-popover show" id="emojiPopover">
                        {QUICK_EMOJIS.map((em, idx) => (
                          <button key={idx} type="button" onClick={() => handleAddEmoji(em)}>
                            {em}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  <span className="tool-divider"></span>

                  {/* Voice Button */}
                  <button 
                    type="button" 
                    className={`tool-btn voice-tool ${showVoiceOptions ? 'active' : ''}`}
                    id="voiceBtn"
                    onClick={() => setShowVoiceOptions(!showVoiceOptions)}
                  >
                    🎙 <span>{showVoiceOptions ? 'Voice On' : 'Voice'}</span>
                  </button>

                  <span className="tool-divider"></span>

                  {/* Clear Button */}
                  <button 
                    type="button" 
                    className="tool-btn" 
                    id="clearMessage"
                    onClick={() => { setMsgText(''); setAttachment(null); setPreviewAudio(null) }}
                  >
                    ⌫ <span>Clear</span>
                  </button>
                </div>
              </div>

              {/* Voice Note Options Bar */}
              {showVoiceOptions && (
                <div style={{
                  marginTop: 10,
                  padding: '10px 14px',
                  borderRadius: 13,
                  background: 'linear-gradient(145deg, #fdfaff, #f3eafb)',
                  border: '1px solid rgba(154,88,232,0.22)',
                  boxShadow: '0 6px 16px rgba(107,47,192,0.06), inset 0 1px #fff'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                    <label style={{ fontSize: 10, fontWeight: 900, color: '#6b2fc0', letterSpacing: 0.5 }}>VOICE LANGUAGE:</label>
                    <select 
                      className="select compact-select" 
                      value={voiceLang} 
                      onChange={e => setVoiceLang(e.target.value)}
                      style={{ maxWidth: 220, height: 34, fontSize: 11, fontWeight: 700 }}
                    >
                      {VOICE_LANGUAGES.map(v => (
                        <option key={v.code} value={v.code}>{v.label}</option>
                      ))}
                    </select>

                    <button 
                      type="button" 
                      className="btn" 
                      onClick={handlePreviewVoice}
                      disabled={convertingVoice}
                      style={{ padding: '6px 14px', fontSize: 11, fontWeight: 800 }}
                    >
                      {convertingVoice ? 'Converting...' : '🔊 Preview Audio'}
                    </button>
                  </div>

                  {previewAudio && (
                    <div style={{ marginTop: 10 }}>
                      <audio ref={audioPlayerRef} src={previewAudio.url} controls style={{ width: '100%', height: 32 }} />
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Attachment preview if any */}
            {attachment && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '8px 12px',
                background: 'rgba(22,167,101,0.08)',
                border: '1px solid rgba(22,167,101,0.2)',
                borderRadius: 10,
                marginTop: 10
              }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: '#17613f' }}>📎 {attachment.name} ({attachment.size})</span>
                <button 
                  type="button" 
                  onClick={() => setAttachment(null)}
                  style={{ border: 'none', background: 'transparent', color: '#e85b63', cursor: 'pointer', fontWeight: 800, fontSize: 13 }}
                >
                  ✕
                </button>
              </div>
            )}

            {/* Action Row */}
            <div className="action-row">
              <div className="secondary-actions">
                <label className="btn compact-btn" style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                  📎 <span>Attachment</span>
                  <input 
                    type="file" 
                    ref={fileInputRef} 
                    onChange={handleAttachment} 
                    hidden 
                  />
                </label>

                {showVoiceOptions && (
                  <button 
                    type="button" 
                    className="btn compact-btn" 
                    onClick={() => handleSendMessages(true)}
                    disabled={sendingProgress.active}
                    style={{
                      background: 'linear-gradient(145deg, #9a58e8, #6b2fc0)',
                      color: '#fff',
                      border: '1px solid rgba(107, 47, 192, 0.3)',
                      boxShadow: '0 4px 0 #56239e, 0 8px 16px rgba(107, 47, 192, 0.25), inset 0 1px rgba(255,255,255,.4)'
                    }}
                  >
                    🎙 <span>Send as Voice</span>
                  </button>
                )}
              </div>

              <button 
                type="button" 
                className="btn primary send-btn" 
                id="sendBtn"
                onClick={() => handleSendMessages(false)}
                disabled={sendingProgress.active}
              >
                <span id="sendBtnText">➤ {sendingMode === 'schedule' ? 'Schedule Message' : 'Send Message'}</span>
              </button>
            </div>

            {/* Progress Bar during active sending */}
            {sendingProgress.active && (
              <div style={{ marginTop: 14, padding: 12, borderRadius: 12, background: 'rgba(22,167,101,0.06)', border: '1px solid rgba(22,167,101,0.2)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 6 }}>
                  <span>{sendingProgress.statusText}</span>
                  <button 
                    type="button" 
                    onClick={() => { cancelSendingRef.current = true }}
                    style={{ background: '#e85b63', color: '#fff', border: 'none', borderRadius: 6, padding: '2px 8px', fontSize: 11, cursor: 'pointer' }}
                  >
                    Stop
                  </button>
                </div>
                <div style={{ height: 6, width: '100%', background: '#e0e7e3', borderRadius: 10, overflow: 'hidden' }}>
                  <div 
                    style={{ 
                      height: '100%', 
                      background: 'linear-gradient(90deg, #35cb89, #129e65)', 
                      width: `${(sendingProgress.current / (sendingProgress.total || 1)) * 100}%`,
                      transition: 'width 0.3s ease'
                    }} 
                  />
                </div>
                <div style={{ display: 'flex', gap: 14, fontSize: 11, marginTop: 6, color: '#718078' }}>
                  <span>Sent: <strong style={{ color: '#16a765' }}>{sendingProgress.sentCount}</strong></span>
                  <span>Failed: <strong style={{ color: '#e85b63' }}>{sendingProgress.failCount}</strong></span>
                </div>
              </div>
            )}
          </div>

          <div className="composer-footer">
            <span>Tip: Upload an Excel file for large recipient lists.</span>
            <span>Max message length <b>1000</b> characters</span>
          </div>
        </section>

        {/* Right Column: How to Use Guide */}
        <aside className="guide-card card">
          <div className="guide-head">
            <div className="guide-icon">✦</div>
            <div>
              <h2>How to Use</h2>
              <p>Follow these steps to send messages quickly and safely.</p>
            </div>
          </div>
          <div className="guide-list">
            <div className="guide-step">
              <span className="guide-num">01</span>
              <div>
                <h3>Choose WhatsApp</h3>
                <p>Select your connected WhatsApp account from the dropdown.</p>
              </div>
            </div>
            <div className="guide-step">
              <span className="guide-num">02</span>
              <div>
                <h3>Type Number</h3>
                <p>Enter 10-digit mobile numbers separated by commas.</p>
              </div>
            </div>
            <div className="guide-step">
              <span className="guide-num">03</span>
              <div>
                <h3>Upload Excel &amp; Sample</h3>
                <p>Use <b>Sample Excel</b> to verify format, then upload Excel/CSV.</p>
              </div>
            </div>
            <div className="guide-step">
              <span className="guide-num">04</span>
              <div>
                <h3>Remove Duplicates</h3>
                <p>Click <b>Unique</b> to remove repeated and invalid numbers.</p>
              </div>
            </div>
            <div className="guide-step">
              <span className="guide-num">05</span>
              <div>
                <h3>Emoji &amp; Attachment</h3>
                <p>Add emojis with <b>Emoji</b> and attach photos or PDFs.</p>
              </div>
            </div>
            <div className="guide-step">
              <span className="guide-num">06</span>
              <div>
                <h3>Voice Message</h3>
                <p>Convert your message into an MP3 voice note with <b>Voice Note</b>.</p>
              </div>
            </div>
            <div className="guide-step">
              <span className="guide-num">07</span>
              <div>
                <h3>Send Message</h3>
                <p>Click <b>Send Message</b> for sequential safe delivery.</p>
              </div>
            </div>
          </div>
          <div className="guide-tip">
            <span>◆</span>
            <div>
              <strong>Safety Tip</strong>
              <small>Use valid 10-digit Indian numbers and follow WhatsApp messaging rules.</small>
            </div>
          </div>
        </aside>

      </div>
    </div>
  )
}

export default SendPage
