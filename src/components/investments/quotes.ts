export interface Quote {
  ticker: string
  name: string
  price: number
}

// One request for the whole portfolio. The tab used to open a connection per
// holding, every time the app came back to the foreground.
export async function fetchQuotes(symbols: string[]): Promise<Map<string, Quote>> {
  if (symbols.length === 0) return new Map()

  const res = await fetch(`/api/ticker?symbols=${encodeURIComponent(symbols.join(','))}`).catch(() => null)
  if (!res?.ok) return new Map()

  const body = await res.json().catch(() => null)
  return new Map((body?.quotes ?? []).map((q: Quote) => [q.ticker.toUpperCase(), q]))
}

export async function fetchQuote(symbol: string): Promise<Quote | null> {
  const ticker = symbol.toUpperCase()
  return (await fetchQuotes([ticker])).get(ticker) ?? null
}
