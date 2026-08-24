'use client'

import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import { formatCurrency } from '@/lib/utils'

interface NetWorthLineProps {
  data: { date: string; total: number }[]
}

export function NetWorthLine({ data }: NetWorthLineProps) {
  if (!data.length) return <div className="text-center text-zinc-400 text-sm py-8">No snapshots yet</div>

  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" vertical={false} />
        <XAxis
          dataKey="date"
          tick={{ fontSize: 11, fill: 'var(--chart-tick)' }}
          axisLine={false}
          tickLine={false}
          minTickGap={24}
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
