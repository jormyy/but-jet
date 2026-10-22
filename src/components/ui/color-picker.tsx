import { CATEGORY_COLORS } from '@/lib/colors'

interface ColorPickerProps {
  value: string
  onChange: (color: string) => void
}

// Swatch picker for category colors
export function ColorPicker({ value, onChange }: ColorPickerProps) {
  return (
    <div>
      <label className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">Color</label>
      <div className="flex flex-wrap gap-2 mt-1.5">
        {CATEGORY_COLORS.map(c => (
          <button
            key={c}
            type="button"
            onClick={() => onChange(c)}
            className="w-6 h-6 rounded-full transition-transform hover:scale-110"
            style={{
              background: c,
              outline: value === c ? `2px solid ${c}` : 'none',
              outlineOffset: 2,
            }}
          />
        ))}
      </div>
    </div>
  )
}
