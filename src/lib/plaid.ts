import { Configuration, PlaidApi, PlaidEnvironments, type AccountBase, type RemovedTransaction, type Transaction as PlaidTransaction } from 'plaid'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { TransactionType } from '@/types'

// Server-only: holds the Plaid secret. Never import from client components.
export const plaid = new PlaidApi(new Configuration({
  basePath: PlaidEnvironments[process.env.PLAID_ENV ?? 'sandbox'],
  baseOptions: {
    headers: {
      'PLAID-CLIENT-ID': process.env.PLAID_CLIENT_ID!,
      'PLAID-SECRET': process.env.PLAID_SECRET!,
    },
  },
}))

export function plaidErrorMessage(e: unknown): string {
  const data = (e as { response?: { data?: { error_code?: string; error_message?: string } } }).response?.data
  if (data?.error_code) return `${data.error_code}: ${data.error_message}`
  return e instanceof Error ? e.message : String(e)
}

function todayPacific() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Los_Angeles' }).format(new Date())
}

// Net worth snapshot key for a linked account, e.g. "Chase Checking ••1234"
export function accountLabel(a: { name: string; mask: string | null }) {
  return a.mask ? `${a.name} ••${a.mask}` : a.name
}

// Maps a Plaid transaction to this app's income/expense/savings model, or null to skip it.
// Plaid amounts are positive when money leaves the account. Moves between your own accounts
// (credit card payments, checking ↔ savings) are skipped so they aren't counted as spending/income,
// except outflows into savings/investments, which count as "savings" like a manual savings entry.
function classify(t: PlaidTransaction): TransactionType | null {
  const primary = t.personal_finance_category?.primary ?? ''
  const detailed = t.personal_finance_category?.detailed ?? ''
  if (detailed.includes('CREDIT_CARD_PAYMENT')) return null
  if (t.amount > 0) {
    if (primary === 'TRANSFER_OUT') {
      if (/SAVINGS|INVESTMENT|RETIREMENT/.test(detailed)) return 'savings'
      if (detailed.includes('ACCOUNT_TRANSFER')) return null
    }
    return 'expense'
  }
  if (primary === 'TRANSFER_IN' && /ACCOUNT_TRANSFER|SAVINGS|INVESTMENT|RETIREMENT/.test(detailed)) return null
  return 'income'
}

interface PlaidItemRow {
  id: string
  user_id: string
  access_token: string
  cursor: string | null
  sync_start_date: string
}

// Pulls every page of changes since the item's cursor. Restarts from the original cursor if
// Plaid reports the data changed mid-pagination, as its docs require.
async function fetchChanges(item: PlaidItemRow) {
  for (let attempt = 0; ; attempt++) {
    try {
      let cursor = item.cursor ?? undefined
      const added: PlaidTransaction[] = []
      const modified: PlaidTransaction[] = []
      const removed: RemovedTransaction[] = []
      let accounts: AccountBase[] = []
      let hasMore = true
      while (hasMore) {
        const { data } = await plaid.transactionsSync({ access_token: item.access_token, cursor, count: 500 })
        added.push(...data.added)
        modified.push(...data.modified)
        removed.push(...data.removed)
        accounts = data.accounts
        hasMore = data.has_more
        cursor = data.next_cursor
      }
      return { added, modified, removed, accounts, cursor }
    } catch (e) {
      const code = (e as { response?: { data?: { error_code?: string } } }).response?.data?.error_code
      if (code !== 'TRANSACTIONS_SYNC_MUTATION_DURING_PAGINATION' || attempt >= 2) throw e
    }
  }
}

async function syncItem(supabase: SupabaseClient, item: PlaidItemRow, merchantCategories: Map<string, string>) {
  const { added, modified, removed, accounts, cursor } = await fetchChanges(item)

  const rows = added
    .filter(t => !t.pending && t.date >= item.sync_start_date)
    .flatMap(t => {
      const type = classify(t)
      if (!type) return []
      const merchant = t.merchant_name || t.name
      return [{
        user_id: item.user_id,
        plaid_transaction_id: t.transaction_id,
        amount: Math.abs(t.amount),
        type,
        merchant,
        category_id: merchantCategories.get(merchant.trim().toLowerCase()) ?? null,
        date: t.date,
      }]
    })
  if (rows.length) {
    const { error } = await supabase.from('transactions')
      .upsert(rows, { onConflict: 'plaid_transaction_id', ignoreDuplicates: true })
    if (error) throw new Error(error.message)
  }

  // Only refresh bank-owned fields so user edits (category, type) survive
  for (const t of modified) {
    if (t.pending) continue
    const { error } = await supabase.from('transactions')
      .update({ amount: Math.abs(t.amount), date: t.date, merchant: t.merchant_name || t.name })
      .eq('plaid_transaction_id', t.transaction_id)
    if (error) throw new Error(error.message)
  }

  if (removed.length) {
    const { error } = await supabase.from('transactions')
      .delete()
      .in('plaid_transaction_id', removed.map(r => r.transaction_id))
    if (error) throw new Error(error.message)
  }

  if (accounts.length) {
    const { error } = await supabase.from('plaid_accounts').upsert(accounts.map(a => ({
      user_id: item.user_id,
      item_id: item.id,
      account_id: a.account_id,
      name: a.official_name || a.name,
      mask: a.mask,
      type: a.type,
      subtype: a.subtype,
      current_balance: a.balances.current,
    })), { onConflict: 'account_id' })
    if (error) throw new Error(error.message)
  }

  // Cursor is saved last so a failed write gets retried on the next sync
  const { error } = await supabase.from('plaid_items')
    .update({ cursor, last_synced_at: new Date().toISOString(), error: null })
    .eq('id', item.id)
  if (error) throw new Error(error.message)
}

// Writes linked account balances into today's net worth snapshot (carried forward from the latest one).
// Depository accounts are assets; credit cards and loans are liabilities. Investment accounts are
// skipped since holdings are tracked separately under "Investments". `remove` drops stale keys.
export async function applyBalancesToSnapshot(supabase: SupabaseClient, userId: string, remove: string[] = []) {
  const { data: accounts } = await supabase
    .from('plaid_accounts')
    .select('name, mask, type, current_balance')
    .eq('user_id', userId)
  if (!accounts?.length && !remove.length) return

  const { data: latest } = await supabase
    .from('net_worth_snapshots')
    .select('assets, liabilities')
    .eq('user_id', userId)
    .order('date', { ascending: false })
    .limit(1)
    .maybeSingle()

  const assets: Record<string, number> = { ...(latest?.assets ?? {}) }
  const liabilities: Record<string, number> = { ...(latest?.liabilities ?? {}) }
  for (const key of remove) {
    delete assets[key]
    delete liabilities[key]
  }
  for (const a of accounts ?? []) {
    if (a.current_balance == null) continue
    if (a.type === 'depository') assets[accountLabel(a)] = a.current_balance
    else if (a.type === 'credit' || a.type === 'loan') liabilities[accountLabel(a)] = a.current_balance
  }

  const total = Object.values(assets).reduce((s, v) => s + v, 0) -
    Object.values(liabilities).reduce((s, v) => s + v, 0)
  const { error } = await supabase.from('net_worth_snapshots').upsert(
    { user_id: userId, date: todayPacific(), assets, liabilities, total },
    { onConflict: 'user_id,date' }
  )
  if (error) throw new Error(error.message)
}

// Syncs every linked bank for a user. One failing bank (e.g. needs re-login) doesn't block the others;
// its error is stored on the item and returned.
export async function syncUser(supabase: SupabaseClient, userId: string) {
  const [{ data: items, error }, { data: memory }] = await Promise.all([
    supabase.from('plaid_items').select('id, user_id, access_token, cursor, sync_start_date').eq('user_id', userId),
    supabase.from('merchant_categories').select('merchant, category_id').eq('user_id', userId),
  ])
  if (error) throw new Error(error.message)

  const merchantCategories = new Map<string, string>()
  for (const m of memory ?? []) if (m.category_id) merchantCategories.set(m.merchant, m.category_id)

  const errors: string[] = []
  for (const item of items ?? []) {
    try {
      await syncItem(supabase, item, merchantCategories)
    } catch (e) {
      const message = plaidErrorMessage(e)
      errors.push(message)
      await supabase.from('plaid_items').update({ error: message }).eq('id', item.id)
    }
  }
  await applyBalancesToSnapshot(supabase, userId)
  return { synced: (items?.length ?? 0) - errors.length, errors }
}
