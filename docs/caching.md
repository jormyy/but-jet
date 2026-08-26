# Caching

Five layers hold a copy of something. Each has one owner and one rule for going
stale.

| layer | holds | lives until | owner |
| --- | --- | --- | --- |
| SWR in-memory cache | fetched rows, keyed as in [architecture.md](architecture.md) | page unload | `SWRProvider` |
| `localStorage` | the same rows, per user | sign-out, or the 512 KB budget | `src/lib/swr-cache.ts` |
| Service worker precache | build assets and `/~offline` | the next build's worker activates | Serwist |
| Service worker runtime cache | pages and static assets as visited | Serwist's `defaultCache` policies | Serwist |
| `/api/ticker` in-process map | one quote per symbol | 60 seconds | the route handler |

## The persisted cache

A PWA is closed by swiping it away or switching apps far more often than by a
page unload, and neither fires `beforeunload` on iOS or Android. The cache is
written on `visibilitychange` to hidden and on `pagehide`, which fire as soon as
the app is backgrounded.

Three rules it must keep:

- **Scoped to the user.** The key is `but-jet-swr-cache:<user id>`, and signing
  out clears every one of them. A single shared key meant the next account to
  sign in on the device rendered the previous account's income, spending and
  balances until its own data arrived.
- **No failures.** Only entries with data are written. A cached rejection would
  render as a failed load on a launch that has not tried the network yet.
- **Bounded.** Entries are written until 512 KB, then dropped. `localStorage` is
  a few megabytes for the whole origin and is shared with the auth session.

On launch the cache is restored through `mutate(key, data, { revalidate: false })`
after mount, not by handing SWR a pre-filled provider. Swapping the provider
means remounting `SWRConfig`, which discards every in-flight request and
refetches the lot — that is why the app used to issue each query twice on every
launch.

## Freshness

Restored figures are shown immediately and revalidated in the background. That
is safe for a list and dangerous for a balance, so the app records when its data
was last confirmed against the server and the offline banner names that time:
*"Offline — showing data from Aug 25, 3:42 PM"*. A number with no such marker is
one the app has confirmed this session.

## Invalidation

Writes invalidate by hand — there is no automatic dependency graph, so a new
write path has to say what it changed.

| after | invalidate |
| --- | --- |
| add / edit / delete a transaction | `['txns', month]`, `cashflow`, `snapshots`, `snapshot-latest` |
| add / delete a bill | `bills` |
| create / edit / delete a category | `categories` |
| add / edit / delete a goal | `goals` |
| add / edit / delete an investment | `investments` |
| reprice investments | `investments`, `snapshots` |
| edit a net worth entry | `snapshots`, `snapshot-latest` |

A transaction touches the snapshots because `adjustAccountBalance` folds its
amount into the day's balance. Repricing touches the snapshots because the net
worth card reads the live portfolio total.

## What is not cached

Auth state. The Supabase client owns the session cookie and its refresh; nothing
here copies it.
