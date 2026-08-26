'use client'

import useSWR, { useSWRConfig } from 'swr'
import { createClient } from '@/lib/supabase/client'
import { fetchBills, fetchCategories } from '@/lib/data'
import { RecurringBill, Category, Bucket } from '@/types'
import { formatCurrency, monthlyAmount, BUCKET_LABELS, localDateString } from '@/lib/utils'
import { Modal } from '@/components/ui/modal'
import { ConfirmDeleteDialog } from '@/components/ui/confirm-delete-dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { useState } from 'react'
import { Plus, Trash2, CalendarClock } from 'lucide-react'
import { cn } from '@/lib/utils'

export function BillsTab() {
  const supabase = createClient()
  const { mutate } = useSWRConfig()
  const { data: billsData } = useSWR('bills', fetchBills)
  const { data: categoriesData } = useSWR('categories', fetchCategories)
  const bills = billsData ?? []
  const categories = categoriesData ?? []

  const [addOpen, setAddOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [confirmBill, setConfirmBill] = useState<RecurringBill | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [form, setForm] = useState({
    name: '',
    amount: '',
    frequency: 'monthly' as 'monthly' | 'annual' | 'weekly',
    next_due_date: localDateString(),
    category_id: '',
  })

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setLoading(false)
      return
    }
    await supabase.from('recurring_bills').insert({
      user_id: user.id,
      name: form.name,
      amount: parseFloat(form.amount),
      frequency: form.frequency,
      next_due_date: form.next_due_date,
      category_id: form.category_id || null,
    })
    setForm({ name: '', amount: '', frequency: 'monthly', next_due_date: localDateString(), category_id: '' })
    setLoading(false)
    setAddOpen(false)
    mutate('bills')
  }

  async function handleDelete() {
    if (!confirmBill) return
    setDeleting(true)
    await supabase.from('recurring_bills').delete().eq('id', confirmBill.id)
    setDeleting(false)
    setConfirmBill(null)
    mutate('bills')
  }

  const totalMonthly = bills.filter(b => b.active).reduce((s, b) => s + monthlyAmount(b.amount, b.frequency), 0)

  const buckets: Record<string, Category[]> = {}
  for (const cat of categories) {
    if (!buckets[cat.bucket]) buckets[cat.bucket] = []
    buckets[cat.bucket].push(cat)
  }

  const daysUntil = (date: string) => {
    const diff = new Date(date + 'T00:00:00').getTime() - new Date().setHours(0,0,0,0)
    return Math.ceil(diff / (1000 * 60 * 60 * 24))
  }

  return (
    <div className="px-4 pt-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">Bills</h1>
        <Button onClick={() => setAddOpen(true)} size="sm">
          <Plus size={14} className="mr-1" />
          Add
        </Button>
      </div>

      {/* Total */}
      <div className="rounded-xl border border-zinc-100 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4">
        <p className="text-xs font-medium text-zinc-400 uppercase tracking-wide">Monthly committed</p>
        <p className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100 tabular-nums mt-1">
          {formatCurrency(totalMonthly)}
        </p>
        <p className="text-xs text-zinc-400 mt-0.5">Annual bills prorated monthly</p>
      </div>

      {/* Bill list */}
      {bills.length === 0 ? (
        <div className="text-center py-12 text-zinc-400 text-sm">No bills yet</div>
      ) : (
        <div className="flex flex-col divide-y divide-zinc-100 dark:divide-zinc-800 rounded-xl border border-zinc-100 dark:border-zinc-800 overflow-hidden">
          {bills.map(bill => {
            const days = daysUntil(bill.next_due_date)
            return (
              <div key={bill.id} className="flex items-center justify-between px-4 py-3 bg-white dark:bg-zinc-900 group">
                <div className="flex flex-col min-w-0">
                  <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100 truncate">{bill.name}</span>
                  <div className="flex items-center gap-1.5 text-xs text-zinc-400">
                    <CalendarClock size={11} />
                    <span className={cn(days <= 3 && 'text-red-500', days <= 7 && days > 3 && 'text-amber-500')}>
                      {days === 0 ? 'due today' : days < 0 ? `${Math.abs(days)}d overdue` : `in ${days}d`}
                    </span>
                    <span>·</span>
                    <span>{bill.frequency}</span>
                    {bill.category && <><span>·</span><span>{bill.category.name}</span></>}
                  </div>
                </div>
                <div className="flex items-center gap-3 ml-3 shrink-0">
                  <div className="text-right">
                    <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 tabular-nums">
                      {formatCurrency(bill.amount)}
                    </p>
                    {bill.frequency !== 'monthly' && (
                      <p className="text-xs text-zinc-400">
                        {formatCurrency(monthlyAmount(bill.amount, bill.frequency))}/mo
                      </p>
                    )}
                  </div>
                  <button
                    onClick={() => setConfirmBill(bill)}
                    aria-label={`Delete ${bill.name}`}
                    className="opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 focus-visible:opacity-100 pointer-coarse:opacity-100 p-2.5 -m-1 text-zinc-300 hover:text-red-500 transition-all focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-500"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <ConfirmDeleteDialog
        open={!!confirmBill}
        title="Delete bill?"
        description={`${confirmBill?.name ?? ''} · ${confirmBill ? formatCurrency(confirmBill.amount) : ''}`}
        loading={deleting}
        onCancel={() => setConfirmBill(null)}
        onConfirm={handleDelete}
      />

      <Modal open={addOpen} onClose={() => setAddOpen(false)} title="Add recurring bill">
        <form onSubmit={handleAdd} className="space-y-4">
          <Input
            label="Name"
            id="bill-name"
            value={form.name}
            onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            placeholder="e.g. Netflix, Rent"
            required
          />
          <Input
            label="Amount"
            id="bill-amount"
            type="number"
            step="0.01"
            min="0"
            value={form.amount}
            onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
            placeholder="0.00"
            required
          />
          <Select
            label="Frequency"
            id="bill-freq"
            value={form.frequency}
            onChange={e => setForm(f => ({ ...f, frequency: e.target.value as typeof form.frequency }))}
          >
            <option value="monthly">Monthly</option>
            <option value="annual">Annual</option>
            <option value="weekly">Weekly</option>
          </Select>
          <Input
            label="Next due date"
            id="bill-date"
            type="date"
            value={form.next_due_date}
            onChange={e => setForm(f => ({ ...f, next_due_date: e.target.value }))}
            required
          />
          <Select
            label="Category (optional)"
            id="bill-cat"
            value={form.category_id}
            onChange={e => setForm(f => ({ ...f, category_id: e.target.value }))}
          >
            <option value="">— none —</option>
            {Object.entries(buckets).map(([bucket, cats]) => (
              <optgroup key={bucket} label={BUCKET_LABELS[bucket as Bucket]}>
                {cats.map(cat => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
              </optgroup>
            ))}
          </Select>
          <Button type="submit" disabled={loading || !form.name || !form.amount} className="w-full">
            {loading ? 'Saving...' : 'Add bill'}
          </Button>
        </form>
      </Modal>
    </div>
  )
}
