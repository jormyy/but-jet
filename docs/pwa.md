# PWA and iOS

## Install

`public/manifest.json` declares the name, standalone display, theme colours and
three icons — 192 and 512 for `any`, plus a 512 `maskable` with the mark inside
the 80% safe zone platforms crop to. `src/app/apple-icon.png` is what iOS uses
for Add to Home Screen; Next emits the `<link>` for it from the file name.

An icon the manifest names but does not ship is worse than none: the install
prompt never appears, and iOS falls back to a screenshot of the page.

## Service worker

`src/app/sw.ts` configures Serwist. Two settings decide how an update lands:

```ts
skipWaiting: false   // a new worker waits; it does not seize a running page
clientsClaim: true   // but a first install controls the page right away
```

`skipWaiting: true` swaps the precache under a page whose JavaScript is already
running. The charts load lazily, so that page's next chunk request would 404.
Waiting avoids it, and `clientsClaim` only takes effect on a first activation,
where there is no old page to strand — so the very first launch is still
offline-capable.

## How a new version is adopted

`src/components/service-worker-updater.tsx` owns this:

1. Registration is deferred to idle, so it does not compete with the launch.
2. It registers with `updateViaCache: 'none'` — the worker is served by a route
   handler whose response is HTTP-cacheable, and the default would let the
   browser check for a new version against its own copy of the old one.
3. When the app is brought to the foreground it calls `update()`.
4. If a worker is waiting, it is sent `SKIP_WAITING` and the page reloads on
   `controllerchange`.

Foreground is the least disruptive moment: it is when a user expects a launch,
and nothing is half-typed.

Registration is handled here rather than by `SerwistProvider`, which calls
`register()` without catching. Safari in private browsing has no service worker
at all, and that rejection surfaced as an unhandled rejection on every load.

## Offline

Serwist's `defaultCache` serves pages network-first and static assets
cache-first. A document that has never been visited falls back to `/~offline`.

Data is separate: the persisted SWR cache (see [caching.md](caching.md)) is what
puts figures on screen offline. The offline banner names the time they came from.

## iOS specifics

- `viewport-fit=cover` plus `apple-mobile-web-app-status-bar-style:
  black-translucent` let the app paint under the status bar. `body` then pads by
  `env(safe-area-inset-top/left/right)` and the tab bar sits at
  `calc(1.5rem + env(safe-area-inset-bottom))`, clear of the home indicator.
  Without `viewport-fit=cover` those insets are always zero.
- No `maximum-scale`. Capping it blocks pinch-zoom, which WCAG 1.4.4 requires
  and which is how a dense figure gets read on a small screen.
- `theme-color` is declared twice, for light and dark, so the standalone status
  bar matches the app instead of staying white above a near-black page.
- Sheets are sized in `dvh`. iOS measures `vh` against the largest viewport, so
  a `90vh` sheet runs under the browser chrome and under the keyboard.
- Row actions are revealed on `pointer: coarse` as well as hover. A control that
  only appears on `:hover` does not exist on a touch screen.

## Verifying a change

`npm run build && npm start`, then:

- **Installability** — the manifest's icons must resolve; a 404 is silent in
  DevTools' Application panel unless you look.
- **Offline** — load every tab, go offline, relaunch. Figures should appear with
  the banner naming their time, not zeros.
- **Update** — build once, load the app, change something visible, build again,
  and bring the app back to the foreground. It should reload once into the new
  version, and a lazily-loaded chunk requested afterwards must not 404.

## Known limits

Playwright's WebKit cannot exercise a service-worker-served navigation:
`context.setOffline` fails the navigation with an internal error, and request
interception is blocked before the worker sees it. WebKit coverage therefore
asserts the cache contents directly and leaves the offline navigation itself to
Chromium and to real Safari.
