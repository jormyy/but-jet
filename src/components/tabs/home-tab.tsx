'use client'

import useSWR from 'swr'
import {
  fetchBills,
  fetchTransactions,
  fetchCashflow,
  currentMonthKey,
  monthKey,
} from '@/lib/data'
import { getMonthLabel, monthlyAmount, BUCKET_COLORS } from '@/lib/utils'
import { DashboardClient } from '@/components/dashboard/dashboard-client'
import { Transaction, RecurringBill, Category } from '@/types'

export function HomeTab() {
  const mk = currentMonthKey()
  const prevMk = monthKey(1)
  const { data: billsData } = useSWR('bills', fetchBills)
  const { data: txns } = useSWR(['txns', mk], ([, key]) => fetchTransactions(key as string))
  const { data: prevTxns } = useSWR(['txns', prevMk], ([, key]) => fetchTransactions(key as string))
  const { data: cashflowData } = useSWR('cashflow', fetchCashflow)

  const bills = (billsData?.bills ?? []) as RecurringBill[]
  const categories = (billsData?.categories ?? []) as Category[]
  const transactions = (txns ?? []) as Transaction[]
  const previousTransactions = (prevTxns ?? []) as Transaction[]

  const incomeThisMonth = transactions.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0)
  const expensesThisMonth = transactions.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0)
  const savingsThisMonth = transactions.filter(t => t.type === 'savings').reduce((s, t) => s + t.amount, 0)
  const committedBills = bills.filter(b => b.active).reduce((s, b) => s + monthlyAmount(b.amount, b.frequency), 0)

  const lastMonthIncome = previousTransactions.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0)
  const lastMonthExpenses = previousTransactions.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0)
  const lastMonthSavings = previousTransactions.filter(t => t.type === 'savings').reduce((s, t) => s + t.amount, 0)
  const lastMonthLeftover = lastMonthIncome - lastMonthExpenses - lastMonthSavings

  const remainingSpendable = lastMonthLeftover - expensesThisMonth - savingsThisMonth
  const savingsRate = incomeThisMonth > 0 ? (savingsThisMonth / incomeThisMonth) * 100 : 0

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

  return (
    <DashboardClient
      monthLabel={getMonthLabel()}
      incomeThisMonth={incomeThisMonth}
      expensesThisMonth={expensesThisMonth}
      savingsThisMonth={savingsThisMonth}
      committedBills={committedBills}
      remainingSpendable={remainingSpendable}
      savingsRate={savingsRate}
      spendingByCategory={spendingByCategory}
      cashflowData={cashflowData ?? []}
    />
  )
}
