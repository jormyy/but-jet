'use client'

import { Transaction } from '@/types'
import { formatCurrency, formatDate } from '@/lib/utils'
import { Trash2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useState } from 'react'
import { cn } from '@/lib/utils'

interface TransactionListProps {
  transactions: Transaction[]
  onDelete: () => void
}

export function TransactionList({ transactions, onDelete }: TransactionListProps) {
  const supabase = createClient()
  const [deleting, setDeleting] = useState<string | null>(null)

  async function handleDelete(id: string) {
    setDeleting(id)
    await supabase.from('transactions').delete().eq('id', id)
    setDeleting(null)
    onDelete()
  }

  if (!transactions.length) {
    return (
      <div className="text-center py-12 text-zinc-400 text-sm">
        No transactions yet
      </div>
    )
  }

  // Group by date
  const grouped: Record<string, Transaction[]> = {}
  for (const t of transactions) {
    if (!grouped[t.date]) grouped[t.date] = []
    grouped[t.date].push(t)
  }

  return (
    <div className="flex flex-col gap-6">
      {Object.entries(grouped)
        .sort(([a], [b]) => b.localeCompare(a))
        .map(([date, txns]) => (
          <div key={date}>
            <p className="text-xs font-medium text-zinc-400 uppercase tracking-wide mb-2">
              {formatDate(date)}
            </p>
            <div className="flex flex-col divide-y divide-zinc-100 dark:divide-zinc-800 rounded-xl border border-zinc-100 dark:border-zinc-800 overflow-hidden">
              {txns.map(t => (
                <div key={t.id} className="flex items-center justify-between px-4 py-3 bg-white dark:bg-zinc-900 group">
                  <div className="flex flex-col min-w-0">
                    <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100 truncate">
                      {t.merchant || t.description || 'Unnamed'}
                    </span>
                    <span className="text-xs text-zinc-400 truncate">
                      {t.category?.name ?? 'Uncategorized'}
                      {t.description && t.merchant ? ` · ${t.description}` : ''}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 ml-3 shrink-0">
                    <span
                      className={cn(
                        'text-sm font-semibold tabular-nums',
                        t.type === 'income' && 'text-emerald-600 dark:text-emerald-400',
                        t.type === 'expense' && 'text-zinc-900 dark:text-zinc-100',
                        t.type === 'savings' && 'text-blue-600 dark:text-blue-400'
                      )}
                    >
                      {t.type === 'income' ? '+' : t.type === 'savings' ? '→' : '-'}
                      {formatCurrency(t.amount)}
                    </span>
                    <button
                      onClick={() => handleDelete(t.id)}
                      disabled={deleting === t.id}
                      className="opacity-0 group-hover:opacity-100 p-1 text-zinc-300 hover:text-red-500 transition-all"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
    </div>
  )
}
