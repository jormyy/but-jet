import type { ScopedMutator } from 'swr'
import { createClient } from '@/lib/supabase/client'
import { getMonthRange, localDateString } from '@/lib/utils'

const supabase = () => createClient()

// Applies a transaction's effect on an asset balance (e.g. Checking, Cash) to the latest net worth
// snapshot (creating today's snapshot, carried forward from the prior one, if it doesn't exist yet).
// `mutate` must be the context-bound mutator from the caller's `useSWRConfig()`, since SWRProvider
// uses a custom cache provider — the module-level `mutate` from 'swr' targets an unrelated cache.
export async function adjustAccountBalance(delta: number, account: string = 'Checking', mutate?: ScopedMutator) {
  if (delta === 0) return
  const client = supabase()
  const { data: { user } } = await client.auth.getUser()
  if (!user) return

  const { data: latest } = await client
    .from('net_worth_snapshots')
    .select('date, assets, liabilities')
    .order('date', { ascending: false })
    .limit(1)
    .maybeSingle()

  const assets: Record<string, number> = { ...(latest?.assets ?? {}) }
  assets[account] = (assets[account] ?? 0) + delta
  const liabilities: Record<string, number> = latest?.liabilities ?? {}
  const total = Object.values(assets).reduce((s, v) => s + v, 0) - Object.values(liabilities).reduce((s, v) => s + v, 0)

  const today = localDateString()
  const { error } = await client
    .from('net_worth_snapshots')
    .upsert({ user_id: user.id, date: today, assets, liabilities, total }, { onConflict: 'user_id,date' })

  if (error) {
    console.error('adjustAccountBalance failed:', error.message)
    return
  }
  mutate?.('snapshots')
}

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

  const { data, error } = await supabase()
    .from('transactions')
    .select('date, type, amount')
    .gte('date', months[0].start)
    .lte('date', months[months.length - 1].end)
  if (error) throw error

  const rows = data ?? []
  return months.map(({ label, start, end }) => {
    const mt = rows.filter(t => t.date >= start && t.date <= end)
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
