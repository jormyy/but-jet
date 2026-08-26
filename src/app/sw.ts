import { defaultCache } from "@serwist/turbopack/worker";
import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";
import { Serwist } from "serwist";

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  // A new worker waits instead of taking over a running page. Activating
  // immediately swaps the precache under a page whose code is already loaded,
  // and the lazily-loaded chart chunks would then 404 mid-session. The client
  // decides when to adopt the new version — see service-worker-updater.tsx.
  skipWaiting: false,
  // Only reached on a first install, where there is no old page to strand,
  // so the very first launch is offline-capable too.
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: defaultCache,
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
