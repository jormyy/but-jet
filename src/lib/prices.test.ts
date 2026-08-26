import { describe, it, expect } from 'vitest'
import { pricedUpdates, tickersToPrice } from './prices'
import type { InvestmentHolding } from '@/types'

const holding = (over: Partial<InvestmentHolding>): InvestmentHolding => ({
  id: 'h1', user_id: 'u1', name: 'Fund', ticker: 'VOO', shares: 10, last_price: 100,
  category: 'brokerage', current_value: 1000, value_date: '2026-08-24', created_at: '', ...over,
})

describe('tickersToPrice', () => {
  it('only asks for symbols that have a share count to value', () => {
    expect(tickersToPrice([
      holding({ id: 'a', ticker: 'VOO', shares: 10 }),
      holding({ id: 'b', ticker: 'VTI', shares: null }),
      holding({ id: 'c', ticker: null, shares: 5 }),
    ])).toEqual(['VOO'])
  })

  it('asks for each symbol once however many holdings share it', () => {
    expect(tickersToPrice([
      holding({ id: 'a', ticker: 'VOO' }),
      holding({ id: 'b', ticker: 'voo' }),
      holding({ id: 'c', ticker: 'VTI' }),
    ])).toEqual(['VOO', 'VTI'])
  })
})

describe('pricedUpdates', () => {
  const today = '2026-08-25'

  it('writes a holding whose price moved', () => {
    const rows = pricedUpdates([holding({ last_price: 100, current_value: 1000 })], new Map([['VOO', 101]]), today)
    expect(rows).toEqual([{ id: 'h1', last_price: 101, current_value: 1010, value_date: today }])
  })

  it('writes nothing when every price is unchanged', () => {
    const rows = pricedUpdates([holding({ last_price: 100, current_value: 1000, value_date: today })], new Map([['VOO', 100]]), today)
    expect(rows).toEqual([])
  })

  it("restamps a holding whose price and value are unchanged but whose date is yesterday's", () => {
    const rows = pricedUpdates([holding({ shares: 10, last_price: 100, current_value: 1000, value_date: '2026-08-24' })], new Map([['VOO', 100]]), today)
    expect(rows).toEqual([{ id: 'h1', last_price: 100, current_value: 1000, value_date: today }])
  })

  it('writes a holding whose stored value disagrees with the quote', () => {
    const rows = pricedUpdates([holding({ shares: 10, last_price: 100, current_value: 999, value_date: today })], new Map([['VOO', 100]]), today)
    expect(rows).toEqual([{ id: 'h1', last_price: 100, current_value: 1000, value_date: today }])
  })

  it('leaves a hand-valued holding alone even when its symbol has a quote', () => {
    const rows = pricedUpdates([holding({ ticker: 'VOO', shares: null, current_value: 88000 })], new Map([['VOO', 512]]), today)
    expect(rows).toEqual([])
  })

  it('skips holdings whose symbol could not be priced', () => {
    expect(pricedUpdates([holding({ ticker: 'NOPE' })], new Map(), today)).toEqual([])
  })

  it('rounds the value to cents', () => {
    const rows = pricedUpdates([holding({ shares: 3, last_price: 1, current_value: 3 })], new Map([['VOO', 33.333]]), today)
    expect(rows[0].current_value).toBe(100)
  })

  it('matches symbols case-insensitively', () => {
    const rows = pricedUpdates([holding({ ticker: 'voo', last_price: 1 })], new Map([['VOO', 2]]), today)
    expect(rows).toHaveLength(1)
  })
})
