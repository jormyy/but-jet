import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(req: NextRequest) {
  const auth = req.headers.get('authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createAdminClient()
  const { data: usersData, error: usersError } = await supabase.auth.admin.listUsers({ perPage: 1000 })
  if (usersError) return NextResponse.json({ error: usersError.message }, { status: 500 })

  const today = new Date().toISOString().slice(0, 10)
  let inserted = 0
  let skipped = 0

  for (const user of usersData.users) {
    const { data: existing } = await supabase
      .from('net_worth_snapshots')
      .select('id')
      .eq('user_id', user.id)
      .eq('date', today)
      .maybeSingle()

    if (existing) {
      skipped++
      continue
    }

    const { data: latest } = await supabase
      .from('net_worth_snapshots')
      .select('assets, liabilities')
      .eq('user_id', user.id)
      .order('date', { ascending: false })
      .limit(1)
      .maybeSingle()

    const { data: holdings } = await supabase
      .from('investment_holdings')
      .select('current_value')
      .eq('user_id', user.id)

    const portfolioTotal = (holdings ?? []).reduce((s, h) => s + h.current_value, 0)

    const assets: Record<string, number> = { ...(latest?.assets ?? {}) }
    if (portfolioTotal > 0) {
      assets['Investments'] = portfolioTotal
    } else {
      delete assets['Investments']
    }
    const liabilities: Record<string, number> = latest?.liabilities ?? {}

    if (Object.keys(assets).length === 0 && Object.keys(liabilities).length === 0) {
      skipped++
      continue
    }

    const total = Object.values(assets).reduce((s, v) => s + v, 0) -
      Object.values(liabilities).reduce((s, v) => s + v, 0)

    const { error: insertError } = await supabase.from('net_worth_snapshots').insert({
      user_id: user.id,
      date: today,
      assets,
      liabilities,
      total,
    })

    if (insertError) {
      console.error(`Snapshot insert failed for user ${user.id}:`, insertError.message)
      continue
    }
    inserted++
  }

  return NextResponse.json({ inserted, skipped, total: usersData.users.length })
}
