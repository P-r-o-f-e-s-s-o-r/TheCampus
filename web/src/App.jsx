import { useEffect, useMemo, useState } from 'react'
import { fetchQuestions, joinWaitlist } from './lib/api'
import {
  QUIZ_LENGTH,
  QUESTIONS_PER_AREA,
  RIASEC_KEYS,
  buildProfile,
  selectQuizQuestions,
  scoreAnswers,
} from './lib/scoring'
import './App.css'

const STORAGE_KEY = 'sapiens-campus-discovery-v3'

const COACH = [
  'No right answers. Just your first reaction.',
  'Tap a feeling. The next card appears automatically.',
  'Choose for your interest, not your experience.',
  '“Maybe” is a good answer.',
  'Imagine trying it — not being good at it.',
]

function loadState() {
  try {
    return JSON.parse(sessionStorage.getItem(STORAGE_KEY) || 'null')
  } catch {
    return null
  }
}

function Header({ note = true }) {
  return (
    <header className="site-header">
      <div className="nav-wrap">
        <a className="brand" href="/" onClick={(e) => e.preventDefault()}>
          <img src="/lufy-icon.png" alt="" />
          <span>
            SapiensCampus<span aria-hidden="true">.</span>
          </span>
        </a>
        {note && (
          <span className="header-note">
            A campus for your kind of curious <span aria-hidden="true">✳</span>
          </span>
        )}
      </div>
    </header>
  )
}

function Footer() {
  return (
    <footer className="site-footer">
      <span>Explore. Evelve. Engineer.</span>
      <span>
        Made for the life beyond class. <span className="y" aria-hidden="true">✳</span>
      </span>
    </footer>
  )
}

function Progress({ answered, total }) {
  const rounds = Math.ceil(total / RIASEC_KEYS.length) || 5
  const perRound = RIASEC_KEYS.length
  const currentRound = Math.min(rounds, Math.floor(answered / perRound) + (answered < total ? 1 : rounds))

  return (
    <>
      <div className="progress-caption">
        <span>
          Round {currentRound} / {rounds}
        </span>
        <span>
          {answered} / {total} explored
        </span>
      </div>
      <div
        className="round-progress"
        role="progressbar"
        aria-label="Activities explored"
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={answered}
      >
        {Array.from({ length: rounds }, (_, i) => {
          const start = i * perRound
          const inRound = Math.max(0, Math.min(perRound, answered - start))
          const pct = (inRound / perRound) * 100
          return (
            <i key={i}>
              <b style={{ width: `${pct}%` }} />
            </i>
          )
        })}
      </div>
    </>
  )
}

export default function App() {
  const [pack, setPack] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState('landing')
  const [quiz, setQuiz] = useState([])
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
        if (saved?.quiz?.length === QUIZ_LENGTH && saved.answers) {
          const ids = new Set((data.questions || []).map((q) => q.id))
          const stillValid = saved.quiz.every((q) => ids.has(q.id))
          if (stillValid) {
            setQuiz(saved.quiz)
            setAnswers(saved.answers)
            setIndex(Math.min(saved.index || 0, QUIZ_LENGTH - 1))
            setView(saved.view || 'landing')
          }
        }
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (!quiz.length) return
    sessionStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ view, quiz, index, answers })
    )
  }, [view, quiz, index, answers])

  const current = quiz[index]
  const answeredCount = Object.keys(answers).length

  const scores = useMemo(() => {
    if (!quiz.length || answeredCount < quiz.length) return null
    return scoreAnswers(quiz, answers)
  }, [quiz, answers, answeredCount])

  const profile = useMemo(() => {
    if (!scores || !pack) return null
    return buildProfile(scores, pack.areas || {}, pack.pairs || {})
  }, [scores, pack])

  function startQuiz() {
    try {
      const next = selectQuizQuestions(pack.questions)
      if (next.length !== QUIZ_LENGTH) {
        throw new Error(`Expected ${QUIZ_LENGTH} questions, got ${next.length}.`)
      }
      setQuiz(next)
      setAnswers({})
      setIndex(0)
      setView('quiz')
      setError('')
    } catch (err) {
      setError(err.message)
      setView('landing')
    }
  }

  function answer(value) {
    if (!current) return
    const next = { ...answers, [current.id]: value }
    setAnswers(next)
    if (index >= quiz.length - 1) {
      setView('results')
      return
    }
    setIndex((i) => i + 1)
  }

  function goBack() {
    if (index === 0) {
      setView('intro')
      return
    }
    setIndex((i) => Math.max(0, i - 1))
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

  function restart() {
    sessionStorage.removeItem(STORAGE_KEY)
    setAnswers({})
    setQuiz([])
    setIndex(0)
    setWaitlistStatus('')
    setEmail('')
    setView('landing')
  }

  if (loading) {
    return (
      <div className="boot">
        <div className="pulse" aria-hidden="true" />
        <p className="mono">Loading discovery</p>
        <h2>Hang tight…</h2>
      </div>
    )
  }

  if (error && !pack) {
    return (
      <div className="err-screen">
        <Header note={false} />
        <h1>Couldn’t load questions</h1>
        <p className="muted">{error}</p>
      </div>
    )
  }

  return (
    <div className="app">
      <Header />

      {error && view !== 'quiz' && (
        <div className="wrap" style={{ paddingTop: 16 }}>
          <p className="status" role="alert">
            {error}
          </p>
        </div>
      )}

      {view === 'landing' && (
        <>
          <section className="hero-band">
            <div className="wrap hero">
              <div>
                <p className="eyebrow">
                  <span className="star" aria-hidden="true">
                    ✳
                  </span>
                  Your digital campus, beyond college
                </p>
                <h1>
                  Your campus.
                  <br />
                  Without
                  <br />
                  the <span className="hl">limits.</span>
                </h1>
                <p className="hero-desc">
                  Find what makes you, <em>you.</em> Meet your people across
                  colleges. Build the things you wish existed.
                </p>
                <div className="hero-actions">
                  <button
                    type="button"
                    className="btn dark lg"
                    onClick={() => setView('intro')}
                  >
                    Click me to discover yourself ✳
                  </button>
                </div>
                <div className="hero-footnote">
                  <span className="faces" aria-hidden="true">
                    <i>:)</i>
                    <i>:D</i>
                    <i>;)</i>
                  </span>
                  <span>
                    About 2 minutes. A little more you.
                    <br />
                    <strong>Free to explore. No email needed for results.</strong>
                  </span>
                </div>
              </div>

              <div className="campus-visual">
                <div className="campus-window">
                  <div className="window-bar">
                    <span className="dots" aria-hidden="true">
                      <i />
                      <i />
                      <i />
                    </span>
                    <span>Campus.exe</span>
                    <span aria-hidden="true">✳</span>
                  </div>
                  <div className="campus-map">
                    <button
                      type="button"
                      className="map-card"
                      onClick={() => setView('intro')}
                    >
                      <span className="top">
                        <span>01</span>
                        <span>→</span>
                      </span>
                      <strong>Explore</strong>
                      <span>Find your kind of curious.</span>
                    </button>
                    <div className="map-card">
                      <span className="top">
                        <span>02</span>
                        <span className="soon">Next up</span>
                      </span>
                      <strong>Evelve</strong>
                      <span>Good people. New perspectives.</span>
                    </div>
                    <div className="map-card">
                      <span className="top">
                        <span>03</span>
                        <span className="soon">Next up</span>
                      </span>
                      <strong>Engineer</strong>
                      <span>Small starts. Real things.</span>
                    </div>
                  </div>
                  <div className="window-status">
                    Your journey starts with exploring.
                  </div>
                </div>
                <div className="sticker" aria-hidden="true">
                  Come as
                  <br />
                  you are.
                  <small>✳ ✳ ✳</small>
                </div>
              </div>
            </div>
          </section>
          <div className="manifesto" aria-label="Explore. Evelve. Engineer.">
            <div>
              <span>Explore yourself</span>
              <b aria-hidden="true">✳</b>
              <span>Evelve together</span>
              <b aria-hidden="true">✳</b>
              <span>Engineer the new</span>
              <b aria-hidden="true">✳</b>
            </div>
          </div>
        </>
      )}

      {view === 'intro' && (
        <section className="screen dots-bg">
          <div className="wrap intro-grid">
            <div className="intro-copy">
              <button
                type="button"
                className="linkish"
                onClick={() => setView('landing')}
              >
                ← Back to campus
              </button>
              <p className="eyebrow">01 / Explore yourself</p>
              <h1>
                2 minutes.
                <br />
                A little
                <br />
                <span className="intro-hl">more you.</span>
              </h1>
              <p className="muted" style={{ marginBottom: 12, maxWidth: '36ch' }}>
                A few tiny choices can open up a whole new conversation with
                yourself.
              </p>
              <p className="muted" style={{ fontSize: 13, marginBottom: 18 }}>
                About 2 minutes. No timer. Go at your own pace.
              </p>
              <button type="button" className="btn dark lg" onClick={startQuiz}>
                Let’s do this →
              </button>
              <p className="intro-meta">
                {QUIZ_LENGTH} short activity prompts · {QUESTIONS_PER_AREA} little
                rounds
              </p>
              <p className="privacy">
                <span aria-hidden="true">🔒</span>
                Your results come first. Email is optional, later.
              </p>
            </div>

            <div className="guide">
              <div className="window-bar">
                <span className="dots" aria-hidden="true">
                  <i />
                  <i />
                  <i />
                </span>
                <span>You.discover</span>
                <span aria-hidden="true">✳</span>
              </div>
              <div className="guide-body">
                <span className="guide-sticker" aria-hidden="true">
                  No grades.
                  <br />
                  Just you.
                </span>
                <h2>
                  A gut feeling.
                  <br />
                  A single tap.
                  <br />
                  On to the next.
                </h2>
                <div className="tip">
                  <span className="n">01</span>
                  <p>
                    <strong>Imagine trying it.</strong>
                    Not being good at it. No experience needed.
                  </p>
                </div>
                <div className="tip">
                  <span className="n">02</span>
                  <p>
                    <strong>Pick what feels like you.</strong>
                    Not what sounds impressive to someone else.
                  </p>
                </div>
                <div className="tip">
                  <span className="n">03</span>
                  <p>
                    <strong>“Maybe” is a good answer.</strong>
                    You can go back and change any choice.
                  </p>
                </div>
              </div>
              <div className="guide-foot">
                A starting point, not a box to fit into.
              </div>
            </div>
          </div>
        </section>
      )}

      {view === 'quiz' && current && (
        <section className="screen dots-bg">
          <div className="quiz-wrap">
            <div className="quiz-nav">
              <button type="button" className="linkish" onClick={goBack}>
                ← Back
              </button>
              <span className="mono" style={{ fontSize: 10 }}>
                Your interest mix
              </span>
              <button
                type="button"
                className="linkish"
                onClick={() => setView('intro')}
              >
                Pause
              </button>
            </div>

            <Progress answered={answeredCount} total={quiz.length} />

            <div className="coach">
              <span className="face" aria-hidden="true">
                :)
              </span>
              <p>{COACH[index % COACH.length]}</p>
            </div>

            <div className="q-stack">
              <article className="q-card">
                <div className="q-top">
                  <span>Would you enjoy this?</span>
                  <span>
                    {String(index + 1).padStart(2, '0')} / {quiz.length}
                  </span>
                </div>
                <div className="q-body">
                  <div className="q-icon" aria-hidden="true">
                    {(current.area || '?').slice(0, 1)}
                  </div>
                  {current.scene && <p className="scene">{current.scene}</p>}
                  <h1>{current.title}</h1>
                  {current.cue && <p className="cue">{current.cue}</p>}
                </div>
              </article>
            </div>

            <div className="reactions" role="group" aria-label="Your reaction">
              {(pack.anchors || []).map((a) => (
                <button
                  key={a.value}
                  type="button"
                  className={`reaction ${a.color || ''}`}
                  onClick={() => answer(a.value)}
                >
                  <strong>{a.label}</strong>
                  <span>{a.detail}</span>
                </button>
              ))}
            </div>
            <p className="quiz-hint">
              Tap a feeling. The next card appears automatically.
            </p>
          </div>
        </section>
      )}

      {view === 'results' && profile && (
        <section className="results">
          <div className="wrap">
            <p className="mono" style={{ fontSize: 11, paddingTop: 28 }}>
              ✳ Explore / complete · {quiz.length} little choices
            </p>

            <div className="result-top">
              <div className={`passport ${profile.color || 'cream'}`}>
                <div className="pass-top">
                  <span>Your interest passport</span>
                  <span aria-hidden="true">✳</span>
                </div>
                <div className="pass-art">
                  <img src="/lufy-icon.png" alt="" />
                </div>
                <div className="pass-letters">
                  {(profile.areas?.length
                    ? profile.areas
                    : profile.sorted.slice(0, 3)
                  ).map((k) => (
                    <span key={k}>{k}</span>
                  ))}
                </div>
                <p>
                  Not a label.
                  <br />
                  <strong>A starting point.</strong>
                </p>
                <div className="pass-bottom">
                  <span>SapiensCampus</span>
                  <span>Explore / 001</span>
                </div>
              </div>

              <div className="result-copy">
                <p className="eyebrow">Your possible persona</p>
                <h1>{profile.title}</h1>
                <p className="desc">{profile.description}</p>
                {profile.directions?.length > 0 && (
                  <>
                    <p className="dir-label">A few directions to try</p>
                    <div className="tags">
                      {profile.directions.map((d) => (
                        <span key={d} className="tag">
                          {d}
                        </span>
                      ))}
                    </div>
                  </>
                )}
                <div className="result-actions">
                  <button
                    type="button"
                    className="btn dark"
                    onClick={() =>
                      document
                        .getElementById('waitlist')
                        ?.scrollIntoView({ behavior: 'smooth' })
                    }
                  >
                    Join waitlist →
                  </button>
                  <button type="button" className="linkish" onClick={restart}>
                    Start again
                  </button>
                </div>
              </div>
            </div>

            <div className="result-grid">
              <section className="mix-panel">
                <p className="eyebrow">Six ways to be curious</p>
                <h2>Your RIASEC mix.</h2>
                <p className="muted" style={{ fontSize: 13 }}>
                  Your activity ratings. Not grades.
                </p>
                <div className="bars">
                  {RIASEC_KEYS.map((k) => {
                    const v = profile.scores[k] || 0
                    const area = pack.areas?.[k]
                    return (
                      <div key={k} className="bar-row">
                        <span className="bar-letter">{k}</span>
                        <div>
                          <div className="bar-meta">
                            <span>
                              {area?.name || k}{' '}
                              <small>{area?.short || ''}</small>
                            </span>
                          </div>
                          <div className="bar-track">
                            <i
                              className="bar-fill"
                              style={{ width: `${(v / 10) * 100}%` }}
                            />
                          </div>
                        </div>
                        <span className="bar-val">{v}</span>
                      </div>
                    )
                  })}
                </div>
                <p className="dir-label">Leading interest pattern</p>
                <p className="code">{profile.code}</p>
              </section>

              <section className="exp-panel">
                <p className="eyebrow">Beyond the result</p>
                <h2>
                  Try it.
                  <br />
                  See how it feels.
                </h2>
                <p className="muted" style={{ fontSize: 13, marginTop: 8 }}>
                  Small experiments, not big commitments.
                </p>
                <div className="tags" style={{ marginTop: 16 }}>
                  {(profile.directions || []).map((d) => (
                    <span key={d} className="tag">
                      {d}
                    </span>
                  ))}
                </div>
              </section>
            </div>

            <section className="waitlist" id="waitlist">
              <div>
                <p className="eyebrow">02 / Your next chapter: Evelve</p>
                <h2 style={{ fontSize: 'clamp(28px, 5vw, 36px)', margin: '8px 0 12px' }}>
                  Found a little more you?
                  <br />
                  Now find your people.
                </h2>
                <p className="muted" style={{ fontSize: 14, maxWidth: '48ch' }}>
                  We’re building SapiensCampus to connect you with peers across
                  colleges — so you can evelve together, learn with fun and build
                  what’s next.
                </p>
              </div>
              <form className="waitlist-form" onSubmit={onWaitlist}>
                <label>
                  <span>Your next chapter. In your inbox.</span>
                  <p className="muted" style={{ fontSize: 13, marginBottom: 10 }}>
                    Join the SapiensCampus waitlist.
                  </p>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@college.edu"
                    autoComplete="email"
                  />
                </label>
                <input
                  className="hp"
                  name="company"
                  tabIndex={-1}
                  autoComplete="off"
                  aria-hidden="true"
                />
                <button className="btn dark block" disabled={submitting}>
                  {submitting ? 'Joining…' : 'Join waitlist →'}
                </button>
                {waitlistStatus && <p className="status">{waitlistStatus}</p>}
              </form>
            </section>
          </div>
        </section>
      )}

      {view === 'landing' || view === 'results' ? <Footer /> : null}
    </div>
  )
}
