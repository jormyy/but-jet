'use client'

import { useOnline } from '@/hooks/use-online'
import { useLastSyncedAt } from '@/lib/swr-provider'

export function OfflineBanner() {
  const online = useOnline()
  const syncedAt = useLastSyncedAt()

  if (online) return null

  // Naming the time these figures came from is the difference between "your
  // balance" and "your balance as of this morning".
  const when = syncedAt
    ? new Date(syncedAt).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
    : null

  return (
    <div
      role="status"
      className="bg-amber-100 dark:bg-amber-950 text-amber-900 dark:text-amber-200 text-sm text-center py-1.5 px-4"
    >
      {when ? `Offline — showing data from ${when}` : 'Offline — showing last synced data'}
    </div>
  )
}
