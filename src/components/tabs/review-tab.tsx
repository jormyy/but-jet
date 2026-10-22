'use client'

import useSWR, { useSWRConfig } from 'swr'
import { useState } from 'react'
import { CheckCircle2 } from 'lucide-react'
import { fetchNeedsReview } from '@/lib/data'
import { Transaction } from '@/types'
import { TransactionList } from '@/components/transactions/transaction-list'
import { TransactionForm } from '@/components/transactions/transaction-form'
import { Modal } from '@/components/ui/modal'
import { NotificationToggle } from '@/components/review/notification-toggle'

// Synced transactions the app couldn't settle on its own: new merchants and payments to/from people.
export function ReviewTab() {
  const { mutate } = useSWRConfig()
  const { data: needsReview } = useSWR('review', fetchNeedsReview)
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null)
  const items = (needsReview ?? []) as Transaction[]

  // Reviewed transactions can be from any month, and reviewing can change totals
  function refresh() {
    mutate(key => Array.isArray(key) && key[0] === 'txns')
    mutate('cashflow')
    mutate('available')
    mutate('review')
  }

  return (
    <div className="px-4 pt-6 space-y-4">
      <div>
        <div className="flex items-start justify-between gap-3">
          <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">
            Review{items.length ? ` · ${items.length}` : ''}
          </h1>
          <NotificationToggle />
        </div>
        <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
          New merchants and payments to or from people. Edit each to set its name and category, which is
          remembered for next time, or delete ones that just moved money between your own accounts.
        </p>
      </div>

      {needsReview && !items.length ? (
        <div className="flex flex-col items-center gap-2 py-16 text-zinc-400">
          <CheckCircle2 size={28} strokeWidth={1.5} />
          <p className="text-sm">All caught up</p>
        </div>
      ) : (
        <TransactionList transactions={items} onDelete={refresh} onEdit={setEditingTransaction} />
      )}

      <Modal open={!!editingTransaction} onClose={() => setEditingTransaction(null)} title="Review transaction">
        {editingTransaction && (
          <TransactionForm
            transaction={editingTransaction}
            onSuccess={() => { setEditingTransaction(null); refresh() }}
          />
        )}
      </Modal>
    </div>
  )
}
