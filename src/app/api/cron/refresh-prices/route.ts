import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { fetchYahooQuote } from '@/lib/quotes'
import { pricedUpdates, tickersToPrice } from '@/lib/prices'

export async function GET(req: NextRequest) {
  const auth = req.headers.get('authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createAdminClient()
  const { data: holdings, error } = await supabase
    .from('investment_holdings')
    .select('id, ticker, shares, last_price, current_value, value_date')
    .not('ticker', 'is', null)
    .not('shares', 'is', null)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const rows = holdings ?? []
  const tickers = tickersToPrice(rows)
  const prices = new Map<string, number>()
  const failed: string[] = []

  await Promise.all(tickers.map(async ticker => {
    const quote = await fetchYahooQuote(ticker)
    if (quote) prices.set(ticker, quote.price)
    else failed.push(ticker)
  }))

  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Los_Angeles' }).format(new Date())
  // Shared with the investments tab, so both skip holdings whose price has not
  // moved instead of rewriting every row on every run.
  const updates = pricedUpdates(rows, prices, today)

  const results = await Promise.all(updates.map(u =>
    supabase.from('investment_holdings')
      .update({ last_price: u.last_price, current_value: u.current_value, value_date: u.value_date })
      .eq('id', u.id)
  ))
  const writeErrors = results.filter(r => r.error).length

  return NextResponse.json({ priced: tickers.length, updated: updates.length - writeErrors, unchanged: rows.length - updates.length, failed, writeErrors })
}
