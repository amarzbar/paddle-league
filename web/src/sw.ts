/// <reference lib="webworker" />
// Ported near-verbatim from the previous Next.js app's public/sw.js - same
// network-first-with-cache-fallback strategy, same /api-always-bypass rule
// (live scores must never be served stale), just using Workbox's
// precacheAndRoute for the app shell instead of a hand-maintained file list
// (content-hash-based cache-busting comes for free this way).
import { precacheAndRoute } from "workbox-precaching";

declare const self: ServiceWorkerGlobalScope;

precacheAndRoute(self.__WB_MANIFEST);

const RUNTIME_CACHE = "racket-runtime-v1";

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((k) => k !== RUNTIME_CACHE && !k.startsWith("workbox-")).map((k) => caches.delete(k)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  // Never cache API calls - scores/event state must always come from the
  // network, never a stale cached response.
  if (url.pathname.startsWith("/api") || url.port === "8080") return;

  event.respondWith(
    fetch(request)
      .then((response) => {
        const copy = response.clone();
        caches.open(RUNTIME_CACHE).then((cache) => cache.put(request, copy));
        return response;
      })
      .catch(() => caches.match(request).then((cached) => cached || caches.match("/").then((r) => r as Response))),
  );
});
