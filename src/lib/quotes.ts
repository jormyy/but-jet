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
