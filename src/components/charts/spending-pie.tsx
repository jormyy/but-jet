'use client'

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'
import { formatCurrency } from '@/lib/utils'

interface SpendingPieProps {
  data: { category: string; amount: number; color: string }[]
}

export function SpendingPie({ data }: SpendingPieProps) {
  if (!data.length) return <div className="text-center text-zinc-400 text-sm py-8">No data</div>

  return (
    <ResponsiveContainer width="100%" height={220}>
      <PieChart>
        <Pie
          data={data}
          dataKey="amount"
          nameKey="category"
          cx="50%"
          cy="50%"
          innerRadius={55}
          outerRadius={85}
          paddingAngle={2}
        >
          {data.map((entry, i) => (
            <Cell key={i} fill={entry.color} />
          ))}
        </Pie>
        <Tooltip
          formatter={(value) => formatCurrency(Number(value))}
          contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e4e4e7' }}
        />
      </PieChart>
    </ResponsiveContainer>
  )
}
