// Persistence for the SWR cache. Kept separate from the provider component so
// the rules that matter for correctness — per-user scoping, sign-out clearing,
// and what is allowed to survive a reload — are testable on their own.

import type { Arguments } from 'swr'

const PREFIX = 'but-jet-swr-cache:'

// localStorage is a few MB per origin and shared with everything else on it.
// Keeping the whole cache well inside that leaves room for the auth session and
// avoids the write failing outright once the history grows.
const STORAGE_BUDGET_BYTES = 512 * 1024

// SWR's own cache is keyed by a serialised form of the key, but restoring goes
// back through `mutate`, which wants the original. Entries carry the original.
export interface CachedEntry {
  key: Arguments
  data: unknown
}

interface Persisted {
  v: 1
  savedAt: number
  entries: CachedEntry[]
}

export interface SwrState {
  data?: unknown
  error?: unknown
  _k?: Arguments
}

export function cacheStorageKey(userId: string) {
  return `${PREFIX}${userId}`
}

export function readPersistedCache(userId: string): { entries: CachedEntry[]; savedAt: number | null } {
  const empty = { entries: [], savedAt: null }
  const raw = localStorage.getItem(cacheStorageKey(userId))
  if (!raw) return empty

  let parsed: Persisted
  try {
    parsed = JSON.parse(raw)
  } catch {
    return empty
  }
  if (parsed?.v !== 1 || !Array.isArray(parsed.entries)) return empty

  return { entries: parsed.entries, savedAt: parsed.savedAt }
}

export function writePersistedCache(userId: string, cache: Map<string, SwrState>, now = Date.now()) {
  const entries: CachedEntry[] = []
  let bytes = 0

  for (const [serialisedKey, state] of cache) {
    // A cached rejection is not worth carrying across a reload: it would render
    // as a failed load on a launch that hasn't tried the network yet.
    if (!state || state.data === undefined || state.error !== undefined) continue

    const entry: CachedEntry = { key: state._k ?? serialisedKey, data: state.data }
    const size = JSON.stringify(entry).length
    if (bytes + size > STORAGE_BUDGET_BYTES) continue
    bytes += size
    entries.push(entry)
  }

  const payload: Persisted = { v: 1, savedAt: now, entries }
  try {
    localStorage.setItem(cacheStorageKey(userId), JSON.stringify(payload))
  } catch {
    // Quota or private-mode failure: this launch just won't have a warm start.
  }
}

export function clearPersistedCaches() {
  const keys: string[] = []
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)
    if (key?.startsWith(PREFIX)) keys.push(key)
  }
  keys.forEach(key => localStorage.removeItem(key))
}
