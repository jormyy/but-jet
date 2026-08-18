'use client'

import { SWRConfig, type Cache } from 'swr'

const STORAGE_KEY = 'fine-ants-swr-cache'

function localStorageProvider(): Cache {
  if (typeof window === 'undefined') return new Map()

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
  return <SWRConfig value={{ provider: localStorageProvider }}>{children}</SWRConfig>
}
