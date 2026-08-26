import { describe, it, expect } from 'vitest'
import { monthlyAmount, netWorthTotal, transactionDelta, getMonthRange, localDateString } from './utils'

describe('monthlyAmount', () => {
  it('leaves a monthly bill alone', () => expect(monthlyAmount(88, 'monthly')).toBe(88))
  it('spreads an annual bill over twelve months', () => expect(monthlyAmount(1320, 'annual')).toBe(110))
  it('counts a weekly bill by the year, not by four weeks', () => {
    expect(monthlyAmount(28, 'weekly')).toBeCloseTo(121.33, 2)
  })
})

describe('netWorthTotal', () => {
  it('is assets less liabilities', () => {
    expect(netWorthTotal({ Checking: 4000, Savings: 15000 }, { 'Credit card': 1200 })).toBe(17800)
  })
  it('handles an empty side', () => {
    expect(netWorthTotal({ Checking: 100 }, {})).toBe(100)
    expect(netWorthTotal({}, { Loan: 100 })).toBe(-100)
  })
})

describe('transactionDelta', () => {
  it('adds income and removes everything else', () => {
    expect(transactionDelta('income', 100)).toBe(100)
    expect(transactionDelta('expense', 100)).toBe(-100)
    expect(transactionDelta('savings', 100)).toBe(-100)
  })
})

describe('getMonthRange', () => {
  it('runs from the first to the last day of the month', () => {
    expect(getMonthRange(new Date(2026, 1, 14))).toEqual({ start: '2026-02-01', end: '2026-02-28' })
  })
  it('gets the last day right in a leap year', () => {
    expect(getMonthRange(new Date(2028, 1, 14))).toEqual({ start: '2028-02-01', end: '2028-02-29' })
  })
  it('uses the local date, not UTC, so a late-evening entry lands on the right day', () => {
    expect(localDateString(new Date(2026, 0, 31, 23, 30))).toBe('2026-01-31')
  })
})
