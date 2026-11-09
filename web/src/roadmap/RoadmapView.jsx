import { useEffect, useId, useRef, useState } from 'react'
import { avatarForRole } from '../lib/roleAvatars'
import {
  completeRoadmapStep,
  fetchMyRoadmap,
  fetchRoadmap,
  fetchRoadmapCounts,
  restartRoadmap,
  saveRoadmapChecklist,
  saveRoadmapNotes,
  startRoadmap,
  switchRoadmap,
  undoRoadmapStep,
} from '../lib/api'
import './roadmap.css'

const FIRST_STEP_NOTE =
  'Start small. Tick the list when you have tried it, then mark this step done. The next one unlocks. If the link will not open, use the task here.'

function newOp() {
  return crypto.randomUUID()
}

function stateLabel(state) {
  if (state === 'completed') return 'Done'
  if (state === 'available') return 'Current step'
  return 'Later step'
}

export default function RoadmapView({
  user,
  profile,
  roleId,
  stepId,
  onOpenStep,
  onCloseStep,
  onExit,
  onSelectedRole,
  onChangeRole,
}) {
  const titleId = useId()
  const dialogRef = useRef(null)
  const confirmRef = useRef(null)
  const openerRef = useRef(null)
  const noteTimer = useRef(null)
  const checkTimer = useRef(null)
  const completeOp = useRef('')
  const draftDirty = useRef(false)
  const [pack, setPack] = useState(null)
  const [counts, setCounts] = useState(null)
  const [countsState, setCountsState] = useState('loading')
  const [mine, setMine] = useState(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [actionError, setActionError] = useState('')
  const [busy, setBusy] = useState(false)
  const [checks, setChecks] = useState({})
  const [revision, setRevision] = useState(0)
  const [noteText, setNoteText] = useState('')
  const [evidence, setEvidence] = useState('')
  const [noteRevision, setNoteRevision] = useState(0)
  const [noteStatus, setNoteStatus] = useState('')
  const [checkStatus, setCheckStatus] = useState('')
  const [savedBanner, setSavedBanner] = useState(null)
  const [confirm, setConfirm] = useState(null)
  const [conflict, setConflict] = useState(null)
  const [offline, setOffline] = useState(typeof navigator !== 'undefined' ? !navigator.onLine : false)

  const role = pack?.role || null
  const trail = (mine?.trails || []).find(
    (item) => item.roleId === role?.id && item.version === role?.version && !item.missingContent
  )
  const step = role?.steps?.find((item) => item.id === stepId) || null
  const stepProgress = trail?.steps?.find((item) => item.id === step?.id)
  const previewStates = role
    ? role.steps.map((item, index) => ({
        id: item.id,
        state: index === 0 ? 'available' : 'locked',
        checklist: {},
      }))
    : []
  const progressSteps = trail?.steps || previewStates
  const enrolled = Boolean(user && trail)
  const activeHere = Boolean(trail?.active)
  const suggested = (profile?.roles || []).some((item) => item.id === roleId)
  const selectedMatches = profile?.selectedRole?.id === roleId

  useEffect(() => {
    function sync() {
      setOffline(!navigator.onLine)
    }
    window.addEventListener('online', sync)
    window.addEventListener('offline', sync)
    return () => {
      window.removeEventListener('online', sync)
      window.removeEventListener('offline', sync)
    }
  }, [])

  useEffect(() => {
    let alive = true
    async function load() {
      setLoading(true)
      setLoadError('')
      setCountsState('loading')
      try {
        // Owner progress + published trail content in parallel (latest version first).
        const ownerPromise = user ? fetchMyRoadmap() : Promise.resolve(null)
        const latestPromise = fetchRoadmap(roleId)
        const [owner, latest] = await Promise.all([ownerPromise, latestPromise])
        if (!alive) return

        setMine(owner)
        const saved = (owner?.trails || []).filter(
          (item) => item.roleId === roleId && !item.missingContent
        )
        const preferred = saved.find((item) => item.active) || saved[saved.length - 1]
        let data = latest
        if (preferred?.version && preferred.version !== latest?.role?.version) {
          data = await fetchRoadmap(roleId, preferred.version)
          if (!alive) return
        }
        setPack(data)

        try {
          const nextCounts = await fetchRoadmapCounts(roleId, data.role.version)
          if (!alive) return
          setCounts(nextCounts)
          setCountsState('ready')
        } catch (err) {
          if (!alive) return
          setCounts(null)
          setCountsState(
            err.code === 'counts_unavailable' || err.status === 503 ? 'unavailable' : 'unavailable'
          )
        }
      } catch (err) {
        if (!alive) return
        setPack(null)
        setLoadError(err.message || 'This trail could not be loaded.')
        setCountsState('unavailable')
      } finally {
        if (alive) setLoading(false)
      }
    }
    load()
    return () => {
      alive = false
    }
  }, [roleId, user])

  useEffect(() => {
    if (!role || !step) return
    draftDirty.current = false
    const serverNotes = trail?.notes?.[step.id] || { text: '', evidence: '', revision: 0 }
    setNoteText(serverNotes.text || '')
    setEvidence(serverNotes.evidence || '')
    setNoteRevision(serverNotes.revision || 0)
    setNoteStatus(serverNotes.text || serverNotes.evidence ? 'Saved' : '')
    setConflict(null)
    setSavedBanner(null)
  }, [step?.id, trail?.attemptNo])

  useEffect(() => {
    if (!role || !step) return
    const serverChecks = stepProgress?.checklist || {}
    const next = {}
    step.checklist.forEach((_, index) => {
      next[String(index)] = Boolean(serverChecks[String(index)])
    })
    setChecks(next)
    setRevision(trail?.revision || 0)
  }, [step?.id, trail?.attemptNo, trail?.revision])

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return undefined
    if (step && role) {
      if (!dialog.open) dialog.showModal()
      const title = dialog.querySelector('#roadmap-step-title')
      title?.focus()
      return undefined
    }
    if (dialog.open) dialog.close()
    return undefined
  }, [step, role])

  useEffect(() => {
    const dialog = confirmRef.current
    if (!dialog) return undefined
    if (confirm) {
      if (!dialog.open) dialog.showModal()
      dialog.querySelector('button')?.focus()
      return undefined
    }
    if (dialog.open) dialog.close()
    return undefined
  }, [confirm])

  useEffect(() => {
    function warn(event) {
      if (!draftDirty.current && noteStatus !== 'Not saved' && noteStatus !== 'Saving') return
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [noteStatus])

  useEffect(() => () => {
    clearTimeout(noteTimer.current)
    clearTimeout(checkTimer.current)
  }, [])

  function closeStep() {
    const opener = openerRef.current
    onCloseStep()
    window.setTimeout(() => opener?.focus(), 0)
  }

  async function reloadMine(version = role?.version) {
    if (!user) return null
    const owner = await fetchMyRoadmap()
    setMine(owner)
    if (version) {
      try {
        const nextCounts = await fetchRoadmapCounts(roleId, version)
        setCounts(nextCounts)
        setCountsState('ready')
      } catch {
        setCounts(null)
        setCountsState('unavailable')
      }
    }
    const next = (owner.trails || []).find((item) => item.roleId === roleId && item.version === version)
    if (next) setRevision(next.revision || 0)
    return owner
  }

  async function onStart() {
    setBusy(true)
    setActionError('')
    try {
      await startRoadmap({ roleId, opId: newOp() })
      await reloadMine(pack?.latestVersion || role?.version)
    } catch (err) {
      setActionError(err.message || 'Could not start this trail.')
    } finally {
      setBusy(false)
    }
  }

  async function onSwitch(nextRoleId, version) {
    setBusy(true)
    setActionError('')
    try {
      const result = await switchRoadmap({
        roleId: nextRoleId,
        version,
        opId: newOp(),
      })
      if (result.selectedRole) onSelectedRole(result.selectedRole)
      setConfirm(null)
      if (nextRoleId !== roleId) {
        onChangeRole?.(nextRoleId)
      } else {
        await reloadMine(version || role.version)
      }
    } catch (err) {
      setActionError(err.message || 'Could not switch trails.')
    } finally {
      setBusy(false)
    }
  }

  function scheduleChecks(nextChecks, nextRevision) {
    if (!activeHere || !step) return
    clearTimeout(checkTimer.current)
    setCheckStatus('Saving')
    checkTimer.current = setTimeout(async () => {
      if (offline) {
        setCheckStatus('Not saved')
        return
      }
      try {
        const saved = await saveRoadmapChecklist({
          opId: newOp(),
          roleId: role.id,
          version: role.version,
          stepId: step.id,
          expectedRevision: nextRevision,
          checklist: nextChecks,
        })
        setRevision(saved.revision)
        setCheckStatus('Saved')
      } catch (err) {
        setCheckStatus('Not saved')
        if (err.code === 'revision_conflict') {
          setActionError('This checklist changed in another session. Reload the step before editing it.')
        }
      }
    }, 500)
  }

  function toggleCheck(index) {
    if (stepProgress?.state === 'completed') return
    const key = String(index)
    const next = { ...checks, [key]: !checks[key] }
    setChecks(next)
    setSavedBanner(null)
    scheduleChecks(next, revision)
  }

  async function persistNotes(text, link, expected, opId = newOp()) {
    if (!enrolled || !step || !role) return
    if (offline) {
      setNoteStatus('Not saved')
      draftDirty.current = true
      return
    }
    setNoteStatus('Saving')
    try {
      const saved = await saveRoadmapNotes({
        opId,
        roleId: role.id,
        version: role.version,
        stepId: step.id,
        expectedRevision: expected,
        text,
        evidence: link,
      })
      draftDirty.current = false
      setNoteRevision(saved.revision)
      setNoteStatus(saved.unchanged ? 'Saved' : 'Saved')
      setConflict(null)
    } catch (err) {
      draftDirty.current = true
      setNoteStatus('Not saved')
      if (err.code === 'note_conflict') {
        setConflict(err.details?.server || null)
        return
      }
      setActionError(err.message || 'Notes were not saved.')
    }
  }

  function queueNotes(text, link) {
    draftDirty.current = true
    setNoteStatus(offline ? 'Not saved' : 'Saving')
    clearTimeout(noteTimer.current)
    const expected = noteRevision
    noteTimer.current = setTimeout(() => persistNotes(text, link, expected), 700)
  }

  async function retryNotes() {
    clearTimeout(noteTimer.current)
    await persistNotes(noteText, evidence, noteRevision)
  }

  async function markDone() {
    if (!step || !role) return
    const opId = completeOp.current || newOp()
    completeOp.current = opId
    clearTimeout(checkTimer.current)
    setBusy(true)
    setActionError('')
    try {
      const saved = await completeRoadmapStep({
        opId,
        roleId: role.id,
        version: role.version,
        stepId: step.id,
        expectedRevision: revision,
        checklist: checks,
      })
      completeOp.current = ''
      setRevision(saved.revision)
      setSavedBanner(
        saved.finishedTrail || saved.progress?.finished
          ? { finished: true }
          : { next: saved.next }
      )
      await reloadMine(role.version)
    } catch (err) {
      setActionError(err.message || 'This step was not saved.')
    } finally {
      setBusy(false)
    }
  }

  async function confirmUndo() {
    if (!confirm || confirm.type !== 'undo' || !step) return
    setBusy(true)
    setActionError('')
    try {
      const saved = await undoRoadmapStep({
        opId: newOp(),
        roleId: role.id,
        version: role.version,
        stepId: confirm.stepId,
        expectedRevision: revision,
      })
      setRevision(saved.revision)
      setConfirm(null)
      setSavedBanner(null)
      await reloadMine(role.version)
    } catch (err) {
      setActionError(err.message || 'Could not undo that step.')
    } finally {
      setBusy(false)
    }
  }

  async function confirmRestart() {
    setBusy(true)
    setActionError('')
    try {
      await restartRoadmap({
        opId: newOp(),
        roleId: role.id,
        version: role.version,
        expectedRevision: revision,
      })
      setConfirm(null)
      setSavedBanner(null)
      draftDirty.current = false
      await reloadMine(role.version)
    } catch (err) {
      setActionError(err.message || 'Could not restart this trail.')
    } finally {
      setBusy(false)
    }
  }

  const avatar = role ? avatarForRole({ id: role.id, name: role.title }) : null
  const doneCount = trail?.progress?.done || 0
  const totalCount = role?.steps?.length || 10
  const allChecked = step ? step.checklist.every((_, index) => checks[String(index)] === true) : false
  const stepState = stepProgress?.state || (step?.order === 1 ? 'available' : 'locked')
  let doneReason = ''
  if (!user) doneReason = 'This is a preview. Sign in and choose this role to save progress.'
  else if (!enrolled) doneReason = 'Start this trail to save progress. Looking around does not enrol you.'
  else if (!activeHere) doneReason = 'Make this the active trail before marking a step done.'
  else if (stepState === 'locked') doneReason = 'Finish the earlier steps to mark this one done. You can still read it.'
  else if (stepState === 'completed') doneReason = 'This step is already saved.'
  else if (!allChecked) doneReason = 'Tick every item after you try the task. This records your own completion, not a graded pass.'
  const canComplete = activeHere && stepState === 'available' && allChecked && !busy

  const otherRoles = (profile?.roles || []).filter((item) => item.id !== roleId)
  const groups = []
  for (const item of role?.steps || []) {
    const name = item.section || 'Trail'
    const last = groups[groups.length - 1]
    if (!last || last.name !== name) groups.push({ name, steps: [item] })
    else last.steps.push(item)
  }

  return (
    <section className="roadmap-screen" aria-labelledby={titleId}>
      <div className="roadmap-wrap">
        <button type="button" className="linkish" onClick={onExit}>
          ← Back
        </button>
        {loading && (
          <div className="roadmap-skeleton" aria-busy="true" aria-live="polite">
            <p>Loading trail</p>
            <span />
            <span />
            <span />
          </div>
        )}
        {!loading && loadError && (
          <div className="roadmap-panel" role="alert">
            <h1 id={titleId}>Trail unavailable</h1>
            <p>{loadError}</p>
            <button type="button" className="btn dark" onClick={() => window.location.reload()}>
              Try again
            </button>
          </div>
        )}
        {!loading && role && (
          <>
            <header className="roadmap-hero">
              {avatar && <img src={avatar.src} alt={avatar.alt} width="120" height="120" />}
              <div>
                <h1 id={titleId}>
                  {role.title} <span className="roadmap-animal">{role.avatar}</span>
                </h1>
                <p>{role.description}</p>
                <p className="roadmap-progress" aria-live="polite">
                  {enrolled ? `${doneCount} / ${totalCount} steps saved` : `Preview · ${totalCount} steps`}
                </p>
              </div>
            </header>

            {offline && (
              <p className="roadmap-banner" role="status">
                You are offline. You can read this page, but progress and notes are not saved until you are back online.
              </p>
            )}
            {!user && (
              <p className="roadmap-banner">
                Preview only. Nothing here enrols you or changes the student counts. Sign in and choose this role to save progress.
              </p>
            )}
            {user && !suggested && (
              <p className="roadmap-banner">
                This is a preview. Your quiz suggestions are the only trails you can save.
              </p>
            )}
            {user && suggested && !selectedMatches && (
              <p className="roadmap-banner">
                Your saved starting role is {profile?.selectedRole?.name || 'different'}. Switching keeps the other trail in your history.
              </p>
            )}
            {user && selectedMatches && !enrolled && (
              <button type="button" className="btn dark lg" disabled={busy} onClick={onStart}>
                {busy ? 'Starting…' : 'Start this trail'}
              </button>
            )}
            {pack?.latestVersion > role.version && activeHere && (
              <div className="roadmap-banner">
                <p>
                  A newer version of this trail is published. Your steps stay on version {role.version} until you choose to start version {pack.latestVersion}. Completions are not copied over.
                </p>
                <button
                  type="button"
                  className="btn"
                  disabled={busy}
                  onClick={() => onSwitch(role.id, pack.latestVersion)}
                >
                  Start version {pack.latestVersion}
                </button>
              </div>
            )}
            {actionError && (
              <p className="roadmap-banner alert" role="alert">
                {actionError}
              </p>
            )}

            {(countsState === 'unavailable' || (countsState === 'ready' && counts?.finished > 0)) && (
            <div className="count-note">
              {countsState === 'unavailable' && <p role="status">Counts unavailable</p>}
              {countsState === 'ready' && counts && counts.finished > 0 && (
                <>
                  <p>
                    <strong>{counts.finished} finished this trail</strong>
                  </p>
                  <details>
                    <summary>About these numbers</summary>
                    <p>{counts.disclosure}</p>
                    <p>
                      {counts.lastUpdated
                        ? `Updated ${new Date(counts.lastUpdated).toLocaleString()}`
                        : 'No enrolments yet.'}
                      {counts.cached ? ' Totals can lag briefly.' : ''}
                    </p>
                  </details>
                </>
              )}
            </div>
            )}

            <ol className="trail-path">
              {groups.map((group) => (
                <li key={group.name} className="trail-group">
                  <h3 className="trail-section">{group.name}</h3>
                  <ol>
                    {group.steps.map((item) => {
                      const state = progressSteps.find((entry) => entry.id === item.id)?.state || 'locked'
                      const count = counts?.steps?.find((entry) => entry.id === item.id)
                      return (
                        <li key={item.id}>
                          <button
                            id={`step-opener-${item.id}`}
                            type="button"
                            className={`trail-node state-${state}`}
                            aria-current={state === 'available' ? 'step' : undefined}
                            onClick={(event) => {
                              openerRef.current = event.currentTarget
                              onOpenStep(item.id)
                            }}
                          >
                            <span className="node-order">{item.order}</span>
                            <span className="node-copy">
                              <strong>{item.title}</strong>
                              <span>
                                {item.estimateMinutes} min · {stateLabel(state)}
                              </span>
                              {countsState === 'ready' && count && (count.current > 0 || count.completed > 0) && (
                                <span>
                                  {count.current} {count.current === 1 ? 'student' : 'students'} here now · {count.completed} finished this step
                                </span>
                              )}
                              {countsState === 'unavailable' && <span>Counts unavailable</span>}
                            </span>
                          </button>
                          <span className="trail-edge" aria-hidden="true" />
                        </li>
                      )
                    })}
                  </ol>
                </li>
              ))}
            </ol>

            <div className="roadmap-actions">
              {otherRoles.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className="btn"
                  onClick={() =>
                    setConfirm({
                      type: 'switch',
                      roleId: item.id,
                      title: `Switch to ${item.name}?`,
                      body: `Your ${role.title} notes and progress stay in history. The active trail becomes ${item.name}, and the student counts update once.`,
                    })
                  }
                >
                  Change role to {item.name}
                </button>
              ))}
              {activeHere && (
                <button
                  type="button"
                  className="btn"
                  onClick={() =>
                    setConfirm({
                      type: 'restart',
                      title: 'Restart this trail?',
                      body: 'This archives the current attempt and starts an empty one. Notes and evidence stay in your private history. Completed steps on this attempt are no longer counted.',
                    })
                  }
                >
                  Restart trail
                </button>
              )}
            </div>

            {trail?.archives?.length > 0 && (
              <details className="history-block">
                <summary>Private history</summary>
                {trail.archives.map((archive) => (
                  <article key={archive.attemptNo}>
                    <h2>
                      Attempt {archive.attemptNo} · {archive.completedCount} steps were done
                    </h2>
                    <p>Archived {archive.archivedAt ? new Date(archive.archivedAt).toLocaleString() : 'earlier'} · {archive.reason}</p>
                    {Object.entries(archive.notes || {}).map(([id, note]) => (
                      <p key={id}>
                        <strong>{role.steps.find((item) => item.id === id)?.title || 'Step'}: </strong>
                        {note.text}
                        {note.evidence ? ` (${note.evidence})` : ''}
                      </p>
                    ))}
                  </article>
                ))}
              </details>
            )}
          </>
        )}
      </div>

      <dialog
        ref={dialogRef}
        className="step-dialog"
        aria-labelledby="roadmap-step-title"
        onClose={() => {
          const opener = openerRef.current
          if (stepId) onCloseStep()
          window.setTimeout(() => opener?.focus(), 0)
        }}
      >
        {step && role && (
          <div className="step-sheet">
            <button type="button" className="btn step-close" onClick={closeStep}>
              Close
            </button>
            <p className="mono">
              Step {step.order} / {role.steps.length} · {stateLabel(stepState)}
            </p>
            <h2 id="roadmap-step-title" tabIndex={-1}>
              {step.title}
            </h2>
            <p className="step-goal">{step.goal}</p>
            <p>
              <strong>{step.estimateMinutes} min.</strong> Take the time you need — this is not a timer.
            </p>
            {step.order === 1 && <p className="first-note">{FIRST_STEP_NOTE}</p>}
            <h3>Your task</h3>
            <p className="task-copy">{step.task}</p>
            <p>
              <strong>Keep this: </strong>
              {step.requiredOutput}
            </p>
            <h3>Resource</h3>
            <p>
              <a href={step.resource.url} target="_blank" rel="noreferrer noopener">
                {step.resource.title}
                <span className="sr-only"> (opens {step.resource.publisher} in a new tab)</span>
              </a>
            </p>
            <p>Opens in a new tab. It does not mark this step done.</p>
            <p>
              <strong>Read or watch only: </strong>
              {step.resource.slice}
            </p>
            {step.links?.length > 0 && (
              <>
                <h3>Also useful</h3>
                <ul className="resource-links">
                  {step.links.map((link) => (
                    <li key={link.url}>
                      <a href={link.url} target="_blank" rel="noreferrer noopener">
                        {link.title}
                        <span className="sr-only"> (opens in a new tab)</span>
                      </a>
                      <span>
                        {link.kind === 'video' ? 'Video' : 'Article'}
                        {link.publisher ? ` · ${link.publisher}` : ''}
                        {link.slice ? `. ${link.slice}` : ''}
                      </span>
                    </li>
                  ))}
                </ul>
              </>
            )}
            <details className="step-extra">
              <summary>If the link does not open</summary>
              <p>{step.resource.accessNote}</p>
              <p>{step.fallback}</p>
            </details>
            <fieldset className="check-list" disabled={stepState === 'completed'}>
              <legend>Done when</legend>
              {step.checklist.map((item, index) => (
                <label key={item}>
                  <input
                    type="checkbox"
                    checked={Boolean(checks[String(index)])}
                    onChange={() => toggleCheck(index)}
                  />
                  <span>{item}</span>
                </label>
              ))}
            </fieldset>
            {checkStatus && (
              <p role="status" className="save-status">
                Checklist: {checkStatus}
                {checkStatus === 'Not saved' && (
                  <button type="button" className="linkish" onClick={() => scheduleChecks(checks, revision)}>
                    Retry
                  </button>
                )}
              </p>
            )}
            {savedBanner?.finished && (
              <p className="roadmap-banner" role="status">
                Trail complete. This is exploration, not a certificate or a job offer.
              </p>
            )}
            {savedBanner?.next && (
              <div className="roadmap-banner" role="status">
                <p>Step saved. Next: {savedBanner.next.title}</p>
                <button
                  type="button"
                  className="btn dark"
                  onClick={() => {
                    setSavedBanner(null)
                    onOpenStep(savedBanner.next.id)
                  }}
                >
                  Continue
                </button>
              </div>
            )}
            <div className="step-done">
            <p id="done-reason">{doneReason}</p>
            <button
              type="button"
              className="btn dark lg"
              disabled={!canComplete}
              aria-describedby="done-reason"
              onClick={markDone}
            >
              {busy ? 'Saving…' : 'Mark as done'}
            </button>
            </div>
            {stepState === 'completed' && activeHere && (
              <button
                type="button"
                className="btn"
                onClick={() => {
                  const later = role.steps.filter((item) => item.order >= step.order)
                  setConfirm({
                    type: 'undo',
                    stepId: step.id,
                    title: `Undo “${step.title}”?`,
                    body: `This also marks ${later.map((item) => item.title).join(', ')} as not done. Notes and evidence stay. Earlier steps stay done.`,
                  })
                }}
              >
                Undo this step
              </button>
            )}
            <h3>Private notes</h3>
            <p className="note-warning">
              Only you can read this. Don’t add passwords or someone else’s personal information.
            </p>
            <label className="stack-label">
              Notes
              <textarea
                value={noteText}
                maxLength={4000}
                rows={3}
                onChange={(event) => {
                  setNoteText(event.target.value)
                  queueNotes(event.target.value, evidence)
                }}
              />
            </label>
            <label className="stack-label">
              Optional evidence link
              <input
                type="url"
                inputMode="url"
                placeholder="https://"
                value={evidence}
                onChange={(event) => {
                  setEvidence(event.target.value)
                  queueNotes(noteText, event.target.value)
                }}
              />
            </label>
            <p role="status" className="save-status">
              Notes: {noteStatus || (enrolled ? 'Saved' : 'Not saved')}
              {noteStatus === 'Not saved' && enrolled && (
                <button type="button" className="linkish" onClick={retryNotes}>
                  Retry
                </button>
              )}
            </p>
            {conflict && (
              <div className="roadmap-banner" role="alert">
                <p>Another session saved different notes. Yours are still in this box.</p>
                <button
                  type="button"
                  className="btn"
                  onClick={() => {
                    setNoteText(conflict.text || '')
                    setEvidence(conflict.evidence || '')
                    setNoteRevision(conflict.revision || 0)
                    draftDirty.current = false
                    setNoteStatus('Saved')
                    setConflict(null)
                  }}
                >
                  Use the saved notes
                </button>
                <button
                  type="button"
                  className="btn dark"
                  onClick={() => persistNotes(noteText, evidence, conflict.revision || 0)}
                >
                  Keep mine
                </button>
              </div>
            )}
          </div>
        )}
      </dialog>

      <dialog
        ref={confirmRef}
        className="confirm-dialog"
        aria-labelledby="confirm-title"
        onClose={() => setConfirm(null)}
      >
        {confirm && (
          <div className="confirm-card">
            <h2 id="confirm-title">{confirm.title}</h2>
            <p>{confirm.body}</p>
            <div className="roadmap-actions">
              <button
                type="button"
                className="btn dark"
                disabled={busy}
                onClick={() => {
                  if (confirm.type === 'undo') confirmUndo()
                  else if (confirm.type === 'restart') confirmRestart()
                  else if (confirm.type === 'switch') onSwitch(confirm.roleId)
                }}
              >
                {busy ? 'Saving…' : 'Confirm'}
              </button>
              <button type="button" className="btn" onClick={() => confirmRef.current?.close()}>
                Cancel
              </button>
            </div>
          </div>
        )}
      </dialog>
    </section>
  )
}
