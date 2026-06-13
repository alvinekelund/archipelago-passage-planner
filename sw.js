// Minimal service worker: makes the app installable and keeps the shell
// working offline once visited. Map tiles and the forecast still need a
// connection (and the forecast already caches itself in localStorage).
const SHELL = "passage-shell-v1";

// Relative to the SW's scope, so it works at the domain root locally and at
// a /<repo>/ subpath on GitHub Pages.
self.addEventListener("install", (e) => {
  self.skipWaiting();
  e.waitUntil(caches.open(SHELL).then((c) => c.addAll(["./", "./index.html", "./manifest.webmanifest", "./icon.svg"])));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== SHELL).map((k) => caches.delete(k))))
  );
  self.clients.claim();
});

self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  // Only handle same-origin GETs; never touch map tiles or API calls.
  if (e.request.method !== "GET" || url.origin !== self.location.origin) return;

  // Network-first for navigations so a new deploy is picked up, with the
  // cached shell as the offline fallback.
  if (e.request.mode === "navigate") {
    e.respondWith(
      fetch(e.request)
        .then((res) => {
          caches.open(SHELL).then((c) => c.put("./", res.clone()));
          return res;
        })
        .catch(() => caches.match("./").then((r) => r || caches.match("./index.html")))
    );
    return;
  }

  // Cache-first for same-origin static assets (the hashed JS/CSS bundles).
  e.respondWith(
    caches.match(e.request).then(
      (hit) =>
        hit ||
        fetch(e.request).then((res) => {
          if (res.ok) caches.open(SHELL).then((c) => c.put(e.request, res.clone()));
          return res;
        })
    )
  );
});
