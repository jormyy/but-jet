'use client'

import { useDeferredValue } from 'react'
import useSWR from 'swr'
import { fetchBills, fetchCategories, fetchTransactions, fetchCashflow, currentMonthKey } from '@/lib/data'
import { getMonthLabel, monthlyAmount, BUCKET_COLORS } from '@/lib/utils'
import { DashboardClient } from '@/components/dashboard/dashboard-client'
import { Transaction, RecurringBill, Category } from '@/types'

export function HomeTab() {
  const mk = currentMonthKey()
  const { data: billsData } = useSWR('bills', fetchBills)
  const { data: categoriesData } = useSWR('categories', fetchCategories)
  const { data: txns, isLoading: txnsLoading } = useSWR(['txns', mk], ([, key]) => fetchTransactions(key as string))
  const { data: cashflowData } = useSWR('cashflow', fetchCashflow)

  const bills = (billsData ?? []) as RecurringBill[]
  const categories = (categoriesData ?? []) as Category[]
  const transactions = (txns ?? []) as Transaction[]

  const incomeThisMonth = transactions.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0)
  const expensesThisMonth = transactions.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0)
  const savingsThisMonth = transactions.filter(t => t.type === 'savings').reduce((s, t) => s + t.amount, 0)
  const committedBills = bills.filter(b => b.active).reduce((s, b) => s + monthlyAmount(b.amount, b.frequency), 0)

  // Last month's totals already come back with the six-month cash flow, so
  // there is no reason to fetch that month's transactions a second time.
  const lastMonth = cashflowData?.[cashflowData.length - 2]
  const lastMonthLeftover = lastMonth ? lastMonth.income - lastMonth.expenses - lastMonth.savings : 0

  const remainingSpendable = lastMonthLeftover - expensesThisMonth - savingsThisMonth
  const savingsRate = lastMonthLeftover === 0 ? Infinity : (savingsThisMonth / lastMonthLeftover) * 100

  const catMap: Record<string, { category: string; amount: number; bucket: string; color: string }> = {}
  for (const t of transactions.filter(t => t.type === 'expense')) {
    const cat = categories.find(c => c.id === t.category_id)
    const key = cat?.id ?? '__none__'
    if (!catMap[key]) {
      catMap[key] = {
        category: cat?.name ?? 'Uncategorized',
        amount: 0,
        bucket: cat?.bucket ?? 'spending',
        color: cat?.color ?? BUCKET_COLORS['spending'],
      }
    }
    catMap[key].amount += t.amount
  }
  const spendingByCategory = Object.values(catMap).sort((a, b) => b.amount - a.amount)

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
      committedBills={committedBills}
      remainingSpendable={remainingSpendable}
      savingsRate={savingsRate}
      spendingByCategory={deferredSpendingByCategory}
      cashflowData={deferredCashflowData}
      showBreakdown={txnsLoading || spendingByCategory.length > 0}
    />
  )
}
