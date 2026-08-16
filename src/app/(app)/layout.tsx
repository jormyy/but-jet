'use client'

import { usePathname } from 'next/navigation'
import { Nav } from '@/components/nav'
import { HomeTab } from '@/components/tabs/home-tab'
import { BillsTab } from '@/components/tabs/bills-tab'
import { TransactionsTab } from '@/components/tabs/transactions-tab'
import { GoalsTab } from '@/components/tabs/goals-tab'
import { NetWorthTab } from '@/components/tabs/networth-tab'

const tabs = [
  { path: '/', component: HomeTab },
  { path: '/transactions', component: TransactionsTab },
  { path: '/bills', component: BillsTab },
  { path: '/net-worth', component: NetWorthTab },
  { path: '/goals', component: GoalsTab },
]

export default function AppLayout() {
  const pathname = usePathname()

  return (
    <div className="max-w-lg mx-auto pb-24">
      {tabs.map(({ path, component: Tab }) => (
        <div key={path} className={pathname === path ? undefined : 'hidden'}>
          <Tab />
        </div>
      ))}
      <Nav />
    </div>
  )
}
