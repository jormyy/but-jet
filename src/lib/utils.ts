import { clsx, type ClassValue } from 'clsx'
import type { Bucket, TransactionType } from '@/types'

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs)
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount)
}

export function formatDate(date: string): string {
  return new Date(date + 'T00:00:00').toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

export function localDateString(date = new Date()): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

// Today's date in Pacific time, for server code (crons, syncs) where the local timezone is UTC
export function todayPacific(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Los_Angeles' }).format(new Date())
}

export function getMonthRange(date = new Date()) {
  const start = new Date(date.getFullYear(), date.getMonth(), 1)
  const end = new Date(date.getFullYear(), date.getMonth() + 1, 0)
  return {
    start: localDateString(start),
    end: localDateString(end),
  }
}

export function getMonthLabel(date = new Date()) {
  return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
}

// Income and reimbursements add to checking; expenses and savings transfers both leave checking
export function transactionDelta(type: TransactionType, amount: number): number {
  return type === 'income' || type === 'reimbursement' ? amount : -amount
}

// A transaction's contribution to spending: reimbursements offset expenses rather than counting as income
export function spendingAmount(t: { type: TransactionType; amount: number }): number {
  if (t.type === 'expense') return t.amount
  if (t.type === 'reimbursement') return -t.amount
  return 0
}

// Net worth of a snapshot's entries
export function snapshotTotal(assets: Record<string, number>, liabilities: Record<string, number>): number {
  const sum = (m: Record<string, number>) => Object.values(m).reduce((s, v) => s + v, 0)
  return sum(assets) - sum(liabilities)
}

export const BUCKETS: Bucket[] = ['bills', 'spending', 'savings']

export const BUCKET_LABELS: Record<string, string> = {
  bills: 'Bills',
  spending: 'Spending',
  savings: 'Savings',
}

export const BUCKET_COLORS: Record<string, string> = {
  bills: '#ef4444',
  spending: '#f97316',
  savings: '#22c55e',
}
