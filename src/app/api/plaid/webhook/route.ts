import { after, NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { syncUser, verifyPlaidWebhook } from '@/lib/plaid'

// Plaid calls this when it has new data for a linked account, so syncs happen as soon as data is
// available instead of waiting for the daily cron. Responds right away; the sync runs afterwards.
export async function POST(req: NextRequest) {
  const body = await req.text()
  if (!(await verifyPlaidWebhook(body, req.headers.get('plaid-verification')))) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  const { webhook_type, webhook_code, item_id, error } = JSON.parse(body)
  const supabase = createAdminClient()
  const { data: item } = await supabase
    .from('plaid_items')
    .select('id, user_id')
    .eq('item_id', item_id)
    .maybeSingle()
  if (!item) return NextResponse.json({ ok: true })

  const hasNewData =
    (webhook_type === 'TRANSACTIONS' && webhook_code === 'SYNC_UPDATES_AVAILABLE') ||
    (webhook_type === 'HOLDINGS' && webhook_code === 'DEFAULT_UPDATE')

  if (hasNewData) {
    after(async () => {
      try {
        await syncUser(supabase, item.user_id)
      } catch (e) {
        console.error(`Webhook sync failed for item ${item.id}:`, e)
      }
    })
  } else if (webhook_type === 'ITEM' && ['ERROR', 'PENDING_EXPIRATION', 'PENDING_DISCONNECT'].includes(webhook_code)) {
    const message = error?.error_code
      ? `${error.error_code}: ${error.error_message}`
      : 'This connection is about to expire. Unlink it and link it again to keep syncing.'
    await supabase.from('plaid_items').update({ error: message }).eq('id', item.id)
  }

  return NextResponse.json({ ok: true })
}
