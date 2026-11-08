import { auth } from '../firebase'

const API_BASE = import.meta.env.VITE_API_BASE || ''

async function request(path, options = {}) {
  let res
  try {
    res = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {}),
      },
    })
  } catch (err) {
    const error = new Error(err.message || 'Network error — check your connection and try again')
    error.code = 'network_error'
    throw error
  }
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    const error = new Error(data.error || `Request failed (${res.status})`)
    error.code = data.code || `http_${res.status}`
    error.status = res.status
    throw error
  }
  return data
}

async function authRequest(path, options = {}) {
  const user = auth.currentUser
  if (!user) throw new Error('Not signed in')
  const token = await user.getIdToken()
  return request(path, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(options.headers || {}),
    },
  })
}

export function fetchQuestions() {
  return request('/api/questions')
}

export function checkInvite(code) {
  return request('/api/invites/check', {
    method: 'POST',
    body: JSON.stringify({ code }),
  })
}

export function fetchColleges() {
  return request('/api/colleges')
}

export function fetchCollegeStats(collegeId) {
  return request(`/api/colleges/${encodeURIComponent(collegeId)}/stats`)
}

export function fetchMe() {
  return authRequest('/api/me')
}

export function saveProfile(payload) {
  return authRequest('/api/me/profile', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function saveDiscovery(payload) {
  return authRequest('/api/me/discovery', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function joinWaitlist(payload) {
  return request('/api/waitlist', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}
