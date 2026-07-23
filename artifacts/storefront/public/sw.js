// Service-worker kill switch (TNM-UIF-01 §9.5), shipped from Phase 0 so it is
// already in place at cutover. Inert unless a browser arrives still controlled
// by the legacy SPA's service worker: this replacement takes over immediately,
// deletes every cache, unregisters itself, and reloads open tabs so they fetch
// the live origin instead of a stale cached shell. The rebuild storefront never
// registers a service worker of its own.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => {
  e.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
      await self.registration.unregister();
      const cs = await self.clients.matchAll({ type: "window" });
      cs.forEach((c) => c.navigate(c.url));
    })(),
  );
});
