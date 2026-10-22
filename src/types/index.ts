export type Bucket = 'bills' | 'spending' | 'savings'
export type TransactionType = 'income' | 'expense' | 'savings' | 'reimbursement'

export interface Category {
  id: string
  user_id: string
  name: string
  bucket: Bucket
  color: string
  created_at: string
}

export interface Transaction {
  id: string
  user_id: string
  amount: number
  type: TransactionType
  merchant: string | null
  description: string | null
  category_id: string | null
  date: string
  is_cash: boolean
  plaid_transaction_id: string | null
  // Merchant name as the bank reported it (synced transactions only)
  bank_merchant: string | null
  needs_review: boolean
  created_at: string
  category?: Category
}

export interface NetWorthSnapshot {
  id: string
  user_id: string
  date: string
  assets: Record<string, number>
  liabilities: Record<string, number>
  total: number
  created_at: string
}

export interface Goal {
  id: string
  user_id: string
  name: string
  target_amount: number
  target_date: string | null
  current_amount: number
  type: string
  created_at: string
}

export type InvestmentCategory = '401k' | 'ira' | 'roth_ira' | 'brokerage' | 'savings' | 'crypto' | 'other'

export interface InvestmentHolding {
  id: string
  user_id: string
  name: string
  ticker: string | null
  shares: number | null
  last_price: number | null
  category: InvestmentCategory
  current_value: number
  value_date: string
  plaid_account_id: string | null
  created_at: string
}

// A linked Plaid connection as returned by /api/plaid/items (no access tokens)
export interface LinkedAccount {
  id: string
  account_id: string
  // Net worth entry key / investment holding name; renaming changes this, not the link
  label: string
  type: string
  subtype: string | null
  current_balance: number | null
}

export interface PlaidItemSummary {
  id: string
  kind: 'bank' | 'investments'
  institution_name: string | null
  last_synced_at: string | null
  error: string | null
  accounts: LinkedAccount[]
}
