import { defaultCache } from "@serwist/turbopack/worker";
import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";
import { ExpirationPlugin, NetworkFirst, Serwist } from "serwist";

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: [
    // Opening the app is a navigation, which defaultCache's page rule never matches (it keys off a
    // Content-Type request header that navigations don't send). It fell through to a NetworkFirst
    // with no timeout, so on a weak connection the app sat on a blank screen until the network gave
    // up. The pages are empty shells (all data loads client-side), so a cached copy is just as good.
    {
      matcher: ({ request, sameOrigin }) => sameOrigin && request.mode === "navigate",
      handler: new NetworkFirst({
        cacheName: "navigations",
        networkTimeoutSeconds: 3,
        plugins: [new ExpirationPlugin({ maxEntries: 32, maxAgeSeconds: 24 * 60 * 60 })],
      }),
    },
    ...defaultCache,
  ],
  fallbacks: {
    entries: [
      {
        url: "/~offline",
        matcher({ request }) {
          return request.destination === "document";
        },
      },
    ],
  },
});

serwist.addEventListeners();

// Review notifications sent by the sync (see src/lib/push.ts)
self.addEventListener("push", (event) => {
  const data = (event.data?.json() ?? {}) as { title?: string; body?: string; url?: string; tag?: string };
  event.waitUntil(
    self.registration.showNotification(data.title ?? "But Jet", {
      body: data.body,
      tag: data.tag,
      data: { url: data.url ?? "/" },
    })
  );
});

// Tapping a notification focuses the open app (or opens it) on the notification's page
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data as { url?: string } | undefined)?.url ?? "/";
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      const existing = windows[0];
      if (existing) {
        await existing.focus();
        await existing.navigate(url);
      } else {
        await self.clients.openWindow(url);
      }
    })()
  );
});
