'use client'

import { useOnline } from '@/hooks/use-online'

export function OfflineBanner() {
  const online = useOnline()

  if (online) return null

  return (
    <div
      role="status"
      className="bg-amber-100 dark:bg-amber-950 text-amber-900 dark:text-amber-200 text-sm text-center py-1.5 px-4"
    >
      Offline — showing last synced data
    </div>
  )
}
