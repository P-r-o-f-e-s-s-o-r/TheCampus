import { auth } from './firebase'

const API_BASE = import.meta.env.VITE_API_BASE || ''

async function authHeaders() {
  const user = auth.currentUser
  if (!user) throw new Error('Not signed in')
  const token = await user.getIdToken()
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  }
}

async function request(path, options = {}) {
  const headers = await authHeaders()
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: { ...headers, ...(options.headers || {}) },
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`)
  return data
}

export const listWaitlist = () => request('/api/admin/waitlist')
export const listQuestions = () => request('/api/admin/questions')
export const createQuestion = (body) =>
  request('/api/admin/questions', { method: 'POST', body: JSON.stringify(body) })
export const updateQuestion = (id, body) =>
  request(`/api/admin/questions/${id}`, { method: 'PUT', body: JSON.stringify(body) })
export const deleteQuestion = (id) =>
  request(`/api/admin/questions/${id}`, { method: 'DELETE' })
export const exportQuestions = () => request('/api/admin/questions/export')
export const importQuestions = (pack) =>
  request('/api/admin/questions/import', {
    method: 'POST',
    body: JSON.stringify({ pack }),
  })
