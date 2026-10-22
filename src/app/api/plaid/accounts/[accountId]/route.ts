import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { displayName } from '@/lib/plaid'

// Renames a linked account everywhere it appears (net worth entry or investment holding) while keeping
// it linked: the sync finds accounts by Plaid's account ID and writes them under this display name.
export async function PATCH(req: NextRequest, ctx: RouteContext<'/api/plaid/accounts/[accountId]'>) {
  const { data: { user } } = await (await createClient()).auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { accountId } = await ctx.params
  const { name } = await req.json().catch(() => ({}))
  const newName = typeof name === 'string' ? name.trim() : ''
  if (!newName || newName.length > 80) return NextResponse.json({ error: 'Enter a name (up to 80 characters)' }, { status: 400 })

  const supabase = createAdminClient()
  const { data: account } = await supabase
    .from('plaid_accounts')
    .select('name, mask, display_name, type')
    .eq('account_id', accountId)
    .eq('user_id', user.id)
    .maybeSingle()
  if (!account) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const oldName = displayName(account)
  if (newName === oldName) return NextResponse.json({ ok: true })

  if (account.type === 'investment' || account.type === 'brokerage') {
    const { error } = await supabase.from('investment_holdings').update({ name: newName }).eq('plaid_account_id', accountId)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  } else {
    const { data: latest } = await supabase
      .from('net_worth_snapshots')
      .select('id, assets, liabilities')
      .eq('user_id', user.id)
      .order('date', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (latest) {
      // Two entries with one name would merge into a single balance
      if (newName === 'Investments' || newName in latest.assets || newName in latest.liabilities) {
        return NextResponse.json({ error: `"${newName}" is already used by another entry` }, { status: 409 })
      }
      // Rename in place so the entry keeps its position in the list
      const rename = (map: Record<string, number>) =>
        Object.fromEntries(Object.entries(map).map(([k, v]) => [k === oldName ? newName : k, v]))
      const { error } = await supabase.from('net_worth_snapshots')
        .update({ assets: rename(latest.assets), liabilities: rename(latest.liabilities) })
        .eq('id', latest.id)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    }
  }

  const { error } = await supabase.from('plaid_accounts').update({ display_name: newName }).eq('account_id', accountId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
