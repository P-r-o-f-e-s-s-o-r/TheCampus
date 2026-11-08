import { useEffect, useState } from 'react'
import { getRoadmapCatalog, reconcileRoadmaps } from './api'

export default function RoadmapAdmin() {
  const [report, setReport] = useState(null)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let alive = true
    getRoadmapCatalog()
      .then((data) => {
        if (alive) setReport(data)
      })
      .catch((err) => {
        if (alive) setError(err.message)
      })
    return () => {
      alive = false
    }
  }, [])

  async function onReconcile() {
    setBusy(true)
    setError('')
    setMessage('')
    try {
      const result = await reconcileRoadmaps()
      setMessage(
        result.repaired?.length
          ? `Repaired counts for ${result.repaired.join(', ')}.`
          : 'Counts already matched enrolments.'
      )
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="window">
      <div className="window-bar">
        <div className="window-dots" aria-hidden="true">
          <i />
          <i />
          <i />
        </div>
        <div className="title">Published discovery trails</div>
      </div>
      <div className="window-body stack">
        <p className="muted">
          Trails are versioned in source control. This screen checks the published catalog. It cannot read student notes, evidence, or private progress.
        </p>
        {error && <p role="alert">{error}</p>}
        {message && <p role="status">{message}</p>}
        {report && (
          <>
            <p>
              <strong>{report.status}</strong> · {report.contentVersion}
              {report.editorialStatus ? ` · seed label ${report.editorialStatus}` : ''}
            </p>
            <p>{report.noteAccess}</p>
            <ul>
              {(report.roles || []).map((role) => (
                <li key={`${role.id}-${role.version}`}>
                  {role.title} · {role.avatar} · version {role.version} · {role.steps} steps
                </li>
              ))}
            </ul>
          </>
        )}
        <button type="button" className="btn dark sm" disabled={busy} onClick={onReconcile}>
          {busy ? 'Checking…' : 'Recompute anonymous counts'}
        </button>
      </div>
    </section>
  )
}
