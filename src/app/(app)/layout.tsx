'use client'

import { useEffect, useState } from 'react'
import dynamic from 'next/dynamic'
import { usePathname } from 'next/navigation'
import { Nav } from '@/components/nav'
import { createClient } from '@/lib/supabase/client'
import { HomeTab } from '@/components/tabs/home-tab'

// Every tab but Home is split into its own chunk so opening the app only has to download and parse
// what the home screen needs. They're preloaded once the app is idle, so switching tabs stays instant.
const tabLoaders = {
  transactions: () => import('@/components/tabs/transactions-tab').then(m => m.TransactionsTab),
  review: () => import('@/components/tabs/review-tab').then(m => m.ReviewTab),
  netWorth: () => import('@/components/tabs/networth-tab').then(m => m.NetWorthTab),
  goals: () => import('@/components/tabs/goals-tab').then(m => m.GoalsTab),
  investments: () => import('@/components/tabs/investments-tab').then(m => m.InvestmentsTab),
}

const tabs = [
  { path: '/', component: HomeTab },
  { path: '/transactions', component: dynamic(tabLoaders.transactions) },
  { path: '/review', component: dynamic(tabLoaders.review) },
  { path: '/net-worth', component: dynamic(tabLoaders.netWorth) },
  { path: '/goals', component: dynamic(tabLoaders.goals) },
  { path: '/investments', component: dynamic(tabLoaders.investments) },
]

export default function AppLayout() {
  const pathname = usePathname()
  // Tabs stay mounted once visited so switching back is instant, but we only
  // mount (and start fetching) a tab the first time it's actually opened —
  // mounting all six up front fires every tab's fetches at once and the
  // resulting burst of re-renders can eat the main thread long enough that
  // a nav tap gets queued behind it.
  const [visited, setVisited] = useState(() => new Set([pathname]))
  if (!visited.has(pathname)) {
    setVisited(prev => new Set(prev).add(pathname))
  }

  // The proxy only checks that a session cookie exists. If it turns out to be dead (e.g. signed out
  // on another device), clear it and go to login. A failed check (e.g. offline) isn't a sign-out.
  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getSession().then(async ({ data: { session }, error }) => {
      if (session || error) return
      await supabase.auth.signOut({ scope: 'local' })
      window.location.href = '/login'
    })
  }, [])

  useEffect(() => {
    const preload = () => Object.values(tabLoaders).forEach(load => load())
    // Safari has no requestIdleCallback
    if ('requestIdleCallback' in window) {
      const id = requestIdleCallback(preload, { timeout: 3000 })
      return () => cancelIdleCallback(id)
    }
    const id = setTimeout(preload, 1000)
    return () => clearTimeout(id)
  }, [])

  return (
    <div className="max-w-lg mx-auto pb-28">
      {tabs
        .filter(({ path }) => visited.has(path))
        .map(({ path, component: Tab }) => (
          <div key={path} className={pathname === path ? undefined : 'hidden'}>
            <Tab />
          </div>
        ))}
      <Nav />
    </div>
  )
}
