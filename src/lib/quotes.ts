// Server-only: fetches a live quote from Yahoo's undocumented chart endpoint.
// Shared by the ticker proxy (/api/ticker) and the price-refresh cron so both
// hit Yahoo the same way.
export async function fetchYahooQuote(symbol: string): Promise<{ name: string; price: number } | null> {
  const res = await fetch(
    `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=1d`,
    { headers: { 'User-Agent': 'Mozilla/5.0' } }
  )
  if (!res.ok) return null

  const json = await res.json()
  const meta = json?.chart?.result?.[0]?.meta
  if (!meta) return null

  const price: number | null = meta.regularMarketPrice ?? null
  if (!price) return null

  const name: string = meta.shortName || meta.longName || symbol
  return { name, price }
}

export interface TickerSearchResult {
  symbol: string
  name: string
  exchange: string
}

// Same undocumented Yahoo host as fetchYahooQuote, different endpoint: fuzzy
// symbol/company-name search instead of an exact-symbol quote lookup.
export async function fetchYahooTickerSearch(query: string): Promise<TickerSearchResult[]> {
  const res = await fetch(
    `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(query)}&quotesCount=8&newsCount=0`,
    { headers: { 'User-Agent': 'Mozilla/5.0' } }
  )
  if (!res.ok) return []

  const json = await res.json()
  const quotes: unknown[] = json?.quotes ?? []

  return quotes
    .filter((q): q is Record<string, string> => typeof q === 'object' && q !== null && typeof (q as Record<string, unknown>).symbol === 'string')
    .map(q => ({
      symbol: q.symbol,
      name: q.shortname || q.longname || q.symbol,
      exchange: q.exchDisp || '',
    }))
}
