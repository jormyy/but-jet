import { type NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'

export async function proxy(request: NextRequest) {
  return await updateSession(request)
}

export const config = {
  matcher: [
    {
      source:
        '/((?!_next/static|_next/image|favicon.ico|icons|manifest.json|serwist|~offline|api/cron|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
      // Nav prefetches every tab link on mount; none of our routes render
      // anything auth-sensitive server-side (page.tsx are empty shells —
      // real data fetching happens client-side under Supabase's own
      // session check), so there's no need to pay a proxy round trip for
      // prefetch requests. Real navigations aren't tagged with these
      // headers and still go through the session check below.
      missing: [
        { type: 'header', key: 'next-router-prefetch' },
        { type: 'header', key: 'purpose', value: 'prefetch' },
      ],
    },
  ],
}
