import { cn, formatCurrency } from '@/lib/utils'
import { ReactNode } from 'react'

interface StatCardProps {
  label: string
  value: number
  sub?: ReactNode
  accent?: 'green' | 'red' | 'orange' | 'blue' | 'default'
}

export function StatCard({ label, value, sub, accent = 'default' }: StatCardProps) {
  return (
    <div className="rounded-xl border border-zinc-100 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 flex flex-col gap-1">
      <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">{label}</span>
      <span
        className={cn(
          'text-2xl font-semibold tabular-nums',
          accent === 'green' && 'text-emerald-600 dark:text-emerald-400',
          accent === 'red' && 'text-red-500',
          accent === 'orange' && 'text-orange-500',
          accent === 'blue' && 'text-blue-500',
          accent === 'default' && 'text-zinc-900 dark:text-zinc-100'
        )}
      >
        {formatCurrency(value)}
      </span>
      {sub && <span className="text-xs text-zinc-400 inline-flex items-center gap-0.5">{sub}</span>}
    </div>
  )
}
