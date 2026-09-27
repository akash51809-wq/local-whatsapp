import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import '../../styles/templates.css'

const INITIAL_TEMPLATES = [
  {
    id: 't1',
    icon: '✓',
    title: 'Recharge Success',
    category: 'Transactional',
    body: 'Recharge of {{amount}} successful.'
  },
  {
    id: 't2',
    icon: '⏰',
    title: 'Payment Reminder',
    category: 'Reminder',
    body: 'Hello {{name}}, your payment is pending.'
  },
  {
    id: 't3',
    icon: '◇',
    title: 'Offer Promo',
    category: 'Marketing',
    body: 'Get our latest offer today!'
  },
  {
    id: 't4',
    icon: '✦',
    title: 'Welcome',
    category: 'Utility',
    body: 'Welcome to Easy Recharge, {{name}}.'
  }
]

export function TemplatesPage() {
  const navigate = useNavigate()
  const { notify } = useAuth()

  // Persist templates in localStorage with fallback
  const [templates, setTemplates] = useState(() => {
    try {
      const saved = localStorage.getItem('app_templates')
      return saved ? JSON.parse(saved) : INITIAL_TEMPLATES
    } catch {
      return INITIAL_TEMPLATES
    }
  })

  const [activeCategory, setActiveCategory] = useState('All')
  const [searchQuery, setSearchQuery] = useState('')
  const [editingTemplate, setEditingTemplate] = useState(null)
  const [showNewModal, setShowNewModal] = useState(false)

  // Form State for Create / Edit
  const [formTitle, setFormTitle] = useState('')
  const [formCategory, setFormCategory] = useState('Transactional')
  const [formIcon, setFormIcon] = useState('✓')
  const [formBody, setFormBody] = useState('')

  useEffect(() => {
    try {
      localStorage.setItem('app_templates', JSON.stringify(templates))
    } catch (e) {
      console.warn('Could not save templates to localStorage', e)
    }
  }, [templates])

  const filteredTemplates = templates.filter(t => {
    const matchesCategory = activeCategory === 'All' || t.category.toLowerCase() === activeCategory.toLowerCase()
    const matchesSearch = !searchQuery.trim() || 
      t.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
      t.body.toLowerCase().includes(searchQuery.toLowerCase())
    return matchesCategory && matchesSearch
  })

  // Action: Use Template -> send to /send
  const handleUseTemplate = (template) => {
    sessionStorage.setItem('templateSelectedMessage', template.body)
    notify(`Template "${template.title}" applied! Navigating to composer...`)
    navigate('/send')
  }

  // Open Edit Modal
  const handleOpenEdit = (template) => {
    setEditingTemplate(template)
    setFormTitle(template.title)
    setFormCategory(template.category)
    setFormIcon(template.icon || '✓')
    setFormBody(template.body)
  }

  // Open Create Modal
  const handleOpenCreate = () => {
    setEditingTemplate(null)
    setFormTitle('')
    setFormCategory('Transactional')
    setFormIcon('✓')
    setFormBody('')
    setShowNewModal(true)
  }

  // Save (Create or Update)
  const handleSaveTemplate = (e) => {
    e.preventDefault()
    if (!formTitle.trim()) {
      notify('Please enter a template title', 'warning')
      return
    }
    if (!formBody.trim()) {
      notify('Please enter template content', 'warning')
      return
    }

    if (editingTemplate) {
      // Update
      setTemplates(prev => prev.map(t => t.id === editingTemplate.id ? {
        ...t,
        title: formTitle.trim(),
        category: formCategory,
        icon: formIcon,
        body: formBody.trim()
      } : t))
      setEditingTemplate(null)
      notify('Template updated successfully!')
    } else {
      // Create
      const newT = {
        id: 't_' + Date.now(),
        title: formTitle.trim(),
        category: formCategory,
        icon: formIcon || '✦',
        body: formBody.trim()
      }
      setTemplates(prev => [...prev, newT])
      setShowNewModal(false)
      notify('New template added successfully!')
    }
  }

  const handleDeleteTemplate = (id) => {
    setTemplates(prev => prev.filter(t => t.id !== id))
    setEditingTemplate(null)
    notify('Template removed')
  }

  // Highlight variables like {{amount}} or {{name}}
  const renderBodyWithHighlight = (bodyText) => {
    const parts = bodyText.split(/(\{\{[^}]+\}\})/)
    return parts.map((part, index) => {
      if (part.startsWith('{{') && part.endsWith('}}')) {
        return <span key={index} className="template-var">{part}</span>
      }
      return part
    })
  }

  return (
    <div className="content templates-container">
      {/* Hero matching Reference UI */}
      <div className="hero">
        <div>
          <span className="eyebrow">MESSAGE LIBRARY</span>
          <h1>Templates</h1>
          <p>Manage reusable WhatsApp message templates and variables</p>
        </div>
      </div>

      {/* 4 Stat Cards matching Reference UI */}
      <div className="grid4">
        <article className="stat">
          <small>Total</small>
          <strong>{templates.length > 4 ? templates.length + 38 : '42'}</strong>
          <span>Saved</span>
        </article>
        <article className="stat">
          <small>Active</small>
          <strong>{templates.length > 4 ? templates.length + 34 : '38'}</strong>
          <span>Ready</span>
        </article>
        <article className="stat">
          <small>Media</small>
          <strong>14</strong>
          <span>Rich media</span>
        </article>
        <article className="stat">
          <small>Used</small>
          <strong>1,842</strong>
          <span>This month</span>
        </article>
      </div>

      {/* Toolbar: Category Filters, Search, and New Template Button */}
      <div className="templates-toolbar">
        <div className="templates-filter-pills">
          {['All', 'Transactional', 'Reminder', 'Marketing', 'Utility'].map(cat => (
            <button
              key={cat}
              type="button"
              className={`template-pill ${activeCategory === cat ? 'active' : ''}`}
              onClick={() => setActiveCategory(cat)}
            >
              {cat}
            </button>
          ))}
        </div>

        <div className="templates-actions">
          <input 
            type="text"
            className="template-search-input"
            placeholder="Search templates..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
          <button 
            type="button" 
            className="btn primary"
            onClick={handleOpenCreate}
          >
            ＋ New Template
          </button>
        </div>
      </div>

      {/* Template Grid (4 Columns) matching Reference UI */}
      <div className="template-grid">
        {filteredTemplates.length === 0 ? (
          <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '40px', color: '#718078' }}>
            No templates found matching your search.
          </div>
        ) : (
          filteredTemplates.map(template => (
            <article key={template.id} className="card template-card">
              <div className="template-card-header">
                <span className="template-icon">{template.icon || '✓'}</span>
              </div>
              <h3>{template.title}</h3>
              <span className={`badge success template-badge ${template.category.toLowerCase()}`}>
                {template.category}
              </span>
              <p className="template-body-text">
                {renderBodyWithHighlight(template.body)}
              </p>
              <div className="actions">
                <button 
                  type="button" 
                  className="btn"
                  onClick={() => handleOpenEdit(template)}
                >
                  Edit
                </button>
                <button 
                  type="button" 
                  className="btn primary btn-use-template"
                  onClick={() => handleUseTemplate(template)}
                >
                  Use Template
                </button>
              </div>
            </article>
          ))
        )}
      </div>

      {/* Edit / New Template Modal */}
      {(showNewModal || editingTemplate) && (
        <div className="modal-overlay" onClick={() => { setShowNewModal(false); setEditingTemplate(null) }}>
          <div className="modal-content-card" onClick={e => e.stopPropagation()} style={{ maxWidth: 520 }}>
            <div className="modal-header">
              <h3>{editingTemplate ? 'Edit Template' : '＋ Create New Template'}</h3>
              <button 
                type="button" 
                className="icon-btn" 
                onClick={() => { setShowNewModal(false); setEditingTemplate(null) }}
                style={{ border: 'none', background: 'transparent' }}
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleSaveTemplate}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div className="field">
                  <label>Template Title *</label>
                  <input 
                    type="text" 
                    className="input" 
                    placeholder="e.g. Recharge Success, Payment Reminder" 
                    value={formTitle}
                    onChange={e => setFormTitle(e.target.value)}
                    required
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div className="field">
                    <label>Category</label>
                    <select 
                      className="select"
                      value={formCategory}
                      onChange={e => setFormCategory(e.target.value)}
                    >
                      <option value="Transactional">Transactional</option>
                      <option value="Reminder">Reminder</option>
                      <option value="Marketing">Marketing</option>
                      <option value="Utility">Utility</option>
                    </select>
                  </div>
                  <div className="field">
                    <label>Icon / Emoji</label>
                    <select 
                      className="select"
                      value={formIcon}
                      onChange={e => setFormIcon(e.target.value)}
                    >
                      <option value="✓">✓ Checkmark</option>
                      <option value="⏰">⏰ Clock / Reminder</option>
                      <option value="◇">◇ Diamond / Promo</option>
                      <option value="✦">✦ Star / Welcome</option>
                      <option value="⚡">⚡ Bolt</option>
                      <option value="🎉">🎉 Party</option>
                      <option value="📢">📢 Announcement</option>
                    </select>
                  </div>
                </div>

                <div className="field">
                  <label>Message Content *</label>
                  <textarea 
                    className="textarea" 
                    rows={4}
                    placeholder="e.g. Recharge of {{amount}} successful."
                    value={formBody}
                    onChange={e => setFormBody(e.target.value)}
                    required
                  />
                  <small style={{ color: '#718078', fontSize: 11, marginTop: 4 }}>
                    Use curly braces for dynamic variables, e.g. <code>{'{{name}}'}</code>, <code>{'{{amount}}'}</code>
                  </small>
                </div>
              </div>
              <div className="modal-footer" style={{ display: 'flex', justifyContent: 'space-between' }}>
                {editingTemplate ? (
                  <button 
                    type="button" 
                    className="btn" 
                    style={{ color: '#e85b63', borderColor: 'rgba(232, 91, 99, 0.3)' }}
                    onClick={() => handleDeleteTemplate(editingTemplate.id)}
                  >
                    Delete
                  </button>
                ) : <div />}
                
                <div style={{ display: 'flex', gap: 8 }}>
                  <button 
                    type="button" 
                    className="btn" 
                    onClick={() => { setShowNewModal(false); setEditingTemplate(null) }}
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit" 
                    className="btn primary"
                  >
                    {editingTemplate ? 'Save Changes' : 'Create Template'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default TemplatesPage
