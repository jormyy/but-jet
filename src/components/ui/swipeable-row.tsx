'use client'

import { useState, useRef, useCallback } from 'react'
import { Trash2, Pencil } from 'lucide-react'
import { cn } from '@/lib/utils'

const DELETE_WIDTH = 72
const EDIT_WIDTH = 72
const SWIPE_THRESHOLD = 30

interface SwipeableRowProps {
  onEdit: () => void
  onDelete: () => void
  children: React.ReactNode
}

export function SwipeableRow({ onEdit, onDelete, children }: SwipeableRowProps) {
  const [offset, setOffset] = useState(0)
  const [dragging, setDragging] = useState(false)
  const startXRef = useRef(0)
  const baseOffsetRef = useRef(0)

  const close = useCallback(() => setOffset(0), [])

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
        onEdit()
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
    <div className="relative overflow-hidden group">
      {/* Edit action revealed on swipe right */}
      <div
        className="absolute left-0 top-0 bottom-0 flex items-center justify-center bg-blue-500"
        style={{ width: EDIT_WIDTH }}
      >
        <button
          className="flex flex-col items-center gap-0.5 text-white px-4 h-full w-full justify-center"
          onClick={() => { close(); onEdit() }}
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
          onClick={() => { close(); onDelete() }}
        >
          <Trash2 size={18} />
          <span className="text-xs font-medium">Delete</span>
        </button>
      </div>

      <div
        className={cn('relative', !dragging && 'transition-transform duration-200 ease-out')}
        style={{ transform: `translateX(${-offset}px)` }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {children}

        {/* Mouse-friendly fallback: touch devices don't fire hover, so this never appears there.
            Overlaid (not reserved space) so the row content keeps hugging the right edge at rest;
            the gradient fades the buttons in over the content instead of shifting layout. */}
        <div className="hidden sm:flex absolute right-0 top-0 bottom-0 items-center gap-1 pl-8 pr-3 opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto transition-opacity bg-gradient-to-l from-white dark:from-zinc-900 from-70% to-transparent">
          <button
            onClick={e => { e.stopPropagation(); onEdit() }}
            className="p-1.5 rounded-md text-zinc-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-500/10"
            aria-label="Edit"
          >
            <Pencil size={14} />
          </button>
          <button
            onClick={e => { e.stopPropagation(); onDelete() }}
            className="p-1.5 rounded-md text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10"
            aria-label="Delete"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>
    </div>
  )
}
