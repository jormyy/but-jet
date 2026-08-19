'use client'

import { Transaction } from '@/types'
import { formatCurrency, formatDate, transactionDelta } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { adjustCheckingBalance } from '@/lib/data'
import { useState } from 'react'
import { SwipeableRow } from '@/components/ui/swipeable-row'
import { ConfirmDeleteDialog } from '@/components/ui/confirm-delete-dialog'
import { cn } from '@/lib/utils'

interface TransactionListProps {
  transactions: Transaction[]
  onDelete: () => void
  onEdit: (t: Transaction) => void
}

export function TransactionList({ transactions, onDelete, onEdit }: TransactionListProps) {
  const supabase = createClient()
  const [deleting, setDeleting] = useState(false)
  const [confirmTarget, setConfirmTarget] = useState<Transaction | null>(null)

  async function handleConfirmDelete() {
    if (!confirmTarget) return
    setDeleting(true)
    const { error } = await supabase.from('transactions').delete().eq('id', confirmTarget.id)
    if (!error) {
      await adjustCheckingBalance(-transactionDelta(confirmTarget.type, confirmTarget.amount))
    }
    setDeleting(false)
    setConfirmTarget(null)
    onDelete()
  }

  if (!transactions.length) {
    return (
      <div className="text-center py-12 text-zinc-400 text-sm">
        No transactions yet
      </div>
    )
  }

  const grouped: Record<string, Transaction[]> = {}
  for (const t of transactions) {
    if (!grouped[t.date]) grouped[t.date] = []
    grouped[t.date].push(t)
  }

  return (
    <>
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
                  <SwipeableRow key={t.id} onEdit={() => onEdit(t)} onDelete={() => setConfirmTarget(t)}>
                    <div className="flex items-center justify-between px-4 py-3 bg-white dark:bg-zinc-900">
                      <div className="flex flex-col min-w-0">
                        <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100 truncate">
                          {t.merchant || t.description || 'Unnamed'}
                        </span>
                        <span className="text-xs text-zinc-400 truncate">
                          {t.category?.name ?? 'Uncategorized'}
                          {t.description && t.merchant ? ` · ${t.description}` : ''}
                        </span>
                      </div>
                      <span
                        className={cn(
                          'text-sm font-semibold tabular-nums ml-3 shrink-0',
                          t.type === 'income' && 'text-emerald-600 dark:text-emerald-400',
                          t.type === 'expense' && 'text-zinc-900 dark:text-zinc-100',
                          t.type === 'savings' && 'text-blue-600 dark:text-blue-400'
                        )}
                      >
                        {t.type === 'income' ? '+' : t.type === 'savings' ? '→' : '-'}
                        {formatCurrency(t.amount)}
                      </span>
                    </div>
                  </SwipeableRow>
                ))}
              </div>
            </div>
          ))}
      </div>

      <ConfirmDeleteDialog
        open={!!confirmTarget}
        title="Delete transaction?"
        description={`${confirmTarget?.merchant || confirmTarget?.description || 'Unnamed'} · ${confirmTarget ? formatCurrency(confirmTarget.amount) : ''}`}
        loading={deleting}
        onCancel={() => setConfirmTarget(null)}
        onConfirm={handleConfirmDelete}
      />
    </>
  )
}
