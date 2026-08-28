'use client'

import { Trash2 } from 'lucide-react'

interface ConfirmDeleteDialogProps {
  open: boolean
  title: string
  description: string
  loading: boolean
  onCancel: () => void
  onConfirm: () => void
}

export function ConfirmDeleteDialog({ open, title, description, loading, onCancel, onConfirm }: ConfirmDeleteDialogProps) {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative w-full sm:max-w-sm bg-white dark:bg-zinc-900 rounded-t-2xl sm:rounded-2xl shadow-xl z-10 p-6">
        <div className="flex items-center justify-center w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/30 mx-auto mb-4">
          <Trash2 size={20} className="text-red-500" />
        </div>
        <h2 className="text-center font-semibold text-zinc-900 dark:text-zinc-100 mb-1">{title}</h2>
        <p className="text-center text-sm text-zinc-500 dark:text-zinc-400 mb-6">{description}</p>
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 text-sm font-medium text-zinc-700 dark:text-zinc-300"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className="flex-1 py-2.5 rounded-xl bg-red-500 text-sm font-medium text-white disabled:opacity-50"
          >
            {loading ? 'Deleting…' : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  )
}
