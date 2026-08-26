'use client'

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'
import { formatCurrency } from '@/lib/utils'
import { CHART_HEIGHT, ChartFrame, TOOLTIP_LABEL_STYLE, TOOLTIP_STYLE } from './chart-frame'

interface SpendingPieProps {
  data: { category: string; amount: number; color: string }[]
}

export function SpendingPie({ data }: SpendingPieProps) {
  if (!data.length) return <ChartFrame>No data</ChartFrame>

  return (
    <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
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
          contentStyle={TOOLTIP_STYLE}
          labelStyle={TOOLTIP_LABEL_STYLE}
        />
      </PieChart>
    </ResponsiveContainer>
  )
}
