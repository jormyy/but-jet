import { createClient } from '@/lib/supabase/client'
import { getMonthRange } from '@/lib/utils'

const supabase = () => createClient()

export async function fetchBills() {
  const [{ data: bills, error: billsError }, { data: categories, error: categoriesError }] = await Promise.all([
    supabase().from('recurring_bills').select('*, category:categories(*)').order('next_due_date'),
    supabase().from('categories').select('*').order('bucket').order('name'),
  ])
  if (billsError) throw billsError
  if (categoriesError) throw categoriesError
  return { bills: bills ?? [], categories: categories ?? [] }
}

export async function fetchTransactions(monthKey: string) {
  // monthKey is 'YYYY-MM'
  const [year, month] = monthKey.split('-').map(Number)
  const d = new Date(year, month - 1, 1)
  const { start, end } = getMonthRange(d)
  const { data, error } = await supabase()
    .from('transactions')
    .select('*, category:categories(*)')
    .gte('date', start)
    .lte('date', end)
    .order('date', { ascending: false })
  if (error) throw error
  return data ?? []
}

export async function fetchCashflow() {
  const months = Array.from({ length: 6 }, (_, i) => {
    const offset = 5 - i
    const d = new Date()
    d.setMonth(d.getMonth() - offset)
    return {
      label: d.toLocaleDateString('en-US', { month: 'short' }),
      ...getMonthRange(d),
    }
  })

  const results = await Promise.all(
    months.map(({ start, end }) =>
      supabase()
        .from('transactions')
        .select('type, amount')
        .gte('date', start)
        .lte('date', end)
    )
  )
  for (const { error } of results) {
    if (error) throw error
  }

  return months.map(({ label }, i) => {
    const mt = results[i].data ?? []
    return {
      month: label,
      income: mt.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0),
      expenses: mt.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0),
      savings: mt.filter(t => t.type === 'savings').reduce((s, t) => s + t.amount, 0),
    }
  })
}

export async function fetchGoals() {
  const { data, error } = await supabase().from('goals').select('*').order('created_at')
  if (error) throw error
  return data ?? []
}

export async function fetchSnapshots() {
  const { data, error } = await supabase()
    .from('net_worth_snapshots')
    .select('*')
    .order('date', { ascending: true })
  if (error) throw error
  return data ?? []
}

export async function fetchInvestments() {
  const { data, error } = await supabase()
    .from('investment_holdings')
    .select('*')
    .order('created_at')
  if (error) throw error
  return data ?? []
}

export function currentMonthKey() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

export function monthKey(offset: number) {
  const d = new Date()
  d.setMonth(d.getMonth() - offset)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}
