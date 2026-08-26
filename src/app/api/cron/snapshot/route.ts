import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(req: NextRequest) {
  const auth = req.headers.get('authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Snapshot dates are the user's day, not UTC's.
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Los_Angeles' }).format(new Date())

  // One statement for every user. Walking them individually cost four sequential
  // round trips each, which is the whole job's runtime once there is more than a
  // handful of accounts.
  const { data, error } = await createAdminClient().rpc('create_daily_snapshots', { target_date: today })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const [row] = data ?? []
  return NextResponse.json({ date: today, inserted: row?.inserted ?? 0, candidates: row?.candidates ?? 0 })
}
