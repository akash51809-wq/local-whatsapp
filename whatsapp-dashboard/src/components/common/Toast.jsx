import React from 'react'

export function Toast({ toast, error, onClearError }) {
  return (
    <>
      {error && (
        <div className="alert">
          <span>⚠ {error}</span>
          <button onClick={onClearError} type="button" aria-label="Close error alert">×</button>
        </div>
      )}
      {toast && (
        <div className="toast">
          ✓ {toast}
        </div>
      )}
    </>
  )
}

export default Toast
