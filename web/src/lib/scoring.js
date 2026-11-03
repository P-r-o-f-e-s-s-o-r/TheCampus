export function createOrder(questions, rng = Math.random) {
  const keys = [...new Set(questions.map((q) => q.area))]
  const pools = Object.fromEntries(
    keys.map((k) => [k, shuffle(questions.filter((q) => q.area === k).map((q) => q.id), rng)])
  )
  const rounds = Math.min(...keys.map((k) => pools[k].length))
  return Array.from({ length: rounds }, (_, round) =>
    shuffle(keys, rng).map((k) => pools[k][round])
  ).flat()
}

export function scoreAnswers(questions, answers) {
  const keys = ['R', 'I', 'A', 'S', 'E', 'C']
  return Object.fromEntries(
    keys.map((k) => [
      k,
      questions
        .filter((q) => q.area === k)
        .reduce((sum, q) => sum + (Number(answers[q.id]) || 0), 0),
    ])
  )
}

export function buildProfile(scores, areas, pairs) {
  const KEYS = ['R', 'I', 'A', 'S', 'E', 'C']
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
