'use client'

import useSWR, { useSWRConfig } from 'swr'
import { createClient } from '@/lib/supabase/client'
import { fetchInvestments } from '@/lib/data'
import { InvestmentHolding } from '@/types'
import { formatCurrency, localDateString } from '@/lib/utils'
import { Modal } from '@/components/ui/modal'
import { Button } from '@/components/ui/button'
import { InvestmentForm } from '@/components/investments/investment-form'
import { InvestmentList } from '@/components/investments/investment-list'
import { fetchQuote } from '@/components/investments/categories'
import { useState } from 'react'
import { Plus, RefreshCw } from 'lucide-react'

export function InvestmentsTab() {
  const supabase = createClient()
  const { mutate } = useSWRConfig()
  const { data } = useSWR('investments', fetchInvestments)
  const holdings = (data ?? []) as InvestmentHolding[]

  const total = holdings.reduce((s, h) => s + h.current_value, 0)
  const tickerHoldings = holdings.filter(h => h.ticker && h.shares)

  const [addOpen, setAddOpen] = useState(false)
  const [editingInvestment, setEditingInvestment] = useState<InvestmentHolding | null>(null)

  // Refresh state
  const [refreshing, setRefreshing] = useState(false)
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null)
  const [refreshFailed, setRefreshFailed] = useState<string[]>([])

  function refresh() {
    mutate('investments')
  }

  async function handleRefreshPrices() {
    if (tickerHoldings.length === 0) return
    setRefreshing(true)
    setRefreshFailed([])

    const quotes = await Promise.all(
      tickerHoldings.map(h => fetchQuote(h.ticker!).then(q => ({ id: h.id, ticker: h.ticker!, shares: h.shares!, quote: q })))
    )

    const failed = quotes.filter(q => q.quote === null).map(q => q.ticker)
    const succeeded = quotes.filter(q => q.quote !== null)

    const today = localDateString()
    await Promise.all(
      succeeded.map(({ id, shares, quote }) =>
        supabase.from('investment_holdings').update({
          last_price: quote!.price,
          current_value: Math.round(shares * quote!.price * 100) / 100,
          value_date: today,
        }).eq('id', id)
      )
    )

    setRefreshing(false)
    setLastRefreshed(new Date())
    setRefreshFailed(failed)
    refresh()
  }

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
          {refreshFailed.length > 0 && (
            <p className="text-xs text-amber-500 mt-0.5">
              Could not fetch: {refreshFailed.join(', ')}
            </p>
          )}
        </div>
      )}

      <InvestmentList holdings={holdings} onDelete={refresh} onEdit={setEditingInvestment} />

      <Modal open={addOpen} onClose={() => setAddOpen(false)} title="Add investment">
        <InvestmentForm onSuccess={() => { setAddOpen(false); refresh() }} />
      </Modal>

      <Modal open={!!editingInvestment} onClose={() => setEditingInvestment(null)} title="Edit investment">
        {editingInvestment && (
          <InvestmentForm
            investment={editingInvestment}
            onSuccess={() => { setEditingInvestment(null); refresh() }}
          />
        )}
      </Modal>
    </div>
  )
}
