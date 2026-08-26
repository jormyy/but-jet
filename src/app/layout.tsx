import type { Metadata, Viewport } from 'next'
import { Geist } from 'next/font/google'
import { SerwistProvider } from '@serwist/turbopack/react'
import { SWRProvider } from '@/lib/swr-provider'
import { OfflineBanner } from '@/components/offline-banner'
import { ServiceWorkerUpdater } from '@/components/service-worker-updater'
import './globals.css'

const geist = Geist({ subsets: ['latin'], display: 'swap', variable: '--font-geist-sans' })

export const metadata: Metadata = {
  title: 'But Jet',
  description: 'Personal budget tracker',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    // Lets the app paint under the status bar so the safe-area insets below
    // have something to reserve, instead of iOS drawing an opaque white strip
    // over a dark app.
    statusBarStyle: 'black-translucent',
    title: 'But Jet',
  },
}

export const viewport: Viewport = {
  // Follows the OS appearance, so the standalone status bar stops being white
  // while the app behind it is near-black.
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#0a0a0a' },
  ],
  width: 'device-width',
  initialScale: 1,
  // No maximum-scale: capping it blocks pinch-zoom, which WCAG 1.4.4 requires
  // and which is the only way to read a dense figure on a small screen.
  viewportFit: 'cover',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className={`${geist.className} ${geist.variable} bg-zinc-50 dark:bg-zinc-950 min-h-dvh`}>
        <SerwistProvider swUrl="/serwist/sw.js" register={false} reloadOnOnline={false}>
          <ServiceWorkerUpdater />
          <SWRProvider>
            <OfflineBanner />
            {children}
          </SWRProvider>
        </SerwistProvider>
      </body>
    </html>
  )
}
