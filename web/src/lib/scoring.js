export const RIASEC_KEYS = ['R', 'I', 'A', 'S', 'E', 'C']
export const QUESTIONS_PER_AREA = 5
export const QUIZ_LENGTH = RIASEC_KEYS.length * QUESTIONS_PER_AREA

/**
 * Always return exactly 30 questions: 5 per RIASEC area.
 * If an area has more than 5, randomly sample 5.
 * Final list is shuffled so students see a random order.
 */
export function selectQuizQuestions(questions, rng = Math.random) {
  const list = Array.isArray(questions) ? questions : []
  const selected = []

  for (const key of RIASEC_KEYS) {
    const pool = list.filter((q) => q.area === key)
    if (pool.length < QUESTIONS_PER_AREA) {
      throw new Error(
        `Need at least ${QUESTIONS_PER_AREA} active questions for ${key} (found ${pool.length}).`
      )
    }
    selected.push(...shuffle(pool, rng).slice(0, QUESTIONS_PER_AREA))
  }

  return shuffle(selected, rng)
}

/** @deprecated prefer selectQuizQuestions — kept for callers that want IDs only */
export function createOrder(questions, rng = Math.random) {
  return selectQuizQuestions(questions, rng).map((q) => q.id)
}

export function scoreAnswers(questions, answers) {
  return Object.fromEntries(
    RIASEC_KEYS.map((k) => [
      k,
      questions
        .filter((q) => q.area === k)
        .reduce((sum, q) => sum + (Number(answers[q.id]) || 0), 0),
    ])
  )
}

/**
 * Map RIASEC scores to up to `max` gamified roles (Builders, Hackers, …).
 * Keeps RIASEC internal; UI should show role names only.
 */
export function resolveRoles(scores, roleMap = {}, { max = 2 } = {}) {
  const sorted = [...RIASEC_KEYS].sort(
    (a, b) => (Number(scores?.[b]) || 0) - (Number(scores?.[a]) || 0)
  )
  const topScore = Number(scores?.[sorted[0]]) || 0
  if (topScore <= 0) {
    return {
      roles: [],
      mode: 'open',
      title: 'Still exploring',
      description:
        'No strong pull yet — that is useful data. Try a few tiny experiments and come back.',
      keys: [],
    }
  }

  const picked = []
  for (const key of sorted) {
    if (picked.length >= max) break
    const score = Number(scores?.[key]) || 0
    if (score <= 0) continue
    if (picked.length === 1 && score < Math.max(3, topScore - 3)) break
    const meta = roleMap[key]
    if (!meta) continue
    picked.push({
      key,
      score,
      id: meta.id || key,
      name: meta.name || key,
      color: meta.color || 'cream',
      icon: meta.icon || 'spark',
      blurb: meta.blurb || '',
      careers: Array.isArray(meta.careers) ? meta.careers : [],
      skills: Array.isArray(meta.skills) ? meta.skills : [],
    })
  }

  const title =
    picked.length === 2
      ? `${picked[0].name} · ${picked[1].name}`
      : picked[0]?.name || 'Your mix'
  const description =
    picked.length === 2
      ? `You’re a blend — part ${picked[0].name.toLowerCase()}, part ${picked[1].name.toLowerCase()}. ${picked[0].blurb}`
      : picked[0]?.blurb || ''

  return {
    roles: picked,
    mode: picked.length === 2 ? 'blend' : picked.length === 1 ? 'single' : 'open',
    title,
    description,
    keys: picked.map((r) => r.key),
  }
}

export function buildProfile(scores, areas, pairs) {
  const KEYS = RIASEC_KEYS
  const sorted = [...KEYS].sort((a, b) => scores[b] - scores[a])
  const groups = []
  sorted.forEach((k) => {
    const last = groups.at(-1)
    if (last && scores[last[0]] === scores[k]) last.push(k)
    else groups.push([k])
  })
  const max = scores[sorted[0]]
  const min = scores[sorted.at(-1)]
  const neutral = max <= 5
  const broad = !neutral && (max - min <= 1 || groups[0].length >= 3)

  let selected = []
  let used = 0
  for (const group of groups) {
    if (used >= 3) break
    selected.push(group)
    used += group.length
  }
  const code = selected.map((g) => (g.length > 1 ? `[${g.join(' + ')}]` : g[0])).join(' / ')

  let title
  let description
  let directions
  let leadAreas
  let color
  let icon
  let mode

  if (neutral) {
    mode = 'open'
    title = max === 0 ? 'Still exploring. Still you.' : 'Your next thing is still unfolding.'
    description =
      max === 0
        ? 'These activities did not feel like your thing today. That is useful to know, not a lack of talent.'
        : 'There is no strong pattern yet. Small experiences can help you figure out what feels interesting.'
    directions = ['Try something creative', 'Join a friendly skill swap', 'Make something small']
    leadAreas = []
    color = 'cream'
    icon = 'compass'
  } else if (broad) {
    mode = 'broad'
    title = 'The multi-curious explorer'
    description =
      'Several interest areas are close together. Try a couple of different experiences and notice which one you want to return to.'
    directions = ['Mix making with storytelling', 'Try a team project', 'Explore something unfamiliar']
    leadAreas = [...groups[0]]
    color = 'yellow'
    icon = 'spark'
  } else {
    let pair = null
    if (groups[0].length === 2) pair = groups[0]
    else if (
      groups[0].length === 1 &&
      groups[1] &&
      groups[1].length === 1 &&
      scores[groups[1][0]] >= 5
    ) {
      pair = [groups[0][0], groups[1][0]]
    }
    leadAreas = pair || [groups[0][0]]
    const lead = areas[leadAreas[0]] || {}
    color = lead.color || 'cream'
    icon = lead.icon || 'compass'
    if (pair) {
      const key = KEYS.filter((k) => pair.includes(k)).join('')
      const pairMeta = pairs[key]
      title = pairMeta?.title || lead.persona
      description = pairMeta?.description || lead.description
      directions = pairMeta?.directions || lead.directions || []
      mode = 'pair'
    } else {
      title = lead.persona || 'Your interest mix'
      description = lead.description || ''
      directions = lead.directions || []
      mode = 'single'
    }
  }

  return {
    scores,
    groups,
    sorted,
    code,
    title,
    description,
    directions,
    areas: leadAreas,
    color,
    icon,
    mode,
  }
}

function shuffle(list, rng = Math.random) {
  const a = [...list]
  for (let i = a.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}
