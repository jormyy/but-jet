'use client'

import useSWR, { mutate } from 'swr'
import { createClient } from '@/lib/supabase/client'
import { fetchTransactions, monthKey } from '@/lib/data'
import { Transaction } from '@/types'
import { TransactionList } from '@/components/transactions/transaction-list'
import { TransactionForm } from '@/components/transactions/transaction-form'
import { Modal } from '@/components/ui/modal'
import { Button } from '@/components/ui/button'
import { CategoryManager } from '@/components/transactions/category-manager'
import { useState } from 'react'
import { Plus, Settings2 } from 'lucide-react'

export function TransactionsTab() {
  const supabase = createClient()
  const [addOpen, setAddOpen] = useState(false)
  const [catsOpen, setCatsOpen] = useState(false)
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null)
  const [monthOffset, setMonthOffset] = useState(0)

  const mk = monthKey(monthOffset)
  const { data: transactions } = useSWR(['txns', mk], ([, key]) => fetchTransactions(key as string))

  const monthLabel = (() => {
    const d = new Date()
    d.setMonth(d.getMonth() - monthOffset)
    return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
  })()

  function refresh() {
    mutate(['txns', mk])
    mutate('cashflow')
  }

  return (
    <div className="px-4 pt-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">Transactions</h1>
        <div className="flex gap-2">
          <Button onClick={() => setCatsOpen(true)} variant="ghost" size="sm">
            <Settings2 size={14} />
          </Button>
          <Button onClick={() => setAddOpen(true)} size="sm">
            <Plus size={14} className="mr-1" />
            Add
          </Button>
        </div>
      </div>

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
    </div>
  )
}
