import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { displayName } from '@/lib/plaid'

// Lists linked banks without exposing access tokens
export async function GET() {
  const { data: { user } } = await (await createClient()).auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await createAdminClient()
    .from('plaid_items')
    .select('id, kind, institution_name, last_synced_at, error, accounts:plaid_accounts(id, account_id, name, mask, display_name, type, subtype, current_balance)')
    .eq('user_id', user.id)
    .order('created_at')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data.map(item => ({
    ...item,
    accounts: item.accounts.map(({ name, mask, display_name, ...a }) => ({ ...a, label: displayName({ name, mask, display_name }) })),
  })))
}
