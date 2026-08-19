'use client'

import useSWR, { mutate } from 'swr'
import { createClient } from '@/lib/supabase/client'
import { fetchSnapshots, fetchInvestments } from '@/lib/data'
import { NetWorthSnapshot, InvestmentHolding } from '@/types'
import { formatCurrency, formatDate, localDateString } from '@/lib/utils'
import { NetWorthLine } from '@/components/charts/networth-line'
import { Modal } from '@/components/ui/modal'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { SwipeableRow } from '@/components/ui/swipeable-row'
import { ConfirmDeleteDialog } from '@/components/ui/confirm-delete-dialog'
import { useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'

interface AssetEntry { name: string; value: string }
type EntryType = 'asset' | 'liability'

const RANGES = ['1M', 'YTD', '1Y', '3Y', 'All'] as const
type Range = typeof RANGES[number]

function rangeCutoff(range: Range): Date | null {
  const now = new Date()
  switch (range) {
    case '1M': return new Date(now.getFullYear(), now.getMonth() - 1, now.getDate())
    case 'YTD': return new Date(now.getFullYear(), 0, 1)
    case '1Y': return new Date(now.getFullYear() - 1, now.getMonth(), now.getDate())
    case '3Y': return new Date(now.getFullYear() - 3, now.getMonth(), now.getDate())
    case 'All': return null
  }
}

export function NetWorthTab() {
  const supabase = createClient()
  const { data } = useSWR('snapshots', fetchSnapshots)
  const snapshots = (data ?? []) as NetWorthSnapshot[]
  const { data: investmentsData } = useSWR('investments', fetchInvestments)
  const holdings = (investmentsData ?? []) as InvestmentHolding[]

  const [addOpen, setAddOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [date, setDate] = useState(localDateString())
  const [assets, setAssets] = useState<AssetEntry[]>([{ name: '', value: '' }])
  const [liabilities, setLiabilities] = useState<AssetEntry[]>([{ name: '', value: '' }])
  const [range, setRange] = useState<Range>('1M')

  const [editingEntry, setEditingEntry] = useState<{ type: EntryType; name: string } | null>(null)
  const [editName, setEditName] = useState('')
  const [editValue, setEditValue] = useState('')
  const [confirmEntry, setConfirmEntry] = useState<{ type: EntryType; name: string; value: number } | null>(null)
  const [entryLoading, setEntryLoading] = useState(false)

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
    if (portfolioTotal > 0) {
      assetsMap['Investments'] = portfolioTotal
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

  function openEditEntry(type: EntryType, name: string, value: number) {
    setEditingEntry({ type, name })
    setEditName(name)
    setEditValue(String(value))
  }

  async function handleSaveEntry(e: React.FormEvent) {
    e.preventDefault()
    if (!editingEntry || !latest) return
    setEntryLoading(true)
    const assetsMap = { ...latest.assets }
    const liabMap = { ...latest.liabilities }
    const targetMap = editingEntry.type === 'asset' ? assetsMap : liabMap
    delete targetMap[editingEntry.name]
    targetMap[editName] = parseFloat(editValue)
    const total = Object.values(assetsMap).reduce((s, v) => s + v, 0) - Object.values(liabMap).reduce((s, v) => s + v, 0)
    await supabase.from('net_worth_snapshots').update({ assets: assetsMap, liabilities: liabMap, total }).eq('id', latest.id)
    setEntryLoading(false)
    setEditingEntry(null)
    mutate('snapshots')
  }

  async function handleDeleteEntry() {
    if (!confirmEntry || !latest) return
    setEntryLoading(true)
    const assetsMap = { ...latest.assets }
    const liabMap = { ...latest.liabilities }
    const targetMap = confirmEntry.type === 'asset' ? assetsMap : liabMap
    delete targetMap[confirmEntry.name]
    const total = Object.values(assetsMap).reduce((s, v) => s + v, 0) - Object.values(liabMap).reduce((s, v) => s + v, 0)
    await supabase.from('net_worth_snapshots').update({ assets: assetsMap, liabilities: liabMap, total }).eq('id', latest.id)
    setEntryLoading(false)
    setConfirmEntry(null)
    mutate('snapshots')
  }

  const portfolioTotal = holdings.reduce((s, h) => s + h.current_value, 0)
  const latest = snapshots[snapshots.length - 1]
  const cutoff = rangeCutoff(range)
  const rangedSnapshots = cutoff ? snapshots.filter(s => new Date(s.date + 'T00:00:00') >= cutoff) : snapshots
  const chartData = rangedSnapshots.map(s => ({
    date: new Date(s.date + 'T00:00:00').toLocaleDateString('en-US', range === '1M' ? { month: 'short', day: 'numeric' } : { month: 'short', year: '2-digit' }),
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
          <p className="text-xs font-medium text-zinc-400 uppercase tracking-wide">Net worth</p>
          <p className={`text-3xl font-semibold tabular-nums mt-1 ${latest.total >= 0 ? 'text-zinc-900 dark:text-zinc-100' : 'text-red-500'}`}>
            {formatCurrency(latest.total)}
          </p>
          <p className="text-xs text-zinc-400 mt-0.5">As of {formatDate(latest.date)}</p>
        </div>
      )}

      {latest && Object.keys(latest.assets).length > 0 && (
        <div>
          <p className="text-xs font-medium text-zinc-400 uppercase tracking-wide mb-2 px-1">Assets</p>
          <div className="flex flex-col divide-y divide-zinc-100 dark:divide-zinc-800 rounded-xl border border-zinc-100 dark:border-zinc-800 overflow-hidden">
            {Object.entries(latest.assets).map(([name, value]) => (
              name === 'Investments' ? (
                <div key={name} className="flex items-center justify-between px-4 py-3 bg-white dark:bg-zinc-900">
                  <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100 truncate">{name}</span>
                  <span className="text-sm font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">
                    {formatCurrency(value)}
                  </span>
                </div>
              ) : (
                <SwipeableRow
                  key={name}
                  onEdit={() => openEditEntry('asset', name, value)}
                  onDelete={() => setConfirmEntry({ type: 'asset', name, value })}
                >
                  <div className="flex items-center justify-between px-4 py-3 bg-white dark:bg-zinc-900">
                    <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100 truncate">{name}</span>
                    <span className="text-sm font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">
                      {formatCurrency(value)}
                    </span>
                  </div>
                </SwipeableRow>
              )
            ))}
          </div>
        </div>
      )}

      {latest && Object.keys(latest.liabilities).length > 0 && (
        <div>
          <p className="text-xs font-medium text-zinc-400 uppercase tracking-wide mb-2 px-1">Liabilities</p>
          <div className="flex flex-col divide-y divide-zinc-100 dark:divide-zinc-800 rounded-xl border border-zinc-100 dark:border-zinc-800 overflow-hidden">
            {Object.entries(latest.liabilities).map(([name, value]) => (
              <SwipeableRow
                key={name}
                onEdit={() => openEditEntry('liability', name, value)}
                onDelete={() => setConfirmEntry({ type: 'liability', name, value })}
              >
                <div className="flex items-center justify-between px-4 py-3 bg-white dark:bg-zinc-900">
                  <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100 truncate">{name}</span>
                  <span className="text-sm font-semibold tabular-nums text-red-500">
                    {formatCurrency(-value)}
                  </span>
                </div>
              </SwipeableRow>
            ))}
          </div>
        </div>
      )}

      <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-100 dark:border-zinc-800 p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">History</h2>
          <div className="flex gap-0.5">
            {RANGES.map(r => (
              <button
                key={r}
                onClick={() => setRange(r)}
                className={`px-2 py-1 rounded-md text-xs font-medium transition-colors ${
                  range === r
                    ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-900'
                    : 'text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                }`}
              >
                {r}
              </button>
            ))}
          </div>
        </div>
        <NetWorthLine data={chartData} />
      </div>

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
            {portfolioTotal > 0 && (
              <p className="text-xs text-zinc-400">
                Investments ({formatCurrency(portfolioTotal)}) added automatically — enter bank accounts etc. below
              </p>
            )}
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

      <Modal open={!!editingEntry} onClose={() => setEditingEntry(null)} title={editingEntry?.type === 'liability' ? 'Edit liability' : 'Edit asset'}>
        <form onSubmit={handleSaveEntry} className="space-y-4">
          <Input
            label="Name"
            id="entry-name"
            value={editName}
            onChange={e => setEditName(e.target.value)}
            required
          />
          <Input
            label="Value"
            id="entry-value"
            type="number"
            step="0.01"
            value={editValue}
            onChange={e => setEditValue(e.target.value)}
            required
          />
          <Button type="submit" disabled={entryLoading} className="w-full">
            {entryLoading ? 'Saving...' : 'Save'}
          </Button>
        </form>
      </Modal>

      <ConfirmDeleteDialog
        open={!!confirmEntry}
        title={confirmEntry?.type === 'liability' ? 'Delete liability?' : 'Delete asset?'}
        description={`${confirmEntry?.name ?? ''} · ${confirmEntry ? formatCurrency(confirmEntry.value) : ''}`}
        loading={entryLoading}
        onCancel={() => setConfirmEntry(null)}
        onConfirm={handleDeleteEntry}
      />
    </div>
  )
}
