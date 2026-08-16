'use client'

import useSWR, { mutate } from 'swr'
import { createClient } from '@/lib/supabase/client'
import { fetchSnapshots } from '@/lib/data'
import { NetWorthSnapshot } from '@/types'
import { formatCurrency, formatDate } from '@/lib/utils'
import { NetWorthLine } from '@/components/charts/networth-line'
import { Modal } from '@/components/ui/modal'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'

interface AssetEntry { name: string; value: string }

export function NetWorthTab() {
  const supabase = createClient()
  const { data } = useSWR('snapshots', fetchSnapshots)
  const snapshots = (data ?? []) as NetWorthSnapshot[]

  const [addOpen, setAddOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [assets, setAssets] = useState<AssetEntry[]>([{ name: '', value: '' }])
  const [liabilities, setLiabilities] = useState<AssetEntry[]>([{ name: '', value: '' }])

  function addRow(setter: typeof setAssets) {
    setter(rows => [...rows, { name: '', value: '' }])
  }

  function updateRow(setter: typeof setAssets, i: number, field: keyof AssetEntry, val: string) {
    setter(rows => rows.map((r, idx) => idx === i ? { ...r, [field]: val } : r))
  }

  function removeRow(setter: typeof setAssets, i: number) {
    setter(rows => rows.filter((_, idx) => idx !== i))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const assetsMap: Record<string, number> = {}
    for (const a of assets.filter(a => a.name && a.value)) {
      assetsMap[a.name] = parseFloat(a.value)
    }
    const liabMap: Record<string, number> = {}
    for (const l of liabilities.filter(l => l.name && l.value)) {
      liabMap[l.name] = parseFloat(l.value)
    }
    const totalAssets = Object.values(assetsMap).reduce((s, v) => s + v, 0)
    const totalLiab = Object.values(liabMap).reduce((s, v) => s + v, 0)

    await supabase.from('net_worth_snapshots').insert({
      user_id: user.id,
      date,
      assets: assetsMap,
      liabilities: liabMap,
      total: totalAssets - totalLiab,
    })
    setLoading(false)
    setAddOpen(false)
    setAssets([{ name: '', value: '' }])
    setLiabilities([{ name: '', value: '' }])
    mutate('snapshots')
  }

  async function handleDelete(id: string) {
    await supabase.from('net_worth_snapshots').delete().eq('id', id)
    mutate('snapshots')
  }

  const latest = snapshots[snapshots.length - 1]
  const chartData = snapshots.map(s => ({
    date: new Date(s.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
    total: s.total,
  }))

  return (
    <div className="px-4 pt-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">Net Worth</h1>
        <Button onClick={() => setAddOpen(true)} size="sm">
          <Plus size={14} className="mr-1" />
          Snapshot
        </Button>
      </div>

      {latest && (
        <div className="rounded-xl border border-zinc-100 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4">
          <p className="text-xs font-medium text-zinc-400 uppercase tracking-wide">Current net worth</p>
          <p className={`text-3xl font-semibold tabular-nums mt-1 ${latest.total >= 0 ? 'text-zinc-900 dark:text-zinc-100' : 'text-red-500'}`}>
            {formatCurrency(latest.total)}
          </p>
          <p className="text-xs text-zinc-400 mt-0.5">As of {formatDate(latest.date)}</p>
        </div>
      )}

      <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-100 dark:border-zinc-800 p-4">
        <h2 className="text-sm font-medium text-zinc-900 dark:text-zinc-100 mb-3">History</h2>
        <NetWorthLine data={chartData} />
      </div>

      {/* Snapshot list */}
      {snapshots.length > 0 && (
        <div className="flex flex-col divide-y divide-zinc-100 dark:divide-zinc-800 rounded-xl border border-zinc-100 dark:border-zinc-800 overflow-hidden">
          {[...snapshots].reverse().map(s => (
            <div key={s.id} className="flex items-center justify-between px-4 py-3 bg-white dark:bg-zinc-900 group">
              <div>
                <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{formatDate(s.date)}</p>
                <p className="text-xs text-zinc-400">
                  Assets {formatCurrency(Object.values(s.assets).reduce((a, b) => a + b, 0))} · Liabilities {formatCurrency(Object.values(s.liabilities).reduce((a, b) => a + b, 0))}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span className={`text-sm font-semibold tabular-nums ${s.total >= 0 ? 'text-zinc-900 dark:text-zinc-100' : 'text-red-500'}`}>
                  {formatCurrency(s.total)}
                </span>
                <button
                  onClick={() => handleDelete(s.id)}
                  className="opacity-0 group-hover:opacity-100 p-1 text-zinc-300 hover:text-red-500 transition-all"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={addOpen} onClose={() => setAddOpen(false)} title="New net worth snapshot">
        <form onSubmit={handleSubmit} className="space-y-5">
          <Input
            label="Date"
            id="nw-date"
            type="date"
            value={date}
            onChange={e => setDate(e.target.value)}
          />

          <div className="space-y-2">
            <p className="text-xs font-medium text-zinc-500 uppercase tracking-wide">Assets</p>
            {assets.map((a, i) => (
              <div key={i} className="flex gap-2">
                <Input placeholder="Name (e.g. Checking)" value={a.name} onChange={e => updateRow(setAssets, i, 'name', e.target.value)} />
                <Input placeholder="$0" type="number" value={a.value} onChange={e => updateRow(setAssets, i, 'value', e.target.value)} className="w-28" />
                {assets.length > 1 && (
                  <button type="button" onClick={() => removeRow(setAssets, i)} className="text-zinc-300 hover:text-red-500">
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            ))}
            <button type="button" onClick={() => addRow(setAssets)} className="text-xs text-zinc-400 hover:text-zinc-600">
              + Add asset
            </button>
          </div>

          <div className="space-y-2">
            <p className="text-xs font-medium text-zinc-500 uppercase tracking-wide">Liabilities</p>
            {liabilities.map((l, i) => (
              <div key={i} className="flex gap-2">
                <Input placeholder="Name (e.g. Credit card)" value={l.name} onChange={e => updateRow(setLiabilities, i, 'name', e.target.value)} />
                <Input placeholder="$0" type="number" value={l.value} onChange={e => updateRow(setLiabilities, i, 'value', e.target.value)} className="w-28" />
                {liabilities.length > 1 && (
                  <button type="button" onClick={() => removeRow(setLiabilities, i)} className="text-zinc-300 hover:text-red-500">
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            ))}
            <button type="button" onClick={() => addRow(setLiabilities)} className="text-xs text-zinc-400 hover:text-zinc-600">
              + Add liability
            </button>
          </div>

          <Button type="submit" disabled={loading} className="w-full">
            {loading ? 'Saving...' : 'Save snapshot'}
          </Button>
        </form>
      </Modal>
    </div>
  )
}
