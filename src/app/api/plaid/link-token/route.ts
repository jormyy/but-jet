import { NextResponse } from 'next/server'
import { CountryCode, Products } from 'plaid'
import { createClient } from '@/lib/supabase/server'
import { plaid, plaidErrorMessage } from '@/lib/plaid'

export async function POST() {
  const { data: { user } } = await (await createClient()).auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { data } = await plaid.linkTokenCreate({
      user: { client_user_id: user.id },
      client_name: 'but-jet',
      products: [Products.Transactions],
      country_codes: [CountryCode.Us],
      language: 'en',
    })
    return NextResponse.json({ link_token: data.link_token })
  } catch (e) {
    return NextResponse.json({ error: plaidErrorMessage(e) }, { status: 500 })
  }
}
