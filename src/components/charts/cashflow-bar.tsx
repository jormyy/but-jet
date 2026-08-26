'use client'

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { formatCurrency } from '@/lib/utils'
import { AXIS_TICK, CHART_HEIGHT, ChartFrame, TOOLTIP_LABEL_STYLE, TOOLTIP_STYLE } from './chart-frame'

interface CashflowBarProps {
  data: { month: string; income: number; expenses: number; savings: number }[]
}

export function CashflowBar({ data }: CashflowBarProps) {
  if (!data.length) return <ChartFrame>No data</ChartFrame>

  return (
    <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
      <BarChart data={data} barGap={2}>
        <XAxis dataKey="month" tick={AXIS_TICK} axisLine={false} tickLine={false} />
        <YAxis tickFormatter={(v) => `$${v >= 1000 ? `${(v/1000).toFixed(0)}k` : v}`} tick={AXIS_TICK} axisLine={false} tickLine={false} width={40} />
        <Tooltip
          formatter={(value) => formatCurrency(Number(value))}
          contentStyle={TOOLTIP_STYLE}
          labelStyle={TOOLTIP_LABEL_STYLE}
        />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        <Bar dataKey="income" fill="#22c55e" name="Income" radius={[3, 3, 0, 0]} />
        <Bar dataKey="expenses" fill="#f97316" name="Expenses" radius={[3, 3, 0, 0]} />
        <Bar dataKey="savings" fill="#3b82f6" name="Savings" radius={[3, 3, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}
