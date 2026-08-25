import type { Metadata, Viewport } from 'next'
import { Geist } from 'next/font/google'
import { SerwistProvider } from '@serwist/turbopack/react'
import { SWRProvider } from '@/lib/swr-provider'
import { OfflineBanner } from '@/components/offline-banner'
import './globals.css'

const geist = Geist({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'But-Jet',
  description: 'Personal finance tracker',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'But-Jet',
  },
}

export const viewport: Viewport = {
  themeColor: '#ffffff',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className={`${geist.className} bg-zinc-50 dark:bg-zinc-950 min-h-screen`}>
        <SerwistProvider swUrl="/serwist/sw.js" reloadOnOnline={false}>
          <SWRProvider>
            <OfflineBanner />
            {children}
          </SWRProvider>
        </SerwistProvider>
      </body>
    </html>
  )
}
