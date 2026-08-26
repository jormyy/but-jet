'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import { SWRConfig, useSWRConfig, unstable_serialize, type Cache } from 'swr'
import { readUserIdFromCookie } from '@/lib/supabase/session-cookie'
import { readPersistedCache, writePersistedCache, type SwrState } from '@/lib/swr-cache'

// When this data was last confirmed against the server, so views can date the
// figures they show instead of presenting a warm start as if it were live. It
// is a getter, not a value: it changes on every successful fetch, and its one
// caller renders on the online/offline transition anyway.
const SyncedAtContext = createContext<() => number | null>(() => null)
export const useLastSyncedAt = () => useContext(SyncedAtContext)()

// The cache is restored through `mutate` after mount rather than by swapping in
// a pre-filled provider. Swapping the provider remounts SWRConfig, which throws
// away every in-flight request and refetches the lot — the app used to issue
// each query exactly twice on launch for that reason.
function CacheRestorer({ cache, onRestored }: { cache: Map<string, SwrState>; onRestored: (savedAt: number | null) => void }) {
  const { mutate } = useSWRConfig()

  useEffect(() => {
    const userId = readUserIdFromCookie(document.cookie)
    if (!userId) return

    const { entries, savedAt } = readPersistedCache(userId)
    for (const { key, data } of entries) {
      if (cache.get(unstable_serialize(key))?.data !== undefined) continue
      mutate(key, data, { revalidate: false })
    }
    onRestored(savedAt)

    const persist = () => writePersistedCache(userId, cache)
    // As a PWA this is closed by swiping it away or switching apps far more
    // often than by a real page unload, and neither fires `beforeunload` on iOS
    // or Android. `visibilitychange`/`pagehide` fire the moment the app is
    // backgrounded, before the OS gets a chance to kill it outright.
    const onHide = () => { if (document.visibilityState === 'hidden') persist() }
    document.addEventListener('visibilitychange', onHide)
    window.addEventListener('pagehide', persist)
    return () => {
      persist()
      document.removeEventListener('visibilitychange', onHide)
      window.removeEventListener('pagehide', persist)
    }
  }, [cache, mutate, onRestored])

  return null
}

export function SWRProvider({ children }: { children: React.ReactNode }) {
  // One cache and one clock for the lifetime of the app. Everything CacheRestorer
  // receives has to be stable, or its effect tears down and re-runs — persisting
  // and restoring again — on every render.
  const [store] = useState(() => {
    const cache = new Map<string, SwrState>()
    let syncedAt: number | null = null
    return {
      cache,
      config: {
        provider: () => cache as Cache,
        onSuccess: () => { syncedAt = Date.now() },
      },
      readSyncedAt: () => syncedAt,
      seedSyncedAt: (at: number | null) => { syncedAt ??= at },
    }
  })

  return (
    <SWRConfig value={store.config}>
      <SyncedAtContext.Provider value={store.readSyncedAt}>
        <CacheRestorer cache={store.cache} onRestored={store.seedSyncedAt} />
        {children}
      </SyncedAtContext.Provider>
    </SWRConfig>
  )
}
