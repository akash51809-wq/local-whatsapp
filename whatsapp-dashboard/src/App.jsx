import React, { Component } from 'react'
import { BrowserRouter } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import AppRoutes from './routes/AppRoutes'
import './styles/app-shell.css'

class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, errorInfo) {
    console.error('App Error Caught:', error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 24,
          background: '#f8fafc',
          fontFamily: 'system-ui, sans-serif'
        }}>
          <div style={{
            background: '#fff',
            padding: 32,
            borderRadius: 12,
            boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
            maxWidth: 480,
            textAlign: 'center',
            width: '100%'
          }}>
            <h2 style={{ color: '#dc2626', marginBottom: 12 }}>कुछ गलत हो गया (Something went wrong)</h2>
            <p style={{ color: '#64748b', fontSize: 14, marginBottom: 20 }}>
              {this.state.error?.message || 'एप्लिकेशन लोड करने में समस्या आई।'}
            </p>
            <button 
              onClick={() => { this.setState({ hasError: false }); window.location.reload() }}
              style={{
                background: '#128c7e',
                color: '#fff',
                border: 'none',
                padding: '10px 20px',
                borderRadius: 8,
                fontWeight: 700,
                cursor: 'pointer'
              }}
            >
              रीलोड करें (Reload)
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}

export default function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </BrowserRouter>
    </ErrorBoundary>
  )
}
