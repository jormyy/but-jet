import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const symbol = req.nextUrl.searchParams.get('symbol')
  if (!symbol) return NextResponse.json({ error: 'Missing symbol' }, { status: 400 })

  const key = process.env.FINNHUB_API_KEY
  if (!key) return NextResponse.json({ error: 'No API key configured' }, { status: 503 })

  const [profileRes, quoteRes] = await Promise.all([
    fetch(`https://finnhub.io/api/v1/stock/profile2?symbol=${encodeURIComponent(symbol.toUpperCase())}&token=${key}`),
    fetch(`https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(symbol.toUpperCase())}&token=${key}`),
  ])
  const [profile, quote] = await Promise.all([profileRes.json(), quoteRes.json()])

  const price: number | null = quote.c && quote.c !== 0 ? quote.c : null
  const name: string = profile.name || symbol.toUpperCase()

  if (!price && !profile.name) return NextResponse.json({ error: 'Ticker not found' }, { status: 404 })

  return NextResponse.json({ name, ticker: profile.ticker || symbol.toUpperCase(), price })
}
