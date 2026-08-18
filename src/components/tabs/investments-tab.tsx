'use client'

import useSWR, { mutate } from 'swr'
import { createClient } from '@/lib/supabase/client'
import { fetchInvestments } from '@/lib/data'
import { InvestmentHolding, InvestmentCategory } from '@/types'
import { formatCurrency, formatDate, localDateString } from '@/lib/utils'
import { Modal } from '@/components/ui/modal'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useState } from 'react'
import { Plus, Trash2, RefreshCw, TrendingUp } from 'lucide-react'

const CATEGORIES: { value: InvestmentCategory; label: string; color: string }[] = [
  { value: '401k',      label: '401k',      color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300' },
  { value: 'ira',       label: 'IRA',       color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300' },
  { value: 'roth_ira',  label: 'Roth IRA',  color: 'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300' },
  { value: 'brokerage', label: 'Brokerage', color: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300' },
  { value: 'savings',   label: 'Savings',   color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300' },
  { value: 'crypto',    label: 'Crypto',    color: 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300' },
  { value: 'other',     label: 'Other',     color: 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300' },
]

function categoryMeta(cat: InvestmentCategory) {
  return CATEGORIES.find(c => c.value === cat) ?? CATEGORIES[CATEGORIES.length - 1]
}

async function fetchQuote(symbol: string): Promise<{ name: string; price: number } | null> {
  try {
    const res = await fetch(`/api/ticker?symbol=${encodeURIComponent(symbol)}`)
    if (!res.ok) return null
    const d = await res.json()
    return d.price != null ? { name: d.name, price: d.price } : null
  } catch {
    return null
  }
}

export function InvestmentsTab() {
  const supabase = createClient()
  const { data } = useSWR('investments', fetchInvestments)
  const holdings = (data ?? []) as InvestmentHolding[]

  const total = holdings.reduce((s, h) => s + h.current_value, 0)
  const tickerHoldings = holdings.filter(h => h.ticker && h.shares)

  // Add modal state
  const [addOpen, setAddOpen] = useState(false)
  const [addLoading, setAddLoading] = useState(false)
  const [tickerInfo, setTickerInfo] = useState<{ name: string; price: number } | null>(null)
  const [tickerLoading, setTickerLoading] = useState(false)
  const [form, setForm] = useState({
    name: '',
    ticker: '',
    category: 'roth_ira' as InvestmentCategory,
    shares: '',
    current_value: '',
    value_date: localDateString(),
  })

  // Refresh state
  const [refreshing, setRefreshing] = useState(false)
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null)

  // Sync to net worth modal state
  const [syncOpen, setSyncOpen] = useState(false)
  const [syncDate, setSyncDate] = useState(localDateString())
  const [syncLoading, setSyncLoading] = useState(false)

  async function lookupTicker(symbol: string) {
    if (!symbol) { setTickerInfo(null); return }
    setTickerLoading(true)
    const result = await fetchQuote(symbol)
    setTickerInfo(result)
    setTickerLoading(false)
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    setAddLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const ticker = form.ticker.toUpperCase() || null
    const shares = form.shares ? parseFloat(form.shares) : null

    let currentValue: number
    if (ticker && shares && tickerInfo?.price) {
      currentValue = shares * tickerInfo.price
    } else {
      currentValue = parseFloat(form.current_value)
    }

    const displayName = form.name.trim() || categoryMeta(form.category).label

    await supabase.from('investment_holdings').insert({
      user_id: user.id,
      name: displayName,
      ticker,
      shares,
      category: form.category,
      current_value: currentValue,
      value_date: localDateString(),
    })

    setForm({ name: '', ticker: '', category: 'roth_ira', shares: '', current_value: '', value_date: localDateString() })
    setTickerInfo(null)
    setAddLoading(false)
    setAddOpen(false)
    mutate('investments')
  }

  async function handleRefreshPrices() {
    if (tickerHoldings.length === 0) return
    setRefreshing(true)

    const quotes = await Promise.all(
      tickerHoldings.map(h => fetchQuote(h.ticker!).then(q => ({ id: h.id, shares: h.shares!, quote: q })))
    )

    const today = localDateString()
    await Promise.all(
      quotes
        .filter(q => q.quote !== null)
        .map(({ id, shares, quote }) =>
          supabase.from('investment_holdings').update({
            current_value: shares * quote!.price,
            value_date: today,
          }).eq('id', id)
        )
    )

    setRefreshing(false)
    setLastRefreshed(new Date())
    mutate('investments')
  }

  async function handleUpdateValue(id: string, value: string) {
    const num = parseFloat(value)
    if (isNaN(num)) return
    await supabase.from('investment_holdings').update({
      current_value: num,
      value_date: localDateString(),
    }).eq('id', id)
    mutate('investments')
  }

  async function handleDelete(id: string) {
    await supabase.from('investment_holdings').delete().eq('id', id)
    mutate('investments')
  }

  async function handleSync(e: React.FormEvent) {
    e.preventDefault()
    if (holdings.length === 0) return
    setSyncLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const assetsFromHoldings: Record<string, number> = {}
    for (const h of holdings) {
      assetsFromHoldings[h.name] = h.current_value
    }
    const holdingsTotal = Object.values(assetsFromHoldings).reduce((s, v) => s + v, 0)

    const { data: existing } = await supabase
      .from('net_worth_snapshots')
      .select('*')
      .eq('user_id', user.id)
      .eq('date', syncDate)
      .maybeSingle()

    if (existing) {
      const mergedAssets = { ...existing.assets, ...assetsFromHoldings }
      const totalAssets = (Object.values(mergedAssets) as number[]).reduce((s, v) => s + v, 0)
      const totalLiab = (Object.values(existing.liabilities as Record<string, number>) as number[]).reduce((s, v) => s + v, 0)
      await supabase.from('net_worth_snapshots').update({
        assets: mergedAssets,
        total: totalAssets - totalLiab,
      }).eq('id', existing.id)
    } else {
      await supabase.from('net_worth_snapshots').insert({
        user_id: user.id,
        date: syncDate,
        assets: assetsFromHoldings,
        liabilities: {},
        total: holdingsTotal,
      })
    }

    setSyncLoading(false)
    setSyncOpen(false)
    mutate('snapshots')
  }

  const hasTicker = form.ticker.trim().length > 0
  const canSubmitAdd = hasTicker
    ? (!!form.shares && (tickerInfo?.price != null || !!form.current_value))
    : !!form.current_value

  return (
    <div className="px-4 pt-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">Investments</h1>
        <div className="flex gap-2">
          {tickerHoldings.length > 0 && (
            <Button variant="ghost" size="sm" onClick={handleRefreshPrices} disabled={refreshing}>
              <RefreshCw size={14} className={`mr-1 ${refreshing ? 'animate-spin' : ''}`} />
              {refreshing ? 'Refreshing...' : 'Refresh'}
            </Button>
          )}
          <Button size="sm" onClick={() => setAddOpen(true)}>
            <Plus size={14} className="mr-1" />
            Add
          </Button>
        </div>
      </div>

      {total > 0 && (
        <div className="rounded-xl border border-zinc-100 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4">
          <p className="text-xs font-medium text-zinc-400 uppercase tracking-wide">Total portfolio</p>
          <p className="text-3xl font-semibold tabular-nums mt-1 text-zinc-900 dark:text-zinc-100">
            {formatCurrency(total)}
          </p>
          {lastRefreshed && (
            <p className="text-xs text-zinc-400 mt-0.5">
              Prices updated {lastRefreshed.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </p>
          )}
          <button
            onClick={() => setSyncOpen(true)}
            className="mt-2 flex items-center gap-1 text-xs text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors"
          >
            <TrendingUp size={12} />
            Sync to Net Worth
          </button>
        </div>
      )}

      {holdings.length === 0 ? (
        <div className="text-center py-12 text-zinc-400 text-sm">No investments yet</div>
      ) : (
        <div className="space-y-3">
          {holdings.map(holding => {
            const meta = categoryMeta(holding.category)
            const pricePerShare = holding.shares ? holding.current_value / holding.shares : null
            return (
              <div key={holding.id} className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-100 dark:border-zinc-800 p-4 group">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{holding.name}</p>
                      {holding.ticker && (
                        <span className="text-xs font-mono text-zinc-400">{holding.ticker}</span>
                      )}
                      <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${meta.color}`}>
                        {meta.label}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      {holding.shares && (
                        <p className="text-xs text-zinc-400">{holding.shares} shares</p>
                      )}
                      {pricePerShare && (
                        <p className="text-xs text-zinc-400">@ {formatCurrency(pricePerShare)}</p>
                      )}
                      {!holding.shares && (
                        <p className="text-xs text-zinc-400">As of {formatDate(holding.value_date)}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">
                      {formatCurrency(holding.current_value)}
                    </span>
                    <button
                      onClick={() => handleDelete(holding.id)}
                      className="opacity-0 group-hover:opacity-100 p-1 text-zinc-300 hover:text-red-500 transition-all"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>

                {/* Only show manual update input for holdings without ticker+shares */}
                {!holding.ticker && (
                  <div className="flex gap-2 mt-3">
                    <input
                      type="number"
                      defaultValue={holding.current_value}
                      onBlur={e => handleUpdateValue(holding.id, e.target.value)}
                      className="flex-1 text-xs border border-zinc-200 dark:border-zinc-700 rounded-lg px-2 py-1.5 bg-transparent text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-zinc-400"
                      placeholder="Update value"
                    />
                    <span className="text-xs text-zinc-400 self-center">update</span>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Add holding modal */}
      <Modal open={addOpen} onClose={() => { setAddOpen(false); setTickerInfo(null) }} title="Add investment">
        <form onSubmit={handleAdd} className="space-y-4">
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
              {CATEGORIES.map(c => (
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

          <Button type="submit" disabled={addLoading || !canSubmitAdd} className="w-full">
            {addLoading ? 'Saving...' : 'Add investment'}
          </Button>
        </form>
      </Modal>

      {/* Sync to net worth modal */}
      <Modal open={syncOpen} onClose={() => setSyncOpen(false)} title="Sync to Net Worth">
        <form onSubmit={handleSync} className="space-y-4">
          <p className="text-sm text-zinc-500">
            Creates or updates a net worth snapshot with your {holdings.length} holding{holdings.length !== 1 ? 's' : ''} ({formatCurrency(total)} total).
          </p>

          <Input
            label="Snapshot date"
            id="sync-date"
            type="date"
            value={syncDate}
            onChange={e => setSyncDate(e.target.value)}
          />

          <div className="space-y-1">
            {holdings.map(h => (
              <div key={h.id} className="flex justify-between text-xs text-zinc-500">
                <span>{h.name}</span>
                <span className="tabular-nums">{formatCurrency(h.current_value)}</span>
              </div>
            ))}
          </div>

          <Button type="submit" disabled={syncLoading} className="w-full">
            {syncLoading ? 'Syncing...' : 'Save to Net Worth'}
          </Button>
        </form>
      </Modal>
    </div>
  )
}
