'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Category, Transaction, TransactionType, Bucket } from '@/types'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { BUCKET_LABELS, localDateString, transactionDelta } from '@/lib/utils'
import { CATEGORY_COLORS as COLORS } from '@/lib/colors'
import { adjustCheckingBalance } from '@/lib/data'

interface TransactionFormProps {
  onSuccess: () => void
  transaction?: Transaction  // if provided, form is in edit mode
}

export function TransactionForm({ onSuccess, transaction }: TransactionFormProps) {
  const supabase = createClient()
  const isEdit = !!transaction
  const [loading, setLoading] = useState(false)
  const [categories, setCategories] = useState<Category[]>([])
  const [suggestedCategoryId, setSuggestedCategoryId] = useState<string>('')

  const [form, setForm] = useState({
    type: (transaction?.type ?? 'expense') as TransactionType,
    amount: transaction ? String(transaction.amount) : '',
    merchant: transaction?.merchant ?? '',
    description: transaction?.description ?? '',
    category_id: transaction?.category_id ?? '',
    date: transaction?.date ?? localDateString(),
  })

  // Inline new category form
  const [showNewCat, setShowNewCat] = useState(false)
  const [newCat, setNewCat] = useState({ name: '', bucket: 'spending' as Bucket, color: COLORS[0] })
  const [savingCat, setSavingCat] = useState(false)

  async function loadCategories() {
    const { data } = await supabase.from('categories').select('*').order('bucket').order('name')
    if (data) setCategories(data)
  }

  useEffect(() => {
    loadCategories()
  }, [])

  // Merchant memory (only in add mode)
  useEffect(() => {
    if (isEdit) return
    const merchant = form.merchant.trim()
    if (!merchant) return
    const timer = setTimeout(async () => {
      const { data } = await supabase
        .from('merchant_categories')
        .select('category_id')
        .eq('merchant', merchant.toLowerCase())
        .single()
      if (data?.category_id) {
        setSuggestedCategoryId(data.category_id)
        setForm(f => ({ ...f, category_id: data.category_id }))
      }
    }, 400)
    return () => clearTimeout(timer)
  }, [form.merchant])

  async function handleCreateCategory(e: React.FormEvent) {
    e.preventDefault()
    setSavingCat(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data } = await supabase
      .from('categories')
      .insert({ user_id: user.id, name: newCat.name, bucket: newCat.bucket, color: newCat.color })
      .select()
      .single()
    await loadCategories()
    if (data) {
      setForm(f => ({ ...f, category_id: data.id }))
      setSuggestedCategoryId('')
    }
    setNewCat({ name: '', bucket: 'spending', color: COLORS[0] })
    setShowNewCat(false)
    setSavingCat(false)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)

    const payload = {
      type: form.type,
      amount: parseFloat(form.amount),
      merchant: form.merchant || null,
      description: form.description || null,
      category_id: form.category_id || null,
      date: form.date,
    }

    if (isEdit) {
      const { error } = await supabase.from('transactions').update(payload).eq('id', transaction.id)
      if (!error) {
        const oldDelta = transactionDelta(transaction.type, transaction.amount)
        const newDelta = transactionDelta(payload.type, payload.amount)
        await adjustCheckingBalance(newDelta - oldDelta)
      }
      setLoading(false)
      if (!error) onSuccess()
      return
    }

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { error } = await supabase.from('transactions').insert({ user_id: user.id, ...payload })

    if (!error) {
      await adjustCheckingBalance(transactionDelta(payload.type, payload.amount))
    }

    if (!error && form.merchant && form.category_id) {
      await supabase.from('merchant_categories').upsert({
        user_id: user.id,
        merchant: form.merchant.trim().toLowerCase(),
        category_id: form.category_id,
      }, { onConflict: 'user_id,merchant' })
    }

    setLoading(false)
    if (!error) {
      setForm({ type: 'expense', amount: '', merchant: '', description: '', category_id: '', date: localDateString() })
      setSuggestedCategoryId('')
      onSuccess()
    }
  }

  const buckets: Record<string, Category[]> = {}
  for (const cat of categories) {
    if (!buckets[cat.bucket]) buckets[cat.bucket] = []
    buckets[cat.bucket].push(cat)
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <Select
        label="Type"
        id="type"
        value={form.type}
        onChange={e => setForm(f => ({ ...f, type: e.target.value as TransactionType }))}
      >
        <option value="income">Income</option>
        <option value="expense">Expense</option>
        <option value="savings">Savings</option>
      </Select>

      <Input
        label="Amount"
        id="amount"
        type="number"
        step="0.01"
        min="0"
        placeholder="0.00"
        value={form.amount}
        onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
        required
      />

      <Input
        label="Merchant / From"
        id="merchant"
        type="text"
        placeholder="e.g. Trader Joe's, Employer"
        value={form.merchant}
        onChange={e => setForm(f => ({ ...f, merchant: e.target.value }))}
      />

      {suggestedCategoryId && form.category_id === suggestedCategoryId && (
        <p className="text-xs text-emerald-600 dark:text-emerald-400">
          Auto-categorized based on past entries
        </p>
      )}

      <Select
        label="Category"
        id="category"
        value={form.category_id}
        onChange={e => {
          const val = e.target.value
          if (val === '__new__') {
            setShowNewCat(true)
            setForm(f => ({ ...f, category_id: '' }))
          } else {
            setSuggestedCategoryId('')
            setShowNewCat(false)
            setForm(f => ({ ...f, category_id: val }))
          }
        }}
      >
        <option value="">— none —</option>
        {Object.entries(buckets).map(([bucket, cats]) => (
          <optgroup key={bucket} label={BUCKET_LABELS[bucket]}>
            {cats.map(cat => (
              <option key={cat.id} value={cat.id}>{cat.name}</option>
            ))}
          </optgroup>
        ))}
        <option value="__new__">+ Create new category</option>
      </Select>

      {showNewCat && (
        <div className="flex flex-col gap-3 p-4 rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700">
          <p className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">New category</p>
          <Input
            label="Name"
            id="new-cat-name"
            value={newCat.name}
            onChange={e => setNewCat(n => ({ ...n, name: e.target.value }))}
            placeholder="e.g. Groceries"
            required
          />
          <Select
            label="Bucket"
            id="new-cat-bucket"
            value={newCat.bucket}
            onChange={e => setNewCat(n => ({ ...n, bucket: e.target.value as Bucket }))}
          >
            <option value="bills">Bills</option>
            <option value="spending">Spending</option>
            <option value="savings">Savings</option>
          </Select>
          <div>
            <label className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">Color</label>
            <div className="flex flex-wrap gap-2 mt-1.5">
              {COLORS.map(c => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setNewCat(n => ({ ...n, color: c }))}
                  className="w-6 h-6 rounded-full transition-transform hover:scale-110"
                  style={{
                    background: c,
                    outline: newCat.color === c ? `2px solid ${c}` : 'none',
                    outlineOffset: 2,
                  }}
                />
              ))}
            </div>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => { setShowNewCat(false); setNewCat({ name: '', bucket: 'spending', color: COLORS[0] }) }}
              className="flex-1 py-2 rounded-lg border border-zinc-200 dark:border-zinc-600 text-sm text-zinc-500"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleCreateCategory}
              disabled={savingCat || !newCat.name}
              className="flex-1 py-2 rounded-lg bg-zinc-900 dark:bg-zinc-100 text-sm font-medium text-white dark:text-zinc-900 disabled:opacity-40"
            >
              {savingCat ? 'Saving…' : 'Create'}
            </button>
          </div>
        </div>
      )}

      <Input
        label="Note (optional)"
        id="description"
        type="text"
        placeholder="Any notes"
        value={form.description}
        onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
      />

      <Input
        label="Date"
        id="date"
        type="date"
        value={form.date}
        onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
        required
      />

      <Button type="submit" disabled={loading || !form.amount}>
        {loading ? 'Saving...' : isEdit ? 'Save changes' : 'Add Transaction'}
      </Button>
    </form>
  )
}
