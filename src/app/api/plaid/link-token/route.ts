import { NextRequest, NextResponse } from 'next/server'
import { CountryCode, Products } from 'plaid'
import { createClient } from '@/lib/supabase/server'
import { plaid, plaidErrorMessage } from '@/lib/plaid'

export async function POST(req: NextRequest) {
  const { data: { user } } = await (await createClient()).auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { kind } = await req.json().catch(() => ({}))
  // Plaid can only deliver webhooks to a public https URL, so local dev relies on manual/cron syncs
  const webhook = new URL('/api/plaid/webhook', req.url)

  try {
    const { data } = await plaid.linkTokenCreate({
      user: { client_user_id: user.id },
      client_name: 'but-jet',
      products: [kind === 'investments' ? Products.Investments : Products.Transactions],
      country_codes: [CountryCode.Us],
      language: 'en',
      ...(webhook.protocol === 'https:' && { webhook: webhook.toString() }),
    })
    return NextResponse.json({ link_token: data.link_token })
  } catch (e) {
    return NextResponse.json({ error: plaidErrorMessage(e) }, { status: 500 })
  }
}
