'use client'

import { useState } from 'react'
import { usePathname } from 'next/navigation'
import { Nav } from '@/components/nav'
import { HomeTab } from '@/components/tabs/home-tab'
import { BillsTab } from '@/components/tabs/bills-tab'
import { TransactionsTab } from '@/components/tabs/transactions-tab'
import { GoalsTab } from '@/components/tabs/goals-tab'
import { NetWorthTab } from '@/components/tabs/networth-tab'
import { InvestmentsTab } from '@/components/tabs/investments-tab'

const tabs = [
  { path: '/', component: HomeTab },
  { path: '/transactions', component: TransactionsTab },
  { path: '/bills', component: BillsTab },
  { path: '/net-worth', component: NetWorthTab },
  { path: '/goals', component: GoalsTab },
  { path: '/investments', component: InvestmentsTab },
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
