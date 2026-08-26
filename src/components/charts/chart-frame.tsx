// Every chart — loading, empty, or drawn — occupies exactly this height.
// Letting the empty and loading states collapse is what used to shove the rest
// of the dashboard down the page once the data arrived.
export const CHART_HEIGHT = 220

export function ChartFrame({ children }: { children?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-center text-center text-zinc-400 text-sm" style={{ height: CHART_HEIGHT }}>
      {children}
    </div>
  )
}

// Shared by every chart so a tooltip is readable in dark mode. The pie and bar
// charts used to hard-code a light border and inherit a light background.
export const TOOLTIP_STYLE = {
  fontSize: 12,
  borderRadius: 8,
  border: '1px solid var(--chart-tooltip-border)',
  background: 'var(--chart-tooltip-bg)',
  color: 'var(--chart-tooltip-text)',
} as const

export const TOOLTIP_LABEL_STYLE = { color: 'var(--chart-tooltip-text)' } as const

export const AXIS_TICK = { fontSize: 11, fill: 'var(--chart-tick)' } as const
