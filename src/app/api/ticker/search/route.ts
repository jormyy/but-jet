import { NextRequest, NextResponse } from 'next/server'
import { fetchYahooTickerSearch } from '@/lib/quotes'

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get('q')?.trim()
  if (!q) return NextResponse.json({ results: [] })

  const results = await fetchYahooTickerSearch(q)
  return NextResponse.json({ results })
}
