'use client'

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { formatCurrency } from '@/lib/utils'

interface CashflowBarProps {
  data: { month: string; income: number; expenses: number; savings: number }[]
}

const LEGEND_ORDER = ['Income', 'Expenses', 'Savings']

export function CashflowBar({ data }: CashflowBarProps) {
  if (!data.length) return <div className="text-center text-zinc-400 text-sm py-8">No data</div>

  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} barGap={2}>
        <XAxis dataKey="month" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
        <YAxis tickFormatter={(v) => `$${v >= 1000 ? `${(v/1000).toFixed(0)}k` : v}`} tick={{ fontSize: 11 }} axisLine={false} tickLine={false} width={40} />
        <Tooltip
          formatter={(value) => formatCurrency(Number(value))}
          contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e4e4e7' }}
        />
        <Legend
          wrapperStyle={{ fontSize: 11 }}
          itemSorter={(item) => LEGEND_ORDER.indexOf(String(item.value))}
        />
        <Bar dataKey="income" fill="#22c55e" name="Income" radius={[3, 3, 0, 0]} />
        <Bar dataKey="expenses" fill="#f97316" name="Expenses" radius={[3, 3, 0, 0]} />
        <Bar dataKey="savings" fill="#3b82f6" name="Savings" radius={[3, 3, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}
