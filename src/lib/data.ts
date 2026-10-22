import type { ScopedMutator } from 'swr'
import type { PlaidItemSummary } from '@/types'
import { createClient } from '@/lib/supabase/client'
import { getMonthRange, localDateString, snapshotTotal, spendingAmount } from '@/lib/utils'

const supabase = () => createClient()

// PostgREST returns at most this many rows per request
const PAGE_SIZE = 1000

// Fetches every row of a query, a page at a time. The query must have a stable order (end it on a
// unique column) so rows don't shift between pages.
async function fetchAllRows<T>(page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>) {
  const rows: T[] = []
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await page(from, from + PAGE_SIZE - 1)
    if (error) throw error
    rows.push(...(data ?? []))
    if (!data || data.length < PAGE_SIZE) return rows
  }
}

// Applies a transaction's effect on an asset balance (e.g. Checking, Cash) to the latest net worth
// snapshot (creating today's snapshot, carried forward from the prior one, if it doesn't exist yet).
// `mutate` must be the context-bound mutator from the caller's `useSWRConfig()`, since SWRProvider
// uses a custom cache provider — the module-level `mutate` from 'swr' targets an unrelated cache.
// Once a bank is linked, its balances come straight from the bank, so only cash transactions (which the
// bank never sees) still adjust a balance by hand.
export async function adjustAccountBalance(delta: number, account: string = 'Checking', mutate?: ScopedMutator) {
  if (delta === 0) return
  if (account !== 'Cash') {
    const items = await fetchPlaidItems().catch(() => [])
    if (items.some(i => i.kind === 'bank')) return
  }
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
  const total = snapshotTotal(assets, liabilities)

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

// Calls one of this app's API routes, throwing its { error } message if it fails
export async function fetchJson<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, init)
  const body = await res.json()
  if (!res.ok) throw new Error(body.error ?? `Request failed (${res.status})`)
  return body
}

export function fetchPlaidItems() {
  return fetchJson<PlaidItemSummary[]>('/api/plaid/items')
}

// Renames a linked account's net worth entry or investment holding without breaking the link
export async function renameLinkedAccount(accountId: string, name: string) {
  await fetchJson(`/api/plaid/accounts/${encodeURIComponent(accountId)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  })
}

export async function fetchCategories() {
  const { data, error } = await supabase().from('categories').select('*').order('bucket').order('name')
  if (error) throw error
  return data ?? []
}

export async function fetchTransactions(monthKey: string) {
  // monthKey is 'YYYY-MM'
  const [year, month] = monthKey.split('-').map(Number)
  const d = new Date(year, month - 1, 1)
  const { start, end } = getMonthRange(d)
  return fetchAllRows((from, to) => supabase()
    .from('transactions')
    .select('*, category:categories(*)')
    .gte('date', start)
    .lte('date', end)
    .order('date', { ascending: false })
    .order('id')
    .range(from, to))
}

export async function fetchCashflow() {
  const months = Array.from({ length: 6 }, (_, i) => {
    const offset = 5 - i
    const now = new Date()
    const d = new Date(now.getFullYear(), now.getMonth() - offset, 1)
    return {
      label: d.toLocaleDateString('en-US', { month: 'short' }),
      ...getMonthRange(d),
    }
  })

  const rows = await fetchAllRows((from, to) => supabase()
    .from('transactions')
    .select('id, date, type, amount')
    .gte('date', months[0].start)
    .lte('date', months[months.length - 1].end)
    .order('id')
    .range(from, to))
  return months.map(({ label, start, end }) => {
    const mt = rows.filter(t => t.date >= start && t.date <= end)
    return {
      month: label,
      income: mt.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0),
      expenses: mt.reduce((s, t) => s + spendingAmount(t), 0),
      savings: mt.filter(t => t.type === 'savings').reduce((s, t) => s + t.amount, 0),
    }
  })
}

// Money available to spend this month: everything left over from all prior months, i.e.
// available(M) = available(M-1) + income(M-1) - expenses(M-1) - savings(M-1), unrolled.
// Summed in the database (see migration 021) rather than downloading every past transaction.
export async function fetchAvailable() {
  const { start } = getMonthRange()
  const { data, error } = await supabase().rpc('available_before', { before: start })
  if (error) throw error
  return Number(data ?? 0)
}

// Flagged transactions from any month, oldest first
export async function fetchNeedsReview() {
  const { data, error } = await supabase()
    .from('transactions')
    .select('*, category:categories(*)')
    .eq('needs_review', true)
    .order('date')
  if (error) throw error
  return data ?? []
}

export async function fetchGoals() {
  const { data, error } = await supabase().from('goals').select('*').order('created_at')
  if (error) throw error
  return data ?? []
}

export async function fetchSnapshots() {
  // One per day, so this passes a page within a few years
  return fetchAllRows((from, to) => supabase()
    .from('net_worth_snapshots')
    .select('*')
    .order('date', { ascending: true })
    .order('id')
    .range(from, to))
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
  return monthKey(0)
}

// 'YYYY-MM' for the month `offset` months before this one
export function monthKey(offset: number) {
  const now = new Date()
  const d = new Date(now.getFullYear(), now.getMonth() - offset, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}
