'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Category, TransactionType } from '@/types'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { BUCKET_LABELS } from '@/lib/utils'

interface TransactionFormProps {
  onSuccess: () => void
}

export function TransactionForm({ onSuccess }: TransactionFormProps) {
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [categories, setCategories] = useState<Category[]>([])
  const [suggestedCategoryId, setSuggestedCategoryId] = useState<string>('')

  const [form, setForm] = useState({
    type: 'expense' as TransactionType,
    amount: '',
    merchant: '',
    description: '',
    category_id: '',
    date: new Date().toISOString().split('T')[0],
  })

  useEffect(() => {
    supabase.from('categories').select('*').order('bucket').order('name').then(({ data }) => {
      if (data) setCategories(data)
    })
  }, [])

  // Merchant memory: look up category when merchant changes
  useEffect(() => {
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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { error } = await supabase.from('transactions').insert({
      user_id: user.id,
      type: form.type,
      amount: parseFloat(form.amount),
      merchant: form.merchant || null,
      description: form.description || null,
      category_id: form.category_id || null,
      date: form.date,
    })

    if (!error && form.merchant && form.category_id) {
      // Save/update merchant memory
      await supabase.from('merchant_categories').upsert({
        user_id: user.id,
        merchant: form.merchant.trim().toLowerCase(),
        category_id: form.category_id,
      }, { onConflict: 'user_id,merchant' })
    }

    setLoading(false)
    if (!error) {
      setForm({ type: 'expense', amount: '', merchant: '', description: '', category_id: '', date: new Date().toISOString().split('T')[0] })
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
        onChange={e => { setSuggestedCategoryId(''); setForm(f => ({ ...f, category_id: e.target.value })) }}
      >
        <option value="">— none —</option>
        {Object.entries(buckets).map(([bucket, cats]) => (
          <optgroup key={bucket} label={BUCKET_LABELS[bucket]}>
            {cats.map(cat => (
              <option key={cat.id} value={cat.id}>{cat.name}</option>
            ))}
          </optgroup>
        ))}
      </Select>

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
        {loading ? 'Saving...' : 'Add Transaction'}
      </Button>
    </form>
  )
}
