'use client'

import useSWR, { useSWRConfig } from 'swr'
import { createClient } from '@/lib/supabase/client'
import { fetchInvestments } from '@/lib/data'
import { InvestmentHolding } from '@/types'
import { formatCurrency, localDateString } from '@/lib/utils'
import { pricedUpdates, tickersToPrice } from '@/lib/prices'
import { Modal } from '@/components/ui/modal'
import { Button } from '@/components/ui/button'
import { InvestmentForm } from '@/components/investments/investment-form'
import { InvestmentList } from '@/components/investments/investment-list'
import { fetchQuotes } from '@/components/investments/quotes'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Plus, RefreshCw } from 'lucide-react'

const AUTO_REFRESH_MS = 5 * 60 * 1000

export function InvestmentsTab() {
  const supabase = createClient()
  const { mutate } = useSWRConfig()
  const { data } = useSWR('investments', fetchInvestments)
  // Stable across renders so the polling effects below are not torn down and
  // restarted every time anything else in the tab changes.
  const holdings = useMemo(() => data ?? [], [data])

  const total = holdings.reduce((s, h) => s + h.current_value, 0)
  const tickers = tickersToPrice(holdings)
  const hasTickers = tickers.length > 0

  const [addOpen, setAddOpen] = useState(false)
  const [editingInvestment, setEditingInvestment] = useState<InvestmentHolding | null>(null)

  const [refreshing, setRefreshing] = useState(false)
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null)
  const [refreshFailed, setRefreshFailed] = useState<string[]>([])

  // Read via ref so the polling and focus effects below always see the latest
  // holdings without tearing down and restarting their timers.
  const holdingsRef = useRef(holdings)
  useEffect(() => { holdingsRef.current = holdings }, [holdings])
  // A refresh in flight, and when the last one finished. Returning to the app
  // used to fire a full repricing every single time, so a few app switches in a
  // row meant dozens of quote requests and as many writes.
  const inFlight = useRef(false)
  const lastRunAt = useRef(0)

  const refreshPrices = useCallback(async ({ force = false } = {}) => {
    const current = holdingsRef.current
    const symbols = tickersToPrice(current)
    if (symbols.length === 0 || inFlight.current) return
    if (!force && Date.now() - lastRunAt.current < AUTO_REFRESH_MS) return

    inFlight.current = true
    setRefreshing(true)
    try {
      const quotes = await fetchQuotes(symbols)
      const prices = new Map([...quotes].map(([ticker, q]) => [ticker, q.price]))
      const updates = pricedUpdates(current, prices, localDateString())

      if (updates.length > 0) {
        await Promise.all(updates.map(u =>
          supabase.from('investment_holdings')
            .update({ last_price: u.last_price, current_value: u.current_value, value_date: u.value_date })
            .eq('id', u.id)
        ))
        mutate('investments')
        // Net worth reads the portfolio total, so it is stale the moment prices move.
        mutate('snapshots')
      }

      lastRunAt.current = Date.now()
      setLastRefreshed(new Date())
      setRefreshFailed(symbols.filter(s => !prices.has(s)))
    } finally {
      inFlight.current = false
      setRefreshing(false)
    }
  }, [supabase, mutate])

  useEffect(() => {
    if (!hasTickers) return
    refreshPrices({ force: true })
    const id = setInterval(() => refreshPrices(), AUTO_REFRESH_MS)
    return () => clearInterval(id)
  }, [hasTickers, refreshPrices])

  // Coming back to the app should catch up on prices, but only if they are
  // actually stale — the throttle inside refreshPrices decides that.
  useEffect(() => {
    const onVisible = () => { if (document.visibilityState === 'visible') refreshPrices() }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [refreshPrices])

  return (
    <div className="px-4 pt-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">Investments</h1>
        <div className="flex gap-2">
          {hasTickers && (
            <Button variant="ghost" size="sm" onClick={() => refreshPrices({ force: true })} disabled={refreshing}>
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

      <InvestmentList holdings={holdings} onDelete={() => mutate('investments')} onEdit={setEditingInvestment} />

      <Modal open={addOpen} onClose={() => setAddOpen(false)} title="Add investment">
        <InvestmentForm onSuccess={() => { setAddOpen(false); mutate('investments') }} />
      </Modal>

      <Modal open={!!editingInvestment} onClose={() => setEditingInvestment(null)} title="Edit investment">
        {editingInvestment && (
          <InvestmentForm
            investment={editingInvestment}
            onSuccess={() => { setEditingInvestment(null); mutate('investments') }}
          />
        )}
      </Modal>
    </div>
  )
}
