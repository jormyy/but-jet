'use client'

import { useEffect } from 'react'

const SW_URL = '/serwist/sw.js'

// Registers the service worker and decides when a newly deployed version takes
// over. Registration lives here rather than in SerwistProvider, which calls
// register() without catching: Safari in private browsing has no service worker
// at all, and the rejection surfaced as an unhandled rejection on every load.
export function ServiceWorkerUpdater() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return

    let registration: ServiceWorkerRegistration | undefined
    let reloading = false

    const activate = (worker: ServiceWorker) => {
      if (reloading) return
      reloading = true
      // Listen before asking: the page has to reload to run the code the new
      // precache holds, and it only controls the page once it activates.
      navigator.serviceWorker.addEventListener('controllerchange', () => location.reload(), { once: true })
      worker.postMessage({ type: 'SKIP_WAITING' })
    }

    // Adopting mid-session would pull the page's own chunks out from under it,
    // so wait for the foreground: the moment a user expects a launch anyway.
    const adoptIfWaiting = async () => {
      if (document.visibilityState !== 'visible' || !registration) return
      await registration.update().catch(() => {})
      if (registration.waiting) activate(registration.waiting)
    }

    const register = () => {
      navigator.serviceWorker
        // updateViaCache: 'none' — the worker is served by a route handler whose
        // response is HTTP-cacheable, and the default would let the browser
        // check for a new version against its own cached copy of the old one.
        .register(SW_URL, { type: 'module', scope: '/', updateViaCache: 'none' })
        .then(reg => {
          registration = reg
          if (reg.waiting) activate(reg.waiting)
          reg.addEventListener('updatefound', () => {
            const installing = reg.installing
            installing?.addEventListener('statechange', () => {
              // Installed while another worker controls the page: an update, not a first install.
              if (installing.state === 'installed' && navigator.serviceWorker.controller) adoptIfWaiting()
            })
          })
        })
        // No service worker here (private browsing, unsupported context); the
        // app works online without one.
        .catch(() => {})
    }

    // Registering during the first render competes with the page's own assets,
    // and navigating away mid-fetch aborts the script load outright.
    const supportsIdle = 'requestIdleCallback' in window
    const idle = supportsIdle
      ? requestIdleCallback(register, { timeout: 4000 })
      : window.setTimeout(register, 1500)

    const onVisible = () => { adoptIfWaiting() }
    document.addEventListener('visibilitychange', onVisible)

    return () => {
      if (supportsIdle) cancelIdleCallback(idle)
      else clearTimeout(idle)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [])

  return null
}
