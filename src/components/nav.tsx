'use client'

import Link, { useLinkStatus } from 'next/link'
import { usePathname } from 'next/navigation'
import useSWR from 'swr'
import { LayoutDashboard, ArrowLeftRight, Inbox, TrendingUp, Target, PieChart, type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { fetchNeedsReview } from '@/lib/data'

const links = [
  { href: '/', label: 'Home', icon: LayoutDashboard },
  { href: '/transactions', label: 'Txns', icon: ArrowLeftRight },
  { href: '/review', label: 'Review', icon: Inbox },
  { href: '/investments', label: 'Invest', icon: PieChart },
  { href: '/net-worth', label: 'Worth', icon: TrendingUp },
  { href: '/goals', label: 'Goals', icon: Target },
]

// Lives inside the Link so useLinkStatus can see its pending state. Delayed
// and fixed-size so a fast (already-prefetched) navigation never flashes it —
// it only shows up when a tap is genuinely still waiting on the network.
function NavIcon({ Icon, active, badge }: { Icon: LucideIcon; active: boolean; badge?: number }) {
  const { pending } = useLinkStatus()
  return (
    <span className="relative">
      <Icon
        size={20}
        strokeWidth={active ? 2.5 : 1.75}
        className={cn('transition-opacity', pending && 'opacity-40 duration-150 delay-150')}
      />
      {!!badge && (
        <span className="absolute -top-1.5 -right-2.5 min-w-4 h-4 px-1 rounded-full bg-amber-500 text-white text-[9px] font-semibold leading-4 text-center">
          {badge > 99 ? '99+' : badge}
        </span>
      )}
    </span>
  )
}

export function Nav() {
  const pathname = usePathname()
  // Shares the Review tab's SWR key, so the badge updates as items are reviewed
  const { data: needsReview } = useSWR('review', fetchNeedsReview)

  return (
    <nav className="fixed bottom-6 left-4 right-4 z-40 pb-safe">
      <div className="max-w-lg mx-auto flex bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-full shadow-lg shadow-black/10 overflow-hidden">
        {links.map(({ href, label, icon: Icon }) => {
          const active = pathname === href
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex-1 flex flex-col items-center gap-0.5 py-3 text-[10px] font-medium transition-colors',
                active
                  ? 'text-zinc-900 dark:text-zinc-100'
                  : 'text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300'
              )}
            >
              <NavIcon Icon={Icon} active={active} badge={href === '/review' ? needsReview?.length : undefined} />
              {label}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
