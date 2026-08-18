import { clsx, type ClassValue } from 'clsx'

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

// Monthly cost of a recurring bill (prorates annual ones)
export function monthlyAmount(amount: number, frequency: string): number {
  if (frequency === 'annual') return amount / 12
  if (frequency === 'weekly') return amount * (52 / 12)
  return amount
}

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
