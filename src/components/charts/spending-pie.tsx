'use client'

import { useState } from 'react'
import { PieChart, Pie, Cell, Sector, Tooltip, ResponsiveContainer } from 'recharts'
import type { PieSectorShapeProps } from 'recharts'
import { formatCurrency } from '@/lib/utils'

interface SpendingPieProps {
  data: { category: string; amount: number; color: string }[]
}

const POP_OUT_GROWTH = 6

export function SpendingPie({ data }: SpendingPieProps) {
  const [activeIndex, setActiveIndex] = useState<number | undefined>(undefined)

  if (!data.length) return <div className="text-center text-zinc-400 text-sm py-8">No data</div>

  const total = data.reduce((sum, d) => sum + d.amount, 0)

  function renderShape(props: PieSectorShapeProps) {
    const { cx, cy, innerRadius, outerRadius = 0, startAngle, endAngle, fill, index } = props
    return (
      <Sector
        cx={cx}
        cy={cy}
        innerRadius={innerRadius}
        outerRadius={index === activeIndex ? outerRadius + POP_OUT_GROWTH : outerRadius}
        startAngle={startAngle}
        endAngle={endAngle}
        fill={fill}
      />
    )
  }

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
          isAnimationActive={false}
          shape={renderShape}
          onClick={(_, index) => setActiveIndex(activeIndex === index ? undefined : index)}
        >
          {data.map((entry, i) => (
            <Cell key={i} fill={entry.color} className="cursor-pointer" />
          ))}
        </Pie>
        <Tooltip
          formatter={(value) => [
            `${formatCurrency(Number(value))} (${((Number(value) / total) * 100).toFixed(0)}%)`,
          ]}
          contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e4e4e7' }}
        />
      </PieChart>
    </ResponsiveContainer>
  )
}
