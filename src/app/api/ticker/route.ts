import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const symbol = req.nextUrl.searchParams.get('symbol')
  if (!symbol) return NextResponse.json({ error: 'Missing symbol' }, { status: 400 })

  const upper = symbol.toUpperCase()
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

  return NextResponse.json({ name, ticker: upper, price })
}
