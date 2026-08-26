import type { InvestmentHolding } from '@/types'

export interface PriceUpdate {
  id: string
  last_price: number
  current_value: number
  value_date: string
}

// Symbols worth a quote: a holding without a share count has a value the user
// typed in, and repricing it would overwrite that.
export function tickersToPrice(holdings: InvestmentHolding[]): string[] {
  const seen = new Set<string>()
  for (const h of holdings) {
    if (h.ticker && h.shares) seen.add(h.ticker.toUpperCase())
  }
  return [...seen]
}

// The rows that actually need writing. Repricing used to write every holding on
// every refresh, including the overwhelmingly common case where the quote came
// back identical to the one already stored.
export function pricedUpdates(
  holdings: InvestmentHolding[],
  prices: Map<string, number>,
  today: string,
): PriceUpdate[] {
  const updates: PriceUpdate[] = []

  for (const h of holdings) {
    if (!h.ticker || !h.shares) continue
    const price = prices.get(h.ticker.toUpperCase())
    if (price === undefined) continue

    const value = Math.round(h.shares * price * 100) / 100
    if (h.last_price === price && h.current_value === value && h.value_date === today) continue

    updates.push({ id: h.id, last_price: price, current_value: value, value_date: today })
  }

  return updates
}
