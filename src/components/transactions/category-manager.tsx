'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Category, Bucket } from '@/types'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Trash2 } from 'lucide-react'
import { BUCKET_LABELS, BUCKET_COLORS } from '@/lib/utils'

const COLORS = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6', '#8b5cf6', '#ec4899', '#6b7280']

export function CategoryManager() {
  const supabase = createClient()
  const [categories, setCategories] = useState<Category[]>([])
  const [name, setName] = useState('')
  const [bucket, setBucket] = useState<Bucket>('spending')
  const [color, setColor] = useState(COLORS[0])
  const [loading, setLoading] = useState(false)

  async function load() {
    const { data } = await supabase.from('categories').select('*').order('bucket').order('name')
    setCategories((data ?? []) as Category[])
  }

  useEffect(() => { load() }, [])

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    await supabase.from('categories').insert({ user_id: user.id, name, bucket, color })
    setName('')
    setLoading(false)
    load()
  }

  async function handleDelete(id: string) {
    await supabase.from('categories').delete().eq('id', id)
    load()
  }

  const buckets = ['bills', 'spending', 'savings'] as Bucket[]

  return (
    <div className="space-y-5">
      {/* Existing categories */}
      {buckets.map(b => {
        const cats = categories.filter(c => c.bucket === b)
        if (!cats.length) return null
        return (
          <div key={b}>
            <p className="text-xs font-medium text-zinc-400 uppercase tracking-wide mb-2">{BUCKET_LABELS[b]}</p>
            <div className="flex flex-col gap-1">
              {cats.map(c => (
                <div key={c.id} className="flex items-center justify-between px-3 py-2 rounded-lg bg-zinc-50 dark:bg-zinc-800 group">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ background: c.color }} />
                    <span className="text-sm text-zinc-900 dark:text-zinc-100">{c.name}</span>
                  </div>
                  <button
                    onClick={() => handleDelete(c.id)}
                    className="opacity-0 group-hover:opacity-100 p-1 text-zinc-300 hover:text-red-500 transition-all"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )
      })}

      {/* Add new */}
      <form onSubmit={handleAdd} className="space-y-3 border-t border-zinc-100 dark:border-zinc-800 pt-4">
        <p className="text-xs font-medium text-zinc-500 uppercase tracking-wide">Add category</p>
        <Input
          label="Name"
          id="cat-name"
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="e.g. Groceries"
          required
        />
        <Select
          label="Bucket"
          id="cat-bucket"
          value={bucket}
          onChange={e => setBucket(e.target.value as Bucket)}
        >
          {buckets.map(b => <option key={b} value={b}>{BUCKET_LABELS[b]}</option>)}
        </Select>
        <div>
          <label className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">Color</label>
          <div className="flex gap-2 mt-1.5">
            {COLORS.map(c => (
              <button
                key={c}
                type="button"
                onClick={() => setColor(c)}
                className="w-6 h-6 rounded-full transition-transform hover:scale-110"
                style={{
                  background: c,
                  outline: color === c ? `2px solid ${c}` : 'none',
                  outlineOffset: 2,
                }}
              />
            ))}
          </div>
        </div>
        <Button type="submit" disabled={loading || !name} className="w-full">
          Add category
        </Button>
      </form>
    </div>
  )
}
