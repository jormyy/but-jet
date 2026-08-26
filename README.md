# But Jet

A personal budget tracker: transactions, recurring bills, savings goals, net
worth history and investment holdings, built to be installed to a phone's home
screen and opened several times a day.

Next.js 16 (App Router, Turbopack) · React 19 · Supabase (Postgres + Auth) ·
SWR · Serwist · Recharts · Tailwind CSS v4.

## Getting started

```bash
npm ci
npm run dev          # http://localhost:3000
```

The app needs a Supabase project. Point it at one with a `.env.local`:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
```

Two more are needed only by the scheduled jobs, and only on the server:

```bash
SUPABASE_SECRET_KEY=sb_secret_...   # bypasses RLS; never expose to the client
CRON_SECRET=...                     # shared with the cron caller's Bearer token
```

### Running Supabase locally

```bash
supabase start                       # Postgres on 54322, API on 54321
supabase db reset                    # replays supabase/migrations from scratch
```

`supabase start` prints a local URL and publishable key — put those in
`.env.local` to develop against the local stack. The migrations are
self-contained: a fresh database gets the schema, the row level security
policies, the table grants and the indexes.

## Scripts

| command | what it does |
| --- | --- |
| `npm run dev` | development server |
| `npm run build` | production build |
| `npm run start` | serve the production build |
| `npm run lint` | ESLint |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | unit and component tests (Vitest) |
| `npm run test:coverage` | the same with a coverage summary |

## How it fits together

- **`src/app/(app)/layout.tsx`** owns the six tabs. It keeps a tab mounted once
  visited, so switching back is instant, and only mounts one the first time it
  is opened.
- **`src/app/(app)/*/page.tsx`** are deliberately empty. The route exists so the
  URL is real and shareable; the layout decides what to render from the path.
- **`src/lib/data.ts`** is the only place that reads from Supabase in the
  browser. Each function maps to one SWR key.
- **`src/proxy.ts`** gates every non-prefetch navigation on a verified session.

Details worth reading before changing behaviour:

- [`docs/architecture.md`](docs/architecture.md) — routes, state ownership,
  where each piece of data comes from.
- [`docs/caching.md`](docs/caching.md) — every cache layer, who owns it, and
  when each is invalidated.
- [`docs/pwa.md`](docs/pwa.md) — service worker lifecycle, how a new version is
  adopted, offline behaviour, and the iOS specifics.
- [`docs/database.md`](docs/database.md) — schema, policies, indexes, and the
  migration rules.
- [`docs/performance.md`](docs/performance.md) — how the numbers in this repo
  were measured and how to reproduce them.

## Deployment

Vercel. `vercel.json` registers two daily cron jobs:

| path | schedule | what it does |
| --- | --- | --- |
| `/api/cron/snapshot` | `0 9 * * *` | writes each user's daily net worth snapshot |
| `/api/cron/refresh-prices` | `0 21 * * *` | reprices ticker-backed holdings |

Both require `Authorization: Bearer $CRON_SECRET`.

Set `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`,
`SUPABASE_SECRET_KEY` and `CRON_SECRET` in the project's environment.

Migrations are not applied automatically. Run them against the hosted project
deliberately, and read [`docs/database.md`](docs/database.md) first — the index
migration should be applied with `CREATE INDEX CONCURRENTLY` on a live database.

## Troubleshooting

**`next build` fails with "Failed to fetch Geist from Google Fonts".**
`next/font/google` downloads the font at build time. Retry, or set
`HTTPS_PROXY` if the network needs one.

**Signing in returns "Database error querying schema".** The local Auth
container found `NULL` in a token column of `auth.users` — this happens when
rows were inserted by hand rather than through the Auth API. Set the token
columns to `''` rather than leaving them null.

**Every query returns "permission denied for table ...".** The database is
missing the grants in `007_table_grants.sql`. Run `supabase db reset`.

**A code change is not showing up in the installed app.** The service worker
serves the previous version until it is replaced. It picks up a new build the
next time the app is brought to the foreground, then reloads once. To force it,
close every tab on the origin and reopen.

**Prices are not refreshing.** The investments tab throttles repricing to once
every five minutes; the Refresh button ignores the throttle. `/api/ticker`
depends on Yahoo's undocumented chart endpoint, which sometimes returns nothing
for a valid symbol — those come back in `missing`.
