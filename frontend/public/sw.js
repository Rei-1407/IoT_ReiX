// ============================================
// Service Worker — ReiX Home Monitor
// Cho phep cai PWA + mo offline (app shell)
// Chien luoc: network-first, mat mang thi dung cache
// ============================================
const CACHE_NAME = "reix-monitor-v1";
const APP_SHELL = [
  "./",
  "./index.html",
  "./mqtt.min.js",
  "./manifest.json",
  "./logo192.png",
  "./logo512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  if (new URL(event.request.url).origin !== location.origin) return;

  event.respondWith(
    fetch(event.request)
      .then((res) => {
        const clone = res.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        return res;
      })
      .catch(() =>
        caches
          .match(event.request)
          .then((cached) => cached || caches.match("./index.html"))
      )
  );
});
