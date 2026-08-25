import { NextRequest, NextResponse } from 'next/server'

// Now polled automatically (see investments-tab.tsx), so we cache upstream
// Yahoo responses briefly — it's an undocumented endpoint with no official
// rate limit, and repeat requests for the same symbol within this window
// are almost certainly redundant.
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

  const res = await fetch(
    `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(upper)}?interval=1d&range=1d`,
    { headers: { 'User-Agent': 'Mozilla/5.0' } }
  )

  if (!res.ok) return NextResponse.json({ error: 'Ticker not found' }, { status: 404 })

  const json = await res.json()
  const meta = json?.chart?.result?.[0]?.meta
  if (!meta) return NextResponse.json({ error: 'Ticker not found' }, { status: 404 })

  const price: number | null = meta.regularMarketPrice ?? null
  const name: string = meta.shortName || meta.longName || upper

  if (!price) return NextResponse.json({ error: 'Price unavailable' }, { status: 404 })

  const body = { name, ticker: upper, price }
  quoteCache.set(upper, { expires: Date.now() + CACHE_TTL_MS, body })
  return NextResponse.json(body)
}
