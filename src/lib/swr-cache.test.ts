import { describe, it, expect, beforeEach } from 'vitest'
import { cacheStorageKey, readPersistedCache, writePersistedCache, clearPersistedCaches, type SwrState } from './swr-cache'

const USER_A = '11111111-1111-1111-1111-111111111111'
const USER_B = '22222222-2222-2222-2222-222222222222'
const entry = (key: string | unknown[], data: unknown): SwrState => ({ data, _k: key })
const cacheOf = (...pairs: [string, SwrState][]) => new Map<string, SwrState>(pairs)

describe('persisted SWR cache', () => {
  beforeEach(() => localStorage.clear())

  it('scopes storage per user so one account never reads another account cache', () => {
    writePersistedCache(USER_A, cacheOf(['txns', entry(['txns', '2026-08'], [{ amount: 4200 }])]))

    expect(readPersistedCache(USER_B).entries).toHaveLength(0)
    expect(readPersistedCache(USER_A).entries).toHaveLength(1)
  })

  it('drops every persisted cache on sign-out', () => {
    writePersistedCache(USER_A, cacheOf(['txns', entry('txns', [1])]))
    writePersistedCache(USER_B, cacheOf(['txns', entry('txns', [2])]))

    clearPersistedCaches()

    expect(readPersistedCache(USER_A).entries).toHaveLength(0)
    expect(readPersistedCache(USER_B).entries).toHaveLength(0)
    expect(localStorage.length).toBe(0)
  })

  it('restores the original SWR key, not the serialised one', () => {
    writePersistedCache(USER_A, cacheOf(['@"txns","2026-08",', entry(['txns', '2026-08'], [1])]))
    expect(readPersistedCache(USER_A).entries[0].key).toEqual(['txns', '2026-08'])
  })

  it('reports when the cache was written so the UI can date the figures', () => {
    writePersistedCache(USER_A, cacheOf(['txns', entry('txns', [1])]), 1_700_000_000_000)
    expect(readPersistedCache(USER_A).savedAt).toBe(1_700_000_000_000)
  })

  it('reads back an empty cache rather than throwing on corrupt storage', () => {
    localStorage.setItem(cacheStorageKey(USER_A), '{not json')
    expect(readPersistedCache(USER_A).entries).toHaveLength(0)
    expect(readPersistedCache(USER_A).savedAt).toBeNull()
  })

  it('never persists a failed request, which would render as a failed load next launch', () => {
    writePersistedCache(USER_A, cacheOf(
      ['ok', entry('ok', [1])],
      ['bad', { error: new Error('network'), data: undefined, _k: 'bad' }],
    ))
    const keys = readPersistedCache(USER_A).entries.map(e => e.key)
    expect(keys).toEqual(['ok'])
  })

  it('drops entries that would push the cache past the storage budget', () => {
    writePersistedCache(USER_A, cacheOf(
      ['small', entry('small', [1])],
      ['huge', entry('huge', ['x'.repeat(600_000)])],
    ))
    const keys = readPersistedCache(USER_A).entries.map(e => e.key)
    expect(keys).toEqual(['small'])
  })
})
