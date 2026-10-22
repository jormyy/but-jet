'use client'

import { useDeferredValue } from 'react'
import useSWR from 'swr'
import {
  fetchCategories,
  fetchTransactions,
  fetchCashflow,
  fetchAvailable,
  currentMonthKey,
} from '@/lib/data'
import { getMonthLabel, spendingAmount, BUCKET_COLORS } from '@/lib/utils'
import { DashboardClient } from '@/components/dashboard/dashboard-client'
import { Transaction, Category } from '@/types'

export function HomeTab() {
  const mk = currentMonthKey()
  const { data: categoriesData } = useSWR('categories', fetchCategories)
  const { data: txns } = useSWR(['txns', mk], ([, key]) => fetchTransactions(key as string))
  const { data: cashflowData } = useSWR('cashflow', fetchCashflow)
  const { data: availableData } = useSWR('available', fetchAvailable)

  const categories = (categoriesData ?? []) as Category[]
  const transactions = (txns ?? []) as Transaction[]
  const available = availableData ?? 0

  const incomeThisMonth = transactions.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0)
  const expensesThisMonth = transactions.reduce((s, t) => s + spendingAmount(t), 0)
  const savingsThisMonth = transactions.filter(t => t.type === 'savings').reduce((s, t) => s + t.amount, 0)

  const remainingSpendable = available - expensesThisMonth - savingsThisMonth
  const savingsRate = available === 0 ? Infinity : (savingsThisMonth / available) * 100

  const categoriesById = new Map(categories.map(c => [c.id, c]))
  const catMap: Record<string, { category: string; amount: number; bucket: string; color: string }> = {}
  for (const t of transactions) {
    const amount = spendingAmount(t)
    if (amount === 0) continue
    const cat = t.category_id ? categoriesById.get(t.category_id) : undefined
    const key = cat?.id ?? '__none__'
    if (!catMap[key]) {
      catMap[key] = {
        category: cat?.name ?? 'Uncategorized',
        amount: 0,
        bucket: cat?.bucket ?? 'spending',
        color: cat?.color ?? BUCKET_COLORS['spending'],
      }
    }
    catMap[key].amount += amount
  }
  // A category can net to zero or below if a reimbursement lands in a later month than the expense
  const spendingByCategory = Object.values(catMap).filter(c => c.amount > 0).sort((a, b) => b.amount - a.amount)

  // The pie/bar charts do an expensive synchronous SVG layout pass on every
  // data change. Deferring their inputs lets React commit the cheap parts of
  // the page (stat cards, numbers) immediately and render the charts as a
  // low-priority, interruptible update instead — so a nav tap that lands
  // while data is still loading doesn't get stuck behind the chart render.
  const deferredSpendingByCategory = useDeferredValue(spendingByCategory)
  const deferredCashflowData = useDeferredValue(cashflowData ?? [])

  return (
    <DashboardClient
      monthLabel={getMonthLabel()}
      incomeThisMonth={incomeThisMonth}
      expensesThisMonth={expensesThisMonth}
      savingsThisMonth={savingsThisMonth}
      remainingSpendable={remainingSpendable}
      savingsRate={savingsRate}
      spendingByCategory={deferredSpendingByCategory}
      cashflowData={deferredCashflowData}
    />
  )
}
