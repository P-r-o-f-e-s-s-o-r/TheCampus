import { useEffect, useMemo, useState } from 'react'
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

const AREA_COLORS = {
  R: 'mint',
  I: 'sky',
  A: 'lilac',
  S: 'yellove',
  E: 'peach',
  C: 'mint',
}

function Window({ title, children, actions }) {
  return (
    <section className="window">
      <div className="window-bar">
        <div className="window-dots" aria-hidden="true">
          <i />
          <i />
          <i />
        </div>
        <div className="title">{title}</div>
        {actions}
      </div>
      <div className="window-body">{children}</div>
    </section>
  )
}

function Flash({ ok, err }) {
  if (!ok && !err) return null
  return (
    <div className={`flash ${err ? 'err' : 'ok'}`} role="status">
      <span className="mono">{err ? 'Error' : 'Done'}</span>
      <div>{err || ok}</div>
    </div>
  )
}

function LoadingScreen() {
  return (
    <div className="loading-screen">
      <div className="pulse" aria-hidden="true" />
      <p className="mono">Checking session</p>
      <h2>Hang tight…</h2>
    </div>
  )
}

function LoginScreen({ busy, error, onSignIn }) {
  return (
    <div className="login-screen">
      <div className="login-card">
        <span className="sticker">Admin ✳</span>
        <div className="login-hero">
          <img className="mascot" src="/lufy-standing.png" alt="" />
          <p className="mono">Sapiens Campus</p>
          <h1>Admin portal</h1>
          <p>Waitlist, questions, and the boring bits that keep campus humming.</p>
        </div>
        <div className="login-body">
          <p className="hint">
            Sign in with the allowlisted Google account (
            <strong>{ADMIN_EMAIL}</strong>).
          </p>
          <button
            type="button"
            className="btn dark block"
            disabled={busy}
            onClick={onSignIn}
          >
            {busy ? 'Opening Google…' : 'Continue with Google'}
          </button>
          <Flash err={error} />
        </div>
      </div>
    </div>
  )
}

function NavItem({ id, label, code, active, onClick }) {
  return (
    <button
      type="button"
      className={`nav-item${active ? ' active' : ''}`}
      onClick={() => onClick(id)}
      aria-current={active ? 'page' : undefined}
    >
      <span className="nav-ico">{code}</span>
      {label}
    </button>
  )
}

export default function App() {
  const [user, setUser] = useState(undefined)
  const [tab, setTab] = useState('waitlist')
  const [menuOpen, setMenuOpen] = useState(false)
  const [waitlist, setWaitlist] = useState([])
  const [pack, setPack] = useState(null)
  const [form, setForm] = useState(EMPTY_QUESTION)
  const [editingId, setEditingId] = useState(null)
  const [formOpen, setFormOpen] = useState(false)
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

  const waitlistWithAnswers = useMemo(
    () => waitlist.filter((row) => row.hasAnswers).length,
    [waitlist]
  )

  const activeQuestions = useMemo(
    () => (pack?.questions || []).filter((q) => q.active !== false).length,
    [pack]
  )

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

  function switchTab(next) {
    setTab(next)
    setMenuOpen(false)
    setMessage('')
    setError('')
    closeForm()
  }

  function closeForm() {
    setFormOpen(false)
    setEditingId(null)
    setForm(EMPTY_QUESTION)
  }

  function startCreate() {
    setEditingId(null)
    setForm(EMPTY_QUESTION)
    setFormOpen(true)
    setMessage('')
    setError('')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function saveQuestion(e) {
    e.preventDefault()
    setBusy(true)
    setMessage('')
    setError('')
    const wasEditing = Boolean(editingId)
    try {
      if (editingId) await updateQuestion(editingId, form)
      else await createQuestion(form)
      closeForm()
      setMessage(wasEditing ? 'Question updated' : 'Question created')
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

  function startEdit(q) {
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
    setFormOpen(true)
    setMessage('')
    setError('')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  if (user === undefined) return <LoadingScreen />

  if (!user) {
    return (
      <LoginScreen busy={busy} error={error} onSignIn={onGoogleSignIn} />
    )
  }

  const initial = (user.email || 'A').slice(0, 1).toUpperCase()

  return (
    <div className="shell">
      <header className={`topnav${menuOpen ? ' is-open' : ''}`}>
        <div className="topnav-inner">
          <a className="brand" href="/" onClick={(e) => e.preventDefault()}>
            <img src="/lufy-icon.png" alt="" />
            <div className="brand-text">
              <strong>Sapiens Campus</strong>
              <span>Admin · Explore ✦ Evelve ✦ Engineer</span>
            </div>
          </a>

          <div className="user-chip" title={user.email}>
            {user.photoURL ? (
              <img src={user.photoURL} alt="" referrerPolicy="no-referrer" />
            ) : (
              <span className="avatar">{initial}</span>
            )}
            <div className="meta">
              <strong>{user.displayName || user.email}</strong>
              <span>Allowlisted</span>
            </div>
          </div>

          <button
            type="button"
            className="btn sm dark top-signout"
            onClick={() => signOut(auth)}
          >
            Sign out
          </button>

          <button
            type="button"
            className="nav-toggle"
            aria-label="Toggle menu"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((v) => !v)}
          >
            <span className="burger" />
          </button>
        </div>

        <nav className="side-nav side-nav-mobile" aria-label="Mobile">
          <NavItem
            id="waitlist"
            label="Waitlist"
            code="01"
            active={tab === 'waitlist'}
            onClick={switchTab}
          />
          <NavItem
            id="questions"
            label="Questions"
            code="02"
            active={tab === 'questions'}
            onClick={switchTab}
          />
          <button
            type="button"
            className="btn sm block mobile-signout"
            onClick={() => signOut(auth)}
          >
            Sign out
          </button>
        </nav>
      </header>

      <div className="layout">
        <aside className="sidebar">
          <nav className="side-nav" aria-label="Admin">
            <NavItem
              id="waitlist"
              label="Waitlist"
              code="01"
              active={tab === 'waitlist'}
              onClick={switchTab}
            />
            <NavItem
              id="questions"
              label="Questions"
              code="02"
              active={tab === 'questions'}
              onClick={switchTab}
            />
          </nav>
        </aside>

        <main className="main">
          <div className="page-head">
            <div>
              <p className="mono">
                {tab === 'waitlist' ? 'Students' : 'RIASEC pack'}
              </p>
              <h1>{tab === 'waitlist' ? 'Waitlist' : 'Questions'}</h1>
              <p>
                {tab === 'waitlist'
                  ? 'Everyone who joined the campus waitlist — emails, scores, and answer status.'
                  : 'Create, edit, import and export the question pack that powers Evelve.'}
              </p>
            </div>
            <span className={`sticker${tab === 'questions' ? ' mint' : ''}`}>
              {tab === 'waitlist' ? 'Live list ✳' : 'Pack editor ✳'}
            </span>
          </div>

          <Flash ok={message} err={error} />

          {tab === 'waitlist' && (
            <>
              <div className="stats">
                <div className="stat">
                  <span className="label">Total</span>
                  <strong>{waitlist.length}</strong>
                  <span>on the waitlist</span>
                </div>
                <div className="stat mint">
                  <span className="label">Answered</span>
                  <strong>{waitlistWithAnswers}</strong>
                  <span>finished the quiz</span>
                </div>
                <div className="stat sky">
                  <span className="label">Pending</span>
                  <strong>{waitlist.length - waitlistWithAnswers}</strong>
                  <span>still exploring</span>
                </div>
              </div>

              <Window title={`Waitlisted students · ${waitlist.length}`}>
                {waitlist.length === 0 ? (
                  <div className="empty">
                    <strong>Nobody here yet</strong>
                    <p className="muted">Fresh waitlist. Check back after the next push.</p>
                  </div>
                ) : (
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
                            <td className="email">{row.email}</td>
                            <td>
                              {row.createdAt
                                ? new Date(row.createdAt).toLocaleString()
                                : '—'}
                            </td>
                            <td>
                              {row.scores ? (
                                <div className="score-chips">
                                  {Object.entries(row.scores).map(([k, v]) => (
                                    <span
                                      key={k}
                                      className={`tag ${AREA_COLORS[k] || ''}`}
                                    >
                                      {k}:{v}
                                    </span>
                                  ))}
                                </div>
                              ) : (
                                '—'
                              )}
                            </td>
                            <td>
                              <span
                                className={`tag ${row.hasAnswers ? 'mint' : 'peach'}`}
                              >
                                {row.hasAnswers ? 'Yes' : 'No'}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </Window>
            </>
          )}

          {tab === 'questions' && (
            <>
              <div className="stats">
                <div className="stat">
                  <span className="label">In pack</span>
                  <strong>{pack?.questions?.length || 0}</strong>
                  <span>total questions</span>
                </div>
                <div className="stat mint">
                  <span className="label">Active</span>
                  <strong>{activeQuestions}</strong>
                  <span>live in product</span>
                </div>
                <div className="stat lilac">
                  <span className="label">Mode</span>
                  <strong style={{ fontSize: '22px' }}>
                    {!formOpen ? 'Browse' : editingId ? 'Edit' : 'Create'}
                  </strong>
                  <span>
                    {!formOpen
                      ? 'list view'
                      : editingId || 'new question'}
                  </span>
                </div>
              </div>

              <Window title="Import · Export">
                <div className="actions-bar">
                  {!formOpen && (
                    <button type="button" className="btn dark sm" onClick={startCreate}>
                      Create question
                    </button>
                  )}
                  <button type="button" className="btn sm" onClick={onExport}>
                    Export JSON
                  </button>
                  <label className="btn sm file-btn">
                    Import JSON
                    <input
                      type="file"
                      accept="application/json,.json"
                      onChange={onImport}
                    />
                  </label>
                  <a className="btn sm ghost" href="/questions.template.json" download>
                    Download template
                  </a>
                </div>
              </Window>

              {formOpen && (
                <Window title={editingId ? `Edit · ${editingId}` : 'Create question'}>
                  <form className="grid two" onSubmit={saveQuestion}>
                    <label className="field">
                      <span>ID</span>
                      <input
                        value={form.id}
                        disabled={Boolean(editingId)}
                        onChange={(e) => setForm({ ...form, id: e.target.value })}
                        required
                        placeholder="R1"
                        autoFocus
                      />
                    </label>
                    <label className="field">
                      <span>Area</span>
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
                    <label className="field wide">
                      <span>Title</span>
                      <input
                        value={form.title}
                        onChange={(e) => setForm({ ...form, title: e.target.value })}
                        required
                      />
                    </label>
                    <label className="field wide">
                      <span>Cue</span>
                      <input
                        value={form.cue}
                        onChange={(e) => setForm({ ...form, cue: e.target.value })}
                      />
                    </label>
                    <label className="field">
                      <span>Icon</span>
                      <input
                        value={form.icon}
                        onChange={(e) => setForm({ ...form, icon: e.target.value })}
                      />
                    </label>
                    <label className="field">
                      <span>Scene</span>
                      <input
                        value={form.scene}
                        onChange={(e) => setForm({ ...form, scene: e.target.value })}
                      />
                    </label>
                    <label className="field">
                      <span>Sort order</span>
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
                        onChange={(e) =>
                          setForm({ ...form, active: e.target.checked })
                        }
                      />
                      Active in pack
                    </label>
                    <div className="wide row">
                      <button disabled={busy} type="submit" className="btn dark">
                        {editingId ? 'Update question' : 'Create question'}
                      </button>
                      <button type="button" className="btn" onClick={closeForm}>
                        Cancel
                      </button>
                    </div>
                  </form>
                </Window>
              )}

              <Window title={`Questions · ${pack?.questions?.length || 0}`}>
                {(pack?.questions || []).length === 0 ? (
                  <div className="empty">
                    <strong>Empty pack</strong>
                    <p className="muted">Create a question or import a JSON pack.</p>
                    <button type="button" className="btn dark sm" onClick={startCreate}>
                      Create question
                    </button>
                  </div>
                ) : (
                  <div className="table-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th>ID</th>
                          <th>Area</th>
                          <th>Title</th>
                          <th>Active</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(pack?.questions || []).map((q) => (
                          <tr key={q.id}>
                            <td>
                              <span className="tag yellove">{q.id}</span>
                            </td>
                            <td>
                              <span className={`tag ${AREA_COLORS[q.area] || ''}`}>
                                {q.area}
                              </span>
                            </td>
                            <td>{q.title}</td>
                            <td>
                              <span
                                className={`tag ${
                                  q.active === false ? 'peach' : 'mint'
                                }`}
                              >
                                {q.active === false ? 'Off' : 'On'}
                              </span>
                            </td>
                            <td>
                              <div className="row">
                                <button
                                  type="button"
                                  className="btn sm"
                                  onClick={() => startEdit(q)}
                                >
                                  Edit
                                </button>
                                <button
                                  type="button"
                                  className="btn sm danger"
                                  onClick={() => onDelete(q.id)}
                                >
                                  Delete
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </Window>
            </>
          )}
        </main>
      </div>
    </div>
  )
}
