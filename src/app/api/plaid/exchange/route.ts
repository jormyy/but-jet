import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { plaid, plaidErrorMessage, syncUser } from '@/lib/plaid'

export async function POST(req: NextRequest) {
  const { data: { user } } = await (await createClient()).auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { public_token, institution_name, kind } = await req.json()
  if (typeof public_token !== 'string') return NextResponse.json({ error: 'Missing public_token' }, { status: 400 })

  try {
    const { data } = await plaid.itemPublicTokenExchange({ public_token })
    const supabase = createAdminClient()
    const { error } = await supabase.from('plaid_items').insert({
      user_id: user.id,
      item_id: data.item_id,
      access_token: data.access_token,
      institution_name: typeof institution_name === 'string' ? institution_name : null,
      kind: kind === 'investments' ? 'investments' : 'bank',
    })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // Pulls accounts/balances right away; transactions may take a few minutes to be ready at Plaid
    return NextResponse.json(await syncUser(supabase, user.id))
  } catch (e) {
    return NextResponse.json({ error: plaidErrorMessage(e) }, { status: 500 })
  }
}
