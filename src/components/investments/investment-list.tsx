'use client'

import { InvestmentHolding } from '@/types'
import { formatCurrency, formatDate } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { useState } from 'react'
import { SwipeableRow } from '@/components/ui/swipeable-row'
import { ConfirmDeleteDialog } from '@/components/ui/confirm-delete-dialog'
import { investmentCategoryMeta } from './categories'

interface InvestmentListProps {
  holdings: InvestmentHolding[]
  onDelete: () => void
  onEdit: (h: InvestmentHolding) => void
}

export function InvestmentList({ holdings, onDelete, onEdit }: InvestmentListProps) {
  const supabase = createClient()
  const [deleting, setDeleting] = useState(false)
  const [confirmTarget, setConfirmTarget] = useState<InvestmentHolding | null>(null)

  async function handleConfirmDelete() {
    if (!confirmTarget) return
    setDeleting(true)
    await supabase.from('investment_holdings').delete().eq('id', confirmTarget.id)
    setDeleting(false)
    setConfirmTarget(null)
    onDelete()
  }

  if (!holdings.length) {
    return <div className="text-center py-12 text-zinc-400 text-sm">No investments yet</div>
  }

  return (
    <>
      <div className="flex flex-col divide-y divide-zinc-100 dark:divide-zinc-800 rounded-xl border border-zinc-100 dark:border-zinc-800 overflow-hidden">
        {holdings.map(h => {
          const meta = investmentCategoryMeta(h.category)
          const pricePerShare = h.last_price ?? (h.shares ? h.current_value / h.shares : null)
          return (
            <SwipeableRow key={h.id} onEdit={() => onEdit(h)} onDelete={() => setConfirmTarget(h)}>
              <div className="flex items-center justify-between px-4 py-3 bg-white dark:bg-zinc-900">
                <div className="flex flex-col min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100 truncate">{h.name}</span>
                    {h.ticker && <span className="text-xs font-mono text-zinc-400">{h.ticker}</span>}
                    <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${meta.color}`}>
                      {meta.label}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    {h.shares && <span className="text-xs text-zinc-400">{h.shares} shares</span>}
                    {pricePerShare && <span className="text-xs text-zinc-400">@ {formatCurrency(pricePerShare)}</span>}
                    {!h.shares && <span className="text-xs text-zinc-400">As of {formatDate(h.value_date)}</span>}
                  </div>
                </div>
                <span className="text-sm font-semibold tabular-nums ml-3 shrink-0 text-zinc-900 dark:text-zinc-100">
                  {formatCurrency(h.current_value)}
                </span>
              </div>
            </SwipeableRow>
          )
        })}
      </div>

      <ConfirmDeleteDialog
        open={!!confirmTarget}
        title="Delete investment?"
        description={`${confirmTarget?.name ?? ''} · ${confirmTarget ? formatCurrency(confirmTarget.current_value) : ''}`}
        loading={deleting}
        onCancel={() => setConfirmTarget(null)}
        onConfirm={handleConfirmDelete}
      />
    </>
  )
}
