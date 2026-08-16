'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Transaction, Category } from '@/types'
import { TransactionList } from '@/components/transactions/transaction-list'
import { TransactionForm } from '@/components/transactions/transaction-form'
import { Modal } from '@/components/ui/modal'
import { Button } from '@/components/ui/button'
import { CategoryManager } from '@/components/transactions/category-manager'
import { Plus, Settings2 } from 'lucide-react'
import { getMonthRange } from '@/lib/utils'

export default function TransactionsPage() {
  const supabase = createClient()
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [addOpen, setAddOpen] = useState(false)
  const [catsOpen, setCatsOpen] = useState(false)
  const [monthOffset, setMonthOffset] = useState(0)

  const load = useCallback(async () => {
    const d = new Date()
    d.setMonth(d.getMonth() - monthOffset)
    const { start, end } = getMonthRange(d)

    const { data } = await supabase
      .from('transactions')
      .select('*, category:categories(*)')
      .gte('date', start)
      .lte('date', end)
      .order('date', { ascending: false })

    setTransactions((data ?? []) as Transaction[])
  }, [monthOffset])

  useEffect(() => { load() }, [load])

  const monthLabel = (() => {
    const d = new Date()
    d.setMonth(d.getMonth() - monthOffset)
    return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
  })()

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

      <TransactionList transactions={transactions} onDelete={load} />

      <Modal open={addOpen} onClose={() => setAddOpen(false)} title="Add transaction">
        <TransactionForm onSuccess={() => { setAddOpen(false); load() }} />
      </Modal>

      <Modal open={catsOpen} onClose={() => setCatsOpen(false)} title="Categories">
        <CategoryManager />
      </Modal>
    </div>
  )
}
