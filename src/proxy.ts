import { NextResponse, type NextRequest } from 'next/server'

// The Supabase session cookie (sb-<project>-auth-token, split into .0, .1, ... when large)
const SESSION_COOKIE = /^sb-.+-auth-token(\.\d+)?$/

// Routes signed-out visitors to /login and signed-in ones away from it. This only checks that a
// session cookie exists, with no network call: validating it here meant refreshing an expired token
// with Supabase before the page could load, which held up opening the app after an hour away. The
// pages are empty shells and every data request is checked by Supabase (RLS) or the API routes, and
// the app sends you to /login itself if the session turns out to be invalid (see (app)/layout.tsx).
export function proxy(request: NextRequest) {
  const hasSession = request.cookies.getAll().some(c => SESSION_COOKIE.test(c.name))
  const isAuthPage = request.nextUrl.pathname.startsWith('/login')

  if (hasSession === isAuthPage) {
    const url = request.nextUrl.clone()
    url.pathname = hasSession ? '/' : '/login'
    return NextResponse.redirect(url)
  }
  return NextResponse.next()
}

export const config = {
  matcher: [
    {
      source:
        '/((?!_next/static|_next/image|favicon.ico|icons|manifest.json|serwist|~offline|api/cron|api/plaid/webhook|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
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
