import { useEffect, useMemo, useState } from 'react'
import { fetchQuestions, joinWaitlist } from './lib/api'
import { buildProfile, createOrder, scoreAnswers } from './lib/scoring'
import './App.css'

const STORAGE_KEY = 'sapiens-campus-discovery-v2'

function loadState() {
  try {
    return JSON.parse(sessionStorage.getItem(STORAGE_KEY) || 'null')
  } catch {
    return null
  }
}

export default function App() {
  const [pack, setPack] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState('landing')
  const [order, setOrder] = useState([])
  const [index, setIndex] = useState(0)
  const [answers, setAnswers] = useState({})
  const [email, setEmail] = useState('')
  const [waitlistStatus, setWaitlistStatus] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    fetchQuestions()
      .then((data) => {
        setPack(data)
        const saved = loadState()
        if (saved?.order?.length && saved.answers) {
          setOrder(saved.order)
          setAnswers(saved.answers)
          setIndex(saved.index || 0)
          setView(saved.view || 'landing')
        }
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (!order.length) return
    sessionStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ view, order, index, answers })
    )
  }, [view, order, index, answers])

  const byId = useMemo(() => {
    if (!pack) return {}
    return Object.fromEntries(pack.questions.map((q) => [q.id, q]))
  }, [pack])

  const current = byId[order[index]]
  const scores = useMemo(() => {
    if (!pack || Object.keys(answers).length < pack.questions.length) return null
    return scoreAnswers(pack.questions, answers)
  }, [pack, answers])

  const profile = useMemo(() => {
    if (!scores || !pack) return null
    return buildProfile(scores, pack.areas, pack.pairs)
  }, [scores, pack])

  function startQuiz() {
    const nextOrder = createOrder(pack.questions)
    setOrder(nextOrder)
    setAnswers({})
    setIndex(0)
    setView('quiz')
  }

  function answer(value) {
    if (!current) return
    const next = { ...answers, [current.id]: value }
    setAnswers(next)
    if (index >= order.length - 1) {
      setView('results')
      return
    }
    setIndex((i) => i + 1)
  }

  async function onWaitlist(e) {
    e.preventDefault()
    setSubmitting(true)
    setWaitlistStatus('')
    try {
      await joinWaitlist({
        email,
        consent: true,
        company: e.target.company.value,
        answers,
        scores,
      })
      setWaitlistStatus('You’re on the waitlist. We’ll be in touch.')
    } catch (err) {
      setWaitlistStatus(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="shell">
        <p className="muted">Loading discovery…</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="shell">
        <h1>Couldn’t load questions</h1>
        <p className="muted">{error}</p>
      </div>
    )
  }

  return (
    <div className="shell">
      <header className="top">
        <strong>SapiensCampus.</strong>
        <span>Explore yourself</span>
      </header>

      {view === 'landing' && (
        <section className="panel hero">
          <p className="eyebrow">A campus for your kind of curious</p>
          <h1>Your campus. Without the limits.</h1>
          <p>
            Find what makes you, you. About 2 minutes. Free to explore. No email
            needed for results.
          </p>
          <button className="btn dark" onClick={() => setView('intro')}>
            Click me to discover yourself
          </button>
        </section>
      )}

      {view === 'intro' && (
        <section className="panel">
          <button className="link" onClick={() => setView('landing')}>
            ← Back to campus
          </button>
          <h1>2 minutes. A little more you.</h1>
          <p>
            {pack.questions.length} short activity prompts. Three gut reactions.
            Results stay in this browser until you join the waitlist.
          </p>
          <button className="btn dark" onClick={startQuiz}>
            Let’s do this
          </button>
        </section>
      )}

      {view === 'quiz' && current && (
        <section className="panel quiz">
          <div className="meta">
            <span>
              ROUND {Math.floor(index / 6) + 1} / {Math.ceil(order.length / 6)}
            </span>
            <span>
              {Object.keys(answers).length} / {order.length} explored
            </span>
          </div>
          <p className="eyebrow">{current.scene}</p>
          <h1>{current.title}</h1>
          <p className="muted">{current.cue}</p>
          <div className="reactions">
            {(pack.anchors || []).map((a) => (
              <button
                key={a.value}
                className={`reaction ${a.color || ''}`}
                onClick={() => answer(a.value)}
              >
                <strong>{a.label}</strong>
                <span>{a.detail}</span>
              </button>
            ))}
          </div>
          <div className="row">
            <button
              className="link"
              disabled={index === 0}
              onClick={() => setIndex((i) => Math.max(0, i - 1))}
            >
              ← Back
            </button>
          </div>
        </section>
      )}

      {view === 'results' && profile && (
        <section className="panel">
          <p className="eyebrow">Your possible persona</p>
          <h1>{profile.title}</h1>
          <p>{profile.description}</p>
          <p className="code">{profile.code}</p>
          <div className="bars">
            {Object.entries(profile.scores).map(([k, v]) => (
              <div key={k} className="bar-row">
                <span>{pack.areas[k]?.name || k}</span>
                <div className="bar">
                  <i style={{ width: `${(v / 10) * 100}%` }} />
                </div>
                <strong>{v}</strong>
              </div>
            ))}
          </div>
          <button className="btn dark" onClick={() => setView('waitlist')}>
            Join waitlist
          </button>
          <button
            className="link"
            onClick={() => {
              sessionStorage.removeItem(STORAGE_KEY)
              setAnswers({})
              setOrder([])
              setView('landing')
            }}
          >
            Start again
          </button>
        </section>
      )}

      {view === 'waitlist' && (
        <section className="panel">
          <button className="link" onClick={() => setView('results')}>
            ← Back to results
          </button>
          <h1>Stay in the loop</h1>
          <p className="muted">
            Optional. We’ll only use your email to share what’s next on campus.
          </p>
          <form className="form" onSubmit={onWaitlist}>
            <label>
              Email
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@college.edu"
              />
            </label>
            <input
              className="hp"
              name="company"
              tabIndex={-1}
              autoComplete="off"
              aria-hidden="true"
            />
            <button className="btn dark" disabled={submitting}>
              {submitting ? 'Joining…' : 'Join waitlist'}
            </button>
          </form>
          {waitlistStatus && <p className="status">{waitlistStatus}</p>}
        </section>
      )}
    </div>
  )
}
