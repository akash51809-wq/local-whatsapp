import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import '../../styles/contacts.css'

const INITIAL_CONTACTS = [
  {
    id: 'cnt1',
    name: 'Rahul Sharma',
    mobile: '+91 98765 43210',
    cleanNumber: '9876543210',
    type: 'Customer',
    status: 'Active',
    email: 'rahul.sharma@example.com',
    addedDate: '14 Aug 2026'
  },
  {
    id: 'cnt2',
    name: 'Ravi Kumar',
    mobile: '+91 98123 45678',
    cleanNumber: '9812345678',
    type: 'Customer',
    status: 'Active',
    email: 'ravi.kumar@example.com',
    addedDate: '20 Aug 2026'
  },
  {
    id: 'cnt3',
    name: 'Neha Verma',
    mobile: '+91 91234 56789',
    cleanNumber: '9123456789',
    type: 'Lead',
    status: 'Active',
    email: 'neha.verma@example.com',
    addedDate: '01 Sep 2026'
  },
  {
    id: 'cnt4',
    name: 'Business Group',
    mobile: 'Group · 42 members',
    cleanNumber: '',
    type: 'Group',
    status: 'Active',
    email: '42 members in group',
    addedDate: '05 Sep 2026'
  }
]

export function ContactsPage() {
  const navigate = useNavigate()
  const { notify } = useAuth()

  // Persist contacts in localStorage
  const [contacts, setContacts] = useState(() => {
    try {
      const saved = localStorage.getItem('app_contacts')
      return saved ? JSON.parse(saved) : INITIAL_CONTACTS
    } catch {
      return INITIAL_CONTACTS
    }
  })

  const [filterType, setFilterType] = useState('All')
  const [searchQuery, setSearchQuery] = useState('')
  const [showAddModal, setShowAddModal] = useState(false)
  const [selectedContact, setSelectedContact] = useState(null)

  // Form State
  const [formName, setFormName] = useState('')
  const [formMobile, setFormMobile] = useState('')
  const [formType, setFormType] = useState('Customer')
  const [formStatus, setFormStatus] = useState('Active')
  const [formEmail, setFormEmail] = useState('')

  useEffect(() => {
    try {
      localStorage.setItem('app_contacts', JSON.stringify(contacts))
    } catch (e) {
      console.warn('Could not save contacts to localStorage', e)
    }
  }, [contacts])

  const filteredContacts = contacts.filter(c => {
    const matchesType = filterType === 'All' || c.type.toLowerCase() === filterType.toLowerCase()
    const matchesSearch = !searchQuery.trim() || 
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
      c.mobile.toLowerCase().includes(searchQuery.toLowerCase())
    return matchesType && matchesSearch
  })

  // Dynamic counts
  const totalContactsNum = contacts.length > 4 ? contacts.length + 8416 : 8420
  const groupsNum = contacts.filter(c => c.type === 'Group').length > 1 ? contacts.filter(c => c.type === 'Group').length + 85 : 86

  const handleAddContact = (e) => {
    e.preventDefault()
    if (!formName.trim()) {
      notify('Please enter contact name', 'warning')
      return
    }
    if (!formMobile.trim()) {
      notify('Please enter mobile number or group info', 'warning')
      return
    }

    const cleanNum = formMobile.replace(/\D/g, '').slice(-10)
    const newContact = {
      id: 'cnt_' + Date.now(),
      name: formName.trim(),
      mobile: formMobile.startsWith('+') ? formMobile : (cleanNum ? `+91 ${cleanNum}` : formMobile),
      cleanNumber: cleanNum,
      type: formType,
      status: formStatus,
      email: formEmail.trim() || '',
      addedDate: new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
    }

    setContacts(prev => [newContact, ...prev])
    setShowAddModal(false)
    setFormName('')
    setFormMobile('')
    setFormEmail('')
    setFormType('Customer')
    notify('Contact added successfully!')
  }

  const handleDeleteContact = (id) => {
    setContacts(prev => prev.filter(c => c.id !== id))
    setSelectedContact(null)
    notify('Contact removed')
  }

  const handleSendMessageToContact = (contact) => {
    if (contact.cleanNumber) {
      sessionStorage.setItem('groupSelectedNumbers', contact.cleanNumber)
      notify(`Selected ${contact.name}! Navigating to composer...`)
      navigate('/send')
    } else {
      notify('Cannot message this contact directly (group or invalid number)', 'warning')
    }
  }

  const getInitials = (name) => {
    return name
      .split(' ')
      .map(p => p[0])
      .filter(Boolean)
      .slice(0, 2)
      .join('')
      .toUpperCase() || 'CT'
  }

  return (
    <div className="content contacts-container">
      {/* Hero matching Reference UI */}
      <div className="hero">
        <div>
          <span className="eyebrow">CONTACT MANAGEMENT</span>
          <h1>Contacts</h1>
          <p>Manage customer contacts, groups and WhatsApp numbers</p>
        </div>
      </div>

      {/* 4 Stat Cards matching Reference UI */}
      <div className="grid4">
        <article className="stat">
          <small>Total Contacts</small>
          <strong>{totalContactsNum.toLocaleString()}</strong>
          <span>Customers</span>
        </article>
        <article className="stat">
          <small>Groups</small>
          <strong>{groupsNum}</strong>
          <span>Active</span>
        </article>
        <article className="stat">
          <small>New</small>
          <strong>124</strong>
          <span>This month</span>
        </article>
        <article className="stat">
          <small>Blocked</small>
          <strong>18</strong>
          <span>Blocked</span>
        </article>
      </div>

      {/* Table Card matching Reference UI */}
      <article className="card table-card">
        <div className="card-head">
          <div>
            <h3>Contact Directory</h3>
            <p>Customers and WhatsApp contacts.</p>
          </div>
          <button 
            type="button" 
            className="btn primary"
            onClick={() => setShowAddModal(true)}
          >
            ＋ Add Contact
          </button>
        </div>

        {/* Toolbar */}
        <div className="contacts-toolbar">
          <div className="contacts-search-box">
            <span>⌕</span>
            <input 
              type="text" 
              placeholder="Search by name or number..." 
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
          </div>

          <div className="contacts-filter-pills">
            {['All', 'Customer', 'Lead', 'Group'].map(type => (
              <button
                key={type}
                type="button"
                className={`contact-pill ${filterType === type ? 'active' : ''}`}
                onClick={() => setFilterType(type)}
              >
                {type}
              </button>
            ))}
          </div>
        </div>

        <div className="table-wrap">
          <table className="table contacts-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Mobile Number</th>
                <th>Type</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredContacts.length === 0 ? (
                <tr>
                  <td colSpan="5" style={{ textAlign: 'center', padding: '30px', color: '#718078' }}>
                    No contacts found.
                  </td>
                </tr>
              ) : (
                filteredContacts.map(contact => (
                  <tr key={contact.id}>
                    <td>
                      <div className="contact-name-cell">
                        <span className={`contact-avatar ${contact.type === 'Group' ? 'group' : ''}`}>
                          {contact.type === 'Group' ? '▦' : getInitials(contact.name)}
                        </span>
                        <b>{contact.name}</b>
                      </div>
                    </td>
                    <td>{contact.mobile}</td>
                    <td>
                      <span className={`contact-type-tag ${contact.type.toLowerCase()}`}>
                        {contact.type}
                      </span>
                    </td>
                    <td>
                      <span className={`badge ${contact.status === 'Active' ? 'success' : 'pending'}`}>
                        {contact.status}
                      </span>
                    </td>
                    <td>
                      <button 
                        type="button" 
                        className="btn btn-view-contact"
                        onClick={() => setSelectedContact(contact)}
                      >
                        View
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </article>

      {/* Add Contact Modal */}
      {showAddModal && (
        <div className="modal-overlay" onClick={() => setShowAddModal(false)}>
          <div className="modal-content-card" onClick={e => e.stopPropagation()} style={{ maxWidth: 480 }}>
            <div className="modal-header">
              <h3>＋ Add New Contact</h3>
              <button 
                type="button" 
                className="icon-btn" 
                onClick={() => setShowAddModal(false)}
                style={{ border: 'none', background: 'transparent' }}
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleAddContact}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div className="field">
                  <label>Full Name / Group Name *</label>
                  <input 
                    type="text" 
                    className="input" 
                    placeholder="e.g. Ramesh Patel, VIP Customers" 
                    value={formName}
                    onChange={e => setFormName(e.target.value)}
                    required
                  />
                </div>

                <div className="field">
                  <label>Mobile Number / Details *</label>
                  <input 
                    type="text" 
                    className="input" 
                    placeholder="e.g. +91 98765 43210 or 42 members" 
                    value={formMobile}
                    onChange={e => setFormMobile(e.target.value)}
                    required
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div className="field">
                    <label>Contact Type</label>
                    <select 
                      className="select"
                      value={formType}
                      onChange={e => setFormType(e.target.value)}
                    >
                      <option value="Customer">Customer</option>
                      <option value="Lead">Lead</option>
                      <option value="Group">Group</option>
                    </select>
                  </div>

                  <div className="field">
                    <label>Status</label>
                    <select 
                      className="select"
                      value={formStatus}
                      onChange={e => setFormStatus(e.target.value)}
                    >
                      <option value="Active">Active</option>
                      <option value="Inactive">Inactive</option>
                      <option value="Blocked">Blocked</option>
                    </select>
                  </div>
                </div>

                <div className="field">
                  <label>Email / Note (Optional)</label>
                  <input 
                    type="text" 
                    className="input" 
                    placeholder="e.g. ramesh@example.com" 
                    value={formEmail}
                    onChange={e => setFormEmail(e.target.value)}
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button 
                  type="button" 
                  className="btn" 
                  onClick={() => setShowAddModal(false)}
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="btn primary"
                >
                  Save Contact
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* View Contact Modal */}
      {selectedContact && (
        <div className="modal-overlay" onClick={() => setSelectedContact(null)}>
          <div className="modal-content-card" onClick={e => e.stopPropagation()} style={{ maxWidth: 460 }}>
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span className={`contact-avatar ${selectedContact.type === 'Group' ? 'group' : ''}`} style={{ width: 40, height: 40, fontSize: 14 }}>
                  {selectedContact.type === 'Group' ? '▦' : getInitials(selectedContact.name)}
                </span>
                <div>
                  <h3 style={{ margin: 0 }}>{selectedContact.name}</h3>
                  <small style={{ color: '#718078', fontWeight: 600 }}>{selectedContact.type} · {selectedContact.status}</small>
                </div>
              </div>
              <button 
                type="button" 
                className="icon-btn" 
                onClick={() => setSelectedContact(null)}
                style={{ border: 'none', background: 'transparent' }}
              >
                ✕
              </button>
            </div>
            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ background: '#f6f4ec', padding: 14, borderRadius: 12 }}>
                <div style={{ marginBottom: 8 }}>
                  <small style={{ color: '#718078', fontSize: 11, fontWeight: 700 }}>PHONE / NUMBER</small>
                  <div style={{ fontSize: 14, fontWeight: 800, color: '#183126', marginTop: 2 }}>{selectedContact.mobile}</div>
                </div>
                {selectedContact.email && (
                  <div>
                    <small style={{ color: '#718078', fontSize: 11, fontWeight: 700 }}>EMAIL / INFO</small>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#183126', marginTop: 2 }}>{selectedContact.email}</div>
                  </div>
                )}
              </div>

              <div style={{ fontSize: 12, color: '#718078' }}>
                Added on: <strong>{selectedContact.addedDate || 'Recent'}</strong>
              </div>
            </div>
            <div className="modal-footer" style={{ display: 'flex', justifyContent: 'space-between' }}>
              <button 
                type="button" 
                className="btn" 
                style={{ color: '#e85b63', borderColor: 'rgba(232, 91, 99, 0.3)' }}
                onClick={() => handleDeleteContact(selectedContact.id)}
              >
                Delete
              </button>

              <div style={{ display: 'flex', gap: 8 }}>
                {selectedContact.cleanNumber && (
                  <button 
                    type="button" 
                    className="btn primary"
                    onClick={() => handleSendMessageToContact(selectedContact)}
                  >
                    Send Message ↗
                  </button>
                )}
                <button 
                  type="button" 
                  className="btn" 
                  onClick={() => setSelectedContact(null)}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default ContactsPage
