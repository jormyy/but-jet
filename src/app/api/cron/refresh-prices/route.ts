import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { fetchYahooQuote } from '@/lib/quotes'

export async function GET(req: NextRequest) {
  const auth = req.headers.get('authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createAdminClient()
  const { data: holdings, error } = await supabase
    .from('investment_holdings')
    .select('id, ticker, shares')
    .not('ticker', 'is', null)
    .not('shares', 'is', null)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const tickers = [...new Set((holdings ?? []).map(h => h.ticker!.toUpperCase()))]
  const quotes = new Map<string, { name: string; price: number } | null>()
  await Promise.all(tickers.map(async ticker => {
    quotes.set(ticker, await fetchYahooQuote(ticker))
  }))

  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Los_Angeles' }).format(new Date())
  let updated = 0
  const failed: string[] = []

  for (const h of holdings ?? []) {
    const quote = quotes.get(h.ticker!.toUpperCase())
    if (!quote) {
      failed.push(h.ticker!)
      continue
    }
    const { error: updateError } = await supabase.from('investment_holdings').update({
      last_price: quote.price,
      current_value: Math.round(h.shares! * quote.price * 100) / 100,
      value_date: today,
    }).eq('id', h.id)

    if (updateError) {
      console.error(`Price update failed for holding ${h.id}:`, updateError.message)
      continue
    }
    updated++
  }

  return NextResponse.json({ updated, failed: [...new Set(failed)], total: holdings?.length ?? 0 })
}
