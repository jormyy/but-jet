'use client'

import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import { formatCurrency } from '@/lib/utils'

interface NetWorthLineProps {
  data: { date: string; total: number }[]
  sparseTicks?: boolean
}

interface EdgeAwareTickProps {
  x?: number
  y?: number
  index?: number
  visibleTicksCount?: number
  payload?: { value: string }
}

function EdgeAwareTick({ x, y, index, visibleTicksCount, payload }: EdgeAwareTickProps) {
  const anchor = index === 0 ? 'start' : index === (visibleTicksCount ?? 1) - 1 ? 'end' : 'middle'
  return (
    <text x={x} y={(y ?? 0) + 12} textAnchor={anchor} fontSize={11} fill="var(--chart-tick)">
      {payload?.value}
    </text>
  )
}

export function NetWorthLine({ data, sparseTicks }: NetWorthLineProps) {
  if (!data.length) return <div className="text-center text-zinc-400 text-sm py-8">No snapshots yet</div>

  const ticks = sparseTicks && data.length > 2
    ? [data[0].date, data[Math.floor((data.length - 1) / 2)].date, data[data.length - 1].date]
    : undefined

  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" vertical={false} />
        <XAxis
          dataKey="date"
          tick={<EdgeAwareTick />}
          axisLine={false}
          tickLine={false}
          minTickGap={24}
          {...(ticks ? { ticks, interval: 0 } : {})}
        />
        <YAxis
          tickFormatter={(v) => `$${v >= 1000 ? `${(v/1000).toFixed(0)}k` : v}`}
          tick={{ fontSize: 11, fill: 'var(--chart-tick)' }}
          axisLine={false}
          tickLine={false}
          width={45}
        />
        <Tooltip
          formatter={(value) => formatCurrency(Number(value))}
          contentStyle={{
            fontSize: 12,
            borderRadius: 8,
            border: '1px solid var(--chart-tooltip-border)',
            background: 'var(--chart-tooltip-bg)',
            color: 'var(--chart-tooltip-text)',
          }}
          labelStyle={{ color: 'var(--chart-tooltip-text)' }}
        />
        <Line
          type="monotone"
          dataKey="total"
          stroke="var(--chart-line)"
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 4 }}
          name="Net Worth"
        />
      </LineChart>
    </ResponsiveContainer>
  )
}
