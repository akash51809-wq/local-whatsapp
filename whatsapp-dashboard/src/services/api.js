// API Client & Authentication Token Helpers

export const getToken = () => localStorage.getItem('wa_login') || ''

export const setToken = (token) => {
  if (token) {
    localStorage.setItem('wa_login', token)
  } else {
    localStorage.removeItem('wa_login')
  }
}

export const clearToken = () => {
  localStorage.removeItem('wa_login')
  localStorage.removeItem('wa_user')
}

export const getSavedUser = () => {
  try {
    return JSON.parse(localStorage.getItem('wa_user') || '{}')
  } catch {
    return {}
  }
}

export const setSavedUser = (user) => {
  if (user) {
    localStorage.setItem('wa_user', JSON.stringify(user))
  } else {
    localStorage.removeItem('wa_user')
  }
}

export const api = async (url, options = {}) => {
  const token = getToken()
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers || {})
  }
  const res = await fetch(url, { ...options, headers })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.message || `Request failed: ${res.status}`)
  return data
}

export default api
