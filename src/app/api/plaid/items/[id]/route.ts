import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { applyBalancesToSnapshot, displayName, plaid, plaidErrorMessage } from '@/lib/plaid'

// Unlinks a bank. Already-imported transactions are kept; its balances are dropped from today's net worth.
export async function DELETE(_req: Request, ctx: RouteContext<'/api/plaid/items/[id]'>) {
  const { data: { user } } = await (await createClient()).auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await ctx.params
  const supabase = createAdminClient()
  const { data: item } = await supabase
    .from('plaid_items')
    .select('access_token, accounts:plaid_accounts(name, mask, display_name)')
    .eq('id', id)
    .eq('user_id', user.id)
    .maybeSingle()
  if (!item) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  try {
    await plaid.itemRemove({ access_token: item.access_token })
  } catch (e) {
    // Still unlink locally if Plaid already considers the item gone
    console.error('Plaid itemRemove failed:', plaidErrorMessage(e))
  }

  const { error } = await supabase.from('plaid_items').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await applyBalancesToSnapshot(supabase, user.id, item.accounts.map(displayName))
  return NextResponse.json({ ok: true })
}
