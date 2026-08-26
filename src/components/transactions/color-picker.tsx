'use client'

import { CATEGORY_COLORS } from '@/lib/colors'

interface ColorPickerProps {
  value: string
  onChange: (color: string) => void
}

export function ColorPicker({ value, onChange }: ColorPickerProps) {
  return (
    <div>
      <label className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">Color</label>
      <div className="flex flex-wrap gap-2 mt-1.5">
        {CATEGORY_COLORS.map(color => (
          <button
            key={color}
            type="button"
            onClick={() => onChange(color)}
            aria-label={`Colour ${color}`}
            aria-pressed={value === color}
            className="w-8 h-8 rounded-full transition-transform hover:scale-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-500"
            style={{
              background: color,
              outline: value === color ? `2px solid ${color}` : 'none',
              outlineOffset: 2,
            }}
          />
        ))}
      </div>
    </div>
  )
}
