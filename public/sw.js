const VERSION = "horizon-0.34.8";
const SHELL_CACHE = `${VERSION}-shell`;
const RUNTIME_CACHE = `${VERSION}-runtime`;
const APP_SHELL = [
  "/offline.html",
  "/manifest.webmanifest",
  "/horizon-logo.png",
  "/icons/horizon-192.png",
  "/icons/horizon-512.png",
  "/icons/horizon-maskable-192.png",
  "/icons/horizon-maskable-512.png",
  "/icons/apple-touch-icon.png"
];

self.addEventListener("install", event => {
  event.waitUntil(caches.open(SHELL_CACHE).then(cache => cache.addAll(APP_SHELL)));
});

self.addEventListener("activate", event => {
  event.waitUntil(Promise.all([
    caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith("horizon-") && ![SHELL_CACHE,RUNTIME_CACHE].includes(key)).map(key => caches.delete(key)))),
    self.clients.claim()
  ]));
});

self.addEventListener("message", event => {
  if (event.data?.type === "SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("notificationclick", event => {
  event.notification.close();
  const target = event.notification.data?.url || "/";
  event.waitUntil(self.clients.matchAll({ type:"window", includeUncontrolled:true }).then(clients => {
    const existing = clients.find(client => new URL(client.url).pathname === target);
    return existing ? existing.focus() : self.clients.openWindow(target);
  }));
});

self.addEventListener("fetch", event => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || url.pathname.startsWith("/api/") || url.pathname.startsWith("/room/")) return;

  if (request.mode === "navigate") {
    event.respondWith(fetch(request).catch(() => caches.match("/offline.html")));
    return;
  }

  if (url.pathname.startsWith("/audio/lobby/")) {
    event.respondWith(caches.open(RUNTIME_CACHE).then(async cache => {
      const cached = await cache.match(request);
      if (cached) return cached;
      const response = await fetch(request);
      if (response.ok) cache.put(request,response.clone());
      return response;
    }));
    return;
  }

  if (/\.(?:css|js)$/.test(url.pathname)) {
    event.respondWith(caches.open(RUNTIME_CACHE).then(async cache => {
      try {
        const response = await fetch(request);
        if (response.ok) cache.put(request,response.clone());
        return response;
      } catch {
        return cache.match(request);
      }
    }));
    return;
  }

  if (/\.(?:png|webp|svg|gif|woff2?)$/.test(url.pathname)) {
    event.respondWith(caches.open(RUNTIME_CACHE).then(async cache => {
      const cached = await cache.match(request);
      const network = fetch(request).then(response => { if (response.ok) cache.put(request,response.clone()); return response; }).catch(() => cached);
      return cached || network;
    }));
  }
});
