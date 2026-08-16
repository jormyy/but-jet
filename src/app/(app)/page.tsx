import { createClient } from '@/lib/supabase/server'
import { getMonthRange, getMonthLabel, monthlyAmount, BUCKET_COLORS } from '@/lib/utils'
import { StatCard } from '@/components/ui/stat-card'
import { SpendingPie } from '@/components/charts/spending-pie'
import { CashflowBar } from '@/components/charts/cashflow-bar'
import { Category, RecurringBill, Transaction } from '@/types'
import { DashboardClient } from '@/components/dashboard/dashboard-client'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { start, end } = getMonthRange()

  const [
    { data: transactions },
    { data: bills },
    { data: categories },
  ] = await Promise.all([
    supabase
      .from('transactions')
      .select('*, category:categories(*)')
      .eq('user_id', user.id)
      .gte('date', start)
      .lte('date', end)
      .order('date', { ascending: false }),
    supabase
      .from('recurring_bills')
      .select('*, category:categories(*)')
      .eq('user_id', user.id)
      .eq('active', true),
    supabase
      .from('categories')
      .select('*')
      .eq('user_id', user.id),
  ])

  const txns = (transactions ?? []) as Transaction[]
  const activeBills = (bills ?? []) as RecurringBill[]
  const cats = (categories ?? []) as Category[]

  const incomeThisMonth = txns.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0)
  const expensesThisMonth = txns.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0)
  const savingsThisMonth = txns.filter(t => t.type === 'savings').reduce((s, t) => s + t.amount, 0)
  const committedBills = activeBills.reduce((s, b) => s + monthlyAmount(b.amount, b.frequency), 0)
  const remainingSpendable = incomeThisMonth - expensesThisMonth - savingsThisMonth
  const savingsRate = incomeThisMonth > 0 ? (savingsThisMonth / incomeThisMonth) * 100 : 0

  // Spending by category
  const catMap: Record<string, { category: string; amount: number; bucket: string; color: string }> = {}
  for (const t of txns.filter(t => t.type === 'expense')) {
    const key = t.category_id ?? '__none__'
    const cat = cats.find(c => c.id === t.category_id)
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

  // Last 6 months cashflow
  const monthlyData: { month: string; income: number; expenses: number; savings: number }[] = []
  for (let i = 5; i >= 0; i--) {
    const d = new Date()
    d.setMonth(d.getMonth() - i)
    const { start: mStart, end: mEnd } = getMonthRange(d)
    const label = d.toLocaleDateString('en-US', { month: 'short' })

    const { data: mTxns } = await supabase
      .from('transactions')
      .select('type, amount')
      .eq('user_id', user.id)
      .gte('date', mStart)
      .lte('date', mEnd)

    const mt = mTxns ?? []
    monthlyData.push({
      month: label,
      income: mt.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0),
      expenses: mt.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0),
      savings: mt.filter(t => t.type === 'savings').reduce((s, t) => s + t.amount, 0),
    })
  }

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
      cashflowData={monthlyData}
      userId={user.id}
    />
  )
}
