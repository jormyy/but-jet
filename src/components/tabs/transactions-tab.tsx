'use client'

import useSWR, { useSWRConfig } from 'swr'
import { createClient } from '@/lib/supabase/client'
import { fetchNeedsReview, fetchTransactions, monthKey } from '@/lib/data'
import { Transaction } from '@/types'
import { TransactionList } from '@/components/transactions/transaction-list'
import { TransactionForm } from '@/components/transactions/transaction-form'
import { Modal } from '@/components/ui/modal'
import { Button } from '@/components/ui/button'
import { CategoryManager } from '@/components/transactions/category-manager'
import { BankManager } from '@/components/transactions/bank-manager'
import { useState } from 'react'
import { Landmark, Plus, Settings2 } from 'lucide-react'

export function TransactionsTab() {
  const supabase = createClient()
  const { mutate } = useSWRConfig()
  const [addOpen, setAddOpen] = useState(false)
  const [catsOpen, setCatsOpen] = useState(false)
  const [banksOpen, setBanksOpen] = useState(false)
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null)
  const [monthOffset, setMonthOffset] = useState(0)

  const mk = monthKey(monthOffset)
  const { data: transactions } = useSWR(['txns', mk], ([, key]) => fetchTransactions(key as string))
  const { data: needsReview } = useSWR('review', fetchNeedsReview)

  const monthLabel = (() => {
    const now = new Date()
    const d = new Date(now.getFullYear(), now.getMonth() - monthOffset, 1)
    return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
  })()

  // Flagged transactions can be from any month, so refresh every loaded month
  function refresh() {
    mutate(key => Array.isArray(key) && key[0] === 'txns')
    mutate('cashflow')
    mutate('available')
    mutate('review')
  }

  // A sync can touch any month, linked account balances, and synced investment holdings
  function refreshAfterSync() {
    mutate(key => Array.isArray(key) && key[0] === 'txns')
    mutate('cashflow')
    mutate('available')
    mutate('snapshots')
    mutate('investments')
    mutate('review')
  }

  return (
    <div className="px-4 pt-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">Transactions</h1>
        <div className="flex gap-2">
          <Button onClick={() => setBanksOpen(true)} variant="ghost" size="sm" aria-label="Linked accounts">
            <Landmark size={14} />
          </Button>
          <Button onClick={() => setCatsOpen(true)} variant="ghost" size="sm">
            <Settings2 size={14} />
          </Button>
          <Button onClick={() => setAddOpen(true)} size="sm">
            <Plus size={14} className="mr-1" />
            Add
          </Button>
        </div>
      </div>

      {!!needsReview?.length && (
        <div className="rounded-xl border border-amber-200 dark:border-amber-900/60 bg-amber-50/60 dark:bg-amber-950/20 p-3 space-y-3">
          <div>
            <p className="text-sm font-medium text-amber-700 dark:text-amber-400">Needs review · {needsReview.length}</p>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              New merchants and payments to or from people. Edit each to set its name and category, which is remembered for next time, or delete ones that just moved money between your own accounts.
            </p>
          </div>
          <TransactionList
            transactions={needsReview as Transaction[]}
            onDelete={refresh}
            onEdit={setEditingTransaction}
          />
        </div>
      )}

      {/* Month selector */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => setMonthOffset(o => o + 1)}
          className="text-sm text-zinc-400 hover:text-zinc-600 px-2"
        >
          ←
        </button>
        <span className="text-sm font-medium text-zinc-600 dark:text-zinc-300 flex-1 text-center">{monthLabel}</span>
        <button
          onClick={() => setMonthOffset(o => Math.max(0, o - 1))}
          className="text-sm text-zinc-400 hover:text-zinc-600 px-2 disabled:opacity-30"
          disabled={monthOffset === 0}
        >
          →
        </button>
      </div>

      <TransactionList
        transactions={(transactions ?? []) as Transaction[]}
        onDelete={refresh}
        onEdit={setEditingTransaction}
      />

      <Modal open={addOpen} onClose={() => setAddOpen(false)} title="Add transaction">
        <TransactionForm onSuccess={() => { setAddOpen(false); refresh() }} />
      </Modal>

      <Modal open={!!editingTransaction} onClose={() => setEditingTransaction(null)} title="Edit transaction">
        {editingTransaction && (
          <TransactionForm
            transaction={editingTransaction}
            onSuccess={() => { setEditingTransaction(null); refresh() }}
          />
        )}
      </Modal>

      <Modal open={catsOpen} onClose={() => setCatsOpen(false)} title="Categories">
        <CategoryManager />
      </Modal>

      <Modal open={banksOpen} onClose={() => setBanksOpen(false)} title="Linked accounts">
        <BankManager onSynced={refreshAfterSync} />
      </Modal>
    </div>
  )
}
