'use client'

import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts'

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
      </PieChart>
    </ResponsiveContainer>
  )
}
