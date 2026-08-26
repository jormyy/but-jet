# Architecture

## Routes

Six tabs, each a real route:

| path | tab | reads |
| --- | --- | --- |
| `/` | Home | `bills`, `categories`, `txns/<month>`, `cashflow` |
| `/transactions` | Transactions | `txns/<month>`, `categories` |
| `/bills` | Bills | `bills`, `categories` |
| `/investments` | Investments | `investments` |
| `/net-worth` | Net worth | `snapshots`, `snapshot-latest`, `investments` |
| `/goals` | Goals | `goals` |

`/login` is outside the group. `/~offline` is the fallback the service worker
serves for a document it has never cached.

Each `page.tsx` in `(app)` returns `null`. That is deliberate: the URL is real
and shareable, but `(app)/layout.tsx` decides what to render from the pathname
so that a tab stays mounted after its first visit and switching back to it costs
nothing. Rendering in the pages instead would unmount a tab on every switch and
throw away its local state (the month you were looking at, the range you picked).

## Where data comes from

Everything the browser reads goes through `src/lib/data.ts`, one exported
function per SWR key. Nothing else queries Supabase directly for reads; writes
happen in the component that owns the form, followed by a `mutate` of the keys
that changed.

| SWR key | fetcher | notes |
| --- | --- | --- |
| `bills` | `fetchBills` | recurring bills with their category joined |
| `categories` | `fetchCategories` | shared by home, bills, the transaction form and the category manager |
| `['txns', month]` | `fetchTransactions` | one month, newest first |
| `cashflow` | `fetchCashflow` | six months of `date, type, amount`, totalled per month in the browser |
| `goals` | `fetchGoals` | |
| `snapshots` | `fetchSnapshotSeries` | `date, total` only — what the chart plots |
| `snapshot-latest` | `fetchLatestSnapshot` | the one row whose assets and liabilities the user edits |
| `investments` | `fetchInvestments` | |

Two rules keep this honest:

- **One owner per data set.** Categories used to be fetched three ways — folded
  into the bills query and again by two components keeping their own copy — so
  renaming a category left the other views stale. Anything that needs categories
  reads the `categories` key.
- **Derive rather than refetch.** The home tab needs last month's totals to work
  out what is left to spend. `cashflow` already returns them, so the tab reads
  `cashflow[length - 2]` instead of fetching that month's transactions again.

## Client and server split

Almost everything is a client component. The server's jobs are:

- **`src/proxy.ts`** — verifies the session on every non-prefetch navigation and
  redirects. It skips prefetches on purpose: no route renders anything
  auth-sensitive server-side, so paying a proxy round trip to prefetch an empty
  shell is waste. Real navigations are not tagged as prefetches and are checked.
- **`/api/ticker`** — proxies Yahoo quotes so the client never talks to a third
  party directly, and holds each symbol's answer for a minute.
- **`/api/cron/*`** — the two scheduled jobs, authorised by `CRON_SECRET` and
  running with the secret key so they can act across users.

`src/lib/supabase/` has three clients, and the split matters:

| module | runs where | key | RLS |
| --- | --- | --- | --- |
| `client.ts` | browser | publishable | enforced |
| `middleware.ts` | proxy | publishable | enforced |
| `admin.ts` | route handlers only | secret | **bypassed** |

`admin.ts` must never be imported from a client component.

## Session handling

The proxy calls `getClaims()`, which verifies the token's signature. `getSession()`
only decodes the cookie, so anything able to set a cookie walks past the gate.
The project signs with ES256, so verification uses a cached JWKS rather than a
round trip to the auth server on every navigation.

Row level security is the real boundary: every table is filtered by
`(select auth.uid()) = user_id`. The proxy decides which pages render, not what
data is reachable.
