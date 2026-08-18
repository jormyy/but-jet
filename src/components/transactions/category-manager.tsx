'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Category, Bucket } from '@/types'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Trash2, Pencil } from 'lucide-react'
import { BUCKET_LABELS } from '@/lib/utils'

const COLORS = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6', '#8b5cf6', '#ec4899', '#6b7280']
const BUCKETS = ['bills', 'spending', 'savings'] as Bucket[]

export function CategoryManager() {
  const supabase = createClient()
  const [categories, setCategories] = useState<Category[]>([])
  const [name, setName] = useState('')
  const [bucket, setBucket] = useState<Bucket>('spending')
  const [color, setColor] = useState(COLORS[0])
  const [loading, setLoading] = useState(false)

  // Editing state: id → draft values
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editDraft, setEditDraft] = useState<{ name: string; bucket: Bucket; color: string }>({
    name: '', bucket: 'spending', color: COLORS[0],
  })
  const [saving, setSaving] = useState(false)

  async function load() {
    const { data } = await supabase.from('categories').select('*').order('bucket').order('name')
    setCategories((data ?? []) as Category[])
  }

  useEffect(() => { load() }, [])

  function startEdit(c: Category) {
    setEditingId(c.id)
    setEditDraft({ name: c.name, bucket: c.bucket as Bucket, color: c.color })
  }

  function cancelEdit() {
    setEditingId(null)
  }

  async function handleSaveEdit(id: string) {
    setSaving(true)
    await supabase.from('categories').update({
      name: editDraft.name,
      bucket: editDraft.bucket,
      color: editDraft.color,
    }).eq('id', id)
    await load()
    setEditingId(null)
    setSaving(false)
  }

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
    if (editingId === id) setEditingId(null)
    load()
  }

  return (
    <div className="space-y-5">
      {BUCKETS.map(b => {
        const cats = categories.filter(c => c.bucket === b)
        if (!cats.length) return null
        return (
          <div key={b}>
            <p className="text-xs font-medium text-zinc-400 uppercase tracking-wide mb-2">{BUCKET_LABELS[b]}</p>
            <div className="flex flex-col gap-1">
              {cats.map(c => (
                <div key={c.id} className="rounded-lg bg-zinc-50 dark:bg-zinc-800 overflow-hidden">
                  {editingId === c.id ? (
                    <div className="flex flex-col gap-3 p-3">
                      <Input
                        label="Name"
                        id={`edit-name-${c.id}`}
                        value={editDraft.name}
                        onChange={e => setEditDraft(d => ({ ...d, name: e.target.value }))}
                        required
                      />
                      <Select
                        label="Bucket"
                        id={`edit-bucket-${c.id}`}
                        value={editDraft.bucket}
                        onChange={e => setEditDraft(d => ({ ...d, bucket: e.target.value as Bucket }))}
                      >
                        {BUCKETS.map(bk => <option key={bk} value={bk}>{BUCKET_LABELS[bk]}</option>)}
                      </Select>
                      <div>
                        <label className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">Color</label>
                        <div className="flex gap-2 mt-1.5">
                          {COLORS.map(col => (
                            <button
                              key={col}
                              type="button"
                              onClick={() => setEditDraft(d => ({ ...d, color: col }))}
                              className="w-6 h-6 rounded-full transition-transform hover:scale-110"
                              style={{
                                background: col,
                                outline: editDraft.color === col ? `2px solid ${col}` : 'none',
                                outlineOffset: 2,
                              }}
                            />
                          ))}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={cancelEdit}
                          className="flex-1 py-2 rounded-lg border border-zinc-200 dark:border-zinc-600 text-sm text-zinc-500"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={() => handleSaveEdit(c.id)}
                          disabled={saving || !editDraft.name}
                          className="flex-1 py-2 rounded-lg bg-zinc-900 dark:bg-zinc-100 text-sm font-medium text-white dark:text-zinc-900 disabled:opacity-40"
                        >
                          {saving ? 'Saving…' : 'Save'}
                        </button>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleDelete(c.id)}
                        className="flex items-center justify-center gap-1.5 text-xs text-red-500 py-1"
                      >
                        <Trash2 size={12} />
                        Delete category
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between px-3 py-2 group">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full" style={{ background: c.color }} />
                        <span className="text-sm text-zinc-900 dark:text-zinc-100">{c.name}</span>
                      </div>
                      <button
                        onClick={() => startEdit(c)}
                        className="p-1 text-zinc-300 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors opacity-50 group-hover:opacity-100"
                      >
                        <Pencil size={13} />
                      </button>
                    </div>
                  )}
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
          {BUCKETS.map(b => <option key={b} value={b}>{BUCKET_LABELS[b]}</option>)}
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
