import { InvestmentCategory } from '@/types'

export const INVESTMENT_CATEGORIES: { value: InvestmentCategory; label: string; color: string }[] = [
  { value: '401k',      label: '401k',      color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300' },
  { value: 'ira',       label: 'IRA',       color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300' },
  { value: 'roth_ira',  label: 'Roth IRA',  color: 'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300' },
  { value: 'brokerage', label: 'Brokerage', color: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300' },
  { value: 'savings',   label: 'Savings',   color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300' },
  { value: 'crypto',    label: 'Crypto',    color: 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300' },
  { value: 'other',     label: 'Other',     color: 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300' },
]

export function investmentCategoryMeta(cat: InvestmentCategory) {
  return INVESTMENT_CATEGORIES.find(c => c.value === cat) ?? INVESTMENT_CATEGORIES[INVESTMENT_CATEGORIES.length - 1]
}

export async function fetchQuote(symbol: string): Promise<{ name: string; price: number } | null> {
  try {
    const res = await fetch(`/api/ticker?symbol=${encodeURIComponent(symbol)}`)
    if (!res.ok) return null
    const d = await res.json()
    return d.price != null ? { name: d.name, price: d.price } : null
  } catch {
    return null
  }
}
