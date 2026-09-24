import React from 'react'

export function Empty({ text }) { 
  return (
    <div className="empty">
      <div style={{ fontSize: 24, marginBottom: 6, opacity: 0.6 }}>💬</div>
      <div>{text}</div>
    </div>
  )
}

export default Empty
