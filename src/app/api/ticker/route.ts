import { NextRequest, NextResponse } from 'next/server'
import { fetchYahooQuote } from '@/lib/quotes'

// Polled automatically from the client (see investments-tab.tsx) and by the
// daily price-refresh cron, so we cache upstream Yahoo responses briefly —
// it's an undocumented endpoint with no official rate limit, and repeat
// requests for the same symbol within this window are almost certainly
// redundant.
const CACHE_TTL_MS = 60 * 1000
const quoteCache = new Map<string, { expires: number; body: object }>()

export async function GET(req: NextRequest) {
  const symbol = req.nextUrl.searchParams.get('symbol')
  if (!symbol) return NextResponse.json({ error: 'Missing symbol' }, { status: 400 })

  const upper = symbol.toUpperCase()

  const cached = quoteCache.get(upper)
  if (cached && cached.expires > Date.now()) {
    return NextResponse.json(cached.body)
  }

  const quote = await fetchYahooQuote(upper)
  if (!quote) return NextResponse.json({ error: 'Ticker not found' }, { status: 404 })

  const body = { name: quote.name, ticker: upper, price: quote.price }
  quoteCache.set(upper, { expires: Date.now() + CACHE_TTL_MS, body })
  return NextResponse.json(body)
}
