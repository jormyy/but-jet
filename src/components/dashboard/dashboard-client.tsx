'use client'

import { useState } from 'react'
import { useSWRConfig } from 'swr'
import dynamic from 'next/dynamic'
import { StatCard } from '@/components/ui/stat-card'
import { ChartFrame } from '@/components/charts/chart-frame'
import { Skeleton } from '@/components/ui/skeleton'
import { Modal } from '@/components/ui/modal'
import { TransactionForm } from '@/components/transactions/transaction-form'
import { Button } from '@/components/ui/button'
import { Plus, LogOut, Infinity as InfinityIcon } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { clearPersistedCaches } from '@/lib/swr-cache'
import { currentMonthKey } from '@/lib/data'

// Recharts is by far the largest thing the app ships and none of the figures
// above the charts need it. Loading it separately keeps it off the path to a
// readable dashboard.
const SpendingPie = dynamic(() => import('@/components/charts/spending-pie').then(m => ({ default: m.SpendingPie })), { loading: () => <ChartFrame /> })
const CashflowBar = dynamic(() => import('@/components/charts/cashflow-bar').then(m => ({ default: m.CashflowBar })), { loading: () => <ChartFrame /> })

interface Props {
  monthLabel: string
  incomeThisMonth: number
  expensesThisMonth: number
  savingsThisMonth: number
  committedBills: number
  remainingSpendable: number
  savingsRate: number
  spendingByCategory: { category: string; amount: number; bucket: string; color: string }[]
  cashflowData: { month: string; income: number; expenses: number; savings: number }[]
  showBreakdown: boolean
}

export function DashboardClient({
  monthLabel,
  incomeThisMonth,
  expensesThisMonth,
  savingsThisMonth,
  committedBills,
  remainingSpendable,
  savingsRate,
  spendingByCategory,
  cashflowData,
  showBreakdown,
}: Props) {
  const [addOpen, setAddOpen] = useState(false)
  const supabase = createClient()
  const { mutate } = useSWRConfig()

  async function handleSignOut() {
    await supabase.auth.signOut()
    // The persisted cache holds this account's balances and transactions. It
    // has to go with the session, or the next person to sign in on this device
    // sees them while their own data is still loading.
    clearPersistedCaches()
    // A full load, not a client navigation: it is the only way to be sure no
    // component is still holding this account's data in memory.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.href = '/login'
  }

  function handleTransactionAdded() {
    setAddOpen(false)
    const mk = currentMonthKey()
    mutate(['txns', mk])
    mutate('cashflow')
  }

  return (
    <div className="px-4 pt-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">But Jet</h1>
          <p className="text-sm text-zinc-400">{monthLabel}</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => setAddOpen(true)} size="sm">
            <Plus size={14} className="mr-1" />
            Add
          </Button>
          <Button onClick={handleSignOut} variant="ghost" size="sm">
            <LogOut size={14} />
          </Button>
        </div>
      </div>

      {/* Key stats */}
      <div className="grid grid-cols-2 gap-3">
        <StatCard label="Income" value={incomeThisMonth} accent="green" />
        <StatCard label="Spent" value={expensesThisMonth} accent="orange" />
        <StatCard
          label="Saved"
          value={savingsThisMonth}
          accent="blue"
          sub={
            Number.isFinite(savingsRate) ? (
              `${savingsRate.toFixed(0)}% of available`
            ) : (
              <>
                <InfinityIcon size={12} strokeWidth={2.5} /> of available
              </>
            )
          }
        />
        <StatCard
          label="Remaining"
          value={remainingSpendable}
          accent={remainingSpendable >= 0 ? 'green' : 'red'}
          sub={committedBills > 0 ? `${formatCurrency(committedBills)}/mo in bills` : undefined}
        />
      </div>

      {/* Spending breakdown. Rendered while loading too: appearing only once the
          data lands used to shove the cash flow card 462px down the page. */}
      {showBreakdown && (
        <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-100 dark:border-zinc-800 p-4">
          <h2 className="text-sm font-medium text-zinc-900 dark:text-zinc-100 mb-3">Spending breakdown</h2>
          <SpendingPie data={spendingByCategory} />
          <div className="mt-3 space-y-1">
            {spendingByCategory.length > 0
              ? spendingByCategory.map(c => (
                <div key={c.category} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ background: c.color }} />
                    <span className="text-zinc-600 dark:text-zinc-400">{c.category}</span>
                  </div>
                  <span className="font-medium text-zinc-900 dark:text-zinc-100">{formatCurrency(c.amount)}</span>
                </div>
              ))
              : Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-5" />)}
          </div>
        </div>
      )}

      {/* 6-month cashflow */}
      <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-100 dark:border-zinc-800 p-4">
        <h2 className="text-sm font-medium text-zinc-900 dark:text-zinc-100 mb-3">6-month cash flow</h2>
        <CashflowBar data={cashflowData} />
      </div>

      {/* Add transaction modal */}
      <Modal open={addOpen} onClose={() => setAddOpen(false)} title="Add transaction">
        <TransactionForm onSuccess={handleTransactionAdded} />
      </Modal>
    </div>
  )
}
