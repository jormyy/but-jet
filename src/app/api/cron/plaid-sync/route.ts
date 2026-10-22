import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { syncUser } from '@/lib/plaid'

export async function GET(req: NextRequest) {
  const auth = req.headers.get('authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createAdminClient()
  const { data: items, error } = await supabase.from('plaid_items').select('user_id')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const userIds = [...new Set((items ?? []).map(i => i.user_id))]
  let synced = 0
  const errors: string[] = []
  for (const userId of userIds) {
    try {
      const result = await syncUser(supabase, userId)
      synced += result.synced
      errors.push(...result.errors)
    } catch (e) {
      errors.push(e instanceof Error ? e.message : String(e))
    }
  }

  return NextResponse.json({ users: userIds.length, synced, errors })
}
