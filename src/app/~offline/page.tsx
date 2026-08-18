import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Offline',
}

export default function OfflinePage() {
  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="max-w-sm w-full text-center space-y-2">
        <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">You&apos;re offline</h1>
        <p className="text-sm text-zinc-500">
          This page hasn&apos;t been loaded before, so it isn&apos;t available offline. Reconnect and visit it once
          to make it available next time.
        </p>
      </div>
    </div>
  )
}
