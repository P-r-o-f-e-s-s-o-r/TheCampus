import { useEffect, useState } from 'react'
import { onAuthStateChanged, signInWithPopup, signOut } from 'firebase/auth'
import { ADMIN_EMAIL, auth, googleProvider } from './firebase'
import {
  createQuestion,
  deleteQuestion,
  exportQuestions,
  importQuestions,
  listQuestions,
  listWaitlist,
  updateQuestion,
} from './api'
import './App.css'

const EMPTY_QUESTION = {
  id: '',
  area: 'R',
  title: '',
  cue: '',
  icon: 'spark',
  scene: '',
  sortOrder: 0,
  active: true,
}

export default function App() {
  const [user, setUser] = useState(undefined)
  const [tab, setTab] = useState('waitlist')
  const [waitlist, setWaitlist] = useState([])
  const [pack, setPack] = useState(null)
  const [form, setForm] = useState(EMPTY_QUESTION)
  const [editingId, setEditingId] = useState(null)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(
    () =>
      onAuthStateChanged(auth, async (next) => {
        if (!next) {
          setUser(null)
          return
        }
        const email = (next.email || '').toLowerCase()
        if (email !== ADMIN_EMAIL) {
          await signOut(auth)
          setUser(null)
          setError(`Only ${ADMIN_EMAIL} can access admin.`)
          return
        }
        setUser(next)
      }),
    []
  )

  useEffect(() => {
    if (!user) return
    refresh()
  }, [user, tab])

  async function refresh() {
    setError('')
    try {
      if (tab === 'waitlist') {
        const data = await listWaitlist()
        setWaitlist(data.entries || [])
      } else {
        const data = await listQuestions()
        setPack(data.pack)
      }
    } catch (err) {
      setError(err.message)
    }
  }

  async function onGoogleSignIn() {
    setError('')
    setBusy(true)
    try {
      const result = await signInWithPopup(auth, googleProvider)
      const email = (result.user.email || '').toLowerCase()
      if (email !== ADMIN_EMAIL) {
        await signOut(auth)
        setError(`Only ${ADMIN_EMAIL} can access admin.`)
      }
    } catch (err) {
      if (err.code !== 'auth/popup-closed-by-user') {
        setError(err.message)
      }
    } finally {
      setBusy(false)
    }
  }

  async function saveQuestion(e) {
    e.preventDefault()
    setBusy(true)
    setMessage('')
    setError('')
    try {
      if (editingId) await updateQuestion(editingId, form)
      else await createQuestion(form)
      setForm(EMPTY_QUESTION)
      setEditingId(null)
      setMessage(editingId ? 'Question updated' : 'Question created')
      await refresh()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  async function onDelete(id) {
    if (!confirm(`Delete question ${id}?`)) return
    setBusy(true)
    try {
      await deleteQuestion(id)
      setMessage(`Deleted ${id}`)
      await refresh()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  async function onExport() {
    try {
      const data = await exportQuestions()
      const blob = new Blob([JSON.stringify(data.pack, null, 2)], {
        type: 'application/json',
      })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'questions.export.json'
      a.click()
      URL.revokeObjectURL(url)
      setMessage('Exported questions JSON')
    } catch (err) {
      setError(err.message)
    }
  }

  async function onImport(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setBusy(true)
    setError('')
    try {
      const text = await file.text()
      const json = JSON.parse(text)
      const result = await importQuestions(json.pack || json)
      setMessage(`Imported ${result.imported} questions`)
      await refresh()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
      e.target.value = ''
    }
  }

  if (user === undefined) {
    return (
      <div className="admin">
        <h1>SapiensCampus Admin</h1>
        <p className="muted">Checking session…</p>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="admin">
        <h1>SapiensCampus Admin</h1>
        <div className="card login">
          <p className="muted">Sign in with the allowlisted Google account.</p>
          <button
            type="button"
            className="google"
            disabled={busy}
            onClick={onGoogleSignIn}
          >
            {busy ? 'Opening Google…' : 'Continue with Google'}
          </button>
          {error && <p className="error">{error}</p>}
        </div>
      </div>
    )
  }

  return (
    <div className="admin">
      <header>
        <div>
          <h1>SapiensCampus Admin</h1>
          <p>{user.email}</p>
        </div>
        <button onClick={() => signOut(auth)}>Sign out</button>
      </header>

      <nav>
        <button className={tab === 'waitlist' ? 'active' : ''} onClick={() => setTab('waitlist')}>
          Waitlist
        </button>
        <button className={tab === 'questions' ? 'active' : ''} onClick={() => setTab('questions')}>
          Questions
        </button>
      </nav>

      {message && <p className="ok">{message}</p>}
      {error && <p className="error">{error}</p>}

      {tab === 'waitlist' && (
        <section className="card">
          <h2>Waitlisted students ({waitlist.length})</h2>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Email</th>
                  <th>Joined</th>
                  <th>Scores</th>
                  <th>Answers</th>
                </tr>
              </thead>
              <tbody>
                {waitlist.map((row) => (
                  <tr key={row.id}>
                    <td>{row.email}</td>
                    <td>{row.createdAt ? new Date(row.createdAt).toLocaleString() : '—'}</td>
                    <td>
                      {row.scores
                        ? Object.entries(row.scores)
                            .map(([k, v]) => `${k}:${v}`)
                            .join(' ')
                        : '—'}
                    </td>
                    <td>{row.hasAnswers ? 'yes' : 'no'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {tab === 'questions' && (
        <>
          <section className="card actions">
            <button onClick={onExport}>Export JSON</button>
            <label className="file">
              Import JSON
              <input type="file" accept="application/json,.json" onChange={onImport} />
            </label>
            <a href="/questions.template.json" download>
              Download template
            </a>
          </section>

          <section className="card">
            <h2>{editingId ? `Edit ${editingId}` : 'Create question'}</h2>
            <form className="grid" onSubmit={saveQuestion}>
              <label>
                ID
                <input
                  value={form.id}
                  disabled={Boolean(editingId)}
                  onChange={(e) => setForm({ ...form, id: e.target.value })}
                  required
                  placeholder="R1"
                />
              </label>
              <label>
                Area
                <select
                  value={form.area}
                  onChange={(e) => setForm({ ...form, area: e.target.value })}
                >
                  {'RIASEC'.split('').map((k) => (
                    <option key={k} value={k}>
                      {k}
                    </option>
                  ))}
                </select>
              </label>
              <label className="wide">
                Title
                <input
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  required
                />
              </label>
              <label className="wide">
                Cue
                <input
                  value={form.cue}
                  onChange={(e) => setForm({ ...form, cue: e.target.value })}
                />
              </label>
              <label>
                Icon
                <input
                  value={form.icon}
                  onChange={(e) => setForm({ ...form, icon: e.target.value })}
                />
              </label>
              <label>
                Scene
                <input
                  value={form.scene}
                  onChange={(e) => setForm({ ...form, scene: e.target.value })}
                />
              </label>
              <label>
                Sort order
                <input
                  type="number"
                  value={form.sortOrder}
                  onChange={(e) =>
                    setForm({ ...form, sortOrder: Number(e.target.value) })
                  }
                />
              </label>
              <label className="check">
                <input
                  type="checkbox"
                  checked={form.active}
                  onChange={(e) => setForm({ ...form, active: e.target.checked })}
                />
                Active
              </label>
              <div className="wide row">
                <button disabled={busy} type="submit">
                  {editingId ? 'Update' : 'Create'}
                </button>
                {editingId && (
                  <button
                    type="button"
                    onClick={() => {
                      setEditingId(null)
                      setForm(EMPTY_QUESTION)
                    }}
                  >
                    Cancel
                  </button>
                )}
              </div>
            </form>
          </section>

          <section className="card">
            <h2>Questions ({pack?.questions?.length || 0})</h2>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Area</th>
                    <th>Title</th>
                    <th>Active</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {(pack?.questions || []).map((q) => (
                    <tr key={q.id}>
                      <td>{q.id}</td>
                      <td>{q.area}</td>
                      <td>{q.title}</td>
                      <td>{q.active === false ? 'no' : 'yes'}</td>
                      <td className="row">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingId(q.id)
                            setForm({
                              id: q.id,
                              area: q.area,
                              title: q.title || '',
                              cue: q.cue || '',
                              icon: q.icon || 'spark',
                              scene: q.scene || '',
                              sortOrder: q.sortOrder ?? 0,
                              active: q.active !== false,
                            })
                          }}
                        >
                          Edit
                        </button>
                        <button type="button" onClick={() => onDelete(q.id)}>
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  )
}
