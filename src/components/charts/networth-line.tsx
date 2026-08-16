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
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f4f4f5" />
        <XAxis dataKey="date" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
        <YAxis tickFormatter={(v) => `$${v >= 1000 ? `${(v/1000).toFixed(0)}k` : v}`} tick={{ fontSize: 11 }} axisLine={false} tickLine={false} width={45} />
        <Tooltip
          formatter={(value) => formatCurrency(Number(value))}
          contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e4e4e7' }}
        />
        <Line type="monotone" dataKey="total" stroke="#18181b" strokeWidth={2} dot={false} name="Net Worth" />
      </LineChart>
    </ResponsiveContainer>
  )
}
