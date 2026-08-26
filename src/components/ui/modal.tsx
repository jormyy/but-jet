'use client'

import { X } from 'lucide-react'
import { ReactNode, useId, useRef } from 'react'
import { useModalBehaviour } from '@/hooks/use-modal-behaviour'

interface ModalProps {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
}

export function Modal({ open, onClose, title, children }: ModalProps) {
  const panel = useRef<HTMLDivElement>(null)
  const titleId = useId()
  useModalBehaviour({ open, onClose, panelRef: panel })

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        // dvh, not vh: iOS measures vh against the largest viewport, so a sheet
        // sized in vh runs under the browser chrome and the keyboard.
        className="relative w-full sm:max-w-md bg-white dark:bg-zinc-900 rounded-t-2xl sm:rounded-2xl shadow-xl z-10 max-h-[90dvh] overflow-y-auto"
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-100 dark:border-zinc-800">
          <h2 id={titleId} className="font-semibold text-zinc-900 dark:text-zinc-100">{title}</h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="-m-2 p-2 rounded-lg text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          >
            <X size={18} />
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  )
}
