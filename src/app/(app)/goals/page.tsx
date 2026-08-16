'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Goal } from '@/types'
import { formatCurrency, formatDate } from '@/lib/utils'
import { Modal } from '@/components/ui/modal'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Plus, Trash2 } from 'lucide-react'

export default function GoalsPage() {
  const supabase = createClient()
  const [goals, setGoals] = useState<Goal[]>([])
  const [addOpen, setAddOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    name: '',
    target_amount: '',
    current_amount: '',
    target_date: '',
  })

  async function load() {
    const { data } = await supabase.from('goals').select('*').order('created_at')
    setGoals((data ?? []) as Goal[])
  }

  useEffect(() => { load() }, [])

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    await supabase.from('goals').insert({
      user_id: user.id,
      name: form.name,
      target_amount: parseFloat(form.target_amount),
      current_amount: form.current_amount ? parseFloat(form.current_amount) : 0,
      target_date: form.target_date || null,
      type: 'retirement',
    })
    setForm({ name: '', target_amount: '', current_amount: '', target_date: '' })
    setLoading(false)
    setAddOpen(false)
    load()
  }

  async function handleUpdateCurrent(id: string, value: string) {
    const num = parseFloat(value)
    if (isNaN(num)) return
    await supabase.from('goals').update({ current_amount: num }).eq('id', id)
    load()
  }

  async function handleDelete(id: string) {
    await supabase.from('goals').delete().eq('id', id)
    load()
  }

  return (
    <div className="px-4 pt-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">Goals</h1>
        <Button onClick={() => setAddOpen(true)} size="sm">
          <Plus size={14} className="mr-1" />
          Add
        </Button>
      </div>

      {goals.length === 0 ? (
        <div className="text-center py-12 text-zinc-400 text-sm">No goals yet</div>
      ) : (
        <div className="space-y-3">
          {goals.map(goal => {
            const pct = Math.min(100, (goal.current_amount / goal.target_amount) * 100)
            const remaining = goal.target_amount - goal.current_amount
            return (
              <div key={goal.id} className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-100 dark:border-zinc-800 p-4 group">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{goal.name}</p>
                    {goal.target_date && (
                      <p className="text-xs text-zinc-400">Target: {formatDate(goal.target_date)}</p>
                    )}
                  </div>
                  <button
                    onClick={() => handleDelete(goal.id)}
                    className="opacity-0 group-hover:opacity-100 p-1 text-zinc-300 hover:text-red-500 transition-all"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>

                {/* Progress bar */}
                <div className="w-full bg-zinc-100 dark:bg-zinc-800 rounded-full h-2 mb-3">
                  <div
                    className="bg-zinc-900 dark:bg-zinc-100 h-2 rounded-full transition-all"
                    style={{ width: `${pct}%` }}
                  />
                </div>

                <div className="flex items-center justify-between text-xs text-zinc-400">
                  <span>{formatCurrency(goal.current_amount)} saved</span>
                  <span>{formatCurrency(remaining)} to go · {pct.toFixed(0)}%</span>
                  <span className="font-medium text-zinc-600 dark:text-zinc-300">{formatCurrency(goal.target_amount)}</span>
                </div>

                {/* Update current amount inline */}
                <div className="mt-3 flex gap-2">
                  <input
                    type="number"
                    defaultValue={goal.current_amount}
                    onBlur={e => handleUpdateCurrent(goal.id, e.target.value)}
                    className="flex-1 text-xs border border-zinc-200 dark:border-zinc-700 rounded-lg px-2 py-1.5 bg-transparent text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-zinc-400"
                    placeholder="Update current amount"
                  />
                  <span className="text-xs text-zinc-400 self-center">current</span>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <Modal open={addOpen} onClose={() => setAddOpen(false)} title="Add goal">
        <form onSubmit={handleAdd} className="space-y-4">
          <Input
            label="Name"
            id="goal-name"
            value={form.name}
            onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            placeholder="e.g. Retirement fund"
            required
          />
          <Input
            label="Target amount"
            id="goal-target"
            type="number"
            min="0"
            value={form.target_amount}
            onChange={e => setForm(f => ({ ...f, target_amount: e.target.value }))}
            placeholder="1,000,000"
            required
          />
          <Input
            label="Already saved (optional)"
            id="goal-current"
            type="number"
            min="0"
            value={form.current_amount}
            onChange={e => setForm(f => ({ ...f, current_amount: e.target.value }))}
            placeholder="0"
          />
          <Input
            label="Target date (optional)"
            id="goal-date"
            type="date"
            value={form.target_date}
            onChange={e => setForm(f => ({ ...f, target_date: e.target.value }))}
          />
          <Button type="submit" disabled={loading || !form.name || !form.target_amount} className="w-full">
            {loading ? 'Saving...' : 'Add goal'}
          </Button>
        </form>
      </Modal>
    </div>
  )
}
