'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { InvestmentHolding, InvestmentCategory } from '@/types'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { formatCurrency, formatDate } from '@/lib/utils'
import { renameLinkedAccount } from '@/lib/data'
import { INVESTMENT_CATEGORIES } from './categories'

interface SyncedHoldingFormProps {
  holding: InvestmentHolding & { plaid_account_id: string }
  onSuccess: () => void
}

// Edit form for a holding synced from a linked account (Fidelity, ADP, ...). Its value comes from the
// account, so only the name and category are editable; renames go through the server to keep it linked.
export function SyncedHoldingForm({ holding, onSuccess }: SyncedHoldingFormProps) {
  const supabase = createClient()
  const [name, setName] = useState(holding.name)
  const [category, setCategory] = useState<InvestmentCategory>(holding.category)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      if (name.trim() !== holding.name) await renameLinkedAccount(holding.plaid_account_id, name)
      if (category !== holding.category) {
        const { error } = await supabase.from('investment_holdings').update({ category }).eq('id', holding.id)
        if (error) throw new Error(error.message)
      }
      onSuccess()
    } catch (err) {
      setError((err as Error).message)
    }
    setLoading(false)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Input
        label="Name"
        id="synced-name"
        value={name}
        onChange={e => setName(e.target.value)}
        required
      />

      <div className="space-y-1.5">
        <label className="text-xs font-medium text-zinc-500 uppercase tracking-wide">Category</label>
        <select
          value={category}
          onChange={e => setCategory(e.target.value as InvestmentCategory)}
          className="w-full border border-zinc-200 dark:border-zinc-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-zinc-400"
        >
          {INVESTMENT_CATEGORIES.map(c => (
            <option key={c.value} value={c.value}>{c.label}</option>
          ))}
        </select>
      </div>

      <p className="text-xs text-zinc-400">
        Linked account: {formatCurrency(holding.current_value)} as of {formatDate(holding.value_date)}, synced automatically.
        Renaming keeps it linked. To stop syncing, unlink it from Transactions → Linked accounts.
      </p>

      {error && <p className="text-xs text-red-500">{error}</p>}

      <Button type="submit" disabled={loading || !name.trim()} className="w-full">
        {loading ? 'Saving…' : 'Save changes'}
      </Button>
    </form>
  )
}
