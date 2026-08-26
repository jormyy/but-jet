'use client'

import { useState } from 'react'
import useSWR, { useSWRConfig } from 'swr'
import { createClient } from '@/lib/supabase/client'
import { fetchCategories } from '@/lib/data'
import { Category, Bucket } from '@/types'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Trash2, Pencil } from 'lucide-react'
import { BUCKET_LABELS } from '@/lib/utils'
import { CATEGORY_COLORS as COLORS } from '@/lib/colors'
import { ColorPicker } from './color-picker'

const BUCKETS = ['bills', 'spending', 'savings'] as Bucket[]

export function CategoryManager() {
  const supabase = createClient()
  const { mutate } = useSWRConfig()
  // Shared with the bills and home tabs: editing a category here has to show
  // up in their breakdowns, which it did not while this kept its own copy.
  const { data } = useSWR('categories', fetchCategories)
  const categories = data ?? []
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

  const reload = () => mutate('categories')

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
    await reload()
    setEditingId(null)
    setSaving(false)
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      await supabase.from('categories').insert({ user_id: user.id, name, bucket, color })
      setName('')
      reload()
    }
    setLoading(false)
  }

  async function handleDelete(id: string) {
    await supabase.from('categories').delete().eq('id', id)
    if (editingId === id) setEditingId(null)
    reload()
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
                        <ColorPicker value={editDraft.color} onChange={color => setEditDraft(d => ({ ...d, color }))} />
                      <div className="flex gap-2">
                        <Button type="button" variant="outline" onClick={cancelEdit} className="flex-1">
                          Cancel
                        </Button>
                        <Button type="button" onClick={() => handleSaveEdit(c.id)} disabled={saving || !editDraft.name} className="flex-1">
                          {saving ? 'Saving…' : 'Save'}
                        </Button>
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
        <ColorPicker value={color} onChange={setColor} />
        <Button type="submit" disabled={loading || !name} className="w-full">
          Add category
        </Button>
      </form>
    </div>
  )
}
