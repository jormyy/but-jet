import { NextRequest, NextResponse } from 'next/server'
import { fetchYahooQuote } from '@/lib/quotes'

// Polled from the investments tab and by the daily price-refresh cron, so
// upstream Yahoo responses are held briefly: it is an undocumented endpoint
// with no official rate limit, and repeat requests for the same symbol inside
// this window are almost certainly redundant.
const CACHE_TTL_MS = 60 * 1000
const MAX_SYMBOLS = 25

const quoteCache = new Map<string, { expires: number; quote: { name: string; price: number } | null }>()

function cached(symbol: string) {
  const hit = quoteCache.get(symbol)
  if (!hit) return undefined
  if (hit.expires > Date.now()) return hit.quote
  quoteCache.delete(symbol)
  return undefined
}

export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams
  const requested = (params.get('symbols') ?? params.get('symbol') ?? '')
    .split(',')
    .map(s => s.trim().toUpperCase())
    .filter(Boolean)
  const symbols = [...new Set(requested)].slice(0, MAX_SYMBOLS)

  if (symbols.length === 0) {
    return NextResponse.json({ error: 'Missing symbols' }, { status: 400 })
  }

  const results = await Promise.all(symbols.map(async symbol => {
    const hit = cached(symbol)
    if (hit !== undefined) return { symbol, quote: hit }

    const quote = await fetchYahooQuote(symbol)
    // Failures are cached too, so one bad symbol in a portfolio does not mean a
    // fresh upstream request on every refresh.
    quoteCache.set(symbol, { expires: Date.now() + CACHE_TTL_MS, quote })
    return { symbol, quote }
  }))

  const quotes = results
    .filter(r => r.quote)
    .map(r => ({ ticker: r.symbol, name: r.quote!.name, price: r.quote!.price }))
  const missing = results.filter(r => !r.quote).map(r => r.symbol)

  return NextResponse.json({ quotes, missing }, {
    headers: { 'Cache-Control': `private, max-age=${CACHE_TTL_MS / 1000}` },
  })
}
