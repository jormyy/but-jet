'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { InvestmentHolding, InvestmentCategory } from '@/types'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { formatCurrency, localDateString } from '@/lib/utils'
import { INVESTMENT_CATEGORIES } from './categories'
import { fetchQuote } from './quotes'

interface InvestmentFormProps {
  onSuccess: () => void
  investment?: InvestmentHolding  // if provided, form is in edit mode
}

export function InvestmentForm({ onSuccess, investment }: InvestmentFormProps) {
  const supabase = createClient()
  const isEdit = !!investment
  const [loading, setLoading] = useState(false)
  const [tickerInfo, setTickerInfo] = useState<{ name: string; price: number } | null>(null)
  const [tickerLoading, setTickerLoading] = useState(!!investment?.ticker)
  const [form, setForm] = useState({
    name: investment?.name ?? '',
    ticker: investment?.ticker ?? '',
    category: (investment?.category ?? 'roth_ira') as InvestmentCategory,
    shares: investment?.shares != null ? String(investment.shares) : '',
    current_value: investment ? String(investment.current_value) : '',
  })

  async function lookupTicker(symbol: string) {
    if (!symbol) { setTickerInfo(null); return }
    setTickerLoading(true)
    const result = await fetchQuote(symbol)
    setTickerInfo(result)
    setTickerLoading(false)
  }

  useEffect(() => {
    if (!investment?.ticker) return
    let cancelled = false
    fetchQuote(investment.ticker).then(result => {
      if (cancelled) return
      setTickerInfo(result)
      setTickerLoading(false)
    })
    return () => { cancelled = true }
  }, [investment?.ticker])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)

    const ticker = form.ticker.toUpperCase() || null
    const shares = form.shares ? parseFloat(form.shares) : null

    let currentValue: number
    let lastPrice: number | null = null
    if (ticker && shares && tickerInfo?.price) {
      lastPrice = tickerInfo.price
      currentValue = Math.round(shares * lastPrice * 100) / 100
    } else {
      currentValue = parseFloat(form.current_value)
    }

    const displayName = form.name.trim()
      || INVESTMENT_CATEGORIES.find(c => c.value === form.category)?.label
      || 'Investment'

    const payload = {
      name: displayName,
      ticker,
      shares,
      last_price: lastPrice,
      category: form.category,
      current_value: currentValue,
      value_date: localDateString(),
    }

    if (isEdit) {
      const { error } = await supabase.from('investment_holdings').update(payload).eq('id', investment.id)
      setLoading(false)
      if (!error) onSuccess()
      return
    }

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setLoading(false)
      return
    }

    const { error } = await supabase.from('investment_holdings').insert({ user_id: user.id, ...payload })

    setLoading(false)
    if (!error) onSuccess()
  }

  const hasTicker = form.ticker.trim().length > 0
  const canSubmit = hasTicker
    ? (!!form.shares && (tickerInfo?.price != null || !!form.current_value))
    : !!form.current_value

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Input
        label="Name"
        id="inv-name"
        value={form.name}
        onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
        placeholder="e.g. Fidelity (optional)"
      />

      <div className="space-y-1.5">
        <label className="text-xs font-medium text-zinc-500 uppercase tracking-wide">Category</label>
        <select
          value={form.category}
          onChange={e => setForm(f => ({ ...f, category: e.target.value as InvestmentCategory }))}
          className="w-full border border-zinc-200 dark:border-zinc-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-zinc-400"
        >
          {INVESTMENT_CATEGORIES.map(c => (
            <option key={c.value} value={c.value}>{c.label}</option>
          ))}
        </select>
      </div>

      <div className="space-y-1.5">
        <label className="text-xs font-medium text-zinc-500 uppercase tracking-wide">Ticker</label>
        <input
          type="text"
          value={form.ticker}
          onChange={e => setForm(f => ({ ...f, ticker: e.target.value }))}
          onBlur={e => lookupTicker(e.target.value)}
          placeholder="e.g. VOO"
          className="w-full border border-zinc-200 dark:border-zinc-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-zinc-400 font-mono uppercase"
        />
        {tickerLoading && <p className="text-xs text-zinc-400">Looking up...</p>}
        {tickerInfo && !tickerLoading && (
          <p className="text-xs text-zinc-500">
            {tickerInfo.name} · {formatCurrency(tickerInfo.price)}/share
          </p>
        )}
      </div>

      {hasTicker ? (
        <Input
          label="Shares"
          id="inv-shares"
          type="number"
          min="0"
          step="0.000001"
          value={form.shares}
          onChange={e => setForm(f => ({ ...f, shares: e.target.value }))}
          placeholder="e.g. 1.53"
          required
        />
      ) : (
        <Input
          label="Current value"
          id="inv-value"
          type="number"
          min="0"
          step="0.01"
          value={form.current_value}
          onChange={e => setForm(f => ({ ...f, current_value: e.target.value }))}
          placeholder="0.00"
          required
        />
      )}

      {hasTicker && form.shares && tickerInfo?.price && (
        <p className="text-xs text-zinc-500 -mt-2">
          ≈ {formatCurrency(parseFloat(form.shares) * tickerInfo.price)} at current price
        </p>
      )}

      {hasTicker && form.shares && !tickerInfo?.price && !tickerLoading && (
        <Input
          label="Current value (price lookup failed)"
          id="inv-value-fallback"
          type="number"
          min="0"
          step="0.01"
          value={form.current_value}
          onChange={e => setForm(f => ({ ...f, current_value: e.target.value }))}
          placeholder="0.00"
          required
        />
      )}

      <Button type="submit" disabled={loading || !canSubmit} className="w-full">
        {loading ? 'Saving...' : isEdit ? 'Save changes' : 'Add investment'}
      </Button>
    </form>
  )
}
