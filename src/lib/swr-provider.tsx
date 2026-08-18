'use client'

import { useEffect, useState } from 'react'
import { SWRConfig, type Cache } from 'swr'

const STORAGE_KEY = 'fine-ants-swr-cache'

function emptyCache(): Cache {
  return new Map()
}

function localStorageProvider(): Cache {
  let entries: [string, unknown][] = []
  try {
    entries = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]')
  } catch {
    entries = []
  }
  const map = new Map(entries)

  window.addEventListener('beforeunload', () => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(map.entries())))
    } catch {
      // storage full or unavailable — cached data just won't persist this time
    }
  })

  return map as Cache
}

export function SWRProvider({ children }: { children: React.ReactNode }) {
  // The persisted cache can only be read on the client, so the first client
  // render must also start empty to match the server — otherwise cached
  // values from a previous visit would hydrate-mismatch against the server's
  // empty state. Swap in the real cache right after mount instead.
  const [hydrated, setHydrated] = useState(false)
  useEffect(() => setHydrated(true), [])

  return (
    <SWRConfig key={hydrated ? 'cached' : 'ssr'} value={{ provider: hydrated ? localStorageProvider : emptyCache }}>
      {children}
    </SWRConfig>
  )
}
