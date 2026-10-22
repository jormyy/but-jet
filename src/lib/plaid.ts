import { createHash, createPublicKey, timingSafeEqual, verify, type KeyObject } from 'node:crypto'
import { Configuration, PlaidApi, PlaidEnvironments, type AccountBase, type RemovedTransaction, type Transaction as PlaidTransaction } from 'plaid'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { InvestmentCategory, TransactionType } from '@/types'
import { notifyUser, type PushPayload } from '@/lib/push'
import { formatCurrency } from '@/lib/utils'

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

// Default name for a linked account, e.g. "Chase Checking ••1234"
export function accountLabel(a: { name: string; mask: string | null }) {
  return a.mask ? `${a.name} ••${a.mask}` : a.name
}

// The name a linked account appears under: its net worth entry key, or its investment holding's name
export function displayName(a: { display_name: string | null; name: string; mask: string | null }) {
  return a.display_name ?? accountLabel(a)
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

export type PlaidItemKind = 'bank' | 'investments'

// What the user set for a merchant: its category and optionally the name to show it under. A rule
// with neither still means the user has reviewed this merchant and is fine with it as-is.
interface MerchantRule {
  category_id: string | null
  rename_to: string | null
}

// Payments to/from people could be anything (splitting dinner, rent, paying someone back), so they're
// imported with a best-guess type (rather than skipped as transfers) and never auto-categorized.
const PERSON_PAYMENT = /zelle|venmo|cash app|apple cash/i

function isPersonPayment(t: PlaidTransaction) {
  return PERSON_PAYMENT.test(`${t.name} ${t.merchant_name ?? ''}`)
}

interface PlaidItemRow {
  id: string
  user_id: string
  kind: PlaidItemKind
  access_token: string
  cursor: string | null
  sync_start_date: string
}

// Fields shared by bank (AccountBase) and investment (InvestmentAccount) accounts
type PlaidAccount = Pick<AccountBase, 'account_id' | 'name' | 'official_name' | 'mask' | 'type' | 'subtype' | 'balances'>

async function upsertAccounts(supabase: SupabaseClient, item: PlaidItemRow, accounts: PlaidAccount[]) {
  if (!accounts.length) return
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

  // Pin each new account's display name; after this only a user rename changes it
  for (const a of accounts) {
    const { error: nameError } = await supabase.from('plaid_accounts')
      .update({ display_name: accountLabel({ name: a.official_name || a.name, mask: a.mask }) })
      .eq('account_id', a.account_id)
      .is('display_name', null)
    if (nameError) throw new Error(nameError.message)
  }
}

async function markSynced(supabase: SupabaseClient, item: PlaidItemRow, cursor?: string) {
  const { error } = await supabase.from('plaid_items')
    .update({ ...(cursor !== undefined && { cursor }), last_synced_at: new Date().toISOString(), error: null })
    .eq('id', item.id)
  if (error) throw new Error(error.message)
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

async function syncItem(supabase: SupabaseClient, item: PlaidItemRow, merchantRules: Map<string, MerchantRule>) {
  const { added, modified, removed, accounts, cursor } = await fetchChanges(item)

  const rows = added
    .filter(t => !t.pending && t.date >= item.sync_start_date)
    .flatMap(t => {
      const person = isPersonPayment(t)
      // For person payments the raw description says who it was with (e.g. "Zelle payment to Alex");
      // merchant_name would just be "Zelle"
      const bankMerchant = person ? t.name : (t.merchant_name || t.name)
      const rule = merchantRules.get(bankMerchant.trim().toLowerCase())
      const type: TransactionType | null = person ? (t.amount > 0 ? 'expense' : 'income') : classify(t)
      if (!type) return []
      return [{
        user_id: item.user_id,
        plaid_transaction_id: t.transaction_id,
        amount: Math.abs(t.amount),
        type,
        merchant: rule?.rename_to || bankMerchant,
        bank_merchant: bankMerchant,
        category_id: rule?.category_id ?? null,
        date: t.date,
        // Anything from a merchant the user hasn't reviewed yet goes to Needs review; reviewing it
        // creates a rule, so each merchant only needs reviewing once
        needs_review: !rule,
      }]
    })
  // Returns only rows actually inserted (not already-imported duplicates), for the review notification
  let inserted: { merchant: string | null; amount: number; needs_review: boolean }[] = []
  if (rows.length) {
    const { data, error } = await supabase.from('transactions')
      .upsert(rows, { onConflict: 'plaid_transaction_id', ignoreDuplicates: true })
      .select('merchant, amount, needs_review')
    if (error) throw new Error(error.message)
    inserted = data ?? []
  }

  // Only refresh bank-owned fields so user edits (type, category, merchant name set during review) survive
  for (const t of modified) {
    if (t.pending) continue
    const { error } = await supabase.from('transactions')
      .update({ amount: Math.abs(t.amount), date: t.date })
      .eq('plaid_transaction_id', t.transaction_id)
    if (error) throw new Error(error.message)
  }

  if (removed.length) {
    const { error } = await supabase.from('transactions')
      .delete()
      .in('plaid_transaction_id', removed.map(r => r.transaction_id))
    if (error) throw new Error(error.message)
  }

  await upsertAccounts(supabase, item, accounts)

  // Cursor is saved last so a failed write gets retried on the next sync
  await markSynced(supabase, item, cursor)
  return inserted.filter(t => t.needs_review)
}

// "3 transactions to review" (everything waiting), listing the ones this sync just added
function reviewNotification(added: { merchant: string | null; amount: number }[], waiting: number): PushPayload {
  const lines = added.slice(0, 3).map(t => `${t.merchant ?? 'Transaction'} · ${formatCurrency(t.amount)}`)
  if (added.length > 3) lines.push(`+${added.length - 3} more`)
  return {
    title: waiting === 1 ? '1 transaction to review' : `${waiting} transactions to review`,
    body: lines.join('\n'),
    url: '/review',
    tag: 'review',
  }
}

function holdingCategory(subtype: string | null): InvestmentCategory {
  const s = subtype ?? ''
  if (/401|403|457/.test(s)) return '401k'
  if (s === 'roth') return 'roth_ira'
  if (s.includes('ira')) return 'ira'
  if (s.includes('brokerage')) return 'brokerage'
  if (s.includes('crypto')) return 'crypto'
  return 'other'
}

// Investment connections (Fidelity, ADP, ...) sync each account's total as one holding.
// No ticker/shares, so the price-refresh cron leaves them alone; Plaid keeps them current.
async function syncInvestmentItem(supabase: SupabaseClient, item: PlaidItemRow) {
  const { data } = await plaid.investmentsHoldingsGet({ access_token: item.access_token })
  await upsertAccounts(supabase, item, data.accounts)

  const accounts = data.accounts.filter(a => (a.type === 'investment' || a.type === 'brokerage') && a.balances.current != null)
  if (accounts.length) {
    const ids = accounts.map(a => a.account_id)
    const [{ data: names }, { data: existing }] = await Promise.all([
      supabase.from('plaid_accounts').select('account_id, display_name').in('account_id', ids),
      supabase.from('investment_holdings').select('plaid_account_id').in('plaid_account_id', ids),
    ])
    const nameById = new Map(names?.map(n => [n.account_id, n.display_name as string | null]))
    const existingIds = new Set(existing?.map(h => h.plaid_account_id))

    for (const a of accounts) {
      const values = {
        name: nameById.get(a.account_id) ?? accountLabel({ name: a.official_name || a.name, mask: a.mask }),
        current_value: a.balances.current!,
        value_date: todayPacific(),
      }
      // Category is only set on creation so the user can change it afterwards
      const { error } = existingIds.has(a.account_id)
        ? await supabase.from('investment_holdings').update(values).eq('plaid_account_id', a.account_id)
        : await supabase.from('investment_holdings').upsert(
            { ...values, user_id: item.user_id, plaid_account_id: a.account_id, category: holdingCategory(a.subtype) },
            { onConflict: 'plaid_account_id', ignoreDuplicates: true }
          )
      if (error) throw new Error(error.message)
    }
  }

  await markSynced(supabase, item)
}

// Writes linked account balances into today's net worth snapshot (carried forward from the latest one).
// Depository accounts are assets; credit cards and loans are liabilities. Investment accounts count
// through "Investments", recomputed from holdings like the snapshot cron does. `remove` drops stale keys.
export async function applyBalancesToSnapshot(supabase: SupabaseClient, userId: string, remove: string[] = []) {
  const [{ data: accounts }, { data: holdings }] = await Promise.all([
    supabase.from('plaid_accounts').select('name, mask, display_name, type, current_balance').eq('user_id', userId),
    supabase.from('investment_holdings').select('current_value').eq('user_id', userId),
  ])
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
    if (a.type === 'depository') assets[displayName(a)] = a.current_balance
    else if (a.type === 'credit' || a.type === 'loan') liabilities[displayName(a)] = a.current_balance
  }
  const portfolioTotal = (holdings ?? []).reduce((s, h) => s + h.current_value, 0)
  if (portfolioTotal > 0) assets['Investments'] = portfolioTotal
  else delete assets['Investments']

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
    supabase.from('plaid_items').select('id, user_id, kind, access_token, cursor, sync_start_date').eq('user_id', userId),
    supabase.from('merchant_categories').select('merchant, category_id, rename_to').eq('user_id', userId),
  ])
  if (error) throw new Error(error.message)

  const merchantRules = new Map<string, MerchantRule>()
  for (const m of memory ?? []) merchantRules.set(m.merchant, { category_id: m.category_id, rename_to: m.rename_to })

  const errors: string[] = []
  const flagged: { merchant: string | null; amount: number }[] = []
  for (const item of items ?? []) {
    try {
      if (item.kind === 'investments') await syncInvestmentItem(supabase, item)
      else flagged.push(...await syncItem(supabase, item, merchantRules))
    } catch (e) {
      const message = plaidErrorMessage(e)
      errors.push(message)
      await supabase.from('plaid_items').update({ error: message }).eq('id', item.id)
    }
  }
  await applyBalancesToSnapshot(supabase, userId)

  if (flagged.length) {
    try {
      const { count } = await supabase.from('transactions')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('needs_review', true)
      await notifyUser(supabase, userId, reviewNotification(flagged, count ?? flagged.length))
    } catch (e) {
      // A failed notification shouldn't fail the sync
      console.error('Review notification failed:', e)
    }
  }
  return { synced: (items?.length ?? 0) - errors.length, errors }
}

// Plaid signs each webhook with a JWT (ES256) in the Plaid-Verification header. It's valid if the
// signature checks out against Plaid's published key, it's under 5 minutes old, and its body hash
// matches the raw request body. Keys are cached per instance since they rarely rotate.
const webhookKeys = new Map<string, KeyObject>()

export async function verifyPlaidWebhook(body: string, token: string | null): Promise<boolean> {
  if (!token) return false
  try {
    const [header, payload, signature] = token.split('.')
    const { alg, kid } = JSON.parse(Buffer.from(header, 'base64url').toString())
    if (alg !== 'ES256' || typeof kid !== 'string') return false

    let key = webhookKeys.get(kid)
    if (!key) {
      const { data } = await plaid.webhookVerificationKeyGet({ key_id: kid })
      if (data.key.expired_at != null) return false
      const { kty, crv, x, y } = data.key
      key = createPublicKey({ key: { kty, crv, x, y }, format: 'jwk' })
      webhookKeys.set(kid, key)
    }

    const signed = Buffer.from(`${header}.${payload}`)
    if (!verify('sha256', signed, { key, dsaEncoding: 'ieee-p1363' }, Buffer.from(signature, 'base64url'))) return false

    const claims = JSON.parse(Buffer.from(payload, 'base64url').toString())
    if (Date.now() / 1000 - claims.iat > 5 * 60) return false

    const bodyHash = Buffer.from(createHash('sha256').update(body).digest('hex'))
    const claimedHash = Buffer.from(String(claims.request_body_sha256))
    return bodyHash.length === claimedHash.length && timingSafeEqual(bodyHash, claimedHash)
  } catch {
    return false
  }
}
