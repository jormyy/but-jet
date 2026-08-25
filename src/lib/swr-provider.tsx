'use client'

import { createContext, useContext, useEffect, useRef, useState } from 'react'
import { SWRConfig, useSWRConfig, unstable_serialize, type Cache } from 'swr'
import { readUserIdFromCookie } from '@/lib/supabase/session-cookie'
import { readPersistedCache, writePersistedCache, type SwrState } from '@/lib/swr-cache'

// When this data was last confirmed against the server, so views can date the
// figures they show instead of presenting a warm start as if it were live.
// Read through a getter: it changes on every successful fetch, and re-rendering
// the tree for that would cost more than it is worth. The one caller renders on
// the online/offline transition, which is exactly when the value is needed.
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
  const [cache] = useState(() => new Map<string, SwrState>())
  const syncedAt = useRef<number | null>(null)
  const [value] = useState(() => ({
    provider: () => cache as Cache,
    onSuccess: () => { syncedAt.current = Date.now() },
  }))
  const [getSyncedAt] = useState(() => () => syncedAt.current)

  return (
    <SWRConfig value={value}>
      <SyncedAtContext.Provider value={getSyncedAt}>
        <CacheRestorer cache={cache} onRestored={at => { syncedAt.current ??= at }} />
        {children}
      </SyncedAtContext.Provider>
    </SWRConfig>
  )
}
