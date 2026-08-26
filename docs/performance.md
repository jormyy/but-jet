# Performance

## How to measure

Numbers in this repo come from a production build served locally, against a
local Supabase seeded with two years of data, in Chromium at 390x844 emulating
regular 4G (40 ms RTT, 9 Mbps down) with a 4x CPU slowdown. Localhost with no
throttling hides exactly the costs that matter to a phone: a saved round trip
looks free, and a larger bundle looks harmless.

```bash
npm run build && npm start
```

Two distinctions worth keeping:

- **Cold versus warm.** A cold launch has no service worker, no HTTP cache and
  no persisted SWR cache. A warm launch has all three. Measuring a "cold" launch
  from a context carrying `localStorage` measures a warm one.
- **Wire bytes versus decoded bytes.** `fetch` transparently decompresses, so a
  script that reads the body reports the uncompressed size as if it crossed the
  network. Read `content-length` off a raw request instead.

## What to watch

**Time to figures** — when the dashboard shows a real number — tracks the
experience better than LCP does here. The page has no hero image, so the largest
contentful element is whichever small heading happens to win, and it moves
between builds for reasons no user would notice.

**Request count on launch.** Every round trip is ~80 ms on 4G. The two biggest
wins in this codebase were both request-count wins, not byte wins.

**Requests per app foreground.** A PWA is backgrounded and restored constantly.
Anything hung off `visibilitychange` runs far more often than it looks.

## Where the costs are

- **Recharts** is by far the largest dependency and none of the figures above
  the charts need it. It loads on demand; keep it that way.
- **Layout shift comes from things that appear late.** Reserve their space: a
  chart is the same height whether loading, empty or drawn, and the spending
  card renders while its data is still coming.
- **The persisted cache is on the critical path of a warm launch.** Anything
  written to it is read, parsed and re-rendered on every launch, so a query that
  selects more than it draws costs on every open, not just once.

## Results

Against the same build and fixtures, before and after this branch:

| | before | after |
| --- | --- | --- |
| initial JS, every app route | 372.7 KB | 263.0 KB |
| cold LCP | 820 ms | 208 ms |
| cold time-to-figures | 642 ms | 561 ms |
| cold CLS | 0.205 | 0.007 |
| warm FCP | 112 ms | 84 ms |
| warm LCP | 156 ms | 84 ms |
| Supabase requests on a home launch | 10 | 4 |
| data over the wire, all six tabs | 665 KB | 99 KB |
| persisted cache | 281 KB | 56 KB |
| requests per app foreground (investments) | ~15 | 0 |

Database query plans are in [database.md](database.md).

## Reproducing

The measurement scripts are not in the repository — they are throwaway harnesses
around Playwright, and keeping them would mean maintaining a second test suite
that nothing runs. What matters is the method above; rebuild the harness when
you need it.
