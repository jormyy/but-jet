'use client'

import { Transaction } from '@/types'
import { formatCurrency, formatDate } from '@/lib/utils'
import { Trash2, Pencil } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useState, useRef, useCallback } from 'react'
import { cn } from '@/lib/utils'

const DELETE_WIDTH = 72
const EDIT_WIDTH = 72
const SWIPE_THRESHOLD = 30

interface TransactionListProps {
  transactions: Transaction[]
  onDelete: () => void
  onEdit: (t: Transaction) => void
}

function SwipeableRow({
  t,
  onDeleteRequest,
  onEdit,
}: {
  t: Transaction
  onDeleteRequest: (t: Transaction) => void
  onEdit: (t: Transaction) => void
}) {
  const [offset, setOffset] = useState(0)
  const [dragging, setDragging] = useState(false)
  const startXRef = useRef(0)
  const baseOffsetRef = useRef(0)

  const close = useCallback(() => {
    setOffset(0)
  }, [])

  function handleTouchStart(e: React.TouchEvent) {
    startXRef.current = e.touches[0].clientX
    baseOffsetRef.current = offset
    setDragging(true)
  }

  function handleTouchMove(e: React.TouchEvent) {
    const dx = startXRef.current - e.touches[0].clientX
    const next = Math.max(-EDIT_WIDTH, Math.min(DELETE_WIDTH, baseOffsetRef.current + dx))
    setOffset(next)
  }

  function handleTouchEnd() {
    setDragging(false)
    const isTap = offset === baseOffsetRef.current

    if (isTap) {
      if (offset === 0) {
        onEdit(t)
      } else {
        close()
      }
      return
    }

    if (baseOffsetRef.current > 0) {
      // was open on the delete side
      setOffset(offset < DELETE_WIDTH - SWIPE_THRESHOLD ? 0 : DELETE_WIDTH)
    } else if (baseOffsetRef.current < 0) {
      // was open on the edit side
      setOffset(offset > -(EDIT_WIDTH - SWIPE_THRESHOLD) ? 0 : -EDIT_WIDTH)
    } else if (offset > SWIPE_THRESHOLD) {
      setOffset(DELETE_WIDTH)
    } else if (offset < -SWIPE_THRESHOLD) {
      setOffset(-EDIT_WIDTH)
    } else {
      setOffset(0)
    }
  }

  return (
    <div className="relative overflow-hidden">
      {/* Edit action revealed on swipe right */}
      <div
        className="absolute left-0 top-0 bottom-0 flex items-center justify-center bg-blue-500"
        style={{ width: EDIT_WIDTH }}
      >
        <button
          className="flex flex-col items-center gap-0.5 text-white px-4 h-full w-full justify-center"
          onClick={() => {
            close()
            onEdit(t)
          }}
        >
          <Pencil size={18} />
          <span className="text-xs font-medium">Edit</span>
        </button>
      </div>

      {/* Delete action revealed on swipe left */}
      <div
        className="absolute right-0 top-0 bottom-0 flex items-center justify-center bg-red-500"
        style={{ width: DELETE_WIDTH }}
      >
        <button
          className="flex flex-col items-center gap-0.5 text-white px-4 h-full w-full justify-center"
          onClick={() => {
            close()
            onDeleteRequest(t)
          }}
        >
          <Trash2 size={18} />
          <span className="text-xs font-medium">Delete</span>
        </button>
      </div>

      {/* Row content */}
      <div
        className={cn(
          'flex items-center justify-between px-4 py-3 bg-white dark:bg-zinc-900 relative',
          !dragging && 'transition-transform duration-200 ease-out'
        )}
        style={{ transform: `translateX(${-offset}px)` }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onClick={() => { if (offset === 0) onEdit(t) }}
      >
        <div className="flex flex-col min-w-0">
          <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100 truncate">
            {t.merchant || t.description || 'Unnamed'}
          </span>
          <span className="text-xs text-zinc-400 truncate">
            {t.category?.name ?? 'Uncategorized'}
            {t.description && t.merchant ? ` · ${t.description}` : ''}
          </span>
        </div>
        <span
          className={cn(
            'text-sm font-semibold tabular-nums ml-3 shrink-0',
            t.type === 'income' && 'text-emerald-600 dark:text-emerald-400',
            t.type === 'expense' && 'text-zinc-900 dark:text-zinc-100',
            t.type === 'savings' && 'text-blue-600 dark:text-blue-400'
          )}
        >
          {t.type === 'income' ? '+' : t.type === 'savings' ? '→' : '-'}
          {formatCurrency(t.amount)}
        </span>
      </div>
    </div>
  )
}

export function TransactionList({ transactions, onDelete, onEdit }: TransactionListProps) {
  const supabase = createClient()
  const [deleting, setDeleting] = useState(false)
  const [confirmTarget, setConfirmTarget] = useState<Transaction | null>(null)

  async function handleConfirmDelete() {
    if (!confirmTarget) return
    setDeleting(true)
    await supabase.from('transactions').delete().eq('id', confirmTarget.id)
    setDeleting(false)
    setConfirmTarget(null)
    onDelete()
  }

  if (!transactions.length) {
    return (
      <div className="text-center py-12 text-zinc-400 text-sm">
        No transactions yet
      </div>
    )
  }

  const grouped: Record<string, Transaction[]> = {}
  for (const t of transactions) {
    if (!grouped[t.date]) grouped[t.date] = []
    grouped[t.date].push(t)
  }

  return (
    <>
      <div className="flex flex-col gap-6">
        {Object.entries(grouped)
          .sort(([a], [b]) => b.localeCompare(a))
          .map(([date, txns]) => (
            <div key={date}>
              <p className="text-xs font-medium text-zinc-400 uppercase tracking-wide mb-2">
                {formatDate(date)}
              </p>
              <div className="flex flex-col divide-y divide-zinc-100 dark:divide-zinc-800 rounded-xl border border-zinc-100 dark:border-zinc-800 overflow-hidden">
                {txns.map(t => (
                  <SwipeableRow key={t.id} t={t} onDeleteRequest={setConfirmTarget} onEdit={onEdit} />
                ))}
              </div>
            </div>
          ))}
      </div>

      {/* Confirmation dialog */}
      {confirmTarget && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => setConfirmTarget(null)}
          />
          <div className="relative w-full sm:max-w-sm bg-white dark:bg-zinc-900 rounded-t-2xl sm:rounded-2xl shadow-xl z-10 p-6">
            <div className="flex items-center justify-center w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/30 mx-auto mb-4">
              <Trash2 size={20} className="text-red-500" />
            </div>
            <h2 className="text-center font-semibold text-zinc-900 dark:text-zinc-100 mb-1">
              Delete transaction?
            </h2>
            <p className="text-center text-sm text-zinc-500 dark:text-zinc-400 mb-6">
              {confirmTarget.merchant || confirmTarget.description || 'Unnamed'} &middot;{' '}
              {formatCurrency(confirmTarget.amount)}
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmTarget(null)}
                className="flex-1 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 text-sm font-medium text-zinc-700 dark:text-zinc-300"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDelete}
                disabled={deleting}
                className="flex-1 py-2.5 rounded-xl bg-red-500 text-sm font-medium text-white disabled:opacity-50"
              >
                {deleting ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
