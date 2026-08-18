export type Bucket = 'bills' | 'spending' | 'savings'
export type TransactionType = 'income' | 'expense' | 'savings'
export type BillFrequency = 'monthly' | 'annual' | 'weekly'

export interface Category {
  id: string
  user_id: string
  name: string
  bucket: Bucket
  color: string
  created_at: string
}

export interface MerchantCategory {
  id: string
  user_id: string
  merchant: string
  category_id: string | null
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
  created_at: string
  category?: Category
}

export interface RecurringBill {
  id: string
  user_id: string
  name: string
  amount: number
  frequency: BillFrequency
  next_due_date: string
  category_id: string | null
  active: boolean
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
  category: InvestmentCategory
  current_value: number
  value_date: string
  created_at: string
}

export interface DashboardStats {
  incomeThisMonth: number
  expensesThisMonth: number
  savingsThisMonth: number
  committedBills: number
  remainingSpendable: number
  savingsRate: number
  spendingByCategory: { category: string; amount: number; bucket: Bucket; color: string }[]
}
