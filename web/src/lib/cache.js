/** Tiny stale-while-revalidate helpers for hot discovery reads. */

const memory = new Map()
const inflight = new Map()

function storageKey(key) {
  return `sc-cache:${key}`
}

export function readLocal(key, maxAgeMs = Infinity) {
  try {
    const raw = localStorage.getItem(storageKey(key))
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') return null
    if (Date.now() - (parsed.at || 0) > maxAgeMs) return null
    return parsed.value
  } catch {
    return null
  }
}

export function writeLocal(key, value) {
  try {
    localStorage.setItem(storageKey(key), JSON.stringify({ at: Date.now(), value }))
  } catch {
    // private mode / quota
  }
  memory.set(key, { at: Date.now(), value })
}

export function peekMemory(key, maxAgeMs = Infinity) {
  const hit = memory.get(key)
  if (!hit) return null
  if (Date.now() - hit.at > maxAgeMs) return null
  return hit.value
}

/**
 * Deduped fetch with optional memory + localStorage layers.
 * Returns cached value immediately when present; still revalidates in background
 * when `revalidate` is provided by the caller.
 */
export function cachedFetch(key, loader, { memoryTtlMs = 5 * 60_000 } = {}) {
  const mem = peekMemory(key, memoryTtlMs)
  if (mem != null) return Promise.resolve(mem)
  if (inflight.has(key)) return inflight.get(key)

  const pending = Promise.resolve()
    .then(loader)
    .then((value) => {
      memory.set(key, { at: Date.now(), value })
      return value
    })
    .finally(() => {
      inflight.delete(key)
    })

  inflight.set(key, pending)
  return pending
}

export function invalidateCache(key) {
  if (key) {
    memory.delete(key)
    inflight.delete(key)
    try {
      localStorage.removeItem(storageKey(key))
    } catch {
      // ignore
    }
    return
  }
  memory.clear()
  inflight.clear()
}
