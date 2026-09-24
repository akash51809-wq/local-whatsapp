import React from 'react'

export function Stat({ icon, value, label, variant, sub }) { 
  let computedVariant = variant
  if (!computedVariant) {
    const l = String(label || '').toLowerCase()
    if (l.includes('chat') || l.includes('total')) computedVariant = 'teal'
    else if (l.includes('unread') || l.includes('fail')) computedVariant = 'coral'
    else if (l.includes('group') || l.includes('pending')) computedVariant = 'purple'
    else if (l.includes('status') || l.includes('sent') || l.includes('online')) computedVariant = 'success'
    else computedVariant = 'amber'
  }

  return (
    <div className={`stat-card stat-${computedVariant}`}>
      <div className="stat-icon-wrap">
        <span>{icon}</span>
      </div>
      <div className="stat-content">
        <span className="stat-label">{label}</span>
        <strong className="stat-value">{value}</strong>
        {sub && <span className="stat-sub">{sub}</span>}
      </div>
    </div>
  )
}

export default Stat
