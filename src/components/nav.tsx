'use client'

import Link, { useLinkStatus } from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, ArrowLeftRight, Receipt, TrendingUp, Target, PieChart, type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

const links = [
  { href: '/', label: 'Home', icon: LayoutDashboard },
  { href: '/transactions', label: 'Txns', icon: ArrowLeftRight },
  { href: '/bills', label: 'Bills', icon: Receipt },
  { href: '/investments', label: 'Invest', icon: PieChart },
  { href: '/net-worth', label: 'Worth', icon: TrendingUp },
  { href: '/goals', label: 'Goals', icon: Target },
]

// Lives inside the Link so useLinkStatus can see its pending state. Delayed
// and fixed-size so a fast (already-prefetched) navigation never flashes it —
// it only shows up when a tap is genuinely still waiting on the network.
function NavIcon({ Icon, active }: { Icon: LucideIcon; active: boolean }) {
  const { pending } = useLinkStatus()
  return (
    <Icon
      size={20}
      strokeWidth={active ? 2.5 : 1.75}
      className={cn('transition-opacity', pending && 'opacity-40 duration-150 delay-150')}
    />
  )
}

export function Nav() {
  const pathname = usePathname()

  return (
    <nav className="fixed bottom-safe left-4 right-4 z-40">
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
              <NavIcon Icon={Icon} active={active} />
              {label}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
